import { act } from '@testing-library/react'
import { criarTodasObras } from '../data/mock'
import { useObraDataStore } from '../data/store'
import { useCanteiroStore } from '../state/canteiroStore'

/** Momento fixo: todos os testes veem os mesmos dados. */
export const AGORA = new Date('2026-11-06T15:00:00-03:00')

export function prepararStores() {
  act(() => {
    useObraDataStore.getState().carregar(criarTodasObras(AGORA))
    useCanteiroStore.setState({
      obraId: 'ob-01',
      selecionadoId: null,
      hoverId: null,
      semana: null,
      aba: 'equipamentos',
      comparar: false,
      comando: null,
    })
  })
}
