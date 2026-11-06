import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { COR } from './palette'

/**
 * Geometrias e materiais compartilhados por toda a cena. Primitivas
 * unitárias são reaproveitadas e dimensionadas via `scale`; tudo é
 * descartado (dispose) quando o canvas desmonta.
 */
function criarAssets() {
  const geo = {
    caixa: new THREE.BoxGeometry(1, 1, 1),
    cilindro: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    cilindroBaixo: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
    cone: new THREE.ConeGeometry(0.5, 1, 7),
    capsula: new THREE.CapsuleGeometry(0.22, 0.9, 3, 8),
    esfera: new THREE.SphereGeometry(0.5, 10, 8),
    plano: new THREE.PlaneGeometry(1, 1),
    arestasCaixa: new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  }
  const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra })

  const mats = {
    concreto: mat(COR.concreto, { roughness: 1 }),
    entorno: mat(COR.entorno, { roughness: 1 }),
    cimento: mat(COR.cimento),
    asfalto: mat(COR.asfalto, { roughness: 1 }),
    faixa: mat(COR.faixa),
    seguranca: mat(COR.seguranca, { roughness: 0.6 }),
    grafite: mat(COR.grafite, { roughness: 0.6 }),
    aco: mat(COR.aco, { roughness: 0.5, metalness: 0.3 }),
    andaime: mat(COR.andaime, { roughness: 0.6, metalness: 0.2 }),
    pneu: mat(COR.pneu, { roughness: 1 }),
    vidro: mat(COR.vidro, { roughness: 0.2, metalness: 0.2 }),
    branco: mat('#FFFFFF'),
    prancha: mat(COR.prancha),
    forma: mat(COR.forma),
    bloco: mat(COR.bloco),
    vergalhao: mat(COR.vergalhao, { roughness: 0.6, metalness: 0.4 }),
    madeira: mat(COR.madeira),
    copa: mat(COR.copa),
    copaEscura: mat(COR.copaEscura),
    tronco: mat(COR.tronco),
    corpo: mat(COR.corpo),
    terra: mat(COR.terra, { roughness: 1 }),
    instanciado: mat('#FFFFFF'),
    fantasma: new THREE.MeshBasicMaterial({ color: COR.prancha, transparent: true, opacity: 0.05, depthWrite: false }),
    linhaFantasma: new THREE.LineBasicMaterial({ color: COR.prancha, transparent: true, opacity: 0.32 }),
    linhaPrevista: new THREE.LineDashedMaterial({ color: COR.atraso, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.85 }),
    planoCorte: new THREE.MeshBasicMaterial({ color: COR.prancha, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    linhaCorte: new THREE.LineBasicMaterial({ color: COR.prancha, transparent: true, opacity: 0 }),
  }
  return {
    geo,
    mats,
    dispose() {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
  }
}

export type Assets = ReturnType<typeof criarAssets>

const AssetsContext = createContext<Assets | null>(null)

export function AssetsProvider({ children }: { children: ReactNode }) {
  const assets = useMemo(criarAssets, [])
  useEffect(() => () => assets.dispose(), [assets])
  return <AssetsContext.Provider value={assets}>{children}</AssetsContext.Provider>
}

export function useAssets(): Assets {
  const ctx = useContext(AssetsContext)
  if (!ctx) throw new Error('useAssets precisa estar dentro de <AssetsProvider>')
  return ctx
}
