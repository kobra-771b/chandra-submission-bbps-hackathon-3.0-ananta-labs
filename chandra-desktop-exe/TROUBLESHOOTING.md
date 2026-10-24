# Chandra: troubleshooting

This file covers the problems that live BETWEEN Chandra's pieces. Each piece owns its deeper guide: `ai-memory-vault/TROUBLESHOOTING.md` (the memory), `backtalk/TROUBLESHOOTING.md` (the voice), `ai-visualizer/TROUBLESHOOTING.md` (the face), `barehands/TROUBLESHOOTING.md` (the hands). For the Chandra Engine, `jarvis doctor` is the first stop, and its full docs ship in `chandra/OpenJarvis/docs/`. For Chandra Desktop, `chandra/desktop/docs/BUILD.md`.

Easiest of all: open a chat with Chandra and describe the problem. Chandra reads these guides and fixes it.

## Setup

### I closed the window in the middle of setup

Nothing is lost. Open a new terminal (PowerShell on Windows), go back to the toolbox folder (`cd ~/chandra-home/chandra`, or on Windows `cd $HOME\chandra-home\chandra`), and run:

```
claude --continue
```

That reopens the last session with its memory intact; say "we got cut off, keep going with the setup." If there is no session to continue, run `claude "set me up"`: setup starts over, finds everything already downloaded, and skips ahead.

### Claude Code opened, but it acts like nothing's there

Make sure Claude Code opened INSIDE the `chandra` folder (the one with `chandra-setup.md` in it). Anywhere else, it never sees the installer. Type `/exit`, `cd` into the folder, and run `claude "set me up"` again. On a Mac, a "developer tools" dialog may be waiting for a click (that installs git; click Install, then run the command again).

### Windows says "claude is not recognized," or the Claude Code install "isn't doing anything"

The Claude Code installer on Windows downloads about 330 MB and prints nothing while it does, for a few minutes. People close the window because it looks dead, and then `claude` is not recognized. Run the installer again and leave the window alone until it prints "Installation complete!", then open a NEW terminal and run `claude "set me up"` in the toolbox folder. Re-running setup is always safe.

### The Mac says "xcrun: error: invalid active developer path"

Apple's Command Line Tools are missing (git needs them; macOS upgrades can remove them). Run `xcode-select --install`, click Install, wait a few minutes, then `claude "set me up"` again.

### Claude opened a welcome screen (or asked me to log in) instead of setting up

That is Claude Code's own first-run setup: pick a text style, choose "Claude account with subscription" (not the Console option, which is pay-per-use billing), and log in. Then type `set me up`.

## Voice and face

### The face sits at rest while Chandra talks

One config line plus a restart:

1. `ai-visualizer/ai-visualizer.json` needs `"bus_dir"` pointing at the backtalk folder. (Or, from the other side, `"signals_dir"` in `backtalk/backtalk.json` pointing at the visualizer folder. One direction, not both.)
2. Restart the stack after any config change (Ctrl-C, then `start.sh` again).

While Chandra speaks, the backtalk folder should hold fresh `.voice_state` and `.voice_waveform` files. If not, the problem is on the voice side; work backtalk's guide.

### The face opens on a different design, or "chandra" is missing from the gallery

`ai-visualizer/faces/chandra/` must hold `index.html`, `face.json` and `mark.png` (copied from `chandra/face/chandra/`), and `ai-visualizer.json` must say `"face": "chandra"`. `update.sh` refreshes the copy; on Windows, copy the folder again by hand. The gallery at `http://127.0.0.1:8790/` lists every installed face.

### The greeting doesn't speak on launch

The greeting lives in `backtalk/backtalk.json` under `"greeting"`. Missing or empty means a silent launch by configuration. If the voice itself fails to start, its terminal output says why.

### start.sh says a piece is starting but nothing appears

- The face opens a browser tab on whichever face `ai-visualizer.json` names. No tab? Open `http://127.0.0.1:8790/` and click Chandra in the gallery (that address is the picker, not the face).
- The hands never open a tab on their own: `http://127.0.0.1:8794/` in Chrome.
- Two stacks can't run at once. If a port is busy from an earlier session, close the old terminal and start again.

## Chandra Desktop

### "No brain available"

Chandra Desktop has neither a Claude key in `chandra.env` nor a running Chandra Engine. Start it with `start.sh desktop` / `start.bat desktop`, which starts the engine's server first. If the server will not start, `chandra/engine/serve.log` says why (most often: the server extra is missing on macOS/Linux; setup's Phase 3 step 5 installs it, or port 8000 is taken by something else, in which case set `CHANDRA_ENGINE_URL` in `chandra.env` and start the server on that port).

### "Reading the screen needs Claude or Gemini"

Screen sense and screenshot feedback need a vision model. The Chandra Engine's local model reads text only, and Chandra says so rather than guessing. Either add `ANTHROPIC_API_KEY` (Claude, from console.anthropic.com, billed per use) or `GEMINI_API_KEY` (Gemini, free, from aistudio.google.com) to `chandra.env`, or paste it in Settings > AI brain. Restart Chandra Desktop if you edited the file.

### Chandra doesn't hear me, or gets Hindi wrong

Tap the moon (or hold Space) and watch the ring: it should move with your voice. If it doesn't, Windows may be blocking the microphone (Settings > Privacy & security > Microphone, allow desktop apps). For Hindi and Hinglish, add a free Gemini key in Settings > AI brain: Chandra then listens through Gemini, which follows both languages, even mixed. Without it, the browser's recogniser hears one language at a time, set by the EN / हि / Mix switch, and it is unreliable inside Chandra's window. Settings > Diagnostics shows which one is in use.

### Chandra's voice sounds robotic, or switched voices mid-reply

With a Gemini key, Chandra speaks in a Gemini neural voice (Settings > Chandra voice > Natural voice). If that fails (no internet, or Gemini's free speech quota is used up for now), Chandra finishes in this computer's voice and pauses the natural voice for a few minutes; the line under Natural voice says why, and Settings > Diagnostics shows it too. Without a Gemini key, Chandra uses the best voice installed on the computer, natural voices first (starred in the list). On Windows 11, add natural voices in Settings > Time & language > Speech; on macOS, download a Premium or Enhanced voice in System Settings > Accessibility > Spoken Content.

### "The Claude API key was rejected"

A key pasted into Settings > AI brain is written to `chandra.env`, and the window keeps no copy. If Anthropic rejects it, check that it is a current key from console.anthropic.com (a Claude subscription does not include API access), then paste the key again. Keys that Chandra 1.0.x shipped inside the app should be rotated at console.anthropic.com, then replaced with a new key in Settings > AI brain.

### Where does chandra.env go?

`%APPDATA%\Chandra\chandra.env` on Windows, `~/Library/Application Support/Chandra/chandra.env` on macOS, `~/.config/Chandra/chandra.env` on Linux (a copy next to `Chandra.exe` / `chandra.py` is read too, and saving a key in Settings removes that copy). Every setting is documented in `chandra/desktop/chandra.env.example`. Restart Chandra Desktop after editing it.

### The window doesn't open

- **Windows 10:** install Microsoft's WebView2 runtime (`winget install --id Microsoft.EdgeWebView2Runtime -e`).
- **Linux:** the desktop opens in your browser by design; if no tab appears, the terminal prints the app's address.
- **Anywhere:** `chandra/desktop/.venv` must exist (setup's Phase 3 step 6). Only one Chandra Desktop runs at a time; a second launch hands over to the first.

### Mouse and keyboard control does nothing

- **macOS:** System Settings → Privacy & Security → allow the terminal (or Chandra) under both **Accessibility** and **Screen Recording**, then restart Chandra Desktop.
- **Linux:** control needs an X11 session; Wayland blocks synthetic input.
- **Everywhere:** if you pressed **Stop all**, actions stay halted until the next task. Throwing the mouse into a screen corner aborts by design.

## The Chandra Engine

**First move, always:** ask Chandra to run `chandra_status`, or run `"<engine python>" -I chandra/engine/chandra_engine.py --check` yourself (the engine's Python is the `python` line in `chandra/engine/engine.json`). Then `jarvis doctor`. Between them they name almost every problem below.

### Chandra says there are no engine tools

From the HOME folder, `claude mcp list` should show `chandra-engine ... Connected`. Missing means it was registered from a different folder (local scope is per folder): add it again from the home folder (the command is in setup's Phase 4). `Failed` means: run `--check` by hand; its error is the real one. The bridge must run on the engine's own Python, never the system `python3`.

If the typed chat sees the tools but the VOICE does not, the voice may not load per-folder servers. Register it at project scope too: from the home folder, `claude mcp add --scope project chandra-engine -- <same command>`, which writes `.mcp.json`; approve it once the next time Claude Code opens there.

### "No inference engine available"

The local model runtime (Ollama) is not running. macOS: open the Ollama app. Linux: `sudo systemctl start ollama` if it was installed as a service, otherwise `ollama serve`. Windows: start Ollama from the Start menu. Then `jarvis doctor`. No model yet? `jarvis model pull qwen3.5:2b` gets the small starter.

### "Memory backend unavailable" / the native extension is not built

The engine's search index needs its native (Rust) extension, which the installer compiles in the background after install. Right after setup it may still be building; `jarvis doctor` shows progress. On Windows it needs Microsoft's C++ build tools. Once built, the next launch indexes the vault on its own.

### The engine doesn't answer as Chandra

Chandra's persona lives in the engine's config as `agent.default_system_prompt`. `jarvis init --preset ... --force` rewrites the whole config and drops it; the next launch puts it back from `engine.json`. To change it, edit `persona` in `chandra/engine/engine.json` and relaunch (or run the bridge with `--sync`). A raw call (`chandra_ask` with `agent: "none"`) skips the persona by design.

### Search finds notes I deleted

Re-indexing replaces each note's entries but does not notice removed notes. To start fresh: `jarvis memory clear --yes`, then relaunch (or `--sync`).

### The engine is slow, or the fans spin up

That is the local model working on your own hardware; the starter model is small on purpose. `jarvis model list` shows what is installed and `jarvis model pull <name>` adds another. A heavier model is a trade for the person to choose.

## Home and updates

### Chandra has forgotten who it is

Chandra's identity lives in the `CLAUDE.md` in the HOME folder (the one containing all the piece folders), and Claude Code reads it only when it opens IN that folder. Opened inside a piece's folder, it boots that piece's instructions instead. Daily habit: the shortcuts, which open the home folder.

### I moved Chandra's home folder

Everything is wired with paths, so a move breaks the wires. Open Claude Code in the new location and say: "read chandra/chandra-setup.md and re-run the wiring phase." It touches only config paths: `engine/engine.json`, the `chandra-engine` registration (add it again from the new folder), the shortcuts, and the pieces' configs.

### Updates

`./chandra/update.sh` pulls every piece, updates the engine (`jarvis self-update --yes`), and refreshes the Chandra face. Your files (your CLAUDE.md, your vault, `engine.json`, `chandra.env`, the engine's `config.toml`) are never inside tracked files, so updates cannot touch them. If git complains about a config file you edited (`backtalk.json`, `ai-visualizer.json`), your edit wins. The toolbox itself is never pulled: it is Chandra's own build.
