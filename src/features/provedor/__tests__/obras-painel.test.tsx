// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fimObra, HOJE_OBRAS, obraPorId, obras } from '../obras'
import { ListaObras, ObraDetalhe } from '../ObrasPanels'

afterEach(cleanup)

describe('Painel de obras', () => {
  it('lista as obras e a linha do tempo muda a data mostrada no mapa', () => {
    const setData = vi.fn()
    const escolher = vi.fn()
    render(<ListaObras data={null} setData={setData} escolher={escolher} />)
    expect(screen.getByRole('heading', { name: 'Obras da rede' })).toBeInTheDocument()
    for (const o of obras) expect(screen.getByRole('button', { name: new RegExp(o.nome) })).toBeInTheDocument()
    const linha = screen.getByRole('slider', { name: 'Linha do tempo das obras' })
    expect(linha).toHaveAttribute('aria-valuetext', '10/11/2026, hoje')
    fireEvent.change(linha, { target: { value: '0' } })
    expect(setData).toHaveBeenCalledWith('2026-06-01')
    fireEvent.click(screen.getByRole('button', { name: /Centro de Operações da Rede/ }))
    expect(escolher).toHaveBeenCalledWith(obraPorId.get('OB-03'))
  })

  it('a ficha mostra previsto x executado, etapas, materiais e equipe', async () => {
    const user = userEvent.setup()
    const setData = vi.fn()
    const noc = obraPorId.get('OB-03')!
    render(<ObraDetalhe obra={noc} data={null} setData={setData} abrirPonto={() => {}} />)
    expect(screen.getByRole('heading', { name: noc.nome })).toBeInTheDocument()
    expect(screen.getByText('Atrasada')).toBeInTheDocument()
    expect(screen.getByText(/p\.p\. atrás do cronograma/)).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Etapas da obra' })).getAllByRole('listitem')).toHaveLength(noc.etapas.length)
    expect(screen.getByText('Bloco cerâmico')).toBeInTheDocument()
    expect(screen.getByText('Pedreiro')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Ver a obra pronta no mapa/ }))
    expect(setData).toHaveBeenCalledWith(fimObra(noc))
  })

  it('obra com ponto de acesso existente leva à ficha do ponto', async () => {
    const user = userEvent.setup()
    const abrirPonto = vi.fn()
    const energia = obraPorId.get('OB-05')!
    render(<ObraDetalhe obra={energia} data={HOJE_OBRAS} setData={() => {}} abrirPonto={abrirPonto} />)
    await user.click(screen.getByRole('button', { name: /Torre da Cidade/ }))
    expect(abrirPonto).toHaveBeenCalledWith(expect.objectContaining({ id: 'ERB-17' }))
  })
})
