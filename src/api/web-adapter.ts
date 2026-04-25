import axios from 'axios'
import type { ApiAdapter, ProcessImagePayload } from './types'

const baseUrl = import.meta.env.VITE_API_URL || ''

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const webAdapter: ApiAdapter = {
  async processImage(payload: ProcessImagePayload): Promise<ProcessResult> {
    const res = await axios.post(`${baseUrl}/process`, {
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
    }, { timeout: 300_000 })
    return res.data
  },

  async saveModel(jsonData: string, filename: string): Promise<string> {
    const blob = new Blob([jsonData], { type: 'application/json' })
    triggerDownload(blob, filename)
    return filename
  },

  async saveModelWithTexture(
    jsonData: string,
    texturePngBase64: string,
    filename: string,
  ): Promise<string> {
    const baseName = filename.replace(/\.json$/i, '')
    const textureName = `${baseName}_texture`

    const modelData = JSON.parse(jsonData)
    modelData.textures = { tex: textureName, particle: textureName }
    const jsonBlob = new Blob([JSON.stringify(modelData, null, 2)], { type: 'application/json' })
    triggerDownload(jsonBlob, filename)

    const binaryStr = atob(texturePngBase64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
    const pngBlob = new Blob([bytes], { type: 'image/png' })
    setTimeout(() => triggerDownload(pngBlob, `${textureName}.png`), 100)

    return filename
  },

  async getHealth(): Promise<{ alive: boolean; modelReady: boolean }> {
    try {
      const res = await axios.get(`${baseUrl}/health`, { timeout: 3000 })
      return { alive: true, modelReady: res.data.model_ready ?? false }
    } catch {
      return { alive: false, modelReady: false }
    }
  },

  onBackendReady(_callback: () => void) {},
  onBackendError(_callback: (_event: unknown, msg: string) => void) {},
}
