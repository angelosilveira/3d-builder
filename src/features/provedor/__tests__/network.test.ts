import { districts,cityStreets,urbanAreas,homesPerStreet } from '../city'
import { groupOpenOutages } from '../outages'
import type { Incident } from '../data'
import { describe, expect, it } from 'vitest'
import {
  accessPoints,
  clients,
  clientsByPoint,
  demoIncidents,
  headquarters,
  islands,
  pointById,
  regions,
} from '../data'
import { facilityAt } from '../facility'
import { islandSize, overview, pickPoint, pointTop, projector, trafficPose, trafficRoad } from '../landscape'

describe('Inventário do provedor', () => {
  it('mantém um endereço no mapa e uma conexão regional para cada assinante', () => {
    expect(clients.length).toBeGreaterThanOrEqual(1000)
    expect(new Set(clients.map((c) => c.id)).size).toBe(clients.length)
    expect(new Set(clients.map((c) => [c.x, c.z].join(','))).size).toBe(clients.length)
    expect(clients.every((c) => pointById.get(c.pointId)?.regionId === c.regionId)).toBe(true)
    for (const region of regions) {
      expect(accessPoints.filter((p) => p.regionId === region.id && p.technology === 'radio').length).toBeGreaterThan(1)
    }
    for (const p of accessPoints) {
      const served = clientsByPoint.get(p.id)!
      expect(served.length).toBeGreaterThan(0)
      expect(served.length).toBeLessThanOrEqual(p.capacity)
      expect(
        served.every(
          (c) =>
            c.equipment.some((d) => d.type === 'Roteador Wi-Fi') &&
            c.equipment.some((d) => d.type === (p.technology === 'radio' ? 'Antena CPE' : 'ONU')),
        ),
      ).toBe(true)
    }
  })

  it('preserva a identidade dos assinantes com ocorrências da demonstração anterior', () => {
    expect(demoIncidents.filter(i=>['AF-1041','AF-1055','AF-1060'].includes(i.clientId)).map((i) => clients.find((c) => c.id === i.clientId)?.name)).toEqual([
      'Marina Oliveira',
      'Gabriel Reis',
      'Caio Mendes',
    ])
  })
})

describe('Câmera do mapa', () => {
  it.each([
    [1440, 900],
    [390, 844],
  ])('recupera o ponto sob o cursor com painel e rotação em %i × %i', (w, h) => {
    const camera = projector(w, h, { ...overview, x: 14, z: -8, angle: 1.1, zoom: 4.8 }, true)
    const pixel = camera.project(14.3, 0.8, -7.6)
    const [x, z] = camera.groundAt(...pixel)
    expect(x).toBeCloseTo(14.3, 8)
    expect(z).toBeCloseTo(-7.6, 8)
  })
})

describe('Cidade e zona rural', () => {
  it('permite percorrer a instalação urbana e cada zona rural do ponto ao assinante', () => {
    for (const island of islands) {
      const served = clients.filter((c) => c.regionId === island.id)
      expect(served.length).toBeGreaterThan(0)
      for (const c of served) expect(pointById.get(c.pointId)?.regionId).toBe(island.id)
    }
    expect(clients.filter((c) => c.regionId === headquarters.id).length).toBeGreaterThan(clients.length/2)
    for (const p of accessPoints) {
      const f = facilityAt(p)
      expect(f.materials.every((m) => m.quantity > 0 && m.specification && m.unit)).toBe(true)
      expect(f.nextInspection > f.lastInspection).toBe(true)
      expect(f.materials.some((m) => m.item === 'Torre treliçada')).toBe(p.technology === 'radio')
    }
  })
  it('identifica o corpo de cada torre independentemente do rótulo', () => {
    for (const p of accessPoints.filter((p) => p.technology === 'radio')) {
      const cam = projector(1200, 800, { ...overview, x: p.x, z: p.z, zoom: 4 }, true)
      expect(pickPoint(cam, ...cam.project(p.x, pointTop(p) - 0.16, p.z))?.id).toBe(p.id)
    }
  })
  it('mantém o trânsito sobre a ilha, inclusive na volta ao início do circuito', () => {
    for (const island of islands) {
      const road = trafficRoad(island),
        size = islandSize(island)
      const length = 4 * road.halfLength + 2 * Math.PI * road.radius
      for (const t of [0, 0.2, 0.5, 0.7, 0.97]) {
        const pos = trafficPose(island, length * t),
          next = trafficPose(island, length * (1 + t))
        expect(next.x).toBeCloseTo(pos.x, 7)
        expect(next.z).toBeCloseTo(pos.z, 7)
        expect(Math.abs(pos.x - island.x)).toBeLessThan(size.rx)
        expect(Math.abs(pos.z - island.z)).toBeLessThan(size.rz)
      }
    }
  })
})

describe('Hierarquia da sede',()=>{
  it('cobre todos os contratos urbanos por bairro e rua, com espaço físico maior que o rural',()=>{
    const city = clients.filter(c=>c.regionId===headquarters.id)
    expect(districts.length).toBeGreaterThan(1)
    expect(city.every(c=>urbanAreas.get(c.streetId!)?.districtId===c.districtId)).toBe(true)
    expect(new Set(city.map(c=>c.id)).size).toBe(cityStreets.length*homesPerStreet)
    for(const s of cityStreets)expect(city.filter(c=>c.streetId===s.id)).toHaveLength(homesPerStreet)
    for(const r of regions)expect(islandSize(headquarters).rx*islandSize(headquarters).rz).toBeGreaterThan(4*islandSize(r).rx*islandSize(r).rz)
    expect(city.find(c=>c.id==='AF-2065')?.pointId).toBe('ERB-17')
    expect(city.find(c=>c.id==='AF-2081')?.pointId).toBe('POP-18')
  })
})
describe('Correlação de quedas abertas',()=>{
  const report=(clientId:string,min:number,kind:Incident['kind']='offline'):Incident=>({clientId,kind,note:'',opened:new Date(Date.UTC(2026,10,10,12,min)).toISOString()})
  it('inclui o limite de 15 minutos e exige três assinantes diferentes no mesmo ponto',()=>{
    const a=report('AF-2065',0), b=report('AF-2066',9)
    expect(groupOpenOutages([a,a,b,report('AF-2067',9,'unstable'),report('AF-2081',9),report('AF-2068',16)])).toHaveLength(0)
    const [g]=groupOpenOutages([report('AF-2068',15),a,b,a])
    expect(g.pointId).toBe('ERB-17')
    expect(g.reports.map(r=>r.clientId)).toEqual(['AF-2065','AF-2066','AF-2068'])
  })
  it('ignora relatos isolados e mantém duas janelas do mesmo ponto independentes',()=>{
    const reports=[0,14,18,24,48,50,53].map((m,i)=>report('AF-'+(2065+i),m))
    const groups=groupOpenOutages(reports.reverse())
    expect(groups.map(g=>g.reports.length)).toEqual([3,3])
    expect(groups[1].reports[0].clientId).toBe('AF-2066')
  })
})
