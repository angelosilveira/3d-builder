import { describe, expect, it } from 'vitest'
import { computePillars, computeReplicas, computeWalls } from '../../components/viewer/geometry'
import { layoutRooms } from '../layout'
import { templateRooms } from '../templates'
import type { Room } from '../../types'

const room = (id: string, width: number, depth: number): Room => ({ id, name: id, kind: 'quarto', width, depth, progress: 0 })

const overlaps = (a: { x: number; z: number; width: number; depth: number }, b: typeof a) =>
  a.x < b.x + b.width - 1e-6 && b.x < a.x + a.width - 1e-6 && a.z < b.z + b.depth - 1e-6 && b.z < a.z + a.depth - 1e-6

describe('layoutRooms', () => {
  it('posiciona todos os cômodos sem sobreposição', () => {
    const layout = layoutRooms(templateRooms('casa'))
    expect(layout.rooms).toHaveLength(7)
    for (let i = 0; i < layout.rooms.length; i++)
      for (let j = i + 1; j < layout.rooms.length; j++) expect(overlaps(layout.rooms[i], layout.rooms[j])).toBe(false)
  })

  it('centraliza a planta na origem', () => {
    const layout = layoutRooms([room('a', 4, 2), room('b', 4, 2)])
    const minX = Math.min(...layout.rooms.map((r) => r.x))
    const maxX = Math.max(...layout.rooms.map((r) => r.x + r.width))
    expect(minX + maxX).toBeCloseTo(0)
  })

  it('ignora cômodos com medidas inválidas', () => {
    expect(layoutRooms([room('a', 0, 3)]).rooms).toHaveLength(0)
  })
})

describe('computeWalls', () => {
  it('une paredes compartilhadas entre cômodos vizinhos', () => {
    // Dois cômodos 3x3 vizinhos → 5 paredes (a divisória é uma só), 4 externas.
    const layout = layoutRooms([room('a', 3, 3), room('b', 3, 3)])
    const walls = computeWalls(layout)
    expect(walls).toHaveLength(5)
    expect(walls.filter((w) => w.exterior)).toHaveLength(4)
    const longest = Math.max(...walls.map((w) => w.to - w.from))
    expect(longest).toBeCloseTo(6)
    expect(computePillars(layout)).toHaveLength(6)
  })
})

describe('computeReplicas', () => {
  const layout = layoutRooms([room('a', 5, 5)])
  it('empilha pavimentos de um prédio', () => {
    const r = computeReplicas('predio', 3, 2, layout, 2.8)
    expect(r).toHaveLength(6)
    expect(r.filter((x) => x.isGround)).toHaveLength(2)
    expect(r.filter((x) => x.isTop)).toHaveLength(2)
    expect(Math.max(...r.map((x) => x.position[1]))).toBeCloseTo(2 * 3)
  })
  it('distribui casas do condomínio em grade', () => {
    const r = computeReplicas('condominio', 1, 6, layout, 2.7)
    expect(r).toHaveLength(6)
    expect(new Set(r.map((x) => x.position.join(','))).size).toBe(6)
  })
})
