import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { VoxelScene, TexturedModel, GridFloor } from './model-renderers'

interface Props {
  voxels: VoxelData[]
  dimensions: [number, number, number] | null
  modelJson?: MinecraftModel | null
  texturePng?: string | null
}

export default function VoxelPreview({ voxels, dimensions, modelJson, texturePng }: Props) {
  const hasTexturedModel = !!modelJson && !!texturePng && modelJson.elements?.length > 0
  const hasVoxels = voxels.length > 0 && dimensions

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xs font-medium text-mc-text-muted uppercase tracking-wider mb-2">
        3D Preview
      </h2>
      <div className="flex-1 rounded-lg overflow-hidden bg-mc-secondary border border-mc-border relative">
        {(hasTexturedModel || hasVoxels) ? (
          <Canvas gl={{ toneMapping: THREE.NoToneMapping }}>
            <PerspectiveCamera makeDefault position={[20, 15, 20]} fov={50} />
            <OrbitControls enableDamping dampingFactor={0.1} minDistance={5} maxDistance={80} />
            <color attach="background" args={['#f0f0f0']} />
            <ambientLight intensity={2.5} />
            <directionalLight position={[10, 20, 10]} intensity={1.2} />
            <directionalLight position={[-5, 10, -10]} intensity={0.8} />
            {hasTexturedModel ? (
              <TexturedModel modelJson={modelJson!} texturePng={texturePng!} />
            ) : (
              <VoxelScene voxels={voxels} dimensions={dimensions!} />
            )}
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
