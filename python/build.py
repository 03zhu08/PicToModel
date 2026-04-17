"""Build script to package the Python backend with PyInstaller."""
import subprocess
import sys
import platform


def main():
    name = "python_backend"
    entry = "main.py"

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", name,
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "--collect-data", "rembg",
        "--collect-data", "onnxruntime",
        entry,
    ]

    if platform.system() == "Darwin":
        cmd.extend(["--target-arch", "universal2"])

    print(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    print(f"\nBuild complete! Binary at: dist/{name}")


if __name__ == "__main__":
    main()
