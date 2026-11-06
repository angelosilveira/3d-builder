import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type * as THREE from 'three'
import { useObraData } from '../data/store'
import { useReducedMotion } from '../state/useReducedMotion'
import { useAssets } from './assets'
import { alturaGrua, posicaoGrua } from './layout'
import { ModelSlot } from './ModelSlot'
import { Part, SelectableGroup } from './Selectable'

const LANCA = 34
const CONTRA = 10

/** Grua de torre com lança girando devagar e carga suspensa (palete de blocos). */
export function Crane() {
  const { geo, mats } = useAssets()
  const reduced = useReducedMotion()
  const planta = useObraData((d) => d.obra.planta)
  const nPav = useObraData((d) => d.pavimentos.length)
  const id = useObraData((d) => d.equipamentos.find((e) => e.tipo === 'grua')?.id ?? '')
  const pos = useMemo(() => posicaoGrua(planta), [planta])
  const H = alturaGrua(nPav, planta.peDireito)

  const giro = useRef<THREE.Group>(null)
  const carro = useRef<THREE.Group>(null)
  const cabo = useRef<THREE.Mesh>(null)
  const carga = useRef<THREE.Group>(null)

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()
    if (giro.current && !reduced) giro.current.rotation.y += delta * 0.09
    // Carro anda ao longo da lança e a carga sobe/desce em ciclos de içamento.
    const x = reduced ? 20 : 14 + 10 * (0.5 + 0.5 * Math.sin(t * 0.13))
    const descida = reduced ? 10 : 7 + 6 * (0.5 + 0.5 * Math.sin(t * 0.21 + 1))
    if (carro.current) carro.current.position.x = x
    if (cabo.current) {
      cabo.current.scale.y = descida
      cabo.current.position.y = -descida / 2
    }
    if (carga.current) carga.current.position.y = -descida - 0.7
  })

  if (!id) return null
  return (
    <SelectableGroup id={id} position={pos}>
      <ModelSlot nome="grua">
        {/* Base e torre */}
        <Part geometry={geo.caixa} material={mats.cimento} position={[0, 0.4, 0]} scale={[4, 0.8, 4]} />
        <Part geometry={geo.caixa} material={mats.seguranca} position={[0, H / 2, 0]} scale={[1.5, H, 1.5]} />
        <group ref={giro} position={[0, H, 0]}>
          <Part geometry={geo.caixa} material={mats.seguranca} position={[0, 0.4, 0]} scale={[2.2, 0.8, 2.2]} />
          {/* Cabine do operador */}
          <Part geometry={geo.caixa} material={mats.branco} position={[1.4, -0.3, 1.1]} scale={[1.6, 1.6, 1.2]} />
          <Part geometry={geo.caixa} material={mats.vidro} position={[2.21, -0.2, 1.1]} scale={[0.05, 0.9, 1]} semContorno />
          {/* Topo (torre de cabos) */}
          <Part geometry={geo.cone} material={mats.seguranca} position={[0, 3.1, 0]} scale={[1.6, 4.6, 1.6]} rotation={[0, Math.PI / 4, 0]} />
          {/* Lança e contra-lança */}
          <Part geometry={geo.caixa} material={mats.seguranca} position={[LANCA / 2 + 1, 1.1, 0]} scale={[LANCA, 0.9, 1]} />
          <Part geometry={geo.caixa} material={mats.seguranca} position={[-CONTRA / 2 - 1, 1.1, 0]} scale={[CONTRA, 0.9, 1.2]} />
          <Part geometry={geo.caixa} material={mats.cimento} position={[-CONTRA - 0.2, 0.4, 0]} scale={[2.4, 1.8, 1.8]} />
          {/* Tirantes */}
          <mesh geometry={geo.cilindroBaixo} material={mats.aco} position={[LANCA * 0.27, 3.3, 0]} rotation={[0, 0, -Math.PI / 2 + 0.24]} scale={[0.07, LANCA * 0.58, 0.07]} raycast={() => null} />
          <mesh geometry={geo.cilindroBaixo} material={mats.aco} position={[-CONTRA * 0.45, 3.3, 0]} rotation={[0, 0, Math.PI / 2 - 0.42]} scale={[0.07, CONTRA * 0.95, 0.07]} raycast={() => null} />
          {/* Carro, cabo e carga */}
          <group ref={carro} position={[20, 0.5, 0]}>
            <Part geometry={geo.caixa} material={mats.grafite} scale={[1.2, 0.4, 1.3]} />
            <mesh ref={cabo} geometry={geo.cilindroBaixo} material={mats.grafite} scale={[0.05, 10, 0.05]} raycast={() => null} />
            <group ref={carga}>
              <Part geometry={geo.caixa} material={mats.madeira} position={[0, -0.55, 0]} scale={[1.3, 0.15, 1.1]} />
              <Part geometry={geo.caixa} material={mats.bloco} position={[0, -0.05, 0]} scale={[1.2, 0.85, 1]} />
            </group>
          </group>
        </group>
      </ModelSlot>
    </SelectableGroup>
  )
}
