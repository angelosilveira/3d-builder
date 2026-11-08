// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppSecData } from '../data/store'
import { DataTabs } from '../hud/DataTabs'
import { DetailCard } from '../hud/DetailCard'
import { Filtros } from '../hud/Filtros'
import { KpiRow } from '../hud/KpiRow'
import { useAppSecUi } from '../state/uiStore'
import { prepararStores } from './harness'

beforeEach(prepararStores)
afterEach(cleanup)

const num = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const aba = (nome: RegExp) => screen.getByRole('tab', { name: nome })
const contagemDaAba = (nome: RegExp) => Number(within(aba(nome)).getByText(/\d/).textContent!.replace(/\./g, ''))

function Hud() {
  return (
    <>
      <KpiRow />
      <Filtros />
      <DataTabs />
      <DetailCard />
    </>
  )
}

describe('Tabela virtualizada', () => {
  it('lista milhares de qualificações renderizando só as linhas visíveis', () => {
    render(<DataTabs />)
    const total = useAppSecData.getState().data.ativos.length
    expect(total).toBeGreaterThan(3000)
    const tabela = screen.getByRole('table')
    expect(tabela).toHaveAttribute('aria-rowcount', String(total + 1))
    const linhas = within(tabela).getAllByRole('rowheader')
    expect(linhas.length).toBeLessThan(40)
    expect(linhas[0].textContent).toMatch(/^QLF-\d+$/)
    expect(contagemDaAba(/Qualificações/)).toBe(total)
  })

  it('troca de aba pelo teclado', async () => {
    const user = userEvent.setup()
    render(<DataTabs />)
    aba(/Qualificações/).focus()
    await user.keyboard('{ArrowRight}')
    expect(aba(/Vulnerabilidades/)).toHaveAttribute('aria-selected', 'true')
    expect(aba(/Vulnerabilidades/)).toHaveFocus()
    await user.keyboard('{End}')
    expect(aba(/Analistas/)).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('table')).toHaveTextContent('Thiago Barros')
  })
})

describe('Filtros', () => {
  it('filtrar por tipo e status atualiza KPIs e listas', async () => {
    const user = userEvent.setup()
    render(<Hud />)
    const total = contagemDaAba(/Qualificações/)
    await user.click(screen.getByRole('button', { name: /^Apps mobile, [\d.]+ ativos$/ }))
    await user.click(screen.getByRole('button', { name: /^Reprovado, [\d.]+ ativos$/ }))
    expect(screen.getByRole('button', { name: /^Apps mobile, / })).toHaveAttribute('aria-pressed', 'true')

    const { data, indice } = useAppSecData.getState()
    const esperado = data.ativos.filter((a) => a.tipo === 'mobile' && indice.vigente.get(a.id)!.status === 'reprovado').length
    expect(esperado).toBeGreaterThan(0)
    expect(contagemDaAba(/Qualificações/)).toBe(esperado)
    expect(esperado).toBeLessThan(total)
    expect(screen.getByRole('list', { name: 'Indicadores dos ativos filtrados' })).toHaveTextContent(`dos ${num(esperado)} ativos no filtro`)

    await user.click(screen.getByRole('button', { name: /Limpar filtros \(2\)/ }))
    expect(contagemDaAba(/Qualificações/)).toBe(total)
  })
})

describe('Seleção pela tabela atualiza o card', () => {
  it('sem seleção, o card mostra a visão geral por área', () => {
    render(<Hud />)
    const card = screen.getByRole('complementary', { name: 'Visão geral' })
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('Onde agir primeiro')
    expect(within(card).getByText('Pagamentos')).toBeInTheDocument()
  })

  it('clicar numa qualificação mostra resumo, maturidade e o formulário por seção', async () => {
    const user = userEvent.setup()
    render(<Hud />)
    const primeira = within(screen.getByRole('table')).getAllByRole('rowheader')[0]
    const codigo = primeira.textContent!
    await user.click(within(primeira).getByRole('button'))

    const sel = useAppSecUi.getState().selecao
    expect(sel?.tipo).toBe('qualificacao')
    const { indice } = useAppSecData.getState()
    const q = indice.qualPorId.get(sel!.id)!
    expect(q.codigo).toBe(codigo)
    const ativo = indice.ativoPorId.get(q.ativoId)!

    const card = screen.getByRole('complementary', { name: 'Detalhe da qualificação' })
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent(ativo.nome)
    expect(within(card).getByRole('img', { name: new RegExp(`^Maturidade ${q.maturidade} de 5`) })).toBeInTheDocument()
    expect(within(card).getByRole('tab', { name: 'Formulário' })).toHaveAttribute('aria-selected', 'true')
    expect(within(card).getByText('Governança')).toBeInTheDocument()
    expect(primeira.closest('tr')).toHaveAttribute('aria-current', 'true')
  })

  it('aba Documentos lista os enviados e os obrigatórios que faltam', async () => {
    const user = userEvent.setup()
    const { data, indice } = useAppSecData.getState()
    // Uma qualificação vigente com documento faltando.
    const q = data.qualificacoes.find((x) => x.vigente && x.status === 'rascunho' && indice.docsPorQual.get(x.id)?.length && indice.docsFaltando[indice.posAtivo.get(x.ativoId)!] > 0)!
    act(() => useAppSecUi.getState().selecionar({ tipo: 'qualificacao', id: q.id }))
    render(<DetailCard />)
    await user.click(screen.getByRole('tab', { name: /Documentos/ }))
    expect(screen.getByRole('list', { name: 'Documentos obrigatórios faltando' })).toHaveTextContent('obrigatório, ainda não enviado')
    const enviados = within(screen.getByRole('list', { name: 'Documentos enviados' })).getAllByRole('listitem')
    expect(enviados.length).toBe(indice.docsPorQual.get(q.id)!.length)
  })

  it('aba Histórico abre uma qualificação anterior e permite voltar à vigente', async () => {
    const user = userEvent.setup()
    const { data, indice } = useAppSecData.getState()
    const ativo = data.ativos.find((a) => (indice.historico.get(a.id)?.length ?? 0) >= 2)!
    const [, anterior] = indice.historico.get(ativo.id)!
    act(() => useAppSecUi.getState().selecionar({ tipo: 'ativo', id: ativo.id }))
    render(<DetailCard />)
    await user.click(screen.getByRole('tab', { name: /Histórico/ }))
    await user.click(screen.getByRole('button', { name: new RegExp(`^${anterior.codigo},`) }))
    expect(useAppSecUi.getState().selecao).toEqual({ tipo: 'qualificacao', id: anterior.id })
    expect(screen.getByText(/Qualificação anterior \(histórico\)/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver a qualificação vigente' }))
    expect(useAppSecUi.getState().selecao).toEqual({ tipo: 'ativo', id: ativo.id })
    expect(screen.queryByText(/Qualificação anterior/)).not.toBeInTheDocument()
  })

  it('os links do card navegam para projeto e analista, e a tabela acompanha', async () => {
    const user = userEvent.setup()
    render(<Hud />)
    await user.click(within(within(screen.getByRole('table')).getAllByRole('rowheader')[0]).getByRole('button'))
    const { indice } = useAppSecData.getState()
    const q = indice.qualPorId.get(useAppSecUi.getState().selecao!.id)!
    const projeto = useAppSecData.getState().data.projetos.find((p) => p.id === q.projetoId)!

    await user.click(screen.getByRole('button', { name: projeto.nome }))
    expect(screen.getByRole('complementary', { name: 'Detalhe do projeto' })).toHaveTextContent(projeto.codigo)
    expect(aba(/Projetos/)).toHaveAttribute('aria-selected', 'true')

    const analista = useAppSecData.getState().data.analistas.find((a) => a.id === projeto.analistaId)!
    await user.click(screen.getByRole('button', { name: analista.nome }))
    const card = screen.getByRole('complementary', { name: 'Detalhe do analista' })
    expect(card).toHaveTextContent('qualificações vigentes')
    await user.click(within(card).getByRole('button', { name: 'Filtrar o mapa por este analista' }))
    expect(useAppSecUi.getState().filtros.analistaId).toBe(analista.id)
  })

  it('fechar o card volta para a visão geral', async () => {
    const user = userEvent.setup()
    render(<Hud />)
    await user.click(within(within(screen.getByRole('table')).getAllByRole('rowheader')[0]).getByRole('button'))
    await user.click(screen.getByRole('button', { name: 'Fechar e voltar para a visão geral' }))
    expect(screen.getByRole('complementary', { name: 'Visão geral' })).toBeInTheDocument()
  })
})
