#!/usr/bin/env python3
# Chandra Engine: the bridge between your Chandra agent (Claude Code) and its local engine.
# Copyright (C) 2026 Ananta Labs. All rights reserved.

"""An MCP server (stdio) that hands Chandra its engine: OpenJarvis, running on this computer.

Chandra itself runs on Claude Code. This bridge gives it a second brain that
lives entirely on this machine: a local model it can delegate to (private,
free, works offline), and OpenJarvis's local search index, which the start
script keeps filled with the agent's vault.

It must run with the Python interpreter of the OpenJarvis install, because it
imports OpenJarvis directly:

    claude mcp add --scope local chandra-engine -- <openjarvis venv python> -I <this file>

Tools:
    chandra_ask     ask the local model (optionally through an OpenJarvis agent)
    chandra_index   index a file or folder into the local search index
    memory_search   search the local index (the vault, plus anything indexed)
    memory_store    save a snippet into the local index
    chandra_status  what engine, models and index this bridge can see

Only JSON-RPC goes to stdout. Everything OpenJarvis prints is redirected to
stderr, because a stray line on stdout corrupts the MCP stream.
"""

from __future__ import annotations

import contextlib
import json
import sys
import traceback
from pathlib import Path
from typing import Any, Callable, Dict, Optional

SERVER_NAME = "chandra-engine"
SERVER_VERSION = "1.1.0"
DEFAULT_PROTOCOL = "2025-06-18"

# The real stdout, kept for JSON-RPC. sys.stdout is pointed at stderr for the
# lifetime of the process so library prints can never reach the client.
_RPC_OUT = sys.stdout
sys.stdout = sys.stderr


def _log(msg: str) -> None:
    print(f"[chandra-engine] {msg}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------- lazy state

class _State:
    jarvis: Any = None
    backend: Any = None
    backend_error: Optional[str] = None
    tool_server: Any = None


S = _State()


def _get_jarvis() -> Any:
    if S.jarvis is None:
        from openjarvis.sdk import Jarvis

        S.jarvis = Jarvis()
    return S.jarvis


def _get_backend() -> Any:
    """The local search index. Needs OpenJarvis's native Rust extension."""
    if S.backend is not None:
        return S.backend
    if S.backend_error is not None:
        raise RuntimeError(S.backend_error)
    try:
        from openjarvis.core.config import load_config
        from openjarvis.sdk import MemoryHandle

        S.backend = MemoryHandle(load_config())._get_backend()
        return S.backend
    except Exception as exc:  # remembered so every call explains the same fix
        S.backend_error = (
            f"{exc}\n\nThe local search index is unavailable. OpenJarvis's "
            "installer builds the native extension in the background after "
            "install; `jarvis doctor` shows whether it finished."
        )
        raise RuntimeError(S.backend_error) from exc


def _get_tool_server() -> Any:
    """OpenJarvis's own MCP dispatcher, so its security gates still apply."""
    if S.tool_server is None:
        from openjarvis.mcp.server import MCPServer
        from openjarvis.tools.storage_tools import MemorySearchTool, MemoryStoreTool

        backend = _get_backend()
        S.tool_server = MCPServer(
            tools=[MemorySearchTool(backend), MemoryStoreTool(backend)],
            agent_id="chandra-engine",
        )
    return S.tool_server


# --------------------------------------------------------------------- tools

def _text(text: str, error: bool = False) -> Dict[str, Any]:
    return {"content": [{"type": "text", "text": text}], "isError": error}


def tool_chandra_ask(args: Dict[str, Any]) -> Dict[str, Any]:
    prompt = str(args.get("prompt", "")).strip()
    if not prompt:
        return _text("No prompt given.", error=True)
    # "simple" by default: OpenJarvis applies the persona (agent.default_system_prompt)
    # only in agent mode, and the wizard writes the agent's identity there.
    agent = args.get("agent") or "simple"
    if agent == "none":
        agent = None
    kwargs: Dict[str, Any] = {"agent": agent}
    if args.get("model"):
        kwargs["model"] = args["model"]
    if args.get("max_tokens"):
        kwargs["max_tokens"] = int(args["max_tokens"])
    answer = _get_jarvis().ask(prompt, **kwargs)
    return _text(answer or "(the local model returned an empty answer)")


def tool_chandra_index(args: Dict[str, Any]) -> Dict[str, Any]:
    # Mirrors `jarvis memory index`: each file's old chunks are replaced, so
    # re-indexing the vault every launch never piles up duplicates.
    target = Path(str(args.get("path", ""))).expanduser()
    if not str(args.get("path", "")).strip() or not target.exists():
        return _text(f"Path not found: {args.get('path', '')}", error=True)

    from openjarvis.tools.storage.chunking import ChunkConfig
    from openjarvis.tools.storage.ingest import ingest_path

    chunks = ingest_path(
        target,
        config=ChunkConfig(
            chunk_size=int(args.get("chunk_size", 512)),
            chunk_overlap=int(args.get("chunk_overlap", 64)),
        ),
    )
    if not chunks:
        return _text(f"No indexable content found in {target}.")
    backend = _get_backend()
    by_source: Dict[str, list] = {}
    for c in chunks:
        by_source.setdefault(c.source, []).append(
            (c.content, {"offset": c.offset, "index": c.index})
        )
    replace = getattr(backend, "replace_source", None)
    for source, docs in by_source.items():
        if callable(replace):
            replace(source, docs)
        else:
            for content, meta in docs:
                backend.store(content, source=source, metadata=meta)
    return _text(f"Indexed {len(chunks)} chunks from {len(by_source)} file(s) in {target}.")


def _passthrough(name: str) -> Callable[[Dict[str, Any]], Dict[str, Any]]:
    def run(args: Dict[str, Any]) -> Dict[str, Any]:
        from openjarvis.mcp.protocol import MCPRequest

        resp = _get_tool_server().handle(
            MCPRequest(method="tools/call", params={"name": name, "arguments": args}, id=1)
        )
        if resp.error:
            return _text(resp.error.get("message", str(resp.error)), error=True)
        return resp.result

    return run


def tool_chandra_status(_args: Dict[str, Any]) -> Dict[str, Any]:
    lines = []
    try:
        import openjarvis

        lines.append(f"OpenJarvis {openjarvis.__version__} at {Path(openjarvis.__file__).parent}")
    except Exception as exc:
        return _text(f"OpenJarvis is not importable from {sys.executable}: {exc}", error=True)
    try:
        from openjarvis._rust_bridge import RUST_AVAILABLE

        lines.append(f"native extension: {'ready' if RUST_AVAILABLE else 'NOT built yet'}")
    except Exception:
        lines.append("native extension: unknown")
    try:
        j = _get_jarvis()
        lines.append(f"supported engines: {', '.join(j.list_engines()) or 'none found'}")
        lines.append(f"models: {', '.join(j.list_models()) or 'none pulled'}")
    except Exception as exc:
        lines.append(f"engine: unavailable ({exc}). Is Ollama running? `jarvis doctor` explains.")
    try:
        count = getattr(_get_backend(), "count", None)
        lines.append(f"search index: ready{f', {count()} chunks' if callable(count) else ''}")
    except Exception as exc:
        lines.append(f"search index: unavailable ({str(exc).splitlines()[0]})")
    return _text("\n".join(lines))


TOOLS: Dict[str, Dict[str, Any]] = {
    "chandra_ask": {
        "run": tool_chandra_ask,
        "description": (
            "Ask the Chandra Engine: the LOCAL model running on this machine "
            "through OpenJarvis (Ollama by default). Private (nothing leaves the computer), free, "
            "and works offline. Use it for anything the person wants kept on "
            "their own hardware, for bulk or repetitive subtasks, or for a "
            "second opinion. It answers in the agent's own persona. Pass "
            "agent='deep_research' for multi-hop research with citations over "
            "the local index, or agent='none' for a raw model call."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "What to ask."},
                "agent": {
                    "type": "string",
                    "description": "OpenJarvis agent: simple (default), orchestrator, "
                    "native_react, deep_research, or none.",
                },
                "model": {"type": "string", "description": "Override the local model, e.g. qwen3.5:2b."},
                "max_tokens": {"type": "integer", "minimum": 1},
            },
            "required": ["prompt"],
        },
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    "chandra_index": {
        "run": tool_chandra_index,
        "description": (
            "Index a file or folder into the Chandra Engine's local search index "
            "so memory_search and the local model can find it. Re-indexing the "
            "same path replaces its old entries (no duplicates). The vault is "
            "re-indexed automatically every time the agent starts."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File or folder to index."},
                "chunk_size": {"type": "integer", "minimum": 1},
                "chunk_overlap": {"type": "integer", "minimum": 0},
            },
            "required": ["path"],
        },
        "annotations": {"readOnlyHint": False, "destructiveHint": False},
    },
    "memory_search": {
        "run": _passthrough("memory_search"),
        "description": (
            "Search the Chandra Engine's local index (the agent's vault plus anything "
            "indexed) by meaning and keywords. Fast way to find which notes "
            "mention something before reading them."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query."},
                "top_k": {"type": "integer", "description": "Number of results (default 5)."},
            },
            "required": ["query"],
        },
        "annotations": {"readOnlyHint": True},
    },
    "memory_store": {
        "run": _passthrough("memory_store"),
        "description": (
            "Save a snippet into the Chandra Engine's local index. This is NOT the "
            "agent's memory vault; durable memories still belong in the vault "
            "as notes. Use this for scratch facts the local model should see."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "The text to store."},
                "source": {"type": "string", "description": "Optional source label."},
            },
            "required": ["content"],
        },
        "annotations": {"readOnlyHint": False, "destructiveHint": False},
    },
    "chandra_status": {
        "run": tool_chandra_status,
        "description": "Report the Chandra Engine's health: OpenJarvis version, engines, local models and index. Run this first when anything local misbehaves.",
        "inputSchema": {"type": "object", "properties": {}},
        "annotations": {"readOnlyHint": True},
    },
}


# ------------------------------------------------------------------- JSON-RPC

def _reply(msg_id: Any, result: Any = None, error: Optional[Dict[str, Any]] = None) -> None:
    obj: Dict[str, Any] = {"jsonrpc": "2.0", "id": msg_id}
    if error is not None:
        obj["error"] = error
    else:
        obj["result"] = result
    _RPC_OUT.write(json.dumps(obj) + "\n")
    _RPC_OUT.flush()


def handle(msg: Dict[str, Any]) -> None:
    method = msg.get("method")
    msg_id = msg.get("id")
    params = msg.get("params") or {}
    is_notification = "id" not in msg

    if method == "initialize":
        _reply(msg_id, {
            "protocolVersion": params.get("protocolVersion") or DEFAULT_PROTOCOL,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            "instructions": (
                "The Chandra Engine (OpenJarvis) is this agent's local engine: a "
                "model and a search index on the person's own machine. Prefer chandra_ask "
                "when the person wants something kept private or offline."
            ),
        })
    elif method == "ping":
        _reply(msg_id, {})
    elif method == "tools/list":
        _reply(msg_id, {"tools": [
            {"name": n, "description": t["description"], "inputSchema": t["inputSchema"],
             "annotations": t.get("annotations", {})}
            for n, t in TOOLS.items()
        ]})
    elif method == "tools/call":
        name = params.get("name")
        tool = TOOLS.get(name)
        if tool is None:
            _reply(msg_id, error={"code": -32602, "message": f"Unknown tool: {name}"})
            return
        try:
            with contextlib.redirect_stdout(sys.stderr):
                result = tool["run"](params.get("arguments") or {})
            _reply(msg_id, result)
        except Exception as exc:
            _log(traceback.format_exc())
            _reply(msg_id, _text(f"{name} failed: {exc}", error=True))
    elif is_notification:
        return  # notifications/initialized, cancellations: nothing to answer
    else:
        _reply(msg_id, error={"code": -32601, "message": f"Unknown method: {method}"})


# ------------------------------------------------------------- launch helpers

BRIDGE_JSON = Path(__file__).resolve().parent / "engine.json"


def _load_bridge_json() -> Dict[str, Any]:
    try:
        return json.loads(BRIDGE_JSON.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}


def sync() -> int:
    """Run by the Chandra start scripts on every launch, quietly, in the background.

    1. Re-applies the agent's persona to OpenJarvis if something reset it
       (`jarvis init --force` rewrites the whole config, persona included).
    2. Re-indexes the vault, so the local search sees today's notes.
    """
    cfg = _load_bridge_json()
    persona = str(cfg.get("persona", "")).strip()
    if persona:
        from openjarvis.core.config import load_config

        if load_config().agent.default_system_prompt.strip() != persona:
            import subprocess

            subprocess.run(
                [sys.executable, "-m", "openjarvis.cli", "config", "set",
                 "agent.default_system_prompt", persona],
                check=False, stdout=sys.stderr, stderr=sys.stderr,
            )
            _log("persona re-applied to OpenJarvis")
    status = 0
    if cfg.get("reindex_on_start", True):
        for path in cfg.get("index_paths", []):
            try:
                result = tool_chandra_index({"path": path})
                _log(result["content"][0]["text"])
                status |= int(result.get("isError", False))
            except Exception as exc:
                _log(f"index of {path} skipped: {str(exc).splitlines()[0]}")
                status = 1
    return status


def main() -> None:
    if "--check" in sys.argv:
        result = tool_chandra_status({})
        _RPC_OUT.write(result["content"][0]["text"] + "\n")
        sys.exit(1 if result["isError"] else 0)
    if "--sync" in sys.argv:
        sys.exit(sync())

    _log(f"ready (python {sys.executable})")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            _reply(None, error={"code": -32700, "message": "Parse error"})
            continue
        for item in msg if isinstance(msg, list) else [msg]:
            handle(item)


if __name__ == "__main__":
    main()
