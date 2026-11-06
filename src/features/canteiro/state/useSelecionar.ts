import { useCallback } from 'react'
import { abaDaEntidade, encontrarEntidade } from '../data/lookup'
import { useObraDataStore } from '../data/store'
import { useCanteiroStore } from './canteiroStore'

/** Seleciona um objeto e leva a tabela para a aba onde ele aparece. */
export function useSelecionar() {
  const selecionar = useCanteiroStore((s) => s.selecionar)
  return useCallback(
    (id: string | null) => {
      if (!id) return selecionar(null)
      const { obraId } = useCanteiroStore.getState()
      const data = useObraDataStore.getState().obras[obraId]
      selecionar(id, data ? abaDaEntidade(encontrarEntidade(data, id)) : null)
    },
    [selecionar],
  )
}
