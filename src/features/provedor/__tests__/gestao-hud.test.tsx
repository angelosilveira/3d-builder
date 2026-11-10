// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clientById, demoIncidents, type Incident } from '../data'
import { reais } from '../gestao/base'
import { atraso, contasBase, faturas } from '../gestao/financeiro'
import { useGestao, XP } from '../gestao/store'
import { useOperacao } from '../gestao/useOperacao'
import { Avisos, Dock, Placar, useRecompensas } from '../GestaoHud'
import { PainelGestao } from '../GestaoPaineis'
import type { Modulo } from '../gestao/saude'

beforeEach(() => {
  localStorage.clear()
  act(() => useGestao.getState().reiniciar())
})
afterEach(cleanup)

function Bancada({ modulo, incidentes = demoIncidents, mudar = () => {} }: { modulo: Modulo; incidentes?: Incident[]; mudar?: (l: Incident[]) => void }) {
  const op = useOperacao(incidentes)
  useRecompensas(op)
  return (
    <>
      <Placar op={op} abrir={() => {}} />
      <Dock op={op} modulo={modulo} camada="rede" abrir={() => {}} verRede={() => {}} />
      <PainelGestao modulo={modulo} op={op} abrirCliente={() => {}} abrirPonto={() => {}} abrirModulo={() => {}} aoMudarIncidentes={mudar} />
      <Avisos />
    </>
  )
}

describe('Financeiro', () => {
  it('receber uma fatura vencida tira da lista, dá XP e avisa', async () => {
    const user = userEvent.setup()
    render(<Bancada modulo="financeiro" />)
    const vencidas = faturas.filter((f) => atraso(f) > 0).sort((a, b) => atraso(b) - atraso(a))
    const primeira = vencidas[0]
    const nome = clientById.get(primeira.clientId)!.name
    expect(screen.getByRole('button', { name: /^Vencidas/ })).toHaveTextContent(String(vencidas.length))
    await user.click(screen.getByRole('button', { name: `Registrar pagamento de ${reais(primeira.cents)} de ${nome}` }))
    expect(screen.getByRole('button', { name: /^Vencidas/ })).toHaveTextContent(String(vencidas.length - 1))
    expect(useGestao.getState().xp).toBe(XP.cobranca)
    expect(screen.getByRole('status', { name: 'Avisos da gestão' })).toHaveTextContent('Fatura vencida recuperada')
  })

  it('pagar as contas vencidas conclui a missão e zera o selo do dock', async () => {
    const user = userEvent.setup()
    render(<Bancada modulo="financeiro" />)
    await user.click(screen.getByRole('tab', { name: /A pagar/ }))
    const vencidas = contasBase.filter((c) => !c.quitada && c.vencimento < '2026-11-10')
    expect(within(screen.getByRole('navigation', { name: 'Módulos de gestão' })).getByRole('button', { name: /Financeiro/ })).toHaveTextContent(String(vencidas.length))
    for (const c of vencidas) await user.click(screen.getByRole('button', { name: `Pagar ${c.descricao}, ${reais(c.cents)}` }))
    expect(within(screen.getByRole('navigation', { name: 'Módulos de gestão' })).getByRole('button', { name: /Financeiro/ })).not.toHaveTextContent(/\d/)
    expect(useGestao.getState().premiadas['missao:contas']).toBe(true)
    expect(screen.getByRole('status', { name: 'Avisos da gestão' })).toHaveTextContent('Missão cumprida: Fornecedores em dia')
  })

  it('o fluxo de caixa tem legenda e tabela equivalente', async () => {
    const user = userEvent.setup()
    render(<Bancada modulo="financeiro" />)
    await user.click(screen.getByRole('tab', { name: 'Fluxo de caixa' }))
    // Legenda visível e cabeçalho da tabela: a identidade das séries não depende só da cor.
    expect(screen.getAllByText('Entradas')).toHaveLength(2)
    expect(screen.getAllByText('Saídas')).toHaveLength(2)
    expect(within(screen.getByRole('table', { name: 'Fluxo de caixa mensal' })).getAllByRole('row')).toHaveLength(7)
  })
})

describe('Atendimento', () => {
  it('concluir uma ordem em atendimento encerra o incidente e sobe a saúde', async () => {
    const user = userEvent.setup()
    const mudar = vi.fn()
    render(<Bancada modulo="atendimento" mudar={mudar} />)
    const antes = Number(screen.getByRole('button', { name: /^Saúde da operação/ }).getAttribute('aria-label')!.match(/: (\d+) de/)![1])
    await user.click(screen.getByRole('tab', { name: /Em andamento/ }))
    // AF-1060 já está com a técnica no local.
    const linha = screen.getByText(/OS-R-AF-1060/).closest('li')!
    await user.click(within(linha).getByRole('button', { name: 'Concluir' }))
    expect(mudar).toHaveBeenCalledTimes(1)
    expect((mudar.mock.calls[0][0] as Incident[]).some((i) => i.clientId === 'AF-1060')).toBe(false)
    expect(useGestao.getState().concluidas.map((c) => c.id)).toEqual(['OS-R-AF-1060'])
    expect(useGestao.getState().xpTecnico['F-02']).toBeGreaterThan(0)
    expect(antes).toBeGreaterThan(400)
  })

  it('despachar manda um técnico livre e a ordem sai da fila', async () => {
    const user = userEvent.setup()
    render(<Bancada modulo="atendimento" />)
    const fila = screen.getByRole('tab', { name: /Aguardando técnico/ })
    const n = Number(fila.textContent!.match(/\d+/)![0])
    await user.click(screen.getAllByRole('button', { name: 'Despachar' })[0])
    expect(screen.getByRole('tab', { name: /Aguardando técnico/ })).toHaveTextContent(String(n - 1))
    expect(Object.values(useGestao.getState().os).filter((e) => e.status === 'a_caminho').length).toBe(2)
  })
})

describe('Estoque, equipe e missões', () => {
  it('repor um item abaixo do mínimo cria o pedido e a conta', async () => {
    const user = userEvent.setup()
    render(<Bancada modulo="estoque" />)
    await user.click(screen.getByRole('button', { name: /^Repor ONU GPON G1/ }))
    expect(screen.getByText(/\+74 a caminho/)).toBeInTheDocument()
    expect(useGestao.getState().contasExtras).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /^Repor ONU GPON G1/ })).not.toBeInTheDocument()
  })

  it('a equipe mostra o ranking dos técnicos', () => {
    render(<Bancada modulo="equipe" />)
    const ranking = within(screen.getByRole('list', { name: 'Ranking dos técnicos por XP' })).getAllByRole('listitem')
    expect(ranking[0]).toHaveTextContent('Diego Macedo')
    expect(ranking.length).toBeGreaterThanOrEqual(6)
  })

  it('a central lista as missões com progresso e as conquistas', () => {
    render(<Bancada modulo="missoes" />)
    expect(screen.getAllByRole('button', { name: /^Ir para a missão/ })).toHaveLength(5)
    expect(screen.getByRole('list', { name: 'Composição da saúde da operação' })).toHaveTextContent('Financeiro')
    expect(screen.getAllByRole('listitem', { name: /(Obtida|Ainda não obtida)$/ })).toHaveLength(5)
  })
})
