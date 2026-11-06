import { ContactShadows, Grid, OrbitControls, Sky } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type * as THREE from 'three'
import { layoutRooms } from '../../lib/layout'
import { overallProgress, stageFractions, unitFraction } from '../../lib/progress'
import type { Project } from '../../types'
import {
  computePillars,
  computeReplicas,
  computeWalls,
  FOUNDATION_DEPTH,
  siteExtent,
  SLAB_THICKNESS,
} from './geometry'
import { UnitModel, type RoofKind, type UnitTargets, type ViewMode } from './UnitModel'

/** O terreno fica no nível do fundo da fundação; a fundação aflora como baldrame. */
const FOUNDATION_OFFSET = FOUNDATION_DEPTH + 0.01

interface Props {
  project: Project
  mode?: ViewMode
  selectedRoomId?: string
  onSelectRoom?: (roomId: string | undefined) => void
  replayKey?: number
  /** Gira a câmera lentamente (cards do painel). */
  autoRotate?: boolean
  interactive?: boolean
}

function Crane({ x, z, height }: { x: number; z: number; height: number }) {
  const jib = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (jib.current) jib.current.rotation.y += delta * 0.25
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[0.6, height, 0.6]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>
      <group ref={jib} position={[0, height, 0]}>
        <mesh position={[4, 0.3, 0]} castShadow>
          <boxGeometry args={[14, 0.4, 0.4]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
        <mesh position={[-3.5, 0.1, 0]}>
          <boxGeometry args={[1.4, 1, 1]} />
          <meshStandardMaterial color="#57534e" />
        </mesh>
        <mesh position={[9, -2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 4.4]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[9, -4.3, 0]}>
          <boxGeometry args={[0.8, 0.4, 0.8]} />
          <meshStandardMaterial color="#78716c" />
        </mesh>
      </group>
    </group>
  )
}

export function BuildingScene({
  project,
  mode = 'obra',
  selectedRoomId,
  onSelectRoom,
  replayKey = 0,
  autoRotate = false,
  interactive = true,
}: Props) {
  const layout = useMemo(() => layoutRooms(project.rooms), [project.rooms])
  const walls = useMemo(() => computeWalls(layout), [layout])
  const pillars = useMemo(() => computePillars(layout), [layout])
  const replicas = useMemo(
    () => computeReplicas(project.type, project.floors, project.units, layout, project.wallHeight),
    [project.type, project.floors, project.units, layout, project.wallHeight],
  )
  const extent = useMemo(() => siteExtent(replicas, layout, project.wallHeight), [replicas, layout, project.wallHeight])

  const roof: RoofKind = project.type === 'casa' || project.type === 'condominio' ? 'gable' : 'flat'
  const fractions = stageFractions(project.stages)
  const total = replicas.length
  const groundCount = replicas.filter((r) => r.isGround).length
  const topCount = replicas.filter((r) => r.isTop).length

  /**
   * Distribui o progresso de cada etapa entre as réplicas em ordem de execução.
   * Fundação só existe no térreo; cobertura só no último pavimento.
   */
  const targetsFor = (r: (typeof replicas)[number]): UnitTargets => {
    const groundIdx = replicas.filter((x) => x.isGround).indexOf(r)
    const topIdx = replicas.filter((x) => x.isTop).indexOf(r)
    const rooms: Record<string, number> = {}
    for (const room of project.rooms) rooms[room.id] = unitFraction(room.progress / 100, r.index, total)
    return {
      stages: {
        fundacao: groundIdx >= 0 ? unitFraction(fractions.fundacao, groundIdx, groundCount) : 0,
        estrutura: unitFraction(fractions.estrutura, r.index, total),
        alvenaria: unitFraction(fractions.alvenaria, r.index, total),
        instalacoes: unitFraction(fractions.instalacoes, r.index, total),
        cobertura: topIdx >= 0 ? unitFraction(fractions.cobertura, topIdx, topCount) : 0,
      },
      rooms,
    }
  }

  const radius = extent.radius
  const cameraPos: [number, number, number] = [radius * 1.9, Math.max(radius * 1.3, extent.maxY * 1.1), radius * 2.1]
  const showCrane = project.type === 'predio' && overallProgress(project.stages) < 100
  const labelsOnIndex = mode === 'status' ? replicas.length - 1 : 0
  const showAnyLabels = interactive && (mode === 'status' || replicas.length === 1)

  return (
    <Canvas
      shadows
      camera={{ position: cameraPos, fov: 45, near: 0.1, far: 2000 }}
      onPointerMissed={() => onSelectRoom?.(undefined)}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#dbeafe']} />
      <Sky sunPosition={[80, 40, 60]} turbidity={6} rayleigh={1.2} />
      <hemisphereLight args={['#ffffff', '#a3a3a3', 0.65]} />
      <directionalLight
        position={[radius * 1.5, radius * 2.5, radius]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-radius * 1.5}
        shadow-camera-right={radius * 1.5}
        shadow-camera-top={radius * 1.5}
        shadow-camera-bottom={-radius * 1.5}
        shadow-camera-far={radius * 8}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -FOUNDATION_OFFSET, 0]} receiveShadow>
        <planeGeometry args={[radius * 8, radius * 8]} />
        <meshStandardMaterial color="#c9b99a" roughness={1} />
      </mesh>
      <Grid
        position={[0, -FOUNDATION_OFFSET + 0.01, 0]}
        args={[radius * 6, radius * 6]}
        cellSize={1}
        sectionSize={5}
        cellColor="#a8977a"
        sectionColor="#8b7a5c"
        fadeDistance={radius * 5}
        infiniteGrid={false}
      />
      <ContactShadows position={[0, -FOUNDATION_OFFSET + 0.02, 0]} scale={radius * 4} opacity={0.35} blur={2.5} far={20} />

      <group position={[0, 0, 0]}>
        {replicas.map((r) => (
          <UnitModel
            key={`${r.floor}-${r.unit}`}
            layout={layout}
            walls={walls}
            pillars={pillars}
            wallHeight={project.wallHeight}
            replica={r}
            targets={targetsFor(r)}
            roof={roof}
            mode={mode}
            selectedRoomId={selectedRoomId}
            onSelectRoom={onSelectRoom}
            showLabels={showAnyLabels && r.index === labelsOnIndex}
            replayKey={replayKey}
          />
        ))}
      </group>

      {showCrane && (
        <Crane
          x={extent.maxX + 3}
          z={-layout.depth / 2 - 2}
          height={project.floors * (project.wallHeight + SLAB_THICKNESS) + 6}
        />
      )}

      <OrbitControls
        makeDefault
        enabled={interactive}
        autoRotate={autoRotate}
        autoRotateSpeed={0.8}
        target={[0, Math.min(extent.maxY / 2, 8), 0]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={3}
        maxDistance={radius * 6}
      />
    </Canvas>
  )
}
