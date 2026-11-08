import { create } from 'zustand'
import { NOME_DOCUMENTO } from './catalogo'
import { criarIndice, type Indice } from './derived'
import { calcularLayout, type LayoutEcossistema } from './layout'
import { criarAppSecMock } from './mock'
import type { AppSecData, CategoriaDocumento } from './types'

interface AppSecDataState {
  data: AppSecData
  indice: Indice
  layout: LayoutEcossistema
  /** Troca o inventário (ex.: resposta da API) e recalcula índices e layout. */
  carregar: (data: AppSecData) => void
  /** Ação simulada no protótipo (na API real: PATCH /pendencias/:id). */
  concluirPendencia: (id: string) => void
  /** Ação simulada no protótipo (na API real: upload em /qualificacoes/:id/documentos). */
  enviarDocumento: (qualificacaoId: string, categoria: CategoriaDocumento) => void
}

function preparar(data: AppSecData) {
  return { data, indice: criarIndice(data), layout: calcularLayout(data) }
}

let seqSimulado = 1

/**
 * Inventário de AppSec. Hoje vem do mock; para a API real, chame
 * `carregar(await api.inventario())` — índices e layout são refeitos.
 * As ações atualizam os dados de forma imutável e recalculam só o índice
 * (o layout não muda: os ativos continuam nos mesmos lugares).
 */
export const useAppSecData = create<AppSecDataState>()((set) => ({
  ...preparar(criarAppSecMock()),
  carregar: (data) => set(preparar(data)),

  concluirPendencia: (id) =>
    set((s) => {
      const alvo = s.data.pendencias.find((p) => p.id === id)
      if (!alvo || alvo.status === 'concluida') return s
      const data = { ...s.data, pendencias: s.data.pendencias.map((p) => (p.id === id ? { ...p, status: 'concluida' as const } : p)) }
      return { data, indice: criarIndice(data) }
    }),

  enviarDocumento: (qualificacaoId, categoria) =>
    set((s) => {
      const q = s.indice.qualPorId.get(qualificacaoId)
      if (!q || (s.indice.docsPorQual.get(q.id) ?? []).some((d) => d.categoria === categoria)) return s
      const ativo = s.indice.ativoPorId.get(q.ativoId)!
      const modelo = NOME_DOCUMENTO[categoria]
      const data = {
        ...s.data,
        documentos: [
          ...s.data.documentos,
          {
            id: `doc-sim-${seqSimulado++}`,
            qualificacaoId,
            categoria,
            nome: `${modelo.nome}-${ativo.nome}-${s.data.geradoEm.slice(0, 7)}.${modelo.formato}`,
            formato: modelo.formato,
            tamanhoKb: 240,
            enviadoEm: s.data.geradoEm,
            enviadoPor: 'Você',
          },
        ],
      }
      return { data, indice: criarIndice(data) }
    }),
}))
