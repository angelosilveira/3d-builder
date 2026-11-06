import { describe, expect, it } from 'vitest'
import { guessRoomKind, parsePlantText, textFromItems } from '../plantParser'
import { roomsFromAnswers, DEFAULT_ANSWERS } from '../questionnaire'

describe('parsePlantText', () => {
  it('reconhece rótulos com dimensões', () => {
    const rooms = parsePlantText(`
      SALA 4,00 x 3,50
      QUARTO 01 - 3.20X3.00
      COZINHA: 2,80 × 3,10
      BANHEIRO 1,50x2,40
      ESCALA 1:50
    `)
    expect(rooms.map((r) => [r.kind, r.width, r.depth])).toEqual([
      ['sala', 4, 3.5],
      ['quarto', 3.2, 3],
      ['cozinha', 2.8, 3.1],
      ['banheiro', 1.5, 2.4],
    ])
  })

  it('reconhece rótulos com área e estima dimensões', () => {
    const [suite] = parsePlantText('SUÍTE A=12,50m²')
    expect(suite.kind).toBe('quarto')
    expect(suite.width * suite.depth).toBeCloseTo(12.5, 1)
  })

  it('ignora textos que não são cômodos', () => {
    expect(parsePlantText('PRANCHA 01 - FOLHA A1 841 x 594')).toEqual([])
  })
})

describe('guessRoomKind', () => {
  it('mapeia sinônimos comuns', () => {
    expect(guessRoomKind('Dormitório 2')).toBe('quarto')
    expect(guessRoomKind('Lavanderia')).toBe('area_servico')
    expect(guessRoomKind('WC')).toBe('banheiro')
  })
})

describe('roomsFromAnswers', () => {
  it('gera suítes com banheiro e garagem proporcional às vagas', () => {
    const rooms = roomsFromAnswers({ ...DEFAULT_ANSWERS, quartos: 3, suites: 2, garagemVagas: 2 })
    expect(rooms.filter((r) => r.kind === 'quarto')).toHaveLength(3)
    expect(rooms.filter((r) => r.kind === 'banheiro')).toHaveLength(3) // 2 suítes + 1 social
    expect(rooms.find((r) => r.kind === 'garagem')?.width).toBeCloseTo(5.6)
  })
})

describe('textFromItems', () => {
  it('pareia nome e medida em textos separados (padrão CAD)', () => {
    const text = textFromItems([
      { str: 'SALA DE ESTAR', x: 190, y: 406 },
      { str: 'COZINHA', x: 395, y: 406 },
      { str: '5,20 x 4,00', x: 190, y: 392 },
      { str: '3,00 x 3,60', x: 395, y: 392 },
      { str: 'LAVANDERIA', x: 540, y: 406 },
      { str: 'A=4,80m²', x: 540, y: 392 },
      { str: 'PRANCHA 01/03', x: 80, y: 40 },
    ])
    const rooms = parsePlantText(text)
    expect(rooms.map((r) => [r.name, r.width, r.depth].slice(0, r.kind === 'area_servico' ? 1 : 3))).toEqual([
      ['Sala de estar', 5.2, 4],
      ['Cozinha', 3, 3.6],
      ['Lavanderia'],
    ])
  })
})
