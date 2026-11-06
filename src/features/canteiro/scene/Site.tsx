import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useObraData } from '../data/store'
import { useAssets } from './assets'
import { AREAS, CANTEIRO, PORTAO, POSICOES_FIXAS, RUA } from './layout'
import { COR } from './palette'

const PX_POR_METRO = 36

interface DecalProps {
  x: number
  z: number
  w: number
  d: number
  rotulo?: string
  borda?: 'tracejada' | 'continua'
  hachura?: string
  corBorda?: string
}

/** Marcação pintada no piso (borda, hachura e rótulo) desenhada em canvas. */
function Decal({ x, z, w, d, rotulo, borda = 'tracejada', hachura, corBorda = COR.grafite }: DecalProps) {
  const { geo } = useAssets()
  const { textura, desenhar } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * PX_POR_METRO)
    canvas.height = Math.round(d * PX_POR_METRO)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    const desenhar = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)
      if (hachura) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, W, H)
        ctx.clip()
        ctx.strokeStyle = hachura
        ctx.globalAlpha = 0.55
        ctx.lineWidth = 0.35 * PX_POR_METRO
        for (let i = -H; i < W + H; i += PX_POR_METRO * 1.1) {
          ctx.beginPath()
          ctx.moveTo(i, H)
          ctx.lineTo(i + H, 0)
          ctx.stroke()
        }
        ctx.restore()
      }
      ctx.globalAlpha = 0.75
      ctx.strokeStyle = corBorda
      ctx.lineWidth = 0.14 * PX_POR_METRO
      ctx.setLineDash(borda === 'tracejada' ? [0.8 * PX_POR_METRO, 0.5 * PX_POR_METRO] : [])
      ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, W - ctx.lineWidth * 2, H - ctx.lineWidth * 2)
      if (rotulo) {
        ctx.globalAlpha = 0.8
        ctx.setLineDash([])
        ctx.fillStyle = COR.grafite
        ctx.font = `600 ${0.62 * PX_POR_METRO}px Barlow, "Arial Narrow", sans-serif`
        ctx.textBaseline = 'top'
        ctx.fillText(rotulo.toUpperCase(), 0.45 * PX_POR_METRO, 0.4 * PX_POR_METRO)
      }
      tex.needsUpdate = true
    }
    return { textura: tex, desenhar }
  }, [w, d, rotulo, borda, hachura, corBorda])

  useLayoutEffect(() => {
    desenhar()
    // Redesenha quando a fonte do HUD terminar de carregar.
    let ativo = true
    document.fonts?.ready.then(() => ativo && desenhar())
    return () => {
      ativo = false
    }
  }, [desenhar])
  useEffect(() => () => textura.dispose(), [textura])

  return (
    <mesh geometry={geo.plano} position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[w, d, 1]} receiveShadow raycast={() => null}>
      <meshBasicMaterial map={textura} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** Malha instanciada a partir de uma lista de matrizes. */
function Instancias({
  geometry,
  material,
  matrizes,
  sombra = true,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  matrizes: THREE.Matrix4[]
  sombra?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    matrizes.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrizes])
  return (
    <instancedMesh
      key={matrizes.length}
      ref={ref}
      args={[geometry, material, matrizes.length]}
      castShadow={sombra}
      receiveShadow
      raycast={() => null}
    />
  )
}

const matriz = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  )

export function Site() {
  const { geo, mats } = useAssets()
  const blocos = useObraData((d) => d.materiais.find((m) => m.id === 'm-bloco')?.quantidade ?? 0)

  const larguraCanteiro = CANTEIRO.maxX - CANTEIRO.minX
  const profCanteiro = CANTEIRO.maxZ - CANTEIRO.minZ
  const cxCanteiro = (CANTEIRO.maxX + CANTEIRO.minX) / 2
  const czCanteiro = (CANTEIRO.maxZ + CANTEIRO.minZ) / 2

  const faixas = useMemo(() => Array.from({ length: 34 }, (_, i) => matriz(-100 + i * 6, 0.006, RUA.z, 2.4, 1, 0.16)), [])

  const arvores = useMemo(() => {
    const pos: [number, number][] = []
    for (let x = -42; x <= 46; x += 8) pos.push([x, RUA.z + 7])
    for (let z = -20; z <= 14; z += 9) pos.push([CANTEIRO.minX - 5, z])
    for (let x = -26; x <= 30; x += 11) pos.push([x, CANTEIRO.minZ - 5])
    return pos
  }, [])
  const troncos = useMemo(() => arvores.map(([x, z]) => matriz(x, 1, z, 0.35, 2, 0.35)), [arvores])
  const copas = useMemo(
    () =>
      arvores.flatMap(([x, z], i) => {
        const s = 2.6 + (i % 3) * 0.5
        return [matriz(x, 2.6 + s * 0.4, z, s, s * 0.9, s), matriz(x + 0.5, 3.6 + s * 0.4, z - 0.3, s * 0.7, s * 0.65, s * 0.7)]
      }),
    [arvores],
  )

  // Paletes: ~300 blocos por palete; estoque baixo = pátio quase vazio.
  const paletes = useMemo(() => {
    const qtd = Math.min(16, Math.ceil(blocos / 300))
    const a = AREAS.estoque
    return Array.from({ length: qtd }, (_, i) => {
      const col = i % 4
      const lin = Math.floor(i / 4)
      return [a.x - a.w / 2 + 2 + col * 2.6, a.z - a.d / 2 + 2 + lin * 2.6] as [number, number]
    })
  }, [blocos])
  const basesPalete = useMemo(() => paletes.map(([x, z]) => matriz(x, 0.08, z, 1.3, 0.16, 1.3)), [paletes])
  const pilhasBloco = useMemo(() => paletes.map(([x, z]) => matriz(x, 0.66, z, 1.2, 1, 1.2)), [paletes])

  const vergalhoes = useMemo(() => {
    const a = AREAS.vergalhao
    const out: THREE.Matrix4[] = []
    for (let pilha = 0; pilha < 3; pilha++) {
      const z0 = a.z - 1.6 + pilha * 1.6
      for (let k = 0; k < 18; k++) {
        const camada = Math.floor(k / 6)
        out.push(matriz(a.x, 0.32 + camada * 0.07, z0 + (k % 6) * 0.08 - 0.2, 0.05, 11, 0.05, 0, Math.PI / 2))
      }
    }
    return out
  }, [])
  const caibros = useMemo(() => {
    const a = AREAS.vergalhao
    return [-4.5, -1.5, 1.5, 4.5].map((dx) => matriz(a.x + dx, 0.13, a.z, 0.25, 0.26, 4.6))
  }, [])

  return (
    <group>
      {/* Entorno, canteiro em concreto e rua */}
      <mesh geometry={geo.plano} material={mats.entorno} position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[420, 420, 1]} receiveShadow raycast={() => null} />
      <mesh geometry={geo.plano} material={mats.concreto} position={[cxCanteiro, -0.01, czCanteiro]} rotation={[-Math.PI / 2, 0, 0]} scale={[larguraCanteiro, profCanteiro, 1]} receiveShadow raycast={() => null} />
      <mesh geometry={geo.plano} material={mats.asfalto} position={[0, -0.005, RUA.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[420, RUA.largura, 1]} receiveShadow raycast={() => null} />
      <Instancias geometry={geo.caixa} material={mats.faixa} matrizes={faixas} sombra={false} />
      {[RUA.z - RUA.largura / 2 - 1, RUA.z + RUA.largura / 2 + 1].map((z) => (
        <mesh key={z} geometry={geo.caixa} material={mats.cimento} position={[0, 0.06, z]} scale={[420, 0.12, 2]} receiveShadow raycast={() => null} />
      ))}
      <mesh geometry={geo.caixa} material={mats.cimento} position={[(PORTAO.minX + PORTAO.maxX) / 2, 0.02, CANTEIRO.maxZ + 0.5]} scale={[PORTAO.maxX - PORTAO.minX, 0.04, 1]} receiveShadow raycast={() => null} />

      {/* Marcações de área */}
      <Decal {...AREAS.estoque} />
      <Decal {...AREAS.vergalhao} />
      <Decal {...AREAS.cargaDescarga} hachura={COR.seguranca} />
      <Decal {...AREAS.escavacao} borda="continua" corBorda={COR.atraso} />
      <Decal x={-9} z={16.6} w={34} d={2.4} rotulo="Circulação de pedestres" borda="continua" />
      <Decal x={-4} z={8.2} w={2.4} d={13.6} borda="continua" />

      {/* Tapumes com faixa da construtora; abertura do portão para a rua */}
      <Tapumes />

      {/* Escavação do reservatório: fundo em terra e bota-fora */}
      <mesh geometry={geo.caixa} material={mats.terra} position={[AREAS.escavacao.x, 0.01, AREAS.escavacao.z]} scale={[AREAS.escavacao.w - 1, 0.02, AREAS.escavacao.d - 1]} receiveShadow raycast={() => null} />
      <mesh geometry={geo.cone} material={mats.terra} position={[30, 1.2, -6]} scale={[6, 2.4, 5]} castShadow receiveShadow raycast={() => null} />
      <mesh geometry={geo.cone} material={mats.terra} position={[27, 0.8, -3.5]} scale={[4, 1.6, 3.5]} castShadow receiveShadow raycast={() => null} />

      {/* Contêiner-escritório e almoxarifado */}
      <group position={POSICOES_FIXAS.container}>
        <mesh geometry={geo.caixa} material={mats.branco} position={[0, 1.3, 0]} scale={[6.1, 2.6, 2.45]} castShadow receiveShadow raycast={() => null} />
        <mesh geometry={geo.caixa} material={mats.prancha} position={[0, 2.35, 0]} scale={[6.14, 0.22, 2.5]} raycast={() => null} />
        {[-1.6, 1.6].map((x) => (
          <mesh key={x} geometry={geo.caixa} material={mats.vidro} position={[x, 1.45, 1.24]} scale={[1.3, 0.8, 0.04]} raycast={() => null} />
        ))}
      </group>
      <mesh geometry={geo.caixa} material={mats.cimento} position={[POSICOES_FIXAS.almoxarifado[0], 1.3, POSICOES_FIXAS.almoxarifado[2]]} scale={[6.1, 2.6, 2.45]} castShadow receiveShadow raycast={() => null} />

      {/* Estoque: paletes de bloco e vergalhões */}
      {paletes.length > 0 && (
        <>
          <Instancias geometry={geo.caixa} material={mats.madeira} matrizes={basesPalete} />
          <Instancias geometry={geo.caixa} material={mats.bloco} matrizes={pilhasBloco} />
        </>
      )}
      <Instancias geometry={geo.caixa} material={mats.madeira} matrizes={caibros} />
      <Instancias geometry={geo.cilindroBaixo} material={mats.vergalhao} matrizes={vergalhoes} />

      {/* Árvores */}
      <Instancias geometry={geo.cilindroBaixo} material={mats.tronco} matrizes={troncos} />
      <Instancias geometry={geo.esfera} material={mats.copa} matrizes={copas} />
    </group>
  )
}

function Tapumes() {
  const { geo, mats } = useAssets()
  const H = 2.2
  const trechos = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = CANTEIRO
    return [
      { x: (minX + maxX) / 2, z: minZ, w: maxX - minX, d: 0.12 },
      { x: minX, z: (minZ + maxZ) / 2, w: 0.12, d: maxZ - minZ },
      { x: maxX, z: (minZ + maxZ) / 2, w: 0.12, d: maxZ - minZ },
      { x: (minX + PORTAO.minX) / 2, z: maxZ, w: PORTAO.minX - minX, d: 0.12 },
      { x: (PORTAO.maxX + maxX) / 2, z: maxZ, w: maxX - PORTAO.maxX, d: 0.12 },
    ]
  }, [])
  return (
    <group>
      {trechos.map((t, i) => (
        <group key={i}>
          <mesh geometry={geo.caixa} material={mats.branco} position={[t.x, H / 2, t.z]} scale={[t.w, H, t.d]} castShadow receiveShadow raycast={() => null} />
          <mesh geometry={geo.caixa} material={mats.prancha} position={[t.x, H - 0.25, t.z]} scale={[t.w + 0.02, 0.22, t.d + 0.02]} raycast={() => null} />
        </group>
      ))}
      {[PORTAO.minX, PORTAO.maxX].map((x) => (
        <mesh key={x} geometry={geo.caixa} material={mats.seguranca} position={[x, H / 2 + 0.2, CANTEIRO.maxZ]} scale={[0.3, H + 0.4, 0.3]} castShadow raycast={() => null} />
      ))}
    </group>
  )
}
