import { create } from 'zustand'

/**
 * Fila de efeitos de recompensa. O HUD emite (após uma ação) e a cena/HUD
 * consomem: partículas no ativo, "+N pts" flutuando e um toast.
 */
export interface Efeito {
  id: number
  ativoId: string | null
  /** Texto curto que flutua sobre o ativo (ex.: "+4 pts"). */
  flutuante: string | null
  /** Mensagem do toast (anunciada a leitores de tela). */
  mensagem: string
  tipo: 'acao' | 'conquista' | 'nivel'
}

interface EfeitosState {
  efeitos: Efeito[]
  emitir: (e: Omit<Efeito, 'id'>) => void
  remover: (id: number) => void
}

let seq = 1

export const useEfeitos = create<EfeitosState>()((set) => ({
  efeitos: [],
  emitir: (e) => set((s) => ({ efeitos: [...s.efeitos.slice(-6), { ...e, id: seq++ }] })),
  remover: (id) => set((s) => ({ efeitos: s.efeitos.filter((x) => x.id !== id) })),
}))
