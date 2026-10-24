# Chandra 1.0.1

## Chandra always opens

- **A second launch brings Chandra forward.** Opening Chandra while it is already running now shows and focuses the running window (it used to do nothing visible).
- **Updates take over cleanly.** If an older Chandra is still running when you open the new one (for example right after an update), the old one closes and the new one opens. If the running copy does not answer at all, the new one starts anyway.
- **Never a silent failure.** Chandra starts without a console, so a problem at startup used to mean nothing happened. Now, if its window cannot open (no Microsoft Edge WebView2 Runtime, or no .NET Framework 4.6.2), Chandra opens in your browser instead and a message says what to install, with Microsoft's link. Without WebView2 the window would otherwise have fallen back to Internet Explorer and stayed blank.
- **A start log.** Every launch writes its steps to `chandra-start.log` in Chandra's data folder (`%APPDATA%\Chandra`), and any startup error goes there with its details, so a problem can always be traced.

## Lighter

- The setup file is 12.5 MB (was 13.7 MB) and Chandra takes 47.6 MB on disk (was 51.0 MB).
- The bundled Python drops image modules Chandra never uses (fonts, WebP, colour management, Tk, math and morphology filters in Pillow) and the Windows Installer module.
- The page drops the older speaking blob (Nebula replaced it) and the hidden "Intelligence" panel.
- Chandra's theme is encoded at 96 kbps (719 KB instead of 958 KB).
- Screen sense no longer uses a Pillow call that Pillow 14 removes.
