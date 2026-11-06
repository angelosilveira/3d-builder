import type { EtapaPavimento, ObraData, Obra, Pavimento } from './types'

/**
 * Lógica do cronograma 4D. Funções puras: dado o cronograma previsto, o que
 * foi executado até hoje e uma semana qualquer, dizem quanto de cada
 * pavimento existe naquela data — no previsto ou no executado (com projeção
 * para datas futuras a partir do ritmo atual).
 */

export type Fonte = 'previsto' | 'executado'
export type TipoEtapa = 'estrutura' | 'alvenaria'
export type StatusPavimento = 'futuro' | 'em_execucao' | 'concluido'
export type Desvio = 'nao_iniciado' | 'adiantado' | 'no_prazo' | 'atrasado'

const SEMANA_MS = 7 * 24 * 3600 * 1000
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export const semanaParaData = (obra: Pick<Obra, 'inicio'>, semana: number) =>
  new Date(new Date(obra.inicio).getTime() + semana * SEMANA_MS)

export const dataParaSemana = (obra: Pick<Obra, 'inicio'>, data: Date) =>
  (data.getTime() - new Date(obra.inicio).getTime()) / SEMANA_MS

export function progressoPrevisto(etapa: EtapaPavimento, semana: number): number {
  const { inicio, fim } = etapa.previsto
  return clamp01((semana - inicio) / (fim - inicio))
}

/**
 * Atraso (em semanas) de um tipo de etapa, medido na frente de serviço
 * ativa: término projetado no ritmo atual menos o término previsto.
 */
export function atrasoProjetado(pavimentos: Pavimento[], tipo: TipoEtapa, hoje: number): number {
  const etapas = pavimentos.map((p) => p[tipo])
  const ativa = etapas.find((e) => e.executado.inicio !== null && e.executado.fim === null)
  if (ativa && ativa.executado.inicio !== null) {
    const decorrido = Math.max(hoje - ativa.executado.inicio, 1e-6)
    const ritmo = ativa.executado.progresso / decorrido // fração por semana
    const restante = ritmo > 0 ? (1 - ativa.executado.progresso) / ritmo : ativa.previsto.fim - ativa.previsto.inicio
    return hoje + restante - ativa.previsto.fim
  }
  const concluidas = etapas.filter((e) => e.executado.fim !== null)
  const ultima = concluidas[concluidas.length - 1]
  return ultima && ultima.executado.fim !== null ? ultima.executado.fim - ultima.previsto.fim : 0
}

export function progressoExecutado(etapa: EtapaPavimento, semana: number, hoje: number, atraso: number): number {
  const { inicio, fim, progresso } = etapa.executado
  const duracao = etapa.previsto.fim - etapa.previsto.inicio
  if (inicio !== null && fim !== null) return clamp01((semana - inicio) / (fim - inicio))
  if (inicio !== null) {
    if (semana <= hoje) return progresso * clamp01((semana - inicio) / Math.max(hoje - inicio, 1e-6))
    return clamp01(progresso + (semana - hoje) / duracao)
  }
  // Ainda não iniciada: só pode começar a partir de hoje, deslocada pelo atraso atual.
  const inicioProjetado = Math.max(hoje, etapa.previsto.inicio + atraso)
  return clamp01((semana - inicioProjetado) / duracao)
}

export interface EstadoPavimento {
  numero: number
  estrutura: number
  alvenaria: number
  status: StatusPavimento
}

export function estadosPavimentos(data: Pick<ObraData, 'obra' | 'pavimentos'>, semana: number, fonte: Fonte): EstadoPavimento[] {
  const hoje = data.obra.semanaAtual
  const atrasoE = atrasoProjetado(data.pavimentos, 'estrutura', hoje)
  const atrasoA = atrasoProjetado(data.pavimentos, 'alvenaria', hoje)
  return data.pavimentos.map((p) => {
    const estrutura =
      fonte === 'previsto' ? progressoPrevisto(p.estrutura, semana) : progressoExecutado(p.estrutura, semana, hoje, atrasoE)
    const alvenaria =
      fonte === 'previsto' ? progressoPrevisto(p.alvenaria, semana) : progressoExecutado(p.alvenaria, semana, hoje, atrasoA)
    const status: StatusPavimento =
      estrutura <= 0 ? 'futuro' : estrutura >= 1 && alvenaria >= 1 ? 'concluido' : 'em_execucao'
    return { numero: p.numero, estrutura, alvenaria, status }
  })
}

/** Números dos pavimentos cuja estrutura já começou na data (aparecem sólidos na cena). */
export function pavimentosVisiveis(data: Pick<ObraData, 'obra' | 'pavimentos'>, semana: number, fonte: Fonte = 'executado'): number[] {
  return estadosPavimentos(data, semana, fonte)
    .filter((e) => e.estrutura > 0)
    .map((e) => e.numero)
}

const combinado = (e: Pick<EstadoPavimento, 'estrutura' | 'alvenaria'>) => 0.6 * e.estrutura + 0.4 * e.alvenaria

/** Desvio de cada pavimento na data: executado comparado ao previsto. */
export function desviosPavimentos(data: Pick<ObraData, 'obra' | 'pavimentos'>, semana: number): Desvio[] {
  const exec = estadosPavimentos(data, semana, 'executado')
  const prev = estadosPavimentos(data, semana, 'previsto')
  return exec.map((e, i) => {
    const ce = combinado(e)
    const cp = combinado(prev[i])
    if (ce === 0 && cp === 0) return 'nao_iniciado'
    const diff = ce - cp
    if (diff > 0.08) return 'adiantado'
    if (diff < -0.08) return 'atrasado'
    return 'no_prazo'
  })
}

/** Avanço físico (0–1): fundação + média ponderada estrutura/alvenaria dos pavimentos. */
export function avancoFisico(data: Pick<ObraData, 'obra' | 'pavimentos'>, semana: number, fonte: Fonte): number {
  const { pesoFundacao, semanasFundacao } = data.obra
  const fundacao = clamp01(semana / semanasFundacao)
  const estados = estadosPavimentos(data, semana, fonte)
  const media = estados.reduce((s, e) => s + combinado(e), 0) / Math.max(estados.length, 1)
  return pesoFundacao * fundacao + (1 - pesoFundacao) * media
}

/** Altura "construída" em unidades de pavimento (soma dos progressos) — usada pela animação. */
export const alturaEmPavimentos = (estados: EstadoPavimento[], tipo: TipoEtapa) =>
  estados.reduce((s, e) => s + e[tipo], 0)

/** Semana em que o avanço executado (com projeção) chega a 100%. */
export function terminoProjetado(data: Pick<ObraData, 'obra' | 'pavimentos'>): number {
  const limite = data.obra.duracaoSemanas * 2
  for (let s = data.obra.semanaAtual; s <= limite; s += 0.5) {
    if (avancoFisico(data, s, 'executado') >= 0.999) return s
  }
  return limite
}

/** Semana em que o previsto chega a 100%. */
export function terminoPrevisto(data: Pick<ObraData, 'obra' | 'pavimentos'>): number {
  return Math.max(...data.pavimentos.map((p) => Math.max(p.estrutura.previsto.fim, p.alvenaria.previsto.fim)))
}
