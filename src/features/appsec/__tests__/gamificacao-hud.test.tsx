// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CATEGORIA_DOC_LABEL } from '../data/catalogo'
import { calcularKpis, documentosFaltando } from '../data/derived'
import { missoes, nivelDe, pontuacao } from '../data/gamificacao'
import { useAppSecData } from '../data/store'
import { DetailCard } from '../hud/DetailCard'
import { PainelPostura, Toasts } from '../hud/Gamificacao'
import { KpiRow } from '../hud/KpiRow'
import { useEfeitos } from '../state/efeitos'
import { useAppSecUi } from '../state/uiStore'
import { prepararStores } from './harness'

beforeEach(() => {
  prepararStores()
  act(() => useEfeitos.setState({ efeitos: [] }))
})
afterEach(cleanup)

const num = (n: number) => new Intl.NumberFormat('pt-BR').format(n)

describe('Postura na barra superior', () => {
  it('mostra a pontuação e o nível reais e abre a visão geral', async () => {
    const user = userEvent.setup()
    const { data, indice } = useAppSecData.getState()
    const total = pontuacao(data, indice).total
    act(() => useAppSecUi.getState().selecionar({ tipo: 'ativo', id: data.ativos[0].id }))
    render(<PainelPostura />)
    const botao = screen.getByRole('button', { name: new RegExp(`^Postura de segurança: ${num(total)} de 1.000 pontos, nível ${nivelDe(total).atual.nome}`) })
    await user.click(botao)
    expect(useAppSecUi.getState().selecao).toBeNull()
  })
})

describe('Visão geral gamificada', () => {
  it('lista missões e o botão "Ir" aplica os filtros da missão', async () => {
    const user = userEvent.setup()
    const { data, indice } = useAppSecData.getState()
    const esperadas = missoes(data, indice)
    expect(esperadas.length).toBeGreaterThan(0)
    render(<DetailCard />)
    const card = screen.getByRole('complementary', { name: 'Visão geral' })
    const botoes = within(card).getAllByRole('button', { name: /^Ir para a missão:/ })
    expect(botoes).toHaveLength(esperadas.length)
    await user.click(botoes[0])
    const filtros = useAppSecUi.getState().filtros
    for (const [k, v] of Object.entries(esperadas[0].filtros)) expect(filtros[k as keyof typeof filtros]).toEqual(v)
  })

  it('mostra o ranking das áreas com medalhas', () => {
    render(<DetailCard />)
    const ranking = screen.getByRole('list', { name: 'Ranking das áreas por pontuação de postura' })
    const itens = within(ranking).getAllByRole('button')
    expect(itens).toHaveLength(useAppSecData.getState().data.areas.length)
    expect(itens[0]).toHaveAccessibleName(/^1º /)
  })
})

describe('Ações gamificadas no card da qualificação', () => {
  it('enviar um documento obrigatório atualiza o card, os KPIs e mostra um aviso', async () => {
    const user = userEvent.setup()
    const { data, indice } = useAppSecData.getState()
    const q = data.qualificacoes.find((x) => x.vigente && x.status === 'rascunho' && indice.docsFaltando[indice.posAtivo.get(x.ativoId)!] === 1)!
    const [categoria] = documentosFaltando(q, indice.docsPorQual.get(q.id) ?? [])
    const antes = calcularKpis(data, indice).documentosFaltando
    act(() => useAppSecUi.getState().selecionar({ tipo: 'qualificacao', id: q.id }))
    render(
      <>
        <KpiRow />
        <DetailCard />
        <Toasts />
      </>,
    )
    await user.click(screen.getByRole('tab', { name: /Documentos/ }))
    await user.click(screen.getByRole('button', { name: `Enviar ${CATEGORIA_DOC_LABEL[categoria]}` }))

    expect(screen.queryByRole('list', { name: 'Documentos obrigatórios faltando' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Documentos enviados' })).getByText('Você', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent(`${CATEGORIA_DOC_LABEL[categoria]} enviado`)
    const kpis = screen.getByRole('list', { name: 'Indicadores de todos os ativos' })
    expect(kpis).toHaveTextContent(num(antes - 1))
    expect(calcularKpis(useAppSecData.getState().data, useAppSecData.getState().indice).documentosFaltando).toBe(antes - 1)
  })

  it('concluir uma pendência marca como concluída e emite o efeito no ativo', async () => {
    const user = userEvent.setup()
    const { data, indice } = useAppSecData.getState()
    const p = data.pendencias.find((x) => x.status === 'aberta' && indice.qualPorId.get(x.qualificacaoId)?.vigente && indice.qualPorId.get(x.qualificacaoId)?.status !== 'depreciado')!
    act(() => useAppSecUi.getState().selecionar({ tipo: 'qualificacao', id: p.qualificacaoId }))
    render(
      <>
        <DetailCard />
        <Toasts />
      </>,
    )
    await user.click(screen.getByRole('tab', { name: /Pendências/ }))
    await user.click(screen.getByRole('button', { name: `Concluir pendência: ${p.descricao}` }))

    expect(useAppSecData.getState().data.pendencias.find((x) => x.id === p.id)!.status).toBe('concluida')
    expect(screen.queryByRole('button', { name: `Concluir pendência: ${p.descricao}` })).not.toBeInTheDocument()
    const efeito = useEfeitos.getState().efeitos.find((e) => e.tipo === 'acao')!
    expect(efeito.ativoId).toBe(p.ativoId)
    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent(`Pendência ${p.codigo} concluída`)
  })

  it('qualificações do histórico não oferecem ações', async () => {
    const user = userEvent.setup()
    const { data } = useAppSecData.getState()
    const antiga = data.qualificacoes.find((q) => !q.vigente)!
    act(() => useAppSecUi.getState().selecionar({ tipo: 'qualificacao', id: antiga.id }))
    render(<DetailCard />)
    await user.click(screen.getByRole('tab', { name: /Pendências/ }))
    expect(screen.queryByRole('button', { name: /^Concluir pendência/ })).not.toBeInTheDocument()
  })
})

describe('Conquistas do projeto', () => {
  it('mostra as cinco conquistas, obtidas ou não', () => {
    const { data } = useAppSecData.getState()
    act(() => useAppSecUi.getState().selecionar({ tipo: 'projeto', id: data.projetos[0].id }))
    render(<DetailCard />)
    const card = screen.getByRole('complementary', { name: 'Detalhe do projeto' })
    expect(within(card).getByText(/^\d de 5 conquistas$/)).toBeInTheDocument()
    expect(within(card).getAllByRole('listitem', { name: /(Obtida|Ainda não obtida)$/ })).toHaveLength(5)
  })
})
