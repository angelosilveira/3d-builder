import { districts, cityStreets, type UrbanArea } from './city'
import type { DesenhoObras } from './obrasModel'
import {
  accessPoints,
  clientById,
  headquarters,
  islands,
  clientsByPoint,
  signalColor,
  type AccessPoint,
  type Client,
  type Incident,
  type Island,
} from './data'

export type Point = [number, number, number]
export type Pixel = [number, number]
export interface View {
  x: number
  z: number
  zoom: number
  angle: number
}
export const overview: View = { x: 0, z: 0, zoom: 1, angle: -0.16 }

export function projector(width: number, height: number, view: View, panelOpen = false) {
  const mobile = width <= 730
  const inset = panelOpen && !mobile ? Math.min(355, width * 0.34) : 0
  const top = mobile ? 110 : 115
  const bottom = panelOpen && mobile ? height * 0.44 : 60
  const availableHeight = Math.max(100, height - top - bottom)
  const scale = Math.max(1, Math.min((width - inset) / 142, availableHeight / 73)) * view.zoom
  const cx = (width - inset) / 2,
    cy = top + availableHeight * 0.49
  const c = Math.cos(view.angle),
    s = Math.sin(view.angle)
  const depth = (x: number, z: number) => x * s + z * c
  const project = (x: number, y: number, z: number): Pixel => [
    cx + ((x - view.x) * c - (z - view.z) * s) * scale,
    cy + (depth(x - view.x, z - view.z) * 0.59 - (y - ground) * 0.81) * scale,
  ]
  function groundAt(px: number, py: number): Pixel {
    const across = (px - cx) / scale,
      along = (py - cy) / scale / 0.59
    return [view.x + across * c + along * s, view.z - across * s + along * c]
  }
  return { project, depth, scale, groundAt, width, height, angle: view.angle }
}
export type Projection = ReturnType<typeof projector>
export const zoomLimit = (value: number) => Math.max(0.65, Math.min(32, value))

export const ground = 0.8
export function islandSize(island: Island) {
  return island === headquarters ? { rx: 38, rz: 26 } : { rx: 13.7, rz: 11.65 }
}
export function trafficRoad(island: Island) {
  return {
    x: island.x,
    z: island.z + (island === headquarters ? 0.25 : 8.85),
    halfLength: island === headquarters ? 26.8 : 6.8,
    radius: island === headquarters ? 0.5 : 0.46,
  }
}
export const pointTop = (p: AccessPoint) => (p.technology === 'radio' ? 4.08 : 1.91)
export function pickPoint(cam: Projection, x: number, y: number) {
  const ordered = [...accessPoints].sort((a, b) => cam.depth(b.x, b.z) - cam.depth(a.x, a.z))
  return ordered.find((p) => {
    const [px, py] = cam.project(p.x, pointTop(p), p.z)
    const [, foot] = cam.project(p.x, ground, p.z)
    return (
      Math.abs(x - px) < Math.max(5, cam.scale * (p.technology === 'radio' ? 0.3 : 0.36)) &&
      y >= py - 4 &&
      y <= foot + 2
    )
  })
}
const coast = [
  [-0.94, -0.43],
  [-0.68, -0.83],
  [-0.18, -1],
  [0.32, -0.94],
  [0.76, -0.73],
  [0.97, -0.31],
  [1, 0.21],
  [0.76, 0.71],
  [0.28, 0.96],
  [-0.23, 1],
  [-0.71, 0.77],
  [-1, 0.31],
]

export interface Face {
  points: Point[]
  color: string
  details?: Face[]
}
export function solid(faces: Face[], bottom: Point[], top: Point[], colors: string[], lid: string) {
  for (let i = 0; i < bottom.length; i++) {
    const n = (i + 1) % bottom.length
    faces.push({ points: [bottom[i], bottom[n], top[n], top[i]], color: colors[i % colors.length] })
  }
  faces.push({ points: top, color: lid })
}
export function box(faces: Face[], x: number, y: number, z: number, w: number, h: number, d: number, colors: string[]) {
  const base: Point[] = [
    [x - w / 2, y, z - d / 2],
    [x + w / 2, y, z - d / 2],
    [x + w / 2, y, z + d / 2],
    [x - w / 2, y, z + d / 2],
  ]
  solid(
    faces,
    base,
    base.map(([px, py, pz]) => [px, py + h, pz]),
    colors,
    colors[4] ?? colors[0],
  )
}
const bark = ['#685749', '#695a48', '#866b4d', '#927552']
export const walls = ['#a1b3a7', '#a3afa8', '#f0dec1', '#d2c3ab', '#fff1cf']
export const glass = ['#25475a', '#315366', '#527882', '#315565', '#a1cfd0']
export const metal = ['#596e79', '#536777', '#c6d1c9', '#8599a0', '#d6e0d5']

export function beam(faces: Face[], start: Point, end: Point, radius: number, colors: string[]) {
  const corners = (p: Point): Point[] =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([dx, dz]) => [p[0] + dx * radius, p[1], p[2] + dz * radius])
  solid(faces, corners(start), corners(end), colors, colors[0])
}

function house(faces: Face[], index: number) {
  const x = 0,
    z = 0,
    urban = index === 3
  const h = urban ? 2.95 : index % 3 === 0 ? 1.6 : 1.16
  box(faces, x, ground, z, 1.95, h, 1.43, walls)
  const y = ground + h,
    w = 1.14,
    d = 0.87
  // Flush windows sit on the facade and follow its draw order.
  const facade = faces[2]
  const details: Face[] = []
  function pane(dx: number, low: number, width: number, height: number, color: string) {
    const left = x + dx,
      bottom = ground + low,
      front = z + 0.72
    details.push({
      points: [
        [left, bottom, front],
        [left + width, bottom, front],
        [left + width, bottom + height, front],
        [left, bottom + height, front],
      ],
      color,
    })
  }
  pane(-0.63, 0, 0.37, 0.82, '#53645f')
  pane(0.04, 0.43, 0.3, 0.46, '#497183')
  pane(0.4, 0.43, 0.3, 0.46, '#668e99')
  if (urban) {
    for (const dx of [-0.68, -0.17, 0.34]) pane(dx, 1.78, 0.37, 0.61, '#648793')
    box(faces, x, y, z, 2.16, 0.22, 1.63, metal)
    box(faces, x - 0.4, y + 0.2, z, 0.66, 0.45, 0.72, metal)
  } else {
    const colors = [
      ['#bc6a53', '#df8e67'],
      ['#687e90', '#94a6ad'],
      ['#8f745c', '#c59770'],
    ][index % 3]
    const ridge = y + 0.79
    faces.push(
      {
        points: [
          [x - w, y, z - d],
          [x + w, y, z - d],
          [x + w, ridge, z],
          [x - w, ridge, z],
        ],
        color: colors[0],
      },
      {
        points: [
          [x - w, ridge, z],
          [x + w, ridge, z],
          [x + w, y, z + d],
          [x - w, y, z + d],
        ],
        color: colors[1],
      },
    )
    for (const side of [-1, 1]) {
      const end = x + w * side
      faces.push({
        points: [
          [end, y, z - d],
          [end, ridge, z],
          [end, y, z + d],
        ],
        color: colors[0],
      })
    }
    box(faces, x + 0.6, y + 0.14, z - 0.13, 0.27, 0.7, 0.28, walls)
  }
  facade.details = details
}

const homeScale = 0.22
export const markerHeight = 1.64

function tree(faces: Face[], x: number, z: number, size: number) {
  box(faces, x, ground, z, 0.22, size, 0.24, bark)
  const greens = ['#366c59', '#47785c', '#5d9065', '#76a56e', '#477c5b', '#638e59']
  for (let tier = 0; tier < 2; tier++) {
    const y = ground + size * (0.38 + tier * 0.57),
      radius = size * (0.83 - tier * 0.18)
    const ring: Point[] = Array.from({ length: 6 }, (_, i) => [
      x + Math.cos((i * Math.PI) / 3) * radius,
      y,
      z + Math.sin((i * Math.PI) / 3) * radius,
    ])
    ring.forEach((p, i) =>
      faces.push({ points: [p, ring[(i + 1) % 6], [x, y + size * 1.45, z]], color: greens[(i + tier) % 6] }),
    )
  }
}

function cityBuilding(faces: Face[], x: number, z: number, floors: number, tone: string, shop: boolean) {
  const width = shop ? 1.85 : 1.28,
    depth = shop ? 1.24 : 1.12,
    height = 0.36 + floors * 0.52
  const facade = [tone, '#abac9c', tone, '#aca291', '#ebdfbd']
  box(faces, x, ground, z, width, height, depth, facade)
  box(faces, x, ground + height, z, width + 0.12, 0.13, depth + 0.13, metal)
  for (let level = 0; level < floors; level++)
    for (const side of [-1, 1]) {
      box(faces, x + side * width * 0.23, ground + 0.28 + level * 0.52, z + depth * 0.5, 0.32, 0.29, 0.045, glass)
    }
  if (shop)
    box(faces, x, ground + 0.73, z + depth * 0.5, width + 0.1, 0.12, 0.46, [
      '#b75b47',
      '#b75b47',
      '#f09070',
      '#c67758',
      '#e99a69',
    ])
  else box(faces, x - 0.23, ground + height + 0.13, z, 0.47, 0.26, 0.48, metal)
}

interface Object3D {
  x: number
  z: number
  faces: Face[]
  client?: Client
  variant?: number
}
function islandModel(island: Island) {
  const { x, z } = island,
    hq = island === headquarters
  const { rx, rz } = islandSize(island)
  const ring = (size: number, y: number): Point[] =>
    coast.map(([dx, dz]) => [x + dx * rx * size, y, z + dz * rz * size])
  const base: Face[] = []
  solid(base, ring(0.75, -2.05), ring(0.97, -0.74), ['#536878', '#687c81', '#465e6a', '#77878b', '#566e79'], '#86928a')
  solid(base, ring(0.97, -0.74), ring(1, 0.36), ['#938e7b', '#aaa58a', '#817e71', '#b5ab8b', '#92907c'], '#a6af87')
  solid(base, ring(1, 0.36), ring(0.98, ground), ['#779579', '#839b77', '#96ac82'], '#a6bd87')
  const road: Face[] = []
  const roadWidth = hq ? 14.1 : 17.8
  box(road, x, ground + 0.01, z, roadWidth, 0.045, 1.12, ['#80918b', '#80918b', '#80918b', '#80918b', '#8c9c93'])
  for (let k = -roadWidth / 2 + 0.8; k < roadWidth / 2 - 0.4; k += 1.55)
    box(road, x + k, ground + 0.06, z, 0.7, 0.008, 0.08, ['#d6d7b2'])
  const objects: Object3D[] = []
  const add = (ox: number, oz: number, draw: (f: Face[]) => void) => {
    const faces: Face[] = []
    draw(faces)
    objects.push({ x: ox, z: oz, faces })
  }
  const avenue = trafficRoad(island)
  box(
    road,
    avenue.x,
    ground + 0.06,
    avenue.z,
    2 * (avenue.halfLength + avenue.radius + 0.3),
    0.02,
    avenue.radius * 2 + 0.54,
    ['#76837e'],
  )
  for (let k = -avenue.halfLength; k < avenue.halfLength; k += 1.4)
    box(road, avenue.x + k, ground + 0.085, avenue.z, 0.62, 0.008, 0.055, ['#d5cfaf'])
  if(hq){
    const soils=['#b6c99c','#aac4a2','#c2cba1','#aebf98','#b3c8a3','#bfcaa1']
    districts.forEach((d,i)=>{
      box(road,d.x,ground+.005,d.z,15.55,.012,14.65,[soils[i]])
      box(road,d.x-7.6,ground+.038,d.z,0.43,.02,15,['#919e94'])
      box(road,d.x+7.6,ground+.038,d.z,0.43,.02,15,['#919e94'])
    })
    for(const street of cityStreets)box(road,street.x,ground+.042,street.z,15.2,.02,.39,['#899992'])
    // City blocks, storefronts and a planted square around the central avenue.
    for (const [dx, dz, levels] of [
      [-0.7, -3.6, 5],
      [0.95, -4.85, 4],
      [-0.85, -5.3, 3],
      [-2.35, -4.85, 2],
      [5.25, -2.45, 3],
      [-6.15, 2.25, 2],
      [-5.1, 4.18, 2],
    ]) {
      add(dx, dz, (f) => cityBuilding(f, dx, dz, levels, levels % 2 ? '#eac9a4' : '#a3c6bf', false))
    }
    for (const dx of [-2.4, -0.3, 1.72]) add(dx, -1.24, (f) => cityBuilding(f, dx, -1.24, 1, '#efd2a5', true))
    box(road, -0.7, ground + 0.03, 3.45, 3.65, 0.09, 2.42, ['#b8b59b'])
    add(-0.7, 3.45, (f) => {
      box(f, -0.7, ground + 0.12, 3.45, 1.16, 0.22, 0.95, metal)
      box(f, -0.7, ground + 0.35, 3.45, 1.01, 0.06, 0.79, ['#64b9b1'])
      box(f, -0.7, ground + 0.42, 3.45, 0.26, 0.58, 0.25, walls)
    })
    box(road, -2.95, ground + 0.04, 0, 0.58, 0.03, 10.85, ['#82918b'])
    box(road, 2.02, ground + 0.04, 0, 0.58, 0.03, 10.25, ['#82918b'])
  }
  const sites = accessPoints.filter((site) => site.regionId === island.id)
  for (const site of sites) {
    if (site.technology === 'radio')
      add(site.x, site.z, (faces) => {
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) {
            const foot: Point = [site.x + sx * 0.24, ground, site.z + sz * 0.24]
            const tip: Point = [site.x + sx * 0.06, ground + 3.1, site.z + sz * 0.06]
            beam(faces, foot, tip, 0.035, metal)
            beam(faces, foot, [site.x - sx * 0.12, ground + 1.6, site.z + sz * 0.12], 0.025, metal)
          }
        for (const side of [-1, 1]) {
          beam(
            faces,
            [site.x + side * 0.22, ground + 0.57, site.z + 0.22],
            [site.x - side * 0.14, ground + 2.1, site.z + 0.14],
            0.035,
            metal,
          )
        }
        box(faces, site.x, ground + 3.03, site.z, 0.07, 0.27, 0.07, metal)
        // Three sector panels surround a shared headframe. A separate dish carries the backhaul.
        box(faces, site.x, ground + 2.79, site.z, 0.67, 0.085, 0.5, metal)
        for (let panel = 0; panel < 3; panel++) {
          const angle = (panel * Math.PI * 2) / 3
          const sx = site.x + Math.cos(angle) * 0.3,
            sz = site.z + Math.sin(angle) * 0.3
          box(faces, sx, ground + 2.63, sz, 0.14, 0.53, 0.15, ['#8596a1', '#9eaab2', '#f4f0dd', '#cfcec0', '#faf9e7'])
        }
        const dish: Point[] = Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6
          return [
            site.x + 0.34 + Math.cos(a) * 0.19,
            ground + 2.08 + Math.sin(a) * 0.19,
            site.z + 0.14 + Math.cos(a) * 0.08,
          ]
        })
        faces.push({ points: dish, color: '#d5e2db' })
        beam(
          faces,
          [site.x + 0.34, ground + 2.03, site.z + 0.15],
          [site.x + 0.42, ground + 2.13, site.z + 0.3],
          0.025,
          metal,
        )
        box(faces, site.x + 0.37, ground, site.z - 0.14, 0.28, 0.51, 0.34, metal)
      })
    else
      add(site.x, site.z, (faces) => {
        box(faces, site.x, ground, site.z, 0.68, 0.85, 0.55, metal)
        box(faces, site.x, ground + 0.86, site.z, 0.75, 0.1, 0.61, ['#4b8f9d', '#72aeb8', '#98d8d5'])
      })
    const block = clientsByPoint.get(site.id)!
    block.forEach((client, i) =>
      objects.push({
        x: client.x,
        z: client.z,
        faces: [],
        client,
        variant: hq && i % 5 === 0 ? 3 : (i + sites.indexOf(site)) % 3,
      }),
    )
    const asphalt = ['#8b9990']
    box(road, site.x, ground + 0.035, site.z, hq ? 0.96 : 8.35, 0.015, 0.36, asphalt)
    box(road, site.x, ground + 0.035, site.z, 0.48, 0.015, hq ? 0.96 : 7.9, asphalt)
  }
  const trees = hq
    ? [
        [-1.95, 3.45, 0.84],
        [-6.95, -1.85, 0.79],
        [0.56, 3.45, 0.76],
      ]
    : [
        [-7.9, -1.3, 0.85],
        [-7.8, 1.45, 0.78],
        [-4.7, -4.6, 0.92],
        [7.8, -1.7, 1.03],
        [7.5, 1.45, 0.88],
        [1.8, -5.15, 0.9],
        [-1.9, 5.15, 0.74],
      ]
  const shrubs = (ox: number, oz: number, height: number, colors: string[]) =>
    add(ox, oz, (faces) => {
      const ring = (radius: number, y: number): Point[] =>
        Array.from({ length: 7 }, (_, i) => [
          ox + Math.cos((i * 2 * Math.PI) / 7) * radius,
          y,
          oz + Math.sin((i * 2 * Math.PI) / 7) * radius,
        ])
      const middle = ring(height * 0.63, ground + height * 0.48)
      solid(faces, ring(height * 0.48, ground), middle, colors, colors[0])
      solid(faces, middle, ring(height * 0.23, ground + height), colors, colors[2])
    })
  if (island.id === 'jardim') {
    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++)
        shrubs(x - 3 + i * 1.1, z + side * 8.85, 0.62, ['#7c996c', '#b98d96', '#e7b2ac', '#b1a47c'])
  }
  if (island.id === 'alto') {
    for (const [dx, dz, h] of [
      [-1.8, -5.1, 1.85],
      [-0.15, -5.35, 1.55],
      [5.4, 4.5, 0.9],
    ])
      shrubs(x + dx * 1.45, z + dz * 1.7, h, ['#768991', '#94a29c', '#cad1bb', '#879891'])
  }
  if (island.id === 'vale') {
    for (const [dx, dz, h] of [
      [-4.8, 4.55, 1.15],
      [3, -4.95, 1.3],
      [-2, -4.95, 1.25],
      [2.2, 4.95, 1.15],
    ])
      shrubs(x + dx, z + dz, h, ['#5f8455', '#8fab62', '#b1bd72', '#82a261'])
  }
  trees.forEach(([dx, dz, size]) => {
    const tx = x + dx * (hq ? 1 : 1.48),
      tz = z + dz * (hq ? 1 : 1.54)
    add(tx, tz, (f) => tree(f, tx, tz, size))
  })
  return { island, base, road, objects }
}
const models = islands.map(islandModel)

export function pickIsland(camera: Projection, sx: number, sy: number) {
  const nearest = [...islands].sort((a, b) => camera.depth(b.x, b.z) - camera.depth(a.x, a.z))
  for (const island of nearest) {
    const { rx, rz } = islandSize(island)
    const outline = coast.map(([dx, dz]) => camera.project(island.x + dx * rx, ground, island.z + dz * rz))
    let inside = false
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [ax, ay] = outline[i],
        [bx, by] = outline[j]
      if (ay > sy !== by > sy && sx < ((bx - ax) * (sy - ay)) / (by - ay) + ax) inside = !inside
    }
    if (inside) return island
  }
  return null
}

export function path(ctx: CanvasRenderingContext2D, points: Pixel[], color: string) {
  ctx.beginPath()
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  // Hairline joins keep adjacent facets watertight at fractional zoom.
  ctx.strokeStyle = color
  ctx.lineWidth = 0.45
  ctx.stroke()
}
export function paintFaces(ctx: CanvasRenderingContext2D, faces: Face[], camera: Projection) {
  const sorted = faces.map((face) => ({
    face,
    depth: face.points.reduce((sum, [x, y, z]) => sum + camera.depth(x, z) * 0.81 + y * 0.59, 0) / face.points.length,
  }))
  sorted.sort((a, b) => a.depth - b.depth)
  sorted.forEach(({ face }) => {
    path(
      ctx,
      face.points.map(([x, y, z]) => camera.project(x, y, z)),
      face.color,
    )
    if (face.details && camera.depth(0, 1) > 0)
      for (const detail of face.details)
        path(
          ctx,
          detail.points.map(([x, y, z]) => camera.project(x, y, z)),
          detail.color,
        )
  })
}

export function connectionPoint(island: Island, t: number): Point {
  return [island.x * t, -0.2 + Math.sin(t * Math.PI) * 2.6, island.z * t]
}
// Rasterize four house models once per orientation; panning and zooming reuse their geometry.
const sprites = new Map<number, HTMLCanvasElement[]>()
function homeSprites(camera: Projection) {
  const direction = ((Math.round(camera.angle / (Math.PI / 18)) % 36) + 36) % 36
  const existing = sprites.get(direction)
  if (existing) return existing
  const angle = (direction * Math.PI) / 18
  const result = Array.from({ length: 4 }, (_, v) => {
    const sprite = document.createElement('canvas')
    sprite.width = 152
    sprite.height = 216
    const ctx = sprite.getContext('2d')!
    const depth = (x: number, z: number) => x * Math.sin(angle) + z * Math.cos(angle)
    const project = (x: number, y: number, z: number): Pixel => [
      76 + (x * Math.cos(angle) - z * Math.sin(angle)) * 43,
      174 + (depth(x, z) * 0.59 - (y - ground) * 0.81) * 43,
    ]
    const faces: Face[] = []
    // A door path and a low stoop make the frontage readable from above.
    const walk: Face[] = []
    box(walk, -0.46, ground - 0.025, 1.03, 0.45, 0.045, 0.67, ['#c8bd9e'])
    box(walk, -0.46, ground + 0.04, 0.84, 0.52, 0.1, 0.16, ['#acac98', '#c1c3ac', '#d8d6b9'])
    paintFaces(ctx, walk, { ...camera, project, depth })
    house(faces, v)
    paintFaces(ctx, faces, { ...camera, project, depth })
    return sprite
  })
  if (sprites.size >= 6) sprites.delete(sprites.keys().next().value!)
  sprites.set(direction, result)
  return result
}
export interface HomeHit {
  client: Client
  x: number
  y: number
  radius: number
}
export function paintLandscape(
  ctx: CanvasRenderingContext2D,
  camera: Projection,
  incidents: Map<string, Incident>,
  site: AccessPoint | null,
  selected: Client | null,
  area:UrbanArea|null=null,
  members:ReadonlySet<string>|null=null,
  obrasCena:DesenhoObras|null=null,
): HomeHit[] {
  const homes = homeSprites(camera),
    hits: HomeHit[] = []

  const { project, scale, depth } = camera
  const sorted = [...models].sort((a, b) => depth(a.island.x, a.island.z) - depth(b.island.x, b.island.z))
  for (const { island } of sorted) {
    const [cx, cy] = project(island.x, -2.85, island.z)
    const r = islandSize(island).rx * scale
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(1, 0.46)
    const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.3)
    shadow.addColorStop(0, 'rgba(3,12,19,.9)')
    shadow.addColorStop(1, 'rgba(5,20,29,0)')
    ctx.fillStyle = shadow
    ctx.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6)
    for (const ring of [1.12, 1.3]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, r * ring, r * ring * 0.94, 0, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(120,196,189,.12)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.restore()
  }
  for (const { island } of sorted.filter((m) => m.island !== headquarters)) {
    ctx.beginPath()
    for (let i = 0; i <= 32; i++) {
      const [x, y] = project(...connectionPoint(island, i / 32))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(82,226,193,.23)'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.strokeStyle = '#66cbbc'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }
  for (const { island, base, road, objects } of sorted) {
    const [ix, iy] = project(island.x, ground, island.z)
    const margin=(islandSize(island).rx+3)*scale
    if (ix < -margin || ix > camera.width + margin || iy < -margin || iy > camera.height + margin)
      continue
    // Draw each terrace in order so the upper soil completely covers the rock.
    const count = coast.length + 1
    for (let i = 0; i < base.length; i += count) paintFaces(ctx, base.slice(i, i + count), camera)
    // Paint city blocks in layers so long road surfaces never cover a higher street marking.
    if(island===headquarters){
      for(let f=0;f<road.length;f+=5)paintFaces(ctx,road.slice(f,f+5),camera)
    } else paintFaces(ctx,road,camera)
    if(area&&island===headquarters){
      const halfZ=area.kind==='district'?7.35:.31
      const outline=[[-7.6,-halfZ],[7.6,-halfZ],[7.6,halfZ],[-7.6,halfZ]].map(([dx,dz])=>project(area.x+dx,.91,area.z+dz))
      ctx.beginPath();outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath()
      ctx.fillStyle=area.kind==='street'?'#8de9d580':'#8de9d518';ctx.fill()
      ctx.strokeStyle='#3a877b';ctx.lineWidth=1.6;ctx.stroke()
    }
    // Canteiros de obra da sede: chão (lotes, valas) por baixo e as estruturas
    // entram na mesma ordenação de profundidade das casas e prédios.
    const extras = island === headquarters && obrasCena ? obrasCena.objetos : []
    if (extras.length) for (const camada of obrasCena!.chao) paintFaces(ctx, camada, camera)
    if (island === headquarters && obrasCena?.destaque) obrasCena.destaque(ctx, camera)
    const ordered: Object3D[] = [...objects, ...extras].sort((a, b) => depth(a.x, a.z) - depth(b.x, b.z))
    // Access links are confined to the selected station. The backbone stays visible in the overview.
    for (const point of accessPoints.filter((p) => p.regionId === island.id)) {
      const origin = project(island.x, 0.93, island.z),
        end = project(point.x, 0.93, point.z)
      ctx.beginPath()
      ctx.moveTo(...origin)
      ctx.lineTo(...end)
      ctx.strokeStyle = '#40867e'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    if (site?.regionId === island.id) {
      const source = project(site.x, 1.48, site.z)
      ctx.beginPath()
      for (const c of selected ? [selected] : clientsByPoint.get(site.id)!) {
        if(members&&!members.has(c.id))continue
        ctx.moveTo(...source)
        ctx.lineTo(...project(c.x, ground, c.z))
      }
      ctx.strokeStyle = members?'#c5634b':selected ? '#17796d' : 'rgba(32,112,101,.42)'
      ctx.lineWidth = selected ? 2 : 1
      ctx.stroke()
    }
    for (const obj of ordered) {
      const [px, py] = project(obj.x, ground, obj.z)
      if (obj.client) {
        const ratio = (scale * homeScale) / 43
        if (px < -85 * ratio || px > camera.width + 85 * ratio || py < -48 * ratio || py > camera.height + 180 * ratio)
          continue
        const outsideArea=area&&obj.client.districtId!==area.districtId || area?.kind==='street'&&obj.client.streetId!==area.id
        const chosen = obj.client === selected
        if (chosen) {
          ctx.save()
          ctx.shadowColor = '#a6ffff'
          ctx.shadowBlur = 9
        } else if(outsideArea||members&&!members.has(obj.client.id))ctx.globalAlpha=.38
        else if (selected && island.id === selected.regionId) ctx.globalAlpha = 0.75
        ctx.drawImage(homes[obj.variant!], px - 76 * ratio, py - 174 * ratio, 152 * ratio, 216 * ratio)
        if (chosen) ctx.restore()
        else ctx.globalAlpha = 1
        const center = project(obj.x, ground + 0.29, obj.z)
        hits.push({ client: obj.client, x: center[0], y: center[1], radius: Math.max(4, scale * 0.23) })
      } else {
        paintFaces(ctx, obj.faces, camera)
      }
    }
    for (const item of incidents.values()) {
      const client = clientById.get(item.clientId)
      if (!client || client.regionId !== island.id) continue
      const [x, y] = project(client.x, markerHeight, client.z)
      ctx.beginPath()
      ctx.arc(x, y, 3.7, 0, 2 * Math.PI)
      ctx.fillStyle = signalColor[item.kind]
      ctx.fill()
      ctx.strokeStyle = '#223742'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
  return hits
}

const carColors = [
  ['#c85e44', '#ff9560'],
  ['#397195', '#80cce1'],
  ['#c6973a', '#ffdb78'],
  ['#51816c', '#a3d6ad'],
]
export function trafficPose(island: Island, travel: number) {
  const { x, z, halfLength: h, radius: r } = trafficRoad(island)
  const straight = 2 * h,
    turn = Math.PI * r,
    perimeter = 2 * (straight + turn)
  let d = ((travel % perimeter) + perimeter) % perimeter
  if (d < straight) return { x: x - h + d, z: z - r, angle: 0 }
  d -= straight
  if (d < turn) {
    const a = d / r
    return { x: x + h + r * Math.sin(a), z: z - r * Math.cos(a), angle: a }
  }
  d -= turn
  if (d < straight) return { x: x + h - d, z: z + r, angle: Math.PI }
  const a = (d - straight) / r
  return { x: x - h - r * Math.sin(a), z: z + r * Math.cos(a), angle: Math.PI + a }
}

export function paintTraffic(ctx: CanvasRenderingContext2D, camera: Projection, time: number) {
  for (const [index, island] of islands.entries()) {
    const count = island === headquarters ? 4 : 2
    for (let i = 0; i < count; i++) {
      const pose = trafficPose(
        island,
        time * (0.0012 + index * 0.00004) + i * (island === headquarters ? 7.35 : 15.1) + index * 3.4,
      )
      const [x, y] = camera.project(pose.x, ground + 0.1, pose.z)
      if (x < -camera.scale || x > camera.width + camera.scale || y < -camera.scale || y > camera.height + camera.scale)
        continue
      const cos = Math.cos(pose.angle),
        sin = Math.sin(pose.angle)
      function point(dx: number, h: number, dz: number): Pixel {
        return camera.project(pose.x + dx * cos - dz * sin, ground + 0.1 + h, pose.z + dx * sin + dz * cos)
      }
      const [dark, light] = carColors[(i + index) % carColors.length]
      const corners = (len: number, w: number, h: number) => [
        point(-len, h, -w),
        point(len, h, -w),
        point(len, h, w),
        point(-len, h, w),
      ]
      const base = corners(0.49, 0.245, 0.04),
        hood = corners(0.49, 0.245, 0.22),
        roof = corners(0.255, 0.188, 0.37)
      path(ctx, base, '#39474a')
      const visibleX = camera.depth(cos, sin) > 0 ? 1 : 3,
        visibleZ = camera.depth(-sin, cos) > 0 ? 2 : 0
      for (const side of [visibleX, visibleZ]) {
        const n = (side + 1) % 4
        path(ctx, [base[side], base[n], hood[n], hood[side]], dark)
      }
      const visibleSide = camera.depth(-sin, cos) > 0 ? 1 : -1
      for (const axle of [-0.31, 0.31]) {
        const [wx, wy] = point(axle, 0.095, visibleSide * 0.242)
        ctx.fillStyle = '#26373b'
        ctx.beginPath()
        ctx.ellipse(wx, wy, Math.max(0.8, camera.scale * 0.084), Math.max(0.8, camera.scale * 0.101), 0, 0, Math.PI * 2)
        ctx.fill()
      }
      path(ctx, hood, light)
      const cabin = corners(0.34, 0.215, 0.235)
      for (const side of [visibleX, visibleZ]) {
        const n = (side + 1) % 4
        path(ctx, [cabin[side], cabin[n], roof[n], roof[side]], '#355d6b')
      }
      path(ctx, roof, light)
      for (const side of [-1, 1]) {
        const [lx, ly] = point(0.46, 0.23, side * 0.15)
        ctx.fillStyle = '#fff6c1'
        ctx.beginPath()
        ctx.arc(lx, ly, Math.max(0.65, camera.scale * 0.037), 0, 2 * Math.PI)
        ctx.fill()
      }
    }
  }
}
