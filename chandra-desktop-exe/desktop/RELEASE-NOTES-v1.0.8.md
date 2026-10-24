# Chandra 1.0.8: the window opens

- **Fixed: "Chandra could not open its own window ... FileNotFoundError: Cannot find win-arm64".** The window's loader looked for WebView2 folders for ARM64 and x86 that the lighter runtime no longer carried, so the window failed to open on every machine and Chandra fell back to the browser. It now skips folders that are not shipped. Chandra's x64 runtime runs on Intel and AMD Windows and, through Windows 11's built-in emulation, on ARM64.
