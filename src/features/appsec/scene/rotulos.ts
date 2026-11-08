import * as THREE from 'three'

/**
 * Elementos HTML ancorados em pontos 3D (rótulos de área/projeto e pins).
 * O HUD registra; o projetor da cena atualiza o transform a cada frame e
 * aplica o zoom semântico (cada rótulo aparece só numa faixa de zoom).
 */
export interface Ancorado {
  el: HTMLElement
  pos: THREE.Vector3
  zoomMin: number
  zoomMax: number
}

export const ancorados = new Map<string, Ancorado>()

export function registrarAncora(
  id: string,
  el: HTMLElement | null,
  pos: [number, number, number],
  zoomMin = 0,
  zoomMax = Infinity,
) {
  if (el) ancorados.set(id, { el, pos: new THREE.Vector3(...pos), zoomMin, zoomMax })
  else ancorados.delete(id)
}

/** Zoom (px por metro) a partir do qual os nomes dos projetos aparecem. */
export const ZOOM_PROJETOS = 9
