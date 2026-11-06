import type { Equipamento, ObraData, Obra, StatusEquipamento } from '../data/types'

/**
 * Coordenadas do canteiro (metros; +z aponta para a rua). Funções puras
 * compartilhadas pela cena, pela câmera (voo até o objeto) e pelos pins.
 */

export type Vec3 = [number, number, number]

export const CENTRO_PREDIO: Vec3 = [-4, 0, -5]
export const SLAB = 0.2

export const CANTEIRO = { minX: -34, maxX: 34, minZ: -26, maxZ: 20 }
export const RUA = { z: 26, largura: 8 }
export const PORTAO = { minX: 8, maxX: 18 }

export const AREAS = {
  estoque: { x: -25, z: -16, w: 12, d: 12, rotulo: 'Estoque' },
  vergalhao: { x: -25, z: -5.5, w: 12, d: 5, rotulo: 'Armação' },
  cargaDescarga: { x: 13, z: 13, w: 10, d: 10, rotulo: 'Carga e descarga' },
  escavacao: { x: 24, z: -14, w: 10, d: 8, rotulo: 'Reservatório inferior' },
} as const

export function geometriaPredio(planta: Obra['planta']) {
  const { largura: W, profundidade: D, colunas, linhas, peDireito: h } = planta
  const [cx, , cz] = CENTRO_PREDIO
  const xs = Array.from({ length: colunas }, (_, i) => cx - W / 2 + (i * W) / (colunas - 1))
  const zs = Array.from({ length: linhas }, (_, j) => cz - D / 2 + (j * D) / (linhas - 1))
  return { W, D, h, cx, cz, xs, zs, minX: cx - W / 2, maxX: cx + W / 2, minZ: cz - D / 2, maxZ: cz + D / 2 }
}

/** Posição do pilar `indice` (linha a linha) na malha. */
export function posicaoPilar(planta: Obra['planta'], indice: number): [number, number] {
  const g = geometriaPredio(planta)
  const col = indice % planta.colunas
  const lin = Math.floor(indice / planta.colunas)
  return [g.xs[col], g.zs[lin]]
}

export const alturaGrua = (pavimentos: number, h: number) => pavimentos * h + 12

export function posicaoGrua(planta: Obra['planta']): Vec3 {
  const g = geometriaPredio(planta)
  return [g.maxX + 4.5, 0, g.minZ - 3]
}

export function posicaoBomba(planta: Obra['planta']): Vec3 {
  const g = geometriaPredio(planta)
  return [g.maxX + 4, 0, g.maxZ + 5.5]
}

export function posicaoElevador(planta: Obra['planta']): Vec3 {
  const g = geometriaPredio(planta)
  return [g.minX - 1.6, 0, g.cz]
}

export interface Pose {
  pos: Vec3
  /** Rotação em Y (radianos). 0 = cabine voltada para +x. */
  rot: number
  visivel: boolean
}

/** Onde cada betoneira fica conforme o status (a fila anda ao vivo). */
export function poseBetoneira(planta: Obra['planta'], status: StatusEquipamento, ordem: number): Pose {
  const bomba = posicaoBomba(planta)
  switch (status) {
    case 'descarregando':
      // Traseira encostada no funil da bomba.
      return { pos: [bomba[0] + 8.2, 0, bomba[2]], rot: 0, visivel: true }
    case 'aguardando':
      return { pos: [AREAS.cargaDescarga.x + 1, 0, AREAS.cargaDescarga.z - 1 + ordem * 3.4], rot: -Math.PI / 2, visivel: true }
    case 'em_transito':
      return { pos: [-20 + ordem * 3, 0, RUA.z + 1.8], rot: 0, visivel: true }
    case 'liberado':
      return { pos: [30, 0, RUA.z - 1.8], rot: 0, visivel: false }
    default:
      return { pos: [AREAS.cargaDescarga.x, 0, AREAS.cargaDescarga.z], rot: 0, visivel: true }
  }
}

export const POSICOES_FIXAS: Record<string, Vec3> = {
  'ES-01': [24, 0, -14],
  'RE-01': [24, 0, 3],
  container: [-26, 0, 12.5],
  almoxarifado: [-26, 0, 6],
}

/** Topo (y) do pavimento `numero` (1 = primeiro). */
export const topoPavimento = (numero: number, h: number) => numero * h

export interface AncoraOpts {
  /** Altura extra acima do objeto (para pins). */
  acima?: number
}

function posicaoEquipamento(data: ObraData, e: Equipamento): Vec3 {
  const { planta } = data.obra
  const h = planta.peDireito
  switch (e.tipo) {
    case 'grua': {
      const p = posicaoGrua(planta)
      return [p[0], alturaGrua(data.pavimentos.length, h) * 0.55, p[2]]
    }
    case 'bomba': {
      const p = posicaoBomba(planta)
      return [p[0], 2.5, p[2]]
    }
    case 'elevador': {
      const p = posicaoElevador(planta)
      return [p[0], 4, p[2]]
    }
    case 'betoneira': {
      const fila = data.equipamentos.filter((x) => x.tipo === 'betoneira' && x.status === e.status)
      const pose = poseBetoneira(planta, e.status, fila.indexOf(e))
      return [pose.pos[0], 2, pose.pos[2]]
    }
    default: {
      const p = POSICOES_FIXAS[e.codigo] ?? [0, 0, 0]
      return [p[0], 2, p[2]]
    }
  }
}

/** Ponto 3D que representa um objeto (para a câmera voar até ele e para pins). */
export function ancoraDe(data: ObraData, id: string, opts: AncoraOpts = {}): Vec3 | null {
  const acima = opts.acima ?? 0
  const { planta } = data.obra
  const h = planta.peDireito
  const g = geometriaPredio(planta)

  const el = data.elementos.find((e) => e.id === id)
  if (el) {
    const base = (el.pavimentoNumero - 1) * h
    if (el.tipo === 'laje') return [g.cx, base + h + acima, g.cz]
    const [x, z] = posicaoPilar(planta, el.indiceMalha ?? 0)
    return [x, base + h / 2 + acima, z]
  }
  const eq = data.equipamentos.find((e) => e.id === id)
  if (eq) {
    const p = posicaoEquipamento(data, eq)
    return [p[0], p[1] + acima, p[2]]
  }
  const c = data.concretagens.find((x) => x.id === id)
  if (c && c.elementoIds[0]) return ancoraDe(data, c.elementoIds[c.elementoIds.length - 1], opts)
  const equipe = data.equipes.find((e) => e.id === id)
  if (equipe) {
    const pos = posicoesTrabalhadores(data).find((t) => t.equipeId === id)
    if (pos) return [pos.pos[0], pos.pos[1] + 1 + acima, pos.pos[2]]
  }
  return null
}

export interface PosTrabalhador {
  equipeId: string
  funcao: ObraData['equipes'][number]['funcao']
  encarregado: boolean
  pos: Vec3
  rot: number
}

/** Pseudo-aleatório estável por índice (posições não "pulam" entre renders). */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Distribui os trabalhadores de cada equipe na zona em que ela atua. */
export function posicoesTrabalhadores(data: Pick<ObraData, 'obra' | 'equipes'>): PosTrabalhador[] {
  const { planta } = data.obra
  const g = geometriaPredio(planta)
  const h = planta.peDireito
  const bomba = posicaoBomba(planta)
  const out: PosTrabalhador[] = []
  let k = 0

  for (const eq of data.equipes) {
    for (let m = 0; m < eq.membros; m++, k++) {
      const r1 = hash(k)
      const r2 = hash(k + 101)
      let pos: Vec3
      switch (eq.zona) {
        case 'pavimento_atual':
          pos = [g.minX + 1.5 + r1 * (g.W - 3), eq.pavimentoNumero * h + SLAB / 2, g.minZ + 1.5 + r2 * (g.D - 3)]
          break
        case 'bomba':
          pos = [g.maxX - 2.5 - r1 * 6, eq.pavimentoNumero * h + SLAB / 2, g.maxZ - 1.5 - r2 * 4]
          break
        case 'alvenaria':
          // Na borda da fachada, onde a alvenaria ainda está aberta.
          pos = [g.minX + 1 + r1 * (g.W - 2), Math.max(0, eq.pavimentoNumero - 1) * h + SLAB / 2, g.maxZ - 0.9]
          break
        case 'estoque':
          pos = [AREAS.estoque.x - 4 + r1 * 8, 0, AREAS.estoque.z + AREAS.estoque.d / 2 + 1 + r2 * 2]
          break
        default:
          pos = [bomba[0] - 14 + r1 * 4, 0, 15 + r2 * 2]
      }
      out.push({ equipeId: eq.id, funcao: eq.funcao, encarregado: m === 0, pos, rot: r2 * Math.PI * 2 })
    }
  }
  return out
}
