import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { pinRegistry } from './pinRegistry'

/** Projeta as âncoras 3D dos pins para coordenadas de tela a cada frame. */
export function PinProjector() {
  const size = useThree((s) => s.size)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    pinRegistry.forEach(({ el, pos }) => {
      v.copy(pos).project(camera)
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      const fora = v.z > 1 || x < -40 || y < -40 || x > size.width + 40 || y > size.height + 40
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      el.style.visibility = fora ? 'hidden' : 'visible'
    })
  })
  return null
}
