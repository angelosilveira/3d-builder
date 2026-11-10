import { clients, type Client } from '../data'
import { dias, HOJE, maisDias } from './base'

/* ---------------- Contas a receber ---------------- */

export type SituacaoFinanceira = 'em_dia' | 'a_vencer' | 'vence_hoje' | 'atrasado' | 'bloqueado'
export const SITUACAO_LABEL: Record<SituacaoFinanceira, string> = {
  em_dia: 'Em dia',
  a_vencer: 'A vencer',
  vence_hoje: 'Vence hoje',
  atrasado: 'Em atraso',
  bloqueado: 'Bloqueado',
}
/** Dias de atraso a partir dos quais o contrato é bloqueado por inadimplência. */
export const DIAS_BLOQUEIO = 30
const PRECO: Record<number, number> = { 300: 7990, 500: 9990, 800: 12990 }
export const mensalidade = (c: Client) => PRECO[c.speed] ?? 9990

export interface Fatura {
  id: string
  clientId: string
  due: string
  cents: number
}
export const faturaId = (clientId: string, due: string) => clientId + '|' + due
export const faturas: Fatura[] = clients.flatMap((c) => c.invoices.map((f) => ({ id: faturaId(c.id, f.due), clientId: c.id, due: f.due, cents: f.cents })))
const porCliente = new Map<string, Fatura[]>()
for (const f of faturas) porCliente.set(f.clientId, [...(porCliente.get(f.clientId) ?? []), f])
export const atraso = (f: Fatura) => dias(f.due, HOJE)

export type Pagas = Readonly<Record<string, true>>
export const faturasAbertas = (clientId: string, pagas: Pagas) => (porCliente.get(clientId) ?? []).filter((f) => !pagas[f.id])

export function situacaoFinanceira(clientId: string, pagas: Pagas): SituacaoFinanceira {
  let pior = -Infinity
  for (const f of faturasAbertas(clientId, pagas)) pior = Math.max(pior, atraso(f))
  if (pior === -Infinity) return 'em_dia'
  if (pior >= DIAS_BLOQUEIO) return 'bloqueado'
  if (pior > 0) return 'atrasado'
  return pior === 0 ? 'vence_hoje' : 'a_vencer'
}

/* ---------------- Contas a pagar ---------------- */

export type CategoriaConta = 'link' | 'postes' | 'energia' | 'folha' | 'impostos' | 'fornecedores' | 'obras' | 'frota' | 'aluguel' | 'software'
export const CATEGORIA_LABEL: Record<CategoriaConta, string> = {
  link: 'Link e trânsito IP',
  postes: 'Aluguel de postes',
  energia: 'Energia',
  folha: 'Folha de pagamento',
  impostos: 'Impostos e taxas',
  fornecedores: 'Fornecedores',
  obras: 'Obras',
  frota: 'Frota',
  aluguel: 'Aluguel',
  software: 'Sistemas',
}
export interface ContaPagar {
  id: string
  descricao: string
  fornecedor: string
  categoria: CategoriaConta
  vencimento: string
  cents: number
  /** Já estava paga antes de hoje. */
  quitada?: boolean
}
const conta = (id: string, descricao: string, fornecedor: string, categoria: CategoriaConta, vencimento: string, reaisValor: number, quitada = false): ContaPagar => ({
  id,
  descricao,
  fornecedor,
  categoria,
  vencimento,
  cents: Math.round(reaisValor * 100),
  quitada,
})
export const contasBase: ContaPagar[] = [
  conta('CP-1101', 'Folha de pagamento · outubro', 'Colaboradores', 'folha', '2026-11-05', 96300, true),
  conta('CP-1102', 'Link de contingência · 500 Mb/s', 'Sertão Telecom', 'link', '2026-11-03', 6900, true),
  conta('CP-1103', 'Lote de ONUs GPON (120 un.)', 'Distribuidora Óptica BA', 'fornecedores', '2026-11-08', 28600),
  conta('CP-1104', 'Manutenção de veículos', 'Oficina Central', 'frota', '2026-11-09', 1980),
  conta('CP-1105', 'Aluguel da sede', 'Imobiliária Aracatu', 'aluguel', '2026-11-10', 6500),
  conta('CP-1106', 'Trânsito IP dedicado · 2 Gb/s', 'Backbone Nordeste', 'link', '2026-11-12', 38400),
  conta('CP-1107', 'Combustível da frota', 'Posto Rota 30', 'frota', '2026-11-14', 7240),
  conta('CP-1108', 'Compartilhamento de postes · 2.560 pontos', 'Distribuidora de Energia', 'postes', '2026-11-15', 21760),
  conta('CP-1109', 'Sistemas de gestão e monitoramento', 'Licenças', 'software', '2026-11-16', 2890),
  conta('CP-1110', 'Energia dos pontos de acesso', 'Distribuidora de Energia', 'energia', '2026-11-18', 9870),
  conta('CP-1111', 'Simples Nacional, FUST e FUNTTEL', 'Receita Federal', 'impostos', '2026-11-20', 24900),
  conta('CP-1112', 'Adiantamento salarial', 'Colaboradores', 'folha', '2026-11-20', 38500),
  conta('CP-1113', 'Anel óptico Norte · medição 2', 'Valetec Infraestrutura', 'obras', '2026-11-22', 69000),
  conta('CP-1114', 'Torre Novo Horizonte · parcela 3', 'Verticalis Torres', 'obras', '2026-11-25', 97200),
  conta('CP-1115', 'Seguro da frota', 'Seguradora', 'frota', '2026-11-28', 3150),
  conta('CP-1116', 'Centro de Operações · medição 5', 'Construtora Serra Alta', 'obras', '2026-11-30', 285000),
]
export const contaVencida = (c: ContaPagar) => dias(c.vencimento, HOJE) > 0

/* ---------------- Indicadores ---------------- */

export const SALDO_INICIAL = 61240000

/** Histórico mensal (em centavos) do gráfico de fluxo de caixa; novembro é calculado. */
export const fluxoHistorico = [
  { mes: 'jun', entradas: 24120000, saidas: 21890000 },
  { mes: 'jul', entradas: 24680000, saidas: 26340000 },
  { mes: 'ago', entradas: 25210000, saidas: 23970000 },
  { mes: 'set', entradas: 25590000, saidas: 28120000 },
  { mes: 'out', entradas: 26080000, saidas: 30450000 },
]

export interface ResumoFinanceiro {
  mrr: number
  recebidoMes: number
  aReceber: number
  vencido: number
  /** Valor vencido sobre a receita mensal. */
  inadimplencia: number
  clientesAtrasados: number
  clientesBloqueados: number
  aPagar: number
  aPagarVencido: number
  contasVencidas: number
  aPagar7dias: number
  pagoMes: number
  saldo: number
  ticketMedio: number
}

export function resumoFinanceiro(pagas: Pagas, contasPagas: Pagas, extras: readonly ContaPagar[] = [], recebidoHoje = 0, pagoHoje = 0): ResumoFinanceiro {
  let mrr = 0,
    recebidoMes = 0,
    aReceber = 0,
    vencido = 0,
    clientesAtrasados = 0,
    clientesBloqueados = 0
  for (const c of clients) {
    const preco = mensalidade(c)
    mrr += preco
    const abertas = faturasAbertas(c.id, pagas)
    // A fatura de novembro conta como recebida quando não está mais em aberto.
    if (!abertas.some((f) => f.due.startsWith('2026-11'))) recebidoMes += preco
    let pior = -Infinity
    for (const f of abertas) {
      aReceber += f.cents
      if (atraso(f) > 0) vencido += f.cents
      pior = Math.max(pior, atraso(f))
    }
    if (pior >= DIAS_BLOQUEIO) clientesBloqueados++
    else if (pior > 0) clientesAtrasados++
  }
  const todas = [...contasBase, ...extras]
  const abertas = todas.filter((c) => !c.quitada && !contasPagas[c.id])
  const limite = maisDias(HOJE, 7)
  return {
    mrr,
    recebidoMes,
    aReceber,
    vencido,
    inadimplencia: vencido / mrr,
    clientesAtrasados,
    clientesBloqueados,
    aPagar: abertas.reduce((s, c) => s + c.cents, 0),
    aPagarVencido: abertas.filter(contaVencida).reduce((s, c) => s + c.cents, 0),
    contasVencidas: abertas.filter(contaVencida).length,
    aPagar7dias: abertas.filter((c) => c.vencimento <= limite).reduce((s, c) => s + c.cents, 0),
    pagoMes: todas.filter((c) => c.quitada || contasPagas[c.id]).reduce((s, c) => s + c.cents, 0),
    saldo: SALDO_INICIAL + recebidoHoje - pagoHoje,
    ticketMedio: mrr / clients.length,
  }
}

/** Faturamento, recebido e vencido por bairro (cidade) ou região (zona rural): colunas do mapa. */
export interface FinanceiroArea {
  id: string
  faturado: number
  recebido: number
  vencido: number
  clientes: number
}
export function financeiroPorArea(pagas: Pagas): Map<string, FinanceiroArea> {
  const out = new Map<string, FinanceiroArea>()
  for (const c of clients) {
    const id = c.districtId ?? c.regionId
    const a = out.get(id) ?? { id, faturado: 0, recebido: 0, vencido: 0, clientes: 0 }
    const preco = mensalidade(c)
    const abertas = faturasAbertas(c.id, pagas)
    a.faturado += preco
    a.clientes++
    if (!abertas.some((f) => f.due.startsWith('2026-11'))) a.recebido += preco
    for (const f of abertas) if (atraso(f) > 0) a.vencido += f.cents
    out.set(id, a)
  }
  return out
}
