import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  processImage: (payload: {
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
  }) => ipcRenderer.invoke('process-image', payload),

  saveModel: (jsonData: string, filename: string) =>
    ipcRenderer.invoke('save-model', jsonData, filename),

  saveModelWithTexture: (jsonData: string, texturePng: string, filename: string) =>
    ipcRenderer.invoke('save-model-with-texture', jsonData, texturePng, filename),

  getHealth: () => ipcRenderer.invoke('check-health') as Promise<{ alive: boolean; modelReady: boolean }>,

  onBackendReady: (callback: () => void) =>
    ipcRenderer.on('backend-ready', callback),

  onBackendError: (callback: (_event: unknown, msg: string) => void) =>
    ipcRenderer.on('backend-error', callback)
})
