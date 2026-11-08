import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { statusDoAtivo } from '../data/derived'
import { useAppSecData } from '../data/store'
import { useAppSecUi } from '../state/uiStore'
import { ativoDaSelecao, cenaAnimada, PLACA_H } from './Ecossistema'
import { COR_STATUS } from './palette'

const ALTURA_FEIXE = 16
const PARTICULAS = 28
const APARECER = 0.45

/** Feixe com degradê de opacidade para cima (mais forte na base). */
function materialFeixe() {
  return new THREE.ShaderMaterial({
    uniforms: { cor: { value: new THREE.Color('#FFFFFF') }, opacidade: { value: 0.5 }, tempo: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 cor;
      uniform float opacidade;
      uniform float tempo;
      varying vec2 vUv;
      void main() {
        float sobe = pow(1.0 - vUv.y, 1.6);
        // faixas de "scan" subindo pelo feixe
        float faixa = 0.82 + 0.18 * sin(vUv.y * 38.0 - tempo * 6.0);
        gl_FragColor = vec4(cor, sobe * faixa * opacidade);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

/**
 * Farol sobre o ativo selecionado: feixe de luz na cor do status, anéis que
 * giram/expandem na base e partículas subindo. Sob movimento reduzido fica
 * só o feixe e um anel parados.
 */
export function Farol() {
  const reduced = useReducedMotion()
  const recursos = useMemo(() => {
    const pos = new Float32Array(PARTICULAS * 3)
    const pontos = new THREE.BufferGeometry()
    pontos.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return {
      feixe: new THREE.CylinderGeometry(0.55, 0.85, ALTURA_FEIXE, 24, 1, true).translate(0, ALTURA_FEIXE / 2, 0),
      feixeMat: materialFeixe(),
      anel: new THREE.RingGeometry(0.9, 1.08, 40).rotateX(-Math.PI / 2),
      anelTracejado: new THREE.RingGeometry(1.25, 1.4, 6, 1, 0, Math.PI * 1.4).rotateX(-Math.PI / 2),
      anelMat: new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
      ondaMat: new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
      pontos,
      pos,
      fase: Float32Array.from({ length: PARTICULAS }, (_, i) => (i * 0.6180339) % 1),
      ang: Float32Array.from({ length: PARTICULAS }, (_, i) => i * 2.399963),
      pontosMat: new THREE.PointsMaterial({ color: '#FFFFFF', size: 5, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }),
    }
  }, [])
  useEffect(
    () => () => {
      Object.values(recursos).forEach((r) => {
        if (r instanceof THREE.BufferGeometry || r instanceof THREE.Material) r.dispose()
      })
    },
    [recursos],
  )

  const grupo = useRef<THREE.Group>(null)
  const feixe = useRef<THREE.Mesh>(null)
  const anel = useRef<THREE.Mesh>(null)
  const tracejado = useRef<THREE.Mesh>(null)
  const onda = useRef<THREE.Mesh>(null)
  const pontos = useRef<THREE.Points>(null)
  const estado = useRef({ indice: -1, desde: 0, cor: new THREE.Color() })

  // Troca de seleção: reposiciona e reinicia a animação de entrada.
  useEffect(() => {
    const aplicar = () => {
      const { indice } = useAppSecData.getState()
      const id = ativoDaSelecao(useAppSecUi.getState().selecao)
      const i = id ? (indice.posAtivo.get(id) ?? -1) : -1
      const e = estado.current
      if (i !== e.indice) e.desde = -1
      e.indice = i
      if (i >= 0) e.cor.set(COR_STATUS[statusDoAtivo(indice, i)])
      recursos.feixeMat.uniforms.cor.value.copy(e.cor)
      recursos.anelMat.color.copy(e.cor)
      recursos.ondaMat.color.copy(e.cor)
      recursos.pontosMat.color.copy(e.cor).lerp(new THREE.Color('#FFFFFF'), 0.25)
    }
    aplicar()
    const a = useAppSecUi.subscribe((s, p) => s.selecao !== p.selecao && aplicar())
    const b = useAppSecData.subscribe((s, p) => s.indice !== p.indice && aplicar())
    return () => {
      a()
      b()
    }
  }, [recursos])

  useFrame(({ clock }) => {
    const g = grupo.current
    const e = estado.current
    if (!g) return
    if (e.indice < 0) {
      g.visible = false
      return
    }
    const t = clock.getElapsedTime()
    if (e.desde < 0) e.desde = t
    const { layout } = useAppSecData.getState()
    const x = layout.pos[e.indice * 2]
    const z = layout.pos[e.indice * 2 + 1]
    const topo = cenaAnimada.topo[e.indice] || PLACA_H + 1
    g.visible = true
    g.position.set(x, PLACA_H + 0.03, z)

    // Entrada: o feixe "sobe" do chão com um leve exagero (ease-out-back).
    const u = reduced ? 1 : Math.min(1, (t - e.desde) / APARECER)
    const back = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2)
    if (feixe.current) feixe.current.scale.set(1, Math.max(1e-3, back), 1)
    recursos.feixeMat.uniforms.tempo.value = reduced ? 0 : t
    recursos.feixeMat.uniforms.opacidade.value = 0.42 + (reduced ? 0 : 0.08 * Math.sin(t * 2.2))

    if (anel.current) {
      anel.current.scale.setScalar(Math.max(1e-3, u * (reduced ? 1 : 1 + 0.06 * Math.sin(t * 3))))
    }
    if (tracejado.current) {
      tracejado.current.visible = !reduced
      tracejado.current.rotation.y = -t * 1.4
      tracejado.current.scale.setScalar(Math.max(1e-3, u))
    }
    if (onda.current) {
      onda.current.visible = !reduced
      const ciclo = (t * 0.7) % 1
      onda.current.scale.setScalar(1 + ciclo * 2.6)
      recursos.ondaMat.opacity = 0.55 * (1 - ciclo) * u
    }

    const p = pontos.current
    if (p) {
      p.visible = !reduced
      if (!reduced) {
        const { pos, fase, ang } = recursos
        const base = topo - PLACA_H
        for (let k = 0; k < PARTICULAS; k++) {
          const c = (t * 0.45 + fase[k]) % 1
          const r = 0.25 + 0.5 * Math.sin(c * Math.PI)
          const a = ang[k] + t * 0.9
          pos[k * 3] = Math.cos(a) * r
          pos[k * 3 + 1] = base + c * 7 * u
          pos[k * 3 + 2] = Math.sin(a) * r
        }
        p.geometry.attributes.position.needsUpdate = true
        recursos.pontosMat.opacity = 0.85 * u
      }
    }
  })

  return (
    <group ref={grupo} visible={false}>
      <mesh ref={feixe} geometry={recursos.feixe} material={recursos.feixeMat} raycast={() => null} renderOrder={2} />
      <mesh ref={anel} geometry={recursos.anel} material={recursos.anelMat} raycast={() => null} renderOrder={3} />
      <mesh ref={tracejado} geometry={recursos.anelTracejado} material={recursos.anelMat} raycast={() => null} renderOrder={3} />
      <mesh ref={onda} geometry={recursos.anel} material={recursos.ondaMat} raycast={() => null} renderOrder={3} />
      <points ref={pontos} geometry={recursos.pontos} material={recursos.pontosMat} raycast={() => null} frustumCulled={false} renderOrder={4} />
    </group>
  )
}
