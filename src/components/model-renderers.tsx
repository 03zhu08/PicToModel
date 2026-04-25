import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'

/* ── TexturedModel (colored Minecraft model) ─────────────────────── */

export function TexturedModel({ modelJson, texturePng }: { modelJson: MinecraftModel; texturePng: string }) {
  const groupRef = useRef<THREE.Group>(null!)

  const texture = useMemo(() => {
    const img = new Image()
    const tex = new THREE.Texture(img)
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.colorSpace = THREE.SRGBColorSpace
    img.onload = () => { tex.needsUpdate = true }
    img.src = `data:image/png;base64,${texturePng}`
    return tex
  }, [texturePng])

  const elements = useMemo(() => {
    if (!modelJson.elements) return []
    return modelJson.elements.map((el: MinecraftModelElement) => {
      const from = el.from
      const to = el.to
      const sx = to[0] - from[0]
      const sy = to[1] - from[1]
      const sz = to[2] - from[2]
      const cx = (from[0] + to[0]) / 2 - 16
      const cy = (from[1] + to[1]) / 2
      const cz = (from[2] + to[2]) / 2 - 16
      return { from, to, sx, sy, sz, cx, cy, cz, faces: el.faces }
    })
  }, [modelJson])

  return (
    <group ref={groupRef}>
      {elements.map((el, idx) => (
        <TexturedBox key={idx} el={el} texture={texture} />
      ))}
    </group>
  )
}

function TexturedBox({ el, texture }: {
  el: { sx: number; sy: number; sz: number; cx: number; cy: number; cz: number; faces: MinecraftModelElement['faces'] }
  texture: THREE.Texture
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(el.sx, el.sy, el.sz)
    const uvAttr = geo.attributes.uv as THREE.BufferAttribute
    const uvArray = uvAttr.array as Float32Array

    const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north']

    for (let i = 0; i < 6; i++) {
      const faceName = faceOrder[i] as keyof MinecraftModelElement['faces']
      const faceData = el.faces[faceName]
      if (!faceData?.uv) continue

      const [u1, v1, u2, v2] = faceData.uv
      const nu1 = u1 / 16
      const nv1 = v1 / 16
      const nu2 = u2 / 16
      const nv2 = v2 / 16

      const tv1 = 1 - nv1
      const tv2 = 1 - nv2

      const base = i * 8
      uvArray[base + 0] = nu1;  uvArray[base + 1] = tv1
      uvArray[base + 2] = nu2;  uvArray[base + 3] = tv1
      uvArray[base + 4] = nu1;  uvArray[base + 5] = tv2
      uvArray[base + 6] = nu2;  uvArray[base + 7] = tv2
    }

    uvAttr.needsUpdate = true
    return geo
  }, [el])

  return (
    <mesh geometry={geometry} position={[el.cx, el.cy, el.cz]}>
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

/* ── VoxelScene (colored voxel cubes) ────────────────────────────── */

export function VoxelScene({ voxels, dimensions }: { voxels: VoxelData[]; dimensions: [number, number, number] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  const data = useMemo(() => {
    const cx = dimensions[0] / 2
    const cy = dimensions[1] / 2
    const cz = dimensions[2] / 2
    const matrices: THREE.Matrix4[] = []
    const colors: THREE.Color[] = []

    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i]
      const m = new THREE.Matrix4()
      m.makeTranslation(v.x - cx, v.y - cy, v.z - cz)
      matrices.push(m)

      if (v.color && v.color.length === 7) {
        colors.push(new THREE.Color(v.color))
      } else {
        const ny = v.y / Math.max(dimensions[1], 1)
        const color = new THREE.Color()
        color.setHSL(0.58, 0.45, 0.45 + ny * 0.25)
        colors.push(color)
      }
    }
    return { matrices, colors }
  }, [voxels, dimensions])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < data.matrices.length; i++) {
      mesh.setMatrixAt(i, data.matrices[i])
      mesh.setColorAt(i, data.colors[i])
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [data])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, voxels.length]} key={voxels.length}>
      <boxGeometry args={[0.95, 0.95, 0.95]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

/* ── GridFloor ───────────────────────────────────────────────────── */

export function GridFloor() {
  const labelRef = useRef<THREE.Mesh>(null!)

  const textTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ff4444'
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('N', 32, 32)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }, [])

  return (
    <>
      <gridHelper args={[32, 32, '#d6d6d6', '#ececec']} position={[0, -0.5, 0]} />
      <mesh ref={labelRef} position={[0, -0.4, -18]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 3]} />
        <meshBasicMaterial map={textTexture} transparent toneMapped={false} />
      </mesh>
      <arrowHelper args={[
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, -0.4, -14),
        3,
        0xff4444,
        1,
        0.6
      ]} />
    </>
  )
}
