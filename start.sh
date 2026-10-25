#!/usr/bin/env bash
# Universal launcher for Linux & macOS

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=============================================================================="
echo "       ENTERPRISE GRAPH ARCHITECT - NEO4J & LLM RATIONALIZATION"
echo "=============================================================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH."
    echo "Please install Node.js (v18+) from https://nodejs.org/"
    exit 1
fi

echo "[OK] Node.js detected: $(node -v)"
echo "[OK] npm detected: $(npm -v)"
echo ""

# Root dependencies
if [ ! -d "node_modules/express" ]; then
    echo "[STEP 1/3] Installing root backend dependencies..."
    npm install --no-audit --no-fund
else
    echo "[STEP 1/3] Root dependencies verified."
fi

# Client dependencies
if [ ! -d "client/node_modules/vite" ]; then
    echo "[STEP 2/3] Installing client frontend dependencies..."
    (cd client && npm install --no-audit --no-fund)
else
    echo "[STEP 2/3] Client dependencies verified."
fi

# Sample dataset
if [ ! -f "sampleData/enterprise_application_stack.xlsx" ]; then
    echo "[STEP 3/3] Generating sample Enterprise Application Stack Excel sheet..."
    node server/generateSampleExcel.js
else
    echo "[STEP 3/3] Sample enterprise dataset verified."
fi

echo ""
echo "=============================================================================="
echo "Starting Servers:"
echo "  - Frontend UI:  http://localhost:5174/"
echo "  - Backend API:  http://localhost:3001/"
echo "=============================================================================="
echo ""

# Open browser asynchronously
(sleep 3 && (open http://localhost:5174/ 2>/dev/null || xdg-open http://localhost:5174/ 2>/dev/null || true)) &

npm run dev
