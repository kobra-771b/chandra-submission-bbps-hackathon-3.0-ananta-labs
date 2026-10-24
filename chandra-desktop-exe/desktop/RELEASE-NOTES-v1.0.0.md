# Chandra 1.0

The first release of Chandra as one product: the interface of the 1.4 line, the engine of the Setup_1 line, and everything built on top of both. Version numbers start again at 1.0.0; the notes of the internal builds before it (1.1 to 1.7) are in `history/`.

## Talk to it

- **Voice first.** Tap the moon to start a conversation, hold it or hold **Space** to talk, **Ctrl+Space** to toggle. Chandra listens again after it answers, until you are done; talk over it to interrupt. Captions show what you said and what Chandra says, the spoken sentence lit up.
- **Nebula, the new voice orb.** The child of the Sky Cloud and Pulsar designs: a soft cloud sphere inside a turning shell of light points. Each latitude of the shell follows one band of the sound, bass at the equator and highs toward the poles, so speech ripples across it; the crown warms to star-white while Chandra speaks. It replaces the earlier blob as both the large orb that takes the moon's place and the small light beside the composer.
- **Listening for itself.** With a free Gemini key, Chandra records the microphone, finds where you start and stop, and has Gemini transcribe **English, Hindi and Hinglish**, even mixed in one sentence. Without a key, the browser's recogniser is used.
- **A natural voice.** Gemini's neural voices (Sulafat by default) with a gentle Indian English accent or natural Hindi, sentence by sentence; otherwise the best natural voice on the computer. Nothing written for the eye is read aloud (markdown, links, code, emoji), and spoken questions get short spoken answers in the language you used.
- **Hindi.** An EN / हि / Mix switch on Home, Hindi voices for Hindi text, and Hindi words for stopping ("बस", "धन्यवाद").

## A calm window

- **The aurora.** A silky sky of soft colour fields and slow curtains in Chandra's blues, the planet's rim of light below, fine stars and grain. It quickens while Chandra thinks, cools while it listens and warms while it speaks.
- **One calm column** on Home: the greeting, Screen sense as one line, the moon, the reply, the composer and a few things to try saying. No side columns, no pets, a short rail.
- **Chandra's theme.** The music toggle now plays Chandra's own theme.

## It works on your computer

- **Computer control built into the window.** Screen, mouse, keyboard and Screen sense go through the window itself: no bridge to connect, no pairing code, no screen frame over HTTP, and nothing on the network can act while the window is open. Screen sense starts by itself with no share prompt.
- **Two taps for a task.** Allow a task once to start it, accept the result before it finishes; deleting, moving or writing files, power, clipboard writes, shell commands, extra tool servers and anything that sends or pays ask every time.
- **The brain.** Claude when it has a key, then Gemini (free, with screen vision), then the local Chandra Engine. Recall by meaning, everyday skills (weather, Wikipedia, dictionary, currency, units), artifacts with versions, Playbooks, memory and `.ananta` files, MCP tool servers, diagnostics with a redacted error log.
- **Your name.** Chandra calls you Sanjay until you give your name.

## Install

`Chandra-Setup-v1.0.0.exe`: one per-user installer for 64-bit Windows 10 and 11, no administrator rights, Chandra's own Python included. Run it again for Update / Repair or Uninstall; your data folder (`%APPDATA%\Chandra`) is kept.

Credits: React Bits by David Haz (Strands, Gradient ASCII, Grainient, Target Cursor; MIT with Commons Clause, used as part of Chandra), SF Pro, the LZMA SDK. See `THIRD-PARTY-NOTICES.md`.
