import { useRef, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

interface Props {
  voxels: VoxelData[]
  dimensions: [number, number, number] | null
}

function VoxelScene({ voxels, dimensions }: { voxels: VoxelData[]; dimensions: [number, number, number] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  const data = useMemo(() => {
    const cx = dimensions[0] / 2
    const cy = dimensions[1] / 2
    const cz = dimensions[2] / 2
    const matrices: THREE.Matrix4[] = []
    const colors: THREE.Color[] = []

    let coloredCount = 0
    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i]
      const m = new THREE.Matrix4()
      m.makeTranslation(v.x - cx, v.y - cy, v.z - cz)
      matrices.push(m)

      if (v.color && v.color.length === 7) {
        const color = new THREE.Color(v.color)
        colors.push(color)
        coloredCount++
      } else {
        const ny = v.y / Math.max(dimensions[1], 1)
        const h = 0.58, s = 0.45, l = 0.45 + ny * 0.25
        const color = new THREE.Color()
        color.setHSL(h, s, l)
        colors.push(color)
      }
    }

    console.log(`[VoxelPreview] Total: ${voxels.length}, Colored: ${coloredCount}`)
    if (coloredCount > 0) {
      console.log(`[VoxelPreview] First 3 colors:`, voxels.slice(0, 3).map(v => v.color).filter(Boolean))
    }

    return { matrices, colors }
  }, [voxels, dimensions])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    console.log('[VoxelPreview] Setting up mesh with', data.matrices.length, 'instances')

    for (let i = 0; i < data.matrices.length; i++) {
      mesh.setMatrixAt(i, data.matrices[i])
      mesh.setColorAt(i, data.colors[i])
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }

    console.log('[VoxelPreview] Setup complete, has instanceColor:', !!mesh.instanceColor)
  }, [data])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, voxels.length]} key={voxels.length}>
      <boxGeometry args={[0.95, 0.95, 0.95]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

function GridFloor() {
  return (
    <gridHelper args={[32, 32, '#d6d6d6', '#ececec']} position={[0, -0.5, 0]} />
  )
}

export default function VoxelPreview({ voxels, dimensions }: Props) {
  const hasData = voxels.length > 0 && dimensions

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xs font-medium text-mc-text-muted uppercase tracking-wider mb-2">
        3D Preview
      </h2>
      <div className="flex-1 rounded-lg overflow-hidden bg-mc-secondary border border-mc-border relative">
        {hasData ? (
          <Canvas
            gl={{ toneMapping: THREE.NoToneMapping }}
          >
            <PerspectiveCamera makeDefault position={[20, 15, 20]} fov={50} />
            <OrbitControls enableDamping dampingFactor={0.1} minDistance={5} maxDistance={80} />
            <color attach="background" args={['#f0f0f0']} />
            <ambientLight intensity={2.5} />
            <directionalLight position={[10, 20, 10]} intensity={1.2} />
            <directionalLight position={[-5, 10, -10]} intensity={0.8} />
            <VoxelScene voxels={voxels} dimensions={dimensions} />
            <GridFloor />
          </Canvas>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="mb-3">
                <svg className="w-14 h-14 mx-auto text-mc-border" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-mc-text-muted text-sm">
                Upload an image and generate to preview
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
