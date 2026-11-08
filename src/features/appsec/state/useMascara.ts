import { useMemo } from 'react'
import { mascaraFiltro } from '../data/derived'
import { useAppSecData } from '../data/store'
import { useAppSecUi } from './uiStore'

/** Máscara dos filtros atuais (recalculada só quando filtros ou dados mudam). */
export function useMascara(): Uint8Array {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const filtros = useAppSecUi((s) => s.filtros)
  return useMemo(() => mascaraFiltro(data, indice, filtros), [data, indice, filtros])
}
