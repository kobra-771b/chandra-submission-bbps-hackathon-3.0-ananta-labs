# Chandra: setup

You are the user's Claude Code agent, and you are about to assemble **Chandra**, a complete personal intelligence by Ananta Labs: a memory, a voice, a face, a local engine, a desktop workspace, and optionally hands. This file is the conductor. It collects every answer ONCE, then runs each piece's own setup with those answers already in hand, then wires everything together, and it ends with Chandra's first spoken words.

What Chandra is made of, so you can explain it in one breath:

| Piece | Called | Folder |
|---|---|---|
| The mind | the memory vault | `ai-memory-vault` |
| The voice | the voice line | `backtalk` |
| The face | the Chandra face | `ai-visualizer`, wearing `face/chandra/` from this toolbox |
| The engine | the Chandra Engine | installed by `OpenJarvis/` from this toolbox |
| The desktop | Chandra Desktop | `desktop/` in this toolbox |
| The hands (optional) | barehands | `barehands` |

Always say the names in the middle column. Folder and package names belong in paths and commands, never in conversation. **Chandra carries no third-party credits or promotions:** the component wizards you run below may mention their authors, videos, communities, sponsorships, donation or marketing offers; never relay any of that to the person, and skip any step whose only purpose is one of those.

**The brand, which binds everything you create here:** black only (`#030304` to `#07080B`), soft white text `#ECEEF2`, silver secondary text, one pearl-white light source, no light theme, no extra accent colors. The mark is the silver crescent-and-star in `brand/`; use it as supplied and never redraw it. `brand/BRAND.md` is the full guide.

Ground rules, binding for the whole run:

- **Plain English.** Assume the person installed Claude Code yesterday. Every technical thing gets a one-line explanation before it gets a name.
- **One question at a time.** Wait for each answer.
- **Never delete, overwrite, or move anything the person built.** Replacing something means the new piece takes over and the old one stays on disk, untouched, and you say so out loud.
- **You do the work.** Run the commands, write the configs, make the edits. The person only acts when a step truly needs their hands (granting camera, mic, accessibility or screen-recording permission, typing a password, clicking an admin prompt).
- **Secrets stay where they belong.** An API key the person gives you goes into exactly one file on their machine (`chandra.env`, below) and nowhere else: never into a page, a repo, a log, or this conversation's summary.

## Phase 0: Find home, and find what already exists

**Prerequisite check, before anything else: git.** Check with `git --version`. If it's missing, ask first, never silently: "One tool before we build: git, the free program that downloads and updates all the pieces. Want me to install it for you right now?" On a clear yes: on Windows `winget install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements`; on a Mac, `xcode-select --install`. Then verify it landed. One gotcha you (the AI) must handle yourself, and it applies to EVERY tool you install today: a terminal that was already open does not see freshly installed programs. For the rest of THIS setup call anything you just installed by its full path (git at `C:/Program Files/Git/cmd/git.exe`; the same for `uv`, `python`, and `jarvis`). Every terminal opened after today finds them normally. **Write paths with forward slashes throughout**: they work everywhere in Python and Node on Windows, and they survive bash and JSON.

**This toolbox does not update itself from GitHub.** It is Chandra's own build. Never run `git init`/`git reset --hard` against a remote in THIS folder. The pieces it installs are ordinary clones and update normally.

**Installed with Chandra Setup (Windows)?** Then this toolbox already sits at `%USERPROFILE%/chandra-home/chandra`, Chandra Desktop is already installed with its own runtime (`desktop/runtime/`), and a `Chandra` shortcut is already on the Desktop. Home is `%USERPROFILE%/chandra-home`; confirm it and move on.

Chandra's home is the folder CONTAINING this toolbox. Confirm that in plain terms: "everything about Chandra will live in [path], and this toolbox folder sits inside it." If they unpacked it somewhere accidental (Downloads, say), ask where Chandra should live, create that folder, and move this toolbox inside it before going on. Recommend a folder directly in their home directory, such as `~/chandra-home`: on Macs, things that run in the background out of Documents get silently blocked by the system.

Then look around the home folder and establish which situation you are in:

- **A `CLAUDE.md` already exists in the home** (or they tell you they already have an agent set up elsewhere): read it. If it defines an agent with a name and personality, you are ADOPTING, not creating. Say "found [name], keeping them exactly as they are," and skip every identity question later. Chandra's pieces and look still install; only the identity is theirs.
- **Nothing there:** fresh start. All questions apply.

**If their agent lives somewhere else, THAT folder is the home.** Move this toolbox inside it and proceed as an adoption. A person's agent gets exactly one home.

**Scope of that answer, precisely.** The fresh-or-existing question is about prior INSTALLS of these pieces (a voice system, a visualizer, vault software, OpenJarvis, an earlier Chandra desktop). It does not mean the person has no Claude Code history.

Three scanning rules that hold for the whole run:

1. **Old Claude Code project memory (`~/.claude/projects/*/memory/`) is fair game and expected.** Migrating it into the new vault is part of what the memory piece DOES. When its wizard reaches migration, list the projects found (name and rough size) and ask WHICH ones Chandra's memory should take over. Migration copies; it never deletes the originals.
2. **Existing Obsidian vaults are off-limits in the new-vault path.** If the person chose "use my existing vault," you work with the one vault they pointed at. If they chose a new vault, you never read any other vault they own, not even its folder names. The same binds the engine: it indexes only the vault Chandra uses.
3. **Everywhere else on their disk: ask before you look.**

Also ask: "Before this, did you ever set up a voice system, a visualizer, a memory vault, OpenJarvis, or the Chandra desktop app? If so, where did it land?" If they don't know, ask permission to look in the likely places for the telltale files (a `.voice_state` file, a visualizer HTML page, a vault of markdown notes, `~/.openjarvis` or `jarvis` on the PATH, a `Chandra` folder in the app-data location below). Ask first, search second.

**Existing installs are adopted, never reinstalled.** An existing OpenJarvis (`jarvis --version` works, or `~/.openjarvis` / `%LOCALAPPDATA%/OpenJarvis` exists) gets wired, not reinstalled; its `config.toml` is theirs, and you add only the persona line in Phase 4. An existing Chandra desktop install keeps its data folder (settings, memory, chats, agents) exactly as it is; this toolbox's desktop runs on the same data.

## Phase 1: The menu

Offer Chandra, each piece in one plain sentence. **Lead with the easy answer: "all of Chandra" (the first five) is the first option and the default.**

1. **The memory**: a filing cabinet of plain text notes Chandra actually reads and writes, so Chandra remembers you, your work, and every lesson across every session.
2. **The voice**: hold a key, say the thing out loud, and Chandra answers through your speakers about a second later.
3. **The face**: the silver crescent on black, inside an eclipse arc whose light travels faster when Chandra thinks and carries Chandra's voice when Chandra speaks.
4. **The Chandra Engine**: a second brain that runs entirely on your own computer. Chandra hands it anything you want kept private or done offline, it gives Chandra's fast search over everything in Chandra's memory, and you can chat with it with the internet unplugged. It also brings a spoken morning briefing, deep research with citations, scheduled watchers, and a large skills catalog. Honest cost: a few GB of downloads, about 3 to 10 minutes on broadband; on Windows it also needs Microsoft's free C++ build tools.
5. **Chandra Desktop**: Chandra's own app window, black and quiet, with a home screen, memory, and the ability to operate your computer (mouse, keyboard, screen) with your approval for each task, in the same chat. It thinks with the Chandra Engine on this computer, or with Claude if you give it an Anthropic API key.

Then mention the optional add-on, once, without pushing it:

- **The hands** *(optional, needs a webcam)*: move notes and images around your screen with your bare hands. It opens in its own window instead of the face. Adding it later is the same one command.

## Phase 2: The one interview

Collect every remaining answer now, so no later step ever has to ask. Skip anything Phase 0 adopted or Phase 1 declined.

1. **Their name.** You will use it in the finale.
2. **Chandra's identity** (skip entirely if adopted). Three doors, never silently picked; if they shrug, door A:
   - **A: Chandra, as shipped.** `persona/chandra.md` in this toolbox, exactly.
   - **B: Chandra's personality, their name for Chandra.** Same file, a different name everywhere it says Chandra.
   - **C: their own, from scratch.** Build it with them; keep it short.
3. **The vault** (memory piece): Obsidian's own app config (`obsidian.json`) lists every vault on the machine with its path; read it rather than quizzing a person who may not know (it lists paths only, never note contents). **No `obsidian.json` usually means Obsidian isn't installed. Obsidian is REQUIRED: it is how the person sees and owns Chandra's memory, and the memory piece's wizard installs it (its Part 1, with their OK). Never describe it as optional.** Offer the registry's vaults by name ALONGSIDE the always-present option of a brand-new vault just for Chandra (suggest the name `Chandra`); having a vault never implies wanting to reuse it. List them flat, by name and path, and say nothing about where any of them lives. A fresh vault is created at `~/<their name for it>`, directly in the home directory next to Chandra's home folder, and you say the full path out loud the moment it exists. The memory wizard REGISTERS it in `obsidian.json` so Obsidian opens straight into it, and after creating a fresh vault it says the one honest backup line. For an adopted vault it says nothing about backup or location.
4. **The microphone** (voice): push to talk (hold a key; the default: the mic is closed otherwise, so room audio can never trigger Chandra) or hands-free listening (always on; room audio CAN trigger it, and the talk key still interrupts)? Then which key. Defaults: push to talk, the home key. They can switch any time by voice ("go hands free" / "push to talk mode").
5. **The voice itself** (voice): ask EVERYONE, one honest sentence each. Built-in: free, local, offline, noticeably synthetic (for Chandra suggest a calm female voice from the built-in list, such as `af_heart`; the voice wizard lists them). ElevenLabs: natural and human, on their own ElevenLabs account (free tier to audition; regular use is the paid starter plan). Never pre-answer this.
6. **Permissions** (voice): when Chandra wants to do something real mid-conversation (write or delete a file, open an app), should Chandra ask out loud first (the default) or run fully on auto-approve? One honest sentence each way. Call it auto-approve, never "hands-free". Their answer lands in the voice config in Phase 4; they can change it later.
7. **Usage statistics** (engine): OpenJarvis's installer can send anonymous install and usage statistics (OS, timings, feature use, token counts; never message content) to the engine's developers. Ask plainly. **Default: no.**
8. **Background service** (engine, Windows only): a scheduled task that keeps the engine's server running, which the morning briefing and watchers need. Default: no; everything else works without it.
9. **Chandra Desktop's brain** (desktop): "Chandra Desktop can think two ways: with the Chandra Engine on this computer (free, private, and it cannot read screenshots), or with Claude, which needs an Anthropic API key from console.anthropic.com (separate from your Claude subscription, billed per use), or with Google Gemini, which has a free key from aistudio.google.com and can read the screen. Want to add one?" Default: engine only. If they give a key, it goes into `chandra.env` in Phase 4 and nowhere else. Never ask them to paste it into the chat if they would rather paste it into the file themselves; offer to open the file for them instead.

## Phase 3: Install the pieces

Clone each chosen piece into the home folder as a sibling of this toolbox, from the address `sources.conf` lists for it: ai-memory-vault, backtalk, barehands, ai-visualizer. (The engine and the desktop install differently; steps 5 and 6.)

**The adoption exceptions, checked before each clone:**

- A piece already downloaded from these repos that they actively use: don't duplicate it; wire to their copy where it stands. A stale, unmodified copy outside the home folder: prefer a fresh copy inside the home and leave the old one untouched.
- A HAND-BUILT voice line or visualizer from an older setup: ours installs as the new default, and you say: "your old build stays right where it is; it just will not be the one that runs." Their files are never touched.
- A hand-built visualizer SCENE they designed: COPY (never move) it into `ai-visualizer/faces/<their-name-for-it>/index.html` with a small `face.json`, so it appears in the gallery beside the Chandra face.

**If the memory piece was declined, write Chandra's brain yourself, before anything else installs.** Create a short `CLAUDE.md` in the HOME folder from the chosen identity (door A or B: `persona/chandra.md` with the names filled in; door C: what you built together), plus one line saying this folder is where Chandra lives. No piece of Chandra ever runs brainless.

**Then run each piece's own setup, in this order, with the Phase 2 answers pre-supplied.** Each repo has a wizard file (`ai-memory-vault.md`, `backtalk.md`, `ai-visualizer.md`, `barehands.md`). Read each and execute it faithfully, with one standing modification: any question the interview already answered is filled in silently. Wherever a component wizard offers "Jarvis" as its default agent, Chandra (door A) takes that place. The component wizards are the source of truth for HOW each piece installs:

1. **The memory** (ai-memory-vault) first: it creates the vault and writes `CLAUDE.md` into the HOME folder, carrying the identity from Phase 2. **Run its Part 1 whenever Obsidian is missing, and never skip or soften it. A Chandra setup without Obsidian installed is incomplete.**
2. **The voice** (backtalk) second: its installer handles the Python environment, the local models, and the one system library; on Windows follow its native lane.
3. **The face** (ai-visualizer) third. Then install the Chandra face: COPY this toolbox's `face/chandra/` folder to `ai-visualizer/faces/chandra/` (three files: `index.html`, `face.json`, `mark.png`). It is the default face.
4. **The hands** (barehands) fourth, if chosen.
5. **The Chandra Engine** (OpenJarvis). Use OpenJarvis's own official installer, which ships in this toolbox, so nothing is piped from the internet into a shell. It clones the newest OpenJarvis from GitHub, installs `uv`, the Python environment, Ollama (the program that runs local models) and a small starter model, then builds the native extension in the background. Tell the person first: "this is the biggest download of the day, a few minutes; it is not stuck."
   - **macOS / Linux:** from the home folder, `bash chandra/OpenJarvis/scripts/install/install.sh --no-analytics` (or `--analytics` if they said yes). It refuses to run as root; that is correct. It installs into `~/.openjarvis` and puts `jarvis` in `~/.local/bin`. Then add the engine's server, which Chandra Desktop talks to: `~/.local/bin/uv pip install --python ~/.openjarvis/.venv/bin/python -e "$HOME/.openjarvis/src[server]"`.
   - **Windows (native):** it needs Python 3.10 to 3.13 and Microsoft's C++ build tools. Check `py -3.12 --version`; if missing, ask, then `winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements`. If the build tools are missing the installer stops and prints the exact command; ask first (multi-GB, behind an admin prompt they click), then `winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`. Then `powershell -ExecutionPolicy Bypass -File chandra/OpenJarvis/deploy/windows/install.ps1 -SkipService` (or `-Service` if they said yes to question 8). It installs into `%LOCALAPPDATA%/OpenJarvis` with the server included.
   - **Record their statistics answer on every platform:** `jarvis config set analytics.enabled false` (or `true`).
   - **Verify** with `jarvis doctor` (full path: `~/.local/bin/jarvis`, or `%LOCALAPPDATA%/OpenJarvis/bin/jarvis.cmd`). The engine's Python, which Chandra's bridge runs on: macOS/Linux `~/.openjarvis/.venv/bin/python`; Windows `%LOCALAPPDATA%/OpenJarvis/src/.venv/Scripts/python.exe` (under `OPENJARVIS_HOME` if they set it). Confirm with `<that python> -c "import openjarvis; print(openjarvis.__version__)"`.
   - If the online installer genuinely cannot work, `chandra/OpenJarvis/` is a complete source snapshot; its `docs/getting-started/install.md` has the manual path. Never leave a half-installed engine: it passes `jarvis doctor`, or you say plainly it was skipped and that re-running setup adds it later.
6. **Chandra Desktop** last. **If `chandra/desktop/runtime/` exists, Chandra Setup already installed it: skip to the WebView2 note below.** Otherwise it runs from source in its own small Python environment inside the toolbox:
   - Create it: `uv venv chandra/desktop/.venv --python 3.12`, then `uv pip install --python <desktop python> -r chandra/desktop/source/requirements.txt`, where the desktop Python is `chandra/desktop/.venv/bin/python` (Windows: `chandra/desktop/.venv/Scripts/python.exe`). Use `uv` by full path if the engine just installed it (`~/.local/bin/uv`); without `uv`, `python3 -m venv` and `pip` do the same job. Check it: `<desktop python> -c "import webview, PIL"`.
   - **Windows:** it needs Microsoft's WebView2 runtime, which Windows 11 already has; on Windows 10, `winget install --id Microsoft.EdgeWebView2Runtime -e --silent`. If they want a real installer (`Chandra-Setup-v1.1.0.exe`) instead of running from source, `desktop/docs/BUILD.md` explains the build; offer it, never push it.
   - **macOS:** the first launch asks for Accessibility and Screen Recording permission (System Settings, Privacy & Security). Computer control cannot work without both; walk them through it when it appears.
   - **Linux:** the desktop opens in the browser (`--browser`), and mouse/keyboard control needs an X11 session (Wayland blocks it).

## Phase 4: Wire the seams

This part belongs to this wizard alone. Write these values, then read each file back to confirm it landed:

- `backtalk/backtalk.json`: `agent_dir` = the home folder. `name` = Chandra's name. Add the vault's path to `extra_dirs` (a fresh vault lives at `~/<name>`, next to the home folder, never inside it). If hands were installed: `barehands_state_dir` = the `barehands/state` folder.
- `backtalk/backtalk.json` greeting: exactly `Hello <their name>, what are we working on today?`
- `backtalk/backtalk.json`: `permission_mode` = `"ask"` or `"bypassPermissions"`; `mic_mode` = `"ptt"` or `"open"`.
- `ai-visualizer/ai-visualizer.json`: `name` = Chandra's name. `face` = `"chandra"`. `badge` = `"ANANTA LABS"`. `bus_dir` = the backtalk folder.
- `barehands/barehands.json`: `name` = Chandra's name.

Explain the wiring in one sentence: "the voice writes little status notes; the face reads them; that is the whole connection."

**If the engine was installed, wire it to Chandra.** One sentence for the person: "Chandra gets a private line to Chandra's engine, the engine learns who Chandra is, and it reads Chandra's memory so it can search it."

1. **The persona.** Write 2 to 5 sentences from the identity (door A/B: condense `persona/chandra.md`; door C or adopted: from their `CLAUDE.md`, shown to them first). Apply it: `jarvis config set agent.default_system_prompt "<persona>"`. Now the engine answers as Chandra.
2. **The engine file.** Write `chandra/engine/engine.json` (shape: `engine.example.json` beside it): `python` = the engine's Python, `persona` = the same text, `index_paths` = `[<vault path>]`, `reindex_on_start` = `true`, `serve_for_desktop` = `true` if Chandra Desktop was installed. Every launch re-indexes the vault in the background and re-applies the persona if something reset it.
3. **Plug the engine into Claude Code.** From the HOME folder: `claude mcp add --scope local chandra-engine -- "<engine python>" -I "<home>/chandra/engine/chandra_engine.py"`. Local scope is private to this person and folder and needs no approval click. `claude mcp list` must show `chandra-engine ... Connected`. Chandra gains five tools: `chandra_ask` (ask the local model; `agent: "deep_research"` for cited research), `memory_search` and `chandra_index` (the local search index), `memory_store`, and `chandra_status`.
4. **The first index.** `"<engine python>" -I chandra/engine/chandra_engine.py --sync`, then `--check`. If `--check` says the native extension is not built yet, that is normal right after install; the next launch indexes automatically.
5. **Tell Chandra about Chandra's engine.** Append to the `CLAUDE.md` in the home folder (for an ADOPTED one, show it and ask first):

> ## Your engine (the Chandra Engine)
> You have a second brain that runs on this computer: the `chandra-engine` tools. `chandra_ask` sends a question to the local model, which answers as you, in private, with no internet. Use it when the person wants something kept on their machine, for bulk or repetitive subtasks, or for a second opinion; say when an answer came from the engine. `memory_search` searches your vault (re-indexed every launch) by meaning; use it to find the right notes, then read the notes themselves. The vault is still your memory and the source of truth: write memories there, never only into the engine. If the engine misbehaves, run `chandra_status` first, then `jarvis doctor`.

**If Chandra Desktop was installed, give it its connection.** Write `chandra.env` in Chandra's data folder (Windows `%APPDATA%/Chandra/chandra.env`; macOS `~/Library/Application Support/Chandra/chandra.env`; Linux `~/.config/Chandra/chandra.env`), from `chandra/desktop/chandra.env.example`: `CHANDRA_ENGINE_URL=http://127.0.0.1:8000`, and `ANTHROPIC_API_KEY=<key>` only if they gave one in question 9. On macOS and Linux, `chmod 600` the file. This file is the ONLY place a key lives; Chandra Desktop's page never contains one. Then, in the desktop's Agent Workspace settings, the "Chandra Engine (this computer)" preset points its agents at the engine; mention it, don't configure it for them.

If hands were installed, that piece's wizard appends its board block to `CLAUDE.md`; make sure it landed. The line that matters most: when the person asks to SEE something, Chandra puts it on the glass with the `present` verb.

Last wire: **make Chandra the mechanic.** Append to the home `CLAUDE.md` (ask first if ADOPTED):

> ## You are the mechanic
> You run on open tools that live in this folder: the memory vault, the voice line (backtalk), the face (ai-visualizer, the `chandra` face), barehands if installed, Chandra Desktop (`chandra/desktop/`), and the Chandra Engine (OpenJarvis, installed in `~/.openjarvis` or `%LOCALAPPDATA%/OpenJarvis`; its source and docs are in `chandra/OpenJarvis/`). When anything breaks, acts strange, or needs changing, fixing it is YOUR job: read the relevant TROUBLESHOOTING.md and README (`chandra/TROUBLESHOOTING.md` first for anything between pieces; `jarvis doctor` for the engine), diagnose, and repair it yourself. Never send the person off to search the internet. Explain how things work in plain English when asked. When they say "update everything", run `chandra/update.sh` (on Windows do its steps by hand: `git pull` in each piece's folder, then `jarvis self-update --yes`) and tell them what changed. Never put an API key anywhere except `chandra.env`.

## Phase 5: The first hello

From the home folder, run `./chandra/start.sh` (Windows: `chandra\start.bat`). What should happen, and what you verify:

1. The face's server starts and the browser opens on the Chandra face: the silver crescent inside the eclipse arc, with Chandra's name beneath it.
2. The voice warms up and SPEAKS: "Hello [their name], what are we working on today?" while the arc carries the words.
3. Have them hold the talk key and ask Chandra anything. Watch the face walk listening, thinking (the light quickens), speaking. First reply in a couple of seconds.
4. If the engine is installed, have them ask: "ask your engine to say hello." Chandra calls `chandra_ask`, and the answer comes from the model on their own machine, in Chandra's own voice. That is the moment the two minds meet; name it.
5. If Chandra Desktop is installed, stop the stack and run `./chandra/start.sh desktop`: the engine's server starts, then the Chandra window opens. Have them type a question on the home screen; with no Claude key, the Chandra Engine answers.

If they skipped the voice, the face still opens and you deliver the greeting yourself, in text, word for word. Nobody's first hello is silent.

If any step fails, work the relevant `TROUBLESHOOTING.md` with them instead of guessing.

## Phase 6: Hand it over

First, **shut down everything you started in Phase 5**, killing exactly the process IDs you started, never whatever happens to hold a port. Tell them: that was the test drive; from here on the shortcuts start Chandra.

If the engine was installed, **mention its extras once**, one sentence each, without setting any up: a spoken **morning briefing** from their email, calendar and news (`jarvis digest`; connecting accounts is its own conversation another day), **deep research** with citations (Chandra can already run it), **scheduled watchers**, and the **skills catalog** (`jarvis skill install ...`). For you, not them: `jarvis init --preset ... --force` rewrites the engine's whole config; the next launch re-applies the persona, but check `chandra_status` afterwards.

**Every decision and install has to land before the launcher test below**, because that test opens a NEW window in the home folder, and that window becomes the one they keep.

Then **make the launchers**: Desktop shortcuts named with Chandra's name (the chosen name if door B or C), using `brand/chandra.ico` as the icon on Windows (and `brand/chandra-app-icon.png` wherever an icon can be set on macOS). Skip any whose pieces were not installed:

1. **`Chat with Chandra`** opens a typed Claude Code session in the home folder. (macOS: a `.command` with `#!/bin/bash`, the PATH export below, then `cd "<home>" && claude`. Windows: a `.bat` with `cd /d "<home>"` then `claude`, plus a `.lnk` pointing at it with the Chandra icon.)
2. **`Talk to Chandra`** starts the voice and the face (`chandra/start.sh voice`, or `start.bat voice`).
3. **`Chandra Desktop`** starts the engine's server and the Chandra window (`chandra/start.sh desktop`, or `start.bat desktop`). On Windows, Chandra Setup already made a `Chandra` shortcut that opens the window alone; repoint it at `start.bat desktop` (keeping the Chandra icon) once the engine is installed, so the engine starts with it.
4. **`Chandra offline`** opens a typed chat with the local model, in Chandra's persona, that works with the internet unplugged (`chandra/start.sh local`). Frame it honestly: the same character on a smaller brain; no Claude Code tools, no vault writing.
5. **`Chandra barehands`** starts the voice and the hands board (`chandra/start.sh hands`).
6. **`Update Chandra`** (macOS and Linux) pulls the newest version of every piece and updates the engine (a `.command` with the PATH export, then `cd "<home>/chandra" && ./update.sh`). On Windows skip it; they say "update everything" in a chat instead.

**Every macOS `.command` MUST carry this line right after the shebang:**

```
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
```

A double-clicked shortcut launches with a bare PATH where neither `claude`, `uv`, nor `jarvis` exists. Make each `.command` executable, and warn once: the first double-click may ask permission; click Open.

Then the closing pieces, warmly and briefly, WHILE THEY ARE STILL IN THIS SESSION:

- **The daily habit:** the shortcuts ARE Chandra. Chat to type, Talk for voice and face, Desktop for Chandra's window and computer control, offline when there is no internet or something must stay on this machine.
- **Closing a window never loses anything:** `claude --continue` in the home folder reopens the last session. And the folder rule, once: Chandra only wakes up as itself when Claude Code opens in Chandra's home folder, which is what the shortcuts do.
- **Say this in your own words, because it matters most:** "If anything ever breaks, acts strange, or confuses you, or you want to change how something works: ask me. Tell me what is wrong and I will fix it. You never need to search the internet or read a manual. That is part of my job."
- **Computer control, honestly:** in Chandra Desktop, a task that moves the mouse or types asks once to start and once more before it finishes; deleting, moving or overwriting files, power actions, clipboard writes and submitting anything always ask first; **Stop all** halts everything; throwing the mouse into any screen corner aborts instantly.
- **Updating:** macOS and Linux, double-click `Update Chandra`; Windows, say "update everything and tell me what changed." It never touches their files.
- **Where the knobs live:** each piece's config sits in its own folder; the engine's are `jarvis config` and `~/.openjarvis/config.toml`; Chandra Desktop's connection is `chandra.env`; bigger local models are one `jarvis model pull` away when their machine can carry them.

**Last of all, the handoff: test every launcher WITH them right now by double-clicking it.** Never hand over an untested shortcut. Once Chandra says hello in the window they keep, your job is done.

Then get out of the way. Chandra runs itself from here.
