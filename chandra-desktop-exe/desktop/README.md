<p align="center"><img src="../brand/chandra-app-icon.png" width="96" alt="Chandra"></p>

# Chandra Desktop — v1.0.0

**Chandra · Ananta Labs.** Chandra's own window: a black-only desktop workspace with the silver crescent-and-star identity, the eclipse arc and liquid blobs, a frameless native window with macOS-style traffic lights, and one assistant, Chandra, who can operate the computer one approved action at a time.

It is one piece of Chandra; the toolbox one folder up installs and starts it. On its own:

```
cd desktop/source
pip install -r requirements.txt
python chandra.py              # the app window
python chandra.py --browser    # in your browser instead (Linux, or no WebView)
```

## How it thinks

The page holds **no API key**. It asks Chandra's host (`chandra.py`), which answers with:

- **Claude**, when `chandra.env` sets `ANTHROPIC_API_KEY`; else
- **Gemini** (free, with screen vision), when it sets `GEMINI_API_KEY`; else
- **the Chandra Engine**, the local model on this computer (OpenJarvis's server at `CHANDRA_ENGINE_URL`). Screen reading needs Claude or Gemini; the engine reads text only and Chandra says so.

Both keys can be typed in Settings > AI brain; the host writes them to `chandra.env` and the window never keeps them.

## In Chandra's own window (1.6)

The window controls the computer itself. Screen, mouse, keyboard, screenshots and Screen sense go through the window's own channel (pywebview's `js_api`): no bridge to connect, no address or pairing code, and no screen frame on HTTP. Screen sense captures, compares and reads the screen inside Chandra's process and starts by itself, with no share prompt. While the window is open, the HTTP `/act` route refuses computer actions. In a plain browser (`--browser`, or "Chandra in your browser") the loopback bridge with its pairing code works as before.

## Voice first (1.7)

Tap the moon (or hold it, or hold Space) to talk. With a Gemini key, Chandra listens for itself (`ui/ear.js`): it records the microphone, detects where speech starts and ends, and the host's `/stt` (or the window's `stt`, never HTTP in the window) has Gemini transcribe English, Hindi and Hinglish. Without one, the browser's recogniser is used. `ui/voicefirst.js` draws the talk button, the listening ring, captions and the English / हिन्दी / Hinglish switch. Spoken requests get spoken-style answers in the language used.

## Voice (new in 1.5)

With a Gemini key, Chandra speaks in a Gemini neural voice through the host (`/tts`, default voice Sulafat), sentence by sentence, and the speaking light follows the real audio. Without one, or if it fails, Chandra uses the best voice on this computer, natural (neural) voices first. Settings > Chandra voice switches between the two and picks the voice.

Replies are drawn as **Markdown** (headings, lists, tables, code, links) with **LaTeX** maths (`$x^2$` inline, `$$...$$` or `\[...\]` for display) through KaTeX as MathML (`ui/katex.min.js`, `ui/chatmd.js`; the same renderer draws Document artifacts). Formulas are never read aloud, and a formula KaTeX cannot read stays visible as source. Plain sentences stay plain text.

`chandra.env.example` documents every setting and where the file goes. With no Claude key, Chandra thinks with the **Chandra Engine** on this computer.

## Artifacts (new in 1.2)

What Chandra makes in a conversation (code, HTML apps, documents, SVG, charts, tables, JSON) is kept as an **artifact**: versioned, persistent, and on its own page (key **7**). Each is one JSON file in Chandra's data folder (`artifacts/`), so it survives restarts and reinstalls.

- **Click** an artifact for its normal view: apps run in a sandboxed preview, documents open to read, code opens in the source view, data opens as a table, charts draw.
- **Shift+click** (or Shift+Enter, or the **Inspect source** tab) shows where it came from instead: the conversation and message, any file on this computer Chandra really read, wrote or was given (with the exact line range when the content can be found in it), and the Chandra code that handles it, with live line ranges. Nothing is guessed: a path the model only mentioned is listed and never opened, and Chandra never searches your computer.
- HTML artifacts run in an iframe sandbox without same-origin access and under a strict content policy: no network, no access to Chandra, its key or your files. Scripts and styles may load only from cdnjs, jsDelivr and unpkg.
- Revise, Regenerate and Restore always add a version; up to 30 are kept per artifact, 500 artifacts in all.

## Files

- `source/chandra.py`: the app entry point. UI host, `/brain` and `/engine/v1`, the computer bridge, and (1.2) `/artifacts/*` and `/source/*`.
- `source/app.v1.html`: the editable page. `python pack.py` builds it, with the modules below, into `chandra.py` (`python pack.py --check` verifies the embedded copy is current).
- `source/ui/`: the UI modules, kept as separate files and inlined by `pack.py`: `state.js` (what Chandra is doing), `blob.js` and `presence.js` (the speaking light), `aurora.js` (the sky, 1.6), `home.js` and `calm.css` (the calm home, 1.6), `ear.js` (listening) and `voicefirst.js` (the voice-first home, 1.7), `target-cursor.js` (precision cursor), `artifacts.js` and `artifact-render.js` (artifacts), `composer.js` (attachments, revise, Send/Stop), `credits.js`, `chandra-ui.css` (the design tokens).
- `source/tests/`: host tests, `python -m unittest discover -s tests` (standard library only): artifacts and source discovery, plus the 1.5 merge (file safety, skills, brain order, recall, diagnostics, voice).
- `THIRD-PARTY-NOTICES.md`: React Bits (Target Cursor, Gradient ASCII, Grainient), chart colours, the LZMA SDK, SF Pro.
- `RELEASE-NOTES-v1.0.2.md` (safeguards), `RELEASE-NOTES-v1.0.1.md` (fixes) and `RELEASE-NOTES-v1.0.0.md`: what is in Chandra 1.0. The notes of the internal builds before it (1.1 to 1.7) are in `history/`.

## The Windows installer

`../installer/` builds **Chandra-Setup-v<version>.exe**: one self-contained, per-user (no administrator rights) installer for 64-bit Windows 10 and 11, carrying the whole toolbox including Chandra's own Python runtime.

```
python installer/build_installer.py          # needs MinGW-w64 (apt install g++-mingw-w64-x86-64); the payload is packed with Python's lzma
```

1.5 was packed without the native build: `installer/chsetup.py` (standard library only) reads a Chandra Setup, checks its CRCs, extracts it, and rebuilds it around a new toolbox while keeping the setup program and its interface:

```
python installer/chsetup.py info    Chandra-Setup-v1.4.0.exe
python installer/chsetup.py build   Chandra-Setup-v1.4.0.exe . 1.5.0 dist/Chandra-Setup-v1.5.0.exe
python installer/chsetup.py build   Chandra-Setup-v1.4.0.exe . 1.0.3 dist/Chandra-Setup-v1.0.3-personal.exe keys.env
```

A fifth argument makes a **personal** setup: the `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` lines of that file (nothing else) ride along, and on first launch Chandra moves them into `%APPDATA%\Chandra\chandra.env` and deletes the copy beside the app. A key already set there wins, so Update or Repair never undoes a key changed in Settings. Anyone holding a personal setup can read its keys: keep it to your own computers, and keep `keys.env` out of the toolbox (no `chandra.env` is ever packed from it).

Setup is Chandra's own program (`installer/native/setup.cpp`, C++ and GDI+), not a stock installer: a frameless window in the Starlight look with SF Pro type, traffic-light controls and a Gradient ASCII sky, about 13 MB in all. It installs to `%USERPROFILE%\chandra-home\chandra` and adds Chandra to the Desktop (optional), plus Chandra, Chandra in your browser, Set up Chandra and Uninstall in the Start menu, and an Apps & features entry. **Run it again while Chandra is installed and it opens in maintenance mode: Update (or Repair), or Uninstall.** Uninstall removes exactly the files Setup installed (it keeps a manifest) and never files you or the guided setup added; `%APPDATA%\Chandra` (key, settings, memory, chats, artifacts) is kept unless you tick "Also remove my data". If Chandra is running, Setup says so and can close it for you. If WebView2 is missing, the last page offers Microsoft's download. Flags: `/S` (silent), `/uninstall`, `/D=<folder>`; exit codes 0 done, 1 cancelled, 2 failed. A log goes to `%TEMP%\Chandra-Setup.log`.

The PyInstaller build files for a standalone `Chandra.exe` (`chandra.spec`, `version_info.txt`, `docs/BUILD.md`) live in Chandra Desktop's build repository and are not part of this toolbox copy.

The brand guide for every Chandra surface is `../brand/BRAND.md`.

## Extra tools with MCP

Chandra can use any MCP tool server (a browser, GitHub, files, search, memory and more). Copy `mcp.example.json` to `mcp.json` in Chandra's data folder (Windows `%APPDATA%\Chandra\mcp.json`), keep the servers you want, and press **Reload tools** in Settings > Extra tools (MCP).

- Servers run with `npx` (needs Node.js) or `uvx` (needs uv). Neither is bundled, which keeps Chandra light.
- Each server asks for your approval in an on-screen dialog the first time it starts, and each of its tools asks in the chat the first time it is used in a session. Their results are treated as data, never as instructions.
- Chandra's file tools cannot read or edit Chandra's data folder, so a web page cannot add a server or read your key.
- Good starting points: the official reference servers (time, fetch, memory, filesystem, sequential thinking, git) from `modelcontextprotocol/servers`, Microsoft's `playwright-mcp` for a real browser, and `github/github-mcp-server` for GitHub. Check each project's licence before you rely on it.
