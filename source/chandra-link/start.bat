@echo off
setlocal
cd /d "%~dp0"
title Chandra Link

echo "%~dp0" | findstr /i "Temp1_ \\Temp\\" >nul
if not errorlevel 1 goto inzip

if exist "venv\Scripts\python.exe" goto run

where py >nul 2>nul
if errorlevel 1 goto nopython

echo First run: setting up. This takes about 30 seconds...
py -3 -m venv venv
if errorlevel 1 goto fail
"venv\Scripts\python.exe" -m pip install -q --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto fail

:run
echo.
echo Starting Chandra Link.
echo If Windows Firewall asks, tick Private networks and click Allow.
echo.
"venv\Scripts\python.exe" link.py
echo.
echo Chandra Link stopped. If there is an error above, send it to me.
pause
exit /b

:inzip
echo You are running this from inside the zip file.
echo Close this window. Right-click the zip, choose Extract All, then run start.bat from the new folder.
pause
exit /b 1

:nopython
echo Python is not installed. Installing it now with winget...
winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
if errorlevel 1 goto nowinget
echo.
echo Python is installed. CLOSE this window, then double-click start.bat again.
pause
exit /b

:nowinget
echo.
echo Could not install Python automatically.
echo Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH", then run start.bat again.
pause
exit /b 1

:fail
echo.
echo Setup failed. Check your internet connection and try again.
if exist venv rmdir /s /q venv
pause
exit /b 1
