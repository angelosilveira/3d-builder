import type { ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { TIPOS } from '../data/catalogo'
import { SEM_VULN } from '../data/derived'
import { useAppSecData } from '../data/store'
import type { Selecao, Severidade, TipoAtivo } from '../data/types'
import { useAppSecUi } from '../state/uiStore'
import { useMascara } from '../state/useMascara'
import { COR, COR_SEVERIDADE, COR_STATUS } from './palette'

/** Altura das placas de projeto; os ativos ficam sobre elas. */
export const PLACA_H = 0.3
const ALTURA_MARCADOR = 1.9
const SEVERIDADE_POR_ORDEM: Severidade[] = ['critica', 'alta', 'media', 'baixa']

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

/** Índice do ativo destacado pela seleção (ativo, vulnerabilidade ou pendência). */
function ativoDaSelecao(selecao: Selecao | null): string | null {
  if (!selecao) return null
  const { data } = useAppSecData.getState()
  if (selecao.tipo === 'ativo') return selecao.id
  if (selecao.tipo === 'vulnerabilidade') return data.vulnerabilidades.find((v) => v.id === selecao.id)?.ativoId ?? null
  if (selecao.tipo === 'pendencia') return data.pendencias.find((p) => p.id === selecao.id)?.ativoId ?? null
  return null
}

export function Ecossistema() {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const layout = useAppSecData((s) => s.layout)
  const mascara = useMascara()
  const setHover = useAppSecUi((s) => s.setHover)
  const selecionar = useAppSecUi((s) => s.selecionar)

  const geos = useMemo(criarGeometrias, [])
  const comuns = useMemo(
    () => ({
      caixa: new THREE.BoxGeometry(1, 1, 1),
      plano: new THREE.PlaneGeometry(1, 1),
      marcador: new THREE.OctahedronGeometry(0.26).scale(1, 1.35, 1),
      anel: new THREE.RingGeometry(0.62, 0.78, 28).rotateX(-Math.PI / 2),
      selecao: new THREE.TorusGeometry(0.9, 0.07, 8, 40).rotateX(Math.PI / 2),
      ativo: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.55, flatShading: true }),
      marcadorMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.4, emissive: '#2a0a12', emissiveIntensity: 0.15 }),
      anelMat: new THREE.MeshBasicMaterial({ color: COR.pendencia, side: THREE.DoubleSide }),
      placa: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.95 }),
      area: new THREE.MeshStandardMaterial({ color: COR.area, roughness: 1 }),
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

  // Índices dos ativos por tipo (uma InstancedMesh por tipo).
  const porTipo = useMemo(() => {
    const out = Object.fromEntries(TIPOS.map((t) => [t, [] as number[]])) as Record<TipoAtivo, number[]>
    data.ativos.forEach((a, i) => out[a.tipo].push(i))
    return out
  }, [data])
  const comMarcador = useMemo(() => {
    const out: number[] = []
    indice.piorSeveridade.forEach((s, i) => s <= 1 && out.push(i))
    return out
  }, [indice])
  const comAnel = useMemo(() => {
    const out: number[] = []
    indice.pendVencida.forEach((v, i) => v && out.push(i))
    return out
  }, [indice])

  const malhas = useRef<Partial<Record<TipoAtivo, THREE.InstancedMesh | null>>>({})
  const marcadores = useRef<THREE.InstancedMesh>(null)
  const aneis = useRef<THREE.InstancedMesh>(null)
  const placas = useRef<THREE.InstancedMesh>(null)
  const anelSelecao = useRef<THREE.Mesh>(null)
  const molduraProjeto = useRef<THREE.Group>(null)

  // Placas: posição fixa por projeto.
  useLayoutEffect(() => {
    const mesh = placas.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    layout.projetos.forEach((p, k) => {
      m.compose(new THREE.Vector3(p.x, PLACA_H / 2, p.z), new THREE.Quaternion(), new THREE.Vector3(p.w, PLACA_H, p.d))
      mesh.setMatrixAt(k, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [layout])

  /** Aplica cor e escala de todas as instâncias conforme filtro, seleção e hover. */
  const pintar = useCallback(() => {
    const { selecao, hoverId } = useAppSecUi.getState()
    const selId = ativoDaSelecao(selecao)
    const analistaFoco = selecao?.tipo === 'analista' ? selecao.id : null
    const projetoFoco = selecao?.tipo === 'projeto' ? selecao.id : null
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    const cor = new THREE.Color()
    const branco = new THREE.Color('#FFFFFF')
    const visivel = new Uint8Array(data.ativos.length)

    for (const tipo of TIPOS) {
      const mesh = malhas.current[tipo]
      if (!mesh) continue
      porTipo[tipo].forEach((i, k) => {
        const a = data.ativos[i]
        const ok = mascara[i] === 1 && (!analistaFoco || a.analistaId === analistaFoco) && (!projetoFoco || a.projetoId === projetoFoco)
        visivel[i] = ok ? 1 : 0
        const depreciado = a.qualificacao.status === 'depreciado'
        let escala = depreciado ? 0.7 : 1
        if (!ok) {
          cor.set(COR.esmaecido)
          escala *= 0.72
        } else {
          cor.set(COR_STATUS[a.qualificacao.status])
          if (a.id === hoverId) {
            cor.lerp(branco, 0.3)
            escala *= 1.22
          }
          if (a.id === selId) escala *= 1.35
        }
        p.set(layout.pos[i * 2], PLACA_H, layout.pos[i * 2 + 1])
        s.setScalar(escala)
        mesh.setMatrixAt(k, m.compose(p, q, s))
        mesh.setColorAt(k, cor)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    // Marcadores de vulnerabilidade crítica/alta e anéis de pendência vencida.
    const mk = marcadores.current
    if (mk) {
      comMarcador.forEach((i, k) => {
        const ok = visivel[i] === 1
        p.set(layout.pos[i * 2], PLACA_H + ALTURA_MARCADOR, layout.pos[i * 2 + 1])
        s.setScalar(ok ? 1 + Math.min(indice.abertas[i], 6) * 0.08 : 0.0001)
        mk.setMatrixAt(k, m.compose(p, q, s))
        const sev = indice.piorSeveridade[i]
        mk.setColorAt(k, cor.set(COR_SEVERIDADE[SEVERIDADE_POR_ORDEM[sev === SEM_VULN ? 3 : sev]]))
      })
      mk.instanceMatrix.needsUpdate = true
      if (mk.instanceColor) mk.instanceColor.needsUpdate = true
    }
    const an = aneis.current
    if (an) {
      comAnel.forEach((i, k) => {
        p.set(layout.pos[i * 2], PLACA_H + 0.02, layout.pos[i * 2 + 1])
        s.setScalar(visivel[i] ? 1 : 0.0001)
        an.setMatrixAt(k, m.compose(p, q, s))
      })
      an.instanceMatrix.needsUpdate = true
    }

    // Placas: projeto selecionado ou sob o mouse ganha destaque.
    const pl = placas.current
    if (pl) {
      layout.projetos.forEach((proj, k) => {
        pl.setColorAt(k, cor.set(proj.id === projetoFoco ? COR.placaSelecionada : proj.id === hoverId ? COR.placaHover : COR.placa))
      })
      if (pl.instanceColor) pl.instanceColor.needsUpdate = true
    }

    // Anel de seleção no ativo e moldura no projeto selecionado.
    const anel = anelSelecao.current
    const iSel = selId ? indice.posAtivo.get(selId) : undefined
    if (anel) {
      anel.visible = iSel !== undefined
      if (iSel !== undefined) anel.position.set(layout.pos[iSel * 2], PLACA_H + 0.03, layout.pos[iSel * 2 + 1])
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
  }, [data, indice, layout, mascara, porTipo, comMarcador, comAnel])

  useLayoutEffect(() => {
    pintar()
    for (const tipo of TIPOS) malhas.current[tipo]?.computeBoundingSphere()
    marcadores.current?.computeBoundingSphere()
    return useAppSecUi.subscribe((s, prev) => {
      if (s.selecao !== prev.selecao || s.hoverId !== prev.hoverId) pintar()
    })
  }, [pintar])

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
      {layout.areas.map((a) => (
        <mesh key={a.id} geometry={comuns.caixa} material={comuns.area} position={[a.x, -0.01, a.z]} scale={[a.w, 0.02, a.d]} receiveShadow raycast={() => null} />
      ))}

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

      <instancedMesh key={`mk-${comMarcador.length}`} ref={marcadores} args={[comuns.marcador, comuns.marcadorMat, comMarcador.length]} castShadow raycast={() => null} />
      <instancedMesh key={`an-${comAnel.length}`} ref={aneis} args={[comuns.anel, comuns.anelMat, comAnel.length]} raycast={() => null} frustumCulled={false} />

      <mesh ref={anelSelecao} geometry={comuns.selecao} material={comuns.tinta} visible={false} raycast={() => null} />
      <group ref={molduraProjeto} visible={false}>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} geometry={comuns.caixa} material={comuns.tinta} raycast={() => null} />
        ))}
      </group>
    </group>
  )
}
