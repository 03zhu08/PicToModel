#!/usr/bin/env bash
#
# PicToModel — Full build script (macOS / Linux)
#
# Usage:
#   ./scripts/build.sh          # Build for current platform
#   ./scripts/build.sh mac      # Build macOS .dmg
#   ./scripts/build.sh win      # Build Windows .exe (cross-compile)
#   ./scripts/build.sh linux    # Build Linux AppImage
#   ./scripts/build.sh all      # Build all platforms
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PLATFORM="${1:-$(uname -s)}"

# ---------- colours ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[BUILD]${NC} $*"; }
ok()   { echo -e "${GREEN}[  OK ]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN ]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ---------- preflight ----------
log "Checking prerequisites..."

command -v node  >/dev/null 2>&1 || err "node not found — install Node.js >= 18"
command -v npm   >/dev/null 2>&1 || err "npm not found"

PYTHON=""
if [ -f "$ROOT_DIR/python/venv/bin/python3" ]; then
  PYTHON="$ROOT_DIR/python/venv/bin/python3"
elif command -v python3.12 >/dev/null 2>&1; then
  PYTHON="python3.12"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="python3"
else
  err "Python 3.10+ not found. Install with: brew install python@3.12"
fi

PYVER=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYMAJOR=$(echo "$PYVER" | cut -d. -f1)
PYMINOR=$(echo "$PYVER" | cut -d. -f2)
if [ "$PYMAJOR" -lt 3 ] || { [ "$PYMAJOR" -eq 3 ] && [ "$PYMINOR" -lt 10 ]; }; then
  err "Python >= 3.10 required (found $PYVER). Install with: brew install python@3.12"
fi
ok "Python $PYVER at $PYTHON"

# ---------- Step 1: Python venv ----------
log "Setting up Python virtual environment..."
if [ ! -f "$ROOT_DIR/python/venv/bin/python3" ]; then
  "$PYTHON" -m venv "$ROOT_DIR/python/venv"
  ok "Created venv"
else
  ok "venv already exists"
fi

source "$ROOT_DIR/python/venv/bin/activate"
pip install --upgrade pip -q
pip install -r "$ROOT_DIR/python/requirements.txt" -q
pip install pyinstaller -q
ok "Python dependencies installed"

# ---------- Step 2: Bundle Python with PyInstaller ----------
log "Bundling Python backend with PyInstaller..."
cd "$ROOT_DIR/python"

pyinstaller \
  --onefile \
  --name python_backend \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.loops \
  --hidden-import uvicorn.loops.auto \
  --hidden-import uvicorn.protocols \
  --hidden-import uvicorn.protocols.http \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.websockets \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import uvicorn.lifespan \
  --hidden-import uvicorn.lifespan.on \
  --collect-data rembg \
  --collect-data onnxruntime \
  --noconfirm \
  --clean \
  main.py 2>&1 | tail -5

if [ ! -f "$ROOT_DIR/python/dist/python_backend" ]; then
  err "PyInstaller build failed — python/dist/python_backend not found"
fi
ok "Python backend bundled → python/dist/python_backend"

cd "$ROOT_DIR"

# ---------- Step 3: Install Node dependencies ----------
log "Installing Node.js dependencies..."
npm install --prefer-offline -q 2>&1 | tail -3
ok "Node.js dependencies installed"

# ---------- Step 4: Build Electron app ----------
log "Building Electron app (electron-vite)..."
npx electron-vite build
ok "Electron app built → out/"

# ---------- Step 5: Package with electron-builder ----------
resolve_platform() {
  case "$1" in
    Darwin|mac|macos)  echo "mac" ;;
    MINGW*|MSYS*|win|windows) echo "win" ;;
    Linux|linux)       echo "linux" ;;
    all)               echo "all" ;;
    *)                 echo "mac" ;;
  esac
}

TARGET=$(resolve_platform "$PLATFORM")

log "Packaging for: $TARGET"

if [ "$TARGET" = "all" ]; then
  npx electron-builder --mac --win --linux
elif [ "$TARGET" = "mac" ]; then
  npx electron-builder --mac
elif [ "$TARGET" = "win" ]; then
  npx electron-builder --win
elif [ "$TARGET" = "linux" ]; then
  npx electron-builder --linux
fi

ok "Packaging complete!"
echo ""
log "Output files are in: ${ROOT_DIR}/dist/"
ls -lh "$ROOT_DIR/dist/"*.{dmg,exe,zip,AppImage} 2>/dev/null || true
echo ""
echo -e "${GREEN}✅ Build finished successfully!${NC}"
