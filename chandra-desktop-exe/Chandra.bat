@echo off
rem Chandra by Ananta Labs. Starts Chandra Desktop in its own window (no console).
rem Double-click this file or the Chandra shortcut. A .ananta memory file given on the command line is passed on.
rem ASCII only, and the folder path is never retyped, so folders with spaces or non-English letters work.
rem Copyright (C) 2026 Ananta Labs. All rights reserved.
setlocal
rem Every path below is built from %~dp0, so the current folder does not matter.
cd /d "%~dp0"
set "CHANDRA_RUNTIME=%~dp0desktop\runtime\pythonw.exe"
set "CHANDRA_APP=%~dp0desktop\source\chandra.py"
rem A portable copy (a portable.txt file beside this launcher) keeps its data in the data folder beside it.
if exist "%~dp0portable.txt" set "CHANDRA_DATA=%~dp0data"
if not exist "%CHANDRA_RUNTIME%" (call :fail "Chandra's Python runtime is missing:" "%CHANDRA_RUNTIME%" & exit /b 1)
if not exist "%CHANDRA_APP%" (call :fail "Chandra's program file is missing:" "%CHANDRA_APP%" & exit /b 1)
rem 32-bit Windows cannot run this build (its runtime is 64-bit). A plain message instead of a silent failure.
if /i "%PROCESSOR_ARCHITECTURE%"=="x86" if not defined PROCESSOR_ARCHITEW6432 (call :fail "Chandra needs 64-bit Windows 10 or 11." "" & exit /b 1)
start "" "%CHANDRA_RUNTIME%" "%CHANDRA_APP%" %*
exit /b 0

:fail
rem Shows the problem in a message box, because an icon launch has no console to print to.
set "CHANDRA_PROBLEM=%~1 %~2"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show(('Chandra cannot start.' + [char]10 + [char]10 + $env:CHANDRA_PROBLEM + [char]10 + [char]10 + 'Reinstall Chandra with Chandra-Setup.exe, then try again.'), 'Chandra')" >nul 2>&1
exit /b 1
