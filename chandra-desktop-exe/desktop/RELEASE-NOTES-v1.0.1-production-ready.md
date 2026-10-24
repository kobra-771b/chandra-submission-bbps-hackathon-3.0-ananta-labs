# Chandra 1.0.1: the microphone works

Built on 1.0.0 production-ready. Everything else is unchanged, keys included.

- **The "Chandra" wake word hears you.** Chandra's window (Microsoft WebView2) has no speech service, so the browser recogniser the wake word used never heard anything: it failed with "network" and was restarted every 300 ms. In the window it now uses Windows' own offline recogniser, with a grammar that knows how "Chandra" (and "Hey Chandra …") sounds, beside free dictation. Listening without a Gemini key uses it too. With a Gemini key, conversations still go through Gemini, as before.
- **The microphone no longer waits on a hidden prompt.** WebView2 asked for the microphone itself and remembered the answer per port, so a restart on another port asked again, a dismissed prompt counted towards blocking the mic for good, and the frameless window had no way to undo a Block. Chandra's own page now gets the microphone directly; other permissions and other pages are unchanged.
- **Plain reasons when Windows blocks the microphone.** If Settings > Privacy & security > Microphone (or "Let desktop apps access your microphone") is off, Chandra says which switch it is and opens that Settings page once. A missing or busy microphone says so too.
- After errors, listening waits longer before trying again (up to 15 s), so a missing microphone can't spin.

Notes: Windows' recogniser is offline and English-only on most PCs; it hears the wake word in any language, but dictation without a Gemini key is English. Chandra 1.0.1 for Android is the same fix on Android's recogniser.
