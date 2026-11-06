import { describe, expect, it } from 'vitest'
import { DEFAULT_STAGES } from '../catalog'
import { finishFromRooms, overallProgress, plannedProgress, simulateAt, unitFraction, withDerivedFinish } from '../progress'
import type { Room } from '../../types'

const stages = (values: number[]) => DEFAULT_STAGES.map((s, i) => ({ ...s, progress: values[i] }))
const room = (id: string, width: number, depth: number, progress: number): Room => ({ id, name: id, kind: 'sala', width, depth, progress })

describe('overallProgress', () => {
  it('pondera as etapas pelo peso', () => {
    expect(overallProgress(stages([0, 0, 0, 0, 0, 0]))).toBe(0)
    expect(overallProgress(stages([100, 100, 100, 100, 100, 100]))).toBe(100)
    // fundação (15) + estrutura (20) completas = 35%
    expect(overallProgress(stages([100, 100, 0, 0, 0, 0]))).toBe(35)
  })
})

describe('unitFraction', () => {
  it('distribui o avanço em sequência entre unidades', () => {
    expect([0, 1, 2, 3].map((i) => unitFraction(0.5, i, 4))).toEqual([1, 1, 0, 0])
    expect(unitFraction(0.6, 2, 4)).toBeCloseTo(0.4)
    expect(unitFraction(0.3, 0, 1)).toBe(0.3)
  })
})

describe('plannedProgress', () => {
  it('é linear entre início e término', () => {
    const p = { startDate: '2026-01-01', endDate: '2026-01-11' }
    expect(plannedProgress(p, new Date('2026-01-06'))).toBeCloseTo(50)
    expect(plannedProgress(p, new Date('2025-12-01'))).toBe(0)
    expect(plannedProgress(p, new Date('2027-01-01'))).toBe(100)
  })
})

describe('acabamento derivado dos cômodos', () => {
  it('usa média ponderada pela área', () => {
    const rooms = [room('a', 4, 5, 100), room('b', 2, 5, 40)]
    expect(finishFromRooms(rooms)).toBeCloseTo(80)
    const p = withDerivedFinish({ rooms, stages: stages([0, 0, 0, 0, 0, 0]) })
    expect(p.stages.find((s) => s.id === 'acabamento')?.progress).toBe(80)
  })
})

describe('simulateAt', () => {
  it('preenche etapas em ordem até o avanço atual', () => {
    const project = { rooms: [room('a', 3, 3, 50)], stages: stages([100, 100, 50, 0, 0, 50]) }
    const start = simulateAt(project, 0)
    expect(overallProgress(start.stages)).toBe(0)
    const end = simulateAt(project, 1)
    expect(overallProgress(end.stages)).toBeCloseTo(overallProgress(project.stages))
    // Na metade, a fundação deve estar completa antes da alvenaria começar.
    const mid = simulateAt(project, 0.3)
    expect(mid.stages[0].progress).toBe(100)
    expect(mid.stages[2].progress).toBe(0)
  })
})
