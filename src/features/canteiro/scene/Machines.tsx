import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type * as THREE from 'three'
import { useObraData } from '../data/store'
import { useReducedMotion } from '../state/useReducedMotion'
import { useAssets } from './assets'
import { POSICOES_FIXAS, posicaoElevador } from './layout'
import { ModelSlot } from './ModelSlot'
import { Part, SelectableGroup } from './Selectable'
import { runtime } from './runtime'

function Escavadeira({ id }: { id: string }) {
  const { geo, mats } = useAssets()
  const reduced = useReducedMotion()
  const superior = useRef<THREE.Group>(null)
  const braco = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (reduced) return
    const t = clock.getElapsedTime()
    if (superior.current) superior.current.rotation.y = 0.5 * Math.sin(t * 0.35)
    if (braco.current) braco.current.rotation.z = -0.25 + 0.2 * Math.sin(t * 0.7)
  })
  return (
    <SelectableGroup id={id} position={POSICOES_FIXAS['ES-01']} rotation={[0, -2.4, 0]}>
      <ModelSlot nome="escavadeira">
        {[-1.1, 1.1].map((z) => (
          <Part key={z} geometry={geo.caixa} material={mats.grafite} position={[0, 0.45, z]} scale={[4.2, 0.9, 0.8]} />
        ))}
        <group ref={superior} position={[0, 1.1, 0]}>
          <Part geometry={geo.caixa} material={mats.seguranca} position={[-0.4, 0.55, 0]} scale={[3.4, 1.1, 2.6]} />
          <Part geometry={geo.caixa} material={mats.seguranca} position={[0.6, 1.5, -0.6]} scale={[1.3, 1.3, 1.2]} />
          <Part geometry={geo.caixa} material={mats.vidro} position={[1.27, 1.6, -0.6]} scale={[0.04, 0.8, 1]} semContorno />
          <group ref={braco} position={[1.2, 1.1, 0.5]}>
            <Part geometry={geo.caixa} material={mats.seguranca} position={[1.6, 0.9, 0]} rotation={[0, 0, 0.55]} scale={[3.8, 0.45, 0.45]} />
            <Part geometry={geo.caixa} material={mats.seguranca} position={[3.6, 0.6, 0]} rotation={[0, 0, -1.1]} scale={[2.6, 0.38, 0.38]} />
            <Part geometry={geo.caixa} material={mats.grafite} position={[4.2, -0.6, 0]} scale={[0.8, 0.7, 1]} />
          </group>
        </group>
      </ModelSlot>
    </SelectableGroup>
  )
}

function Retroescavadeira({ id }: { id: string }) {
  const { geo, mats } = useAssets()
  return (
    <SelectableGroup id={id} position={POSICOES_FIXAS['RE-01']} rotation={[0, 0.5, 0]}>
      <ModelSlot nome="retroescavadeira">
        <Part geometry={geo.caixa} material={mats.seguranca} position={[0.3, 1.25, 0]} scale={[3.6, 1, 2]} />
        <Part geometry={geo.caixa} material={mats.seguranca} position={[-0.6, 2.4, 0]} scale={[1.5, 1.4, 1.7]} />
        <Part geometry={geo.caixa} material={mats.vidro} position={[0.16, 2.5, 0]} scale={[0.04, 0.9, 1.4]} semContorno />
        {/* Caçamba frontal (abaixada: parada) e braço traseiro */}
        <Part geometry={geo.caixa} material={mats.grafite} position={[2.6, 0.45, 0]} scale={[0.7, 0.8, 2.3]} />
        <Part geometry={geo.caixa} material={mats.seguranca} position={[-2.4, 1.6, 0]} rotation={[0, 0, -0.9]} scale={[2.4, 0.3, 0.35]} />
        <Part geometry={geo.caixa} material={mats.grafite} position={[-3.3, 0.45, 0]} scale={[0.6, 0.7, 0.8]} />
        {(
          [
            [-1, 0.75, 1.15],
            [1.6, 0.5, 1.1],
          ] as const
        ).map(([x, r, z]) =>
          [-1, 1].map((sz) => (
            <mesh key={`${x}${sz}`} geometry={geo.cilindro} material={mats.pneu} position={[x, r, sz * z]} rotation={[Math.PI / 2, 0, 0]} scale={[r * 2, 0.5, r * 2]} castShadow raycast={() => null} />
          )),
        )}
      </ModelSlot>
    </SelectableGroup>
  )
}

/** Elevador de cremalheira: torre acompanha a estrutura; cabine sobe e desce. */
function Elevador({ id }: { id: string }) {
  const { geo, mats } = useAssets()
  const reduced = useReducedMotion()
  const planta = useObraData((d) => d.obra.planta)
  const pos = useMemo(() => posicaoElevador(planta), [planta])
  const torre = useRef<THREE.Mesh>(null)
  const cabine = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const h = Math.max(runtime.alturaEstrutura + 1.5, 2)
    if (torre.current) {
      torre.current.scale.y = h
      torre.current.position.y = h / 2
    }
    if (cabine.current) {
      const curso = Math.max(runtime.alturaEstrutura - 3, 0)
      const f = reduced ? 0 : 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 0.25)
      cabine.current.position.y = 1.2 + curso * f
    }
  })
  return (
    <SelectableGroup id={id} position={pos}>
      <Part ref={torre} geometry={geo.caixa} material={mats.aco} position={[-0.5, 1, 0]} scale={[0.6, 2, 0.6]} />
      <group ref={cabine}>
        <Part geometry={geo.caixa} material={mats.cimento} position={[0.5, 0, 0]} scale={[1.4, 2.2, 1.8]} />
        <Part geometry={geo.caixa} material={mats.seguranca} position={[0.5, 1.15, 0]} scale={[1.5, 0.12, 1.9]} />
      </group>
    </SelectableGroup>
  )
}

export function Machines() {
  const equipamentos = useObraData((d) => d.equipamentos)
  const es = equipamentos.find((e) => e.tipo === 'escavadeira')
  const re = equipamentos.find((e) => e.tipo === 'retroescavadeira')
  const el = equipamentos.find((e) => e.tipo === 'elevador')
  return (
    <group>
      {es && <Escavadeira id={es.id} />}
      {re && <Retroescavadeira id={re.id} />}
      {el && <Elevador id={el.id} />}
    </group>
  )
}
