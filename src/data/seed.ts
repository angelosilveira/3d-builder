import { DEFAULT_STAGES } from '../lib/catalog'
import { uid } from '../lib/id'
import { withDerivedFinish } from '../lib/progress'
import { DEFAULT_LAYOUT, templateRooms } from '../lib/templates'
import type { LaborEntry, MaterialUsage, Project, StageId } from '../types'

function stages(values: Partial<Record<StageId, number>>) {
  return DEFAULT_STAGES.map((s) => ({ ...s, progress: values[s.id] ?? 0 }))
}

const usage = (entries: [MaterialUsage['materialId'], number, string][]): MaterialUsage[] =>
  entries.map(([materialId, quantity, date]) => ({ id: uid('m_'), materialId, quantity, date }))

const labor = (entries: [LaborEntry['role'], number, number, number, string][]): LaborEntry[] =>
  entries.map(([role, workers, hours, days, date]) => ({ id: uid('l_'), role, workers, hours, days, date }))

/** Obras de demonstração carregadas no primeiro acesso. */
export function seedProjects(): Project[] {
  const now = new Date().toISOString()

  const casaRooms = templateRooms('casa').map((r, i) => ({ ...r, progress: [80, 40, 100, 60, 20, 0, 0][i] ?? 0 }))

  const projects: Project[] = [
    {
      id: 'demo-casa-souza',
      name: 'Casa Família Souza',
      owner: 'construtora',
      client: 'Marcos e Ana Souza',
      address: 'Rua das Acácias, 120 — Jardim Primavera',
      type: 'casa',
      ...DEFAULT_LAYOUT.casa,
      rooms: casaRooms,
      stages: stages({ fundacao: 100, estrutura: 100, alvenaria: 90, instalacoes: 60, cobertura: 50, acabamento: 25 }),
      materialUsage: usage([
        ['cimento', 120, '2026-06-10'],
        ['cimento', 55, '2026-08-02'],
        ['areia', 28, '2026-06-10'],
        ['brita', 19, '2026-06-12'],
        ['aco', 520, '2026-06-20'],
        ['tijolo', 3400, '2026-07-15'],
        ['telha', 700, '2026-09-30'],
      ]),
      labor: labor([
        ['pedreiro', 2, 8, 25, '2026-06-10'],
        ['ajudante', 1, 8, 25, '2026-06-10'],
        ['servente', 2, 8, 25, '2026-06-10'],
        ['pedreiro', 1, 8, 25, '2026-08-15'],
        ['ajudante', 1, 8, 20, '2026-08-15'],
        ['servente', 1, 8, 30, '2026-09-05'],
      ]),
      startDate: '2026-06-01',
      endDate: '2027-01-30',
      createdAt: now,
      source: 'template',
    },
    {
      id: 'demo-residencial-vila-nova',
      name: 'Residencial Vila Nova (Habitação Popular)',
      owner: 'prefeitura',
      client: 'Secretaria Municipal de Habitação',
      address: 'Av. Central, s/n — Bairro Vila Nova',
      type: 'condominio',
      ...DEFAULT_LAYOUT.condominio,
      units: 8,
      rooms: templateRooms('condominio'),
      stages: stages({ fundacao: 100, estrutura: 75, alvenaria: 50, instalacoes: 25, cobertura: 25, acabamento: 0 }),
      materialUsage: usage([
        ['cimento', 600, '2026-04-10'],
        ['areia', 110, '2026-04-10'],
        ['brita', 60, '2026-04-20'],
        ['aco', 2100, '2026-05-02'],
        ['tijolo', 15000, '2026-07-01'],
      ]),
      labor: labor([
        ['pedreiro', 4, 8, 55, '2026-04-10'],
        ['ajudante', 3, 8, 50, '2026-04-10'],
        ['servente', 5, 8, 50, '2026-04-10'],
      ]),
      startDate: '2026-04-01',
      endDate: '2027-06-30',
      createdAt: now,
      source: 'template',
    },
    {
      id: 'demo-edificio-aurora',
      name: 'Edifício Aurora',
      owner: 'construtora',
      client: 'Aurora Incorporações',
      address: 'Rua XV de Novembro, 900 — Centro',
      type: 'predio',
      ...DEFAULT_LAYOUT.predio,
      floors: 8,
      rooms: templateRooms('predio'),
      stages: stages({ fundacao: 100, estrutura: 62.5, alvenaria: 37.5, instalacoes: 10, cobertura: 0, acabamento: 0 }),
      materialUsage: usage([
        ['cimento', 1600, '2026-03-15'],
        ['aco', 14000, '2026-04-01'],
        ['brita', 220, '2026-03-20'],
        ['areia', 220, '2026-03-20'],
        ['tijolo', 15000, '2026-08-01'],
      ]),
      labor: labor([
        ['pedreiro', 8, 8, 55, '2026-03-15'],
        ['ajudante', 6, 8, 45, '2026-03-15'],
        ['servente', 9, 8, 50, '2026-03-15'],
      ]),
      startDate: '2026-02-01',
      endDate: '2027-12-20',
      createdAt: now,
      source: 'template',
    },
  ]
  return projects.map(withDerivedFinish)
}
