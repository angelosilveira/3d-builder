import type { AccessPoint } from './data'

export interface Material {
  item: string
  specification: string
  quantity: number
  unit: string
}

// Inventário de demonstração; cada ativo é identificado dentro do seu ponto de acesso.
export function facilityAt(point: AccessPoint) {
  const radio = point.technology === 'radio'
  const number = Number(point.id.slice(-2))
  const height = 18 + (number % 4) * 6
  const installed = '2024-' + String((number % 9) + 1).padStart(2, '0') + '-12'
  const materials: Material[] = radio
    ? [
        { item: 'Torre treliçada', specification: 'Aço galvanizado · ' + height + ' m', quantity: 1, unit: 'un.' },
        { item: 'Antena setorial', specification: 'Setor de 120° · 5 GHz', quantity: 3, unit: 'un.' },
        { item: 'Rádio de acesso', specification: 'Dupla polarização · PoE', quantity: 3, unit: 'un.' },
        {
          item: 'Cabo de rede externo',
          specification: 'Cat6 blindado · capa UV',
          quantity: height * 3 + 24,
          unit: 'm',
        },
        { item: 'Rack de campo', specification: 'Gabinete externo 12U', quantity: 1, unit: 'un.' },
        { item: 'Bateria', specification: 'Banco de energia · 48 V', quantity: 1, unit: 'banco' },
      ]
    : [
        { item: 'OLT', specification: 'GPON · 8 portas PON', quantity: 1, unit: 'un.' },
        { item: 'Distribuidor óptico', specification: 'DIO · 48 fibras', quantity: 1, unit: 'un.' },
        { item: 'Splitter óptico', specification: 'Balanceado · 1:16', quantity: 8, unit: 'un.' },
        { item: 'Rack de telecomunicações', specification: 'Gabinete 19″ · 16U', quantity: 1, unit: 'un.' },
        { item: 'Nobreak', specification: 'Dupla conversão · 2 kVA', quantity: 1, unit: 'un.' },
      ]
  return {
    materials,
    installed,
    height: radio ? height : null,
    backhaul: radio ? 'Enlace dedicado · 1 Gb/s' : 'Anel de fibra · 10 Gb/s',
    team: point.regionId === 'sede' ? 'Equipe urbana' : 'Equipe de campo ' + (number % 2 ? 'Oeste' : 'Leste'),
    lastInspection: '2026-10-' + String(10 + number % 20).padStart(2, '0'),
    nextInspection: '2027-01-' + String(10 + number % 20).padStart(2, '0'),
  }
}
