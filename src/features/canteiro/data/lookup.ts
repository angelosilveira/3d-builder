import type { Entidade, ObraData } from './types'

export type Aba = 'equipamentos' | 'concretagens' | 'equipes'

export function encontrarEntidade(data: ObraData, id: string | null): Entidade | null {
  if (!id) return null
  const elemento = data.elementos.find((e) => e.id === id)
  if (elemento) return { tipo: 'elemento', item: elemento }
  const equipamento = data.equipamentos.find((e) => e.id === id)
  if (equipamento) return { tipo: 'equipamento', item: equipamento }
  const concretagem = data.concretagens.find((c) => c.id === id)
  if (concretagem) return { tipo: 'concretagem', item: concretagem }
  const equipe = data.equipes.find((e) => e.id === id)
  if (equipe) return { tipo: 'equipe', item: equipe }
  return null
}

/** Aba da tabela que mostra a entidade (elementos aparecem pela sua concretagem). */
export function abaDaEntidade(entidade: Entidade | null): Aba | null {
  if (!entidade) return null
  if (entidade.tipo === 'equipamento') return 'equipamentos'
  if (entidade.tipo === 'equipe') return 'equipes'
  return 'concretagens'
}

/** Id da linha da tabela correspondente à seleção. */
export function linhaDaSelecao(entidade: Entidade | null): string | null {
  if (!entidade) return null
  if (entidade.tipo === 'elemento') return entidade.item.concretagemId
  return entidade.item.id
}

export interface ResultadoBusca {
  id: string
  titulo: string
  subtitulo: string
  grupo: 'Elementos' | 'Equipamentos' | 'Equipes' | 'Concretagens'
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function buscar(data: ObraData, termo: string, limite = 8): ResultadoBusca[] {
  const q = normalizar(termo.trim())
  if (!q) return []
  const todos: ResultadoBusca[] = [
    ...data.equipamentos.map((e) => ({ id: e.id, titulo: `${e.codigo} · ${e.nome}`, subtitulo: e.remessa?.placa ?? e.operador, grupo: 'Equipamentos' as const })),
    ...data.concretagens.map((c) => ({ id: c.id, titulo: `${c.codigo} · ${c.descricao}`, subtitulo: `${c.volumeProgramadoM3} m³ · fck ${c.fck}`, grupo: 'Concretagens' as const })),
    ...data.equipes.map((e) => ({ id: e.id, titulo: `${e.codigo} · ${e.nome}`, subtitulo: e.local, grupo: 'Equipes' as const })),
    ...data.elementos.map((e) => ({
      id: e.id,
      titulo: `${e.codigo} · ${e.pavimentoNumero}º pavimento`,
      subtitulo: e.tipo === 'laje' ? 'Laje' : 'Pilar',
      grupo: 'Elementos' as const,
    })),
  ]
  // Casa contra título e subtítulo; "p12 6" encontra P12 do 6º pavimento.
  const partes = q.split(/\s+/)
  return todos.filter((r) => {
    const alvo = normalizar(`${r.titulo} ${r.subtitulo}`)
    return partes.every((p) => alvo.includes(p))
  }).slice(0, limite)
}
