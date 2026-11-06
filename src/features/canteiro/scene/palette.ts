/** Cores da cena 3D — derivadas dos tokens do HUD (ver canteiro.css). */
export const COR = {
  concreto: '#EEF0F2',
  cimento: '#D3D8DE',
  prancha: '#1F4FD8',
  seguranca: '#F2B705',
  executado: '#2E9E6A',
  atraso: '#D64545',
  grafite: '#1E2329',

  entorno: '#DCE1E6',
  asfalto: '#B9C0C8',
  faixa: '#FFFFFF',
  pilar: '#7D97E4',
  pilarHover: '#4F70DD',
  laje: '#D3D8DE',
  lajeFresca: '#A9B2BC',
  parede: '#F6F7F9',
  vidro: '#5D6B7B',
  andaime: '#A3ACB7',
  forma: '#CDB894',
  bloco: '#C99778',
  vergalhao: '#6E625C',
  madeira: '#B79B74',
  copa: '#9DBFA6',
  copaEscura: '#7FA68B',
  tronco: '#8A7462',
  corpo: '#4A5560',
  terra: '#C8B9A3',
  aco: '#5E6873',
  pneu: '#2A2F35',
} as const

export const COR_DESVIO = {
  adiantado: COR.prancha,
  no_prazo: COR.executado,
  atrasado: COR.atraso,
  nao_iniciado: COR.cimento,
} as const

/** Capacete por função (convenção usual de canteiro). */
export const COR_CAPACETE = {
  encarregado: '#FFFFFF',
  armador: '#8A5A3B',
  carpinteiro: '#1F4FD8',
  pedreiro: '#1F4FD8',
  servente: '#F2B705',
  operador: '#F28C28',
  seguranca: '#2E9E6A',
} as const
