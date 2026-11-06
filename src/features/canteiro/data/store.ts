import { useEffect } from 'react'
import { create } from 'zustand'
import { useCanteiroStore } from '../state/canteiroStore'
import { simularTick } from './live'
import { criarTodasObras } from './mock'
import type { ObraData } from './types'

interface ObraDataState {
  obras: Record<string, ObraData>
  carregar: (obras: Record<string, ObraData>) => void
  tick: (agora: Date) => void
  ticks: number
}

/**
 * Fonte de dados das obras. Hoje vem dos mocks; para usar uma API, troque
 * `carregar` por um fetch e `tick` por um WebSocket/SSE que aplique deltas.
 */
export const useObraDataStore = create<ObraDataState>()((set) => ({
  obras: criarTodasObras(),
  ticks: 0,
  carregar: (obras) => set({ obras, ticks: 0 }),
  tick: (agora) =>
    set((s) => {
      const ticks = s.ticks + 1
      const obras: Record<string, ObraData> = {}
      for (const [id, data] of Object.entries(s.obras)) obras[id] = simularTick(data, agora, ticks)
      return { obras, ticks }
    }),
}))

/**
 * Acesso fino aos dados da obra ativa: o componente só re-renderiza quando a
 * fatia que ele seleciona muda de referência.
 */
export function useObraData<T>(selector: (data: ObraData) => T): T {
  const obraId = useCanteiroStore((s) => s.obraId)
  return useObraDataStore((s) => selector(s.obras[obraId] ?? Object.values(s.obras)[0]))
}

export const selecionarObra = (data: ObraData) => data
export const listaObras = (s: ObraDataState) => s.obras

/** Liga a simulação ao vivo (um único intervalo para a página). */
export function useSimulacaoAoVivo(intervaloMs = 3000) {
  const tick = useObraDataStore((s) => s.tick)
  useEffect(() => {
    const id = window.setInterval(() => tick(new Date()), intervaloMs)
    return () => window.clearInterval(id)
  }, [tick, intervaloMs])
}
