import type { Severidade, StatusQualificacao } from '../data/types'

/** Cores de dado da cena — espelhadas nos tokens do HUD (appsec.css). */
export const COR_STATUS: Record<StatusQualificacao, string> = {
  aprovado: '#2E9E6A',
  rascunho: '#3D6FE0',
  reprovado: '#C4402F',
  depreciado: '#A3ABB5',
}

export const COR_SEVERIDADE: Record<Severidade, string> = {
  critica: '#8E1B3A',
  alta: '#E0533D',
  media: '#F2A33A',
  baixa: '#A9B1BC',
}

export const COR = {
  fundo: '#E4E8ED',
  chao: '#E9EDF1',
  area: '#DCE2E8',
  placa: '#F7F9FB',
  placaHover: '#FFFFFF',
  placaSelecionada: '#EEF2FF',
  tinta: '#141A22',
  esmaecido: '#D6DCE3',
  pendencia: '#F2B705',
} as const
