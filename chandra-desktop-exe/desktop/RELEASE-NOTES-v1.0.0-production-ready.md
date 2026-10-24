# Chandra 1.0.0: production-ready

One setup that brings together the best of two lines of Chandra.

**The interface** (from the colour-choice build): Modern and Legacy styles with six colours each, picked in onboarding with logo previews and changeable in Settings at any time; the Nebula voice orb and the aurora sky; Markdown and LaTeX in replies; a location pill with automatic detection and a city you can set by hand; Diagnostics in place of Activity (health score, system, brain, voice, live connection times, errors, start log, copy report); Playbooks, artifacts and memory.

**The utilities** (from the NSIS 1.0.6 line): risk-checked actions, where Chandra asks the host to assess each action instead of fixed permission switches; pinned and redirect-safe web requests; web research; folder organising with undo; archive and extract; duplicate finder; file search and file info; downloads; the active-window and computer profile tools; a portable mode (`portable.txt` beside the launcher keeps data in `data\`); stronger launchers that work from any folder; client timeouts; and its security fixes and tests.

**Installer:** `Chandra v1.0.0-production-ready.exe` is a personal, per-user setup for 64-bit Windows 10 and 11 with the API keys carried inside, so it asks for nothing. Anyone holding the file can read those keys; it is for showing Chandra on your own computers.

Notes: the voice is the other line's calm male voice (Charon). Permission switches are gone, replaced by the risk check. Not tested on a real Windows PC; see COMPATIBILITY.txt.

## Final round

- **Pasting API keys works.** Screen sense used to grab the first key press or click in a browser window and open the screen-share picker, which swallowed Ctrl+V. It no longer reacts to keys or to anything in a text field. Every key box in Options also has a **Paste** button (and Ctrl+V) that reads the clipboard through Chandra's host.
- **The doubled cursor is gone.** The custom target cursor is now off by default (Options > Target cursor turns it on), so only the system cursor shows.
- **Options** replaces "Settings" everywhere you see it.
- **Language dropdown** replaces the EN / हि / Mix pills: Auto (match my language), Hinglish, and 120 languages. Pick one and Chandra answers in it every time, translating when you speak another; listening and speaking follow it.
- **Ambient music** is a little louder (volume 0.15 to 0.20).
- **A fresh start, once.** The first run clears chats, recents, activity, the daily moon, the night sky and the unfinished task, and the error and start logs can be cleared any time in Options > Privacy > Clear all history. Name, look, keys and settings are kept.
- The moon ring never shows empty if the voice orb cannot draw.

## Closing randomly, and the dot

- **Chandra restarts itself after a crash.** On Windows a small parent now watches the program. If it dies the way a crash does (an access violation or a fatal error), it starts again, up to a few times, and writes the exit code to the start log. A normal close, End task or a newer copy taking over do not restart it. A crash's Python stack is kept in `chandra-crash.log` and shown in Diagnostics, so the real cause can be found if it keeps happening.
- **A rebuilt setup now replaces the running copy even with the same version number.** Before, launching a new build of 1.0.0 just showed the old copy that was still running.
- **The round status light with the dot in the top-left is removed.**

## Licence agreement, publisher

- **Setup shows the Chandra licence agreement** before anything is installed: scrollable, with an "I have read and accept" box that must be ticked to enable Install, or Decline. The same text is installed as `EULA.txt`. Silent installs must pass `/ACCEPTEULA`, otherwise Setup stops with exit code 2.
- **Publisher is Ananta Labs** in Apps & features, in the setup file's properties, and in the launcher.
- **The left rail no longer overlaps the buttons beneath it** in short windows.

## Voice and keys (midnight fix)

- **"Couldn't hear that" fixed.** Google's speech model was answering "503: high demand", and Chandra gave up on the first answer. Listening and speaking now move on to the next model when one is busy (and listening tries the whole list twice), the fastest working models come first (about 1.3 s), and the page retries once quietly before it ever shows an error. Chat does the same.
- **Keys are preloaded and cannot be stale.** A setup that carries keys now replaces any key already stored, so an old or wrong key from an earlier install can no longer leave Chandra without a working brain. Nothing to paste.

## "401 invalid x-api-key"

- A key preloaded by Setup now **beats an old `ANTHROPIC_API_KEY` in this computer's environment** (a leftover from other tools had been overriding it).
- If Claude refuses a key or is overloaded, Chandra now **answers with Gemini** instead of failing, and notes it in the error log.

## Faster hands, its own letter casing, no always-on

- **Keyboard and mouse are much faster.** On Windows Chandra now places the pointer, clicks, drags and scrolls with single direct calls (no animated glide, no built-in 0.12 s wait after every step), types a whole text in one go, and waits 0.12 s instead of 0.35 s before checking the screen changed.
- **Chandra picks its own letter casing.** Text is typed as the exact characters, not as key presses, so Caps Lock, Shift or the keyboard layout can no longer invert or change it. Where direct input is not available it compensates for Caps Lock itself.
- **Chandra always-on is removed** to free the microphone, speech service and processor for real work. Chandra no longer starts with Windows, runs hidden, or listens in the background; it listens only when you talk to it. A start-up entry left by an earlier build is deleted on first launch. The licence no longer has an always-on section, and Setup's agreement page is simpler.
