import type { BuildingType, Room, RoomKind } from '../types'
import { uid } from './id'

type RoomSpec = [name: string, kind: RoomKind, width: number, depth: number]

const SPECS: Record<BuildingType, RoomSpec[]> = {
  casa: [
    ['Sala', 'sala', 4.5, 4],
    ['Cozinha', 'cozinha', 3, 3.5],
    ['Quarto 1', 'quarto', 3.2, 3.5],
    ['Quarto 2', 'quarto', 3, 3],
    ['Banheiro', 'banheiro', 2, 2.4],
    ['Área de serviço', 'area_servico', 2, 2],
    ['Garagem', 'garagem', 3, 5],
  ],
  apartamento: [
    ['Sala/Jantar', 'sala', 4, 4.5],
    ['Cozinha', 'cozinha', 2.6, 3],
    ['Suíte', 'quarto', 3.2, 3.4],
    ['Quarto', 'quarto', 2.8, 3],
    ['Banheiro social', 'banheiro', 1.6, 2.4],
    ['Banheiro suíte', 'banheiro', 1.6, 2],
    ['Varanda', 'varanda', 3, 1.5],
  ],
  predio: [
    ['Sala', 'sala', 3.6, 4],
    ['Cozinha/Serviço', 'cozinha', 2.4, 3.6],
    ['Quarto 1', 'quarto', 3, 3],
    ['Quarto 2', 'quarto', 2.8, 3],
    ['Banheiro', 'banheiro', 1.6, 2.4],
    ['Circulação', 'circulacao', 1.2, 3],
  ],
  condominio: [
    ['Sala', 'sala', 3.8, 3.6],
    ['Cozinha', 'cozinha', 2.8, 3],
    ['Quarto 1', 'quarto', 3, 3],
    ['Quarto 2', 'quarto', 2.8, 2.8],
    ['Banheiro', 'banheiro', 1.8, 2.2],
    ['Varanda', 'varanda', 3, 1.6],
  ],
}

export const DEFAULT_LAYOUT: Record<BuildingType, { floors: number; units: number; wallHeight: number }> = {
  casa: { floors: 1, units: 1, wallHeight: 2.8 },
  apartamento: { floors: 1, units: 1, wallHeight: 2.7 },
  predio: { floors: 6, units: 2, wallHeight: 2.8 },
  condominio: { floors: 1, units: 6, wallHeight: 2.7 },
}

export function templateRooms(type: BuildingType): Room[] {
  return SPECS[type].map(([name, kind, width, depth]) => ({
    id: uid('r_'),
    name,
    kind,
    width,
    depth,
    progress: 0,
  }))
}
