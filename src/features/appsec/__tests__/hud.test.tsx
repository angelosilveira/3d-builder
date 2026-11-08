// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
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
  it('lista milhares de ativos renderizando só as linhas visíveis', () => {
    render(<DataTabs />)
    const total = useAppSecData.getState().data.ativos.length
    expect(total).toBeGreaterThan(3000)
    const tabela = screen.getByRole('table')
    expect(tabela).toHaveAttribute('aria-rowcount', String(total + 1))
    const linhas = within(tabela).getAllByRole('rowheader')
    expect(linhas.length).toBeLessThan(40)
    expect(contagemDaAba(/Ativos/)).toBe(total)
  })

  it('troca de aba pelo teclado', async () => {
    const user = userEvent.setup()
    render(<DataTabs />)
    aba(/Ativos/).focus()
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
    const total = contagemDaAba(/Ativos/)
    await user.click(screen.getByRole('button', { name: /^Apps mobile, [\d.]+ ativos$/ }))
    await user.click(screen.getByRole('button', { name: /^Reprovado, [\d.]+ ativos$/ }))
    expect(screen.getByRole('button', { name: /^Apps mobile, / })).toHaveAttribute('aria-pressed', 'true')

    const { data } = useAppSecData.getState()
    const esperado = data.ativos.filter((a) => a.tipo === 'mobile' && a.qualificacao.status === 'reprovado').length
    expect(esperado).toBeGreaterThan(0)
    expect(contagemDaAba(/Ativos/)).toBe(esperado)
    expect(esperado).toBeLessThan(total)
    expect(screen.getByRole('list', { name: 'Indicadores dos ativos filtrados' })).toHaveTextContent(`dos ${num(esperado)} ativos no filtro`)

    await user.click(screen.getByRole('button', { name: /Limpar filtros \(2\)/ }))
    expect(contagemDaAba(/Ativos/)).toBe(total)
  })
})

describe('Seleção pela tabela atualiza o card', () => {
  it('sem seleção, o card mostra a visão geral por área', () => {
    render(<Hud />)
    const card = screen.getByRole('complementary', { name: 'Visão geral' })
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('Onde agir primeiro')
    expect(within(card).getByText('Pagamentos')).toBeInTheDocument()
  })

  it('clicar num ativo mostra status, formulário por seção e vulnerabilidades', async () => {
    const user = userEvent.setup()
    render(<Hud />)
    const primeira = within(screen.getByRole('table')).getAllByRole('rowheader')[0]
    const codigo = primeira.textContent!
    await user.click(within(primeira).getByRole('button'))

    const sel = useAppSecUi.getState().selecao
    expect(sel?.tipo).toBe('ativo')
    const ativo = useAppSecData.getState().indice.ativoPorId.get(sel!.id)!
    expect(ativo.codigo).toBe(codigo)

    const card = screen.getByRole('complementary', { name: 'Detalhe do ativo' })
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent(ativo.nome)
    expect(within(card).getByText(new RegExp(`Formulário de qualificação ${ativo.qualificacao.versaoFormulario}`))).toBeInTheDocument()
    expect(within(card).getByText('Governança')).toBeInTheDocument()
    expect(within(card).getByRole('meter', { name: 'Progresso do formulário' })).toBeInTheDocument()
    expect(primeira.closest('tr')).toHaveAttribute('aria-current', 'true')
  })

  it('os links do card navegam para projeto e analista, e a tabela acompanha', async () => {
    const user = userEvent.setup()
    render(<Hud />)
    await user.click(within(within(screen.getByRole('table')).getAllByRole('rowheader')[0]).getByRole('button'))
    const ativo = useAppSecData.getState().indice.ativoPorId.get(useAppSecUi.getState().selecao!.id)!
    const projeto = useAppSecData.getState().data.projetos.find((p) => p.id === ativo.projetoId)!

    await user.click(screen.getByRole('button', { name: projeto.nome }))
    expect(screen.getByRole('complementary', { name: 'Detalhe do projeto' })).toHaveTextContent(projeto.codigo)
    expect(aba(/Projetos/)).toHaveAttribute('aria-selected', 'true')

    const analista = useAppSecData.getState().data.analistas.find((a) => a.id === projeto.analistaId)!
    await user.click(screen.getByRole('button', { name: analista.nome }))
    const card = screen.getByRole('complementary', { name: 'Detalhe do analista' })
    expect(card).toHaveTextContent('ativos sob responsabilidade')
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
