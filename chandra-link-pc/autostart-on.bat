@echo off
setlocal
cd /d "%~dp0"
if not exist "venv\Scripts\pythonw.exe" goto first
set "VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ChandraLink.vbs"
> "%VBS%" echo CreateObject("WScript.Shell").Run """%~dp0venv\Scripts\pythonw.exe"" ""%~dp0link.py"" --no-browser", 0, False
echo Chandra Link will now start quietly when you log in.
echo To turn it off, delete this file: %VBS%
pause
exit /b

:first
echo Run start.bat once first, then run this.
pause
exit /b 1
