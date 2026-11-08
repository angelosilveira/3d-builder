import { describe, expect, it } from 'vitest'
import { projecao } from '../scene/CameraRig'

describe('enquadramento da câmera', () => {
  it('vista de cima (polar 0) mostra a região em tamanho real', () => {
    const p = projecao({ x: 0, z: 0, w: 20, d: 10 }, 0, 0, 0)
    expect(p.w).toBeCloseTo(20)
    expect(p.h).toBeCloseTo(10)
  })
  it('a 45° de azimute um quadrado vira um losango de diagonal √2·lado', () => {
    const p = projecao({ x: 5, z: -3, w: 10, d: 10 }, Math.PI / 4, 0, 0)
    expect(p.w).toBeCloseTo(10 * Math.SQRT2)
  })
  it('inclinar a câmera achata a profundidade no eixo vertical da tela', () => {
    const plano = projecao({ x: 0, z: 0, w: 10, d: 10 }, 0, 0, 0)
    const inclinado = projecao({ x: 0, z: 0, w: 10, d: 10 }, 0, Math.PI / 3, 0)
    expect(inclinado.h).toBeCloseTo(plano.h * Math.cos(Math.PI / 3))
  })
})
