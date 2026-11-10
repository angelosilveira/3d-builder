import { beam, box, ground, metal, paintFaces, solid, walls, glass, type Face, type Pixel, type Point, type Projection } from './landscape'
import { centroObra, obras, progressoNoMapa, statusObra, type Obra } from './obras'

/**
 * Canteiros das obras desenhados com as mesmas primitivas do mapa (faces
 * isométricas). A forma depende da etapa: a torre sobe módulo a módulo, o
 * prédio ganha pavimentos, a vala avança pela rua e o cabo segue os postes.
 */

export interface ObjetoObra {
  x: number
  z: number
  faces: Face[]
  obra: Obra
}
export interface DesenhoObras {
  /** Camadas de chão (lotes, valas), pintadas antes das construções. */
  chao: Face[][]
  objetos: ObjetoObra[]
  /** Contorno da obra selecionada. */
  destaque?: (ctx: CanvasRenderingContext2D, camera: Projection) => void
}

const concreto = ['#9aa3a3', '#8c9595', '#b4bcba', '#a9b1af', '#c7cdca']
const terra = ['#9c8663', '#8f7a59', '#ad9670', '#a38c68', '#b9a27b']
const amarelo = ['#d9a43a', '#c99532', '#f2c25a', '#e0b04a', '#ffd877']
const aco = ['#7b8a92', '#6f7e87', '#a9b6bb', '#94a2a8', '#c2ccce']
const laranja = ['#d9773a', '#c96a32', '#f2955a', '#e0874a', '#ffad77']
const tijolo = ['#b65f45', '#a8553e', '#d27a5a', '#c06a4f', '#e08d6c']
const madeira = ['#a77b4f', '#946c45', '#c39463', '#b08155', '#d4a877']

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** Lote de terra batida com tapume e placa de obra. */
function lote(chao: Face[], faces: Face[], x: number, z: number, w: number, d: number, tapume: boolean) {
  box(chao, x, ground + 0.004, z, w, 0.02, d, terra)
  if (!tapume) return
  const h = 0.3,
    t = 0.05
  const cor = ['#d7d0bd', '#cbc3ad', '#ebe4cf', '#c4bba3', '#f3ecd7']
  box(faces, x, ground, z - d / 2, w, h, t, cor)
  box(faces, x - w / 2, ground, z, t, h, d, cor)
  box(faces, x + w / 2, ground, z, t, h, d, cor)
  // Frente com portão aberto no meio.
  const lado = (w - 1.1) / 2
  box(faces, x - w / 2 + lado / 2, ground, z + d / 2, lado, h, t, cor)
  box(faces, x + w / 2 - lado / 2, ground, z + d / 2, lado, h, t, cor)
  placa(faces, x - w / 2 + 0.55, z + d / 2 + 0.25)
}
function placa(faces: Face[], x: number, z: number) {
  for (const dx of [-0.28, 0.28]) box(faces, x + dx, ground, z, 0.05, 0.62, 0.05, madeira)
  box(faces, x, ground + 0.42, z, 0.72, 0.36, 0.04, ['#2c6b62', '#2c6b62', '#3f8f80', '#2c6b62', '#5fb3a0'])
}
function pilha(faces: Face[], x: number, z: number, cores: string[], n = 3) {
  for (let k = 0; k < n; k++) box(faces, x + (k % 2) * 0.05, ground + k * 0.12, z, 0.62 - k * 0.08, 0.12, 0.4, cores)
}
/** Monte de areia/terra: tronco de pirâmide. */
function monte(faces: Face[], x: number, z: number, r: number, h: number, cores = terra) {
  const ring = (rr: number, y: number): Point[] => Array.from({ length: 6 }, (_, i) => [x + Math.cos((i * Math.PI) / 3) * rr, y, z + Math.sin((i * Math.PI) / 3) * rr * 0.8])
  solid(faces, ring(r, ground), ring(r * 0.35, ground + h), cores, cores[4])
}
function cone(faces: Face[], x: number, z: number) {
  const ring: Point[] = Array.from({ length: 4 }, (_, i) => [x + Math.cos((i * Math.PI) / 2 + 0.78) * 0.11, ground, z + Math.sin((i * Math.PI) / 2 + 0.78) * 0.11])
  ring.forEach((p, i) => faces.push({ points: [p, ring[(i + 1) % 4], [x, ground + 0.32, z]], color: i % 2 ? '#f28a3c' : '#ffb070' }))
}
function caminhao(faces: Face[], x: number, z: number, cores = amarelo) {
  box(faces, x, ground + 0.08, z, 1.0, 0.3, 0.46, cores)
  box(faces, x + 0.42, ground + 0.38, z, 0.3, 0.26, 0.42, ['#335c6b', '#2d5361', '#5c8b98', '#406e7c', '#6fa1ad'])
  for (const dx of [-0.32, 0.3]) box(faces, x + dx, ground, z + 0.24, 0.2, 0.16, 0.04, ['#26373b'])
}

/* ---------------- Tipos de obra ---------------- */

function torre(_o: Obra, x: number, z: number, p: Record<string, number>, faces: Face[]) {
  const f = clamp01(p.fundacao)
  if (f > 0) for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(faces, x + sx * 0.3, ground, z + sz * 0.3, 0.36, 0.08 + 0.14 * f, 0.36, concreto)
  const est = clamp01(p.estrutura)
  const H = 3.1 * est
  if (H > 0.05) {
    const topo = lerp(0.24, 0.07, est)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) beam(faces, [x + sx * 0.24, ground, z + sz * 0.24], [x + sx * topo, ground + H, z + sz * topo], 0.035, metal)
    for (let y = 0.55; y < H; y += 0.55) {
      const r = lerp(0.24, 0.07, y / 3.1)
      for (const side of [-1, 1]) beam(faces, [x + side * r, ground + y - 0.5, z + r], [x - side * r, ground + y, z + r], 0.022, metal)
    }
  }
  const ant = clamp01(p.antenas)
  if (ant > 0) {
    box(faces, x, ground + H - 0.3, z, 0.6, 0.08, 0.46, metal)
    for (let k = 0; k < Math.ceil(ant * 3); k++) {
      const a = (k * Math.PI * 2) / 3
      box(faces, x + Math.cos(a) * 0.28, ground + H - 0.46, z + Math.sin(a) * 0.28, 0.13, 0.5, 0.14, ['#8596a1', '#9eaab2', '#f4f0dd', '#cfcec0', '#faf9e7'])
    }
  }
  if (p.energia > 0) box(faces, x + 0.75, ground, z - 0.5, 0.36, 0.55 * clamp01(p.energia * 1.5), 0.32, metal)
  // Guindaste enquanto a estrutura sobe; módulos de aço esperando no chão.
  if ((est > 0 && est < 1) || (ant > 0 && ant < 1)) {
    caminhao(faces, x + 1.05, z + 0.95)
    beam(faces, [x + 0.95, ground + 0.45, z + 0.95], [x + 0.32, ground + Math.max(1.2, H + 0.55), z + 0.3], 0.045, amarelo)
  }
  if (est < 1) pilha(faces, x - 1.1, z + 0.9, aco, 2 + Math.round((1 - est) * 2))
}

function estacao(_o: Obra, x: number, z: number, p: Record<string, number>, faces: Face[]) {
  const b = clamp01(p.base)
  if (b > 0) box(faces, x, ground, z - 0.1, 2.0, 0.04 + 0.08 * b, 1.5, concreto)
  const a = clamp01(p.abrigo)
  if (a > 0) {
    const h = 0.95 * a
    box(faces, x, ground + 0.12, z - 0.1, 1.5, h, 1.05, ['#c8d3d6', '#b9c6ca', '#e4ebec', '#d3dcdf', '#eef3f3'])
    if (a >= 1) {
      box(faces, x, ground + 1.07, z - 0.1, 1.62, 0.07, 1.16, metal)
      box(faces, x + 0.84, ground + 0.5, z - 0.1, 0.12, 0.32, 0.42, metal)
      box(faces, x - 0.3, ground + 0.12, z + 0.43, 0.38, 0.72, 0.03, ['#4b8f9d', '#4b8f9d', '#72aeb8', '#4b8f9d', '#98d8d5'])
    }
  }
  const olt = clamp01(p.olt)
  if (olt < 1 && (a > 0 || olt > 0)) {
    // Bobina de cabo esperando a fusão.
    const cx = x + 1.05,
      cz = z + 0.75
    const ring = (y: number): Point[] => Array.from({ length: 8 }, (_, i) => [cx + Math.cos((i * Math.PI) / 4) * 0.28, y + 0.28 + Math.sin((i * Math.PI) / 4) * 0.28, cz])
    solid(faces, ring(ground).map(([px, py, pz]) => [px, py, pz - 0.12]), ring(ground).map(([px, py, pz]) => [px, py, pz + 0.12]), madeira, madeira[4])
  }
}

function predio(o: Obra, x: number, z: number, p: Record<string, number>, faces: Face[], grua: GruaInfo[]) {
  const bx = x - 0.4,
    bz = z - 0.2,
    W = 3.4,
    D = 2.9,
    andar = 0.52,
    pav = 4
  const f = clamp01(p.fundacao)
  if (f > 0) box(faces, bx, ground, bz, W + 0.2, 0.05 + 0.08 * f, D + 0.2, concreto)
  const feitos = clamp01(p.estrutura) * pav
  const alv = clamp01(p.alvenaria) * pav
  const base = ground + 0.13
  for (let k = 0; k < Math.ceil(feitos); k++) {
    const parcial = Math.min(1, feitos - k)
    const y = base + k * andar
    if (k < Math.floor(alv)) {
      // Pavimento fechado: alvenaria e faixa de janelas.
      box(faces, bx, y, bz, W - 0.1, andar - 0.06, D - 0.1, walls)
      for (const dx of [-1.1, -0.35, 0.4, 1.15]) box(faces, bx + dx, y + 0.16, bz + D / 2 - 0.03, 0.42, 0.24, 0.04, glass)
    } else {
      // Esqueleto: pilares e laje.
      for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) box(faces, bx + (dx * (W - 0.3)) / 2, y, bz + (dz * (D - 0.3)) / 2, 0.12, (andar - 0.06) * parcial, 0.12, concreto)
    }
    if (parcial >= 1) box(faces, bx, y + andar - 0.06, bz, W, 0.07, D, concreto)
  }
  const topo = base + Math.ceil(feitos) * andar
  if (p.acabamento > 0) for (const dx of [-0.8, 0.5]) box(faces, bx + dx, topo, bz - 0.4, 0.5, 0.28, 0.42, metal)
  // Andaime na fachada enquanto a alvenaria avança.
  if (alv > 0 && alv < pav && feitos > 0) {
    const hz = bz + D / 2 + 0.22
    for (let dx = -W / 2; dx <= W / 2 + 0.01; dx += W / 4) box(faces, bx + dx, ground, hz, 0.04, topo - ground, 0.04, laranja)
    for (let k = 1; k <= Math.ceil(feitos); k++) box(faces, bx, base + k * andar - 0.1, hz, W, 0.035, 0.18, laranja)
  }
  // Grua: mastro estático aqui; a lança gira na camada de animação.
  const obraAtiva = p.acabamento < 1
  if (obraAtiva && (p.estrutura > 0 || p.alvenaria > 0)) {
    const mx = x + 2.05,
      mz = z - 1.75
    const h = Math.max(topo + 1.5, ground + 2.8)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(faces, [mx + sx * 0.12, ground, mz + sz * 0.12], [mx + sx * 0.12, h, mz + sz * 0.12], 0.025, amarelo)
    for (let y = ground + 0.4; y < h; y += 0.4) box(faces, mx, y, mz + 0.12, 0.26, 0.03, 0.03, amarelo)
    box(faces, mx, h, mz, 0.38, 0.22, 0.34, amarelo)
    grua.push({ obra: o, x: mx, z: mz, y: h + 0.22, alvoY: topo })
  }
  if (p.alvenaria < 1) {
    pilha(faces, x - 2.0, z + 1.75, tijolo, 3)
    monte(faces, x + 1.7, z + 1.8, 0.5, 0.42, ['#cbb487', '#bea77c', '#dcc596', '#d1ba8b', '#e8d3a6'])
  }
}

function energia(_o: Obra, x: number, z: number, p: Record<string, number>, faces: Face[]) {
  const b = clamp01(p.base)
  if (b > 0) box(faces, x, ground, z, 1.7, 0.04 + 0.07 * b, 1.3, concreto)
  const g = clamp01(p.gerador)
  if (g > 0) {
    box(faces, x - 0.2, ground + 0.11, z, 1.15, 0.62 * Math.max(0.25, g), 0.6, amarelo)
    if (g >= 0.6) beam(faces, [x - 0.6, ground + 0.7, z - 0.1], [x - 0.6, ground + 1.05, z - 0.1], 0.04, metal)
  }
  const bat = clamp01(p.baterias)
  if (bat > 0) box(faces, x + 0.6, ground + 0.11, z, 0.42, 0.72 * bat, 0.42, aco)
  else pilha(faces, x + 0.7, z + 0.45, aco, 2)
}

function galpao(_o: Obra, x: number, z: number, w: number, d: number, p: Record<string, number>, faces: Face[]) {
  const g = clamp01(p.galpao)
  // Piquetes nos cantos marcam o lote enquanto a obra não começa.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(faces, x + (sx * w) / 2, ground, z + (sz * d) / 2, 0.06, 0.32, 0.06, madeira)
  placa(faces, x - w / 2 + 0.5, z + d / 2 + 0.3)
  if (g <= 0) return
  const n = Math.max(1, Math.round(g * 5))
  for (let k = 0; k < n; k++) {
    const px = x - w / 2 + 0.6 + (k * (w - 1.2)) / 4
    for (const sz of [-1, 1]) beam(faces, [px, ground, z + sz * (d / 2 - 0.3)], [px, ground + 1.3, z + sz * (d / 2 - 0.3)], 0.04, aco)
    beam(faces, [px, ground + 1.3, z - d / 2 + 0.3], [px, ground + 1.75, z], 0.04, aco)
    beam(faces, [px, ground + 1.75, z], [px, ground + 1.3, z + d / 2 - 0.3], 0.04, aco)
  }
  if (g >= 1) box(faces, x, ground, z, w - 1.0, 1.3, d - 0.6, ['#a9b6bb', '#94a2a8', '#c2ccce', '#b4c0c4', '#d6dee0'])
}

/** Vala do anel óptico: escavada até `vala`, dutos e cabo até `dutos`. */
function vala(o: Obra, de: [number, number], ate: [number, number], p: Record<string, number>, chao: Face[], faces: Face[], frentes: FrenteInfo[]) {
  const [ax, az] = de,
    [bx, bz] = ate
  const L = Math.hypot(bx - ax, bz - az)
  const ux = (bx - ax) / L,
    uz = (bz - az) / L
  const trecho = (t0: number, t1: number, largura: number, y: number, cores: string[], out: Face[]) => {
    if (t1 <= t0) return
    const cx = ax + ux * L * ((t0 + t1) / 2),
      cz = az + uz * L * ((t0 + t1) / 2)
    box(out, cx, ground + y, cz, Math.abs(ux) * L * (t1 - t0) + Math.abs(uz) * largura, 0.012, Math.abs(uz) * L * (t1 - t0) + Math.abs(ux) * largura, cores)
  }
  // Traçado previsto (fita de sinalização).
  trecho(0, 1, 0.08, 0.02, ['#f2d06b'], chao)
  const cav = clamp01(p.vala),
    dut = Math.min(cav, clamp01(p.dutos))
  trecho(0, cav, 0.55, 0.026, ['#6f5640', '#6f5640', '#7d6248', '#6f5640', '#7d6248'], chao)
  trecho(0, dut, 0.55, 0.034, ['#d8c79a'], chao)
  trecho(0, dut, 0.1, 0.042, ['#e07a3c'], chao)
  // Caixas de passagem no trecho pronto e montes de terra ao lado da vala aberta.
  for (let s = 0.04; s < dut; s += 0.1) box(faces, ax + ux * L * s, ground, az + uz * L * s - 0.45, 0.32, 0.08, 0.32, concreto)
  for (let s = Math.max(dut, 0.02); s < cav; s += 0.06) monte(faces, ax + ux * L * s, az + uz * L * s - 0.55, 0.26, 0.22)
  if (cav > 0 && cav < 1) {
    const fx = ax + ux * L * cav,
      fz = az + uz * L * cav
    // Retroescavadeira na frente de trabalho e cones isolando a área.
    box(faces, fx + 0.6, ground + 0.12, fz + 0.75, 0.9, 0.34, 0.5, amarelo)
    box(faces, fx + 0.85, ground + 0.46, fz + 0.75, 0.36, 0.34, 0.4, ['#335c6b', '#2d5361', '#5c8b98', '#406e7c', '#6fa1ad'])
    box(faces, fx + 0.6, ground, fz + 0.75, 1.0, 0.12, 0.56, ['#2f3c40'])
    for (const dz of [-0.55, 0.55]) cone(faces, fx + 1.3, fz + dz)
    frentes.push({ obra: o, x: fx, z: fz, braco: [fx + 0.3, ground + 0.5, fz + 0.75] })
  }
}

/** Fibra aérea: postes ao longo da rua, cordoalha e cabo até onde já foi lançado. */
function aerea(o: Obra, de: [number, number], ate: [number, number], p: Record<string, number>, faces: Face[], frentes: FrenteInfo[]) {
  const n = 9
  const H = 1.25
  const pos = (k: number): [number, number] => [lerp(de[0], ate[0], k / (n - 1)), lerp(de[1], ate[1], k / (n - 1)) - 0.24]
  for (let k = 0; k < n; k++) {
    const [px, pz] = pos(k)
    box(faces, px, ground, pz, 0.07, H, 0.07, concreto)
    box(faces, px, ground + H - 0.12, pz, 0.32, 0.03, 0.04, metal)
  }
  const fio = (frac: number, dy: number, cor: string[]) => {
    const total = (n - 1) * frac
    for (let k = 0; k < Math.ceil(total); k++) {
      const parte = Math.min(1, total - k)
      const [x0, z0] = pos(k),
        [x1, z1] = pos(k + 1)
      beam(faces, [x0, ground + H - dy, z0], [lerp(x0, x1, parte), ground + H - dy - 0.05 * Math.sin(Math.PI * parte), lerp(z0, z1, parte)], 0.012, cor)
    }
  }
  fio(clamp01(p.postes), 0.1, ['#56646a'])
  fio(clamp01(p.cabo), 0.2, ['#1f7f8f'])
  const ctos = Math.ceil(clamp01(p.cto) * 4)
  for (let k = 0; k < ctos; k++) {
    const [px, pz] = pos(1 + k * 2)
    box(faces, px, ground + H - 0.55, pz + 0.07, 0.18, 0.24, 0.1, ['#2b4f57', '#2b4f57', '#3d7380', '#2b4f57', '#5aa1ad'])
  }
  const c = clamp01(p.cabo)
  if (c > 0 && c < 1) {
    const [fx, fz] = pos((n - 1) * c)
    caminhao(faces, fx, fz + 0.75, ['#e4e7e2', '#d6d9d3', '#ffffff', '#e8ebe5', '#ffffff'])
    beam(faces, [fx - 0.1, ground + 0.45, fz + 0.75], [fx, ground + H - 0.1, fz + 0.12], 0.04, amarelo)
    frentes.push({ obra: o, x: fx, z: fz })
  }
}

/* ---------------- Montagem ---------------- */

export interface GruaInfo {
  obra: Obra
  x: number
  z: number
  y: number
  alvoY: number
}
export interface FrenteInfo {
  obra: Obra
  x: number
  z: number
  braco?: Point
}
export interface CenaObras {
  desenho: DesenhoObras
  gruas: GruaInfo[]
  frentes: FrenteInfo[]
}

const cache = new Map<string, CenaObras>()

/** Canteiros na data (null = situação executada hoje). Resultado em cache por data. */
export function montarObras(data: string | null): CenaObras {
  const chave = data ?? 'hoje'
  const pronto = cache.get(chave)
  if (pronto) return pronto
  const chao: Face[][] = []
  const objetos: ObjetoObra[] = []
  const gruas: GruaInfo[] = []
  const frentes: FrenteInfo[] = []
  for (const o of obras) {
    const p = progressoNoMapa(o, data)
    const l = o.local
    const piso: Face[] = []
    const faces: Face[] = []
    if (l.forma === 'lote') {
      const iniciou = Object.values(p).some((v) => v > 0)
      const ativa = iniciou && Object.values(p).some((v) => v < 1)
      if (o.tipo !== 'galpao' || iniciou) lote(piso, faces, l.x, l.z, l.w, l.d, ativa)
      if (o.tipo === 'torre') torre(o, l.x, l.z, p, faces)
      else if (o.tipo === 'estacao') estacao(o, l.x, l.z, p, faces)
      else if (o.tipo === 'predio') predio(o, l.x, l.z, p, faces, gruas)
      else if (o.tipo === 'energia') energia(o, l.x, l.z, p, faces)
      else if (o.tipo === 'galpao') galpao(o, l.x, l.z, l.w, l.d, p, faces)
    } else if (l.forma === 'trecho') {
      if (o.tipo === 'vala') vala(o, l.de, l.ate, p, piso, faces, frentes)
      else aerea(o, l.de, l.ate, p, faces, frentes)
    }
    if (piso.length) chao.push(piso)
    if (faces.length) {
      const [cx, cz] = centroObra(o)
      objetos.push({ x: cx, z: cz, faces, obra: o })
    }
  }
  const cena = { desenho: { chao, objetos }, gruas, frentes }
  if (cache.size > 40) cache.delete(cache.keys().next().value!)
  cache.set(chave, cena)
  return cena
}

/** Contorno (no chão) de uma obra, para destaque e clique. */
export function contornoObra(o: Obra, camera: Projection, folga = 0): Pixel[] {
  const l = o.local
  if (l.forma === 'lote') {
    const hw = l.w / 2 + folga,
      hd = l.d / 2 + folga
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ].map(([dx, dz]) => camera.project(l.x + dx, ground + 0.02, l.z + dz))
  }
  if (l.forma === 'trecho') {
    const [ax, az] = l.de,
      [bx, bz] = l.ate
    const L = Math.hypot(bx - ax, bz - az)
    const nx = (-(bz - az) / L) * (0.9 + folga),
      nz = ((bx - ax) / L) * (0.9 + folga)
    return [
      [ax + nx, az + nz],
      [bx + nx, bz + nz],
      [bx - nx, bz - nz],
      [ax - nx, az - nz],
    ].map(([px, pz]) => camera.project(px, ground + 0.02, pz))
  }
  const [cx, cy] = camera.project(l.x, ground, l.z)
  return [
    [cx - 10, cy - 10],
    [cx + 10, cy - 10],
    [cx + 10, cy + 10],
    [cx - 10, cy + 10],
  ]
}

export function dentro([x, y]: Pixel, poly: Pixel[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i],
      [bx, by] = poly[j]
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside
  }
  return inside
}

/** Obra sob o cursor (lotes e trechos; a obra concluída sem canteiro não é clicável no mapa). */
export function pickObra(camera: Projection, x: number, y: number): Obra | undefined {
  return obras.find((o) => o.local.forma !== 'ponto' && dentro([x, y], contornoObra(o, camera, 0.15)))
}

/** Contorno de destaque da obra selecionada. */
export function destacarObra(o: Obra | null) {
  if (!o) return undefined
  return (ctx: CanvasRenderingContext2D, camera: Projection) => {
    const poly = contornoObra(o, camera, 0.35)
    ctx.beginPath()
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fillStyle = 'rgba(141,233,213,.16)'
    ctx.fill()
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#8de9d5'
    ctx.lineWidth = 1.8
    ctx.stroke()
    ctx.setLineDash([])
  }
}

/* ---------------- Camada animada ---------------- */

/**
 * Vida no canteiro: operários circulando, a lança da grua girando com a carga,
 * o braço da retroescavadeira cavando e faíscas na montagem da torre.
 */
export function animarObras(ctx: CanvasRenderingContext2D, camera: Projection, time: number, still: boolean, cena: CenaObras, data: string | null) {
  const { project, scale } = camera
  const visivel = ([x, y]: Pixel) => x > -60 && y > -60 && x < camera.width + 60 && y < camera.height + 60
  // Grua.
  for (const g of cena.gruas) {
    const base = project(g.x, g.y, g.z)
    if (!visivel(base)) continue
    const a = still ? -0.9 : -0.9 + Math.sin(time / 5200) * 1.25
    const ponta = (r: number): Point => [g.x + Math.cos(a) * r, g.y + 0.12, g.z + Math.sin(a) * r]
    const linha = (p0: Point, p1: Point, cor: string, w: number) => {
      ctx.beginPath()
      ctx.moveTo(...project(...p0))
      ctx.lineTo(...project(...p1))
      ctx.strokeStyle = cor
      ctx.lineWidth = w
      ctx.stroke()
    }
    const lw = Math.max(1, scale * 0.06)
    linha(ponta(-1.4), ponta(4.6), '#e0b04a', lw * 1.4)
    linha([g.x, g.y + 0.75, g.z], ponta(4.6), '#c99532', Math.max(0.6, lw * 0.5))
    linha([g.x, g.y + 0.75, g.z], ponta(-1.4), '#c99532', Math.max(0.6, lw * 0.5))
    linha([g.x, g.y, g.z], [g.x, g.y + 0.75, g.z], '#c99532', lw)
    // Contrapeso e carga pendurada no carrinho.
    const [cx, cy] = project(...ponta(-1.25))
    ctx.fillStyle = '#7d8a90'
    ctx.fillRect(cx - scale * 0.14, cy - scale * 0.04, scale * 0.28, scale * 0.2)
    const r = still ? 3.2 : 2.6 + Math.sin(time / 1900) * 1.2
    const [tx, , tz] = ponta(r)
    const desce = still ? 0.6 : 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(time / 1300))
    const yCarga = lerp(g.y + 0.1, g.alvoY + 0.35, desce)
    linha([tx, g.y + 0.12, tz], [tx, yCarga, tz], '#2e3a3f', 0.8)
    const [lx, ly] = project(tx, yCarga, tz)
    ctx.fillStyle = '#b65f45'
    ctx.fillRect(lx - scale * 0.13, ly, scale * 0.26, scale * 0.15)
  }
  // Retroescavadeira: braço sobe e desce na vala.
  for (const f of cena.frentes) {
    if (!f.braco) continue
    const p0 = project(...f.braco)
    if (!visivel(p0)) continue
    const fase = still ? 0.4 : 0.5 + 0.5 * Math.sin(time / 650)
    const cotovelo: Point = [f.braco[0] - 0.45, f.braco[1] + 0.45 - fase * 0.2, f.braco[2] - 0.35]
    const pa: Point = [f.x, ground + 0.15 + (1 - fase) * 0.35, f.z]
    ctx.strokeStyle = '#d9a43a'
    ctx.lineWidth = Math.max(1.2, scale * 0.08)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(...p0)
    ctx.lineTo(...project(...cotovelo))
    ctx.lineTo(...project(...pa))
    ctx.stroke()
    ctx.lineCap = 'butt'
    const [px, py] = project(...pa)
    ctx.fillStyle = '#5b4a3a'
    ctx.beginPath()
    ctx.arc(px, py, Math.max(1.5, scale * 0.1), 0, Math.PI * 2)
    ctx.fill()
  }
  // Operários e faíscas só onde há trabalho na data mostrada.
  for (const o of obras) {
    const st = statusObra(o)
    if (st === 'planejada' || st === 'concluida' || data) continue
    const p = progressoNoMapa(o, null)
    const n = Math.min(6, o.equipe.reduce((s, x) => s + x.pessoas, 0))
    const l = o.local
    for (let i = 0; i < n; i++) {
      let wx: number, wz: number
      const ritmo = still ? 0 : time / (2600 + i * 370)
      if (l.forma === 'lote') {
        wx = l.x + Math.sin(ritmo + i * 2.1) * l.w * 0.33
        wz = l.z + Math.cos(ritmo * 0.8 + i * 1.3) * l.d * 0.3
      } else if (l.forma === 'trecho') {
        const frente = cena.frentes.find((fr) => fr.obra === o)
        const [ax, az] = l.de,
          [bx, bz] = l.ate
        const base = frente ? [frente.x, frente.z] : [(ax + bx) / 2, (az + bz) / 2]
        wx = base[0] - 0.4 - i * 0.45 + Math.sin(ritmo + i) * 0.25
        wz = base[1] + 0.35 + Math.cos(ritmo + i) * 0.2
      } else continue
      const pe = project(wx, ground, wz)
      if (!visivel(pe)) continue
      const cabeca = project(wx, ground + 0.36, wz)
      const s = Math.max(0.8, scale * 0.07)
      ctx.strokeStyle = '#f08a2c'
      ctx.lineWidth = s * 1.6
      ctx.beginPath()
      ctx.moveTo(...pe)
      ctx.lineTo(cabeca[0], cabeca[1] + s)
      ctx.stroke()
      ctx.fillStyle = '#ffd34d'
      ctx.beginPath()
      ctx.arc(cabeca[0], cabeca[1], s * 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
    // Faíscas no topo da torre em montagem.
    if (o.tipo === 'torre' && l.forma === 'lote' && p.estrutura > 0 && p.estrutura < 1 && !still) {
      const H = 3.1 * p.estrutura
      for (let k = 0; k < 6; k++) {
        const fase = (time / 220 + k * 0.37) % 1
        if (Math.sin(time / 90 + k * 7) < 0.2) continue
        const [sx, sy] = project(l.x + Math.cos(k * 1.7) * 0.18 * (1 + fase * 2), ground + H - fase * 0.6, l.z + Math.sin(k * 1.7) * 0.18)
        ctx.fillStyle = k % 2 ? '#fff6c1' : '#ffd34d'
        ctx.fillRect(sx - 1, sy - 1, 2, 2)
      }
    }
  }
}

/** Ponto de ancoragem do pino da obra (acima do canteiro). */
export function ancoraObra(o: Obra, data: string | null): Point {
  const [x, z] = centroObra(o)
  const p = progressoNoMapa(o, data)
  const altura =
    o.tipo === 'torre' ? 1.2 + 3.1 * p.estrutura : o.tipo === 'predio' ? 2 + 2.1 * p.estrutura : o.tipo === 'aerea' ? 1.6 : o.tipo === 'galpao' ? 1.6 : 1.4
  return [x, ground + altura, z]
}

export { paintFaces }
