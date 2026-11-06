import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useObraData } from '../data/store'
import type { Equipe } from '../data/types'
import { useCanteiroStore } from '../state/canteiroStore'
import { useReducedMotion } from '../state/useReducedMotion'
import { useSelecionar } from '../state/useSelecionar'
import { useAssets } from './assets'
import { posicoesTrabalhadores } from './layout'
import { COR, COR_CAPACETE } from './palette'

const ALTURA_CORPO = 1.34

/** Trabalhadores como cápsulas instanciadas; clique seleciona a equipe. */
export function Workers() {
  const { geo, mats } = useAssets()
  const reduced = useReducedMotion()
  const obra = useObraData((d) => d.obra)
  const equipes = useObraData((d) => d.equipes)
  // As posições só dependem das equipes e da planta — não mudam a cada tick.
  const zonas = useMemo(() => equipes.map((e) => `${e.id}:${e.membros}:${e.zona}:${e.pavimentoNumero}`).join('|'), [equipes])
  const equipesRef = useRef(equipes)
  equipesRef.current = equipes
  const trabalhadores = useMemo(() => posicoesTrabalhadores({ obra, equipes: equipesRef.current }), [obra, zonas])
  const n = trabalhadores.length

  const corpos = useRef<THREE.InstancedMesh>(null)
  const capacetes = useRef<THREE.InstancedMesh>(null)
  const setHover = useCanteiroStore((s) => s.setHover)
  const selecionar = useSelecionar()

  // Cores: capacete por função (encarregado de branco); corpo realçado por equipe.
  useEffect(() => {
    const cor = new THREE.Color()
    const pintar = () => {
      const { hoverId, selecionadoId } = useCanteiroStore.getState()
      trabalhadores.forEach((t, i) => {
        capacetes.current?.setColorAt(i, cor.set(t.encarregado ? COR_CAPACETE.encarregado : COR_CAPACETE[t.funcao]))
        const c = t.equipeId === selecionadoId ? COR.prancha : t.equipeId === hoverId ? '#6B7A8C' : COR.corpo
        corpos.current?.setColorAt(i, cor.set(c))
      })
      if (capacetes.current?.instanceColor) capacetes.current.instanceColor.needsUpdate = true
      if (corpos.current?.instanceColor) corpos.current.instanceColor.needsUpdate = true
    }
    pintar()
    return useCanteiroStore.subscribe((s, prev) => {
      if (s.hoverId !== prev.hoverId || s.selecionadoId !== prev.selecionadoId) pintar()
    })
  }, [trabalhadores])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const um = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const capacete = useMemo(() => new THREE.Vector3(0.5, 0.3, 0.5), [])
  const eixoY = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame(({ clock }) => {
    const c = corpos.current
    const h = capacetes.current
    if (!c || !h) return
    const t = reduced ? 0 : clock.getElapsedTime()
    trabalhadores.forEach((w, i) => {
      // Leve movimento de trabalho (inclinação e giro), sem deslocamento.
      const giro = w.rot + (reduced ? 0 : Math.sin(t * 0.6 + i) * 0.5)
      q.setFromAxisAngle(eixoY, giro)
      const balanco = reduced ? 0 : Math.abs(Math.sin(t * 1.8 + i * 1.3)) * 0.04
      p.set(w.pos[0], w.pos[1] + ALTURA_CORPO / 2 + balanco, w.pos[2])
      c.setMatrixAt(i, m.compose(p, q, um))
      p.y += ALTURA_CORPO / 2 + 0.12
      h.setMatrixAt(i, m.compose(p, q, capacete))
    })
    c.instanceMatrix.needsUpdate = true
    h.instanceMatrix.needsUpdate = true
    if (!c.boundingSphere) c.computeBoundingSphere()
  })

  const equipeDe = useCallback(
    (e: ThreeEvent<PointerEvent | MouseEvent>): Equipe['id'] | undefined =>
      e.instanceId !== undefined ? trabalhadores[e.instanceId]?.equipeId : undefined,
    [trabalhadores],
  )
  const onMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      const id = equipeDe(e)
      if (id) setHover(id)
    },
    [equipeDe, setHover],
  )
  const onOut = useCallback(() => setHover(null), [setHover])
  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      const id = equipeDe(e)
      if (id) selecionar(id)
    },
    [equipeDe, selecionar],
  )

  return (
    <group>
      <instancedMesh
        key={`corpos-${n}`}
        ref={corpos}
        args={[geo.capsula, mats.instanciado, n]}
        castShadow
        frustumCulled={false}
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
      />
      <instancedMesh key={`capacetes-${n}`} ref={capacetes} args={[geo.esfera, mats.instanciado, n]} castShadow frustumCulled={false} raycast={() => null} />
    </group>
  )
}
