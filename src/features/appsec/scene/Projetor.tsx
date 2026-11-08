import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { ancorados } from './rotulos'

/** Projeta rótulos e pins HTML para a tela, sem passar pelo React. */
export function Projetor() {
  const size = useThree((s) => s.size)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const zoom = (camera as THREE.OrthographicCamera).zoom
    ancorados.forEach(({ el, pos, zoomMin, zoomMax }) => {
      v.copy(pos).project(camera)
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      const visivel = zoom >= zoomMin && zoom < zoomMax && x > -80 && y > -40 && x < size.width + 80 && y < size.height + 40
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      if (el.dataset.visivel !== String(visivel)) {
        el.dataset.visivel = String(visivel)
        el.style.visibility = visivel ? 'visible' : 'hidden'
      }
    })
  })
  return null
}
