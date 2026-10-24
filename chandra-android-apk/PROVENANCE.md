# Provenance: Chandra for Android (APK) source

Recovered from the release **`Chandra-v1.0.1-android.apk`**
(https://github.com/kobrx7-god/chandra-full/releases/tag/apk-2, SHA-256
`ef58719576a9a62b117fc3cf0eb93da7093e3ec1ba343b9935b5966024d77234`). Package `labs.ananta.chandra`,
version 1.0.1 (code 101), min SDK 24, target SDK 34.

An APK carries compiled code, not the original source files. What is here, and how exact each part is:

| Path | Exactness |
|---|---|
| `AndroidManifest.xml` | Decoded from the binary manifest. Exact. |
| `resources/res/`, `resources/assets-chandra/` | Icons, network security config and the ambient sound, copied unchanged. |
| `python/original-bytecode/` | `android_main.pyc`, `android_shim.pyc`, `chandra.pyc` exactly as shipped (Python 3.12, run with Chaquopy). |
| `python/disassembly/` | Full bytecode disassembly of the three modules. Exact, but low level. |
| `python/recovered-approximate/android_shim.page-script.html` | The JavaScript that `android_shim.py` injects into the page. Exact text. |
| `python/recovered-approximate/*.py` | **Approximate** decompiler output. Parts are incomplete (marked). Use the disassembly as the reference. |
| `java-recovered-approximate/` | **Approximate** decompiled Java of `MainActivity` and its helpers. |
| `dex/` | The compiled Android classes as shipped. |

## The shared host
`chandra.pyc` in the APK is the same single-file host as `chandra-desktop-exe/desktop/source/chandra.py`
(the Android build runs the host "unchanged" and swaps only the PC-only pieces, see the docstring in
`android_main`). The APK carries an earlier build of that file; the desktop `chandra.py` is the full, readable source.

## Left out on purpose
The Chaquopy and CPython runtime (`lib/*.so`, `assets/chaquopy/*`, about 24 MB) are third-party, unmodified, and not Ananta Labs source.
The original Android Studio project (Gradle files and the `MainActivity` Java source) was not available; if it exists on the author's PC it should be added here.
