import type { Project, Stage, StageId } from '../types'

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Progresso global ponderado pelos pesos das etapas (0–100). */
export function overallProgress(stages: Stage[]): number {
  const totalWeight = stages.reduce((s, st) => s + st.weight, 0)
  if (totalWeight === 0) return 0
  return stages.reduce((s, st) => s + st.weight * st.progress, 0) / totalWeight
}

/** Mapa etapa → fração concluída (0–1). */
export function stageFractions(stages: Stage[]): Record<StageId, number> {
  const out = {} as Record<StageId, number>
  for (const st of stages) out[st.id] = clamp01(st.progress / 100)
  return out
}

/**
 * Distribui o progresso de uma etapa entre N unidades executadas em sequência
 * (andares de um prédio, casas de um condomínio). Ex.: 50% em 4 andares →
 * [1, 1, 0, 0]; 60% → [1, 1, 0.4, 0].
 */
export function unitFraction(stageFraction: number, unitIndex: number, unitCount: number): number {
  if (unitCount <= 1) return clamp01(stageFraction)
  return clamp01(stageFraction * unitCount - unitIndex)
}

/** Progresso planejado pelo cronograma linear entre início e término (0–100). */
export function plannedProgress(project: Pick<Project, 'startDate' | 'endDate'>, at = new Date()): number {
  const start = new Date(project.startDate).getTime()
  const end = new Date(project.endDate).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return clamp01((at.getTime() - start) / (end - start)) * 100
}

export type ScheduleStatus = 'adiantada' | 'no_prazo' | 'atrasada' | 'concluida'

export function scheduleStatus(project: Project, at = new Date()): ScheduleStatus {
  const actual = overallProgress(project.stages)
  if (actual >= 99.9) return 'concluida'
  const diff = actual - plannedProgress(project, at)
  if (diff >= 5) return 'adiantada'
  if (diff <= -5) return 'atrasada'
  return 'no_prazo'
}

export const SCHEDULE_LABEL: Record<ScheduleStatus, string> = {
  adiantada: 'Adiantada',
  no_prazo: 'No prazo',
  atrasada: 'Atrasada',
  concluida: 'Concluída',
}

/**
 * O acabamento é acompanhado por cômodo. A etapa "Acabamento" é a média dos
 * cômodos ponderada pela área — assim o 3D (que pinta cada cômodo) e o
 * percentual global nunca divergem.
 */
export function finishFromRooms(rooms: Project['rooms']): number {
  const total = rooms.reduce((s, r) => s + r.width * r.depth, 0)
  if (total === 0) return 0
  return rooms.reduce((s, r) => s + r.width * r.depth * r.progress, 0) / total
}

export function withDerivedFinish<T extends Pick<Project, 'rooms' | 'stages'>>(project: T): T {
  const finish = Math.round(finishFromRooms(project.rooms) * 10) / 10
  return {
    ...project,
    stages: project.stages.map((s) => (s.id === 'acabamento' ? { ...s, progress: finish } : s)),
  }
}

/**
 * Estado simulado da obra no instante t ∈ [0, 1] de um "replay": as etapas
 * são preenchidas em ordem (fundação → acabamento) até atingir t × o avanço
 * atual. Usado para animar a evolução da obra no 3D.
 */
export function simulateAt<T extends Pick<Project, 'rooms' | 'stages'>>(project: T, t: number): T {
  let budget = clamp01(t) * project.stages.reduce((s, st) => s + st.weight * st.progress, 0)
  const stages = project.stages.map((st) => {
    const full = st.weight * st.progress
    const take = Math.min(full, budget)
    budget -= take
    return { ...st, progress: st.weight > 0 ? take / st.weight : 0 }
  })
  const actualFinish = project.stages.find((s) => s.id === 'acabamento')?.progress ?? 0
  const simFinish = stages.find((s) => s.id === 'acabamento')?.progress ?? 0
  const ratio = actualFinish > 0 ? simFinish / actualFinish : 0
  return {
    ...project,
    stages,
    rooms: project.rooms.map((r) => ({ ...r, progress: r.progress * ratio })),
  }
}
