import * as THREE from 'three'
import { accessPoints, clients, headquarters, pointById } from '../data'
import { obras, progressoNoMapa, type Obra as ObraCadastro } from '../obras'
import {
  addStreetLamps,
  addTraffic,
  addTrees,
  beamGeometry,
  box,
  boxGeometry,
  buildGround,
  Buildings,
  createStage,
  dimAtNight,
  FACADES,
  facadeBoxGeometry,
  facadeMaterial,
  gridLayout,
  lampPoints,
  makeSign,
  mat,
  MATS,
  mergedMesh,
  rng,
  scatterPoints,
  streetTreePoints,
  type Hit,
  type Horario,
  type Ponto,
  type Stage,
} from './city-kit.js'
import { ISP, Obra } from './kit-domains.js'
import {
  areas,
  blocksX,
  blocksZ,
  CALCADA,
  CASA,
  casas,
  cidade,
  extensao,
  fibras,
  LINHA_CENTRO,
  obras3d,
  pontos,
  postesDaFibra,
  quadraCentro,
  RUA,
  sede,
  vagaViatura,
  vilas,
} from './planta'

/**
 * Cena 3D de Aracatu no estilo "cidade viva": um único canvas WebGL, texturas
 * pintadas em tempo de execução, casas instanciadas (uma por cliente), torres,
 * estações, postes e fibra com pulsos de luz, trânsito e ciclo de horário.
 * Nada de React aqui: o componente só chama esta API.
 */
export type Alvo = { tipo: 'cliente'; id: string } | { tipo: 'ponto'; id: string } | { tipo: 'obra'; id: string } | { tipo: 'sede' } | null

const TELHADOS = ['#b0563d', '#9c4a36', '#8a5a44', '#6d6a66', '#7b6f63', '#a8674a', '#5f6b74']
const PAREDES = ['#ffffff', '#f3ece0', '#e9f0f2', '#f6e6d8', '#eef2e4', '#f2e9ee']
const Y_CABO = 8.6
const ALTURA_POSTE = 9

export interface CoresCasa {
  /** Cor do telhado (null = cor normal da casa). */
  telhado?: string | null
  /** Casa fora do foco: fica acinzentada. */
  apagada?: boolean
}
export interface PulsoRegiao {
  cor: string
  velocidade: number
}

export function criarCidade(container: HTMLElement, opcoes: { horario?: Horario } = {}) {
  const stage = createStage(container, { time: opcoes.horario ?? 'noite' })
  const { scene } = stage
  const r = rng(2026)
  const layout = gridLayout({ blocksX, blocksZ, road: RUA, sidewalk: CALCADA })

  /* ---------- Chão, ruas e praças ---------- */
  const pracas: [number, number][] = []
  for (const col of [1, 4, 7]) for (let j = 0; j < blocksZ.length; j++) pracas.push([col, j])
  buildGround(stage, layout, { groundColor: '#bfcaa6', parks: pracas })

  // Vilas: chão de terra batida e estradas.
  const terra = dimAtNight(mat('#cdc6ae', { rough: 1 }), 0.55)
  const asfalto = dimAtNight(mat('#565b62', { rough: 0.95 }), 0.4)
  const estradas: THREE.BufferGeometry[] = []
  for (const v of vilas) {
    const chao = box(v.w, 0.03, v.d, terra, v.x, -0.02, v.z)
    chao.castShadow = false
    chao.receiveShadow = true
    scene.add(chao)
    for (const e of v.estradas) {
      const [ax, az] = e.de,
        [bx, bz] = e.ate
      estradas.push(boxGeometry(Math.abs(bx - ax) + (ax === bx ? e.largura : 0), 0.04, Math.abs(bz - az) + (az === bz ? e.largura : 0), (ax + bx) / 2, 0, (az + bz) / 2))
    }
  }
  const malhaEstradas = mergedMesh(estradas, asfalto, false)
  malhaEstradas.receiveShadow = true
  scene.add(malhaEstradas)

  /* ---------- Casas (uma instância por cliente) ---------- */
  const spec = FACADES.house
  const tmp = new THREE.Object3D()
  const cor = new THREE.Color()
  interface Grupo {
    paredes: THREE.InstancedMesh
    telhado: THREE.InstancedMesh
    ids: string[]
    parede: THREE.Color[]
    cobertura: THREE.Color[]
  }
  const grupos: Grupo[] = []
  const instancia = new Map<string, { g: Grupo; i: number }>()
  for (const andares of [1, 2] as const) {
    const lista = clients.filter((c) => casas.get(c.id)!.andares === andares)
    const h = andares * 2.8,
      rh = 2.6
    const F = facadeMaterial('house'),
      R = MATS.roof()
    const paredes = new THREE.InstancedMesh(facadeBoxGeometry(CASA.w, h, CASA.d, spec), [F, F, R, R, F, F], lista.length)
    const forma = new THREE.Shape([new THREE.Vector2(-CASA.w / 2 - 0.5, 0), new THREE.Vector2(CASA.w / 2 + 0.5, 0), new THREE.Vector2(0, rh)])
    const telhado = new THREE.InstancedMesh(
      new THREE.ExtrudeGeometry(forma, { depth: CASA.d + 0.8, bevelEnabled: false }).translate(0, h, -(CASA.d + 0.8) / 2),
      mat('#ffffff', { rough: 0.8 }),
      lista.length,
    )
    const g: Grupo = { paredes, telhado, ids: lista.map((c) => c.id), parede: [], cobertura: [] }
    lista.forEach((c, i) => {
      const p = casas.get(c.id)!
      tmp.position.set(p.x, c.regionId === headquarters.id ? 0.18 : 0, p.z)
      tmp.rotation.set(0, p.rot, 0)
      tmp.scale.set(1, 1, 1)
      tmp.updateMatrix()
      paredes.setMatrixAt(i, tmp.matrix)
      telhado.setMatrixAt(i, tmp.matrix)
      g.parede.push(new THREE.Color(PAREDES[(p.indice * 7) % PAREDES.length]))
      g.cobertura.push(new THREE.Color(TELHADOS[(p.indice * 13 + 5) % TELHADOS.length]))
      paredes.setColorAt(i, g.parede[i])
      telhado.setColorAt(i, g.cobertura[i])
      instancia.set(c.id, { g, i })
    })
    for (const m of [paredes, telhado]) {
      m.castShadow = m.receiveShadow = true
      stage.add(m, { tipo: 'casas', ids: g.ids })
    }
    grupos.push(g)
  }
  const CINZA = new THREE.Color('#a9aeb0')
  /** Recolore as casas conforme a camada (telhado por situação) e o foco (apagadas). */
  function pintarCasas(regra: ((clientId: string) => CoresCasa | null) | null) {
    for (const g of grupos) {
      g.ids.forEach((id, i) => {
        const c = regra?.(id)
        const parede = c?.apagada ? cor.copy(g.parede[i]).lerp(CINZA, 0.75) : g.parede[i]
        g.paredes.setColorAt(i, parede)
        const base = c?.telhado ? cor.set(c.telhado) : cor.copy(g.cobertura[i])
        g.telhado.setColorAt(i, c?.apagada ? base.lerp(CINZA, 0.8) : base)
      })
      g.paredes.instanceColor!.needsUpdate = true
      g.telhado.instanceColor!.needsUpdate = true
    }
  }

  /* ---------- Centro: sede, comércio e praças ---------- */
  const centro: THREE.Object3D[] = []
  const por = <T extends THREE.Object3D>(obj: T, x: number, z: number, rot = 0, alvo?: Alvo) => {
    obj.position.set(x, 0.18, z)
    obj.rotation.y = rot
    stage.add(obj, alvo ?? undefined)
    centro.push(obj)
    return obj
  }
  const predioSede = Buildings.office({ w: 30, d: 20, floors: 8, style: 'glassBlue', seed: 7 })
  const letreiro = makeSign('AtlasFibra', { bg: '#0f3b36', fg: '#8ff0cf', height: 3.2, glow: 1.6 })
  letreiro.position.set(0, (predioSede.userData.height as number) + 1.4, 10.2)
  predioSede.add(letreiro)
  por(predioSede, sede.x, sede.z, 0, { tipo: 'sede' })
  const q5 = quadraCentro(5),
    q6 = quadraCentro(6),
    q8 = quadraCentro(8),
    q0 = quadraCentro(0)
  const LOJAS: [string, string][] = [
    ['Mercado', '#c0392b'],
    ['Farmácia', '#2e7d5b'],
    ['Padaria', '#c98a2b'],
    ['Café', '#6b4a3a'],
    ['Lotérica', '#2b5fa8'],
  ]
  LOJAS.forEach(([nome, toldo], k) => por(Buildings.shop({ w: 13, d: 14, floors: 1 + (k % 2), awning: toldo, sign: nome, seed: 30 + k }), q5.x - 34 + k * 16.5, q5.z + 26))
  por(Buildings.apartment({ w: 24, d: 14, floors: 7, seed: 41 }), q5.x - 20, q5.z - 22, Math.PI)
  por(Buildings.apartment({ w: 24, d: 14, floors: 9, tint: '#f1e7da', seed: 42 }), q5.x + 20, q5.z - 22, Math.PI)
  por(Buildings.office({ w: 26, d: 18, floors: 5, style: 'officeWarm', seed: 51 }), q6.x - 22, q6.z + 22)
  por(Buildings.apartment({ w: 22, d: 14, floors: 6, seed: 52 }), q6.x + 24, q6.z + 24)
  por(Buildings.office({ w: 30, d: 16, floors: 3, style: 'officeWhite', greenRoof: true, seed: 53 }), q6.x, q6.z - 24, Math.PI)
  por(Buildings.shop({ w: 22, d: 16, floors: 2, awning: '#2b5fa8', sign: 'Feira coberta', seed: 61 }), q8.x - 22, q8.z + 24)
  por(Buildings.office({ w: 24, d: 16, floors: 4, style: 'brick', seed: 62 }), q8.x + 22, q8.z - 22, Math.PI)
  por(Buildings.warehouse({ w: 30, d: 18, h: 7, solar: true, docks: 2, seed: 71 }), q0.x + 26, q0.z - 24, Math.PI)
  stage.bake(centro.filter((o) => o !== predioSede))

  /* ---------- Pontos de acesso ---------- */
  const pontoObj = new Map<string, THREE.Object3D>()
  const fixos: THREE.Object3D[] = []
  for (const p of accessPoints) {
    const pos = pontos.get(p.id)!
    const urbano = p.regionId === headquarters.id
    const obj = p.technology === 'radio' ? ISP.tower({ h: urbano ? 42 : 34 }) : ISP.pop({ w: 14, d: 9, h: 4.6 })
    obj.position.set(pos.x, urbano ? 0.18 : 0, pos.z)
    stage.add(obj, { tipo: 'ponto', id: p.id })
    pontoObj.set(p.id, obj)
    if (p.technology === 'fiber') fixos.push(obj)
  }
  stage.bake(fixos)

  /* ---------- Árvores, postes de luz e trânsito ---------- */
  const arvores: Ponto[] = streetTreePoints(layout, { spacing: 22 })
  for (const b of layout.blocks) if (b.park) arvores.push(...scatterPoints({ x: b.x, z: b.z, w: b.w - 8, d: b.d - 6 }, b.j === LINHA_CENTRO ? 9 : 4, b.i * 31 + b.j))
  // Não planta em cima de torre, estação ou prédio do centro.
  const livre = (p: Ponto) => [...pontos.values()].every((q) => Math.hypot(p.x - q.x, p.z - q.z) > 11)
  addTrees(stage, arvores.filter(livre), { seed: 11 })
  const campo: Ponto[] = []
  const foraDeTudo = (x: number, z: number) =>
    (Math.abs(x) > cidade.width / 2 + 14 || Math.abs(z) > cidade.depth / 2 + 14) &&
    vilas.every((v) => Math.abs(x - v.x) > v.w / 2 + 8 || Math.abs(z - v.z) > v.d / 2 + 8) &&
    vilas.every((v) => Math.abs(z - v.z) > 9 || Math.abs(x) > Math.abs(v.x)) &&
    Object.values(obras3d).every((o) => Math.hypot(x - o.x, z - o.z) > 40)
  for (let k = 0; k < 1500; k++) {
    const x = (r() - 0.5) * (extensao.width + 900),
      z = (r() - 0.5) * (extensao.depth + 900)
    if (foraDeTudo(x, z)) campo.push({ x, z, s: 1.5 + r() * 1.8 })
  }
  addTrees(stage, campo, { seed: 23, y: 0 })
  // Talhões de lavoura e pasto até o horizonte.
  const talhoes: { x: number; z: number; w: number; d: number; c: string }[] = []
  const TONS = ['#b3c48f', '#c7cf9a', '#a9bd88', '#d2cba0', '#b8c7a0', '#c3b98c']
  for (let k = 0; k < 260; k++) {
    const x = (r() - 0.5) * (extensao.width + 1700),
      z = (r() - 0.5) * (extensao.depth + 1700)
    const w = 60 + r() * 110,
      d = 50 + r() * 90
    if (foraDeTudo(x - w / 2, z - d / 2) && foraDeTudo(x + w / 2, z + d / 2) && foraDeTudo(x, z)) talhoes.push({ x, z, w, d, c: TONS[k % TONS.length] })
  }
  const lavoura = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), dimAtNight(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), 0.6), talhoes.length)
  talhoes.forEach((t, i) => {
    tmp.position.set(t.x, -0.03, t.z)
    tmp.rotation.set(0, 0, 0)
    tmp.scale.set(t.w, 1, t.d)
    tmp.updateMatrix()
    lavoura.setMatrixAt(i, tmp.matrix)
    lavoura.setColorAt(i, cor.set(t.c))
  })
  lavoura.receiveShadow = true
  scene.add(lavoura)
  addStreetLamps(stage, lampPoints(layout, { spacing: 38 }))
  addTraffic(stage, layout, { density: 0.4 })

  /* ---------- Fibra: postes, cabos e pulsos ---------- */
  const postes: { x: number; z: number; ang: number }[] = []
  const vistos = new Set<string>()
  const cabosTronco: THREE.BufferGeometry[] = []
  const cabosRua: THREE.BufferGeometry[] = []
  interface Trilha {
    regiaoId: string
    tronco: boolean
    pts: THREE.Vector3[]
    acum: number[]
    total: number
    n: number
    fase: number
  }
  const trilhas: Trilha[] = []
  fibras.forEach((f, k) => {
    const lista = postesDaFibra(f, f.tipo === 'tronco' ? 34 : 30)
    const pts = lista.map(([x, z]) => new THREE.Vector3(x, Y_CABO, z))
    const acum = [0]
    for (let i = 1; i < pts.length; i++) {
      acum.push(acum[i - 1] + pts[i].distanceTo(pts[i - 1]))
      ;(f.tipo === 'tronco' ? cabosTronco : cabosRua).push(beamGeometry(pts[i - 1], pts[i], f.tipo === 'tronco' ? 0.09 : 0.05, 4))
    }
    lista.forEach(([x, z], i) => {
      const chave = `${Math.round(x / 3)}|${Math.round(z / 3)}`
      if (vistos.has(chave)) return
      vistos.add(chave)
      const viz = lista[Math.min(lista.length - 1, i + 1)] === lista[i] ? lista[i - 1] : lista[Math.min(lista.length - 1, i + 1)]
      postes.push({ x, z, ang: Math.atan2(viz[0] - x, viz[1] - z) })
    })
    const total = acum[acum.length - 1]
    trilhas.push({ regiaoId: f.regiaoId, tronco: f.tipo === 'tronco', pts, acum, total, n: f.tipo === 'tronco' ? Math.max(2, Math.round(total / 170)) : 1, fase: (k * 0.37) % 1 })
  })
  const hastes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.18, ALTURA_POSTE, 6).translate(0, ALTURA_POSTE / 2, 0), mat('#b8b4ab', { rough: 0.9 }), postes.length)
  const cruzetas = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.12, 0.12).translate(0, ALTURA_POSTE - 0.5, 0), mat('#5d636b', { rough: 0.6 }), postes.length)
  postes.forEach((p, i) => {
    tmp.position.set(p.x, 0, p.z)
    tmp.rotation.set(0, p.ang, 0)
    tmp.scale.set(1, 1, 1)
    tmp.updateMatrix()
    hastes.setMatrixAt(i, tmp.matrix)
    cruzetas.setMatrixAt(i, tmp.matrix)
  })
  hastes.castShadow = stage.quality.shadows
  scene.add(hastes, cruzetas)
  scene.add(mergedMesh(cabosTronco, mat('#0f5e7a', { rough: 0.5 }), false), mergedMesh(cabosRua, mat('#1b1f24', { rough: 0.6 }), false))

  const totalPulsos = trilhas.reduce((s, t) => s + t.n, 0)
  const pulsos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), totalPulsos)
  pulsos.frustumCulled = false
  const padrao: PulsoRegiao = { cor: '#53e6ff', velocidade: 30 }
  let pulsoPorRegiao: Record<string, PulsoRegiao> = {}
  function pintarPulsos() {
    let k = 0
    for (const t of trilhas) {
      const c = cor.set((pulsoPorRegiao[t.regiaoId] ?? padrao).cor).multiplyScalar(2.2)
      for (let j = 0; j < t.n; j++) pulsos.setColorAt(k++, c)
    }
    pulsos.instanceColor!.needsUpdate = true
  }
  pintarPulsos()
  scene.add(pulsos)
  const parado = matchMedia('(prefers-reduced-motion: reduce)').matches
  const ponto = new THREE.Vector3()
  function posicionarPulsos(t: number) {
    let k = 0
    for (const tr of trilhas) {
      const vel = (pulsoPorRegiao[tr.regiaoId] ?? padrao).velocidade * (tr.tronco ? 1 : 0.6)
      for (let j = 0; j < tr.n; j++) {
        const d = ((t * vel) / tr.total + tr.fase + j / tr.n) % 1
        const alvo = d * tr.total
        let i = 1
        while (i < tr.acum.length - 1 && tr.acum[i] < alvo) i++
        ponto.lerpVectors(tr.pts[i - 1], tr.pts[i], (alvo - tr.acum[i - 1]) / Math.max(0.001, tr.acum[i] - tr.acum[i - 1]))
        tmp.position.copy(ponto)
        tmp.rotation.set(0, 0, 0)
        tmp.scale.setScalar(tr.tronco ? 1.5 : 1)
        tmp.updateMatrix()
        pulsos.setMatrixAt(k++, tmp.matrix)
      }
    }
    pulsos.instanceMatrix.needsUpdate = true
  }
  posicionarPulsos(0)
  if (!parado) stage.onTick((_dt, t) => posicionarPulsos(t))

  /* ---------- Destaque da seleção e cobertura da torre ---------- */
  const farol = new THREE.Group()
  const feixe = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 3.4, 60, 20, 1, true).translate(0, 30, 0),
    new THREE.MeshBasicMaterial({ color: '#8de9d5', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  )
  const anel = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8de9d5', transparent: true, opacity: 0.9, depthWrite: false }))
  anel.position.y = 0.4
  farol.add(feixe, anel)
  farol.visible = false
  scene.add(farol)
  const cupula = new THREE.Group()
  const RAIO = 150
  cupula.add(
    new THREE.Mesh(new THREE.SphereGeometry(RAIO, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3fb6ff', transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide })),
    new THREE.Mesh(new THREE.RingGeometry(RAIO - 0.8, RAIO, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3fb6ff', transparent: true, opacity: 0.6, depthWrite: false })),
  )
  const onda = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 80).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3fb6ff', transparent: true, depthWrite: false }))
  cupula.add(onda)
  cupula.visible = false
  cupula.position.y = 0.3
  scene.add(cupula)
  stage.onTick((_dt, t) => {
    if (farol.visible) {
      const k = parado ? 0.5 : (t % 1.6) / 1.6
      anel.scale.setScalar(farol.userData.raio * (1 + k * 0.9))
      ;(anel.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k * 0.8)
    }
    if (cupula.visible) {
      const k = parado ? 0.6 : (t % 3.5) / 3.5
      onda.scale.setScalar(Math.max(0.01, k * RAIO))
      ;(onda.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7
    }
  })
  /** Acende o farol num ponto do mapa (ou apaga com null). */
  function destacar(alvo: { x: number; z: number; raio?: number; cor?: string; cobertura?: boolean } | null) {
    farol.visible = !!alvo
    cupula.visible = !!alvo?.cobertura
    if (!alvo) return
    farol.position.set(alvo.x, 0, alvo.z)
    farol.userData.raio = alvo.raio ?? 9
    feixe.scale.set((alvo.raio ?? 9) / 9, 1, (alvo.raio ?? 9) / 9)
    for (const m of [feixe, anel]) (m.material as THREE.MeshBasicMaterial).color.set(alvo.cor ?? '#8de9d5')
    cupula.position.set(alvo.x, 0.3, alvo.z)
  }

  /* ---------- Obras ---------- */
  let canteiros: THREE.Object3D[] = []
  const chaoObra = mat('#bfa57c', { rough: 1 })
  /** Monta os canteiros na data (null = executado hoje). Recria tudo: são poucas peças. */
  function montarObras(data: string | null) {
    for (const o of canteiros) stage.remove(o)
    canteiros = []
    const add = (obj: THREE.Object3D, o: ObraCadastro, dx = 0, dz = 0, y = 0) => {
      const p = obras3d[o.id]
      obj.position.set(p.x + dx, y, p.z + dz)
      stage.add(obj, { tipo: 'obra', id: o.id })
      canteiros.push(obj)
      return obj
    }
    for (const o of obras) {
      const p = progressoNoMapa(o, data)
      const iniciou = Object.values(p).some((v) => v > 0)
      const pos = obras3d[o.id]
      if (o.id === 'OB-03') {
        // Prédio do Centro de Operações: estrutura e fachada sobem com as etapas.
        const andamento = Math.min(1, (p.fundacao * 0.15 + p.estrutura * 0.6 + p.alvenaria * 0.25) / 0.92)
        if (p.acabamento >= 1) add(Buildings.office({ w: 34, d: 24, floors: 4, style: 'glassBlue', seed: 9 }), o, 0, 0, 0.18)
        else add(Buildings.construction({ w: 34, d: 24, floors: 4, progress: Math.max(0.2, andamento), crane: true, seed: 9 }), o, 0, 0, 0.18)
      } else if (o.id === 'OB-01') {
        add(box(34, 0.06, 30, chaoObra), o)
        if (p.estrutura > 0) {
          const torre = ISP.tower({ h: 30 })
          torre.scale.y = Math.max(0.12, p.estrutura)
          add(torre, o)
        }
        if (p.estrutura < 1 && iniciou) add(Buildings.crane({ h: 40, jib: 22 }), o, 9, -7)
      } else if (o.id === 'OB-02') {
        add(box(30, 0.06, 24, chaoObra), o)
        if (p.abrigo > 0) {
          const pop = ISP.pop({ w: 14, d: 9, h: 4.6 })
          pop.scale.y = Math.max(0.15, p.abrigo)
          add(pop, o)
        } else if (p.base > 0) add(box(16, 0.4, 11, MATS.concrete()), o)
      } else if (o.id === 'OB-07') {
        if (p.galpao > 0) {
          const g = Buildings.warehouse({ w: 44, d: 24, h: 9, solar: p.patio >= 1, docks: 3, seed: 3 })
          g.scale.y = Math.max(0.15, p.galpao)
          add(g, o, -14, 14, 0.18)
        } else add(Obra.lot({ w: 46, d: 26, status: 'obra', label: 'ALMOXARIFADO' }), o, -14, 14, 0.18)
      } else if (o.id === 'OB-05') {
        if (p.base > 0) add(box(7, 0.25, 5, MATS.concrete()), o, 0, 0, 0.18)
        if (p.gerador > 0) add(box(4.2, 2.2 * Math.max(0.3, p.gerador), 2.2, mat('#e0a93a', { rough: 0.6 })), o, -0.8, 0, 0.43)
        if (p.baterias > 0) add(box(1.4, 2 * p.baterias, 1.4, MATS.metalDark()), o, 2.4, 0, 0.43)
      } else if (pos.ate) {
        // Obras lineares: vala do anel óptico e fibra aérea na rua.
        const [bx, bz] = pos.ate
        const L = Math.hypot(bx - pos.x, bz - pos.z)
        const feito = Math.max(0, Math.min(1, o.tipo === 'vala' ? p.vala : p.cabo))
        if (o.tipo === 'vala') {
          add(box(L, 0.05, 0.5, mat('#f2d06b', { rough: 0.9 })), o, L / 2, 0)
          if (feito > 0) add(box(L * feito, 0.08, 3.2, mat('#7d6248', { rough: 1 })), o, (L * feito) / 2, 0)
          if (feito > 0 && feito < 1) add(box(5.5, 2.6, 2.6, mat('#e0a93a', { rough: 0.6 })), o, L * feito + 4, 3.5)
        } else if (feito > 0) {
          const a = new THREE.Vector3(0, Y_CABO - 0.5, 0),
            b = new THREE.Vector3(L * feito, Y_CABO - 0.5, 0)
          add(mergedMesh([beamGeometry(a, b, 0.09, 4)], mat('#f08c3c', { emissive: '#f08c3c', glow: 1.2 }), false), o)
          if (feito < 1) add(box(5.2, 2.4, 2.3, mat('#f4f3ef', { rough: 0.5 })), o, L * feito, 3.4, 0.02)
        }
      }
    }
  }
  montarObras(null)

  /* ---------- Camada financeira: colunas por bairro/vila ---------- */
  const colunas = new THREE.Group()
  scene.add(colunas)
  const unidade = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const matColuna = (c: string, opacidade = 0.92) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, transparent: opacidade < 1, opacity: opacidade, emissive: c, emissiveIntensity: 0.18 })
  const MAT = { recebido: matColuna('#3fbf95'), aberto: matColuna('#5f7f99', 0.55), vencido: matColuna('#e06b66'), uso: matColuna('#3fbf95'), fundo: matColuna('#40566a', 0.35) }
  const ALTURA_COLUNA = 70
  /** Colunas empilhadas (frações de 0 a 1) num ponto: usadas pelo financeiro e pelo monitoramento. */
  function definirColunas(lista: { x: number; z: number; lado: number; altura?: number; partes: { fracao: number; cor: string; opacidade?: number }[] }[]) {
    colunas.clear()
    const cache = new Map<string, THREE.Material>()
    for (const c of lista) {
      let y = 0.3
      const H = c.altura ?? ALTURA_COLUNA
      for (const p of c.partes) {
        if (p.fracao <= 0.002) continue
        const chave = p.cor + '|' + (p.opacidade ?? 0.92)
        if (!cache.has(chave)) cache.set(chave, matColuna(p.cor, p.opacidade ?? 0.92))
        const m = new THREE.Mesh(unidade, cache.get(chave))
        m.position.set(c.x, y, c.z)
        m.scale.set(c.lado, H * p.fracao, c.lado)
        colunas.add(m)
        y += H * p.fracao
      }
    }
  }
  void MAT

  /* ---------- Viaturas ---------- */
  const frota: THREE.Group[] = []
  function viatura(k: number) {
    if (frota[k]) return frota[k]
    const g = new THREE.Group()
    g.add(box(4.6, 1.5, 2, mat('#f4f3ef', { rough: 0.45 }), 0, 0.45, 0))
    g.add(box(1.5, 0.75, 1.9, mat('#2c5563', { rough: 0.2, metal: 0.4 }), 1.1, 1.95, 0))
    g.add(box(4.62, 0.3, 2.02, mat('#2fb894', { rough: 0.5, emissive: '#2fb894', glow: 0.8 }), 0, 0.95, 0))
    for (const dx of [-1.4, 1.4]) for (const dz of [-1, 1]) g.add(box(0.7, 0.7, 0.25, mat('#1f2d31'), dx, 0, dz))
    g.traverse((o) => (o.castShadow = true))
    const v = vagaViatura(k)
    g.position.set(v.x, 0.18, v.z)
    scene.add(g)
    frota[k] = g
    return g
  }
  /** Posiciona a viatura k (x, z) virada para a direção de marcha. */
  function moverViatura(k: number, x: number, z: number, ang: number, visivel = true) {
    const g = viatura(k)
    g.visible = visivel
    g.position.set(x, 0.18, z)
    g.rotation.y = ang
  }

  /* ---------- Câmera ---------- */
  stage.frame(extensao, { dist: 0.74, dir: [0.7, 1.0, 1.15] })
  const distGeral = stage.camera.position.distanceTo(stage.controls.target)
  stage.controls.maxDistance = distGeral * 1.5
  stage.controls.minDistance = 35
  const alvoVoo = new THREE.Vector3()
  function voarPara(x: number, z: number, distancia: number, duracao = 1.3) {
    alvoVoo.set(x, 0, z)
    stage.flyTo(alvoVoo.clone(), { distance: distancia, duration: parado ? 0 : duracao })
  }
  const visaoGeral = () => voarPara(0, 0, distGeral)
  /** Coordenadas de tela de um ponto do mundo; `visivel` é false atrás da câmera ou fora da tela. */
  const proj = new THREE.Vector3()
  function projetar(x: number, y: number, z: number) {
    proj.set(x, y, z).project(stage.camera)
    const w = container.clientWidth,
      h = container.clientHeight
    const sx = ((proj.x + 1) / 2) * w,
      sy = ((1 - proj.y) / 2) * h
    return { x: sx, y: sy, visivel: proj.z < 1 && sx > -60 && sy > -40 && sx < w + 60 && sy < h + 40 }
  }
  /** Distância da câmera ao ponto que ela olha: serve de "zoom" para mostrar ou esconder rótulos. */
  const distancia = () => stage.camera.position.distanceTo(stage.controls.target)

  /* ---------- Clique e hover ---------- */
  const traduzir = (hit: Hit | null): Alvo => {
    if (!hit) return null
    const d = hit.data as { tipo: string; id?: string; ids?: string[] }
    if (d.tipo === 'casas' && hit.instanceId !== undefined) return { tipo: 'cliente', id: d.ids![hit.instanceId] }
    if (d.tipo === 'ponto' && pointById.has(d.id!)) return { tipo: 'ponto', id: d.id! }
    if (d.tipo === 'obra') return { tipo: 'obra', id: d.id! }
    if (d.tipo === 'sede') return { tipo: 'sede' }
    return null
  }

  return {
    stage,
    layout,
    distGeral,
    aoEscolher: (fn: (alvo: Alvo) => void) => void stage.on('pick', (hit) => fn(traduzir(hit))),
    aoPassar: (fn: (alvo: Alvo) => void) => void stage.on('hover', (hit) => fn(traduzir(hit))),
    pintarCasas,
    pulsos: (porRegiao: Record<string, PulsoRegiao>) => {
      pulsoPorRegiao = porRegiao
      pintarPulsos()
    },
    destacar,
    montarObras,
    definirColunas,
    moverViatura,
    voarPara,
    visaoGeral,
    projetar,
    distancia,
    horario: (h: Horario) => stage.setTime(h, { duration: parado ? 0 : 1.4 }),
    posicaoDaCasa: (clientId: string) => casas.get(clientId),
    areas,
    dispose: () => stage.dispose(),
  }
}
export type Cidade = ReturnType<typeof criarCidade>
export type { Stage }
