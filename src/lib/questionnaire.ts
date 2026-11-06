import type { Room, RoomKind } from '../types'
import { uid } from './id'

export type SizeStandard = 'compacto' | 'medio' | 'amplo'

export interface QuestionnaireAnswers {
  quartos: number
  suites: number
  banheirosSociais: number
  salaJantarIntegradas: boolean
  cozinhaAmericana: boolean
  areaServico: boolean
  garagemVagas: number
  varanda: boolean
  escritorio: boolean
  padrao: SizeStandard
}

export const DEFAULT_ANSWERS: QuestionnaireAnswers = {
  quartos: 2,
  suites: 1,
  banheirosSociais: 1,
  salaJantarIntegradas: true,
  cozinhaAmericana: false,
  areaServico: true,
  garagemVagas: 1,
  varanda: false,
  escritorio: false,
  padrao: 'medio',
}

/** Fator de escala linear por padrão construtivo. */
const SCALE: Record<SizeStandard, number> = { compacto: 0.88, medio: 1, amplo: 1.18 }

const r2 = (n: number) => Math.round(n * 20) / 20

/**
 * Converte as respostas do questionário em uma lista de cômodos com
 * dimensões típicas (próximas às mínimas de códigos de obras municipais no
 * padrão "compacto").
 */
export function roomsFromAnswers(a: QuestionnaireAnswers): Room[] {
  const s = SCALE[a.padrao]
  const rooms: Room[] = []
  const add = (name: string, kind: RoomKind, w: number, d: number) =>
    rooms.push({ id: uid('r_'), name, kind, width: r2(w * s), depth: r2(d * s), progress: 0 })

  if (a.salaJantarIntegradas) add('Sala de estar/jantar', 'sala', 4.5, 4.2)
  else {
    add('Sala de estar', 'sala', 3.8, 3.6)
    add('Sala de jantar', 'sala', 3.2, 3)
  }
  add(a.cozinhaAmericana ? 'Cozinha americana' : 'Cozinha', 'cozinha', a.cozinhaAmericana ? 3.2 : 3, a.cozinhaAmericana ? 2.6 : 3.2)

  const suites = Math.min(a.suites, a.quartos)
  for (let i = 1; i <= a.quartos; i++) {
    const isSuite = i <= suites
    add(isSuite ? (suites > 1 ? `Suíte ${i}` : 'Suíte') : `Quarto ${i - suites}`, 'quarto', isSuite ? 3.4 : 3, isSuite ? 3.5 : 3)
    if (isSuite) add(suites > 1 ? `Banheiro suíte ${i}` : 'Banheiro suíte', 'banheiro', 1.6, 2.2)
  }
  for (let i = 1; i <= a.banheirosSociais; i++) {
    add(a.banheirosSociais > 1 ? `Banheiro ${i}` : 'Banheiro social', 'banheiro', 1.8, 2.4)
  }
  if (a.areaServico) add('Área de serviço', 'area_servico', 2, 1.8)
  if (a.escritorio) add('Escritório', 'escritorio', 2.6, 2.8)
  if (a.varanda) add('Varanda', 'varanda', 3.5, 1.8)
  if (a.garagemVagas > 0) add(a.garagemVagas > 1 ? `Garagem (${a.garagemVagas} vagas)` : 'Garagem', 'garagem', 2.8 * a.garagemVagas, 5)
  if (a.quartos >= 3) add('Circulação', 'circulacao', 1.2, 4)

  return rooms
}
