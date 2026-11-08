import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback } from 'react'
import * as THREE from 'three'
import { useObraData } from '../data/store'
import { useCanteiroStore } from '../state/canteiroStore'
import { useSelecionar } from '../state/useSelecionar'
import { AssetsProvider } from './assets'
import { Building } from './Building'
import { CameraRig } from './CameraRig'
import { Crane } from './Crane'
import { Machines } from './Machines'
import { COR } from './palette'
import { PinProjector } from './PinProjector'
import { CursorDaCena } from './Selectable'
import { Site } from './Site'
import { Vehicles } from './Vehicles'
import { Workers } from './Workers'

/** Canteiro do dia: caminhões e equipes só existem "hoje"; o 4D mostra só o prédio. */
function Cena() {
  const obraId = useCanteiroStore((s) => s.obraId)
  const semanaAtual = useObraData((d) => d.obra.semanaAtual)
  const isHoje = useCanteiroStore((s) => s.semana === null || Math.abs(s.semana - semanaAtual) < 0.05)
  return (
    <AssetsProvider>
      <group key={obraId}>
        <Site />
        <Building />
        <Crane />
        <Machines />
        {isHoje && <Vehicles />}
        {isHoje && <Workers />}
      </group>
    </AssetsProvider>
  )
}

function Luzes() {
  return (
    <>
      <hemisphereLight args={['#FFFFFF', COR.cimento, 1.25]} />
      <directionalLight
        position={[38, 70, 30]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-radius={4}
      />
    </>
  )
}

export default function CanteiroScene() {
  const selecionar = useSelecionar()
  const limpar = useCallback(() => selecionar(null), [selecionar])
  return (
    <Canvas
      orthographic
      camera={{ position: [80, 90, 80], zoom: 10, near: -400, far: 1200 }}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      onPointerMissed={limpar}
      aria-label="Vista 3D do canteiro de obras"
    >
      <color attach="background" args={['#E7EAEE']} />
      <Luzes />
      <CameraRig />
      <Suspense fallback={null}>
        <Cena />
      </Suspense>
      <PinProjector />
      <CursorDaCena />
    </Canvas>
  )
}
