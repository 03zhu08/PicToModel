/// <reference types="vite/client" />

interface Window {
  api: {
    processImage: (payload: {
      imageData: string
      resolution: number
      extrusionMode: string
      depthRatio: number
      enableColor: boolean
    }) => Promise<ProcessResult>
    saveModel: (jsonData: string, filename: string) => Promise<string>
    saveModelWithTexture: (
      jsonData: string,
      texturePng: string,
      filename: string
    ) => Promise<string>
    getHealth: () => Promise<{ alive: boolean; modelReady: boolean }>
    onBackendReady: (callback: () => void) => void
    onBackendError: (callback: (_event: unknown, msg: string) => void) => void
  }
}

interface VoxelData {
  x: number
  y: number
  z: number
  color?: string
}

interface ProcessResult {
  voxels: VoxelData[]
  model_json: MinecraftModel
  stats: {
    elementCount: number
    dimensions: [number, number, number]
  }
  texture_png: string | null
}

interface MinecraftModelFace {
  texture: string
  uv?: [number, number, number, number]
}

interface MinecraftModelElement {
  from: [number, number, number]
  to: [number, number, number]
  faces: {
    north?: MinecraftModelFace
    south?: MinecraftModelFace
    east?: MinecraftModelFace
    west?: MinecraftModelFace
    up?: MinecraftModelFace
    down?: MinecraftModelFace
  }
}

interface MinecraftModel {
  textures: Record<string, string>
  elements: MinecraftModelElement[]
  display?: Record<string, unknown>
}
