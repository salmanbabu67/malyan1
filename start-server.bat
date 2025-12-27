@echo off
echo ========================================
echo   MYLAVAN Service App - Starting Server
echo ========================================
echo.
echo Starting Node.js server...
echo.

cd /d "%~dp0"

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Start the server
echo Server is starting...
echo The browser will open automatically at http://localhost:3000
echo.
echo Keep this window open while using the application
echo Press Ctrl+C to stop the server
echo ========================================
echo.

node server.js

pause
