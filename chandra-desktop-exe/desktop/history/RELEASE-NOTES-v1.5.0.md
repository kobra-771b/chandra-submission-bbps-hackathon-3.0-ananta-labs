# Chandra Desktop v1.5.0: one Chandra

Two lines of Chandra grew apart after 1.1.0. One kept the look moving: artifacts, Starlight, the new home, the buddy and Chandra's own setup (1.2 to 1.4). The other kept the work getting better: Gemini, diagnostics, everyday skills, two-tap task approvals, steadier computer work. 1.5 is both, with the 1.4 look and the stronger engine underneath.

## A better voice

- **Chandra's natural voice.** With a free Gemini key, Chandra speaks in a Gemini neural voice (default **Sulafat**, "warm"; thirty to choose from in Settings > Chandra voice). Long replies go sentence by sentence: the next part is fetched while this one plays, so speech starts quickly, and a repeated line answers at once from memory. It plays through Web Audio, so the speaking light now follows the real sound instead of guessing from word events. Barge-in and Stop speaking work as before.
- **A better voice without a key.** Chandra picks the best voice already on the computer: natural and neural voices first (Windows 11 and Edge "Online (Natural)", Google, macOS premium), then a clear female voice in your language. Broken entries some WebView builds report ("Microsoft undefined …") are skipped. Natural voices are starred in the list.
- **Natural defaults.** Speed 1 and pitch 1 replace the old deep, fast default (0.85 / 1.15), which made every voice sound strained; the language defaults to English (India). Settings you changed yourself are kept.
- **It never goes quiet.** If the natural voice fails (no internet, Gemini's free quota used up), Chandra finishes the sentence in the computer's voice, pauses the natural voice for a few minutes, and Settings says why.

## Utility, brought in from the Setup_1 line

- **Free screen vision with Gemini.** Settings > AI brain takes a Gemini key (free at aistudio.google.com) beside an optional Claude key. Order: Claude, then Gemini, then the local Chandra Engine (text only). `CHANDRA_BRAIN=auto|claude|gemini|engine`. Keys are written to `chandra.env` by the host; the window never keeps them.
- **Recall by meaning.** With a Gemini key, "what did I say about the trip?" finds "planning a trip to Japan". Each memory is embedded once (now `gemini-embedding-001`; Google retired `text-embedding-004`) and cached in Chandra's data folder. Without a key, recall ranks by word overlap, which beats the old substring search.
- **Everyday skills.** Weather (Open-Meteo), Wikipedia, an English dictionary, live currency rates and unit conversion: free, no key, read-only, no approval prompt. What they return is treated as data.
- **Two taps for a task.** The first step that needs a real action asks "Start this task?"; Allow task covers the ordinary steps inside it. Before the task finishes, Chandra shows the result and waits for Accept result (or Hold back). Steps that ask every time, even inside an approved task: deleting, moving or writing files, power, clipboard writes, shell commands, MCP tool servers, and a new **submit checkpoint** Chandra must call before it sends, submits, posts, pays or confirms anything. Typing, clicking, opening apps and looking at the screen still run on the permissions in Settings, as in 1.4. In a voice chat, Chandra says the approval out loud; approving is still a tap, never a voice.
- **Steadier computer work.** A read-only step, or one that never started because the connection dropped, is retried once. The same failing step is not repeated more than three times, and eight failed steps end the run with the last error.
- **Long conversations keep their thread.** Older turns become a short digest of what you asked and what Chandra answered.
- **Diagnostics.** Settings > Diagnostics > Check Chandra shows what works on this computer (data folder, keys present or not, the engine, screen control, internet, tools, MCP, speech in and out, the natural voice). Show error log prints recent problems with keys, tokens and passwords removed. Page errors are logged there too, and a bug in one request now answers with an error instead of dropping the connection.
- **Safer file tools.** Chandra's data folder and key file are off limits, through symlinks and parent folders too; a move or delete that would take Chandra's folders or your whole home folder along is refused; a move never overwrites; Undo leaves a file alone if you changed it since. MCP tool servers no longer receive the Claude or Gemini key, and Stop all blocks their calls too.

## Also new

- **Playbooks get the page Automations had.** The Automations page showed sample entries ("Morning briefing · Last run today") that nothing ever ran. It is gone; Playbooks, the real multi-step task chains, take its place (key **5**).
- **Anmol** is the name Chandra uses until you give yours, or if you leave it blank (it was "there", and a hard-coded "Arjun" before that).
- Gemini chat falls back to `gemini-flash-latest` if the configured model is retired. Chandra serves its own icon to the window, so the page no longer logs a failed favicon request.
- The bundled Python runtime carries Pillow 13.

Unchanged: the 1.4 home, Starlight and Classic, artifacts and their versions, the speaking light and the buddy, screen sense, the pairing code and loopback binding, the corner failsafe, Stop all, memory and `.ananta` files, timers and MCP tools.

**One setup file.** `Chandra-Setup-v1.5.0.exe` (64-bit Windows, per-user, no administrator rights) is Chandra's own setup from 1.4 with the 1.5 payload. Run it over 1.4 and choose **Update**; your data folder is kept.
