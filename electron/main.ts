import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { writeFileSync, existsSync } from 'fs'
import http from 'http'

const PYTHON_PORT = 8787
const PYTHON_URL = `http://127.0.0.1:${PYTHON_PORT}`

let pythonProcess: ChildProcess | null = null
let mainWindow: BrowserWindow | null = null

function getPythonPath(): string {
  const isDev = !app.isPackaged

  if (isDev) {
    const venvPython = process.platform === 'win32'
      ? join(__dirname, '..', '..', 'python', 'venv', 'Scripts', 'python.exe')
      : join(__dirname, '..', '..', 'python', 'venv', 'bin', 'python3')

    if (existsSync(venvPython)) {
      return venvPython
    }
    return process.platform === 'win32' ? 'python' : 'python3'
  }

  const resourcePath = process.resourcesPath
  if (process.platform === 'win32') {
    return join(resourcePath, 'python', 'python_backend.exe')
  }
  return join(resourcePath, 'python', 'python_backend')
}

function getPythonArgs(): string[] {
  const isDev = !app.isPackaged
  if (isDev) {
    return [join(__dirname, '..', '..', 'python', 'main.py')]
  }
  return []
}

function startPythonBackend(): void {
  const pythonPath = getPythonPath()
  const args = getPythonArgs()

  console.log(`Starting Python backend: ${pythonPath} ${args.join(' ')}`)

  try {
    pythonProcess = spawn(pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    })
  } catch (err) {
    console.error('Failed to spawn Python process:', err)
    mainWindow?.webContents.send('backend-error', `Failed to start Python: ${err}`)
    return
  }

  pythonProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[Python] ${data.toString().trim()}`)
  })

  pythonProcess.stderr?.on('data', (data: Buffer) => {
    console.log(`[Python ERR] ${data.toString().trim()}`)
  })

  pythonProcess.on('error', (err) => {
    console.error('Python process error:', err)
    mainWindow?.webContents.send('backend-error', `Python process error: ${err.message}`)
    pythonProcess = null
  })

  pythonProcess.on('close', (code: number | null) => {
    console.log(`Python backend exited with code ${code}`)
    if (code !== 0 && code !== null) {
      mainWindow?.webContents.send('backend-error', `Python backend exited with code ${code}`)
    }
    pythonProcess = null
  })
}

function waitForPython(retries = 60, interval = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0
    const check = () => {
      const req = http.get(`${PYTHON_URL}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve(true)
        } else {
          retry()
        }
      })
      req.on('error', retry)
      req.setTimeout(500, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      attempts++
      if (attempts >= retries) {
        resolve(false)
      } else {
        setTimeout(check, interval)
      }
    }
    check()
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('process-image', async (_event, payload: {
  imageData: string | null
  resolution: number
  extrusionMode: string
  depthRatio: number
  enableColor: boolean
  textureResolution: number
  symmetrical: boolean
  rotationX: number
  rotationY: number
  rotationZ: number
}) => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 300_000)

    const response = await fetch(`${PYTHON_URL}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_data: payload.imageData,
        resolution: payload.resolution,
        extrusion_mode: payload.extrusionMode,
        depth_ratio: payload.depthRatio,
        enable_color: payload.enableColor ?? false,
        texture_resolution: payload.textureResolution ?? 8,
        symmetrical: payload.symmetrical ?? false,
        rotation_x: payload.rotationX ?? 0,
        rotation_y: payload.rotationY ?? 0,
        rotation_z: payload.rotationZ ?? 0,
      }),
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) {
      let detail = 'Processing failed'
      try {
        const err = await response.json()
        if (Array.isArray(err.detail)) {
          // FastAPI validation errors
          detail = err.detail.map((e: any) =>
            `${e.loc.join('.')}: ${e.msg}`
          ).join('; ')
        } else if (typeof err.detail === 'string') {
          detail = err.detail
        }
      } catch { /* ignore parse errors */ }
      throw new Error(detail)
    }

    return await response.json()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('abort')) {
      throw new Error('Processing timed out — try a lower resolution or smaller image')
    }
    throw new Error(`Backend error: ${message}`)
  }
})

ipcMain.handle('save-model', async (_event, jsonData: string, filename: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: filename,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })

  if (!result.canceled && result.filePath) {
    writeFileSync(result.filePath, jsonData, 'utf-8')
    return result.filePath
  }
  return ''
})

ipcMain.handle('save-model-with-texture', async (
  _event,
  jsonData: string,
  texturePngBase64: string,
  filename: string
) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: filename,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })

  if (!result.canceled && result.filePath) {
    const baseName = result.filePath.replace(/\.json$/i, '')
    const textureFilename = `${baseName}_texture`
    const texturePath = `${textureFilename}.png`

    // Update JSON to reference the correct texture file
    const modelData = JSON.parse(jsonData)
    const relativeTextureName = textureFilename.split('/').pop() || 'model_texture'
    modelData.textures = {
      tex: relativeTextureName,
      particle: relativeTextureName
    }

    writeFileSync(result.filePath, JSON.stringify(modelData, null, 2), 'utf-8')
    const textureBuffer = Buffer.from(texturePngBase64, 'base64')
    writeFileSync(texturePath, textureBuffer)

    return result.filePath
  }
  return ''
})

ipcMain.handle('check-health', async () => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const response = await fetch(`${PYTHON_URL}/health`, { signal: controller.signal })
    clearTimeout(timeout)
    if (response.ok) {
      const data = await response.json() as { status: string; model_ready: boolean }
      return { alive: true, modelReady: data.model_ready ?? false }
    }
    return { alive: false, modelReady: false }
  } catch {
    return { alive: false, modelReady: false }
  }
})

app.whenReady().then(async () => {
  startPythonBackend()
  createWindow()

  const ready = await waitForPython()
  if (ready) {
    mainWindow?.webContents.send('backend-ready')
    console.log('Python backend is ready')
  } else {
    console.error('Python backend failed to start within timeout')
    mainWindow?.webContents.send('backend-error', 'Python backend failed to start — check that Python 3.10+ and dependencies are installed')
  }
})

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
  app.quit()
})

app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
})
