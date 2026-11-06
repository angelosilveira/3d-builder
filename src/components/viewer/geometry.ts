import type { FloorPlanLayout } from '../../lib/layout'
import type { BuildingType } from '../../types'

export const WALL_THICKNESS = 0.14
export const SLAB_THICKNESS = 0.2
export const FOUNDATION_DEPTH = 0.35

export interface WallSegment {
  orientation: 'h' | 'v'
  /** Coordenada fixa (z para horizontal, x para vertical). */
  at: number
  from: number
  to: number
  /** Parede na fachada (limite externo da planta). */
  exterior: boolean
}

const key = (n: number) => Math.round(n * 1000) / 1000

function unionIntervals(intervals: [number, number][]): [number, number][] {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a <= last[1] + 1e-6) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

/**
 * Converte os cômodos em segmentos de parede sem sobreposição: paredes
 * compartilhadas entre cômodos vizinhos viram um único segmento (evita
 * z-fighting e duplicidade no cálculo visual).
 */
export function computeWalls(layout: FloorPlanLayout): WallSegment[] {
  const horizontal = new Map<number, [number, number][]>()
  const vertical = new Map<number, [number, number][]>()
  const add = (map: Map<number, [number, number][]>, at: number, a: number, b: number) => {
    const k = key(at)
    const list = map.get(k) ?? []
    list.push([a, b])
    map.set(k, list)
  }

  for (const r of layout.rooms) {
    add(horizontal, r.z, r.x, r.x + r.width)
    add(horizontal, r.z + r.depth, r.x, r.x + r.width)
    add(vertical, r.x, r.z, r.z + r.depth)
    add(vertical, r.x + r.width, r.z, r.z + r.depth)
  }

  const halfW = layout.width / 2
  const halfD = layout.depth / 2
  const segments: WallSegment[] = []
  for (const [at, list] of horizontal) {
    for (const [from, to] of unionIntervals(list)) {
      segments.push({ orientation: 'h', at, from, to, exterior: Math.abs(Math.abs(at) - halfD) < 1e-3 })
    }
  }
  for (const [at, list] of vertical) {
    for (const [from, to] of unionIntervals(list)) {
      segments.push({ orientation: 'v', at, from, to, exterior: Math.abs(Math.abs(at) - halfW) < 1e-3 })
    }
  }
  return segments
}

/** Pontos únicos de cantos dos cômodos — onde ficam os pilares. */
export function computePillars(layout: FloorPlanLayout): [number, number][] {
  const seen = new Map<string, [number, number]>()
  for (const r of layout.rooms) {
    for (const [x, z] of [
      [r.x, r.z],
      [r.x + r.width, r.z],
      [r.x, r.z + r.depth],
      [r.x + r.width, r.z + r.depth],
    ]) {
      seen.set(`${key(x)}:${key(z)}`, [x, z])
    }
  }
  return [...seen.values()]
}

export interface Replica {
  /** Índice sequencial (ordem de execução) entre todas as réplicas. */
  index: number
  floor: number
  unit: number
  position: [number, number, number]
  isGround: boolean
  isTop: boolean
}

/**
 * Posiciona as réplicas da planta-tipo conforme a tipologia:
 *  - prédio: unidades lado a lado, pavimentos empilhados;
 *  - condomínio: casas em grade com ruas entre as quadras;
 *  - casa/apartamento: pavimentos empilhados (sobrado).
 */
export function computeReplicas(
  type: BuildingType,
  floors: number,
  units: number,
  layout: FloorPlanLayout,
  wallHeight: number,
): Replica[] {
  const f = Math.max(1, floors)
  const u = Math.max(1, units)
  const floorHeight = wallHeight + SLAB_THICKNESS
  const replicas: Replica[] = []

  if (type === 'condominio') {
    const cols = Math.ceil(Math.sqrt(u))
    const rows = Math.ceil(u / cols)
    const gapX = 3
    const gapZ = 6
    for (let floor = 0; floor < f; floor++) {
      for (let unit = 0; unit < u; unit++) {
        const col = unit % cols
        const row = Math.floor(unit / cols)
        const x = (col - (cols - 1) / 2) * (layout.width + gapX)
        const z = (row - (rows - 1) / 2) * (layout.depth + gapZ)
        replicas.push({
          index: floor * u + unit,
          floor,
          unit,
          position: [x, floor * floorHeight, z],
          isGround: floor === 0,
          isTop: floor === f - 1,
        })
      }
    }
    return replicas
  }

  const unitsPerFloor = type === 'predio' ? u : 1
  for (let floor = 0; floor < f; floor++) {
    for (let unit = 0; unit < unitsPerFloor; unit++) {
      const x = (unit - (unitsPerFloor - 1) / 2) * (layout.width + 0.3)
      replicas.push({
        index: floor * unitsPerFloor + unit,
        floor,
        unit,
        position: [x, floor * floorHeight, 0],
        isGround: floor === 0,
        isTop: floor === f - 1,
      })
    }
  }
  return replicas
}

/** Dimensões totais do canteiro (para enquadrar a câmera). */
export function siteExtent(replicas: Replica[], layout: FloorPlanLayout, wallHeight: number) {
  let maxX = 0
  let maxZ = 0
  let maxY = 0
  for (const r of replicas) {
    maxX = Math.max(maxX, Math.abs(r.position[0]) + layout.width / 2)
    maxZ = Math.max(maxZ, Math.abs(r.position[2]) + layout.depth / 2)
    maxY = Math.max(maxY, r.position[1] + wallHeight)
  }
  return { maxX, maxY, maxZ, radius: Math.max(maxX, maxZ, maxY * 0.8, 4) }
}
