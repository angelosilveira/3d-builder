import { describe, expect, it } from 'vitest'
import { conexaoArriscada, criarIndice, redeDoAtivo, redeDoProjeto } from '../data/derived'
import { criarAppSecMock } from '../data/mock'

const data = criarAppSecMock({ agora: new Date('2026-11-08T12:00:00-03:00') })
const idx = criarIndice(data)
const ativo = (id: string) => idx.ativoPorId.get(id)!

describe('rede de conexões', () => {
  it('liga ativos existentes, sem laços nem duplicatas, e é determinística', () => {
    expect(data.conexoes.length).toBeGreaterThan(data.ativos.length)
    const chaves = new Set<string>()
    for (const c of data.conexoes) {
      expect(idx.ativoPorId.has(c.origemId) && idx.ativoPorId.has(c.destinoId)).toBe(true)
      expect(c.origemId).not.toBe(c.destinoId)
      chaves.add(`${c.origemId}>${c.destinoId}`)
    }
    expect(chaves.size).toBe(data.conexoes.length)
    const outra = criarAppSecMock({ agora: new Date('2026-11-08T12:00:00-03:00') })
    expect(outra.conexoes).toEqual(data.conexoes)
  })

  it('segue a arquitetura: apps consomem e não são consumidos; proxies chamam microserviços', () => {
    for (const c of data.conexoes) {
      const o = ativo(c.origemId)
      const d = ativo(c.destinoId)
      expect(['web', 'mobile', 'desktop']).not.toContain(d.tipo)
      if (o.tipo === 'proxy') expect(d.tipo).toBe('microservico')
      if (o.tipo === 'web' || o.tipo === 'mobile') expect(d.projetoId).toBe(o.projetoId)
    }
    const apps = data.ativos.filter((a) => a.tipo === 'web' || a.tipo === 'mobile')
    expect(apps.every((a) => (idx.conexoesSaida.get(a.id) ?? []).length > 0)).toBe(true)
  })

  it('tem chamadas entre projetos e ligações arriscadas (sem autenticação ou sem TLS)', () => {
    const entreProjetos = data.conexoes.filter((c) => ativo(c.origemId).projetoId !== ativo(c.destinoId).projetoId)
    expect(entreProjetos.length).toBeGreaterThan(50)
    const arriscadas = data.conexoes.filter(conexaoArriscada)
    expect(arriscadas.length).toBeGreaterThan(0)
    expect(arriscadas.length).toBeLessThan(data.conexoes.length * 0.2)
    // Consumidor → proxy sempre autenticado e cifrado.
    for (const c of data.conexoes.filter((x) => ativo(x.destinoId).tipo === 'proxy')) expect(conexaoArriscada(c)).toBe(false)
  })

  it('o caminho de um app desce do consumidor até as dependências', () => {
    const app = data.ativos.find((a) => a.tipo === 'web' && (idx.conexoesSaida.get(a.id)?.[0] && ativo(idx.conexoesSaida.get(a.id)![0].destinoId).tipo === 'proxy'))!
    const { conexoes, ativos } = redeDoAtivo(idx, app.id, 3)
    const tipos = new Set([...ativos].map((id) => ativo(id).tipo))
    expect(tipos.has('proxy') && tipos.has('microservico')).toBe(true)
    expect(Math.max(...conexoes.map((c) => c.salto))).toBeGreaterThanOrEqual(2)
    expect(conexoes.filter((c) => c.salto === 1).every((c) => c.conexao.origemId === app.id)).toBe(true)
  })

  it('a rede do projeto inclui as ligações internas e com outros projetos', () => {
    const p = data.projetos[0]
    const { conexoes } = redeDoProjeto(data, idx, p.id)
    expect(conexoes.length).toBeGreaterThan(0)
    for (const { conexao } of conexoes) expect([ativo(conexao.origemId).projetoId, ativo(conexao.destinoId).projetoId]).toContain(p.id)
  })
})
