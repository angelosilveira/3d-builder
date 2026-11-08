import { DOCUMENTOS_OBRIGATORIOS } from './catalogo'
import { documentosFaltando, type Filtros, type Indice, maturidadeMedia } from './derived'
import type { AppSecData, Area, Ativo, Qualificacao } from './types'

/**
 * Gamificação ligada a dados reais: a pontuação de postura sobe quando a
 * postura de segurança melhora de verdade (mais aprovações, maturidade,
 * documentação completa, prazos em dia, menos críticas abertas).
 */

/** Peso de cada componente na pontuação (soma = 1.000). */
export const PESOS = {
  aprovacao: 300,
  maturidade: 250,
  documentacao: 150,
  prazos: 150,
  criticas: 150,
} as const

export type Componente = keyof typeof PESOS

export const COMPONENTE_LABEL: Record<Componente, string> = {
  aprovacao: 'Aprovação',
  maturidade: 'Maturidade',
  documentacao: 'Documentação',
  prazos: 'Prazos em dia',
  criticas: 'Sem críticas abertas',
}

export interface Pontuacao {
  total: number
  /** Fração atingida (0–1) de cada componente. */
  fracoes: Record<Componente, number>
}

/** Pontuação de postura (0–1.000) de um conjunto de ativos (todos, por padrão). */
export function pontuacao(data: AppSecData, idx: Indice, ativos: Ativo[] = data.ativos): Pontuacao {
  const avaliados = ativos.filter((a) => {
    const q = idx.vigente.get(a.id)
    return q && q.status !== 'depreciado'
  })
  const n = avaliados.length
  if (n === 0) {
    const zero = { aprovacao: 0, maturidade: 0, documentacao: 0, prazos: 0, criticas: 0 }
    return { total: 0, fracoes: zero }
  }
  let aprovados = 0
  let docsFaltando = 0
  let docsExigidos = 0
  let vencidos = 0
  let criticos = 0
  for (const a of avaliados) {
    const i = idx.posAtivo.get(a.id)!
    const q = idx.vigente.get(a.id)!
    if (q.status === 'aprovado') aprovados++
    docsFaltando += idx.docsFaltando[i]
    docsExigidos += DOCUMENTOS_OBRIGATORIOS[a.tipo].length
    if (idx.prazoVencido[i]) vencidos++
    if (idx.piorSeveridade[i] === 0) criticos++
  }
  const fracoes: Record<Componente, number> = {
    aprovacao: aprovados / n,
    maturidade: (maturidadeMedia(idx, avaliados) - 1) / 4,
    // Por documento (não por ativo): cada envio já conta pontos.
    documentacao: docsExigidos ? 1 - docsFaltando / docsExigidos : 1,
    prazos: 1 - vencidos / n,
    // Críticas pesam mais: 1/3 dos ativos com crítica já zera o componente.
    criticas: Math.max(0, 1 - (criticos / n) * 3),
  }
  const total = (Object.keys(PESOS) as Componente[]).reduce((s, k) => s + PESOS[k] * fracoes[k], 0)
  return { total: Math.round(total), fracoes }
}

export interface Nivel {
  ordem: number
  nome: string
  min: number
}

export const NIVEIS: Nivel[] = [
  { ordem: 1, nome: 'Exposto', min: 0 },
  { ordem: 2, nome: 'Vigilante', min: 400 },
  { ordem: 3, nome: 'Sentinela', min: 550 },
  { ordem: 4, nome: 'Guardião', min: 700 },
  { ordem: 5, nome: 'Fortaleza', min: 850 },
]

export function nivelDe(total: number): { atual: Nivel; proximo: Nivel | null; progresso: number } {
  let i = 0
  while (i + 1 < NIVEIS.length && total >= NIVEIS[i + 1].min) i++
  const atual = NIVEIS[i]
  const proximo = NIVEIS[i + 1] ?? null
  const progresso = proximo ? (total - atual.min) / (proximo.min - atual.min) : 1
  return { atual, proximo, progresso: Math.min(1, Math.max(0, progresso)) }
}

export interface PosicaoArea {
  area: Area
  pontos: number
  nivel: Nivel
  /** 1, 2, 3… */
  posicao: number
}

export function rankingAreas(data: AppSecData, idx: Indice): PosicaoArea[] {
  return data.areas
    .map((area) => {
      const pontos = pontuacao(
        data,
        idx,
        data.ativos.filter((a) => a.areaId === area.id),
      ).total
      return { area, pontos, nivel: nivelDe(pontos).atual, posicao: 0 }
    })
    .sort((a, b) => b.pontos - a.pontos)
    .map((p, i) => ({ ...p, posicao: i + 1 }))
}

export interface Conquista {
  id: 'sem_criticas' | 'documentacao' | 'em_dia' | 'maduro' | 'aprovado'
  nome: string
  descricao: string
  obtida: boolean
}

/** Conquistas de um projeto (ou de qualquer conjunto de ativos). */
export function conquistas(idx: Indice, ativos: Ativo[]): Conquista[] {
  const vigentes = ativos.map((a) => idx.vigente.get(a.id)).filter((q): q is Qualificacao => !!q && q.status !== 'depreciado')
  const pos = ativos.map((a) => idx.posAtivo.get(a.id)!)
  const aprovadas = vigentes.filter((q) => q.status === 'aprovado').length
  return [
    {
      id: 'sem_criticas',
      nome: 'Blindado',
      descricao: 'Nenhuma vulnerabilidade crítica aberta',
      obtida: pos.every((i) => idx.piorSeveridade[i] !== 0),
    },
    {
      id: 'documentacao',
      nome: 'Tudo documentado',
      descricao: 'Todos os documentos obrigatórios enviados',
      obtida: vigentes.every((q) => documentosFaltando(q, idx.docsPorQual.get(q.id) ?? []).length === 0),
    },
    { id: 'em_dia', nome: 'Em dia', descricao: 'Nenhum prazo vencido', obtida: pos.every((i) => !idx.prazoVencido[i]) },
    { id: 'maduro', nome: 'Maduro', descricao: 'Maturidade média 4 ou mais', obtida: vigentes.length > 0 && maturidadeMedia(idx, ativos) >= 4 },
    {
      id: 'aprovado',
      nome: 'Aprovado',
      descricao: '90% ou mais das qualificações aprovadas',
      obtida: vigentes.length > 0 && aprovadas / vigentes.length >= 0.9,
    },
  ]
}

export interface Missao {
  id: string
  titulo: string
  descricao: string
  /** Quanto do objetivo já está cumprido (0–1). */
  progresso: number
  /** Pontos de postura estimados ao concluir. */
  recompensa: number
  /** O que o botão "Ir" aplica. */
  filtros: Partial<Filtros>
  foco: { tipo: 'area' | 'projeto' | 'analista'; id: string }
}

/** Missões sugeridas: os três pontos de maior alavanca na postura agora. */
export function missoes(data: AppSecData, idx: Indice): Missao[] {
  const avaliados = data.ativos.filter((a) => idx.vigente.get(a.id)?.status !== 'depreciado').length || 1
  const out: Missao[] = []

  // 1) Área com mais prazos vencidos.
  const porArea = data.areas.map((area) => {
    const ativos = data.ativos.filter((a) => a.areaId === area.id)
    const vencidos = ativos.filter((a) => idx.prazoVencido[idx.posAtivo.get(a.id)!]).length
    return { area, vencidos, total: ativos.length }
  })
  const area = porArea.sort((a, b) => b.vencidos - a.vencidos)[0]
  if (area && area.vencidos > 0) {
    out.push({
      id: `prazos-${area.area.id}`,
      titulo: `Zerar prazos vencidos em ${area.area.nome}`,
      descricao: `${area.vencidos} ativos com qualificação ou pendência vencida`,
      progresso: 1 - area.vencidos / area.total,
      recompensa: Math.round((area.vencidos / avaliados) * PESOS.prazos),
      filtros: { areaId: area.area.id, apenasPrazoVencido: true },
      foco: { tipo: 'area', id: area.area.id },
    })
  }

  // 2) Projeto com mais qualificações sem documentos obrigatórios.
  const porProjeto = data.projetos.map((projeto) => {
    const ativos = idx.ativosPorProjeto.get(projeto.id) ?? []
    const faltando = ativos.filter((a) => idx.docsFaltando[idx.posAtivo.get(a.id)!] > 0).length
    return { projeto, faltando, total: ativos.length }
  })
  const proj = porProjeto.sort((a, b) => b.faltando - a.faltando)[0]
  if (proj && proj.faltando > 0) {
    out.push({
      id: `docs-${proj.projeto.id}`,
      titulo: `Completar a documentação de ${proj.projeto.nome}`,
      descricao: `${proj.faltando} qualificações sem os documentos obrigatórios`,
      progresso: 1 - proj.faltando / proj.total,
      recompensa: Math.round((proj.faltando / avaliados) * PESOS.documentacao),
      filtros: { apenasDocsFaltando: true },
      foco: { tipo: 'projeto', id: proj.projeto.id },
    })
  }

  // 3) Analista com mais rascunhos parados.
  const porAnalista = data.analistas.map((analista) => {
    const ativos = idx.ativosPorAnalista.get(analista.id) ?? []
    const rascunhos = ativos.filter((a) => idx.vigente.get(a.id)?.status === 'rascunho').length
    return { analista, rascunhos, total: ativos.length }
  })
  const ana = porAnalista.sort((a, b) => b.rascunhos - a.rascunhos)[0]
  if (ana && ana.rascunhos > 0) {
    out.push({
      id: `rascunhos-${ana.analista.id}`,
      titulo: `Destravar os rascunhos de ${ana.analista.nome.split(' ')[0]}`,
      descricao: `${ana.rascunhos} formulários em rascunho aguardando revisão`,
      progresso: 1 - ana.rascunhos / ana.total,
      recompensa: Math.round((ana.rascunhos / avaliados) * PESOS.aprovacao),
      filtros: { analistaId: ana.analista.id, status: ['rascunho'] },
      foco: { tipo: 'analista', id: ana.analista.id },
    })
  }
  return out
}
