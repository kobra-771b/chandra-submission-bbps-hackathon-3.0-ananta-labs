# Chandra: BBPS Hackathon 3.0 Submission

**Team / owner:** Ananta Labs
**Copyright:** © 2026 Ananta Labs. All rights reserved. See [COPYRIGHTS.txt](COPYRIGHTS.txt) and [LICENSES.txt](LICENSES.txt).

Chandra Link pairs a phone with a PC over the same Wi-Fi. There is no account and no cloud. The phone can ask Chandra a question, trigger PC actions (ping, lock, sleep, shut down, open a link, copy text, notify) and receive alerts back.

## Repository layout

| Path | What it is |
|---|---|
| `source/chandra-link/` | Source code of the Chandra Link PC companion (Python, aiohttp), with its own README |
| `dist/ChandraLink-PC.zip` | The same PC companion as shipped, as a single ZIP |
| `deck/` | Submission slide decks (static HTML), see below |
| `tools/build_deck.py` | Generator for the decks (`python tools/build_deck.py`) |
| `README.md`, `LICENSES.txt`, `COPYRIGHTS.txt` | Project, licensing and copyright notices |

> The Chandra desktop (EXE) and Android (APK) application sources and their installers are submitted separately from the PC companion and are not part of this commit yet. They will be added under their own folders.

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

1. Extract `dist/ChandraLink-PC.zip` (or use `source/chandra-link/`).
2. Double-click `start.bat`. First run creates a virtual environment and installs `aiohttp`, `segno` and `zeroconf`.
3. Allow the firewall prompt for private networks, then scan the QR code on the PC page with the phone.

Details and limits are in [`source/chandra-link/README.md`](source/chandra-link/README.md).

## Rebuild the decks

```
python tools/build_deck.py
```

The script needs only the Python standard library.

## Contact

Ananta Labs, BBPS Hackathon 3.0 submission.
