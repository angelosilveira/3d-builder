import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

interface Props {
  position: [number, number, number]
  title: string
  value: string
  selected?: boolean
  onClick?: () => void
}

const PX = 2 // densidade para ficar nítido em telas retina
const FONT = 'Inter, system-ui, sans-serif'

/**
 * Rótulo 3D desenhado em um <canvas> e exibido como sprite (sempre voltado
 * para a câmera). Evita criar árvores React/DOM dentro do canvas WebGL.
 */
export function RoomLabel({ position, title, value, selected, onClick }: Props) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const titleFont = `600 ${13 * PX}px ${FONT}`
    const valueFont = `700 ${12 * PX}px ${FONT}`
    ctx.font = titleFont
    const w = Math.ceil(Math.max(ctx.measureText(title).width, 40 * PX) + 18 * PX)
    const h = 40 * PX
    canvas.width = w
    canvas.height = h

    ctx.fillStyle = selected ? 'rgba(180, 83, 9, 0.95)' : 'rgba(15, 23, 42, 0.82)'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 7 * PX)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.font = titleFont
    ctx.fillText(title, w / 2, 13 * PX)
    ctx.fillStyle = '#fcd34d'
    ctx.font = valueFont
    ctx.fillText(value, w / 2, 29 * PX)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return { texture: tex, aspect: w / h }
  }, [title, value, selected])

  useEffect(() => () => texture.dispose(), [texture])

  const height = 0.62
  return (
    <sprite
      position={position}
      scale={[height * aspect, height, 1]}
      renderOrder={10}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onClick?.()
      }}
    >
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  )
}
