import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { TIPOS } from '../data/catalogo'
import { SEM_VULN, statusDoAtivo } from '../data/derived'
import { rankingAreas } from '../data/gamificacao'
import { useAppSecData } from '../data/store'
import type { Severidade, TipoAtivo } from '../data/types'
import { ativoDaSelecao, redeDaSelecao } from '../state/rede'
import { useAppSecUi } from '../state/uiStore'
import { useMascara } from '../state/useMascara'
import { COR, COR_SEVERIDADE, COR_STATUS } from './palette'

/** Altura das placas de projeto; os ativos ficam sobre elas. */
export const PLACA_H = 0.3
const SEVERIDADE_POR_ORDEM: Severidade[] = ['critica', 'alta', 'media', 'baixa']
/** Duração da onda de entrada (s): ativos brotam do centro para as bordas. */
const ONDA_ENTRADA = 1.6
/** Rigidez da interpolação (maior = mais rápido). */
const RIGIDEZ = 9

/** Geometria por tipo: a forma identifica o tipo sem precisar de rótulo. */
function criarGeometrias(): Record<TipoAtivo, THREE.BufferGeometry> {
  return {
    proxy: new THREE.ConeGeometry(0.5, 1.05, 4).rotateY(Math.PI / 4).translate(0, 0.525, 0),
    microservico: new THREE.BoxGeometry(0.66, 0.66, 0.66).translate(0, 0.33, 0),
    web: new THREE.CylinderGeometry(0.42, 0.42, 0.34, 20).translate(0, 0.17, 0),
    mobile: new THREE.BoxGeometry(0.34, 0.92, 0.2).translate(0, 0.46, 0),
    desktop: new THREE.BoxGeometry(0.92, 0.38, 0.6).translate(0, 0.19, 0),
  }
}

/** Altura relativa da forma pela maturidade (nível 1 = 0,8 … nível 5 = 1,6). */
export const alturaMaturidade = (nivel: number) => 0.6 + 0.2 * Math.max(1, nivel)

export { ativoDaSelecao }

/**
 * Estado atual (animado) de cada ativo, lido por outros efeitos da cena
 * (farol, partículas). Fora do React de propósito: muda a cada frame.
 */
export const cenaAnimada = {
  /** Topo atual (y) de cada ativo. */
  topo: new Float32Array(0),
}

/** Estado animado por instância: escala horizontal, escala vertical e elevação. */
const XZ = 0
const Y = 1
const ELEV = 2

export function Ecossistema() {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const layout = useAppSecData((s) => s.layout)
  const mascara = useMascara()
  const reduced = useReducedMotion()
  const setHover = useAppSecUi((s) => s.setHover)
  const selecionar = useAppSecUi((s) => s.selecionar)

  const geos = useMemo(criarGeometrias, [])
  const comuns = useMemo(
    () => ({
      caixa: new THREE.BoxGeometry(1, 1, 1),
      plano: new THREE.PlaneGeometry(1, 1),
      marcador: new THREE.OctahedronGeometry(0.26).scale(1, 1.35, 1),
      anel: new THREE.RingGeometry(0.62, 0.78, 28).rotateX(-Math.PI / 2),
      ativo: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.55, flatShading: true }),
      marcadorMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.35, emissive: '#ff3355', emissiveIntensity: 0.12 }),
      anelMat: new THREE.MeshBasicMaterial({ color: COR.pendencia, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }),
      placa: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.95 }),
      area: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 1 }),
      chao: new THREE.MeshStandardMaterial({ color: COR.chao, roughness: 1 }),
      tinta: new THREE.MeshBasicMaterial({ color: COR.tinta }),
    }),
    [],
  )
  useEffect(
    () => () => {
      Object.values(geos).forEach((g) => g.dispose())
      Object.values(comuns).forEach((r) => r.dispose())
    },
    [geos, comuns],
  )

  const n = data.ativos.length
  // Mapeamentos ativo ↔ instância (uma InstancedMesh por tipo).
  const { porTipo, slot, tipoDe } = useMemo(() => {
    const porTipo = Object.fromEntries(TIPOS.map((t) => [t, [] as number[]])) as Record<TipoAtivo, number[]>
    const slot = new Int32Array(data.ativos.length)
    const tipoDe: TipoAtivo[] = []
    data.ativos.forEach((a, i) => {
      slot[i] = porTipo[a.tipo].length
      porTipo[a.tipo].push(i)
      tipoDe[i] = a.tipo
    })
    return { porTipo, slot, tipoDe }
  }, [data.ativos])
  const comMarcador = useMemo(() => {
    const out: number[] = []
    indice.piorSeveridade.forEach((s, i) => s <= 1 && out.push(i))
    return out
  }, [indice])
  const comAnel = useMemo(() => {
    const out: number[] = []
    indice.prazoVencido.forEach((v, i) => v && out.push(i))
    return out
  }, [indice])

  // Estado animado: começa em zero (os ativos "brotam" na entrada).
  const anim = useMemo(() => {
    const atraso = new Float32Array(n)
    let maxD = 1
    for (let i = 0; i < n; i++) maxD = Math.max(maxD, Math.hypot(layout.pos[i * 2], layout.pos[i * 2 + 1]))
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(layout.pos[i * 2], layout.pos[i * 2 + 1]) / maxD
      atraso[i] = d * ONDA_ENTRADA + ((i * 0.6180339) % 1) * 0.18
    }
    cenaAnimada.topo = new Float32Array(n)
    return {
      atual: new Float32Array(n * 3),
      alvo: new Float32Array(n * 3),
      corAtual: new Float32Array(n * 3),
      corAlvo: new Float32Array(n * 3),
      atraso,
      visivel: new Uint8Array(n),
      movendo: true,
      inicio: -1,
      primeiraCor: true,
    }
  }, [n, layout])

  const malhas = useRef<Partial<Record<TipoAtivo, THREE.InstancedMesh | null>>>({})
  const marcadores = useRef<THREE.InstancedMesh>(null)
  const aneis = useRef<THREE.InstancedMesh>(null)
  const placas = useRef<THREE.InstancedMesh>(null)
  const areas = useRef<THREE.InstancedMesh>(null)
  const molduraProjeto = useRef<THREE.Group>(null)

  // Placas e chão das áreas: posição fixa.
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const pl = placas.current
    if (pl) {
      layout.projetos.forEach((p, k) => pl.setMatrixAt(k, m.compose(new THREE.Vector3(p.x, PLACA_H / 2, p.z), q, new THREE.Vector3(p.w, PLACA_H, p.d))))
      pl.instanceMatrix.needsUpdate = true
      pl.computeBoundingSphere()
    }
    const ar = areas.current
    if (ar) {
      layout.areas.forEach((a, k) => ar.setMatrixAt(k, m.compose(new THREE.Vector3(a.x, -0.01, a.z), q, new THREE.Vector3(a.w, 0.02, a.d))))
      ar.instanceMatrix.needsUpdate = true
      ar.computeBoundingSphere()
    }
  }, [layout])

  // Chão de cada área tingido pela pontuação de postura (verde = boa, avermelhado = ruim).
  useEffect(() => {
    const ar = areas.current
    if (!ar) return
    const pontos = new Map(rankingAreas(data, indice).map((r) => [r.area.id, r.pontos]))
    const base = new THREE.Color(COR.area)
    const bom = new THREE.Color('#C9E4D4')
    const ruim = new THREE.Color('#EED3CD')
    const cor = new THREE.Color()
    layout.areas.forEach((a, k) => {
      const t = Math.max(-1, Math.min(1, ((pontos.get(a.id) ?? 550) - 560) / 160))
      cor.copy(base).lerp(t >= 0 ? bom : ruim, Math.abs(t) * 0.75)
      ar.setColorAt(k, cor)
    })
    if (ar.instanceColor) ar.instanceColor.needsUpdate = true
  }, [data, indice, layout])

  /** Calcula o alvo de cada instância conforme filtro, seleção e hover; a animação leva até lá. */
  const calcularAlvos = useCallback(() => {
    const { selecao, hoverId } = useAppSecUi.getState()
    const selId = ativoDaSelecao(selecao)
    const analistaFoco = selecao?.tipo === 'analista' ? selecao.id : null
    const projetoFoco = selecao?.tipo === 'projeto' ? selecao.id : null
    // Com uma rede em foco, os ativos dela (inclusive de outros projetos) ficam acesos.
    const rede = redeDaSelecao(selecao)?.ativos ?? null
    const cor = new THREE.Color()
    const branco = new THREE.Color('#FFFFFF')
    const { alvo, corAlvo, visivel } = anim

    for (let i = 0; i < n; i++) {
      const a = data.ativos[i]
      const status = statusDoAtivo(indice, i)
      const ok =
        mascara[i] === 1 &&
        (!analistaFoco || indice.vigente.get(a.id)?.analistaId === analistaFoco) &&
        (rede ? rede.has(a.id) || (!!projetoFoco && a.projetoId === projetoFoco) : !projetoFoco || a.projetoId === projetoFoco)
      visivel[i] = ok ? 1 : 0
      let xz = status === 'depreciado' ? 0.7 : 1
      let elev = 0
      if (!ok) {
        cor.set(COR.esmaecido)
        xz *= 0.72
      } else {
        cor.set(COR_STATUS[status])
        if (a.id === hoverId) {
          cor.lerp(branco, 0.3)
          xz *= 1.18
          elev = 0.35
        }
        if (a.id === selId) {
          xz *= 1.3
          elev = Math.max(elev, 0.25)
        }
      }
      alvo[i * 3 + XZ] = xz
      alvo[i * 3 + Y] = xz * (ok ? alturaMaturidade(indice.maturidade[i]) : 0.8)
      alvo[i * 3 + ELEV] = elev
      corAlvo[i * 3] = cor.r
      corAlvo[i * 3 + 1] = cor.g
      corAlvo[i * 3 + 2] = cor.b
    }
    if (anim.primeiraCor) {
      anim.corAtual.set(corAlvo)
      anim.primeiraCor = false
    }
    anim.movendo = true

    // Placas: projeto selecionado ou sob o mouse ganha destaque (imediato).
    const pl = placas.current
    if (pl) {
      layout.projetos.forEach((proj, k) => {
        pl.setColorAt(k, cor.set(proj.id === projetoFoco ? COR.placaSelecionada : proj.id === hoverId ? COR.placaHover : COR.placa))
      })
      if (pl.instanceColor) pl.instanceColor.needsUpdate = true
    }
    const moldura = molduraProjeto.current
    const proj = projetoFoco ? layout.projetoPorId.get(projetoFoco) : undefined
    if (moldura) {
      moldura.visible = !!proj
      if (proj) {
        moldura.position.set(proj.x, PLACA_H, proj.z)
        const [w, d] = [proj.w + 0.3, proj.d + 0.3]
        const lados = moldura.children as THREE.Mesh[]
        lados[0].position.set(0, 0.05, -d / 2)
        lados[0].scale.set(w, 0.1, 0.16)
        lados[1].position.set(0, 0.05, d / 2)
        lados[1].scale.set(w, 0.1, 0.16)
        lados[2].position.set(-w / 2, 0.05, 0)
        lados[2].scale.set(0.16, 0.1, d)
        lados[3].position.set(w / 2, 0.05, 0)
        lados[3].scale.set(0.16, 0.1, d)
      }
    }
  }, [anim, n, data, indice, layout, mascara])

  useLayoutEffect(() => {
    calcularAlvos()
    return useAppSecUi.subscribe((s, prev) => {
      if (s.selecao !== prev.selecao || s.hoverId !== prev.hoverId) calcularAlvos()
    })
  }, [calcularAlvos])

    // Começam invisíveis (escala zero): a onda de entrada as faz brotar.
  useLayoutEffect(() => {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0)
    for (const tipo of TIPOS) {
      const m = malhas.current[tipo]
      if (m) {
        for (let k = 0; k < m.count; k++) m.setMatrixAt(k, zero)
        m.instanceMatrix.needsUpdate = true
        m.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(layout.largura, layout.profundidade))
      }
    }
  }, [layout, anim])

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), eixoY: new THREE.Vector3(0, 1, 0) }),
    [],
  )

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()
    if (anim.inicio < 0) anim.inicio = t
    const decorrido = t - anim.inicio
    const { m, q, p, s, c, eixoY } = tmp
    const { atual, alvo, corAtual, corAlvo, atraso, visivel } = anim
    const topo = cenaAnimada.topo

    // ---- Ativos: interpola só enquanto há movimento ----
    if (anim.movendo) {
      const k = reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * RIGIDEZ)
      let algum = false
      const tocadas = new Set<TipoAtivo>()
      q.identity()
      for (let i = 0; i < n; i++) {
        if (!reduced && decorrido < atraso[i]) {
          algum = true
          continue
        }
        const b = i * 3
        let mudou = false
        for (let j = 0; j < 3; j++) {
          const d = alvo[b + j] - atual[b + j]
          if (Math.abs(d) > 1e-3) {
            atual[b + j] += d * k
            mudou = true
          } else atual[b + j] = alvo[b + j]
          const dc = corAlvo[b + j] - corAtual[b + j]
          if (Math.abs(dc) > 2e-3) {
            corAtual[b + j] += dc * k
            mudou = true
          } else corAtual[b + j] = corAlvo[b + j]
        }
        if (!mudou && topo[i] !== 0) continue
        algum = algum || mudou
        const mesh = malhas.current[tipoDe[i]]
        if (!mesh) continue
        const x = layout.pos[i * 2]
        const z = layout.pos[i * 2 + 1]
        const y = PLACA_H + atual[b + ELEV]
        p.set(x, y, z)
        s.set(Math.max(atual[b + XZ], 1e-4), Math.max(atual[b + Y], 1e-4), Math.max(atual[b + XZ], 1e-4))
        mesh.setMatrixAt(slot[i], m.compose(p, q, s))
        mesh.setColorAt(slot[i], c.setRGB(corAtual[b], corAtual[b + 1], corAtual[b + 2]))
        topo[i] = y + atual[b + Y] * 0.95 + 1e-4
        tocadas.add(tipoDe[i])
      }
      tocadas.forEach((tipo) => {
        const mesh = malhas.current[tipo]
        if (!mesh) return
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      })
      anim.movendo = algum
    }

    // ---- Marcadores de vulnerabilidade: flutuam e giram; críticos mais rápidos ----
    const mk = marcadores.current
    if (mk) {
      comMarcador.forEach((i, kk) => {
        const b = i * 3
        const presente = visivel[i] && atual[b + Y] > 0.05
        const sev = indice.piorSeveridade[i]
        const critica = sev === 0
        const fase = i * 1.37
        const flutua = reduced ? 0 : Math.sin(t * (critica ? 2.4 : 1.6) + fase) * 0.12
        q.setFromAxisAngle(eixoY, reduced ? 0 : t * (critica ? 1.6 : 0.8) + fase)
        p.set(layout.pos[i * 2], topo[i] + 0.75 + flutua, layout.pos[i * 2 + 1])
        s.setScalar(presente ? (1 + Math.min(indice.abertas[i], 6) * 0.08) * Math.min(1, atual[b + XZ]) : 1e-4)
        mk.setMatrixAt(kk, m.compose(p, q, s))
        mk.setColorAt(kk, c.set(COR_SEVERIDADE[SEVERIDADE_POR_ORDEM[sev === SEM_VULN ? 3 : sev]]))
      })
      mk.instanceMatrix.needsUpdate = true
      if (mk.instanceColor) mk.instanceColor.needsUpdate = true
      comuns.marcadorMat.emissiveIntensity = reduced ? 0.15 : 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 3.2))
    }

    // ---- Anéis de prazo vencido: "respiram" ----
    const an = aneis.current
    if (an) {
      q.identity()
      comAnel.forEach((i, kk) => {
        const pulso = reduced ? 1 : 1 + 0.1 * Math.sin(t * 2.6 + i * 0.37)
        p.set(layout.pos[i * 2], PLACA_H + 0.02, layout.pos[i * 2 + 1])
        s.setScalar(visivel[i] ? pulso * Math.min(1, atual[i * 3 + XZ]) : 1e-4)
        an.setMatrixAt(kk, m.compose(p, q, s))
      })
      an.instanceMatrix.needsUpdate = true
      comuns.anelMat.opacity = reduced ? 0.9 : 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.6))
    }
  })

  // ---------- Eventos ----------
  const eventosTipo = useMemo(() => {
    const out = {} as Record<TipoAtivo, { onPointerMove: (e: ThreeEvent<PointerEvent>) => void; onClick: (e: ThreeEvent<MouseEvent>) => void }>
    for (const tipo of TIPOS) {
      const idDe = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
        e.instanceId !== undefined ? data.ativos[porTipo[tipo][e.instanceId]]?.id : undefined
      out[tipo] = {
        onPointerMove: (e) => {
          e.stopPropagation()
          const id = idDe(e)
          if (id) setHover(id)
        },
        onClick: (e) => {
          e.stopPropagation()
          const id = idDe(e)
          if (id) selecionar({ tipo: 'ativo', id })
        },
      }
    }
    return out
  }, [data, porTipo, setHover, selecionar])
  const sair = useCallback(() => setHover(null), [setHover])
  const onPlacaMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      if (e.instanceId !== undefined) setHover(layout.projetos[e.instanceId].id)
    },
    [layout, setHover],
  )
  const onPlacaClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (e.instanceId !== undefined) selecionar({ tipo: 'projeto', id: layout.projetos[e.instanceId].id })
    },
    [layout, selecionar],
  )

  return (
    <group>
      <mesh geometry={comuns.plano} material={comuns.chao} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} scale={[layout.largura * 3, layout.profundidade * 3, 1]} receiveShadow raycast={() => null} />
      <instancedMesh key={`areas-${layout.areas.length}`} ref={areas} args={[comuns.caixa, comuns.area, layout.areas.length]} receiveShadow raycast={() => null} />

      <instancedMesh
        key={`placas-${layout.projetos.length}`}
        ref={placas}
        args={[comuns.caixa, comuns.placa, layout.projetos.length]}
        receiveShadow
        onPointerMove={onPlacaMove}
        onPointerOut={sair}
        onClick={onPlacaClick}
      />

      {TIPOS.map((tipo) => (
        <instancedMesh
          key={`${tipo}-${porTipo[tipo].length}`}
          ref={(m) => {
            malhas.current[tipo] = m
          }}
          args={[geos[tipo], comuns.ativo, porTipo[tipo].length]}
          castShadow
          receiveShadow
          onPointerMove={eventosTipo[tipo].onPointerMove}
          onPointerOut={sair}
          onClick={eventosTipo[tipo].onClick}
        />
      ))}

      <instancedMesh key={`mk-${comMarcador.length}`} ref={marcadores} args={[comuns.marcador, comuns.marcadorMat, comMarcador.length]} castShadow raycast={() => null} frustumCulled={false} />
      <instancedMesh key={`an-${comAnel.length}`} ref={aneis} args={[comuns.anel, comuns.anelMat, comAnel.length]} raycast={() => null} frustumCulled={false} />

      <group ref={molduraProjeto} visible={false}>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} geometry={comuns.caixa} material={comuns.tinta} raycast={() => null} />
        ))}
      </group>
    </group>
  )
}
