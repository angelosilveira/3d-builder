import { DOCUMENTOS_OBRIGATORIOS, FORMULARIOS, SEVERIDADE_PESO, STATUS } from './catalogo'
import type {
  AppSecData,
  Ativo,
  CategoriaDocumento,
  Documento,
  Maturidade,
  Pendencia,
  Qualificacao,
  Resposta,
  Severidade,
  StatusQualificacao,
  TipoAtivo,
  Vulnerabilidade,
} from './types'

const DIA = 86400000

export const vulnAberta = (v: Pick<Vulnerabilidade, 'status'>) => v.status === 'aberta' || v.status === 'em_correcao'
export const vulnVencida = (v: Pick<Vulnerabilidade, 'status' | 'prazo'>, agora: number) =>
  vulnAberta(v) && new Date(v.prazo).getTime() < agora
export const pendenciaVencida = (p: Pick<Pendencia, 'status' | 'prazo'>, agora: number) =>
  p.status === 'aberta' && new Date(p.prazo).getTime() < agora
/** Qualificação em aberto (rascunho ou reprovada) que passou da data para ser resolvida. */
export const qualificacaoVencida = (q: Pick<Qualificacao, 'status' | 'prazo'>, agora: number) =>
  (q.status === 'rascunho' || q.status === 'reprovado') && new Date(q.prazo).getTime() < agora
/** Aprovada, mas passou da validade: precisa requalificar. */
export const requalificacaoVencida = (q: Pick<Qualificacao, 'validadeAte'>, agora: number) =>
  !!q.validadeAte && new Date(q.validadeAte).getTime() < agora

/** Categorias obrigatórias do formulário que ainda não têm documento enviado. */
export function documentosFaltando(q: Pick<Qualificacao, 'tipo' | 'status'>, docs: Documento[]): CategoriaDocumento[] {
  if (q.status === 'depreciado') return []
  const enviados = new Set(docs.map((d) => d.categoria))
  return DOCUMENTOS_OBRIGATORIOS[q.tipo].filter((c) => !enviados.has(c))
}

/** Ordem de gravidade: 0 = crítica … 3 = baixa; 4 = sem vulnerabilidade aberta. */
export const ORDEM_SEV: Record<Severidade, number> = { critica: 0, alta: 1, media: 2, baixa: 3 }
export const SEM_VULN = 4
const ORDEM_STATUS = new Map(STATUS.map((s, i) => [s, i]))

/**
 * Índices pré-calculados sobre o inventário. Arrays tipados indexados pela
 * posição do ativo em `data.ativos` — é o que a cena 3D consome por instância.
 */
export interface Indice {
  agora: number
  posAtivo: Map<string, number>
  ativoPorId: Map<string, Ativo>
  qualPorId: Map<string, Qualificacao>
  /** Qualificação atual de cada ativo. */
  vigente: Map<string, Qualificacao>
  /** Todas as qualificações do ativo, da mais recente para a mais antiga. */
  historico: Map<string, Qualificacao[]>
  docsPorQual: Map<string, Documento[]>
  pendPorQual: Map<string, Pendencia[]>
  vulnsPorAtivo: Map<string, Vulnerabilidade[]>
  pendPorAtivo: Map<string, Pendencia[]>
  ativosPorProjeto: Map<string, Ativo[]>
  /** Ativos cuja qualificação vigente está com o analista. */
  ativosPorAnalista: Map<string, Ativo[]>
  /** Índice do status (em STATUS) da qualificação vigente. */
  status: Uint8Array
  maturidade: Uint8Array
  /** Pior severidade aberta (ORDEM_SEV) por ativo. */
  piorSeveridade: Uint8Array
  abertas: Uint16Array
  risco: Float32Array
  pendVencida: Uint8Array
  /** Prazo vencido: da qualificação vigente ou de alguma pendência aberta. */
  prazoVencido: Uint8Array
  docsFaltando: Uint8Array
}

function agrupar<T>(lista: T[], chave: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of lista) {
    const k = chave(item)
    const l = out.get(k)
    if (l) l.push(item)
    else out.set(k, [item])
  }
  return out
}

export function criarIndice(data: AppSecData): Indice {
  const agora = new Date(data.geradoEm).getTime()
  const n = data.ativos.length
  const posAtivo = new Map(data.ativos.map((a, i) => [a.id, i]))
  const ativoPorId = new Map(data.ativos.map((a) => [a.id, a]))
  const qualPorId = new Map(data.qualificacoes.map((q) => [q.id, q]))
  const historico = agrupar(data.qualificacoes, (q) => q.ativoId)
  historico.forEach((l) => l.sort((a, b) => b.abertaEm.localeCompare(a.abertaEm)))
  const vigente = new Map<string, Qualificacao>()
  for (const q of data.qualificacoes) if (q.vigente) vigente.set(q.ativoId, q)

  const docsPorQual = agrupar(data.documentos, (d) => d.qualificacaoId)
  const pendPorQual = agrupar(data.pendencias, (p) => p.qualificacaoId)
  const pendPorAtivo = agrupar(data.pendencias, (p) => p.ativoId)
  const vulnsPorAtivo = agrupar(data.vulnerabilidades, (v) => v.ativoId)
  const ativosPorProjeto = agrupar(data.ativos, (a) => a.projetoId)
  const ativosPorAnalista = agrupar(
    data.ativos.filter((a) => vigente.has(a.id)),
    (a) => vigente.get(a.id)!.analistaId,
  )

  const status = new Uint8Array(n)
  const maturidade = new Uint8Array(n)
  const piorSeveridade = new Uint8Array(n).fill(SEM_VULN)
  const abertas = new Uint16Array(n)
  const risco = new Float32Array(n)
  const pendVencida = new Uint8Array(n)
  const prazoVencido = new Uint8Array(n)
  const docsFaltando = new Uint8Array(n)

  for (const v of data.vulnerabilidades) {
    if (!vulnAberta(v)) continue
    const i = posAtivo.get(v.ativoId)
    if (i === undefined) continue
    abertas[i]++
    piorSeveridade[i] = Math.min(piorSeveridade[i], ORDEM_SEV[v.severidade])
    risco[i] += SEVERIDADE_PESO[v.severidade] * (vulnVencida(v, agora) ? 1.5 : 1)
  }
  data.ativos.forEach((a, i) => {
    const q = vigente.get(a.id)
    if (q) {
      status[i] = ORDEM_STATUS.get(q.status) ?? 0
      maturidade[i] = q.maturidade
      docsFaltando[i] = documentosFaltando(q, docsPorQual.get(q.id) ?? []).length
      if (qualificacaoVencida(q, agora)) prazoVencido[i] = 1
      // Qualificação reprovada ou vencida também pesa no risco.
      if (q.status === 'reprovado') risco[i] += 4
    }
    if ((pendPorAtivo.get(a.id) ?? []).some((p) => pendenciaVencida(p, agora))) {
      pendVencida[i] = 1
      prazoVencido[i] = 1
    }
    if (a.exposicao === 'internet') risco[i] *= 1.4
    if (a.criticidade === 'alta') risco[i] *= 1.2
  })

  return {
    agora,
    posAtivo,
    ativoPorId,
    qualPorId,
    vigente,
    historico,
    docsPorQual,
    pendPorQual,
    vulnsPorAtivo,
    pendPorAtivo,
    ativosPorProjeto,
    ativosPorAnalista,
    status,
    maturidade,
    piorSeveridade,
    abertas,
    risco,
    pendVencida,
    prazoVencido,
    docsFaltando,
  }
}

/** Status da qualificação vigente do ativo. */
export const statusDoAtivo = (idx: Indice, i: number): StatusQualificacao => STATUS[idx.status[i]]

/* ---------------------------- Filtros ---------------------------- */

export interface Filtros {
  /** Vazio = todos. */
  tipos: TipoAtivo[]
  status: StatusQualificacao[]
  maturidades: Maturidade[]
  /** Só ativos com vulnerabilidade aberta desta severidade ou pior. */
  severidade: Severidade | null
  analistaId: string | null
  areaId: string | null
  apenasPrazoVencido: boolean
  apenasDocsFaltando: boolean
}

export const FILTROS_VAZIOS: Filtros = {
  tipos: [],
  status: [],
  maturidades: [],
  severidade: null,
  analistaId: null,
  areaId: null,
  apenasPrazoVencido: false,
  apenasDocsFaltando: false,
}

export const filtrosAtivos = (f: Filtros) =>
  f.tipos.length +
  f.status.length +
  f.maturidades.length +
  (f.severidade ? 1 : 0) +
  (f.analistaId ? 1 : 0) +
  (f.areaId ? 1 : 0) +
  (f.apenasPrazoVencido ? 1 : 0) +
  (f.apenasDocsFaltando ? 1 : 0)

/** Máscara (1 = passa no filtro) alinhada a `data.ativos`. */
export function mascaraFiltro(data: AppSecData, idx: Indice, f: Filtros): Uint8Array {
  const mask = new Uint8Array(data.ativos.length)
  const limiteSev = f.severidade ? ORDEM_SEV[f.severidade] : SEM_VULN
  data.ativos.forEach((a, i) => {
    if (f.tipos.length && !f.tipos.includes(a.tipo)) return
    if (f.status.length && !f.status.includes(statusDoAtivo(idx, i))) return
    if (f.maturidades.length && !f.maturidades.includes(idx.maturidade[i] as Maturidade)) return
    if (f.severidade && idx.piorSeveridade[i] > limiteSev) return
    if (f.analistaId && idx.vigente.get(a.id)?.analistaId !== f.analistaId) return
    if (f.areaId && a.areaId !== f.areaId) return
    if (f.apenasPrazoVencido && !idx.prazoVencido[i]) return
    if (f.apenasDocsFaltando && !idx.docsFaltando[i]) return
    mask[i] = 1
  })
  return mask
}

/* ---------------------------- KPIs ---------------------------- */

export interface Kpis {
  ativos: number
  aprovadosPct: number
  maturidadeMedia: number
  rascunhos: number
  reprovados: number
  qualificacoesVencidas: number
  requalificacaoVencida: number
  documentosFaltando: number
  criticasAbertas: number
  criticasNovasSemana: number
  vulnsVencidas: number
  pendenciasVencidas: number
  pendenciasVencendo7d: number
}

export function calcularKpis(data: AppSecData, idx: Indice, mask?: Uint8Array): Kpis {
  const { agora } = idx
  const dentro = (ativoId: string) => !mask || mask[idx.posAtivo.get(ativoId) ?? -1] === 1
  const ativos = data.ativos.filter((a) => dentro(a.id))
  const vigentes = ativos.map((a) => idx.vigente.get(a.id)).filter((q): q is Qualificacao => !!q)
  const ativasQ = vigentes.filter((q) => q.status !== 'depreciado')
  const vulns = data.vulnerabilidades.filter((v) => dentro(v.ativoId))
  const pend = data.pendencias.filter((p) => dentro(p.ativoId))
  const criticas = vulns.filter((v) => v.severidade === 'critica' && vulnAberta(v))
  return {
    ativos: ativos.length,
    aprovadosPct: ativasQ.length ? ativasQ.filter((q) => q.status === 'aprovado').length / ativasQ.length : 0,
    maturidadeMedia: ativasQ.length ? ativasQ.reduce((s, q) => s + q.maturidade, 0) / ativasQ.length : 0,
    rascunhos: vigentes.filter((q) => q.status === 'rascunho').length,
    reprovados: vigentes.filter((q) => q.status === 'reprovado').length,
    qualificacoesVencidas: vigentes.filter((q) => qualificacaoVencida(q, agora)).length,
    requalificacaoVencida: vigentes.filter((q) => requalificacaoVencida(q, agora)).length,
    documentosFaltando: vigentes.filter((q) => documentosFaltando(q, idx.docsPorQual.get(q.id) ?? []).length > 0).length,
    criticasAbertas: criticas.length,
    criticasNovasSemana: criticas.filter((v) => new Date(v.abertaEm).getTime() > agora - 7 * DIA).length,
    vulnsVencidas: vulns.filter((v) => vulnVencida(v, agora)).length,
    pendenciasVencidas: pend.filter((p) => pendenciaVencida(p, agora)).length,
    pendenciasVencendo7d: pend.filter((p) => {
      const t = new Date(p.prazo).getTime()
      return p.status === 'aberta' && t >= agora && t < agora + 7 * DIA
    }).length,
  }
}

/** Contagem de vulnerabilidades abertas por severidade. */
export function abertasPorSeveridade(vulns: Vulnerabilidade[]): Record<Severidade, number> {
  const out = { critica: 0, alta: 0, media: 0, baixa: 0 }
  for (const v of vulns) if (vulnAberta(v)) out[v.severidade]++
  return out
}

/** Contagem por status das qualificações vigentes de uma lista de ativos. */
export function contarStatus(idx: Indice, ativos: Ativo[]): Record<StatusQualificacao, number> {
  const out = { aprovado: 0, rascunho: 0, reprovado: 0, depreciado: 0 }
  for (const a of ativos) {
    const q = idx.vigente.get(a.id)
    if (q) out[q.status]++
  }
  return out
}

/** Maturidade média das qualificações vigentes (ignora depreciadas). */
export function maturidadeMedia(idx: Indice, ativos: Ativo[]): number {
  const qs = ativos.map((a) => idx.vigente.get(a.id)).filter((q): q is Qualificacao => !!q && q.status !== 'depreciado')
  return qs.length ? qs.reduce((s, q) => s + q.maturidade, 0) / qs.length : 0
}

/* ---------------------------- Formulário ---------------------------- */

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

/**
 * Respostas do formulário de uma qualificação, derivadas de forma estável
 * (evita guardar ~100 mil respostas em memória). Rascunhos têm parte em
 * branco; reprovadas têm respostas negativas; maturidade alta tem menos "parcial".
 */
export function respostasDo(q: Qualificacao): Record<string, Resposta> {
  const perguntas = FORMULARIOS[q.tipo].flatMap((s) => s.perguntas)
  const respondidas = Math.round(perguntas.length * q.progresso)
  const parcial = 0.3 - q.maturidade * 0.05
  const out: Record<string, Resposta> = {}
  perguntas.forEach((p, i) => {
    const h = hash(`${q.id}:${p.id}`)
    if (i >= respondidas) {
      out[p.id] = null
      return
    }
    switch (q.status) {
      case 'reprovado':
        out[p.id] = h < 0.3 ? 'nao' : h < 0.45 ? 'parcial' : 'sim'
        break
      case 'rascunho':
        out[p.id] = h < 0.12 ? 'nao' : h < 0.12 + parcial ? 'parcial' : h < 0.42 ? 'nao_se_aplica' : 'sim'
        break
      default:
        out[p.id] = h < 0.08 ? 'nao_se_aplica' : h < 0.08 + parcial * 0.5 ? 'parcial' : 'sim'
    }
  })
  return out
}

/* ---------------------------- Busca ---------------------------- */

export interface ResultadoBusca {
  tipo: 'ativo' | 'qualificacao' | 'projeto' | 'vulnerabilidade' | 'analista'
  id: string
  titulo: string
  detalhe: string
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function buscar(data: AppSecData, termo: string, limite = 8): ResultadoBusca[] {
  const partes = normalizar(termo.trim()).split(/\s+/).filter(Boolean)
  if (!partes.length) return []
  const casa = (texto: string) => {
    const alvo = normalizar(texto)
    return partes.every((p) => alvo.includes(p))
  }
  const out: ResultadoBusca[] = []
  const add = (r: ResultadoBusca, texto: string) => {
    if (out.length < limite && casa(texto)) out.push(r)
  }
  for (const a of data.analistas) add({ tipo: 'analista', id: a.id, titulo: a.nome, detalhe: 'Analista' }, a.nome)
  for (const p of data.projetos) add({ tipo: 'projeto', id: p.id, titulo: p.nome, detalhe: `${p.codigo} · Projeto` }, `${p.nome} ${p.codigo}`)
  for (const a of data.ativos) {
    if (out.length >= limite) break
    add({ tipo: 'ativo', id: a.id, titulo: a.nome, detalhe: `${a.codigo} · ${a.tecnologia}` }, `${a.nome} ${a.codigo}`)
  }
  // Qualificações só pelo código (QLF-…), para não duplicar os nomes de ativos.
  if (partes.some((p) => p.startsWith('qlf'))) {
    for (const q of data.qualificacoes) {
      if (out.length >= limite) break
      add({ tipo: 'qualificacao', id: q.id, titulo: q.codigo, detalhe: `Qualificação ${q.versaoFormulario}${q.vigente ? '' : ' · histórico'}` }, q.codigo)
    }
  }
  for (const v of data.vulnerabilidades) {
    if (out.length >= limite) break
    add({ tipo: 'vulnerabilidade', id: v.id, titulo: `${v.codigo} · ${v.titulo}`, detalhe: v.cwe }, `${v.codigo} ${v.titulo} ${v.cwe}`)
  }
  return out
}
