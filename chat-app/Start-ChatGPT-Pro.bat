@echo off
title ChatGPT Pro
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode
node -e "process.exit(+process.versions.node.split('.')[0] >= 22 ? 0 : 1)"
if errorlevel 1 goto oldnode

set LOCAL_SIGNUP_ONLY=1
echo.
echo   ChatGPT Pro chal raha hai:   http://localhost:3000
echo   Browser khud khul jayega. Yeh window band karne se website band ho jayegi.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
node server\index.js
pause
exit /b

:nonode
echo.
echo   Node.js nahi mila. Download page khul raha hai:
echo   "LTS" wala install karein, phir yeh file dobara double-click karein.
start "" https://nodejs.org/en/download
pause
exit /b

:oldnode
echo.
echo   Node.js purana hai. Naya "LTS" install karein, phir yeh file dobara chalayein.
start "" https://nodejs.org/en/download
pause
exit /b
