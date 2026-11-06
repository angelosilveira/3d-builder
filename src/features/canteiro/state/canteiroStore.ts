import { create } from 'zustand'
import type { Aba } from '../data/lookup'

export type ComandoCamera = 'zoom_in' | 'zoom_out' | 'girar_esquerda' | 'girar_direita' | 'recentralizar'

interface CanteiroState {
  obraId: string
  selecionadoId: string | null
  hoverId: string | null
  /** Semana exibida no cronograma 4D. null = hoje (ao vivo). */
  semana: number | null
  aba: Aba
  /** Modo "Previsto x Executado": pinta pavimentos pelo desvio. */
  comparar: boolean
  /** Comando de câmera pendente; `n` muda a cada pedido para disparar o efeito. */
  comando: { tipo: ComandoCamera; n: number } | null

  setObra: (id: string) => void
  selecionar: (id: string | null, aba?: Aba | null) => void
  setHover: (id: string | null) => void
  setSemana: (semana: number | null) => void
  setAba: (aba: Aba) => void
  setComparar: (v: boolean) => void
  comandar: (tipo: ComandoCamera) => void
}

export const useCanteiroStore = create<CanteiroState>()((set) => ({
  obraId: 'ob-01',
  selecionadoId: null,
  hoverId: null,
  semana: null,
  aba: 'equipamentos',
  comparar: false,
  comando: null,

  setObra: (obraId) => set({ obraId, selecionadoId: null, hoverId: null, semana: null }),
  selecionar: (selecionadoId, aba) => set((s) => ({ selecionadoId, aba: aba ?? s.aba })),
  setHover: (hoverId) => set((s) => (s.hoverId === hoverId ? s : { hoverId })),
  setSemana: (semana) => set({ semana }),
  setAba: (aba) => set({ aba }),
  setComparar: (comparar) => set({ comparar }),
  comandar: (tipo) => set((s) => ({ comando: { tipo, n: (s.comando?.n ?? 0) + 1 } })),
}))
