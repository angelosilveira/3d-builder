import { PLACA_H } from './Ecossistema'

/** Arco quadrático entre dois pontos do mapa: A (origem), C (controle), B (destino). */
export interface Arco {
  a: [number, number, number]
  c: [number, number, number]
  b: [number, number, number]
}

/**
 * Arco de uma conexão. A altura cresce com a distância: ligações dentro do
 * projeto ficam baixas; chamadas entre projetos sobem e cruzam o mapa.
 */
export function arcoEntre(xa: number, za: number, ya: number, xb: number, zb: number, yb: number): Arco {
  const dist = Math.hypot(xb - xa, zb - za)
  const altura = Math.min(34, 0.9 + dist * 0.32)
  return {
    a: [xa, ya, za],
    b: [xb, yb, zb],
    c: [(xa + xb) / 2, Math.max(ya, yb) + altura * 2, (za + zb) / 2],
  }
}

/** Ponto do arco em t ∈ [0, 1]. */
export function pontoNoArco(arco: Arco, t: number, out: [number, number, number] = [0, 0, 0]) {
  const u = 1 - t
  for (let k = 0; k < 3; k++) out[k] = u * u * arco.a[k] + 2 * u * t * arco.c[k] + t * t * arco.b[k]
  return out
}

/** Topo aproximado do ativo i (antes da animação de entrada terminar). */
export const topoPadrao = PLACA_H + 1

/** Arco de uma conexão a partir das posições atuais dos ativos no mapa. */
export function arcoDaConexao(
  layout: { pos: Float32Array },
  posAtivo: Map<string, number>,
  topo: Float32Array,
  origemId: string,
  destinoId: string,
): Arco | null {
  const i = posAtivo.get(origemId)
  const j = posAtivo.get(destinoId)
  if (i === undefined || j === undefined) return null
  return arcoEntre(layout.pos[i * 2], layout.pos[i * 2 + 1], (topo[i] || topoPadrao) + 0.05, layout.pos[j * 2], layout.pos[j * 2 + 1], (topo[j] || topoPadrao) + 0.05)
}
