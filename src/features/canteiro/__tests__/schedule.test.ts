import { describe, expect, it } from 'vitest'
import { criarObraMock, OBRAS_CONFIG } from '../data/mock'
import { avancoFisico, desviosPavimentos, estadosPavimentos, pavimentosVisiveis } from '../data/schedule'

const AGORA = new Date('2026-11-06T14:00:00-03:00')
const ob01 = criarObraMock(OBRAS_CONFIG[0], AGORA)
const hoje = ob01.obra.semanaAtual

describe('cronograma 4D — pavimentos visíveis por data', () => {
  it('antes do início da estrutura, nenhum pavimento aparece', () => {
    expect(pavimentosVisiveis(ob01, 0)).toEqual([])
    expect(pavimentosVisiveis(ob01, 8)).toEqual([])
  })

  it('o prédio cresce um pavimento por ciclo de estrutura', () => {
    expect(pavimentosVisiveis(ob01, 9)).toEqual([1])
    expect(pavimentosVisiveis(ob01, 12)).toEqual([1, 2])
    expect(pavimentosVisiveis(ob01, 19)).toEqual([1, 2, 3, 4])
  })

  it('hoje há 5 pavimentos com estrutura concluída e o 6º em execução', () => {
    expect(pavimentosVisiveis(ob01, hoje)).toEqual([1, 2, 3, 4, 5, 6])
    const estados = estadosPavimentos(ob01, hoje, 'executado')
    expect(estados.slice(0, 5).every((e) => e.estrutura === 1)).toBe(true)
    expect(estados[5].estrutura).toBeGreaterThan(0.65)
    expect(estados[5].estrutura).toBeLessThan(1)
    expect(estados[6].status).toBe('futuro')
  })

  it('datas futuras usam projeção a partir do ritmo atual', () => {
    expect(pavimentosVisiveis(ob01, hoje + 4)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(pavimentosVisiveis(ob01, hoje + 5)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    const fim = estadosPavimentos(ob01, ob01.obra.duracaoSemanas, 'executado')
    expect(fim.every((e) => e.status === 'concluido')).toBe(true)
  })

  it('previsto e executado divergem onde a alvenaria atrasou', () => {
    const desvios = desviosPavimentos(ob01, hoje)
    expect(desvios[2]).toBe('atrasado') // 3º pav: alvenaria em 50% contra 100% previsto
    expect(desvios[5]).toBe('no_prazo') // estrutura no ritmo
    expect(desvios[7]).toBe('nao_iniciado')
  })

  it('avanço físico real de 62% contra previsto maior', () => {
    expect(avancoFisico(ob01, hoje, 'executado')).toBeCloseTo(0.62, 2)
    expect(avancoFisico(ob01, hoje, 'previsto')).toBeGreaterThan(0.65)
  })
})
