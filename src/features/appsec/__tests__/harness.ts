import { act } from '@testing-library/react'
import { FILTROS_VAZIOS } from '../data/derived'
import { criarAppSecMock } from '../data/mock'
import { useAppSecData } from '../data/store'
import { useAppSecUi } from '../state/uiStore'

export const AGORA = new Date('2026-11-08T12:00:00-03:00')

export function prepararStores() {
  act(() => {
    useAppSecData.getState().carregar(criarAppSecMock({ agora: AGORA }))
    useAppSecUi.setState({ selecao: null, hoverId: null, filtros: FILTROS_VAZIOS, aba: 'qualificacoes', comando: null })
  })
}
