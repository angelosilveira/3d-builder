import { type ConexaoNaRede, redeDoAtivo, redeDoProjeto } from '../data/derived'
import { useAppSecData } from '../data/store'
import type { Selecao } from '../data/types'

/** Ativo destacado pela seleção (ativo, qualificação, vulnerabilidade ou pendência). */
export function ativoDaSelecao(selecao: Selecao | null): string | null {
  if (!selecao) return null
  const { data, indice } = useAppSecData.getState()
  if (selecao.tipo === 'ativo') return selecao.id
  if (selecao.tipo === 'qualificacao') return indice.qualPorId.get(selecao.id)?.ativoId ?? null
  if (selecao.tipo === 'vulnerabilidade') return data.vulnerabilidades.find((v) => v.id === selecao.id)?.ativoId ?? null
  if (selecao.tipo === 'pendencia') return data.pendencias.find((p) => p.id === selecao.id)?.ativoId ?? null
  return null
}

export interface Rede {
  conexoes: ConexaoNaRede[]
  /** Ativos que aparecem na rede (o resto do mapa é esmaecido). */
  ativos: Set<string>
}

let cache: { selecao: Selecao | null; indice: unknown; rede: Rede | null } = { selecao: null, indice: null, rede: null }

/**
 * Rede em foco para a seleção atual: o caminho do ativo (consumidores acima,
 * dependências abaixo) ou todas as conexões do projeto. Memoizada por
 * seleção e índice, pois a cena e o HUD a pedem várias vezes.
 */
export function redeDaSelecao(selecao: Selecao | null): Rede | null {
  const { data, indice } = useAppSecData.getState()
  if (cache.selecao === selecao && cache.indice === indice) return cache.rede
  let rede: Rede | null = null
  if (selecao?.tipo === 'projeto') rede = redeDoProjeto(data, indice, selecao.id)
  else {
    const id = ativoDaSelecao(selecao)
    if (id) rede = redeDoAtivo(indice, id, 3)
  }
  if (rede && rede.conexoes.length === 0) rede = null
  cache = { selecao, indice, rede }
  return rede
}
