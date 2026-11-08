import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { useAppSecData } from '../data/store'
import { type Efeito, useEfeitos } from '../state/efeitos'
import { cenaAnimada, PLACA_H } from './Ecossistema'
import { COR, COR_STATUS } from './palette'

const POOL = 360
const ONDAS = 6
const VIDA = 1.25
const GRAVIDADE = 14

const PALETA: Record<Efeito['tipo'], string[]> = {
  acao: [COR_STATUS.aprovado, '#7CD3A8', '#FFFFFF'],
  conquista: [COR.pendencia, '#FFD95A', '#FFF3C4'],
  nivel: [COR.pendencia, COR_STATUS.aprovado, COR_STATUS.rascunho, '#FFFFFF'],
}
const QUANTIDADE: Record<Efeito['tipo'], number> = { acao: 36, conquista: 70, nivel: 110 }

/**
 * Explosões de partículas quando uma ação melhora a postura (verde), uma
 * conquista é desbloqueada (dourado) ou o nível sobe (multicolorido).
 * Pool fixo de instâncias, sem alocação por frame. Desligado com movimento reduzido.
 */
export function Explosoes() {
  const reduced = useReducedMotion()
  const r = useMemo(
    () => ({
      geo: new THREE.OctahedronGeometry(0.16),
      mat: new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false }),
      ondaGeo: new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2),
      pos: new Float32Array(POOL * 3),
      vel: new Float32Array(POOL * 3),
      nasc: new Float32Array(POOL).fill(-99),
      tam: new Float32Array(POOL),
      prox: 0,
      ondas: Array.from({ length: ONDAS }, () => ({ x: 0, z: 0, nasc: -99, cor: new THREE.Color() })),
      proxOnda: 0,
      pendentes: [] as Efeito[],
      ativos: 0,
    }),
    [],
  )
  const ondaMats = useMemo(
    () => Array.from({ length: ONDAS }, () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })),
    [],
  )
  useEffect(
    () => () => {
      r.geo.dispose()
      r.mat.dispose()
      r.ondaGeo.dispose()
      ondaMats.forEach((m) => m.dispose())
    },
    [r, ondaMats],
  )

  const malha = useRef<THREE.InstancedMesh>(null)
  const ondas = useRef<(THREE.Mesh | null)[]>([])

  useEffect(() => {
    if (reduced) return
    return useEfeitos.subscribe((s, prev) => {
      const vistos = new Set(prev.efeitos.map((e) => e.id))
      for (const e of s.efeitos) if (!vistos.has(e.id) && e.ativoId) r.pendentes.push(e)
    })
  }, [r, reduced])

  // Começa com todas as instâncias invisíveis.
  useEffect(() => {
    const m = malha.current
    if (!m) return
    const zero = new THREE.Matrix4().makeScale(0, 0, 0)
    const branco = new THREE.Color('#FFFFFF')
    for (let k = 0; k < POOL; k++) {
      m.setMatrixAt(k, zero)
      m.setColorAt(k, branco)
    }
    m.instanceMatrix.needsUpdate = true
  }, [reduced])

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() }), [])

  useFrame(({ clock }, delta) => {
    const m = malha.current
    if (!m) return
    const t = clock.getElapsedTime()
    const dt = Math.min(delta, 0.05)

    // Dispara as explosões pendentes.
    if (r.pendentes.length) {
      const { indice, layout } = useAppSecData.getState()
      for (const ef of r.pendentes.splice(0)) {
        const i = ef.ativoId ? indice.posAtivo.get(ef.ativoId) : undefined
        if (i === undefined) continue
        const x = layout.pos[i * 2]
        const z = layout.pos[i * 2 + 1]
        const y = cenaAnimada.topo[i] || PLACA_H + 1
        const cores = PALETA[ef.tipo]
        const forca = ef.tipo === 'acao' ? 1 : ef.tipo === 'conquista' ? 1.35 : 1.6
        for (let n = 0; n < QUANTIDADE[ef.tipo]; n++) {
          const k = r.prox
          r.prox = (r.prox + 1) % POOL
          const ang = Math.random() * Math.PI * 2
          const abre = (0.25 + Math.random() * 0.75) * 4.2 * forca
          r.pos.set([x, y + 0.2, z], k * 3)
          r.vel.set([Math.cos(ang) * abre, (6 + Math.random() * 7) * forca, Math.sin(ang) * abre], k * 3)
          r.nasc[k] = t
          r.tam[k] = (0.7 + Math.random() * 0.8) * (ef.tipo === 'acao' ? 1 : 1.3)
          m.setColorAt(k, tmp.c.set(cores[n % cores.length]))
        }
        if (m.instanceColor) m.instanceColor.needsUpdate = true
        const o = r.ondas[r.proxOnda]
        r.proxOnda = (r.proxOnda + 1) % ONDAS
        o.x = x
        o.z = z
        o.nasc = t
        o.cor.set(cores[0])
        r.ativos = POOL
      }
    }

    // Partículas: balística simples com gravidade, encolhem ao fim da vida.
    if (r.ativos > 0) {
      let vivos = 0
      for (let k = 0; k < POOL; k++) {
        const idade = t - r.nasc[k]
        if (idade < 0 || idade > VIDA) {
          if (idade > VIDA && idade < VIDA + 0.2) m.setMatrixAt(k, tmp.m.makeScale(0, 0, 0))
          continue
        }
        vivos++
        const b = k * 3
        r.vel[b + 1] -= GRAVIDADE * dt
        r.pos[b] += r.vel[b] * dt
        r.pos[b + 1] = Math.max(PLACA_H + 0.1, r.pos[b + 1] + r.vel[b + 1] * dt)
        r.pos[b + 2] += r.vel[b + 2] * dt
        const vida = 1 - idade / VIDA
        tmp.e.set(idade * 7 + k, idade * 5, 0)
        tmp.q.setFromEuler(tmp.e)
        tmp.p.set(r.pos[b], r.pos[b + 1], r.pos[b + 2])
        tmp.s.setScalar(r.tam[k] * Math.min(1, vida * 2.5))
        m.setMatrixAt(k, tmp.m.compose(tmp.p, tmp.q, tmp.s))
      }
      m.instanceMatrix.needsUpdate = true
      if (vivos === 0) r.ativos = 0
    }

    // Ondas de choque no chão.
    r.ondas.forEach((o, k) => {
      const mesh = ondas.current[k]
      if (!mesh) return
      const idade = t - o.nasc
      const u = idade / 0.9
      mesh.visible = u >= 0 && u < 1
      if (!mesh.visible) return
      mesh.position.set(o.x, PLACA_H + 0.04, o.z)
      mesh.scale.setScalar(0.5 + (1 - Math.pow(1 - u, 3)) * 5)
      ondaMats[k].color.copy(o.cor)
      ondaMats[k].opacity = 0.75 * (1 - u)
    })
  })

  if (reduced) return null
  return (
    <group>
      <instancedMesh ref={malha} args={[r.geo, r.mat, POOL]} frustumCulled={false} raycast={() => null} renderOrder={5} />
      {ondaMats.map((mat, k) => (
        <mesh
          key={k}
          ref={(el) => {
            ondas.current[k] = el
          }}
          geometry={r.ondaGeo}
          material={mat}
          visible={false}
          raycast={() => null}
          renderOrder={4}
        />
      ))}
    </group>
  )
}
