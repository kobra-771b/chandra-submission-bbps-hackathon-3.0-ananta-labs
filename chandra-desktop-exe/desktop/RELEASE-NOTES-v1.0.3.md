# Chandra 1.0.3: keys from Setup, faster Gemini

- **Keys from Setup.** A personal Chandra Setup can carry your Claude and Gemini keys. On first launch Chandra moves them into its data folder (`%APPDATA%\Chandra\chandra.env`), the one place keys live, and removes the copy beside the app. Settings > AI brain says the Claude key came from Chandra Setup. A key you set in Settings is never overwritten by Update or Repair. Anyone holding a personal setup can read its keys, so keep it to your own computers; the ordinary setup carries no keys.
- **Gemini 3.5 Flash.** Google has retired Gemini 2.5 Flash for new keys, so Gemini answers fell back to a slow model, about 20 seconds a reply. Chandra now thinks with Gemini 3.5 Flash (about a second, with tools and screen vision). If a model is retired, it moves on to 3.6 Flash, then 3.1 Flash-Lite. Listening uses 3.1 Flash-Lite first.
- **Hinglish detection.** A transcript that mixes Devanagari and English is marked as Hinglish, so Chandra answers in the same mix.
- **Gemini keys stay out of logs.** The newer Gemini key format (`AQ.…`) is redacted from the error log and refused by the "no typing secrets" safeguard, like every other key.
