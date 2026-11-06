import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { seedProjects } from '../data/seed'
import { DEFAULT_STAGES } from '../lib/catalog'
import { uid } from '../lib/id'
import { withDerivedFinish } from '../lib/progress'
import type { LaborEntry, MaterialUsage, Project, ProjectDraft, Room, StageId } from '../types'

interface ProjectsState {
  projects: Project[]
  createProject: (draft: ProjectDraft) => string
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void
  setStageProgress: (id: string, stage: StageId, progress: number) => void
  updateRoom: (id: string, roomId: string, patch: Partial<Room>) => void
  addMaterialUsage: (id: string, entry: Omit<MaterialUsage, 'id'>) => void
  removeMaterialUsage: (id: string, entryId: string) => void
  addLabor: (id: string, entry: Omit<LaborEntry, 'id'>) => void
  removeLabor: (id: string, entryId: string) => void
  resetDemo: () => void
}

const clampPct = (v: number) => Math.min(100, Math.max(0, Math.round(v)))

/**
 * Estado das obras. Hoje persiste no localStorage do navegador; a interface
 * foi pensada para ser trocada por chamadas a uma API REST sem mudar as telas.
 */
export const useProjects = create<ProjectsState>()(
  persist(
    (set) => {
      const patchProject = (id: string, fn: (p: Project) => Project) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? fn(p) : p)) }))

      return {
        projects: seedProjects(),

        createProject: (draft) => {
          const id = uid('p_')
          const project: Project = {
            ...draft,
            id,
            stages: DEFAULT_STAGES.map((s) => ({ ...s })),
            materialUsage: [],
            labor: [],
            createdAt: new Date().toISOString(),
          }
          set((s) => ({ projects: [project, ...s.projects] }))
          return id
        },

        updateProject: (id, patch) => patchProject(id, (p) => withDerivedFinish({ ...p, ...patch })),

        deleteProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

        setStageProgress: (id, stage, progress) =>
          patchProject(id, (p) => {
            const value = clampPct(progress)
            // Ajustar o acabamento global aplica o mesmo percentual a todos os cômodos.
            if (stage === 'acabamento') {
              return withDerivedFinish({ ...p, rooms: p.rooms.map((r) => ({ ...r, progress: value })) })
            }
            return {
              ...p,
              stages: p.stages.map((st) => (st.id === stage ? { ...st, progress: value } : st)),
            }
          }),

        updateRoom: (id, roomId, patch) =>
          patchProject(id, (p) =>
            withDerivedFinish({
              ...p,
              rooms: p.rooms.map((r) =>
                r.id === roomId
                  ? { ...r, ...patch, progress: clampPct(patch.progress ?? r.progress) }
                  : r,
              ),
            }),
          ),

        addMaterialUsage: (id, entry) =>
          patchProject(id, (p) => ({
            ...p,
            materialUsage: [{ ...entry, id: uid('m_') }, ...p.materialUsage],
          })),

        removeMaterialUsage: (id, entryId) =>
          patchProject(id, (p) => ({
            ...p,
            materialUsage: p.materialUsage.filter((m) => m.id !== entryId),
          })),

        addLabor: (id, entry) =>
          patchProject(id, (p) => ({ ...p, labor: [{ ...entry, id: uid('l_') }, ...p.labor] })),

        removeLabor: (id, entryId) =>
          patchProject(id, (p) => ({ ...p, labor: p.labor.filter((l) => l.id !== entryId) })),

        resetDemo: () => set({ projects: seedProjects() }),
      }
    },
    {
      name: 'obra3d:projects',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

export const useProject = (id: string | undefined) =>
  useProjects((s) => s.projects.find((p) => p.id === id))
