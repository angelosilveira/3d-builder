// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abaDaEntidade, encontrarEntidade } from '../data/lookup'
import { useObraDataStore } from '../data/store'
import { DataTabs } from '../hud/DataTabs'
import { DetailCard } from '../hud/DetailCard'
import { useCanteiroStore } from '../state/canteiroStore'
import { prepararStores } from './harness'

beforeEach(prepararStores)
afterEach(cleanup)

function Hud() {
  return (
    <>
      <DataTabs />
      <DetailCard />
    </>
  )
}

const tituloDoCard = () => screen.getByRole('complementary').querySelector('h2')?.textContent

describe('Seleção pela tabela atualiza o card de detalhe', () => {
  it('sem seleção, o card mostra a visão da obra', () => {
    render(<Hud />)
    expect(screen.getByRole('complementary', { name: 'Visão da obra' })).toBeInTheDocument()
    expect(tituloDoCard()).toBe('OB-01')
    expect(screen.getByText('Materiais críticos')).toBeInTheDocument()
    expect(screen.getByText('Argamassa de assentamento')).toBeInTheDocument()
  })

  it('clicar na linha da grua mostra operador, carga e manutenção', async () => {
    const user = userEvent.setup()
    render(<Hud />)
    await user.click(screen.getByRole('button', { name: 'Selecionar GR-01 na cena' }))

    expect(useCanteiroStore.getState().selecionadoId).toBe('ob-01-GR-01')
    expect(tituloDoCard()).toBe('GR-01')
    expect(screen.getByText('Josué Lima')).toBeInTheDocument()
    expect(screen.getByText('Carga atual')).toBeInTheDocument()
    expect(screen.getByText('Próxima manutenção')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar GR-01 na cena' }).closest('tr')).toHaveAttribute('aria-current', 'true')
  })

  it('caminhão betoneira acima de 150 min desde a mistura gera alerta no card', async () => {
    const user = userEvent.setup()
    render(<Hud />)
    await user.click(screen.getByRole('button', { name: 'Selecionar BT-02 na cena' }))
    expect(tituloDoCard()).toBe('BT-02')
    expect(screen.getByText('QMB-7H05')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Acima de 150 min')
  })

  it('fechar o card volta para a visão da obra', async () => {
    const user = userEvent.setup()
    render(<Hud />)
    await user.click(screen.getByRole('button', { name: 'Selecionar RE-01 na cena' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Vazamento')
    await user.click(screen.getByRole('button', { name: /Fechar e voltar/ }))
    expect(tituloDoCard()).toBe('OB-01')
  })

  it('seleção vinda da cena leva a tabela para a aba e a linha certas', () => {
    render(<Hud />)
    // Simula o clique no pilar P7 do 2º pavimento na cena (mesma ação usada pelo useSelecionar).
    const id = 'ob-01-pav-2-P7'
    const data = useObraDataStore.getState().obras['ob-01']
    act(() => useCanteiroStore.getState().selecionar(id, abaDaEntidade(encontrarEntidade(data, id))))

    expect(screen.getByRole('tab', { name: /Concretagens/ })).toHaveAttribute('aria-selected', 'true')
    expect(tituloDoCard()).toBe('P7')
    expect(screen.getByText('Não conforme')).toBeInTheDocument()
    // A concretagem dos pilares do 2º pavimento entra na lista e fica marcada.
    const linha = screen.getByRole('button', { name: 'Selecionar C-003 na cena' }).closest('tr')
    expect(linha).toHaveAttribute('aria-current', 'true')
  })
})
