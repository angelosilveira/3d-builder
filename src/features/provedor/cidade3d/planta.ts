import { districts, urbanAreas } from '../city'
import { accessPoints, clients, clientsByPoint, headquarters, regions } from '../data'

/**
 * Planta da cidade 3D em escala real (1 unidade = 1 metro), derivada do
 * cadastro: cada cliente ganha um lote, cada ponto de acesso um terreno.
 *
 *   Cidade (sede): 3 × 2 bairros. Cada bairro tem 8 ruas com 32 casas (16 de
 *   cada lado), divididas em duas quadras por um canteiro central com a torre
 *   e a estação óptica. Entre os bairros do norte e do sul fica a faixa do
 *   centro (sede do provedor, comércio, obras).
 *   Zona rural: 4 vilas ao redor, cada uma com 4 núcleos de 64 casas.
 *
 * Só matemática aqui (nada de Three.js), para poder ser testada.
 */
export const LOTE_W = 10.5
export const LOTE_D = 15
export const CALCADA = 3
export const RUA = 11
export const CASA = { w: 8.4, d: 10 }
export const QUADRA_W = 8 * LOTE_W + 2 * CALCADA
export const QUADRA_D = 2 * LOTE_D + 2 * CALCADA
const MEIA_D = LOTE_D + 2 * CALCADA
export const PRACA_W = 30
export const CENTRO_D = 84

const quadrasBairroZ = [MEIA_D, ...Array<number>(7).fill(QUADRA_D), MEIA_D]
export const blocksX = [0, 1, 2].flatMap(() => [QUADRA_W, PRACA_W, QUADRA_W])
export const blocksZ = [...quadrasBairroZ, CENTRO_D, ...quadrasBairroZ]
/** Linha de quadras do centro (entre os bairros do norte e do sul). */
export const LINHA_CENTRO = quadrasBairroZ.length

/** Mesma conta do `gridLayout` do kit: vias em volta de cada quadra. */
function eixo(tamanhos: number[]) {
  const total = tamanhos.reduce((a, b) => a + b, 0) + RUA * (tamanhos.length + 1)
  const vias: number[] = []
  const quadras: { centro: number; tamanho: number }[] = []
  let p = -total / 2
  vias.push(p + RUA / 2)
  p += RUA
  for (const t of tamanhos) {
    quadras.push({ centro: p + t / 2, tamanho: t })
    p += t
    vias.push(p + RUA / 2)
    p += RUA
  }
  return { total, vias, quadras }
}
const X = eixo(blocksX)
const Z = eixo(blocksZ)
export const cidade = { width: X.total, depth: Z.total, viasV: X.vias, viasH: Z.vias, quadrasX: X.quadras, quadrasZ: Z.quadras }

export interface Retangulo {
  x: number
  z: number
  w: number
  d: number
}
export interface PosicaoCasa {
  x: number
  z: number
  /** 0 = frente para +Z (sul); π = frente para −Z (norte). */
  rot: number
  /** Sobrado (2 andares) ou térrea. */
  andares: 1 | 2
  /** Posição na ordem das instâncias. */
  indice: number
}

/** Distância do eixo da rua ao centro da casa (meia rua + calçada + recuo + meia casa). */
const RECUO = 2
const AFASTAMENTO = RUA / 2 + CALCADA + RECUO + CASA.d / 2

/* ---------------- Cidade ---------------- */

const colunaDoBairro = (b: number) => (b % 3) * 3
const linhaDoBairro = (b: number) => (b < 3 ? 0 : LINHA_CENTRO + 1)
/** Eixo (z) da rua j (0–7) do bairro b. */
export const zDaRua = (b: number, j: number) => Z.vias[linhaDoBairro(b) + j + 1]

export const areas = new Map<string, Retangulo & { nome: string }>()
export const ruas = new Map<string, Retangulo>()
export const pontos = new Map<string, { x: number; z: number }>()
export const casas = new Map<string, PosicaoCasa>()

districts.forEach((d, b) => {
  const col = colunaDoBairro(b),
    lin = linhaDoBairro(b)
  const x0 = X.quadras[col].centro - QUADRA_W / 2,
    x1 = X.quadras[col + 2].centro + QUADRA_W / 2
  const z0 = Z.quadras[lin].centro - Z.quadras[lin].tamanho / 2,
    z1 = Z.quadras[lin + 8].centro + Z.quadras[lin + 8].tamanho / 2
  areas.set(d.id, { nome: d.name, x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 })
  for (let j = 0; j < 8; j++) ruas.set(`${d.id}-rua-${j}`, { x: (x0 + x1) / 2, z: zDaRua(b, j), w: x1 - x0, d: RUA + 2 * AFASTAMENTO + CASA.d })
  // Torre no norte do canteiro central, estação óptica no sul.
  const praca = X.quadras[col + 1].centro
  pontos.set('ERB-' + (17 + b * 2), { x: praca, z: Z.quadras[lin + 1].centro })
  pontos.set('POP-' + (18 + b * 2), { x: praca, z: Z.quadras[lin + 7].centro })
})

let indice = 0
const sobrado = (k: number) => (k * 7 + 3) % 5 === 0
for (const c of clients) {
  if (c.regionId !== headquarters.id || !c.streetId) continue
  const rua = urbanAreas.get(c.streetId)!
  const b = Number(rua.districtId.split('-')[1]),
    j = Number(c.streetId.split('-rua-')[1])
  // Posição ao longo da rua (0–15) e lado (norte/sul) vêm do endereço no cadastro.
  const p = Math.round((c.x - rua.x) / 0.91 + 7.5)
  const norte = c.z < rua.z
  const quadra = X.quadras[colunaDoBairro(b) + (p < 8 ? 0 : 2)].centro
  casas.set(c.id, {
    x: quadra - (8 * LOTE_W) / 2 + LOTE_W * ((p % 8) + 0.5),
    z: zDaRua(b, j) + (norte ? -AFASTAMENTO : AFASTAMENTO),
    rot: norte ? 0 : Math.PI,
    andares: sobrado(indice) ? 2 : 1,
    indice: indice++,
  })
}

/* ---------------- Faixa do centro ---------------- */

const zCentro = Z.quadras[LINHA_CENTRO].centro
export const quadraCentro = (col: number): Retangulo => ({ x: X.quadras[col].centro, z: zCentro, w: X.quadras[col].tamanho, d: CENTRO_D })
/** Sede do provedor (prédio principal) e pátio das viaturas. */
export const sede = { x: X.quadras[3].centro - 14, z: zCentro - 6 }
export const vagaViatura = (k: number) => ({ x: X.quadras[3].centro + 12 + (k % 3) * 9, z: zCentro + 8 + Math.floor(k / 3) * 14 })

/* ---------------- Vilas rurais ---------------- */

const RUA_VILA = 8
const AFAST_VILA = RUA_VILA / 2 + 3 + CASA.d / 2
const FAIXA = 16 * LOTE_W
const VAO = 20
export const VILA = { w: 2 * (FAIXA + VAO) + 8, d: 2 * (48 + 19 + AFAST_VILA + CASA.d / 2) + 8 }
export interface Estrada {
  de: [number, number]
  ate: [number, number]
  largura: number
}
export interface Vila extends Retangulo {
  id: string
  nome: string
  estradas: Estrada[]
  /** Por onde a fibra e a estrada chegam, vindo da cidade. */
  entrada: [number, number]
}
export const vilas: Vila[] = regions.map((r) => {
  const sx = Math.sign(r.x),
    sz = Math.sign(r.z)
  const x = sx * (X.total / 2 + 150 + VILA.w / 2),
    z = sz * 250
  const estradas: Estrada[] = []
  const ruasZ = [-67, -29, 29, 67].map((dz) => z + dz)
  for (const rz of ruasZ) estradas.push({ de: [x - FAIXA - VAO, rz], ate: [x + FAIXA + VAO, rz], largura: RUA_VILA })
  estradas.push({ de: [x, z - 71], ate: [x, z + 71], largura: RUA_VILA })
  // Estrada de acesso: do meio da vila até a borda da cidade.
  const borda = sx * (X.total / 2)
  estradas.push({ de: [x, z], ate: [borda, z], largura: RUA_VILA })
  areas.set(r.id, { nome: r.name, x, z, w: VILA.w, d: VILA.d })
  const pts = accessPoints.filter((p) => p.regionId === r.id)
  pts.forEach((p, i) => {
    const lado = i % 2 ? 1 : -1,
      cz = z + (i < 2 ? -48 : 48)
    pontos.set(p.id, { x: x + lado * 12, z: cz })
    clientsByPoint.get(p.id)!.forEach((c, k) => {
      const rua = cz + (k < 32 ? -19 : 19)
      const resid = k % 32,
        norte = resid % 2 === 0,
        pos = Math.floor(resid / 2)
      casas.set(c.id, {
        x: x + lado * (VAO + LOTE_W * (pos + 0.5)),
        z: rua + (norte ? -AFAST_VILA : AFAST_VILA),
        rot: norte ? 0 : Math.PI,
        andares: 1,
        indice: indice++,
      })
    })
  })
  return { id: r.id, nome: r.name, x, z, w: VILA.w, d: VILA.d, estradas, entrada: [borda, z] }
})

/** Área total (cidade + vilas), para enquadrar a câmera na visão geral. */
export const extensao = { width: 2 * (X.total / 2 + 150 + VILA.w) + 40, depth: Math.max(Z.total, 2 * (250 + VILA.d / 2)) + 40 }

/* ---------------- Fibra ---------------- */

export interface Fibra {
  tipo: 'tronco' | 'rua'
  /** Região atendida (bairros contam como sede). */
  regiaoId: string
  /** Ponto de acesso alimentado (troncos). */
  pontoId?: string
  /** Traçado no chão, de quem alimenta para quem é alimentado. */
  pts: [number, number][]
}
/** Avenida ao norte da faixa do centro: por ela saem os troncos da sede. */
const zAvenida = Z.vias[LINHA_CENTRO] + RUA / 2 + 1
export const fibras: Fibra[] = []
for (const p of accessPoints) {
  const pos = pontos.get(p.id)!
  if (p.regionId === headquarters.id) {
    fibras.push({ tipo: 'tronco', regiaoId: p.regionId, pontoId: p.id, pts: [[sede.x, sede.z], [sede.x, zAvenida], [pos.x, zAvenida], [pos.x, pos.z]] })
  } else {
    const v = vilas.find((x) => x.id === p.regionId)!
    fibras.push({ tipo: 'tronco', regiaoId: p.regionId, pontoId: p.id, pts: [[sede.x, sede.z], [sede.x, zAvenida], [v.entrada[0], zAvenida], [v.entrada[0], v.z + 6], [v.x + 6, v.z + 6], [v.x + 6, pos.z], [pos.x, pos.z]] })
  }
}
// Distribuição: um cabo por rua, saindo do canteiro central (cidade) ou da via central (vila).
districts.forEach((d, b) => {
  const a = areas.get(d.id)!
  for (let j = 0; j < 8; j++) {
    const z = zDaRua(b, j) - RUA / 2 - 1
    fibras.push({ tipo: 'rua', regiaoId: headquarters.id, pts: [[a.x, z], [a.x - a.w / 2 + 4, z]] }, { tipo: 'rua', regiaoId: headquarters.id, pts: [[a.x, z], [a.x + a.w / 2 - 4, z]] })
  }
})
for (const v of vilas)
  for (const dz of [-67, -29, 29, 67])
    for (const lado of [-1, 1]) fibras.push({ tipo: 'rua', regiaoId: v.id, pts: [[v.x + lado * 6, v.z + dz - 5], [v.x + lado * (FAIXA + VAO), v.z + dz - 5]] })

/** Postes ao longo de um traçado, um a cada `passo` metros (inclui as pontas). */
export function postesDaFibra(f: Fibra, passo = 30): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < f.pts.length - 1; i++) {
    const [ax, az] = f.pts[i],
      [bx, bz] = f.pts[i + 1]
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / passo))
    for (let k = i === 0 ? 0 : 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n])
  }
  return out
}

/* ---------------- Obras ---------------- */

const noc = quadraCentro(2),
  galpao = quadraCentro(0),
  torre17 = pontos.get('ERB-17')!,
  uniao = ruas.get('bairro-5-rua-0')!
/** Onde cada obra fica na cidade 3D (o cadastro guarda só o lugar no mapa plano). */
export const obras3d: Record<string, { x: number; z: number; ate?: [number, number] }> = {
  'OB-01': { x: X.total / 2 + 70, z: -70 },
  'OB-02': { x: X.total / 2 + 70, z: 60 },
  'OB-03': { x: noc.x, z: noc.z },
  'OB-04': { x: X.quadras[0].centro, z: -Z.total / 2 - 10, ate: [X.quadras[5].centro, -Z.total / 2 - 10] },
  'OB-05': { x: torre17.x + 9, z: torre17.z + 4 },
  'OB-06': { x: uniao.x - uniao.w / 2 + 6, z: uniao.z + RUA / 2 + 1, ate: [uniao.x + uniao.w / 2 - 6, uniao.z + RUA / 2 + 1] },
  'OB-07': { x: galpao.x, z: galpao.z },
  'OB-08': { ...pontos.get('POP-18')! },
}

/* ---------------- Rota das viaturas ---------------- */

const maisPerto = (lista: number[], v: number) => lista.reduce((m, x) => (Math.abs(x - v) < Math.abs(m - v) ? x : m), lista[0])

/**
 * Trajeto pelas ruas, do pátio da sede até a frente da casa do cliente:
 * avenida do centro → via transversal mais próxima → rua do cliente.
 * Na zona rural segue a estrada até a vila.
 */
export function rotaViatura(k: number, clientId: string): [number, number][] {
  const casa = casas.get(clientId)!
  const vaga = vagaViatura(k)
  const vila = vilas.find((v) => Math.abs(casa.x - v.x) <= v.w / 2 && Math.abs(casa.z - v.z) <= v.d / 2)
  if (vila) {
    const rua = maisPerto([-67, -29, 29, 67].map((dz) => vila.z + dz), casa.z)
    const zSaida = maisPerto([Z.vias[LINHA_CENTRO], Z.vias[LINHA_CENTRO + 1]], vila.z)
    return [[vaga.x, vaga.z], [vaga.x, zSaida], [vila.entrada[0], zSaida], [vila.entrada[0], vila.z], [vila.x, vila.z], [vila.x, rua], [casa.x, rua]]
  }
  const norte = casa.z < zCentro
  const zAvenida = Z.vias[norte ? LINHA_CENTRO : LINHA_CENTRO + 1]
  const rua = maisPerto(Z.vias, casa.z + (casa.rot === 0 ? 1 : -1) * (RUA / 2 + CALCADA + RECUO + CASA.d / 2))
  const transversal = maisPerto(X.vias, casa.x)
  return [[vaga.x, vaga.z], [vaga.x, zAvenida], [transversal, zAvenida], [transversal, rua], [casa.x, rua]]
}

/** Ponto e direção (ângulo em Y) a uma fração u (0–1) do trajeto. */
export function pontoNaRota(rota: [number, number][], u: number) {
  const trechos = rota.slice(1).map(([x, z], i) => Math.hypot(x - rota[i][0], z - rota[i][1]))
  let resto = Math.max(0, Math.min(1, u)) * trechos.reduce((a, b) => a + b, 0)
  let i = 0
  while (i < trechos.length - 1 && resto > trechos[i]) resto -= trechos[i++]
  const [ax, az] = rota[i],
    [bx, bz] = rota[i + 1]
  const t = trechos[i] ? resto / trechos[i] : 0
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, ang: Math.atan2(-(bz - az), bx - ax) }
}
