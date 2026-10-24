# Provenance: Chandra Desktop (EXE) source

This folder is the source tree packed inside the release **`Chandra_v1.0.1-production-ready.exe`**
(https://github.com/kobrx7-god/chandra-full/releases/tag/exe, SHA-256
`187c8ada8a5f867d82b6a8b77427aa7902f4e6b69e9539a433b3c24f3d555945`).

That EXE is Chandra Setup: a native launcher plus an installer that carries a single LZMA payload of
2,248 files. The payload and its file table were unpacked unchanged and written here, with the
exceptions below. Nothing was edited.

## Where the application source is
| Path | What |
|---|---|
| `desktop/source/chandra.py` | The host: single-file Python app (window, local server, safeguards, tools, brains) |
| `desktop/source/ui/` | Interface modules (vanilla JS/CSS, WebGL) and `app.v1.html` |
| `desktop/source/pack.py` | Build step that embeds the page into the host |
| `desktop/source/tests/` | Automated tests |
| `engine/`, `persona/`, `face/`, `brand/` | Engine bridge, persona, face page, brand assets |
| `docs/` | Chandra's own Specification and Slide Deck (HTML) |
| `desktop/RELEASE-NOTES-*.md`, `desktop/history/` | Release notes |
| `EULA.txt`, `desktop/THIRD-PARTY-NOTICES.md` | End-user licence and third-party notices |

## Left out on purpose
- **`desktop/source/chandra.env`**: it contained live API keys (a "personal setup"; since revoked). It is not committed.
  `desktop/chandra.env.example` shows the format.
- **`desktop/runtime/`** (Python 3.12 runtime, pywebview and libraries, 35 MB, 899 files): third-party, unmodified, not Ananta Labs source.
- **`OpenJarvis/`** (14 MB snapshot of the upstream open-source OpenJarvis project, used as the "Chandra Engine"): third-party. Upstream: https://github.com/open-jarvis/OpenJarvis

## Not present in the payload
The installer's own C++ source (`installer/native/setup.cpp`, named in `desktop/THIRD-PARTY-NOTICES.md`) is not shipped inside the EXE, so it is not here.
