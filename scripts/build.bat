@echo off
REM PicToModel — Full build script (Windows)
REM
REM Usage:
REM   scripts\build.bat          Build for Windows
REM   scripts\build.bat win      Build Windows .exe
REM   scripts\build.bat all      Build all platforms
REM

setlocal enabledelayedexpansion

set ROOT_DIR=%~dp0..
cd /d "%ROOT_DIR%"

echo [BUILD] PicToModel Windows Build Script
echo.

REM ---------- Preflight ----------
where node >nul 2>&1 || (
    echo [ERROR] node not found. Install Node.js 18+
    exit /b 1
)
where python >nul 2>&1 || (
    echo [ERROR] python not found. Install Python 3.10+
    exit /b 1
)

python -c "import sys; exit(0 if sys.version_info >= (3,10) else 1)" || (
    echo [ERROR] Python 3.10+ required
    exit /b 1
)

echo [  OK ] Prerequisites checked

REM ---------- Step 1: Python venv ----------
echo [BUILD] Setting up Python virtual environment...

if not exist "python\venv\Scripts\python.exe" (
    python -m venv python\venv
    echo [  OK ] Created venv
) else (
    echo [  OK ] venv already exists
)

call python\venv\Scripts\activate.bat

pip install --upgrade pip -q
pip install -r python\requirements.txt -q
pip install pyinstaller -q
echo [  OK ] Python dependencies installed

REM ---------- Step 2: PyInstaller ----------
echo [BUILD] Bundling Python backend with PyInstaller...
cd python

pyinstaller ^
    --onefile ^
    --name python_backend ^
    --hidden-import uvicorn.logging ^
    --hidden-import uvicorn.loops ^
    --hidden-import uvicorn.loops.auto ^
    --hidden-import uvicorn.protocols ^
    --hidden-import uvicorn.protocols.http ^
    --hidden-import uvicorn.protocols.http.auto ^
    --hidden-import uvicorn.protocols.websockets ^
    --hidden-import uvicorn.protocols.websockets.auto ^
    --hidden-import uvicorn.lifespan ^
    --hidden-import uvicorn.lifespan.on ^
    --collect-data rembg ^
    --collect-data onnxruntime ^
    --noconfirm ^
    --clean ^
    main.py

if not exist "dist\python_backend.exe" (
    echo [ERROR] PyInstaller build failed
    exit /b 1
)
echo [  OK ] Python backend bundled

cd /d "%ROOT_DIR%"

REM ---------- Step 3: Node deps ----------
echo [BUILD] Installing Node.js dependencies...
call npm install --prefer-offline -q
echo [  OK ] Node.js dependencies installed

REM ---------- Step 4: Electron build ----------
echo [BUILD] Building Electron app...
call npx electron-vite build
echo [  OK ] Electron app built

REM ---------- Step 5: Package ----------
set TARGET=%1
if "%TARGET%"=="" set TARGET=win

echo [BUILD] Packaging for: %TARGET%

if "%TARGET%"=="all" (
    call npx electron-builder --mac --win --linux
) else if "%TARGET%"=="win" (
    call npx electron-builder --win
) else if "%TARGET%"=="mac" (
    call npx electron-builder --mac
) else if "%TARGET%"=="linux" (
    call npx electron-builder --linux
)

echo.
echo [  OK ] Packaging complete!
echo [BUILD] Output files are in: %ROOT_DIR%\dist\
dir /b "%ROOT_DIR%\dist\*.exe" 2>nul
echo.
echo Build finished successfully!
