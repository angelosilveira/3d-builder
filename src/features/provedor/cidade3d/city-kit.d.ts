/* Tipos mínimos do kit (JavaScript) usados pela cidade do provedor. */
import type * as THREE_NS from 'three'
import type { MapControls } from 'three/addons/controls/MapControls.js'

export const THREE: typeof THREE_NS
export interface Quality {
  name: 'alta' | 'media' | 'baixa'
  dpr: number
  shadows: boolean
  bloom: boolean
  trees: number
  cars: number
  surroundings: number
}
export interface Hit<T = unknown> {
  data: T
  object: THREE_NS.Object3D
  point: THREE_NS.Vector3
  instanceId?: number
}
export type Horario = 'dia' | 'entardecer' | 'noite'
export interface Stage {
  THREE: typeof THREE_NS
  scene: THREE_NS.Scene
  camera: THREE_NS.PerspectiveCamera
  controls: MapControls
  renderer: THREE_NS.WebGLRenderer
  quality: Quality
  readonly time: Horario
  readonly elapsed: number
  readonly frames: number
  add<T extends THREE_NS.Object3D>(obj: T, data?: unknown): T
  remove(obj: THREE_NS.Object3D): void
  pickable<T extends THREE_NS.Object3D>(obj: T, data: unknown): T
  on(evento: 'pick' | 'hover', fn: (hit: Hit | null) => void): Stage
  onTick(fn: (dt: number, t: number) => void): () => void
  tween(dur: number, fn: (k: number) => void, opts?: { ease?: (k: number) => number; delay?: number; done?: () => void }): unknown
  setTime(nome: Horario, opts?: { duration?: number }): void
  frame(area: { width: number; depth: number; x?: number; z?: number }, opts?: { dist?: number; dir?: [number, number, number] }): void
  flyTo(ponto: THREE_NS.Vector3, opts?: { distance?: number; duration?: number; done?: () => void }): unknown
  animateBuild(obj: THREE_NS.Object3D, opts?: { duration?: number; delay?: number }): void
  bake(roots: THREE_NS.Object3D[]): unknown
  stats(): { drawCalls: number; triangles: number; quality: string }
  dispose(): void
}
export function createStage(container: HTMLElement, opts?: { quality?: string; time?: Horario; fov?: number; preserveDrawingBuffer?: boolean }): Stage
export function detectQuality(): 'alta' | 'media' | 'baixa'

export interface Via {
  center: number
  width: number
  index: number
}
export interface Quadra {
  x: number
  z: number
  w: number
  d: number
  i: number
  j: number
  park?: boolean
}
export interface Layout {
  width: number
  depth: number
  road: number
  sidewalk: number
  roadsV: Via[]
  roadsH: Via[]
  blocks: Quadra[]
}
export interface Lote {
  x: number
  z: number
  w: number
  d: number
  rot: number
}
export function gridLayout(o: { cols?: number; rows?: number; block?: number; road?: number; sidewalk?: number; blocksX?: number[]; blocksZ?: number[] }): Layout
export function splitBlock(block: Quadra, o?: { n?: number; sidewalk?: number }): Lote[]
export function placeOnLot<T extends THREE_NS.Object3D>(obj: T, lot: Lote, setback?: number): T
export function buildGround(stage: Stage, layout: Layout, o?: { groundColor?: string; parks?: [number, number][] }): THREE_NS.Group

type Predio = (o?: Record<string, unknown>) => THREE_NS.Group
export const Buildings: Record<'tower' | 'roundTower' | 'office' | 'apartment' | 'house' | 'shop' | 'warehouse' | 'factory' | 'crane' | 'construction', Predio>

export interface Ponto {
  x: number
  z: number
  s?: number
}
export function streetTreePoints(layout: Layout, o?: { spacing?: number; seed?: number; inset?: number }): Ponto[]
export function scatterPoints(area: { x?: number; z?: number; w?: number; d?: number }, n: number, seed?: number): Ponto[]
export function addTrees(stage: Stage, pontos: Ponto[], o?: { seed?: number; y?: number; scale?: number }): unknown
export function lampPoints(layout: Layout, o?: { spacing?: number; inset?: number }): Ponto[]
export function addStreetLamps(stage: Stage, pontos: Ponto[], o?: { height?: number; color?: string; y?: number }): unknown
export function addTraffic(stage: Stage, layout: Layout, o?: { density?: number; seed?: number; cycle?: number }): unknown
export function addSurroundings(stage: Stage, o?: { exclude?: { w: number; d: number }; radius?: number; cell?: number; seed?: number }): unknown

export interface FacadeSpec {
  cellW: number
  floorH: number
  cols: number
  rows: number
}
export const FACADES: Record<string, FacadeSpec>
export const TEXTURES: Record<string, (...args: unknown[]) => THREE_NS.Texture>
export function facadeMaterial(key: string, tint?: string): THREE_NS.MeshStandardMaterial
export function facadeBoxGeometry(w: number, h: number, d: number, spec: FacadeSpec, uOff?: number): THREE_NS.BoxGeometry
export function mat(cor: string, o?: { rough?: number; metal?: number; map?: THREE_NS.Texture; emissive?: string; glow?: number; lamp?: number; transparent?: boolean; opacity?: number; side?: THREE_NS.Side; alphaTest?: number }): THREE_NS.MeshStandardMaterial
export const MATS: Record<'roof' | 'concrete' | 'metalDark' | 'metalLight' | 'glass' | 'wood' | 'greenRoof', () => THREE_NS.MeshStandardMaterial>
export function dimAtNight<T extends THREE_NS.Material>(m: T, k?: number): T
export function box(w: number, h: number, d: number, material: THREE_NS.Material, x?: number, y?: number, z?: number): THREE_NS.Mesh
export function cyl(rTop: number, rBot: number, h: number, material: THREE_NS.Material, x?: number, y?: number, z?: number, seg?: number): THREE_NS.Mesh
export function boxGeometry(w: number, h: number, d: number, x?: number, y?: number, z?: number): THREE_NS.BufferGeometry
export function beamGeometry(a: THREE_NS.Vector3, b: THREE_NS.Vector3, radius?: number, seg?: number): THREE_NS.BufferGeometry
export function mergedMesh(geos: THREE_NS.BufferGeometry[], material: THREE_NS.Material, shadows?: boolean): THREE_NS.Mesh
export function makeSign(texto: string, o?: { bg?: string; fg?: string; height?: number; glow?: number }): THREE_NS.Mesh
export function rng(seed?: number): () => number
export function hashStr(s: string): number
export const REDUCED_MOTION: () => boolean
