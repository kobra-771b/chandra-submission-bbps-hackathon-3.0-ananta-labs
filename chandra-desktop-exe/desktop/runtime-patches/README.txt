The bundled runtime (desktop/runtime) is not in git. Files here are patched copies to copy over it when the runtime is rebuilt:

- webview-platforms-edgechromium.py -> Lib/site-packages/webview/platforms/edgechromium.py (skips WebView2 loader folders Chandra does not ship, so the window opens on ARM64 Windows under x64 emulation; without it: "FileNotFoundError: Cannot find win-arm64").
