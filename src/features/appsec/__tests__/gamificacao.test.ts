import { beforeEach, describe, expect, it } from 'vitest'
import { documentosFaltando, pendenciaVencida } from '../data/derived'
import { conquistas, missoes, NIVEIS, nivelDe, PESOS, pontuacao, rankingAreas } from '../data/gamificacao'
import { criarAppSecMock } from '../data/mock'
import { useAppSecData } from '../data/store'

const AGORA = new Date('2026-11-08T12:00:00-03:00')

beforeEach(() => useAppSecData.getState().carregar(criarAppSecMock({ agora: AGORA })))
const estado = () => useAppSecData.getState()

describe('pontuação de postura', () => {
  it('fica entre 0 e 1.000 e soma os componentes pelos pesos', () => {
    const { data, indice } = estado()
    const p = pontuacao(data, indice)
    expect(p.total).toBeGreaterThan(0)
    expect(p.total).toBeLessThan(1000)
    const recomposto = (Object.keys(PESOS) as (keyof typeof PESOS)[]).reduce((s, k) => s + PESOS[k] * p.fracoes[k], 0)
    expect(p.total).toBe(Math.round(recomposto))
    for (const f of Object.values(p.fracoes)) {
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThanOrEqual(1)
    }
  })

  it('níveis cobrem toda a escala e o progresso vai de 0 a 1', () => {
    expect(nivelDe(0).atual.nome).toBe('Exposto')
    expect(nivelDe(NIVEIS[2].min).atual.nome).toBe('Sentinela')
    expect(nivelDe(NIVEIS[2].min).progresso).toBe(0)
    expect(nivelDe(1000)).toMatchObject({ proximo: null, progresso: 1 })
    expect(nivelDe(475).progresso).toBeCloseTo(0.5)
  })

  it('ranking ordena as áreas pela pontuação', () => {
    const { data, indice } = estado()
    const r = rankingAreas(data, indice)
    expect(r).toHaveLength(data.areas.length)
    expect(r.map((x) => x.posicao)).toEqual(data.areas.map((_, i) => i + 1))
    for (let i = 1; i < r.length; i++) expect(r[i - 1].pontos).toBeGreaterThanOrEqual(r[i].pontos)
  })
})

describe('ações simuladas melhoram a postura de verdade', () => {
  it('concluir as pendências vencidas de um ativo sobe a pontuação', () => {
    const { data, indice } = estado()
    // Ativo cujo único motivo de prazo vencido são pendências (qualificação no prazo).
    const ativo = data.ativos.find((a) => {
      const q = indice.vigente.get(a.id)!
      return indice.pendVencida[indice.posAtivo.get(a.id)!] && q.status === 'aprovado'
    })!
    const antes = pontuacao(data, indice).total
    for (const p of indice.pendPorAtivo.get(ativo.id)!.filter((x) => pendenciaVencida(x, indice.agora))) estado().concluirPendencia(p.id)
    const depois = estado()
    expect(depois.indice.prazoVencido[depois.indice.posAtivo.get(ativo.id)!]).toBe(0)
    expect(pontuacao(depois.data, depois.indice).total).toBeGreaterThanOrEqual(antes)
    expect(pontuacao(depois.data, depois.indice).fracoes.prazos).toBeGreaterThan(pontuacao(data, indice).fracoes.prazos)
  })

  it('enviar os documentos faltantes zera a pendência de documentação', () => {
    const { data, indice } = estado()
    const q = data.qualificacoes.find((x) => x.vigente && documentosFaltando(x, indice.docsPorQual.get(x.id) ?? []).length > 0)!
    for (const c of documentosFaltando(q, indice.docsPorQual.get(q.id) ?? [])) estado().enviarDocumento(q.id, c)
    const depois = estado()
    expect(documentosFaltando(q, depois.indice.docsPorQual.get(q.id) ?? [])).toEqual([])
    expect(depois.indice.docsFaltando[depois.indice.posAtivo.get(q.ativoId)!]).toBe(0)
    expect(pontuacao(depois.data, depois.indice).fracoes.documentacao).toBeGreaterThan(pontuacao(data, indice).fracoes.documentacao)
  })

  it('não duplica documento nem reconclui pendência', () => {
    const { data } = estado()
    const p = data.pendencias.find((x) => x.status === 'aberta')!
    estado().concluirPendencia(p.id)
    const ref = estado().data
    estado().concluirPendencia(p.id)
    expect(estado().data).toBe(ref)
  })
})

describe('conquistas e missões', () => {
  it('conquistas refletem o estado dos ativos', () => {
    const { indice, data } = estado()
    const projeto = data.projetos[0]
    const lista = conquistas(indice, indice.ativosPorProjeto.get(projeto.id)!)
    expect(lista.map((c) => c.id)).toEqual(['sem_criticas', 'documentacao', 'em_dia', 'maduro', 'aprovado'])
    const emDia = lista.find((c) => c.id === 'em_dia')!
    const temVencido = indice.ativosPorProjeto.get(projeto.id)!.some((a) => indice.prazoVencido[indice.posAtivo.get(a.id)!])
    expect(emDia.obtida).toBe(!temVencido)
  })

  it('sugere três missões com progresso e recompensa', () => {
    const { data, indice } = estado()
    const m = missoes(data, indice)
    expect(m).toHaveLength(3)
    for (const x of m) {
      expect(x.progresso).toBeGreaterThanOrEqual(0)
      expect(x.progresso).toBeLessThan(1)
      expect(x.recompensa).toBeGreaterThan(0)
      expect(Object.keys(x.filtros).length).toBeGreaterThan(0)
    }
  })
})
