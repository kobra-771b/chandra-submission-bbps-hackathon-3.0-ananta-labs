# Chandra: BBPS Hackathon 3.0 Submission

**Team / owner:** Ananta Labs
**Copyright:** © 2026 Ananta Labs. All rights reserved. See [COPYRIGHTS.txt](COPYRIGHTS.txt) and [LICENSES.txt](LICENSES.txt).

**Chandra** is a personal intelligence by Ananta Labs: a voice-first assistant that talks, listens and works your computer with your approval for each task. It speaks English, Hindi and Hinglish, thinks with Claude, Gemini or a local engine, and keeps your data on your own device.

This submission contains three parts:

- **Chandra Desktop** for Windows 10 and 11 (the EXE).
- **Chandra for Android** (the APK, `labs.ananta.chandra`).
- **Chandra Link**, which pairs a phone with a PC over the same Wi-Fi, with no account and no cloud, to ask Chandra, trigger PC actions and receive alerts.

## Repository layout

| Path | What it is |
|---|---|
| `chandra-desktop-exe/` | **Source of Chandra Desktop (Windows EXE)**, unpacked from `Chandra_v1.0.1-production-ready.exe`. Start at `PROVENANCE.md`, then `desktop/source/chandra.py` |
| `chandra-android-apk/` | **Source of Chandra for Android (APK)**, recovered from `Chandra-v1.0.1-android.apk`. Start at `PROVENANCE.md` |
| `chandra-link-pc/` | **Source of Chandra Link** (PC companion, Python), with its own README |
| `dist/` | Shipped binaries: `Chandra_v1.0.1-production-ready.exe`, `Chandra-v1.0.1-android.apk`, `ChandraLink-PC.zip`, checksums |
| `deck/` | Submission slide decks (static HTML), see below |
| `tools/build_deck.py` | Generator for the decks (`python tools/build_deck.py`) |
| `README.md`, `LICENSES.txt`, `COPYRIGHTS.txt` | Project, licensing and copyright notices |

The three source folders are kept separate on purpose. Each `PROVENANCE.md` states exactly where the files came from, how exact they are, and what was left out (third-party runtimes and one file with private keys).

> `dist/` holds all three shipped binaries: the Windows Setup EXE, the Android APK and the Chandra Link ZIP, with SHA-256 checksums.

## Slide decks

Open `deck/index.html` in a browser, or serve the folder (for example `python -m http.server -d deck`).

| Deck | Path |
|---|---|
| Application Slide Deck | `deck/application/` |
| Technology Stack | `deck/technology-stack/` |
| Commercialisation Roadmap | `deck/commercialisation-roadmap/` |

Every page supports three English variants through the query string:

- `?lang=en-US` (default)
- `?lang=en-UK`
- `?lang=en-IN`

Example: `deck/technology-stack/?lang=en-IN`. The language switcher on each page changes the variant, and links between pages carry your choice. Use the arrow keys to move between slides. Printing the page gives one slide per sheet.

## Run Chandra Link (Windows)

1. Extract `dist/ChandraLink-PC.zip` (or use `chandra-link-pc/`).
2. Double-click `start.bat`. First run creates a virtual environment and installs `aiohttp`, `segno` and `zeroconf`.
3. Allow the firewall prompt for private networks, then scan the QR code on the PC page with the phone.

Details and limits are in [`chandra-link-pc/README.md`](chandra-link-pc/README.md).

## Rebuild the decks

```
python tools/build_deck.py
```

The script needs only the Python standard library.

## Contact

Ananta Labs, BBPS Hackathon 3.0 submission.
