import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useObraData } from '../data/store'
import type { Equipamento } from '../data/types'
import { useReducedMotion } from '../state/useReducedMotion'
import { useAssets } from './assets'
import { geometriaPredio, posicaoBomba, poseBetoneira, SLAB } from './layout'
import { ModelSlot } from './ModelSlot'
import { Part, SelectableGroup } from './Selectable'

const RODAS: [number, number][] = [
  [2.6, 1],
  [2.6, -1],
  [-1.4, 1],
  [-1.4, -1],
  [-2.7, 1],
  [-2.7, -1],
]

/** Caminhão betoneira: cabine à frente (+x), tambor girando. Anda até a pose do status. */
function Betoneira({ equipamento, ordem }: { equipamento: Equipamento; ordem: number }) {
  const { geo, mats } = useAssets()
  const reduced = useReducedMotion()
  const planta = useObraData((d) => d.obra.planta)
  const grupo = useRef<THREE.Group>(null)
  const tambor = useRef<THREE.Group>(null)
  const pose = poseBetoneira(planta, equipamento.status, ordem)
  const alvo = useRef(pose)
  alvo.current = pose
  const iniciado = useRef(false)

  useFrame((_, delta) => {
    const g = grupo.current
    if (!g) return
    const { pos, rot, visivel } = alvo.current
    if (!iniciado.current || reduced) {
      g.position.set(...pos)
      g.rotation.y = rot
      iniciado.current = true
    } else {
      // Deslocamento suave quando a fila anda.
      g.position.x = THREE.MathUtils.damp(g.position.x, pos[0], 1.2, delta)
      g.position.z = THREE.MathUtils.damp(g.position.z, pos[2], 1.2, delta)
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, rot, 1.5, delta)
    }
    // Some só quando chega ao destino de saída (caminhão liberado).
    g.visible = visivel || Math.hypot(g.position.x - pos[0], g.position.z - pos[2]) > 2
    // Tambor gira sempre (mistura); mais rápido ao descarregar.
    if (tambor.current && !reduced) tambor.current.rotation.x += delta * (equipamento.status === 'descarregando' ? 2.4 : 0.9)
  })

  return (
    <SelectableGroup id={equipamento.id} ref={grupo}>
      <ModelSlot nome="betoneira">
        <Part geometry={geo.caixa} material={mats.grafite} position={[0, 0.85, 0]} scale={[7.6, 0.45, 2.1]} />
        <Part geometry={geo.caixa} material={mats.seguranca} position={[3, 1.85, 0]} scale={[1.7, 1.9, 2.3]} />
        <Part geometry={geo.caixa} material={mats.vidro} position={[3.86, 2.2, 0]} scale={[0.04, 0.8, 1.9]} semContorno />
        {/* Tambor inclinado (traseira mais alta) */}
        <group position={[-0.9, 2.45, 0]} rotation={[0, 0, 0.16]}>
          <group ref={tambor} rotation={[0, 0, Math.PI / 2]}>
            <Part geometry={geo.cilindro} material={mats.cimento} scale={[2.1, 4.6, 2.1]} />
            <Part geometry={geo.cilindro} material={mats.seguranca} scale={[2.16, 0.5, 2.16]} position={[0, 0.9, 0]} />
            <Part geometry={geo.cone} material={mats.cimento} position={[0, -2.9, 0]} rotation={[Math.PI, 0, 0]} scale={[2.1, 1.2, 2.1]} />
          </group>
        </group>
        {/* Bica de descarga */}
        <Part geometry={geo.caixa} material={mats.aco} position={[-3.9, 1.7, 0]} rotation={[0, 0, -0.5]} scale={[1.3, 0.12, 0.5]} />
        {RODAS.map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={geo.cilindro} material={mats.pneu} position={[x, 0.5, z]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.45, 1]} castShadow raycast={() => null} />
        ))}
      </ModelSlot>
    </SelectableGroup>
  )
}

/** Segmento de lança entre dois pontos (caixa orientada). */
function Segmento({ de, ate, espessura }: { de: THREE.Vector3; ate: THREE.Vector3; espessura: number }) {
  const { geo, mats } = useAssets()
  const { pos, quat, comp } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(ate, de)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
    return { pos: new THREE.Vector3().addVectors(de, ate).multiplyScalar(0.5), quat: q, comp: dir.length() }
  }, [de, ate])
  return <Part geometry={geo.caixa} material={mats.seguranca} position={pos} quaternion={quat} scale={[espessura, comp, espessura]} />
}

/** Caminhão-bomba com lança articulada alcançando a laje em concretagem. */
function Bomba({ equipamento }: { equipamento: Equipamento }) {
  const { geo, mats } = useAssets()
  const planta = useObraData((d) => d.obra.planta)
  const pavHoje = useObraData((d) => d.concretagens.find((c) => c.status === 'em_andamento')?.pavimentoNumero ?? 1)
  const base = useMemo(() => posicaoBomba(planta), [planta])
  const { b, k1, k2, ponta, yLaje } = useMemo(() => {
    const g = geometriaPredio(planta)
    const yLaje = pavHoje * planta.peDireito + SLAB / 2
    const b = new THREE.Vector3(0, 3.4, 0)
    // A ponta alcança o meio da laje; a lança sobe e se dobra em dois joelhos.
    const ponta = new THREE.Vector3(g.cx + 2 - base[0], yLaje + 3.2, g.cz + 1 - base[2])
    const k1 = new THREE.Vector3().lerpVectors(b, ponta, 0.18).setY(ponta.y + 6)
    const k2 = new THREE.Vector3().lerpVectors(k1, ponta, 0.55).setY(ponta.y + 4.5)
    return { b, k1, k2, ponta, yLaje }
  }, [planta, pavHoje, base])
  const mangueira = ponta.y - yLaje - 0.2

  return (
    <SelectableGroup id={equipamento.id} position={base}>
      <ModelSlot nome="bomba">
        <Part geometry={geo.caixa} material={mats.grafite} position={[0, 0.9, 0]} scale={[8.5, 0.5, 2.3]} />
        <Part geometry={geo.caixa} material={mats.seguranca} position={[3.6, 1.9, 0]} scale={[1.6, 1.9, 2.3]} />
        <Part geometry={geo.caixa} material={mats.branco} position={[-0.6, 1.7, 0]} scale={[5.2, 1.2, 2.1]} />
        <Part geometry={geo.caixa} material={mats.cimento} position={[-4.4, 1.3, 0]} scale={[1.2, 1, 1.6]} />
        <Part geometry={geo.cilindro} material={mats.seguranca} position={[0, 2.8, 0]} scale={[1.4, 1, 1.4]} />
        {/* Patolas */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} geometry={geo.caixa} material={mats.aco} position={[sx * 2.8, 0.35, sz * 2.4]} scale={[0.3, 0.7, 1.4]} castShadow raycast={() => null} />
          )),
        )}
        <Segmento de={b} ate={k1} espessura={0.55} />
        <Segmento de={k1} ate={k2} espessura={0.45} />
        <Segmento de={k2} ate={ponta} espessura={0.38} />
        <mesh geometry={geo.cilindroBaixo} material={mats.grafite} position={[ponta.x, ponta.y - mangueira / 2, ponta.z]} scale={[0.22, mangueira, 0.22]} raycast={() => null} />
      </ModelSlot>
    </SelectableGroup>
  )
}

export function Vehicles() {
  const equipamentos = useObraData((d) => d.equipamentos)
  const betoneiras = equipamentos.filter((e) => e.tipo === 'betoneira')
  const bomba = equipamentos.find((e) => e.tipo === 'bomba')
  return (
    <group>
      {bomba && <Bomba equipamento={bomba} />}
      {betoneiras.map((b) => (
        <Betoneira key={b.id} equipamento={b} ordem={betoneiras.filter((x) => x.status === b.status).indexOf(b)} />
      ))}
    </group>
  )
}
