import type { BuildingType, LaborRole, MaterialId, Project, StageId } from '../types'
import { LABOR_HOURLY_RATE, LABOR_ROLES, MATERIALS, MATERIAL_IDS } from './catalog'
import { roomArea, roomPerimeter } from './layout'
import { overallProgress, stageFractions } from './progress'

/**
 * Índices de consumo aproximados (ordem de grandeza de obras residenciais
 * brasileiras de padrão popular/médio). Servem como orçamento inicial e devem
 * ser substituídos por composições SINAPI/TCPO na evolução do produto.
 */
interface ConsumptionIndex {
  cimentoPorM2: number
  areiaPorM2: number
  britaPorM2: number
  acoPorM2: number
  /** Homem-hora por m² construído. */
  hh: Record<LaborRole, number>
}

const LOW_RISE: ConsumptionIndex = {
  cimentoPorM2: 2.2,
  areiaPorM2: 0.45,
  britaPorM2: 0.25,
  acoPorM2: 6,
  hh: { pedreiro: 9, ajudante: 6, servente: 10 },
}

const HIGH_RISE: ConsumptionIndex = {
  cimentoPorM2: 3,
  areiaPorM2: 0.5,
  britaPorM2: 0.35,
  acoPorM2: 22,
  hh: { pedreiro: 11, ajudante: 7, servente: 12 },
}

const indexFor = (type: BuildingType) => (type === 'predio' ? HIGH_RISE : LOW_RISE)

/** Quanto de cada material é consumido em cada etapa (soma = 1 por material). */
export const MATERIAL_STAGE_SHARE: Record<MaterialId, Partial<Record<StageId, number>>> = {
  cimento: { fundacao: 0.3, estrutura: 0.35, alvenaria: 0.2, acabamento: 0.15 },
  areia: { fundacao: 0.2, estrutura: 0.25, alvenaria: 0.35, acabamento: 0.2 },
  brita: { fundacao: 0.5, estrutura: 0.5 },
  aco: { fundacao: 0.35, estrutura: 0.65 },
  tijolo: { alvenaria: 1 },
  telha: { cobertura: 1 },
  piso: { acabamento: 1 },
  tinta: { acabamento: 1 },
}

export const replicaCount = (p: Pick<Project, 'floors' | 'units'>) =>
  Math.max(1, p.floors) * Math.max(1, p.units)

export interface Quantities {
  /** Área útil de um pavimento/unidade (soma dos cômodos). */
  usefulArea: number
  /** Área construída total (inclui paredes e todas as unidades). */
  builtArea: number
  wallArea: number
  roofArea: number
  materials: Record<MaterialId, number>
  laborHours: Record<LaborRole, number>
}

export function estimateQuantities(project: Project): Quantities {
  const idx = indexFor(project.type)
  const replicas = replicaCount(project)
  const usefulArea = project.rooms.reduce((s, r) => s + roomArea(r), 0)
  const perimeter = project.rooms.reduce((s, r) => s + roomPerimeter(r), 0)

  const builtArea = usefulArea * 1.12 * replicas
  // Paredes internas são compartilhadas por dois cômodos (fator 0,65) e
  // descontamos ~12% de vãos de portas e janelas.
  const wallArea = perimeter * project.wallHeight * 0.65 * 0.88 * replicas
  const hasPitchedRoof = project.type === 'casa' || project.type === 'condominio'
  const roofArea = hasPitchedRoof ? usefulArea * 1.12 * 1.25 * Math.max(1, project.units) : 0

  const materials: Record<MaterialId, number> = {
    cimento: builtArea * idx.cimentoPorM2,
    areia: builtArea * idx.areiaPorM2,
    brita: builtArea * idx.britaPorM2,
    aco: builtArea * idx.acoPorM2,
    tijolo: wallArea * 25,
    telha: roofArea * 16,
    piso: usefulArea * replicas * 1.1,
    tinta: wallArea * 0.4 + usefulArea * replicas * 0.2,
  }

  const laborHours = {} as Record<LaborRole, number>
  for (const role of LABOR_ROLES) laborHours[role] = builtArea * idx.hh[role]

  return { usefulArea, builtArea, wallArea, roofArea, materials, laborHours }
}

export interface MaterialStatus {
  id: MaterialId
  planned: number
  /** Quanto já deveria ter sido gasto, dado o avanço físico das etapas. */
  expected: number
  used: number
  /** used / expected − 1. Positivo = gastando acima do esperado. */
  deviation: number
  plannedCost: number
  usedCost: number
}

export function materialStatus(project: Project, q = estimateQuantities(project)): MaterialStatus[] {
  const fractions = stageFractions(project.stages)
  return MATERIAL_IDS.map((id) => {
    const planned = q.materials[id]
    const share = MATERIAL_STAGE_SHARE[id]
    const doneShare = Object.entries(share).reduce(
      (s, [stage, w]) => s + (w ?? 0) * (fractions[stage as StageId] ?? 0),
      0,
    )
    const expected = planned * doneShare
    const used = project.materialUsage
      .filter((u) => u.materialId === id)
      .reduce((s, u) => s + u.quantity, 0)
    const deviation = expected > 0 ? used / expected - 1 : 0
    const price = MATERIALS[id].unitPrice
    return { id, planned, expected, used, deviation, plannedCost: planned * price, usedCost: used * price }
  })
}

export interface LaborStatus {
  role: LaborRole
  plannedHours: number
  expectedHours: number
  usedHours: number
  workerDays: number
  usedCost: number
}

export function laborStatus(project: Project, q = estimateQuantities(project)): LaborStatus[] {
  const done = overallProgress(project.stages) / 100
  return LABOR_ROLES.map((role) => {
    const entries = project.labor.filter((l) => l.role === role)
    const usedHours = entries.reduce((s, l) => s + l.workers * l.hours * l.days, 0)
    const workerDays = entries.reduce((s, l) => s + l.workers * l.days, 0)
    return {
      role,
      plannedHours: q.laborHours[role],
      expectedHours: q.laborHours[role] * done,
      usedHours,
      workerDays,
      usedCost: usedHours * LABOR_HOURLY_RATE[role],
    }
  })
}

export function costSummary(project: Project) {
  const q = estimateQuantities(project)
  const mats = materialStatus(project, q)
  const labor = laborStatus(project, q)
  const plannedMaterials = mats.reduce((s, m) => s + m.plannedCost, 0)
  const usedMaterials = mats.reduce((s, m) => s + m.usedCost, 0)
  const plannedLabor = LABOR_ROLES.reduce((s, r) => s + q.laborHours[r] * LABOR_HOURLY_RATE[r], 0)
  const usedLabor = labor.reduce((s, l) => s + l.usedCost, 0)
  return {
    quantities: q,
    plannedTotal: plannedMaterials + plannedLabor,
    usedTotal: usedMaterials + usedLabor,
    plannedMaterials,
    usedMaterials,
    plannedLabor,
    usedLabor,
  }
}
