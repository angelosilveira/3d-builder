import type * as THREE from 'three'
import type { Stage } from './city-kit.js'

export const ISP_STATUS: Record<'online' | 'offline' | 'instalando' | 'lento', string>
export const ISP: {
  tower(o?: { h?: number; base?: number; top?: number }): THREE.Group
  pole(o?: { h?: number; cto?: boolean }): THREE.Group
  cable(a: THREE.Vector3, b: THREE.Vector3, o?: { sag?: number; radius?: number; color?: string }): { mesh: THREE.Mesh; curve: THREE.Curve<THREE.Vector3> }
  pulses(stage: Stage, curvas: THREE.Curve<THREE.Vector3>[], o?: { color?: string; perCurve?: number; speed?: number; size?: number }): THREE.InstancedMesh
  coverage(stage: Stage, centro: THREE.Vector3, o?: { radius?: number; color?: string; waves?: number; period?: number }): THREE.Group
  pop(o?: { w?: number; d?: number; h?: number }): THREE.Group
}
export const Obra: {
  lot(o?: { w?: number; d?: number; status?: string; label?: string }): THREE.Group
}
