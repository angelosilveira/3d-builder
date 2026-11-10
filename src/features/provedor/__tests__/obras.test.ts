import { describe, expect, it } from 'vitest'
import { districts } from '../city'
import { accessPoints, headquarters } from '../data'
import { overview, pickIsland, projector } from '../landscape'
import {
  centroObra,
  executadoObra,
  fimObra,
  HOJE_OBRAS,
  inicioObra,
  janelaObras,
  obras,
  previstoEtapa,
  previstoObra,
  progressoGeral,
  progressoNoMapa,
  statusObra,
} from '../obras'
import { contornoObra, montarObras, pickObra } from '../obrasModel'

// Usa o mesmo contorno do clique na ilha, com 0,6 m de folga além de cada canto.
const vista = projector(1600, 1000, overview)
const naIlha = (x: number, z: number) =>
  [0, 0.6].every((folga) => {
    const [px, py] = vista.project(x + Math.sign(x) * folga, 0.8, z + Math.sign(z) * folga)
    return pickIsland(vista, px, py) === headquarters
  })
const cantos = (o: (typeof obras)[number]): [number, number][] => {
  const l = o.local
  if (l.forma === 'lote') return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [l.x + (sx * l.w) / 2, l.z + (sz * l.d) / 2])
  if (l.forma === 'trecho') return [l.de, l.ate]
  return [[l.x, l.z]]
}

describe('Obras da sede', () => {
  it('cada obra fica dentro da ilha de Aracatu, sem invadir quadras, pontos ou outra obra', () => {
    for (const o of obras) for (const [x, z] of cantos(o)) expect(naIlha(x, z), `${o.id} (${x}, ${z})`).toBe(true)
    const lotes = obras.filter((o) => o.local.forma === 'lote')
    for (const o of lotes) {
      const l = o.local as { x: number; z: number; w: number; d: number }
      for (const d of districts) {
        const sobrepoe = Math.abs(l.x - d.x) * 2 < l.w + 15.55 && Math.abs(l.z - d.z) * 2 < l.d + 14.65
        expect(sobrepoe, `${o.id} sobre ${d.name}`).toBe(false)
      }
      for (const p of accessPoints) expect(Math.abs(p.x - l.x) < l.w / 2 && Math.abs(p.z - l.z) < l.d / 2, `${o.id} sobre ${p.id}`).toBe(false)
      for (const b of lotes) {
        if (b === o) continue
        const m = b.local as typeof l
        expect(Math.abs(l.x - m.x) * 2 < l.w + m.w && Math.abs(l.z - m.z) * 2 < l.d + m.d).toBe(false)
      }
    }
  })

  it('etapas são coerentes e os status cobrem o ciclo da obra', () => {
    for (const o of obras) {
      expect(new Set(o.etapas.map((e) => e.id)).size).toBe(o.etapas.length)
      for (const e of o.etapas) {
        expect(e.inicio <= e.fim).toBe(true)
        expect(e.executado).toBeGreaterThanOrEqual(0)
        expect(e.executado).toBeLessThanOrEqual(1)
      }
      expect(o.gasto).toBeLessThanOrEqual(o.orcamento)
      expect(inicioObra(o) >= janelaObras.inicio && fimObra(o) <= janelaObras.fim).toBe(true)
    }
    const status = new Set(obras.map((o) => statusObra(o)))
    expect(status).toEqual(new Set(['planejada', 'em_andamento', 'atrasada', 'concluida']))
    const noc = obras.find((o) => o.id === 'OB-03')!
    expect(statusObra(noc)).toBe('atrasada')
    expect(previstoObra(noc) - executadoObra(noc)).toBeGreaterThan(0.08)
  })

  it('o previsto cresce linearmente dentro da etapa', () => {
    const e = { id: 'x', nome: 'x', inicio: '2026-11-01', fim: '2026-11-10', executado: 0 }
    expect(previstoEtapa(e, '2026-10-31')).toBe(0)
    expect(previstoEtapa(e, '2026-11-05')).toBeCloseTo(0.5)
    expect(previstoEtapa(e, '2026-11-10')).toBe(1)
    expect(previstoEtapa(e, '2026-12-01')).toBe(1)
  })

  it('a linha do tempo mostra o passado até o executado e o futuro pelo cronograma', () => {
    for (const o of obras) {
      expect(progressoGeral(o, null)).toBeCloseTo(executadoObra(o))
      expect(progressoGeral(o, janelaObras.fim)).toBeCloseTo(1)
      expect(progressoGeral(o, janelaObras.inicio)).toBeLessThanOrEqual(progressoGeral(o, HOJE_OBRAS) + 1e-9)
      const passado = progressoNoMapa(o, '2026-10-01')
      for (const e of o.etapas) expect(passado[e.id]).toBeLessThanOrEqual(e.executado)
    }
  })

  it('monta os canteiros por data e acha a obra sob o cursor', () => {
    const hoje = montarObras(null)
    expect(hoje.desenho.objetos.length).toBeGreaterThan(5)
    expect(hoje.gruas.length).toBe(1)
    expect(montarObras(janelaObras.fim).gruas.length).toBe(0)
    expect(montarObras(null)).toBe(hoje)

    const cam = projector(1280, 800, { ...overview, zoom: 4 })
    for (const o of obras.filter((x) => x.local.forma !== 'ponto')) {
      const [x, z] = centroObra(o)
      const alvo = projector(1280, 800, { ...overview, x, z, zoom: 4 })
      const [px, py] = alvo.project(x, 0.82, z)
      expect(pickObra(alvo, px, py)?.id).toBe(o.id)
      expect(contornoObra(o, cam).length).toBe(4)
    }
  })
})
