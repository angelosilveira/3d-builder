import { describe, expect, it } from 'vitest'
import { DOCUMENTOS_OBRIGATORIOS, FORMULARIOS } from '../data/catalogo'
import {
  buscar,
  calcularKpis,
  criarIndice,
  documentosFaltando,
  FILTROS_VAZIOS,
  mascaraFiltro,
  qualificacaoVencida,
  respostasDo,
  statusDoAtivo,
  vulnAberta,
} from '../data/derived'
import { calcularLayout, CELULA } from '../data/layout'
import { criarAppSecMock } from '../data/mock'

const AGORA = new Date('2026-11-08T12:00:00-03:00')
const data = criarAppSecMock({ agora: AGORA })
const idx = criarIndice(data)
const layout = calcularLayout(data)

describe('inventário mockado', () => {
  it('tem mais de 3.000 ativos dos 5 tipos, e qualificações nos 4 status', () => {
    expect(data.ativos.length).toBeGreaterThan(3000)
    expect(new Set(data.ativos.map((a) => a.tipo))).toEqual(new Set(['proxy', 'microservico', 'web', 'mobile', 'desktop']))
    expect(new Set(data.qualificacoes.map((q) => q.status))).toEqual(new Set(['aprovado', 'rascunho', 'depreciado', 'reprovado']))
  })

  it('é determinístico para a mesma data e semente', () => {
    const outro = criarAppSecMock({ agora: AGORA })
    expect(outro.ativos.map((a) => a.nome)).toEqual(data.ativos.map((a) => a.nome))
    expect(outro.qualificacoes.length).toBe(data.qualificacoes.length)
    expect(outro.documentos.length).toBe(data.documentos.length)
  })

  it('mantém referências consistentes entre entidades', () => {
    const ativos = new Set(data.ativos.map((a) => a.id))
    const projetos = new Set(data.projetos.map((p) => p.id))
    const analistas = new Set(data.analistas.map((a) => a.id))
    for (const q of data.qualificacoes) {
      expect(ativos.has(q.ativoId) && projetos.has(q.projetoId) && analistas.has(q.analistaId)).toBe(true)
      expect(idx.ativoPorId.get(q.ativoId)!.projetoId).toBe(q.projetoId)
      expect(idx.ativoPorId.get(q.ativoId)!.tipo).toBe(q.tipo)
    }
    expect(data.documentos.every((d) => idx.qualPorId.has(d.qualificacaoId))).toBe(true)
    expect(data.pendencias.every((p) => idx.qualPorId.get(p.qualificacaoId)?.ativoId === p.ativoId)).toBe(true)
    expect(data.vulnerabilidades.every((v) => idx.qualPorId.get(v.qualificacaoId)?.ativoId === v.ativoId)).toBe(true)
    expect(new Set(data.qualificacoes.map((q) => q.codigo)).size).toBe(data.qualificacoes.length)
  })
})

describe('qualificações', () => {
  it('cada ativo tem exatamente uma qualificação vigente', () => {
    const vigentes = data.qualificacoes.filter((q) => q.vigente)
    expect(vigentes.length).toBe(data.ativos.length)
    expect(new Set(vigentes.map((q) => q.ativoId)).size).toBe(data.ativos.length)
  })

  it('o histórico é mais antigo que a vigente e não tem maturidade maior', () => {
    let comHistorico = 0
    for (const a of data.ativos) {
      const [atual, ...anteriores] = idx.historico.get(a.id)!
      expect(atual.vigente).toBe(true)
      if (anteriores.length) comHistorico++
      for (const h of anteriores) {
        expect(h.vigente).toBe(false)
        expect(h.abertaEm < atual.abertaEm).toBe(true)
        expect(h.maturidade).toBeLessThanOrEqual(atual.maturidade)
        expect(h.concluidaEm).not.toBeNull()
      }
    }
    expect(comHistorico).toBeGreaterThan(data.ativos.length * 0.3)
  })

  it('aprovada tem todos os documentos obrigatórios e nenhuma crítica aberta', () => {
    for (const q of data.qualificacoes.filter((x) => x.vigente && x.status === 'aprovado')) {
      expect(documentosFaltando(q, idx.docsPorQual.get(q.id) ?? [])).toEqual([])
      expect(q.validadeAte).not.toBeNull()
      const criticas = (idx.vulnsPorAtivo.get(q.ativoId) ?? []).filter((v) => v.severidade === 'critica' && vulnAberta(v))
      expect(criticas).toEqual([])
    }
  })

  it('risco aceito exige o termo anexado na qualificação', () => {
    const comAceite = data.vulnerabilidades.filter((v) => v.status === 'risco_aceito')
    expect(comAceite.length).toBeGreaterThan(0)
    for (const v of comAceite) {
      expect((idx.docsPorQual.get(v.qualificacaoId) ?? []).some((d) => d.categoria === 'aceite_risco')).toBe(true)
    }
  })

  it('rascunhos e reprovadas podem passar do prazo; aprovadas não contam como vencidas', () => {
    const vigentes = data.qualificacoes.filter((q) => q.vigente)
    const vencidas = vigentes.filter((q) => qualificacaoVencida(q, idx.agora))
    expect(vencidas.length).toBeGreaterThan(0)
    expect(vencidas.every((q) => q.status === 'rascunho' || q.status === 'reprovado')).toBe(true)
  })

  it('analista da qualificação tem a especialidade do tipo', () => {
    const porId = new Map(data.analistas.map((a) => [a.id, a]))
    expect(data.qualificacoes.every((q) => porId.get(q.analistaId)!.especialidades.includes(q.tipo))).toBe(true)
  })

  it('documentos faltando consideram os obrigatórios do formulário', () => {
    const q = data.qualificacoes.find((x) => x.vigente && x.status === 'rascunho' && documentosFaltando(x, idx.docsPorQual.get(x.id) ?? []).length > 0)!
    const faltando = documentosFaltando(q, idx.docsPorQual.get(q.id) ?? [])
    expect(faltando.every((c) => DOCUMENTOS_OBRIGATORIOS[q.tipo].includes(c))).toBe(true)
  })
})

describe('layout agrupado', () => {
  it('posiciona cada ativo dentro da placa do seu projeto', () => {
    data.ativos.forEach((a, i) => {
      const p = layout.projetoPorId.get(a.projetoId)!
      expect(Math.abs(layout.pos[i * 2] - p.x)).toBeLessThan(p.w / 2)
      expect(Math.abs(layout.pos[i * 2 + 1] - p.z)).toBeLessThan(p.d / 2)
    })
  })

  it('não sobrepõe ativos, projetos nem áreas', () => {
    const chaves = new Set<string>()
    for (let i = 0; i < data.ativos.length; i++) chaves.add(`${Math.round((layout.pos[i * 2] / CELULA) * 2)}:${Math.round((layout.pos[i * 2 + 1] / CELULA) * 2)}`)
    expect(chaves.size).toBe(data.ativos.length)
    const sobrepoe = (a: { x: number; z: number; w: number; d: number }, b: typeof a) =>
      Math.abs(a.x - b.x) * 2 < a.w + b.w - 1e-6 && Math.abs(a.z - b.z) * 2 < a.d + b.d - 1e-6
    for (const lista of [layout.projetos, layout.areas])
      for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) expect(sobrepoe(lista[i], lista[j])).toBe(false)
  })

  it('agrupa os ativos por tipo dentro do projeto (proxies primeiro)', () => {
    const p = data.projetos[0]
    const doProjeto = data.ativos.map((a, i) => ({ a, i })).filter(({ a }) => a.projetoId === p.id)
    const primeiro = doProjeto.reduce((m, c) =>
      layout.pos[c.i * 2 + 1] < layout.pos[m.i * 2 + 1] || (layout.pos[c.i * 2 + 1] === layout.pos[m.i * 2 + 1] && layout.pos[c.i * 2] < layout.pos[m.i * 2]) ? c : m,
    )
    expect(primeiro.a.tipo).toBe('proxy')
  })
})

describe('filtros, KPIs e busca', () => {
  const conta = (m: Uint8Array) => m.reduce((s, v) => s + v, 0)

  it('sem filtros, todos passam', () => {
    expect(conta(mascaraFiltro(data, idx, FILTROS_VAZIOS))).toBe(data.ativos.length)
  })

  it('combina tipo, status e severidade (pela qualificação vigente)', () => {
    const mask = mascaraFiltro(data, idx, { ...FILTROS_VAZIOS, tipos: ['mobile'], status: ['reprovado'], severidade: 'alta' })
    const passaram = data.ativos.map((a, i) => ({ a, i })).filter(({ i }) => mask[i])
    expect(passaram.length).toBeGreaterThan(0)
    for (const { a, i } of passaram) {
      expect(a.tipo).toBe('mobile')
      expect(statusDoAtivo(idx, i)).toBe('reprovado')
      const abertas = (idx.vulnsPorAtivo.get(a.id) ?? []).filter(vulnAberta)
      expect(abertas.some((v) => v.severidade === 'critica' || v.severidade === 'alta')).toBe(true)
    }
  })

  it('filtra por maturidade, prazo vencido e documentos faltando', () => {
    const m1 = mascaraFiltro(data, idx, { ...FILTROS_VAZIOS, maturidades: [1] })
    data.ativos.forEach((a, i) => m1[i] && expect(idx.vigente.get(a.id)!.maturidade).toBe(1))
    const prazo = mascaraFiltro(data, idx, { ...FILTROS_VAZIOS, apenasPrazoVencido: true })
    expect(conta(prazo)).toBeGreaterThan(0)
    data.ativos.forEach((_, i) => prazo[i] && expect(idx.prazoVencido[i]).toBe(1))
    const docs = mascaraFiltro(data, idx, { ...FILTROS_VAZIOS, apenasDocsFaltando: true })
    expect(conta(docs)).toBeGreaterThan(0)
    data.ativos.forEach((a, i) => {
      if (!docs[i]) return
      const q = idx.vigente.get(a.id)!
      expect(documentosFaltando(q, idx.docsPorQual.get(q.id) ?? []).length).toBeGreaterThan(0)
    })
  })

  it('KPIs respeitam a máscara', () => {
    const geral = calcularKpis(data, idx)
    const proxies = calcularKpis(data, idx, mascaraFiltro(data, idx, { ...FILTROS_VAZIOS, tipos: ['proxy'] }))
    expect(proxies.ativos).toBeLessThan(geral.ativos)
    expect(proxies.criticasAbertas).toBeLessThanOrEqual(geral.criticasAbertas)
    expect(geral.aprovadosPct).toBeGreaterThan(0.5)
    expect(geral.maturidadeMedia).toBeGreaterThan(2)
    expect(geral.maturidadeMedia).toBeLessThan(5)
    expect(geral.qualificacoesVencidas).toBeGreaterThan(0)
    expect(geral.documentosFaltando).toBeGreaterThan(0)
  })

  it('respostas do formulário seguem o status da qualificação', () => {
    const rascunho = data.qualificacoes.find((q) => q.status === 'rascunho' && q.progresso < 0.6)!
    const resp = Object.values(respostasDo(rascunho))
    expect(resp.length).toBe(FORMULARIOS[rascunho.tipo].flatMap((s) => s.perguntas).length)
    expect(resp.some((r) => r === null)).toBe(true)
    const aprovada = data.qualificacoes.find((q) => q.status === 'aprovado')!
    expect(Object.values(respostasDo(aprovada)).every((r) => r !== null && r !== 'nao')).toBe(true)
  })

  it('busca por nome, código de ativo, código de qualificação e acentos', () => {
    expect(buscar(data, 'pix agendado')[0]?.tipo).toBe('projeto')
    expect(buscar(data, 'ATV-00001')[0]?.id).toBe('atv-00001')
    expect(buscar(data, 'QLF-00001')[0]?.tipo).toBe('qualificacao')
    expect(buscar(data, 'joao pedro')[0]?.titulo).toBe('João Pedro Lima')
  })
})
