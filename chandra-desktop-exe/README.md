<p align="center">
  <img src="brand/chandra-app-icon.png" width="120" alt="Chandra">
</p>

<h1 align="center">Chandra</h1>

<p align="center"><b>A personal intelligence by Ananta Labs.</b><br>Serene at rest, capable in motion.</p>

<p align="center"><img src="brand/chandra-face-preview.jpg" width="80%" alt="The Chandra face: the silver crescent inside an eclipse arc, speaking"></p>

---

Chandra is a personal intelligence that lives on your own computer and grows into one you can talk to, look at, and hand real work to. One guided conversation builds all of Chandra:

| | | |
|---|---|---|
| **The memory** | a vault of plain-text notes Chandra reads and writes, so Chandra remembers you, your work, and every lesson | Obsidian vault |
| **The voice** | hold a key, speak, and Chandra answers out loud about a second later | push-to-talk or hands-free |
| **The face** | the silver crescent inside an eclipse arc; its light quickens when Chandra thinks and carries Chandra's voice when Chandra speaks | full-screen, in your browser |
| **The Chandra Engine** | a second mind that runs entirely on your machine: private, free, offline; fast search over Chandra's memory; deep research, a spoken morning briefing, watchers, skills | local models |
| **Chandra Desktop** | Chandra's own black, quiet window: one assistant with home, memory and artifacts, a natural voice, and the ability to operate your computer: routine work runs without a question, and only sensitive steps ask | Windows · macOS · Linux |
| **The hands** *(optional)* | move notes and images on screen with your bare hands through your webcam | webcam |

Chandra's mind runs on Claude Code. When something should stay on your machine, or the internet is gone, Chandra thinks with the Chandra Engine instead, and Chandra says so when Chandra does.

## Begin

**Windows:** run **`Chandra-Setup-v1.0.6.exe`** (about 12.5 MB, 64-bit Windows 10 or 11, no administrator rights). It installs Chandra Desktop for your account and adds Start Menu and desktop shortcuts. Or unzip **`Chandra-Portable-v1.0.6.zip`** and double-click `Chandra.bat` inside it; nothing is installed and its data stays in its `data` folder. Then open **Chandra**: it walks you through your name and what Chandra may do, and Settings > AI brain takes a Claude or free Gemini key. Nothing else needs to be installed. `COMPATIBILITY.txt` lists the supported Windows versions.

**macOS and Linux**, or Windows without the installer: you need [Claude Code](https://claude.com/claude-code) with a Claude subscription, and git on macOS and Linux (on Windows, setup installs it).

1. Unzip this folder into a new folder directly in your home directory, for example `~/chandra-home/chandra`. (On Macs, background tasks running out of Documents get blocked by the system.)
2. Open a terminal in `chandra` and run:

```
claude "set me up"
```

The rest is a conversation. Chandra asks your name, who Chandra should be (Chandra as shipped is the default), which pieces you want, and where your notes live. Chandra does the installing, the configuring and the wiring itself, and ends by saying hello out loud.

## Every day

Setup leaves shortcuts on your Desktop, with the Chandra icon:

- **Chat with Chandra** — a typed session.
- **Talk to Chandra** — the voice and the face.
- **Chandra Desktop** — Chandra's own desktop window, with the engine behind it.
- **Chandra offline** — the local model only; works with the internet unplugged.
- **Chandra barehands** — the voice and the hands board.
- **Update Chandra** (macOS, Linux) — every piece and the engine, showing what changed. On Windows, ask Chandra: "update everything and tell me what changed."

Something broken or confusing? **Ask Chandra to fix it.** Every piece ships a troubleshooting guide written for Chandra, and fixing itself is part of Chandra's job.

They all run `chandra/start.sh` (Windows: `start.bat`) with `voice`, `desktop`, `local` or `hands`, if you prefer the terminal.

## How the pieces meet

- **Chandra ↔ the Chandra Engine.** `engine/chandra_engine.py` is a small MCP server that runs on the engine's own Python. It gives Chandra `chandra_ask` (the local model, in Chandra's persona; `agent: "deep_research"` for cited research), `memory_search` and `chandra_index` (the local index of Chandra's vault), `memory_store`, and `chandra_status`. Every launch re-indexes the vault and re-applies Chandra's persona if anything reset it.
- **Chandra Desktop ↔ its brain.** The desktop page holds no key. It asks its host, which answers with Claude when `chandra.env` on your computer has a key, and otherwise with the Chandra Engine's local server. With no Claude key, Chandra thinks with the Chandra Engine on this computer.
- **The voice ↔ the face.** The voice writes small status notes; the face reads them. That is the whole connection.

## What's in this folder

```
chandra/
├── CLAUDE.md              the installer's boot file
├── chandra-setup.md       the setup wizard
├── start.sh / start.bat   all | voice | hands | desktop | local
├── update.sh / update.bat update every piece and the engine
├── sources.conf           where each piece is downloaded from
├── TROUBLESHOOTING.md     problems that live between the pieces
├── persona/chandra.md     who Chandra is (the default identity)
├── brand/                 the mark, icons, face preview, BRAND.md
├── face/chandra/          the Chandra face for the visualizer
├── engine/                the Chandra Engine bridge (MCP server)
├── desktop/               Chandra Desktop: source, build, docs
├── OpenJarvis/            the engine's full source snapshot
└── .github/workflows/     the PyInstaller build for a standalone Chandra.exe
```

## The fine print that matters

- Setup never deletes, overwrites, or moves anything you built. Replacements retire the old thing in place and say so. Your vault stays where it lives; the engine indexes only the vault Chandra uses.
- **Keys:** an Anthropic API key, if you choose to give Chandra Desktop one, is pasted into Settings > AI brain and lives only in `chandra.env` on your computer. It is separate from your Claude subscription and billed per use. Without one, the desktop thinks locally. A free Gemini key from aistudio.google.com also works, and lets Chandra read the screen at no cost.
- **Computer control and permissions:** Chandra has no permission switches and no first-run permission step. Opening apps, clicking, typing, searching, reading and organizing files run without a question. Each workflow asks once: a purchase at its final commit, a message before its first send, a deletion or a changing shell command once per task, and typing into a sign-in or security screen once per window. Sending data to a web service asks once per task, and tool servers ask once per session. Voice confirmations are spoken once and can be answered by voice ("yes", "no", "stop"). **Stop all** halts everything; throwing the mouse into any screen corner aborts instantly. On macOS it needs Accessibility and Screen Recording permission; on Linux, an X11 session.
- **Requirements:** the voice needs a mic and about 1 GB of local models; the hands need a webcam and Chrome; the memory and face need Python 3. The engine needs a few GB for its runtime and a small starter model (on Windows also Python 3.10–3.13 and Microsoft's C++ build tools). Chandra Desktop needs Python 3.12 (setup provides it) and, on Windows 10, Microsoft's WebView2 runtime.
- **Statistics:** the engine can share anonymous usage statistics with its developers. Setup asks; the default is no.
- This toolbox is Chandra's own build and never resets itself to any upstream repository. The pieces it installs update normally.
- The `OpenJarvis/` snapshot omits one 77 MB prebuilt Ollama binary used only for building OpenJarvis's own desktop app (`OpenJarvis/desktop/src-tauri/binaries/README.md`).

---

<p align="center">© 2026 Ananta Labs. All rights reserved.</p>
