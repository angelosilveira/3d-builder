import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ROOM_FLOOR_COLOR } from '../../lib/catalog'
import type { FloorPlanLayout } from '../../lib/layout'
import type { StageId } from '../../types'
import { RoomLabel } from './RoomLabel'
import {
  FOUNDATION_DEPTH,
  SLAB_THICKNESS,
  WALL_THICKNESS,
  type Replica,
  type WallSegment,
} from './geometry'

export type ViewMode = 'obra' | 'status'
export type RoofKind = 'gable' | 'flat'

/** Frações (0–1) já distribuídas para esta réplica. */
export interface UnitTargets {
  stages: Record<Exclude<StageId, 'acabamento'>, number>
  /** Acabamento por cômodo (id → 0–1). */
  rooms: Record<string, number>
}

interface Props {
  layout: FloorPlanLayout
  walls: WallSegment[]
  pillars: [number, number][]
  wallHeight: number
  replica: Replica
  targets: UnitTargets
  roof: RoofKind
  mode: ViewMode
  selectedRoomId?: string
  onSelectRoom?: (roomId: string) => void
  showLabels: boolean
  replayKey: number
}

const BRICK = new THREE.Color('#b5532e')
const PAINT = new THREE.Color('#f3efe6')
const STATUS_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'].map((c) => new THREE.Color(c))

export function statusColor(fraction: number): THREE.Color {
  if (fraction >= 0.999) return STATUS_COLORS[3]
  const t = Math.min(1, Math.max(0, fraction)) * 2
  const i = Math.min(1, Math.floor(t))
  return STATUS_COLORS[i].clone().lerp(STATUS_COLORS[i + 1], t - i)
}

const damp = (current: number, target: number, delta: number) =>
  THREE.MathUtils.damp(current, target, 3.5, delta)

const setGrow = (obj: THREE.Object3D | null, value: number, axis: 'y' | 'xz' | 'z' = 'y') => {
  if (!obj) return
  const v = Math.max(value, 0.0001)
  obj.visible = value > 0.002
  if (axis === 'y') obj.scale.y = v
  else if (axis === 'z') obj.scale.z = v
  else obj.scale.set(v, 1, v)
}

export function UnitModel({
  layout,
  walls,
  pillars,
  wallHeight: H,
  replica,
  targets,
  roof,
  mode,
  selectedRoomId,
  onSelectRoom,
  showLabels,
  replayKey,
}: Props) {
  const W = layout.width
  const D = layout.depth
  const status = mode === 'status'

  const foundationRef = useRef<THREE.Group>(null)
  const pillarsRef = useRef<THREE.Group>(null)
  const slabRef = useRef<THREE.Group>(null)
  const wallsRef = useRef<THREE.Group>(null)
  const pipesRef = useRef<THREE.Group>(null)
  const roofRef = useRef<THREE.Group>(null)
  const openingsRef = useRef<THREE.Group>(null)
  const finishRefs = useRef<Record<string, THREE.Mesh | null>>({})

  const wallMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: BRICK.clone(), roughness: 0.85 }),
    [],
  )
  useEffect(() => () => wallMaterial.dispose(), [wallMaterial])

  // Valores exibidos (animados) — começam em zero e "constroem" até o alvo.
  const current = useRef({ stages: { fundacao: 0, estrutura: 0, alvenaria: 0, instalacoes: 0, cobertura: 0 }, rooms: {} as Record<string, number> })
  useEffect(() => {
    current.current = { stages: { fundacao: 0, estrutura: 0, alvenaria: 0, instalacoes: 0, cobertura: 0 }, rooms: {} }
  }, [replayKey])

  // Pequeno atraso por réplica para a obra "subir" em sequência na animação.
  const delay = useRef(0)
  useEffect(() => {
    delay.current = Math.min(replica.index * 0.08, 2.5)
  }, [replica.index, replayKey])

  useFrame((_, delta) => {
    if (delay.current > 0) {
      delay.current -= delta
      return
    }
    const c = current.current
    const t = targets
    for (const k of Object.keys(t.stages) as (keyof UnitTargets['stages'])[]) {
      c.stages[k] = damp(c.stages[k], t.stages[k], delta)
    }
    let finishSum = 0
    let finishCount = 0
    for (const [id, target] of Object.entries(t.rooms)) {
      c.rooms[id] = damp(c.rooms[id] ?? 0, target, delta)
      setGrow(finishRefs.current[id] ?? null, status ? 0 : c.rooms[id], 'xz')
      finishSum += c.rooms[id]
      finishCount++
    }
    const avgFinish = finishCount ? finishSum / finishCount : 0

    setGrow(foundationRef.current, replica.isGround ? c.stages.fundacao : 0)
    setGrow(pillarsRef.current, c.stages.estrutura)
    setGrow(slabRef.current, status ? 0 : THREE.MathUtils.clamp((c.stages.estrutura - 0.6) / 0.4, 0, 1), 'xz')
    setGrow(wallsRef.current, c.stages.alvenaria)
    setGrow(pipesRef.current, c.stages.instalacoes)
    setGrow(roofRef.current, status || !replica.isTop ? 0 : c.stages.cobertura, roof === 'gable' ? 'z' : 'xz')
    setGrow(openingsRef.current, status ? 0 : THREE.MathUtils.clamp((avgFinish - 0.3) / 0.5, 0, 1) * c.stages.alvenaria)

    if (wallMaterial.transparent !== status) {
      wallMaterial.transparent = status
      wallMaterial.opacity = status ? 0.22 : 1
      wallMaterial.depthWrite = !status
      wallMaterial.needsUpdate = true
    }
    if (status) wallMaterial.color.set('#94a3b8')
    else wallMaterial.color.lerpColors(BRICK, PAINT, avgFinish)
  })

  const handleRoomClick = (roomId: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelectRoom?.(roomId)
  }

  const roofGeometry = useMemo(() => {
    if (roof !== 'gable') return null
    const long = Math.max(W, D)
    const short = Math.min(W, D)
    const eave = 0.45
    const pitch = Math.max(0.9, short * 0.32)
    const shape = new THREE.Shape()
    shape.moveTo(-short / 2 - eave, 0)
    shape.lineTo(short / 2 + eave, 0)
    shape.lineTo(0, pitch)
    shape.closePath()
    const geom = new THREE.ExtrudeGeometry(shape, { depth: long + eave * 2, bevelEnabled: false })
    geom.translate(0, 0, -(long + eave * 2) / 2)
    return geom
  }, [roof, W, D])
  useEffect(() => () => roofGeometry?.dispose(), [roofGeometry])

  return (
    <group position={replica.position}>
      {/* Fundação: radier/sapatas sob a projeção da planta */}
      <group ref={foundationRef} position={[0, 0, 0]}>
        <mesh position={[0, -FOUNDATION_DEPTH / 2 + 0.01, 0]} receiveShadow>
          <boxGeometry args={[W + 0.5, FOUNDATION_DEPTH, D + 0.5]} />
          <meshStandardMaterial color="#8d8a84" roughness={1} />
        </mesh>
      </group>

      {/* Contrapiso clicável por cômodo + piso acabado que "se espalha".
          Em pavimentos superiores, o piso só existe depois que a estrutura começa. */}
      {(replica.isGround || targets.stages.estrutura > 0) &&
        layout.rooms.map((room) => {
        const cx = room.x + room.width / 2
        const cz = room.z + room.depth / 2
        const fraction = targets.rooms[room.id] ?? 0
        const selected = selectedRoomId === room.id
        return (
          <group key={room.id} position={[cx, 0, cz]}>
            <mesh
              position={[0, 0.02, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
              onClick={handleRoomClick(room.id)}
              onPointerOver={(e) => {
                e.stopPropagation()
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => (document.body.style.cursor = '')}
            >
              <planeGeometry args={[room.width - 0.02, room.depth - 0.02]} />
              <meshStandardMaterial
                color={status ? statusColor(fraction) : '#a8a29e'}
                emissive={selected ? '#facc15' : '#000000'}
                emissiveIntensity={selected ? 0.45 : 0}
              />
            </mesh>
            <mesh
              ref={(m) => {
                finishRefs.current[room.id] = m
              }}
              position={[0, 0.035, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
              raycast={() => null}
            >
              <planeGeometry args={[room.width - 0.1, room.depth - 0.1]} />
              <meshStandardMaterial color={ROOM_FLOOR_COLOR[room.kind]} roughness={0.6} />
            </mesh>
            {selected && (
              <mesh position={[0, H / 2, 0]} raycast={() => null}>
                <boxGeometry args={[room.width, H, room.depth]} />
                <meshBasicMaterial color="#facc15" transparent opacity={0.16} depthWrite={false} />
              </mesh>
            )}
            {showLabels && (
              <RoomLabel
                position={[0, status ? 0.6 : H + 0.5, 0]}
                title={room.name}
                value={`${Math.round(fraction * 100)}%`}
                selected={selected}
                onClick={() => onSelectRoom?.(room.id)}
              />
            )}
          </group>
        )
        })}

      {/* Estrutura: pilares de concreto */}
      <group ref={pillarsRef}>
        {pillars.map(([x, z], i) => (
          <mesh key={i} position={[x, H / 2, z]} castShadow>
            <boxGeometry args={[0.2, H, 0.2]} />
            <meshStandardMaterial color="#9ca3af" roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Estrutura: laje superior */}
      <group ref={slabRef} position={[0, H, 0]}>
        <mesh position={[0, SLAB_THICKNESS / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[W + 0.2, SLAB_THICKNESS, D + 0.2]} />
          <meshStandardMaterial color="#a3a3a3" roughness={0.95} />
        </mesh>
      </group>

      {/* Alvenaria: paredes que sobem conforme o avanço */}
      <group ref={wallsRef}>
        {walls.map((w, i) => {
          const len = w.to - w.from + WALL_THICKNESS
          const mid = (w.from + w.to) / 2
          return (
            <mesh
              key={i}
              position={w.orientation === 'h' ? [mid, H / 2, w.at] : [w.at, H / 2, mid]}
              material={wallMaterial}
              castShadow
              receiveShadow
              raycast={status ? () => null : undefined}
            >
              <boxGeometry
                args={w.orientation === 'h' ? [len, H, WALL_THICKNESS] : [WALL_THICKNESS, H, len]}
              />
            </mesh>
          )
        })}
      </group>

      {/* Esquadrias: janelas nas fachadas, aparecem no acabamento */}
      <group ref={openingsRef}>
        {walls
          .filter((w) => w.exterior && w.to - w.from > 1.8)
          .map((w, i) => {
            const mid = (w.from + w.to) / 2
            const out = (w.at > 0 ? 1 : -1) * (WALL_THICKNESS / 2 + 0.02)
            const size: [number, number, number] =
              w.orientation === 'h' ? [1.2, 1.1, 0.05] : [0.05, 1.1, 1.2]
            const pos: [number, number, number] =
              w.orientation === 'h' ? [mid, H * 0.58, w.at + out] : [w.at + out, H * 0.58, mid]
            return (
              <mesh key={i} position={pos}>
                <boxGeometry args={size} />
                <meshStandardMaterial color="#7dd3fc" metalness={0.3} roughness={0.1} transparent opacity={0.85} />
              </mesh>
            )
          })}
      </group>

      {/* Instalações: tubulação hidráulica (azul) e eletrodutos (laranja) */}
      <group ref={pipesRef}>
        {layout.rooms.map((room) => {
          const wet = room.kind === 'banheiro' || room.kind === 'cozinha' || room.kind === 'area_servico'
          return (
            <group key={room.id}>
              {wet && (
                <mesh position={[room.x + 0.25, H / 2, room.z + 0.25]}>
                  <cylinderGeometry args={[0.05, 0.05, H, 8]} />
                  <meshStandardMaterial color="#2563eb" />
                </mesh>
              )}
              <mesh position={[room.x + room.width - 0.25, H / 2, room.z + room.depth - 0.25]}>
                <cylinderGeometry args={[0.03, 0.03, H, 6]} />
                <meshStandardMaterial color="#f97316" />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* Cobertura: telhado de duas águas (casas) ou laje impermeabilizada (prédios) */}
      <group
        ref={roofRef}
        position={[0, H + SLAB_THICKNESS, 0]}
        rotation={[0, roof === 'gable' && W >= D ? Math.PI / 2 : 0, 0]}
      >
        {roof === 'gable' && roofGeometry ? (
          <mesh geometry={roofGeometry} castShadow>
            <meshStandardMaterial color="#9a3412" roughness={0.7} />
          </mesh>
        ) : (
          <mesh position={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[W + 0.2, 0.24, D + 0.2]} />
            <meshStandardMaterial color="#475569" roughness={0.8} />
          </mesh>
        )}
      </group>
    </group>
  )
}
