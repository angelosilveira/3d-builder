import { citySize,districts,urbanAddress } from './city'
export interface Island {
  id: string
  name: string
  x: number
  z: number
  color: string
}

export const headquarters: Island = { id: 'sede', name: 'Aracatu', x: 0, z: 0, color: '#55e4bc' }
export const regions: Island[] = [
  { id: 'centro', name: 'Lagoa Clara', x: -48, z: -30, color: '#79c5f1' },
  { id: 'alto', name: 'Alto da Serra', x: 47, z: -32, color: '#b9a3ed' },
  { id: 'jardim', name: 'Riacho das Flores', x: -48, z: 30, color: '#86d99f' },
  { id: 'vale', name: 'Vale Verde', x: 48, z: 30, color: '#e5c985' },
]
export const islands = [headquarters, ...regions]

export type IncidentKind = 'offline' | 'unstable'
export type Connection = IncidentKind | 'online'
export const statusText: Record<Connection, string> = {
  offline: 'Sem conexão',
  unstable: 'Instabilidade',
  online: 'Operacional',
}
export const signalColor: Record<Connection, string> = { offline: '#ff7978', unstable: '#ffc665', online: '#66e8bc' }

export interface AccessPoint {
  id: string
  name: string
  regionId: string
  technology: 'radio' | 'fiber'
  capacity: number
  x: number
  z: number
}
const sectors = ['Noroeste', 'Nordeste', 'Sudoeste', 'Sudeste']
const ruralPoints: AccessPoint[] = regions.flatMap((region, r) =>
  sectors.map((sector, i) => ({
    id: (i % 2 === 0 ? 'ERB-' : 'POP-') + String(r * 4 + i + 1).padStart(2, '0'),
    name: (i % 2 === 0 ? 'Torre ' : 'Estação óptica ') + sector,
    regionId: region.id,
    technology: i % 2 === 0 ? ('radio' as const) : ('fiber' as const),
    capacity: [80, 96, 72, 128][i],
    x: region.x + (i % 2 === 0 ? -4.78 : 4.78),
    z: region.z + (i < 2 ? -4.25 : 4.25),
  })),
)
export const accessPoints: AccessPoint[] = [
  ...ruralPoints,
  ...districts.flatMap((d,i):AccessPoint[]=>[
    {id:'ERB-'+(17+i*2),name:i?'Torre '+d.name:'Torre da Cidade',regionId:'sede',technology:'radio',capacity:160,x:d.x-7.65,z:d.z-2.8},
    {id:'POP-'+(18+i*2),name:i?'Estação óptica '+d.name:'Central de fibra',regionId:'sede',technology:'fiber',capacity:192,x:d.x+7.65,z:d.z+2.8},
  ])
]
export const pointById = new Map(accessPoints.map((p) => [p.id, p]))

interface Equipment {
  type: string
  model: string
  serial: string
  installed: string
}
export interface Client {
  districtId?:string
  streetId?:string
  pointId: string
  equipment: Equipment[]
  id: string
  name: string
  regionId: string
  since: string
  address: string
  speed: number
  invoices: { due: string; cents: number }[]
  x: number
  z: number
}

export interface Incident {
  clientId: string
  kind: IncidentKind
  note: string
  opened: string
}

const names = [
  ['Marina Oliveira', 'Rafael Almeida', 'Lívia Costa', 'João Santos', 'Elisa Rocha', 'Pedro Gomes'],
  ['Bruno Ribeiro', 'Ana Ferreira', 'Tiago Lima', 'Clara Souza', 'Luiz Carvalho', 'Sofia Dias'],
  ['Davi Barbosa', 'Beatriz Nunes', 'Gabriel Reis', 'Laura Castro', 'Daniel Moreira', 'Lara Alves'],
  ['Helena Martins', 'Caio Mendes', 'Júlia Pereira', 'Lucas Araújo', 'Cecília Brito', 'André Vieira'],
]
const streets = ['Rua da Praça', 'Rua do Mirante', 'Alameda das Flores', 'Rua do Bosque']
const amounts = [7990, 9990, 12990]
const surnames = [
  'Silveira',
  'Lopes',
  'Macedo',
  'Tavares',
  'Vieira',
  'Barros',
  'Duarte',
  'Queiroz',
  'Pinto',
  'Coelho',
  'Neves',
  'Azevedo',
  'Ramos',
  'Sales',
  'Farias',
  'Moura',
  'Batista',
  'Menezes',
  'Freitas',
  'Campos',
  'Lacerda',
  'Rezende',
  'Rios',
  'Borges',
  'Miranda',
  'Matos',
  'Dantas',
  'Porto',
  'Melo',
  'Bastos',
  'Franco',
  'Leite',
  'Lins',
  'Amaral',
  'Paiva',
  'Gusmão',
  'Xavier',
  'Pontes',
  'Cruz',
  'Assis',
  'Ávila',
  'Sá',
  'Guedes',
]
const originalNames = names.flat()
/**
 * Faturas em aberto na data de referência (10/11/2026). O vencimento é no dia 5, 10, 15 ou 20,
 * conforme o contrato: a maioria está em dia, parte vence nos próximos dias, ~4% deve outubro
 * e ~1% também setembro (candidatos a bloqueio).
 */
export const dueDay = (index: number) => [5, 10, 15, 20][index % 4]
function openInvoices(index: number) {
  const day = String(dueDay(index)).padStart(2, '0'),
    chance = (index * 7919 + 13) % 100
  const open: string[] = []
  if (chance < 1) open.push('2026-09-' + day)
  if (chance < 4) open.push('2026-10-' + day)
  if (chance < (dueDay(index) === 5 ? 10 : dueDay(index) === 10 ? 55 : 88)) open.push('2026-11-' + day)
  return open
}
export const clients: Client[] = [...regions, headquarters].flatMap((region, r) =>
  Array.from({ length: region === headquarters ? citySize : 256 }, (_, i) => {
    const city = region === headquarters
    // Keep the original 24 subscriber IDs so previously recorded incidents remain valid.
    const index = city ? 1024 + i : i < 6 ? r * 6 + i : 24 + r * 250 + i - 6
    const urban=city?urbanAddress(i):undefined
    const point = accessPoints[r * 4 + (urban?.pointIndex??Math.floor(i/64))]
    const cols = city ? 4 : 8,
      slot = i % (cols * cols),
      col = slot % cols,
      row = Math.floor(slot / cols)
    const plan = index % amounts.length
    const since = 2022 + (index % 4) + '-' + String(1 + (index % 12)).padStart(2, '0') + '-12'
    const id = 'AF-' + (1041 + index)
    const device = (type: string, model: string, suffix: string): Equipment => ({
      type,
      model,
      serial: id + '-' + suffix,
      installed: since,
    })
    const equipment = [
      device('Roteador Wi-Fi', ['Atlas AX1800', 'Atlas AX3000', 'Atlas AC1200'][plan], 'RT'),
      point.technology === 'fiber'
        ? device('ONU', 'Terminal GPON G1', 'ONU')
        : device('Antena CPE', 'CPE direcional 5 GHz', 'CPE'),
    ]
    if (point.technology === 'radio') equipment.push(device('Fonte PoE', 'Injetor 24 V', 'POE'))
    if (index % 5 === 0) equipment.push(device('Ponto mesh', 'Atlas Mesh M2', 'M2'))
    return {
      id,
      regionId: region.id,
      pointId: point.id,
      districtId:urban?.street.districtId,
      streetId:urban?.street.id,
      equipment,
      since,
      name: city
        ? originalNames[i % 24] + (i < 24 ? ' Cerqueira' : i<32?' Valença':' '+surnames[Math.floor(i/24)%surnames.length]+' '+(i<1024?' Santos':' Brito'))
        : i < 6
        ? names[r][i]
        : originalNames[(index - 24) % 24] + ' ' + surnames[Math.floor((index - 24) / 24)],
      address: urban ? urban.street.name+', '+urban.number : streets[r]+', '+(24+11*i),
      speed: [300, 500, 800][plan],
      invoices: openInvoices(index).map((due) => ({ due, cents: amounts[plan] })),
      x: urban ? urban.x : point.x + (col - 3.5) * 0.95 + (col < 4 ? -0.35 : 0.35),
      z: urban ? urban.z : point.z + (row - 3.5) * 0.89 + (row < 4 ? -0.32 : 0.32),
    }
  }),
)
export const clientById = new Map(clients.map((c) => [c.id, c]))
export const clientsByPoint = new Map(accessPoints.map((p) => [p.id, clients.filter((c) => c.pointId === p.id)]))
export const demoIncidents: Incident[] = [
  { clientId:'AF-2065',kind:'offline',note:'Conexão interrompida pela manhã.',opened:'2026-11-10T09:31:00-03:00' },
  { clientId:'AF-2068',kind:'offline',note:'Antena perdeu comunicação com a torre.',opened:'2026-11-10T09:35:00-03:00' },
  { clientId:'AF-2072',kind:'offline',note:'Sem acesso após reiniciar o roteador.',opened:'2026-11-10T09:40:00-03:00' },
  {
    clientId: 'AF-1041',
    kind: 'offline',
    note: 'Assinante relatou perda total da conexão.',
    opened: '2026-11-10T09:42:00-03:00',
  },
  {
    clientId: 'AF-1055',
    kind: 'unstable',
    note: 'Quedas intermitentes durante o uso da conexão.',
    opened: '2026-11-10T09:28:00-03:00',
  },
  {
    clientId: 'AF-1060',
    kind: 'offline',
    note: 'Assinante relatou perda de sinal na antena de acesso.',
    opened: '2026-11-10T09:16:00-03:00',
  },
]
export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const dateLabel = (date: string) => date.slice(0, 10).split('-').reverse().join('/')

const storageKey = 'obra3d:provedor:incidentes:v1'
const entryPrefix=storageKey+':cliente:'
function validIncident(item:unknown):item is Incident {
  if(!item||typeof item!=='object')return false
  const record=item as Partial<Incident>
  return typeof record.clientId==='string'&&clientById.has(record.clientId)&&(record.kind==='offline'||record.kind==='unstable')&&typeof record.note==='string'&&typeof record.opened==='string'&&Number.isFinite(Date.parse(record.opened))
}
export function readIncidents(): Incident[] {
  const open=new Map(demoIncidents.map(i=>[i.clientId,i]))
  try{
    const legacy=localStorage.getItem(storageKey)
    if(legacy){
      try{const parsed:unknown=JSON.parse(legacy);if(Array.isArray(parsed))for(const i of parsed)if(validIncident(i))open.set(i.clientId,i)}catch{/* Keep the demo and individual records if an old snapshot is unreadable. */}
    }
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i)
      if(!key?.startsWith(entryPrefix))continue
      const id=key.slice(entryPrefix.length)
      try{
        const record:unknown=JSON.parse(localStorage.getItem(key)??'null')
        if(record===null)open.delete(id)
        else if(validIncident(record)&&id===record.clientId)open.set(id,record)
      }catch{/* Ignore only the unreadable record. */}
    }
  }catch{/* Storage can be unavailable in an embedded browser. */}
  return [...open.values()]
}
export function addIncident(incident:Incident){
  if(!readIncidents().some(i=>i.clientId===incident.clientId))localStorage.setItem(entryPrefix+incident.clientId,JSON.stringify(incident))
  return readIncidents()
}
export function closeIncident(incident:Incident){
  if(readIncidents().some(i=>i.clientId===incident.clientId&&i.opened===incident.opened))localStorage.setItem(entryPrefix+incident.clientId,'null')
  return readIncidents()
}
export const isIncidentStorageKey=(key:string|null)=>key===null||key===storageKey||key.startsWith(entryPrefix)
