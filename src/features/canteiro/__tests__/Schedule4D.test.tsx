// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Schedule4D } from '../hud/Schedule4D'
import { useCanteiroStore } from '../state/canteiroStore'
import { prepararStores } from './harness'

beforeEach(prepararStores)
afterEach(cleanup)

const slider = () => screen.getByRole('slider', { name: /Data do cronograma 4D/ })

describe('Cronograma 4D (componente)', () => {
  it('abre em hoje com 6 de 8 pavimentos', () => {
    render(<Schedule4D />)
    expect(slider()).toHaveAttribute('aria-valuetext', expect.stringContaining('6 de 8 pavimentos'))
    expect(screen.getByText('hoje', { selector: '.cnt-4d-momento' })).toBeInTheDocument()
  })

  it('teclado leva ao início (sem pavimentos) e ao fim (projeção completa)', async () => {
    const user = userEvent.setup()
    render(<Schedule4D />)
    slider().focus()
    await user.keyboard('{Home}')
    expect(useCanteiroStore.getState().semana).toBe(0)
    expect(slider()).toHaveAttribute('aria-valuetext', expect.stringContaining('0 de 8 pavimentos'))
    await user.keyboard('{End}')
    expect(slider()).toHaveAttribute('aria-valuetext', expect.stringMatching(/8 de 8 pavimentos.*projeção/))
  })

  it('setas andam uma semana e o cursor "gruda" em hoje', async () => {
    const user = userEvent.setup()
    render(<Schedule4D />)
    slider().focus()
    await user.keyboard('{ArrowLeft}')
    expect(useCanteiroStore.getState().semana).toBe(27)
    // O 6º pavimento começou na semana 25,5: na 27 ainda aparece; na 25, não.
    expect(slider()).toHaveAttribute('aria-valuetext', expect.stringContaining('6 de 8 pavimentos'))
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(slider()).toHaveAttribute('aria-valuetext', expect.stringContaining('5 de 8 pavimentos'))
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(useCanteiroStore.getState().semana).toBeNull()
  })

  it('Previsto x Executado é um switch acessível que liga a legenda de desvio', async () => {
    const user = userEvent.setup()
    render(<Schedule4D />)
    const sw = screen.getByRole('switch', { name: 'Previsto x Executado' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await user.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(useCanteiroStore.getState().comparar).toBe(true)
    expect(screen.getByRole('list', { name: 'Legenda do desvio' })).toHaveTextContent('Atrasado')
  })
})
