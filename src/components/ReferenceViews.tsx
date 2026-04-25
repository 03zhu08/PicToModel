import { useEffect } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { VoxelScene, TexturedModel } from './model-renderers'

interface Props {
  voxels: VoxelData[]
  dimensions: [number, number, number] | null
  modelJson?: MinecraftModel | null
  texturePng?: string | null
}

type OrthoDir = 'front' | 'right' | 'top'

const DIR_META: Record<OrthoDir, { position: [number, number, number]; up: [number, number, number] }> = {
  front: { position: [0, 0, -1], up: [0, 1, 0] },
  right: { position: [1, 0, 0], up: [0, 1, 0] },
  top:   { position: [0, 1, 0], up: [0, 0, 1] },
}

const LABELS: Record<OrthoDir, string> = {
  front: 'Front',
  right: 'Right',
  top: 'Top',
}

function OrthoCameraSetup({ direction, dimensions }: { direction: OrthoDir; dimensions: [number, number, number] }) {
  const { camera, size } = useThree()

  useEffect(() => {
    const [sx, sy, sz] = dimensions
    const maxDim = Math.max(sx, sy, sz)
    const half = maxDim * 0.75
    const aspect = size.width / size.height

    // orthographic frustum
    let left: number, right: number, top: number, bottom: number
    if (aspect >= 1) {
      left = -half * aspect
      right = half * aspect
      bottom = -half
      top = half
    } else {
      left = -half
      right = half
      bottom = -half / aspect
      top = half / aspect
    }

    const ortho = camera as THREE.OrthographicCamera
    ortho.left = left
    ortho.right = right
    ortho.top = top
    ortho.bottom = bottom
    ortho.near = 0.1
    ortho.far = maxDim * 10

    const dist = maxDim * 3
    const meta = DIR_META[direction]
    const cy = sy / 2
    ortho.position.set(
      meta.position[0] * dist,
      meta.position[1] * dist + cy,
      meta.position[2] * dist,
    )
    ortho.lookAt(0, cy, 0)
    ortho.updateProjectionMatrix()
  }, [camera, direction, dimensions, size])

  return null
}

function ModelContent({ voxels, dimensions, modelJson, texturePng }: Props) {
  const hasTexturedModel = !!modelJson && !!texturePng && modelJson.elements?.length > 0

  if (hasTexturedModel) {
    return <TexturedModel modelJson={modelJson!} texturePng={texturePng!} />
  }
  if (voxels.length > 0 && dimensions) {
    return <VoxelScene voxels={voxels} dimensions={dimensions} />
  }
  return null
}

export default function ReferenceViews({ voxels, dimensions, modelJson, texturePng }: Props) {
  const hasModel = (voxels.length > 0 && dimensions) || (!!modelJson && !!texturePng && modelJson.elements?.length > 0)

  if (!hasModel) return null

  const dims = dimensions || [16, 16, 16] as [number, number, number]

  return (
    <div className="shrink-0 border-t border-mc-border bg-white px-4 py-2">
      <div className="flex gap-3 justify-center">
        {(Object.keys(DIR_META) as OrthoDir[]).map((dir) => (
          <div key={dir} className="flex flex-col items-center gap-1">
            <div className="w-[140px] h-[140px] rounded border border-mc-border overflow-hidden bg-[#f0f0f0]">
              <Canvas orthographic gl={{ toneMapping: THREE.NoToneMapping }}>
                <OrthoCameraSetup direction={dir} dimensions={dims} />
                <ambientLight intensity={2.5} />
                <directionalLight position={[10, 20, 10]} intensity={1.2} />
                <ModelContent
                  voxels={voxels}
                  dimensions={dimensions}
                  modelJson={modelJson}
                  texturePng={texturePng}
                />
              </Canvas>
            </div>
            <span className="text-[10px] text-mc-text-muted font-medium">{LABELS[dir]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
