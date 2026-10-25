@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: Universal Windows Launcher for Enterprise Graph Architect
:: ==============================================================================

:: Ensure working directory is always the script folder (fixes shortcut / admin issues)
cd /d "%~dp0"

title Enterprise Graph Architect - Neo4j & LLM Rationalization
color 0B

echo.
echo ==============================================================================
echo        ENTERPRISE GRAPH ARCHITECT - NEO4J & LLM RATIONALIZATION
echo ==============================================================================
echo [INFO] Working Directory: %~dp0
echo.

:: 1. Check & Auto-locate Node.js in common locations if not in PATH
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
    ) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    ) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
    ) else if exist "%APPDATA%\npm\node.exe" (
        set "PATH=%APPDATA%\npm;%PATH%"
    )
)

:: Re-verify Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or could not be found!
    echo.
    echo Please install Node.js (version 18 or higher) from:
    echo https://nodejs.org/
    echo.
    echo After installing, double-click start.bat again.
    echo.
    pause
    exit /b 1
)

:: Verify NPM
where npm >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] npm is not found in your system PATH!
    echo Please ensure Node.js is properly installed with npm included.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detected: 
call node -v
echo [OK] NPM detected:
call npm -v
echo.

:: 2. Check and install root dependencies
if not exist "%~dp0node_modules\express" (
    echo [STEP 1/3] Installing root backend dependencies (this may take a minute)...
    call npm install --no-audit --no-fund
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo [ERROR] Failed to install root dependencies.
        echo Try running "npm install" manually in this directory.
        pause
        exit /b 1
    )
) else (
    echo [STEP 1/3] Root backend dependencies verified.
)
echo.

:: 3. Check and install client dependencies
if not exist "%~dp0client\node_modules\vite" (
    echo [STEP 2/3] Installing client frontend dependencies...
    cd /d "%~dp0client"
    call npm install --no-audit --no-fund
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo [ERROR] Failed to install client frontend dependencies.
        echo Try running "cd client && npm install" manually.
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
) else (
    echo [STEP 2/3] Client frontend dependencies verified.
)
echo.

:: 4. Verify sample data file
if not exist "%~dp0sampleData\enterprise_application_stack.xlsx" (
    echo [STEP 3/3] Generating initial sample application stack dataset...
    call node "%~dp0server\generateSampleExcel.js"
) else (
    echo [STEP 3/3] Sample enterprise application stack verified.
)
echo.

:: 5. Launch application
echo ==============================================================================
echo [STATUS] Starting Servers:
echo   - Frontend UI:  http://localhost:5174/
echo   - Backend API:  http://localhost:3001/
echo   - Neo4j Bolt:   bolt://localhost:7687 (Ensure Neo4j Desktop DBMS is started)
echo ==============================================================================
echo.
echo Opening browser in 3 seconds...
echo (Press Ctrl+C at any time in this window to stop the servers)
echo.

:: Open browser after 3 seconds asynchronously
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5174/"

:: Run dev server
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [NOTICE] Application stopped or encountered an error (exit code: %errorlevel%).
)

pause
