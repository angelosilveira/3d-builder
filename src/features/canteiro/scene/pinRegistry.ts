import * as THREE from 'three'

/**
 * Pins de alerta são botões HTML (acessíveis por teclado) posicionados sobre
 * o canvas. O HUD registra cada botão e sua âncora 3D aqui; o projetor dentro
 * da cena atualiza o transform a cada frame, sem passar pelo React.
 */
export interface PinRegistrado {
  el: HTMLElement
  pos: THREE.Vector3
}

export const pinRegistry = new Map<string, PinRegistrado>()

export function registrarPin(id: string, el: HTMLElement | null, pos: [number, number, number]) {
  if (el) pinRegistry.set(id, { el, pos: new THREE.Vector3(...pos) })
  else pinRegistry.delete(id)
}
