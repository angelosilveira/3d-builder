import { clientById, demoIncidents, type Incident } from '../data'
import { obras, statusObra } from '../obras'
import { limitar } from './base'
import { estadoInicialOS, listarOS, osVencida, type OrdemServico } from './equipe'
import { situacaoEstoque, type SituacaoItem } from './estoque'
import { contasBase, contaVencida, type ResumoFinanceiro } from './financeiro'

/**
 * Saúde da operação (0–1.000): resume rede, atendimento, financeiro, estoque e
 * obras num número só. Sobe quando o problema real é resolvido.
 */
export const PILARES = { rede: 250, atendimento: 200, financeiro: 250, estoque: 150, obras: 150 } as const
export type Pilar = keyof typeof PILARES
export const PILAR_LABEL: Record<Pilar, string> = { rede: 'Rede', atendimento: 'Atendimento', financeiro: 'Financeiro', estoque: 'Estoque', obras: 'Obras' }

export interface Operacao {
  incidentes: readonly Incident[]
  /** Falhas compartilhadas (3+ quedas no mesmo ponto). */
  falhas: number
  ordens: readonly OrdemServico[]
  financeiro: ResumoFinanceiro
  estoque: readonly SituacaoItem[]
}

export function saudeOperacao(op: Operacao) {
  const offline = op.incidentes.filter((i) => i.kind === 'offline').length
  const instavel = op.incidentes.length - offline
  const ativas = obras.map((o) => statusObra(o)).filter((s) => s === 'em_andamento' || s === 'atrasada')
  const notaOS = (o: OrdemServico) => (osVencida(o) ? 0 : o.tecnicoId ? 1 : 0.5)
  const fracoes: Record<Pilar, number> = {
    rede: limitar(1 - op.falhas * 0.15 - offline * 0.025 - instavel * 0.012),
    atendimento: op.ordens.length ? op.ordens.reduce((s, o) => s + notaOS(o), 0) / op.ordens.length : 1,
    // Inadimplência de 15% da receita zera a parte de cobrança; cada conta vencida tira 25% da outra parte.
    financeiro: 0.7 * limitar(1 - op.financeiro.inadimplencia / 0.15) + 0.3 * limitar(1 - op.financeiro.contasVencidas * 0.25),
    estoque: op.estoque.length ? op.estoque.filter((s) => !s.critico).length / op.estoque.length : 1,
    obras: ativas.length ? ativas.reduce((s, st) => s + (st === 'atrasada' ? 0.4 : 1), 0) / ativas.length : 1,
  }
  const total = Math.round((Object.keys(PILARES) as Pilar[]).reduce((s, k) => s + PILARES[k] * fracoes[k], 0))
  return { total, fracoes }
}

export const NIVEIS_SAUDE = [
  { ordem: 1, nome: 'Crítica', min: 0 },
  { ordem: 2, nome: 'Instável', min: 450 },
  { ordem: 3, nome: 'Estável', min: 600 },
  { ordem: 4, nome: 'Eficiente', min: 750 },
  { ordem: 5, nome: 'Excelência', min: 880 },
]
export function nivelSaude(total: number) {
  let i = 0
  while (i + 1 < NIVEIS_SAUDE.length && total >= NIVEIS_SAUDE[i + 1].min) i++
  const atual = NIVEIS_SAUDE[i],
    proximo = NIVEIS_SAUDE[i + 1] ?? null
  return { atual, proximo, progresso: proximo ? limitar((total - atual.min) / (proximo.min - atual.min)) : 1 }
}

/** Nível do operador no turno: sobe a cada 250 XP. */
export const XP_POR_NIVEL = 250
export const nivelOperador = (xp: number) => ({ nivel: Math.floor(xp / XP_POR_NIVEL) + 1, progresso: (xp % XP_POR_NIVEL) / XP_POR_NIVEL, falta: XP_POR_NIVEL - (xp % XP_POR_NIVEL) })

/* ---------------- Missões do turno ---------------- */

export type Modulo = 'financeiro' | 'atendimento' | 'estoque' | 'equipe' | 'monitor' | 'missoes'
export interface Missao {
  id: string
  titulo: string
  descricao: string
  feito: number
  total: number
  xp: number
  modulo: Modulo
  concluida: boolean
}
export const PONTO_CRITICO = 'ERB-17'
const noPontoCritico = (i: Incident) => clientById.get(i.clientId)?.pointId === PONTO_CRITICO
const quedasIniciais = demoIncidents.filter(noPontoCritico).length
const contasVencidasIniciais = contasBase.filter((c) => !c.quitada && contaVencida(c))
const itensBaixosIniciais = situacaoEstoque({}, {}).filter((s) => s.critico).length
const semTecnicoIniciais = listarOS(demoIncidents, estadoInicialOS, 0).filter((o) => o.status === 'aberta').length
export const META_COBRANCA = 5

export function missoes(op: Operacao, contasPagas: Readonly<Record<string, true>>, cobrancas: number): Missao[] {
  const quedas = op.incidentes.filter(noPontoCritico).length
  const totalQuedas = Math.max(quedasIniciais, quedas)
  const semTecnico = op.ordens.filter((o) => o.status === 'aberta').length
  const totalDespacho = Math.max(semTecnicoIniciais, semTecnico)
  const criticos = op.estoque.filter((s) => s.critico).length
  const totalItens = Math.max(itensBaixosIniciais, criticos)
  const lista: Omit<Missao, 'concluida'>[] = [
    {
      id: 'torre',
      titulo: 'Restabelecer a Torre da Cidade',
      descricao: `Resolver as quedas dos clientes da ${PONTO_CRITICO}`,
      feito: totalQuedas - quedas,
      total: totalQuedas,
      xp: 150,
      modulo: 'atendimento',
    },
    {
      id: 'despacho',
      titulo: 'Ninguém esperando',
      descricao: 'Designar um técnico para cada ordem de serviço aberta',
      feito: totalDespacho - semTecnico,
      total: totalDespacho,
      xp: 70,
      modulo: 'atendimento',
    },
    { id: 'cobranca', titulo: 'Recuperar receita', descricao: `Registrar o pagamento de ${META_COBRANCA} faturas vencidas`, feito: Math.min(META_COBRANCA, cobrancas), total: META_COBRANCA, xp: 100, modulo: 'financeiro' },
    {
      id: 'contas',
      titulo: 'Fornecedores em dia',
      descricao: 'Quitar as contas a pagar que já venceram',
      feito: contasVencidasIniciais.filter((c) => contasPagas[c.id]).length,
      total: contasVencidasIniciais.length,
      xp: 80,
      modulo: 'financeiro',
    },
    { id: 'estoque', titulo: 'Almoxarifado abastecido', descricao: 'Repor os itens abaixo do estoque mínimo', feito: totalItens - criticos, total: totalItens, xp: 90, modulo: 'estoque' },
  ]
  return lista.map((m) => ({ ...m, concluida: m.total > 0 && m.feito >= m.total }))
}

/* ---------------- Conquistas ---------------- */

export interface Conquista {
  id: string
  nome: string
  descricao: string
  obtida: boolean
}
export function conquistas(op: Operacao, lista: readonly Missao[]): Conquista[] {
  return [
    { id: 'rede_limpa', nome: 'Rede 100%', descricao: 'Nenhum incidente aberto', obtida: op.incidentes.length === 0 },
    { id: 'sla', nome: 'No prazo', descricao: 'Nenhuma ordem vencida ou sem técnico', obtida: op.ordens.every((o) => !osVencida(o) && o.status !== 'aberta') },
    { id: 'caixa', nome: 'Contas em dia', descricao: 'Nenhuma conta a pagar vencida', obtida: op.financeiro.contasVencidas === 0 },
    { id: 'estoque', nome: 'Estoque seguro', descricao: 'Todos os itens acima do mínimo', obtida: op.estoque.every((s) => !s.critico) },
    { id: 'turno', nome: 'Turno perfeito', descricao: 'Todas as missões concluídas', obtida: lista.every((m) => m.concluida) },
  ]
}
