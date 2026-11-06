import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useObraData } from '../data/store'
import { desviosPavimentos, estadosPavimentos, type Desvio } from '../data/schedule'
import { useCanteiroStore } from '../state/canteiroStore'
import { useReducedMotion } from '../state/useReducedMotion'
import { useSelecionar } from '../state/useSelecionar'
import { useAssets } from './assets'
import { geometriaPredio, SLAB } from './layout'
import { COR, COR_DESVIO } from './palette'
import { Contorno, useHandlersSelecao, useRealce } from './Selectable'
import { runtime } from './runtime'

/** Velocidade da animação 4D, em pavimentos por segundo. */
const VELOCIDADE = 3.2
const LADO_PILAR = 0.42

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** Sequência construtiva dentro do ciclo de estrutura de um pavimento. */
const fase = {
  pilares: (e: number) => clamp01(e / 0.25),
  vigas: (e: number) => clamp01((e - 0.25) / 0.2),
  formas: (e: number) => clamp01((e - 0.4) / 0.25),
  laje: (e: number) => clamp01((e - 0.65) / 0.35),
}

const tingir = (cor: string, mistura: number) => new THREE.Color(cor).lerp(new THREE.Color('#FFFFFF'), mistura)

interface AndarRefs {
  laje: THREE.Mesh | null
  forma: THREE.Mesh | null
  paredes: THREE.Group | null
  fantasma: THREE.Group | null
  previsto: THREE.LineSegments | null
  matLaje: THREE.MeshStandardMaterial
  matParede: THREE.MeshStandardMaterial
}

export function Building() {
  const { geo, mats } = useAssets()
  const reduced = useReducedMotion()
  const obra = useObraData((d) => d.obra)
  const pavimentos = useObraData((d) => d.pavimentos)
  const elementos = useObraData((d) => d.elementos)
  // Seletores primitivos: mudam só quando o valor muda.
  const fracConcretagem = useObraData((d) => {
    const c = d.concretagens.find((x) => x.status === 'em_andamento')
    return c ? c.volumeLancadoM3 / c.volumeProgramadoM3 : 0
  })
  const pavConcretagem = useObraData((d) => d.concretagens.find((x) => x.status === 'em_andamento')?.pavimentoNumero ?? -1)
  const semanaSel = useCanteiroStore((s) => s.semana)
  const comparar = useCanteiroStore((s) => s.comparar)

  const semana = semanaSel ?? obra.semanaAtual
  const isHoje = semanaSel === null || Math.abs(semanaSel - obra.semanaAtual) < 0.05
  const g = useMemo(() => geometriaPredio(obra.planta), [obra.planta])
  const n = pavimentos.length
  const nP = obra.planta.colunas * obra.planta.linhas
  const nV = obra.planta.colunas + obra.planta.linhas
  const pe = g.h - SLAB

  const executado = useMemo(() => estadosPavimentos({ obra, pavimentos }, semana, 'executado'), [obra, pavimentos, semana])
  const previsto = useMemo(() => estadosPavimentos({ obra, pavimentos }, semana, 'previsto'), [obra, pavimentos, semana])
  const desvios = useMemo(() => desviosPavimentos({ obra, pavimentos }, semana), [obra, pavimentos, semana])

  // Alvo da animação: lido pelo useFrame via ref (nada de estado por frame).
  const alvo = useRef({ e: [] as number[], a: [] as number[], p: [] as number[], fracHoje: 0, pavHoje: -1, comparar: false, versao: 0 })
  alvo.current = {
    e: executado.map((x) => x.estrutura),
    a: executado.map((x) => x.alvenaria),
    p: previsto.map((x) => x.estrutura),
    fracHoje: isHoje ? fracConcretagem : -1,
    pavHoje: pavConcretagem,
    comparar,
    versao: alvo.current.versao + 1,
  }
  /** Última versão do alvo já aplicada à cena (evita trabalho quando nada muda). */
  const aplicada = useRef(-1)
  const exibido = useRef({ e: new Array<number>(n).fill(0), a: new Array<number>(n).fill(0), corte: 0 })
  useLayoutEffect(() => {
    // Ao trocar de obra, a animação começa do terreno vazio.
    exibido.current = { e: new Array<number>(n).fill(0), a: new Array<number>(n).fill(0), corte: 0 }
    aplicada.current = -1
  }, [n, obra.id])

  const andares = useMemo<AndarRefs[]>(
    () =>
      Array.from({ length: n }, () => ({
        laje: null,
        forma: null,
        paredes: null,
        fantasma: null,
        previsto: null,
        matLaje: new THREE.MeshStandardMaterial({ color: COR.laje, roughness: 0.9 }),
        matParede: new THREE.MeshStandardMaterial({ color: COR.parede, roughness: 0.95 }),
      })),
    [n],
  )
  useEffect(() => () => andares.forEach((a) => (a.matLaje.dispose(), a.matParede.dispose())), [andares])

  // Cores por pavimento: modo normal ou Previsto x Executado.
  useEffect(() => {
    andares.forEach((a, i) => {
      const d: Desvio = desvios[i]
      if (comparar && d !== 'nao_iniciado') {
        a.matLaje.color.copy(tingir(COR_DESVIO[d], 0.25))
        a.matParede.color.copy(tingir(COR_DESVIO[d], 0.62))
      } else {
        a.matLaje.color.set(isHoje && i + 1 === pavConcretagem ? COR.lajeFresca : COR.laje)
        a.matParede.color.set(COR.parede)
      }
    })
  }, [andares, desvios, comparar, isHoje, pavConcretagem])

  // ---------- Pilares e vigas instanciados ----------
  const pilaresRef = useRef<THREE.InstancedMesh>(null)
  const vigasRef = useRef<THREE.InstancedMesh>(null)
  const pilarIds = useMemo(
    () => pavimentos.flatMap((p) => Array.from({ length: nP }, (_, k) => `${p.id}-P${k + 1}`)),
    [pavimentos, nP],
  )
  const naoConformes = useMemo(() => new Set(elementos.filter((e) => e.status === 'nao_conforme').map((e) => e.id)), [elementos])

  // Recolore instâncias quando hover/seleção/modo mudam — via subscribe, sem re-render.
  useEffect(() => {
    const cor = new THREE.Color()
    const pintar = () => {
      const mesh = pilaresRef.current
      if (!mesh) return
      const { hoverId, selecionadoId } = useCanteiroStore.getState()
      pilarIds.forEach((id, idx) => {
        const andar = Math.floor(idx / nP)
        if (id === selecionadoId) cor.set(COR.prancha)
        else if (naoConformes.has(id)) cor.set(COR.atraso)
        else if (id === hoverId) cor.set(COR.pilarHover)
        else if (comparar && desvios[andar] !== 'nao_iniciado') cor.set(COR_DESVIO[desvios[andar]])
        else cor.set(COR.pilar)
        mesh.setColorAt(idx, cor)
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      const vigas = vigasRef.current
      if (vigas) {
        for (let i = 0; i < n * nV; i++) {
          const andar = Math.floor(i / nV)
          cor.set(comparar && desvios[andar] !== 'nao_iniciado' ? COR_DESVIO[desvios[andar]] : COR.pilar)
          vigas.setColorAt(i, cor)
        }
        if (vigas.instanceColor) vigas.instanceColor.needsUpdate = true
      }
    }
    pintar()
    return useCanteiroStore.subscribe((s, prev) => {
      if (s.hoverId !== prev.hoverId || s.selecionadoId !== prev.selecionadoId) pintar()
    })
  }, [pilarIds, naoConformes, comparar, desvios, nP, n, nV])

  const setHover = useCanteiroStore((s) => s.setHover)
  const selecionar = useSelecionar()
  const onPilarMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.instanceId !== undefined) setHover(pilarIds[e.instanceId])
  }
  const onPilarOut = () => setHover(null)
  const onPilarClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.instanceId !== undefined) selecionar(pilarIds[e.instanceId])
  }

  // ---------- Plano de corte ----------
  const corteRef = useRef<THREE.Group>(null)
  const corteGeo = useMemo(() => {
    const w = g.W + 5
    const d = g.D + 5
    const pts = [-w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, 0, d / 2, w / 2, 0, d / 2, -w / 2, 0, d / 2, -w / 2, 0, d / 2, -w / 2, 0, -d / 2]
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return geom
  }, [g.W, g.D])
  useEffect(() => () => corteGeo.dispose(), [corteGeo])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const s = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const passo = reduced ? Infinity : VELOCIDADE * dt
    const ex = exibido.current
    const t = alvo.current
    let animando = false

    for (const k of ['e', 'a'] as const) {
      const d = ex[k]
      const tt = t[k]
      for (let i = 0; i < n; i++) {
        if (d[i] < tt[i] && (i === 0 || d[i - 1] >= tt[i - 1] - 1e-3)) d[i] = Math.min(tt[i], d[i] + passo)
      }
      for (let i = n - 1; i >= 0; i--) {
        if (d[i] > tt[i] && (i === n - 1 || d[i + 1] <= tt[i + 1] + 1e-3)) d[i] = Math.max(tt[i], d[i] - passo)
      }
      for (let i = 0; i < n; i++) if (Math.abs(d[i] - tt[i]) > 1e-3) animando = true
    }
    // Em repouso e sem alvo novo: nada a recalcular neste frame.
    if (!animando && aplicada.current === t.versao && ex.corte < 0.01) return
    if (!animando) aplicada.current = t.versao

    let topo = 0
    const pilares = pilaresRef.current
    const vigas = vigasRef.current
    for (let i = 0; i < n; i++) {
      const e = ex.e[i]
      const base = i * g.h
      if (e > 0) topo = base + e * g.h
      const fp = fase.pilares(e)
      const fv = fase.vigas(e)

      if (pilares) {
        for (let k = 0; k < nP; k++) {
          const x = g.xs[k % obra.planta.colunas]
          const z = g.zs[Math.floor(k / obra.planta.colunas)]
          const altura = Math.max(pe * fp, 0.001)
          p.set(x, base + altura / 2, z)
          s.set(fp > 0 ? LADO_PILAR : 0.001, altura, fp > 0 ? LADO_PILAR : 0.001)
          pilares.setMatrixAt(i * nP + k, m.compose(p, q, s))
        }
      }
      if (vigas) {
        const y = base + pe - 0.2
        for (let j = 0; j < obra.planta.linhas; j++) {
          p.set(g.minX + (g.W * fv) / 2, y, g.zs[j])
          s.set(Math.max(g.W * fv, 0.001), fv > 0 ? 0.4 : 0.001, 0.22)
          vigas.setMatrixAt(i * nV + j, m.compose(p, q, s))
        }
        for (let c = 0; c < obra.planta.colunas; c++) {
          p.set(g.xs[c], y, g.minZ + (g.D * fv) / 2)
          s.set(0.22, fv > 0 ? 0.4 : 0.001, Math.max(g.D * fv, 0.001))
          vigas.setMatrixAt(i * nV + obra.planta.linhas + c, m.compose(p, q, s))
        }
      }

      const a = andares[i]
      // Laje: na concretagem do dia, o preenchimento acompanha o volume lançado ao vivo.
      let fl = fase.laje(e)
      if (t.fracHoje >= 0 && i + 1 === t.pavHoje && t.e[i] > 0.65) {
        fl = clamp01((e - 0.65) / Math.max(t.e[i] - 0.65, 1e-3)) * t.fracHoje
      }
      if (a.laje) {
        a.laje.visible = fl > 0.002
        a.laje.scale.x = Math.max((g.W + 0.3) * fl, 0.001)
        a.laje.position.x = g.minX - 0.15 + ((g.W + 0.3) * fl) / 2
      }
      if (a.forma) {
        const ff = fase.formas(e)
        a.forma.visible = ff > 0.002 && fl < 0.999
        a.forma.scale.x = Math.max((g.W + 0.3) * ff, 0.001)
        a.forma.position.x = g.minX - 0.15 + ((g.W + 0.3) * ff) / 2
      }
      if (a.paredes) {
        a.paredes.visible = ex.a[i] > 0.002
        a.paredes.scale.y = Math.max(ex.a[i], 0.001)
      }
      if (a.fantasma) a.fantasma.visible = e <= 0.001
      if (a.previsto) a.previsto.visible = t.comparar && t.p[i] > e + 0.05
    }
    if (pilares) {
      pilares.instanceMatrix.needsUpdate = true
      pilares.computeBoundingSphere()
    }
    if (vigas) vigas.instanceMatrix.needsUpdate = true
    runtime.alturaEstrutura = topo

    // Plano de corte: aparece só enquanto o prédio cresce/regride.
    ex.corte = THREE.MathUtils.damp(ex.corte, animando ? 1 : 0, animando ? 10 : 3, dt)
    const corte = corteRef.current
    if (corte) {
      corte.visible = ex.corte > 0.01
      corte.position.y = topo + 0.06
      mats.planoCorte.opacity = 0.16 * ex.corte
      mats.linhaCorte.opacity = 0.9 * ex.corte
    }
  })

  return (
    <group>
      <instancedMesh
        key={`pilares-${obra.id}`}
        ref={pilaresRef}
        args={[geo.caixa, mats.instanciado, n * nP]}
        castShadow
        receiveShadow
        onPointerMove={onPilarMove}
        onPointerOut={onPilarOut}
        onClick={onPilarClick}
      />
      <instancedMesh key={`vigas-${obra.id}`} ref={vigasRef} args={[geo.caixa, mats.instanciado, n * nV]} castShadow raycast={() => null} />

      {pavimentos.map((pav, i) => (
        <Andar key={pav.id} lajeId={`${pav.id}-L`} indice={i} refs={andares[i]} g={g} />
      ))}

      <Andaimes g={g} pavimentos={n} />

      <group ref={corteRef} visible={false}>
        <mesh geometry={geo.plano} material={mats.planoCorte} position={[g.cx, 0, g.cz]} rotation={[-Math.PI / 2, 0, 0]} scale={[g.W + 5, g.D + 5, 1]} raycast={() => null} />
        <lineSegments geometry={corteGeo} material={mats.linhaCorte} position={[g.cx, 0.01, g.cz]} raycast={() => null} />
      </group>
    </group>
  )
}

interface AndarProps {
  lajeId: string
  indice: number
  refs: AndarRefs
  g: ReturnType<typeof geometriaPredio>
}

/** Laje, fôrmas, alvenaria e fantasma de um pavimento. A animação vem do pai. */
function Andar({ lajeId, indice, refs, g }: AndarProps) {
  const { geo, mats } = useAssets()
  const realce = useRealce(lajeId)
  const handlers = useHandlersSelecao(lajeId)
  const base = indice * g.h
  const pe = g.h - SLAB
  const yLaje = base + g.h - SLAB / 2

  const previstoGeo = useMemo(() => {
    const geom = new THREE.EdgesGeometry(new THREE.BoxGeometry(g.W, g.h, g.D))
    return geom
  }, [g.W, g.h, g.D])
  useEffect(() => () => previstoGeo.dispose(), [previstoGeo])

  return (
    <group>
      <mesh
        ref={(m) => {
          refs.laje = m
        }}
        geometry={geo.caixa}
        material={refs.matLaje}
        position={[g.cx, yLaje, g.cz]}
        scale={[g.W + 0.3, SLAB, g.D + 0.3]}
        castShadow
        receiveShadow
        visible={false}
        {...handlers}
      >
        <Contorno forcar={realce} />
      </mesh>
      <mesh
        ref={(m) => {
          refs.forma = m
        }}
        geometry={geo.caixa}
        material={mats.forma}
        position={[g.cx, yLaje - 0.04, g.cz]}
        scale={[g.W + 0.3, 0.06, g.D + 0.3]}
        receiveShadow
        visible={false}
        raycast={() => null}
      />

      {/* Alvenaria de fachada com faixas de janelas */}
      <group
        ref={(gr) => {
          refs.paredes = gr
        }}
        position={[0, base, 0]}
        visible={false}
        {...handlers}
      >
        {(
          [
            [g.cx, g.maxZ, g.W, 0.16],
            [g.cx, g.minZ, g.W, 0.16],
            [g.minX, g.cz, 0.16, g.D],
            [g.maxX, g.cz, 0.16, g.D],
          ] as const
        ).map(([x, z, w, d], k) => (
          <mesh key={k} geometry={geo.caixa} material={refs.matParede} position={[x, pe / 2, z]} scale={[w, pe, d]} castShadow receiveShadow>
            <Contorno forcar={realce} />
          </mesh>
        ))}
        {[g.maxZ + 0.09, g.minZ - 0.09].map((z) =>
          g.xs.slice(0, -1).map((x, k) => (
            <mesh
              key={`${z}-${k}`}
              geometry={geo.caixa}
              material={mats.vidro}
              position={[x + (g.xs[1] - g.xs[0]) / 2, pe * 0.52, z]}
              scale={[(g.xs[1] - g.xs[0]) * 0.62, pe * 0.42, 0.04]}
              raycast={() => null}
            />
          )),
        )}
      </group>

      {/* Pavimento futuro: contorno translúcido */}
      <group
        ref={(gr) => {
          refs.fantasma = gr
        }}
        position={[g.cx, base + g.h / 2, g.cz]}
      >
        <lineSegments geometry={geo.arestasCaixa} material={mats.linhaFantasma} scale={[g.W, g.h, g.D]} raycast={() => null} />
        <mesh geometry={geo.caixa} material={mats.fantasma} scale={[g.W, g.h - 0.02, g.D]} raycast={() => null} />
      </group>

      {/* Previsto x Executado: o que deveria existir e ainda não existe */}
      <lineSegments
        ref={(l) => {
          refs.previsto = l
          l?.computeLineDistances()
        }}
        geometry={previstoGeo}
        material={mats.linhaPrevista}
        position={[g.cx, base + g.h / 2, g.cz]}
        visible={false}
        raycast={() => null}
      />
    </group>
  )
}

const POSTE = 2

/** Andaimes na fachada da rua, acompanhando a altura da estrutura. */
function Andaimes({ g, pavimentos }: { g: ReturnType<typeof geometriaPredio>; pavimentos: number }) {
  const { geo, mats } = useAssets()
  const ref = useRef<THREE.InstancedMesh>(null)
  const colunas = Math.floor(g.W / POSTE) + 1
  const niveis = pavimentos * 2
  const total = colunas + niveis
  const ultima = useRef(-1)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const s = useMemo(() => new THREE.Vector3(), [])
  const z = g.maxZ + 1.1

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const altura = Math.round(runtime.alturaEstrutura * 4) / 4
    if (altura === ultima.current) return
    ultima.current = altura
    for (let c = 0; c < colunas; c++) {
      p.set(g.minX + c * POSTE, altura / 2, z)
      s.set(0.06, Math.max(altura, 0.001), 0.06)
      mesh.setMatrixAt(c, m.compose(p, q, s))
    }
    for (let l = 0; l < niveis; l++) {
      const y = (l + 1) * (g.h / 2)
      const ok = y <= altura
      p.set(g.cx, y, z)
      s.set(ok ? g.W : 0.001, ok ? 0.05 : 0.001, ok ? 0.6 : 0.001)
      mesh.setMatrixAt(colunas + l, m.compose(p, q, s))
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geo.caixa, mats.andaime, total]} castShadow raycast={() => null} />
}
