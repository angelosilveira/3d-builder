import { beforeEach, describe, expect, it } from 'vitest'
import { clientById, clients, demoIncidents } from '../data'
import { AGORA } from '../gestao/base'
import { estadoInicialOS, funcionarios, listarOS, osDoIncidente, tecnologiaDaOS, tecnicos, tecnicosLivres, tempoViagem } from '../gestao/equipe'
import { itensEstoque, KIT_OS, loteReposicao, situacaoEstoque } from '../gestao/estoque'
import { atraso, contasBase, DIAS_BLOQUEIO, faturas, financeiroPorArea, mensalidade, resumoFinanceiro, situacaoFinanceira } from '../gestao/financeiro'
import { conquistas, missoes, nivelSaude, PILARES, saudeOperacao, type Operacao } from '../gestao/saude'
import { useGestao, XP } from '../gestao/store'

const operacao = (incidentes = demoIncidents): Operacao => {
  const s = useGestao.getState()
  return {
    incidentes,
    falhas: incidentes === demoIncidents ? 1 : 0,
    ordens: listarOS(incidentes, s.os, Date.now() + 3600000),
    financeiro: resumoFinanceiro(s.pagas, s.contasPagas, s.contasExtras, s.recebidoHoje, s.pagoHoje),
    estoque: situacaoEstoque(s.consumo, s.pedidos),
  }
}
beforeEach(() => useGestao.getState().reiniciar())

describe('Financeiro', () => {
  it('a carteira é realista: maioria em dia, inadimplência de um dígito', () => {
    const r = resumoFinanceiro({}, {})
    expect(r.mrr).toBe(clients.reduce((s, c) => s + mensalidade(c), 0))
    expect(r.inadimplencia).toBeGreaterThan(0.03)
    expect(r.inadimplencia).toBeLessThan(0.1)
    expect(r.clientesBloqueados).toBeLessThan(clients.length * 0.04)
    expect(r.recebidoMes).toBeLessThan(r.mrr)
    expect(r.contasVencidas).toBe(2)
    expect(new Set(faturas.map((f) => f.id)).size).toBe(faturas.length)
  })

  it('a situação do cliente segue a fatura mais atrasada e melhora ao registrar o pagamento', () => {
    const bloqueada = faturas.filter((f) => atraso(f) >= DIAS_BLOQUEIO)[0]
    expect(situacaoFinanceira(bloqueada.clientId, {})).toBe('bloqueado')
    const doCliente = faturas.filter((f) => f.clientId === bloqueada.clientId)
    const antes = resumoFinanceiro({}, {})
    for (const f of doCliente) useGestao.getState().registrarPagamento(f)
    const s = useGestao.getState()
    expect(situacaoFinanceira(bloqueada.clientId, s.pagas)).toBe('em_dia')
    const depois = resumoFinanceiro(s.pagas, s.contasPagas, s.contasExtras, s.recebidoHoje, s.pagoHoje)
    expect(depois.vencido).toBeLessThan(antes.vencido)
    expect(depois.saldo - antes.saldo).toBe(doCliente.reduce((t, f) => t + f.cents, 0))
    expect(s.cobrancas).toBe(doCliente.filter((f) => atraso(f) > 0).length)
    expect(s.xp).toBeGreaterThanOrEqual(XP.cobranca)
    // Registrar duas vezes não duplica.
    useGestao.getState().registrarPagamento(doCliente[0])
    expect(useGestao.getState().recebidoHoje).toBe(s.recebidoHoje)
  })

  it('pagar uma conta reduz o saldo e as contas vencidas; as áreas somam a carteira', () => {
    const vencida = contasBase.find((c) => !c.quitada && c.vencimento < '2026-11-10')!
    useGestao.getState().pagarConta(vencida)
    const s = useGestao.getState()
    const r = resumoFinanceiro(s.pagas, s.contasPagas, s.contasExtras, s.recebidoHoje, s.pagoHoje)
    expect(r.contasVencidas).toBe(1)
    expect(r.saldo).toBe(resumoFinanceiro({}, {}).saldo - vencida.cents)
    const areas = [...financeiroPorArea({}).values()]
    expect(areas).toHaveLength(10)
    expect(areas.reduce((t, a) => t + a.clientes, 0)).toBe(clients.length)
    expect(areas.reduce((t, a) => t + a.faturado, 0)).toBe(r.mrr)
  })
})

describe('Estoque', () => {
  it('repor cobre o item com um pedido e lança a compra em contas a pagar', () => {
    const antes = situacaoEstoque({}, {})
    const onu = antes.find((s) => s.item.id === 'onu')!
    expect(onu.critico).toBe(true)
    const lote = loteReposicao(onu)
    useGestao.getState().reporItem('onu')
    const s = useGestao.getState()
    const depois = situacaoEstoque(s.consumo, s.pedidos).find((x) => x.item.id === 'onu')!
    expect(depois.critico).toBe(false)
    expect(depois.baixo).toBe(true)
    expect(depois.aCaminho).toBe(lote)
    expect(s.contasExtras).toHaveLength(1)
    expect(s.contasExtras[0].cents).toBe(lote * onu.item.custo)
    useGestao.getState().reporItem('onu')
    expect(useGestao.getState().contasExtras).toHaveLength(1)
  })
  it('todo material de kit existe no almoxarifado', () => {
    const ids = new Set(itensEstoque.map((i) => i.id))
    for (const kit of Object.values(KIT_OS)) for (const id of Object.keys(kit)) expect(ids.has(id)).toBe(true)
  })
})

describe('Ordens de serviço e equipe', () => {
  it('cada incidente aberto gera um reparo, e as ordens apontam para clientes reais', () => {
    const ordens = listarOS(demoIncidents, estadoInicialOS, Date.now())
    for (const i of demoIncidents) expect(ordens.find((o) => o.id === osDoIncidente(i.clientId))?.tipo).toBe('reparo')
    expect(ordens.every((o) => clientById.has(o.clientId) && o.prazo > o.abertaEm)).toBe(true)
    expect(ordens.every((o, k) => k === 0 || ordens[k - 1].prazo <= o.prazo)).toBe(true)
    expect(tecnicos.every((t) => t.setor === 'campo')).toBe(true)
    expect(new Set(funcionarios.map((f) => f.id)).size).toBe(funcionarios.length)
  })

  it('despachar ocupa o técnico; ele chega após o tempo de viagem; concluir baixa o estoque e dá XP', () => {
    const { despachar, concluirOS } = useGestao.getState()
    let ordens = listarOS(demoIncidents, useGestao.getState().os, Date.now())
    const os = ordens.find((o) => o.id === 'OS-4802')!
    const livre = tecnicosLivres(ordens)[0]
    despachar(os, livre.id)
    ordens = listarOS(demoIncidents, useGestao.getState().os, Date.now())
    expect(ordens.find((o) => o.id === os.id)?.status).toBe('a_caminho')
    expect(tecnicosLivres(ordens).some((t) => t.id === livre.id)).toBe(false)
    const depois = Date.now() + tempoViagem(clientById.get(os.clientId)!) + 1
    const chegou = listarOS(demoIncidents, useGestao.getState().os, depois).find((o) => o.id === os.id)!
    expect(chegou.status).toBe('em_atendimento')
    concluirOS(chegou)
    const s = useGestao.getState()
    expect(listarOS(demoIncidents, s.os, depois).some((o) => o.id === os.id)).toBe(false)
    expect(s.consumo[tecnologiaDaOS(chegou) === 'fiber' ? 'onu' : 'cpe']).toBe(1)
    expect(s.xpTecnico[livre.id]).toBe(XP.os + XP.osNoPrazo)
    expect(s.concluidas).toHaveLength(1)
    expect(AGORA).toBeLessThan(chegou.prazo)
  })
})

describe('Saúde da operação e missões', () => {
  it('a pontuação soma os pilares e sobe quando os problemas são resolvidos', () => {
    expect(Object.values(PILARES).reduce((a, b) => a + b, 0)).toBe(1000)
    const antes = saudeOperacao(operacao())
    expect(antes.total).toBeGreaterThan(450)
    expect(antes.total).toBeLessThan(750)
    const g = useGestao.getState()
    for (const c of contasBase.filter((c) => !c.quitada && c.vencimento < '2026-11-10')) g.pagarConta(c)
    for (const s of situacaoEstoque({}, {}).filter((x) => x.critico)) g.reporItem(s.item.id)
    const depois = saudeOperacao(operacao([]))
    expect(depois.fracoes.rede).toBe(1)
    expect(depois.fracoes.estoque).toBe(1)
    expect(depois.fracoes.financeiro).toBeGreaterThan(antes.fracoes.financeiro)
    expect(depois.total).toBeGreaterThan(antes.total + 100)
    expect(nivelSaude(depois.total).atual.ordem).toBeGreaterThan(nivelSaude(antes.total).atual.ordem)
  })

  it('as missões medem o progresso real e as conquistas acendem quando valem', () => {
    const inicio = missoes(operacao(), {}, 0)
    expect(inicio.every((m) => m.total > 0 && m.feito === 0 && !m.concluida)).toBe(true)
    const g = useGestao.getState()
    for (const c of contasBase.filter((c) => !c.quitada && c.vencimento < '2026-11-10')) g.pagarConta(c)
    const semTorre = demoIncidents.filter((i) => clientById.get(i.clientId)!.pointId !== 'ERB-17')
    const op = operacao(semTorre)
    const lista = missoes(op, useGestao.getState().contasPagas, 5)
    expect(lista.find((m) => m.id === 'contas')?.concluida).toBe(true)
    expect(lista.find((m) => m.id === 'cobranca')?.concluida).toBe(true)
    expect(lista.find((m) => m.id === 'torre')?.concluida).toBe(true)
    expect(lista.find((m) => m.id === 'estoque')?.concluida).toBe(false)
    const feitos = conquistas(op, lista)
    expect(feitos.find((c) => c.id === 'caixa')?.obtida).toBe(true)
    expect(feitos.find((c) => c.id === 'turno')?.obtida).toBe(false)
    g.premiar('contas', 'missao', 80, 'x')
    g.premiar('contas', 'missao', 80, 'x')
    expect(useGestao.getState().xp).toBe(2 * XP.conta + 80)
  })
})
