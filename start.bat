@echo off
setlocal enabledelayedexpansion

title Enterprise Graph Architect - Neo4j & LLM Rationalization
color 0B

echo ==============================================================================
echo        ENTERPRISE GRAPH ARCHITECT - NEO4J & LLM RATIONALIZATION
echo ==============================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in your system PATH.
    echo Please install Node.js (v18+) from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detected:
node -v
echo.

:: 2. Check and install root dependencies
if not exist "node_modules\" (
    echo [1/3] Installing root backend dependencies...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Failed to install root dependencies.
        pause
        exit /b 1
    )
) else (
    echo [1/3] Root dependencies already installed.
)
echo.

:: 3. Check and install client dependencies
if not exist "client\node_modules\" (
    echo [2/3] Installing client frontend dependencies...
    cd client
    call npm install
    cd ..
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Failed to install client dependencies.
        pause
        exit /b 1
    )
) else (
    echo [2/3] Client dependencies already installed.
)
echo.

:: 4. Generate sample Excel file if missing
if not exist "sampleData\enterprise_application_stack.xlsx" (
    echo [3/3] Generating sample Enterprise Application Stack Excel sheet...
    node server/generateSampleExcel.js
) else (
    echo [3/3] Sample application stack Excel sheet verified.
)
echo.

:: 5. Launch application
echo ==============================================================================
echo [STARTING] Starting Backend (:3001) and Frontend (:5174)...
echo.
echo - Frontend UI:  http://localhost:5174/
echo - Backend API:  http://localhost:3001/
echo - Neo4j Bolt:   bolt://localhost:7687 (Ensure Neo4j Desktop DBMS is started)
echo ==============================================================================
echo.

:: Open browser after 3 seconds in background
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5174/"

:: Run dev server
npm run dev

pause
