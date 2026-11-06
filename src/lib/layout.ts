import type { Room } from '../types'

export interface PlacedRoom extends Room {
  /** Canto mínimo do cômodo no plano (metros). */
  x: number
  z: number
}

export interface FloorPlanLayout {
  rooms: PlacedRoom[]
  width: number
  depth: number
}

/**
 * Gera uma planta baixa simples a partir das dimensões dos cômodos usando
 * empacotamento em faixas ("shelf packing"): os cômodos são ordenados pela
 * profundidade e distribuídos em linhas com largura-alvo próxima de um
 * retângulo áureo. O resultado é centralizado na origem.
 *
 * É uma aproximação para visualização — quando a planta vier de um PDF/CAD
 * com coordenadas reais, ela substitui este layout.
 */
export function layoutRooms(rooms: Room[]): FloorPlanLayout {
  const valid = rooms.filter((r) => r.width > 0 && r.depth > 0)
  if (valid.length === 0) return { rooms: [], width: 0, depth: 0 }

  const totalArea = valid.reduce((s, r) => s + r.width * r.depth, 0)
  const maxWidth = Math.max(...valid.map((r) => r.width))
  const targetWidth = Math.max(maxWidth, Math.sqrt(totalArea * 1.6))

  const sorted = [...valid].sort((a, b) => b.depth - a.depth || b.width - a.width)

  const placed: PlacedRoom[] = []
  let cursorX = 0
  let cursorZ = 0
  let rowDepth = 0
  let planWidth = 0

  for (const room of sorted) {
    if (cursorX > 0 && cursorX + room.width > targetWidth + 1e-6) {
      cursorZ += rowDepth
      cursorX = 0
      rowDepth = 0
    }
    placed.push({ ...room, x: cursorX, z: cursorZ })
    cursorX += room.width
    rowDepth = Math.max(rowDepth, room.depth)
    planWidth = Math.max(planWidth, cursorX)
  }
  const planDepth = cursorZ + rowDepth

  // Centraliza na origem.
  for (const r of placed) {
    r.x -= planWidth / 2
    r.z -= planDepth / 2
  }

  return { rooms: placed, width: planWidth, depth: planDepth }
}

export const roomArea = (r: Pick<Room, 'width' | 'depth'>) => r.width * r.depth
export const roomPerimeter = (r: Pick<Room, 'width' | 'depth'>) => 2 * (r.width + r.depth)
