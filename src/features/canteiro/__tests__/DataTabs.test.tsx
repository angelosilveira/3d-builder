// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DataTabs } from '../hud/DataTabs'
import { prepararStores } from './harness'

beforeEach(prepararStores)
afterEach(cleanup)

const codigosNaTabela = () =>
  within(screen.getByRole('tabpanel'))
    .getAllByRole('rowheader')
    .map((c) => c.textContent)

describe('Tabela com abas', () => {
  it('começa em Equipamentos com a frota do canteiro', () => {
    render(<DataTabs />)
    expect(screen.getByRole('tab', { name: /Equipamentos/ })).toHaveAttribute('aria-selected', 'true')
    expect(codigosNaTabela()).toEqual(['GR-01', 'BB-01', 'BT-01', 'BT-02', 'BT-03', 'EL-01', 'ES-01', 'RE-01'])
  })

  it('troca de aba pelo clique', async () => {
    const user = userEvent.setup()
    render(<DataTabs />)
    await user.click(screen.getByRole('tab', { name: /Concretagens/ }))
    expect(screen.getByRole('tab', { name: /Concretagens/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Equipamentos/ })).toHaveAttribute('aria-selected', 'false')
    // A concretagem em andamento vem primeiro.
    expect(codigosNaTabela()[0]).toBe('C-012')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Vigas e laje L6')
  })

  it('troca de aba pelo teclado (setas, Home e End) movendo o foco', async () => {
    const user = userEvent.setup()
    render(<DataTabs />)
    screen.getByRole('tab', { name: /Equipamentos/ }).focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    const equipes = screen.getByRole('tab', { name: /Equipes/ })
    expect(equipes).toHaveAttribute('aria-selected', 'true')
    expect(equipes).toHaveFocus()
    expect(codigosNaTabela()).toContain('EQ-04')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /Equipamentos/ })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: /Equipes/ })).toHaveAttribute('aria-selected', 'true')
  })
})
