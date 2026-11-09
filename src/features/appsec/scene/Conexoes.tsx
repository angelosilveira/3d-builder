import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { conexaoArriscada, type ConexaoNaRede } from '../data/derived'
import { useAppSecData } from '../data/store'
import { redeDaSelecao } from '../state/rede'
import { useAppSecUi } from '../state/uiStore'
import { useMascara } from '../state/useMascara'
import { type Arco, arcoDaConexao, pontoNoArco } from './arcos'
import { cenaAnimada } from './Ecossistema'

/** Cores da rede: tráfego "normal" em ardósia; ligação arriscada em vermelho. */
const COR_LINHA = new THREE.Color('#2F4A66')
const COR_LINHA_LONGE = new THREE.Color('#7D8B99')
const COR_LINHA_GLOBAL = new THREE.Color('#4B6077')
const COR_RISCO = new THREE.Color('#D64545')
const COR_PACOTE = new THREE.Color('#0FA3C7')
const COR_PACOTE_RISCO = new THREE.Color('#FF4D3D')
const BRANCO = new THREE.Color('#FFFFFF')
/** Tempo para os arcos "crescerem" da origem ao destino (s). */
const CRESCER = 0.75

interface Montagem {
  modo: 'foco' | 'global'
  arestas: number
  segmentos: number
  arcos: Arco[]
  risco: Uint8Array
  fase: Float32Array
  velocidade: Float32Array
}

/**
 * Conexões entre ativos como arcos (linhas espessas) com pacotes de dados
 * correndo no sentido da chamada (de quem consome para quem é consumido).
 *
 * - Com um ativo selecionado: o caminho dele, dos consumidores às dependências.
 * - Com um projeto selecionado: todas as ligações do projeto.
 * - Sem seleção e com a rede ligada: o mapa inteiro, discreto (respeita filtros).
 */
export function Conexoes() {
  const reduced = useReducedMotion()
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const layout = useAppSecData((s) => s.layout)
  const selecao = useAppSecUi((s) => s.selecao)
  const redeVisivel = useAppSecUi((s) => s.redeVisivel)
  const mascara = useMascara()
  const size = useThree((s) => s.size)

  const recursos = useMemo(() => {
    const material = new LineMaterial({ vertexColors: true, linewidth: 2.4, transparent: true, opacity: 0.95, worldUnits: false, depthWrite: false })
    const linhas = new LineSegments2(new LineSegmentsGeometry(), material)
    linhas.frustumCulled = false
    linhas.renderOrder = 1
    linhas.raycast = () => {}
    return {
      material,
      linhas,
      pacoteGeo: new THREE.SphereGeometry(0.17, 12, 8),
      pacoteMat: new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false }),
    }
  }, [])
  useEffect(
    () => () => {
      recursos.linhas.geometry.dispose()
      recursos.material.dispose()
      recursos.pacoteGeo.dispose()
      recursos.pacoteMat.dispose()
    },
    [recursos],
  )
  useEffect(() => {
    recursos.material.resolution.set(size.width, size.height)
  }, [recursos, size.width, size.height])

  // Quais conexões mostrar agora.
  const lista = useMemo((): { modo: 'foco' | 'global'; conexoes: ConexaoNaRede[] } | null => {
    const foco = redeDaSelecao(selecao)
    if (foco) return { modo: 'foco', conexoes: foco.conexoes }
    if (!redeVisivel) return null
    const conexoes: ConexaoNaRede[] = []
    for (const c of data.conexoes) {
      const i = indice.posAtivo.get(c.origemId)
      const j = indice.posAtivo.get(c.destinoId)
      if (i !== undefined && j !== undefined && mascara[i] && mascara[j]) conexoes.push({ conexao: c, salto: 1 })
    }
    return { modo: 'global', conexoes }
    // indice: a rede em foco muda quando os dados mudam.
  }, [selecao, redeVisivel, data, indice, mascara])

  const pacotes = useRef<THREE.InstancedMesh>(null)
  const montagem = useRef<Montagem | null>(null)
  const inicio = useRef(-1)

  // Monta a geometria: segmentos ordenados "por posição no arco" (o k-ésimo
  // trecho de todas as arestas em sequência), para todas crescerem juntas.
  useEffect(() => {
    const { linhas } = recursos
    linhas.geometry.dispose()
    linhas.geometry = new LineSegmentsGeometry()
    montagem.current = null
    linhas.visible = false
    if (!lista || !lista.conexoes.length) return

    const global = lista.modo === 'global'
    const S = global ? 10 : 24
    const arcos: Arco[] = []
    const cores: THREE.Color[] = []
    const risco: number[] = []
    for (const { conexao, salto } of lista.conexoes) {
      const arco = arcoDaConexao(layout, indice.posAtivo, cenaAnimada.topo, conexao.origemId, conexao.destinoId)
      if (!arco) continue
      const arriscada = conexaoArriscada(conexao)
      arcos.push(arco)
      risco.push(arriscada ? 1 : 0)
      cores.push(arriscada ? COR_RISCO : global ? COR_LINHA_GLOBAL : salto > 1 ? COR_LINHA_LONGE : COR_LINHA)
    }
    const E = arcos.length
    const pos = new Float32Array(E * S * 6)
    const col = new Float32Array(E * S * 6)
    const p0: [number, number, number] = [0, 0, 0]
    const p1: [number, number, number] = [0, 0, 0]
    const c = new THREE.Color()
    for (let k = 0; k < S; k++) {
      for (let e = 0; e < E; e++) {
        const b = (k * E + e) * 6
        pontoNoArco(arcos[e], k / S, p0)
        pontoNoArco(arcos[e], (k + 1) / S, p1)
        pos.set(p0, b)
        pos.set(p1, b + 3)
        // Degradê: mais claro na origem, cor cheia no destino (indica o sentido).
        c.copy(cores[e]).lerp(BRANCO, 0.55 * (1 - k / S))
        col.set([c.r, c.g, c.b], b)
        c.copy(cores[e]).lerp(BRANCO, 0.55 * (1 - (k + 1) / S))
        col.set([c.r, c.g, c.b], b + 3)
      }
    }
    const geo = new LineSegmentsGeometry()
    geo.setPositions(pos)
    geo.setColors(col)
    linhas.geometry = geo
    linhas.visible = true
    recursos.material.linewidth = global ? 1.2 : 2.4
    recursos.material.opacity = global ? 0.55 : 0.95

    const fase = Float32Array.from({ length: E }, (_, e) => (e * 0.6180339) % 1)
    const velocidade = Float32Array.from({ length: E }, (_, e) => {
      const a = arcos[e]
      const comprimento = Math.hypot(a.b[0] - a.a[0], a.b[2] - a.a[2]) + Math.abs(a.c[1] - a.a[1])
      // Pacotes andam a ~6 m/s, mas nenhum arco leva mais de 3,5 s.
      return Math.max(1 / 3.5, 6 / Math.max(1, comprimento)) * (0.85 + 0.3 * (((e * 7) % 10) / 10))
    })
    montagem.current = { modo: lista.modo, arestas: E, segmentos: S, arcos, risco: Uint8Array.from(risco), fase, velocidade }
    inicio.current = -1

    const m = pacotes.current
    if (m) {
      const porAresta = global ? 1 : 2
      m.count = Math.min(m.instanceMatrix.count, E * porAresta)
      for (let k = 0; k < m.count; k++) m.setColorAt(k, risco[k % E] ? COR_PACOTE_RISCO : COR_PACOTE)
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  }, [lista, recursos, layout, indice])

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), pt: [0, 0, 0] as [number, number, number] }), [])

  useFrame(({ clock }) => {
    const mt = montagem.current
    const m = pacotes.current
    if (!m) return
    if (!mt) {
      m.visible = false
      return
    }
    const t = clock.getElapsedTime()
    if (inicio.current < 0) inicio.current = t
    const prog = reduced ? 1 : Math.min(1, (t - inicio.current) / CRESCER)
    const geo = recursos.linhas.geometry as LineSegmentsGeometry
    geo.instanceCount = Math.ceil(prog * mt.segmentos) * mt.arestas

    m.visible = true
    const escala = mt.modo === 'global' ? 0.75 : 1
    for (let k = 0; k < m.count; k++) {
      const e = k % mt.arestas
      const extra = k >= mt.arestas ? 0.5 : 0
      const u = reduced ? 0.55 : (t * mt.velocidade[e] + mt.fase[e] + extra) % 1
      pontoNoArco(mt.arcos[e], u, tmp.pt)
      tmp.p.set(tmp.pt[0], tmp.pt[1], tmp.pt[2])
      // Some no começo/fim do trajeto e enquanto o arco ainda cresce.
      const borda = Math.min(1, u * 8, (1 - u) * 8)
      tmp.s.setScalar(u <= prog ? escala * (mt.risco[e] ? 1.2 : 1) * Math.max(0.05, borda) : 1e-4)
      m.setMatrixAt(k, tmp.m.compose(tmp.p, tmp.q, tmp.s))
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <primitive object={recursos.linhas} />
      <instancedMesh
        key={`pk-${data.conexoes.length}`}
        ref={pacotes}
        args={[recursos.pacoteGeo, recursos.pacoteMat, Math.max(1, data.conexoes.length)]}
        frustumCulled={false}
        raycast={() => null}
        renderOrder={2}
        visible={false}
      />
    </group>
  )
}
