export interface ProcessImagePayload {
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
}

export interface ApiAdapter {
  processImage: (payload: ProcessImagePayload) => Promise<ProcessResult>
  saveModel: (jsonData: string, filename: string) => Promise<string>
  saveModelWithTexture: (jsonData: string, texturePng: string, filename: string) => Promise<string>
  getHealth: () => Promise<{ alive: boolean; modelReady: boolean }>
  onBackendReady: (callback: () => void) => void
  onBackendError: (callback: (_event: unknown, msg: string) => void) => void
}
