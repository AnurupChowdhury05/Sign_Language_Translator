@echo off
title SignSense Server
echo ====================================================
echo      Starting SignSense ASL Translator...
echo ====================================================
echo.

:: Check if npx is available
where npx >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org to run this server.
    echo.
    pause
    exit /b 
)

echo Starting local server on port 5050...
echo (Keep this window open while using the app. Press Ctrl+C to close it.)
echo.

:: Open the browser first so it's ready when the server boots
start http://localhost:5050

:: Start the server via npx
npx serve -l 5050 .

pause
