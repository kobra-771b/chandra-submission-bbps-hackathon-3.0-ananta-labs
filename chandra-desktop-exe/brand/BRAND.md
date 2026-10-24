# Chandra Brand Guidelines — v1.1

Chandra is a premium personal intelligence by Ananta Labs: **serene at rest, capable in motion.** Every surface that carries the name follows this guide: the desktop app, the visualizer face, the installer, the docs, the shortcuts, and the way Chandra speaks.

## Names

| Say | Not |
|---|---|
| **Chandra** | the agent, the assistant, Jarvis |
| **Chandra Desktop** | the app, the Windows build |
| **the Chandra Engine** | OpenJarvis, the local server (in conversation) |
| **the Chandra face** | the visualizer, the board |
| **Ananta Labs** | the company, the team |

Upstream project names (OpenJarvis, ai-visualizer, backtalk, ai-memory-vault, barehands) appear only in config paths and commands such as `jarvis doctor`, never as the product's name. A person who chose door B or C names Chandra something else; their name replaces "Chandra" in conversation and shortcuts, and the brand otherwise stays.

## Approved symbol

The silver metallic open crescent with the four-point star, on a near-black ground. Keep the original proportions; never reconstruct it from generic moon or star icons, never recolor it, never animate its shape. Light it (glow, brightness), don't redraw it. On compact surfaces, use the symbol without a wordmark.

- `chandra-mark-dark.png` — transparent silver mark for dark surfaces (the face uses this file).
- `chandra-mark-light.png` — the mark for the rare light context (print, a light document).
- `chandra-app-icon.png` — dark app-icon artwork.
- `chandra.ico` — multi-resolution Windows icon for shortcuts and the installer.
- `chandra-face-preview.jpg` — the Chandra face, speaking.

## Palette and typography

- Canvas: `#030304` to `#07080B`.
- Main text: soft white `#ECEEF2`.
- Secondary text: neutral silver `rgba(219,222,229,.64)`.
- Borders: low-contrast cool gray/white at roughly 7–18% opacity.
- Light source: restrained pearl-white / champagne-white. One light, never saturated cyan.
- UI type: SF Pro / native sans-serif stack. Wordmarks: uppercase, wide tracking (about .4em).
- Logs and tool steps: `ui-monospace`, `SFMono-Regular`, Menlo, Consolas.

Use contrast and spacing rather than accent hues. **Dark only.** No light mode, no purple/cyan cyberpunk palette, no gradients on every component.

## Motion

- **Liquid blobs:** soft, slow, nearly invisible; they keep the black alive without lifting it to gray.
- **The eclipse arc:** a fine open-bottom semicircle with a single small point of light travelling along it, leaving a visible gap at the bottom like an eclipse or an illuminated horizon. It never obstructs controls or focus.
- **On the Chandra face**, the arc carries the states: at rest the light drifts; listening, the arc brightens with the microphone; thinking, the light quickens and the mark pulses softly; speaking, the voice rides a finer arc just inside the first and the mark glows with the words.

## Voice

Few words, exactly chosen. Lead with the answer. Calm under any load. Warm, not familiar. Honest about edges. The signature greeting: *"Hello [name], what are we working on today?"* The full persona is `persona/chandra.md`.

## Native chrome (Chandra Desktop)

Frameless window, macOS-style traffic lights at top-left (red close, amber minimise, green maximise/restore), kept separate from drag regions. The top bar stays near-black and clearly draggable outside the buttons.

## One assistant

Chandra is the only assistant. Chandra's chat shows the work in quiet cards: a short progress line while Chandra works, and a clear approval card (Allow once, Always allow, Deny, Stop) before any risky action. Errors and approvals are easy to spot without decorating every card.

## Interaction and computer control

Real mouse/keyboard actions use the local bridge and the explicit approval flow. Keep the pairing code, loopback binding, corner failsafe, and Stop All. Send fresh screenshots back to a vision-capable model after actions so it verifies results instead of chaining coordinates blindly.

## Secrets

No credential ever ships inside a page or a build. Chandra Desktop's page asks its host, and the host reads `chandra.env` on the person's own computer. The CI build fails if a key is found in the source.

## Release acceptance

A desktop release is complete only after a Windows runner has produced and smoke-tested both `Chandra.exe` and `Chandra-Setup-v<version>.exe` (NSIS, dark: near-black background, silver type, the Chandra icon).
