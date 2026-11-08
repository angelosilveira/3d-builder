import { FORMULARIOS, SEVERIDADE_PESO } from './catalogo'
import type {
  AppSecData,
  Ativo,
  Pendencia,
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

/** Ordem de gravidade: 0 = crítica … 3 = baixa; 4 = sem vulnerabilidade aberta. */
export const ORDEM_SEV: Record<Severidade, number> = { critica: 0, alta: 1, media: 2, baixa: 3 }
export const SEM_VULN = 4

/**
 * Índices pré-calculados sobre o inventário. Arrays tipados indexados pela
 * posição do ativo em `data.ativos` — é o que a cena 3D consome por instância.
 */
export interface Indice {
  agora: number
  posAtivo: Map<string, number>
  ativoPorId: Map<string, Ativo>
  vulnsPorAtivo: Map<string, Vulnerabilidade[]>
  pendPorAtivo: Map<string, Pendencia[]>
  ativosPorProjeto: Map<string, Ativo[]>
  ativosPorAnalista: Map<string, Ativo[]>
  /** Pior severidade aberta (ORDEM_SEV) por ativo. */
  piorSeveridade: Uint8Array
  abertas: Uint16Array
  risco: Float32Array
  pendVencida: Uint8Array
}

export function criarIndice(data: AppSecData): Indice {
  const agora = new Date(data.geradoEm).getTime()
  const n = data.ativos.length
  const posAtivo = new Map<string, number>()
  const ativoPorId = new Map<string, Ativo>()
  const ativosPorProjeto = new Map<string, Ativo[]>()
  const ativosPorAnalista = new Map<string, Ativo[]>()
  data.ativos.forEach((a, i) => {
    posAtivo.set(a.id, i)
    ativoPorId.set(a.id, a)
    ;(ativosPorProjeto.get(a.projetoId) ?? ativosPorProjeto.set(a.projetoId, []).get(a.projetoId)!).push(a)
    ;(ativosPorAnalista.get(a.analistaId) ?? ativosPorAnalista.set(a.analistaId, []).get(a.analistaId)!).push(a)
  })

  const vulnsPorAtivo = new Map<string, Vulnerabilidade[]>()
  const piorSeveridade = new Uint8Array(n).fill(SEM_VULN)
  const abertas = new Uint16Array(n)
  const risco = new Float32Array(n)
  for (const v of data.vulnerabilidades) {
    ;(vulnsPorAtivo.get(v.ativoId) ?? vulnsPorAtivo.set(v.ativoId, []).get(v.ativoId)!).push(v)
    if (!vulnAberta(v)) continue
    const i = posAtivo.get(v.ativoId)
    if (i === undefined) continue
    abertas[i]++
    piorSeveridade[i] = Math.min(piorSeveridade[i], ORDEM_SEV[v.severidade])
    risco[i] += SEVERIDADE_PESO[v.severidade] * (vulnVencida(v, agora) ? 1.5 : 1)
  }
  data.ativos.forEach((a, i) => {
    if (a.exposicao === 'internet') risco[i] *= 1.4
    if (a.criticidade === 'alta') risco[i] *= 1.2
  })

  const pendPorAtivo = new Map<string, Pendencia[]>()
  const pendVencida = new Uint8Array(n)
  for (const p of data.pendencias) {
    ;(pendPorAtivo.get(p.ativoId) ?? pendPorAtivo.set(p.ativoId, []).get(p.ativoId)!).push(p)
    const i = posAtivo.get(p.ativoId)
    if (i !== undefined && pendenciaVencida(p, agora)) pendVencida[i] = 1
  }

  return { agora, posAtivo, ativoPorId, vulnsPorAtivo, pendPorAtivo, ativosPorProjeto, ativosPorAnalista, piorSeveridade, abertas, risco, pendVencida }
}

/* ---------------------------- Filtros ---------------------------- */

export interface Filtros {
  /** Vazio = todos. */
  tipos: TipoAtivo[]
  status: StatusQualificacao[]
  /** Só ativos com vulnerabilidade aberta desta severidade ou pior. */
  severidade: Severidade | null
  analistaId: string | null
  areaId: string | null
  apenasPendenciaVencida: boolean
}

export const FILTROS_VAZIOS: Filtros = {
  tipos: [],
  status: [],
  severidade: null,
  analistaId: null,
  areaId: null,
  apenasPendenciaVencida: false,
}

export const filtrosAtivos = (f: Filtros) =>
  f.tipos.length + f.status.length + (f.severidade ? 1 : 0) + (f.analistaId ? 1 : 0) + (f.areaId ? 1 : 0) + (f.apenasPendenciaVencida ? 1 : 0)

/** Máscara (1 = passa no filtro) alinhada a `data.ativos`. */
export function mascaraFiltro(data: AppSecData, idx: Indice, f: Filtros): Uint8Array {
  const mask = new Uint8Array(data.ativos.length)
  const limiteSev = f.severidade ? ORDEM_SEV[f.severidade] : SEM_VULN
  data.ativos.forEach((a, i) => {
    if (f.tipos.length && !f.tipos.includes(a.tipo)) return
    if (f.status.length && !f.status.includes(a.qualificacao.status)) return
    if (f.severidade && idx.piorSeveridade[i] > limiteSev) return
    if (f.analistaId && a.analistaId !== f.analistaId) return
    if (f.areaId && a.areaId !== f.areaId) return
    if (f.apenasPendenciaVencida && !idx.pendVencida[i]) return
    mask[i] = 1
  })
  return mask
}

/* ---------------------------- KPIs ---------------------------- */

export interface Kpis {
  ativos: number
  aprovadosPct: number
  rascunhos: number
  reprovados: number
  requalificacaoVencida: number
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
  const vigentes = ativos.filter((a) => a.qualificacao.status !== 'depreciado')
  const vulns = data.vulnerabilidades.filter((v) => dentro(v.ativoId))
  const pend = data.pendencias.filter((p) => dentro(p.ativoId))
  const criticas = vulns.filter((v) => v.severidade === 'critica' && vulnAberta(v))
  return {
    ativos: ativos.length,
    aprovadosPct: vigentes.length ? vigentes.filter((a) => a.qualificacao.status === 'aprovado').length / vigentes.length : 0,
    rascunhos: ativos.filter((a) => a.qualificacao.status === 'rascunho').length,
    reprovados: ativos.filter((a) => a.qualificacao.status === 'reprovado').length,
    requalificacaoVencida: ativos.filter((a) => a.qualificacao.validadeAte && new Date(a.qualificacao.validadeAte).getTime() < agora).length,
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

/* ---------------------------- Formulário ---------------------------- */

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

/**
 * Respostas do formulário de qualificação, derivadas de forma estável do
 * ativo (evita guardar ~50 mil respostas em memória). Rascunhos têm parte
 * em branco; reprovados têm respostas negativas.
 */
export function respostasDo(ativo: Ativo): Record<string, Resposta> {
  const perguntas = FORMULARIOS[ativo.tipo].flatMap((s) => s.perguntas)
  const respondidas = Math.round(perguntas.length * ativo.qualificacao.progresso)
  const out: Record<string, Resposta> = {}
  perguntas.forEach((p, i) => {
    const h = hash(`${ativo.id}:${p.id}`)
    if (i >= respondidas) {
      out[p.id] = null
      return
    }
    switch (ativo.qualificacao.status) {
      case 'reprovado':
        out[p.id] = h < 0.3 ? 'nao' : h < 0.45 ? 'parcial' : 'sim'
        break
      case 'rascunho':
        out[p.id] = h < 0.12 ? 'nao' : h < 0.3 ? 'parcial' : h < 0.36 ? 'nao_se_aplica' : 'sim'
        break
      default:
        out[p.id] = h < 0.08 ? 'nao_se_aplica' : h < 0.14 ? 'parcial' : 'sim'
    }
  })
  return out
}

/* ---------------------------- Busca ---------------------------- */

export interface ResultadoBusca {
  tipo: 'ativo' | 'projeto' | 'vulnerabilidade' | 'analista'
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
  for (const v of data.vulnerabilidades) {
    if (out.length >= limite) break
    add({ tipo: 'vulnerabilidade', id: v.id, titulo: `${v.codigo} · ${v.titulo}`, detalhe: v.cwe }, `${v.codigo} ${v.titulo} ${v.cwe}`)
  }
  return out
}

