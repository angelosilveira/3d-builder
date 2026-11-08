import { describe, expect, it } from 'vitest'
import { FORMULARIOS } from '../data/catalogo'
import { calcularKpis, criarIndice, FILTROS_VAZIOS, mascaraFiltro, respostasDo, buscar, vulnAberta } from '../data/derived'
import { calcularLayout, CELULA } from '../data/layout'
import { criarAppSecMock } from '../data/mock'

const AGORA = new Date('2026-11-08T12:00:00-03:00')
const data = criarAppSecMock({ agora: AGORA })
const idx = criarIndice(data)
const layout = calcularLayout(data)

describe('inventário mockado', () => {
  it('tem mais de 3.000 ativos dos 5 tipos e os 4 status', () => {
    expect(data.ativos.length).toBeGreaterThan(3000)
    expect(new Set(data.ativos.map((a) => a.tipo))).toEqual(new Set(['proxy', 'microservico', 'web', 'mobile', 'desktop']))
    expect(new Set(data.ativos.map((a) => a.qualificacao.status))).toEqual(new Set(['aprovado', 'rascunho', 'depreciado', 'reprovado']))
  })

  it('é determinístico para a mesma data e semente', () => {
    const outro = criarAppSecMock({ agora: AGORA })
    expect(outro.ativos.map((a) => a.nome)).toEqual(data.ativos.map((a) => a.nome))
    expect(outro.vulnerabilidades.length).toBe(data.vulnerabilidades.length)
  })

  it('mantém referências consistentes entre entidades', () => {
    const ativos = new Set(data.ativos.map((a) => a.id))
    const projetos = new Set(data.projetos.map((p) => p.id))
    const analistas = new Set(data.analistas.map((a) => a.id))
    expect(data.vulnerabilidades.every((v) => ativos.has(v.ativoId))).toBe(true)
    expect(data.pendencias.every((p) => ativos.has(p.ativoId))).toBe(true)
    expect(data.ativos.every((a) => projetos.has(a.projetoId) && analistas.has(a.analistaId))).toBe(true)
    expect(new Set(data.ativos.map((a) => a.codigo)).size).toBe(data.ativos.length)
  })

  it('ativo aprovado não tem vulnerabilidade crítica aberta sem aceite de risco', () => {
    const aprovados = new Set(data.ativos.filter((a) => a.qualificacao.status === 'aprovado').map((a) => a.id))
    const problemas = data.vulnerabilidades.filter((v) => aprovados.has(v.ativoId) && v.severidade === 'critica' && vulnAberta(v))
    expect(problemas).toEqual([])
  })

  it('analista do ativo tem a especialidade do tipo', () => {
    const porId = new Map(data.analistas.map((a) => [a.id, a]))
    expect(data.ativos.every((a) => porId.get(a.analistaId)!.especialidades.includes(a.tipo))).toBe(true)
  })
})

describe('layout agrupado', () => {
  it('posiciona cada ativo dentro da placa do seu projeto', () => {
    data.ativos.forEach((a, i) => {
      const p = layout.projetoPorId.get(a.projetoId)!
      const x = layout.pos[i * 2]
      const z = layout.pos[i * 2 + 1]
      expect(Math.abs(x - p.x)).toBeLessThan(p.w / 2)
      expect(Math.abs(z - p.z)).toBeLessThan(p.d / 2)
    })
  })

  it('não sobrepõe ativos, projetos nem áreas', () => {
    const chaves = new Set<string>()
    for (let i = 0; i < data.ativos.length; i++) chaves.add(`${Math.round(layout.pos[i * 2] / CELULA * 2)}:${Math.round(layout.pos[i * 2 + 1] / CELULA * 2)}`)
    expect(chaves.size).toBe(data.ativos.length)
    const sobrepoe = (a: { x: number; z: number; w: number; d: number }, b: typeof a) =>
      Math.abs(a.x - b.x) * 2 < a.w + b.w - 1e-6 && Math.abs(a.z - b.z) * 2 < a.d + b.d - 1e-6
    for (const lista of [layout.projetos, layout.areas])
      for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) expect(sobrepoe(lista[i], lista[j])).toBe(false)
  })

  it('agrupa os ativos por tipo dentro do projeto (proxies primeiro)', () => {
    const p = data.projetos[0]
    const doProjeto = data.ativos.map((a, i) => ({ a, i })).filter(({ a }) => a.projetoId === p.id)
    const primeiro = doProjeto.reduce((m, c) => (layout.pos[c.i * 2 + 1] < layout.pos[m.i * 2 + 1] || (layout.pos[c.i * 2 + 1] === layout.pos[m.i * 2 + 1] && layout.pos[c.i * 2] < layout.pos[m.i * 2]) ? c : m))
    expect(primeiro.a.tipo).toBe('proxy')
  })
})

describe('filtros, KPIs e busca', () => {
  it('sem filtros, todos passam', () => {
    expect(mascaraFiltro(data, idx, FILTROS_VAZIOS).reduce((s, v) => s + v, 0)).toBe(data.ativos.length)
  })

  it('combina tipo, status e severidade', () => {
    const mask = mascaraFiltro(data, idx, { ...FILTROS_VAZIOS, tipos: ['mobile'], status: ['reprovado'], severidade: 'alta' })
    const passaram = data.ativos.filter((_, i) => mask[i])
    expect(passaram.length).toBeGreaterThan(0)
    for (const a of passaram) {
      expect(a.tipo).toBe('mobile')
      expect(a.qualificacao.status).toBe('reprovado')
      const abertas = (idx.vulnsPorAtivo.get(a.id) ?? []).filter(vulnAberta)
      expect(abertas.some((v) => v.severidade === 'critica' || v.severidade === 'alta')).toBe(true)
    }
  })

  it('KPIs respeitam a máscara', () => {
    const geral = calcularKpis(data, idx)
    const mask = mascaraFiltro(data, idx, { ...FILTROS_VAZIOS, tipos: ['proxy'] })
    const proxies = calcularKpis(data, idx, mask)
    expect(proxies.ativos).toBeLessThan(geral.ativos)
    expect(proxies.criticasAbertas).toBeLessThanOrEqual(geral.criticasAbertas)
    expect(geral.aprovadosPct).toBeGreaterThan(0.5)
    expect(geral.pendenciasVencidas).toBeGreaterThan(0)
  })

  it('respostas do formulário seguem o status da qualificação', () => {
    const rascunho = data.ativos.find((a) => a.qualificacao.status === 'rascunho' && a.qualificacao.progresso < 0.6)!
    const resp = Object.values(respostasDo(rascunho))
    expect(resp.length).toBe(FORMULARIOS[rascunho.tipo].flatMap((s) => s.perguntas).length)
    expect(resp.some((r) => r === null)).toBe(true)
    const aprovado = data.ativos.find((a) => a.qualificacao.status === 'aprovado')!
    expect(Object.values(respostasDo(aprovado)).every((r) => r !== null && r !== 'nao')).toBe(true)
  })

  it('busca por nome, código e acentos', () => {
    expect(buscar(data, 'pix agendado')[0]?.tipo).toBe('projeto')
    expect(buscar(data, 'ATV-00001')[0]?.id).toBe('atv-00001')
    expect(buscar(data, 'joao pedro')[0]?.titulo).toBe('João Pedro Lima')
  })
})
