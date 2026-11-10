import { describe, expect, it } from 'vitest'
import { accessPoints, clients, pointById } from '../data'
import { obras } from '../obras'
import { areas, CASA, casas, cidade, extensao, fibras, obras3d, pontos, postesDaFibra, ruas, vilas } from '../cidade3d/planta'

describe('Planta da cidade 3D', () => {
  it('dá um lote a cada cliente, sem duas casas no mesmo lugar', () => {
    expect(casas.size).toBe(clients.length)
    const lugares = new Set([...casas.values()].map((c) => `${c.x.toFixed(1)}|${c.z.toFixed(1)}`))
    expect(lugares.size).toBe(clients.length)
    expect(new Set([...casas.values()].map((c) => c.indice)).size).toBe(clients.length)
    // Casas vizinhas não se encostam: pelo menos a largura da casa entre centros na mesma fileira.
    const porFileira = new Map<string, number[]>()
    for (const c of casas.values()) porFileira.set(c.z.toFixed(1), [...(porFileira.get(c.z.toFixed(1)) ?? []), c.x])
    for (const xs of porFileira.values()) {
      xs.sort((a, b) => a - b)
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(CASA.w)
    }
  })

  it('cada casa fica dentro do bairro ou da vila do cliente, e cada rua tem 32 casas', () => {
    for (const c of clients) {
      const casa = casas.get(c.id)!
      const a = areas.get(c.districtId ?? c.regionId)!
      expect(Math.abs(casa.x - a.x)).toBeLessThanOrEqual(a.w / 2)
      expect(Math.abs(casa.z - a.z)).toBeLessThanOrEqual(a.d / 2)
      if (c.streetId) {
        const r = ruas.get(c.streetId)!
        expect(Math.abs(casa.z - r.z)).toBeLessThan(r.d / 2)
      }
    }
    const porRua = new Map<string, number>()
    for (const c of clients) if (c.streetId) porRua.set(c.streetId, (porRua.get(c.streetId) ?? 0) + 1)
    expect([...porRua.values()].every((n) => n === 32)).toBe(true)
    expect(ruas.size).toBe(48)
  })

  it('todo ponto de acesso tem terreno, fora das casas, e um tronco de fibra saindo da sede', () => {
    for (const p of accessPoints) {
      const pos = pontos.get(p.id)!
      expect(pos).toBeDefined()
      for (const c of casas.values()) expect(Math.abs(c.x - pos.x) < CASA.w / 2 + 2 && Math.abs(c.z - pos.z) < CASA.d / 2 + 2).toBe(false)
      const tronco = fibras.find((f) => f.tipo === 'tronco' && f.pontoId === p.id)!
      expect(tronco.regiaoId).toBe(pointById.get(p.id)!.regionId)
      expect(tronco.pts.at(-1)).toEqual([pos.x, pos.z])
      expect(postesDaFibra(tronco).length).toBeGreaterThan(2)
    }
    expect(fibras.filter((f) => f.tipo === 'rua').length).toBe(48 * 2 + 4 * 8)
  })

  it('as vilas ficam fora da cidade, tudo cabe na área enquadrada e toda obra tem lugar', () => {
    for (const v of vilas) {
      expect(Math.abs(v.x) - v.w / 2).toBeGreaterThan(cidade.width / 2 + 50)
      expect(Math.abs(v.x) + v.w / 2).toBeLessThan(extensao.width / 2)
      expect(Math.abs(v.z) + v.d / 2).toBeLessThan(extensao.depth / 2)
    }
    for (const o of obras) expect(obras3d[o.id]).toBeDefined()
  })
})
