import { TIPOS } from './catalogo'
import type { AppSecData } from './types'

/**
 * Layout agrupado do ecossistema: área → projeto → ativos (agrupados por
 * tipo dentro da placa do projeto). Coordenadas em metros, no plano XZ,
 * centralizadas na origem. Função pura: calculada uma vez por inventário.
 */

export const CELULA = 1.3
const PAD_PROJETO = 0.9
const GAP_PROJETO = 1.6
const PAD_AREA = 2.4
/** Faixa no topo da área onde fica o rótulo pintado no chão. */
export const FAIXA_ROTULO = 4
const GAP_AREA = 5

export interface Retangulo {
  id: string
  /** Centro. */
  x: number
  z: number
  w: number
  d: number
}

export interface LayoutEcossistema {
  /** x,z do centro de cada ativo, alinhado a `data.ativos`. */
  pos: Float32Array
  projetos: Retangulo[]
  areas: Retangulo[]
  projetoPorId: Map<string, Retangulo>
  areaPorId: Map<string, Retangulo>
  largura: number
  profundidade: number
}

interface Caixa {
  w: number
  d: number
}

/** Empacotamento em faixas: devolve o canto mínimo de cada caixa e o tamanho total. */
function empacotar(caixas: Caixa[], larguraAlvo: number, gap: number) {
  const pos: { x: number; z: number }[] = []
  let x = 0
  let z = 0
  let alturaLinha = 0
  let largura = 0
  for (const c of caixas) {
    if (x > 0 && x + c.w > larguraAlvo) {
      z += alturaLinha + gap
      x = 0
      alturaLinha = 0
    }
    pos.push({ x, z })
    x += c.w + gap
    alturaLinha = Math.max(alturaLinha, c.d)
    largura = Math.max(largura, x - gap)
  }
  return { pos, largura, profundidade: z + alturaLinha }
}

const ordemTipo = new Map(TIPOS.map((t, i) => [t, i]))

export function calcularLayout(data: AppSecData): LayoutEcossistema {
  const pos = new Float32Array(data.ativos.length * 2)
  const ativosPorProjeto = new Map<string, number[]>()
  data.ativos.forEach((a, i) => {
    const l = ativosPorProjeto.get(a.projetoId) ?? []
    l.push(i)
    ativosPorProjeto.set(a.projetoId, l)
  })

  // 1) Cada projeto vira uma placa com os ativos em grade, agrupados por tipo.
  const placas = data.projetos.map((p) => {
    const idx = (ativosPorProjeto.get(p.id) ?? []).sort(
      (a, b) => ordemTipo.get(data.ativos[a].tipo)! - ordemTipo.get(data.ativos[b].tipo)! || a - b,
    )
    const colunas = Math.max(2, Math.ceil(Math.sqrt(idx.length * 1.35)))
    const linhas = Math.max(1, Math.ceil(idx.length / colunas))
    return { projeto: p, idx, colunas, w: colunas * CELULA + PAD_PROJETO * 2, d: linhas * CELULA + PAD_PROJETO * 2 }
  })

  // 2) Projetos empacotados dentro de cada área.
  const blocos = data.areas.map((area) => {
    const minhas = placas.filter((pl) => pl.projeto.areaId === area.id).sort((a, b) => b.d - a.d)
    const areaTotal = minhas.reduce((s, p) => s + (p.w + GAP_PROJETO) * (p.d + GAP_PROJETO), 0)
    const alvo = Math.max(Math.sqrt(areaTotal) * 1.25, ...minhas.map((p) => p.w))
    const pack = empacotar(minhas, alvo, GAP_PROJETO)
    return {
      area,
      placas: minhas,
      pack,
      w: pack.largura + PAD_AREA * 2,
      d: pack.profundidade + PAD_AREA * 2 + FAIXA_ROTULO,
    }
  })

  // 3) Áreas empacotadas no mapa (mais largo que alto, como uma tela).
  const blocosOrdenados = [...blocos].sort((a, b) => b.d - a.d)
  const total = blocosOrdenados.reduce((s, b) => s + (b.w + GAP_AREA) * (b.d + GAP_AREA), 0)
  const mapa = empacotar(blocosOrdenados, Math.max(Math.sqrt(total) * 1.45, ...blocos.map((b) => b.w)), GAP_AREA)
  const ox = -mapa.largura / 2
  const oz = -mapa.profundidade / 2

  const projetos: Retangulo[] = []
  const areas: Retangulo[] = []
  blocosOrdenados.forEach((b, bi) => {
    const ax = ox + mapa.pos[bi].x
    const az = oz + mapa.pos[bi].z
    areas.push({ id: b.area.id, x: ax + b.w / 2, z: az + b.d / 2, w: b.w, d: b.d })
    b.placas.forEach((pl, pi) => {
      const px = ax + PAD_AREA + b.pack.pos[pi].x
      const pz = az + PAD_AREA + FAIXA_ROTULO + b.pack.pos[pi].z
      projetos.push({ id: pl.projeto.id, x: px + pl.w / 2, z: pz + pl.d / 2, w: pl.w, d: pl.d })
      pl.idx.forEach((ai, k) => {
        const col = k % pl.colunas
        const lin = Math.floor(k / pl.colunas)
        pos[ai * 2] = px + PAD_PROJETO + CELULA / 2 + col * CELULA
        pos[ai * 2 + 1] = pz + PAD_PROJETO + CELULA / 2 + lin * CELULA
      })
    })
  })

  return {
    pos,
    projetos,
    areas,
    projetoPorId: new Map(projetos.map((p) => [p.id, p])),
    areaPorId: new Map(areas.map((a) => [a.id, a])),
    largura: mapa.largura,
    profundidade: mapa.profundidade,
  }
}
