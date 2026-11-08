import { create } from 'zustand'
import { criarIndice, type Indice } from './derived'
import { calcularLayout, type LayoutEcossistema } from './layout'
import { criarAppSecMock } from './mock'
import type { AppSecData } from './types'

interface AppSecDataState {
  data: AppSecData
  indice: Indice
  layout: LayoutEcossistema
  /** Troca o inventário (ex.: resposta da API) e recalcula índices e layout. */
  carregar: (data: AppSecData) => void
}

function preparar(data: AppSecData) {
  return { data, indice: criarIndice(data), layout: calcularLayout(data) }
}

/**
 * Inventário de AppSec. Hoje vem do mock; para a API real, chame
 * `carregar(await api.inventario())` — índices e layout são refeitos.
 */
export const useAppSecData = create<AppSecDataState>()((set) => ({
  ...preparar(criarAppSecMock()),
  carregar: (data) => set(preparar(data)),
}))
