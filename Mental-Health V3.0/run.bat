@echo off
setlocal
cd /d "%~dp0"
title Mindsence

rem ---- find Python ----
set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY ( where python >nul 2>nul && set "PY=python" )
if not defined PY (
    echo Python 3.9 or newer is required. Opening the download page...
    echo Tick "Add python.exe to PATH" in the installer, then run this file again.
    start "" https://www.python.org/downloads/
    pause
    exit /b 1
)

rem ---- first run: private environment + packages ----
if not exist "venv\Scripts\python.exe" (
    echo Setting up Mindsence ^(first time only, about a minute^)...
    %PY% -m venv venv || ( echo Could not create the environment. & pause & exit /b 1 )
)
if not exist "venv\.installed" (
    "venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r requirements.txt || ( echo Package install failed. Check your internet connection. & pause & exit /b 1 )
    echo ok> "venv\.installed"
)

rem ---- download page libraries once (faster start, works offline); failure is harmless ----
if not exist "assets\vendor\.done" (
    "venv\Scripts\python.exe" tools\get_vendor.py && echo ok> "assets\vendor\.done"
)

rem ---- free local AI (Ollama): installs/starts it and downloads a model that fits this computer; skipped if a cloud key is set ----
"venv\Scripts\python.exe" tools\setup_ai.py
echo.

rem ---- open the browser a few seconds after the server starts ----
if not defined MINDSENCE_PORT set "MINDSENCE_PORT=5000"
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:%MINDSENCE_PORT%"

echo.
echo Mindsence is starting at http://localhost:%MINDSENCE_PORT%  ^(close this window to stop it^)
echo.
"venv\Scripts\python.exe" app.py
echo.
echo Mindsence stopped.
pause
