import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../api'

export interface GenerationParams {
  resolution: number
  extrusionMode: 'flat' | 'rounded'
  depthRatio: number
  enableColor: boolean
  textureResolution: number
  symmetrical: boolean
  rotationX: number
  rotationY: number
  rotationZ: number
}

export interface ImageSession {
  id: string
  imageData: string
  imageName: string
  voxels: VoxelData[]
  modelJson: MinecraftModel | null
  texturePng: string | null
  stats: { elementCount: number; dimensions: [number, number, number] } | null
  isProcessing: boolean
  error: string | null
  params: GenerationParams
}

const DEFAULT_PARAMS: GenerationParams = {
  resolution: 16,
  extrusionMode: 'rounded',
  depthRatio: 0.5,
  enableColor: false,
  textureResolution: 8,
  symmetrical: false,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
}

let nextId = 1
function createSession(): ImageSession {
  return {
    id: String(nextId++),
    imageData: '',
    imageName: '',
    voxels: [],
    modelJson: null,
    texturePng: null,
    stats: null,
    isProcessing: false,
    error: null,
    params: { ...DEFAULT_PARAMS },
  }
}

export function useModelGeneration() {
  const [sessions, setSessions] = useState<ImageSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [backendReady, setBackendReady] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const active = sessions.find((s) => s.id === activeSessionId) ?? null

  useEffect(() => {
    api.onBackendReady(() => setBackendReady(true))
    api.onBackendError(() => {})

    const poll = () => {
      api.getHealth().then((status) => {
        if (status.alive && status.modelReady) {
          setBackendReady(true)
          setModelReady(true)
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        } else if (status.alive) {
          setBackendReady(true)
        }
      }).catch(() => {})
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

  const updateSessionById = useCallback((id: string, updater: (s: ImageSession) => ImageSession) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)))
  }, [])

  const ensureSession = useCallback(() => {
    if (!activeSessionId) {
      const session = createSession()
      setSessions((prev) => [...prev, session])
      setActiveSessionId(session.id)
      return session.id
    }
    return activeSessionId
  }, [activeSessionId])

  const addImage = useCallback((data: string, name: string) => {
    const id = ensureSession()
    updateSessionById(id, (s) => ({ ...s, imageData: data, imageName: name }))
  }, [ensureSession, updateSessionById])

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id)
  }, [])

  const closeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id)
      const next = prev.filter((s) => s.id !== id)
      if (id === activeSessionId) {
        if (next.length === 0) {
          setActiveSessionId(null)
        } else {
          const newIdx = Math.min(idx, next.length - 1)
          setActiveSessionId(next[newIdx].id)
        }
      }
      return next
    })
  }, [activeSessionId])

  const generate = useCallback(async () => {
    if (!active?.imageData) return
    const sessionId = active.id
    const p = active.params

    updateSessionById(sessionId, (s) => ({ ...s, isProcessing: true, error: null }))

    try {
      const result = await api.processImage({
        imageData: active.imageData,
        resolution: p.resolution,
        extrusionMode: p.extrusionMode,
        depthRatio: p.depthRatio,
        enableColor: p.enableColor,
        textureResolution: p.textureResolution,
        symmetrical: p.symmetrical,
        rotationX: p.rotationX,
        rotationY: p.rotationY,
        rotationZ: p.rotationZ,
      })

      updateSessionById(sessionId, (s) => ({
        ...s,
        voxels: result.voxels,
        modelJson: result.model_json,
        texturePng: result.texture_png ?? null,
        stats: result.stats,
        isProcessing: false
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      updateSessionById(sessionId, (s) => ({ ...s, isProcessing: false, error: message }))
    }
  }, [active, updateSessionById])

  const exportModel = useCallback(async () => {
    if (!active?.modelJson) return

    const jsonStr = JSON.stringify(active.modelJson, null, 2)
    const baseName = active.imageName.replace(/\.[^.]+$/, '') || 'model'

    if (active.texturePng) {
      await api.saveModelWithTexture(jsonStr, active.texturePng, `${baseName}.json`)
    } else {
      await api.saveModel(jsonStr, `${baseName}.json`)
    }
  }, [active])

  const updateParams = useCallback((updates: Partial<GenerationParams>) => {
    const id = ensureSession()
    updateSessionById(id, (s) => ({ ...s, params: { ...s.params, ...updates } }))
  }, [ensureSession, updateSessionById])

  return {
    imageData: active?.imageData || null,
    imageName: active?.imageName || null,
    voxels: active?.voxels ?? [],
    modelJson: active?.modelJson ?? null,
    texturePng: active?.texturePng ?? null,
    stats: active?.stats ?? null,
    isProcessing: active?.isProcessing ?? false,
    error: active?.error ?? null,
    backendReady,
    modelReady,
    params: active?.params ?? DEFAULT_PARAMS,
    sessions,
    activeSessionId,
    addImage,
    switchSession,
    closeSession,
    generate,
    exportModel,
    updateParams
  }
}
