import { useState, useCallback, useEffect, useRef } from 'react'

export interface GenerationParams {
  resolution: number
  extrusionMode: 'flat' | 'rounded'
  depthRatio: number
  enableColor: boolean
  textureResolution: number
}

interface ModelState {
  imageData: string | null
  imageName: string | null
  voxels: VoxelData[]
  modelJson: MinecraftModel | null
  texturePng: string | null
  stats: { elementCount: number; dimensions: [number, number, number] } | null
  isProcessing: boolean
  error: string | null
  backendReady: boolean
  modelReady: boolean
}

const DEFAULT_PARAMS: GenerationParams = {
  resolution: 16,
  extrusionMode: 'rounded',
  depthRatio: 0.4,
  enableColor: false,
  textureResolution: 8
}

export function useModelGeneration() {
  const [state, setState] = useState<ModelState>({
    imageData: null,
    imageName: null,
    voxels: [],
    modelJson: null,
    texturePng: null,
    stats: null,
    isProcessing: false,
    error: null,
    backendReady: false,
    modelReady: false
  })

  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    window.api.onBackendReady(() => {
      setState((s) => ({ ...s, backendReady: true }))
    })
    window.api.onBackendError((_e, msg) => {
      setState((s) => ({ ...s, error: `Backend: ${msg}` }))
    })

    const poll = () => {
      window.api.getHealth().then((status) => {
        if (status.alive && status.modelReady) {
          setState((s) => ({ ...s, backendReady: true, modelReady: true }))
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        } else if (status.alive) {
          setState((s) => ({ ...s, backendReady: true }))
        }
      }).catch(() => { /* ignore */ })
    }

    poll()
    intervalRef.current = setInterval(poll, 2000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  const setImage = useCallback((data: string, name: string) => {
    setState((s) => ({
      ...s,
      imageData: data,
      imageName: name,
      voxels: [],
      modelJson: null,
      texturePng: null,
      stats: null,
      error: null
    }))
  }, [])

  const generate = useCallback(async () => {
    if (!state.imageData) return

    setState((s) => ({ ...s, isProcessing: true, error: null }))

    try {
      const result = await window.api.processImage({
        imageData: state.imageData,
        resolution: params.resolution,
        extrusionMode: params.extrusionMode,
        depthRatio: params.depthRatio,
        enableColor: params.enableColor,
        textureResolution: params.textureResolution
      })

      setState((s) => ({
        ...s,
        voxels: result.voxels,
        modelJson: result.model_json,
        texturePng: result.texture_png ?? null,
        stats: result.stats,
        isProcessing: false
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setState((s) => ({ ...s, isProcessing: false, error: message }))
    }
  }, [state.imageData, params])

  const exportModel = useCallback(async () => {
    if (!state.modelJson) return

    const jsonStr = JSON.stringify(state.modelJson, null, 2)
    const baseName = state.imageName
      ? state.imageName.replace(/\.[^.]+$/, '')
      : 'model'

    if (state.texturePng) {
      await window.api.saveModelWithTexture(jsonStr, state.texturePng, `${baseName}.json`)
    } else {
      await window.api.saveModel(jsonStr, `${baseName}.json`)
    }
  }, [state.modelJson, state.texturePng, state.imageName])

  const updateParams = useCallback((updates: Partial<GenerationParams>) => {
    setParams((p) => ({ ...p, ...updates }))
  }, [])

  return {
    ...state,
    params,
    setImage,
    generate,
    exportModel,
    updateParams
  }
}
