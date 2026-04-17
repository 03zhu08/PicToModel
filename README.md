# PicToModel

Convert images into Minecraft 1.12.2 model JSON files. Upload a picture, the app automatically removes the background, extracts the subject silhouette, and generates a 3D voxel model viewable in a built-in Three.js previewer — then export as a valid `.json` model file.

## Features

- **AI background removal** — powered by [rembg](https://github.com/danielgatis/rembg) (U2-Net), no GPU required
- **Silhouette → voxel extrusion** — flat or rounded depth modes
- **Real-time 3D preview** — orbit, zoom, rotate with Three.js
- **Configurable resolution** — 8×8 to 48×48 voxel grid
- **Greedy meshing** — merges adjacent voxels into larger cuboids to minimize element count
- **Valid Minecraft 1.12.2 JSON** — `elements`, `textures`, `display` sections, coordinates clamped to [-16, 32]
- **Cross-platform** — builds for macOS (.dmg) and Windows (.exe)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron + electron-vite |
| Frontend | React + TypeScript + TailwindCSS |
| 3D preview | Three.js (react-three-fiber) |
| Backend | Python + FastAPI (local HTTP server) |
| Image processing | rembg + OpenCV + NumPy + SciPy |
| Packaging | electron-builder + PyInstaller |

## Project Structure

```
PicToModel/
├── electron/              # Electron main + preload
│   ├── main.ts            # Spawns Python backend, IPC handlers
│   └── preload.ts         # contextBridge API
├── src/                   # React renderer
│   ├── App.tsx
│   ├── components/
│   │   ├── ImageUploader.tsx
│   │   ├── VoxelPreview.tsx
│   │   ├── ControlPanel.tsx
│   │   └── ModelInfo.tsx
│   ├── hooks/
│   │   └── useModelGeneration.ts
│   └── styles/
│       └── index.css
├── python/                # Python backend
│   ├── main.py            # FastAPI entry point
│   ├── segmentation.py    # rembg background removal + mask extraction
│   ├── voxelizer.py       # 2D mask → 3D voxel grid
│   ├── mc_model.py        # Voxel grid → Minecraft JSON
│   ├── build.py           # PyInstaller build helper
│   └── requirements.txt
├── scripts/
│   ├── build.sh           # Full build script (macOS/Linux)
│   └── build.bat          # Full build script (Windows)
├── electron-builder.yml
├── electron.vite.config.ts
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Prerequisites

- **Node.js** >= 18
- **Python** >= 3.10 (3.12 recommended)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url> PicToModel
cd PicToModel
npm install
```

### 2. Set up Python environment

```bash
python3.12 -m venv python/venv
source python/venv/bin/activate   # Windows: python\venv\Scripts\activate
pip install -r python/requirements.txt
```

> The first launch downloads the U2-Net model (~170 MB). Subsequent launches are instant.

### 3. Run in development

```bash
npm run dev
```

This starts both the Electron app and the Python backend automatically.

### 4. Use the app

1. Drag & drop an image (or click to browse) into the left panel
2. Adjust resolution, extrusion mode, and depth ratio in the right panel
3. Click **Generate Model**
4. Inspect the 3D preview (drag to orbit, scroll to zoom)
5. Click **Export JSON** to save the Minecraft model file

## Building for Distribution

### macOS

```bash
./scripts/build.sh mac
# Output: dist/PicToModel-1.0.0-mac.dmg
```

### Windows

```bat
scripts\build.bat win
# Output: dist\PicToModel-1.0.0-win.exe
```

### All platforms

```bash
./scripts/build.sh all
```

The build script handles everything: Python venv setup → PyInstaller bundling → npm install → electron-vite build → electron-builder packaging.

## Minecraft Model Format

The generated JSON follows the Minecraft 1.12.2 block model specification:

- Coordinates within [-16, 32], centered at (8, 8, 8)
- Each cuboid is an `element` with `from`/`to` coordinates and `faces`
- Default texture: `blocks/stone` (replace in-game as needed)
- Includes `display` transforms for thirdperson, firstperson, GUI, ground, and fixed views

## License

MIT
