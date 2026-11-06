import { describe, expect, it } from 'vitest'
import { seedProjects } from '../../data/seed'
import { DEFAULT_STAGES } from '../catalog'
import { estimateQuantities, laborStatus, materialStatus, replicaCount } from '../estimates'
import { templateRooms } from '../templates'
import type { Project } from '../../types'

const base = (): Project => ({
  id: 'p',
  name: 'Teste',
  owner: 'construtora',
  client: '',
  address: '',
  type: 'casa',
  floors: 1,
  units: 1,
  wallHeight: 2.8,
  rooms: templateRooms('casa'),
  stages: DEFAULT_STAGES.map((s) => ({ ...s })),
  materialUsage: [],
  labor: [],
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  createdAt: '',
  source: 'template',
})

describe('estimateQuantities', () => {
  it('escala com o número de unidades', () => {
    const one = estimateQuantities(base())
    const condo = estimateQuantities({ ...base(), type: 'condominio', units: 4 })
    expect(condo.builtArea).toBeCloseTo(one.builtArea * 4)
    expect(replicaCount({ floors: 3, units: 2 })).toBe(6)
  })

  it('não prevê telhas para prédios (laje de cobertura)', () => {
    expect(estimateQuantities({ ...base(), type: 'predio', floors: 4 }).materials.telha).toBe(0)
  })

  it('casa típica tem ordem de grandeza realista', () => {
    const q = estimateQuantities(base())
    expect(q.builtArea).toBeGreaterThan(60)
    expect(q.builtArea).toBeLessThan(100)
    expect(q.materials.cimento).toBeGreaterThan(100)
  })
})

describe('materialStatus', () => {
  it('esperado acompanha o avanço das etapas', () => {
    const p = base()
    p.stages = p.stages.map((s) => (s.id === 'alvenaria' ? { ...s, progress: 50 } : s))
    p.materialUsage = [{ id: 'u', materialId: 'tijolo', quantity: 100, date: '2026-02-01' }]
    const tijolo = materialStatus(p).find((m) => m.id === 'tijolo')!
    expect(tijolo.expected).toBeCloseTo(tijolo.planned / 2)
    expect(tijolo.used).toBe(100)
    expect(tijolo.deviation).toBeLessThan(0)
  })
})

describe('laborStatus', () => {
  it('soma pessoas × horas × dias', () => {
    const p = base()
    p.labor = [{ id: 'l', role: 'pedreiro', workers: 2, hours: 8, days: 5, date: '2026-02-01' }]
    const pedreiro = laborStatus(p).find((l) => l.role === 'pedreiro')!
    expect(pedreiro.usedHours).toBe(80)
    expect(pedreiro.workerDays).toBe(10)
  })
})

describe('seedProjects', () => {
  it('gera obras de exemplo válidas', () => {
    const seeds = seedProjects()
    expect(seeds.length).toBeGreaterThanOrEqual(3)
    expect(new Set(seeds.map((s) => s.owner))).toEqual(new Set(['prefeitura', 'construtora']))
  })
})
