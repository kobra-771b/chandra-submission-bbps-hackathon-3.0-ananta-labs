@echo off
rem Chandra by Ananta Labs: memory, voice, face, engine, desktop, hands.
rem Copyright (C) 2026 Ananta Labs. All rights reserved.

rem Starts Chandra's pieces. Each server gets its own window;
rem close the windows (or this one for the voice) to stop.
rem   start.bat          everything installed (except the desktop window)
rem   start.bat voice    the voice and the face (no hands)
rem   start.bat hands    the voice and the hands board (no face)
rem   start.bat desktop  Chandra Desktop, with the engine's server behind it
rem   start.bat local    typed chat with the LOCAL model only (works offline)

set "TOOLBOX=%~dp0"
cd /d "%~dp0.."

rem The Chandra Engine's Python (OpenJarvis), as setup recorded it in
rem engine\engine.json. PowerShell reads the JSON because cmd cannot, and
rem PowerShell ships with every Windows this runs on.
set "ENGINE_PY="
if exist "%TOOLBOX%engine\engine.json" (
  for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "(Get-Content -Raw -LiteralPath '%TOOLBOX%engine\engine.json' | ConvertFrom-Json).python"`) do set "ENGINE_PY=%%P"
)
if defined ENGINE_PY if not exist "%ENGINE_PY%" set "ENGINE_PY="

if /i "%1"=="local" (
  if not defined ENGINE_PY (
    echo   The Chandra Engine is not installed or wired yet.
    echo   Open a chat with Chandra and say: add the engine.
    pause
    exit /b 1
  )
  start "" /b cmd /c ""%ENGINE_PY%" -I "%TOOLBOX%engine\chandra_engine.py" --sync > "%TOOLBOX%engine\sync.log" 2>&1"
  echo   Chandra, offline: the local model on this computer. Type /quit to leave.
  "%ENGINE_PY%" -I -m openjarvis.cli
  exit /b
)

rem Chandra Desktop's Python: the runtime Chandra Setup installs, or a venv
rem built during setup.
set "DESKTOP_PY=%TOOLBOX%desktop\runtime\python.exe"
if not exist "%DESKTOP_PY%" set "DESKTOP_PY=%TOOLBOX%desktop\.venv\Scripts\python.exe"

if /i "%1"=="desktop" (
  if not exist "%DESKTOP_PY%" (
    echo   Chandra Desktop is not installed yet.
    echo   Open a chat with Chandra and say: add Chandra Desktop.
    pause
    exit /b 1
  )
  if defined ENGINE_PY (
    start "" /b cmd /c ""%ENGINE_PY%" -I "%TOOLBOX%engine\chandra_engine.py" --sync > "%TOOLBOX%engine\sync.log" 2>&1"
    start "Chandra Engine" /min cmd /c ""%ENGINE_PY%" -I -m openjarvis.cli serve --port 8000 > "%TOOLBOX%engine\serve.log" 2>&1"
    echo   engine:  serving at http://127.0.0.1:8000 ^(log in engine\serve.log^)
  ) else (
    echo   engine:  not installed; Chandra Desktop will need a Claude key in chandra.env
  )
  echo   desktop: opening the Chandra window. Close it to stop.
  "%DESKTOP_PY%" "%TOOLBOX%desktop\source\chandra.py"
  if defined ENGINE_PY taskkill /fi "WINDOWTITLE eq Chandra Engine*" /t /f >nul 2>&1
  exit /b
)

if exist "ai-visualizer\" if not "%1"=="hands" (
  echo   face:  starting
  start "Chandra face" cmd /c "cd ai-visualizer && run.bat"
)

rem Both servers are started through their own run.bat, which finds a
rem working interpreter and holds its window if anything goes wrong. This
rem file deliberately does NOT hunt for Python itself: a clean Windows 11
rem answers to the name `python` with a Microsoft Store decoy that passes
rem `where` and then exits 9009, so the check has to run an interpreter
rem rather than locate one -- and that belongs in one place per repo, not
rem duplicated here where a standalone user would never see the fix.
if exist "barehands\" if not "%1"=="voice" (
  echo   hands: starting
  start "Chandra hands" cmd /c "cd barehands && run.bat"
)

rem Keeps the engine current: re-applies Chandra's persona if something
rem reset it, and re-indexes the vault so local search sees today's notes.
if defined ENGINE_PY (
  echo   engine: syncing in the background ^(log in engine\sync.log^)
  start "" /b cmd /c ""%ENGINE_PY%" -I "%TOOLBOX%engine\chandra_engine.py" --sync > "%TOOLBOX%engine\sync.log" 2>&1"
)

if exist "backtalk\" (
  echo   voice: starting in this window. Close it to hang up.
  cd backtalk
  rem Self-repair: reconcile the voice line's packages before launch
  rem (fast when current; heals a half-installed environment).
  rem
  rem Its output is deliberately NOT hidden. This used to run quiet with
  rem everything sent to nul, so a first run downloaded a few hundred
  rem megabytes behind a completely blank screen. There is no way to tell
  rem that apart from frozen, and people reasonably assumed the worst.
  echo   voice: checking packages. The FIRST run downloads a few hundred MB
  echo          and can take several minutes. It is not stuck.
  uv sync --inexact
  rem Stop HERE if the packages could not be installed. This used to fall
  rem through to the launch and then blame backtalk's log for a failure
  rem that happened before backtalk ever ran, sending people to a healthy
  rem log file with nothing in it to find.
  if errorlevel 1 (
    echo.
    echo   The voice line's packages could not be installed, so it never
    echo   started. The reason is in the output above.
    echo.
    echo   This happened during setup, BEFORE the voice ran, so there is
    echo   nothing about it in backtalk\logs\backtalk.log.
    echo.
    pause
    exit /b 1
  )
  uv run python -m backtalk.main
  rem A clean goodbye exits 0 and the window may close. An error exits
  rem nonzero, and the window HOLDS so the message can be read.
  if errorlevel 1 (
    echo.
    echo   The voice line stopped with an error. The message is above.
    echo   The log lives in backtalk\logs\backtalk.log
    pause
  )
)
