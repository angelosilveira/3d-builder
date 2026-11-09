import { create } from 'zustand'
import { FILTROS_VAZIOS, type Filtros } from '../data/derived'
import type { Selecao } from '../data/types'

export type Aba = 'qualificacoes' | 'vulnerabilidades' | 'pendencias' | 'projetos' | 'analistas'
export type ComandoCamera = 'zoom_in' | 'zoom_out' | 'girar_esquerda' | 'girar_direita' | 'recentralizar' | 'enquadrar'

/** Região do mapa (centro e tamanho) para o comando "enquadrar". */
export interface Regiao {
  x: number
  z: number
  w: number
  d: number
}

interface AppSecUiState {
  selecao: Selecao | null
  /** Ativo sob o mouse na cena (id). */
  hoverId: string | null
  filtros: Filtros
  aba: Aba
  comando: { tipo: ComandoCamera; n: number; regiao?: Regiao } | null
  /** Mostra todas as conexões do mapa (sem seleção, só a rede em foco aparece). */
  redeVisivel: boolean

  selecionar: (s: Selecao | null) => void
  setHover: (id: string | null) => void
  setFiltros: (patch: Partial<Filtros>) => void
  limparFiltros: () => void
  setAba: (aba: Aba) => void
  comandar: (tipo: ComandoCamera, regiao?: Regiao) => void
  alternarRede: () => void
}

/** Aba da tabela que lista cada tipo de seleção. */
const ABA_DA_SELECAO: Record<Selecao['tipo'], Aba> = {
  ativo: 'qualificacoes',
  qualificacao: 'qualificacoes',
  projeto: 'projetos',
  vulnerabilidade: 'vulnerabilidades',
  pendencia: 'pendencias',
  analista: 'analistas',
}

export const useAppSecUi = create<AppSecUiState>()((set) => ({
  selecao: null,
  hoverId: null,
  filtros: FILTROS_VAZIOS,
  aba: 'qualificacoes',
  comando: null,
  redeVisivel: false,

  selecionar: (selecao) => set((s) => ({ selecao, aba: selecao ? ABA_DA_SELECAO[selecao.tipo] : s.aba })),
  setHover: (hoverId) => set((s) => (s.hoverId === hoverId ? s : { hoverId })),
  setFiltros: (patch) => set((s) => ({ filtros: { ...s.filtros, ...patch } })),
  limparFiltros: () => set({ filtros: FILTROS_VAZIOS }),
  setAba: (aba) => set({ aba }),
  comandar: (tipo, regiao) => set((s) => ({ comando: { tipo, regiao, n: (s.comando?.n ?? 0) + 1 } })),
  alternarRede: () => set((s) => ({ redeVisivel: !s.redeVisivel })),
}))

export const mesmaSelecao = (a: Selecao | null, b: Selecao | null) => a?.tipo === b?.tipo && a?.id === b?.id
