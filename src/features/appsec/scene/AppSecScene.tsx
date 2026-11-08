import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { useAppSecUi } from '../state/uiStore'
import { CameraRig } from './CameraRig'
import { Ecossistema } from './Ecossistema'
import { COR } from './palette'
import { Projetor } from './Projetor'

function Cursor() {
  const temHover = useAppSecUi((s) => s.hoverId !== null)
  useEffect(() => {
    document.body.style.cursor = temHover ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [temHover])
  return null
}

export default function AppSecScene() {
  const selecionar = useAppSecUi((s) => s.selecionar)
  const limpar = useCallback(() => selecionar(null), [selecionar])
  return (
    <Canvas
      orthographic
      camera={{ position: [150, 160, 150], zoom: 4, near: -1000, far: 2000 }}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[1, 2]}
      onPointerMissed={limpar}
      aria-label="Mapa 3D dos ativos de AppSec"
    >
      <color attach="background" args={[COR.fundo]} />
      <hemisphereLight args={['#FFFFFF', '#C9D1DA', 1.35]} />
      <directionalLight
        position={[60, 120, 40]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-130}
        shadow-camera-right={130}
        shadow-camera-top={130}
        shadow-camera-bottom={-130}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
      <CameraRig />
      <Suspense fallback={null}>
        <Ecossistema />
      </Suspense>
      <Projetor />
      <Cursor />
    </Canvas>
  )
}
