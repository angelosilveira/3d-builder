import { CameraControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type CameraControlsImpl from 'camera-controls'
import { useCallback, useEffect, useRef } from 'react'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { useAppSecData } from '../data/store'
import type { Selecao } from '../data/types'
import { useAppSecUi, type Regiao } from '../state/uiStore'
import { PLACA_H } from './Ecossistema'

const AZIMUTE = Math.PI / 4
const POLAR = 0.86
const RAIO = 260

/** Largura/altura ocupadas pelo HUD no desktop (painel de filtros, card e tabela). */
function areaLivre(w: number, h: number) {
  if (w <= 900) return { w, h, dx: 0, dy: 0 }
  return { w: w - 286 - 420 - 56, h: h - 92 - 92 - 268 - 48, dx: (420 - 286) / 2, dy: 36 }
}

/**
 * Extensão na tela (em metros) de uma região do mapa vista pela câmera:
 * projeta os 8 cantos da caixa (chão até a altura dos marcadores) nos eixos
 * "direita" e "cima" da câmera ortográfica naquele azimute/ângulo polar.
 */
export function projecao(r: Regiao, azimute: number, polar = POLAR, altura = 2.5) {
  // Direção do alvo para a câmera (eixo z da câmera).
  const d = [Math.sin(polar) * Math.sin(azimute), Math.cos(polar), Math.sin(polar) * Math.cos(azimute)]
  // direita só depende do azimute (vale também olhando de cima); cima = d × direita
  const dir = [Math.cos(azimute), 0, -Math.sin(azimute)]
  const cima = [d[1] * dir[2] - d[2] * dir[1], d[2] * dir[0] - d[0] * dir[2], d[0] * dir[1] - d[1] * dir[0]]
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      for (const y of [0, altura]) {
        const p = [r.x + (sx * r.w) / 2, y, r.z + (sz * r.d) / 2]
        const px = p[0] * dir[0] + p[1] * dir[1] + p[2] * dir[2]
        const py = p[0] * cima[0] + p[1] * cima[1] + p[2] * cima[2]
        x0 = Math.min(x0, px)
        x1 = Math.max(x1, px)
        y0 = Math.min(y0, py)
        y1 = Math.max(y1, py)
      }
  return { w: x1 - x0, h: y1 - y0 }
}

function regiaoDaSelecao(sel: Selecao): Regiao | null {
  const { data, layout, indice } = useAppSecData.getState()
  const doAtivo = (id: string | undefined): Regiao | null => {
    const i = id ? indice.posAtivo.get(id) : undefined
    return i === undefined ? null : { x: layout.pos[i * 2], z: layout.pos[i * 2 + 1], w: 9, d: 9 }
  }
  switch (sel.tipo) {
    case 'ativo':
      return doAtivo(sel.id)
    case 'vulnerabilidade':
      return doAtivo(data.vulnerabilidades.find((v) => v.id === sel.id)?.ativoId)
    case 'pendencia':
      return doAtivo(data.pendencias.find((p) => p.id === sel.id)?.ativoId)
    case 'projeto': {
      const p = layout.projetoPorId.get(sel.id)
      return p ? { x: p.x, z: p.z, w: p.w + 4, d: p.d + 4 } : null
    }
    case 'analista': {
      const ativos = indice.ativosPorAnalista.get(sel.id) ?? []
      if (!ativos.length) return null
      let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity]
      for (const a of ativos) {
        const i = indice.posAtivo.get(a.id)!
        x0 = Math.min(x0, layout.pos[i * 2])
        x1 = Math.max(x1, layout.pos[i * 2])
        z0 = Math.min(z0, layout.pos[i * 2 + 1])
        z1 = Math.max(z1, layout.pos[i * 2 + 1])
      }
      return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0 + 6, d: z1 - z0 + 6 }
    }
  }
}

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null)
  const reduced = useReducedMotion()
  const suave = !reduced
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  const layout = useAppSecData((s) => s.layout)
  const comando = useAppSecUi((s) => s.comando)
  const selecao = useAppSecUi((s) => s.selecao)

  const livre = areaLivre(size.width, size.height)
  const zoomPara = useCallback(
    (r: Regiao) => {
      const c = ref.current
      const pr = projecao(r, c?.azimuthAngle ?? AZIMUTE, c?.polarAngle ?? POLAR)
      // 0,92: folga para os rótulos das áreas não encostarem nos painéis.
      return Math.min(60, Math.max(1.5, Math.min(livre.w / pr.w, livre.h / pr.h) * 0.92))
    },
    [livre.w, livre.h],
  )

  // O "centro" da vista fica na área livre entre os painéis.
  useEffect(() => {
    camera.setViewOffset(size.width, size.height, livre.dx, livre.dy, size.width, size.height)
    camera.updateProjectionMatrix()
    return () => camera.clearViewOffset()
  }, [camera, size.width, size.height, livre.dx, livre.dy])

  const enquadrar = useCallback(
    (r: Regiao, transicao: boolean) => {
      const c = ref.current
      if (!c) return
      void c.moveTo(r.x, PLACA_H, r.z, transicao)
      void c.zoomTo(zoomPara(r), transicao)
    },
    [zoomPara],
  )

  const visaoGeral = useCallback(
    (transicao: boolean) => {
      const c = ref.current
      if (!c) return
      const x = RAIO * Math.sin(POLAR) * Math.sin(AZIMUTE)
      const y = RAIO * Math.cos(POLAR)
      const z = RAIO * Math.sin(POLAR) * Math.cos(AZIMUTE)
      void c.setLookAt(x, y, z, 0, 0, 0, transicao)
      const pr = projecao({ x: 0, z: 0, w: layout.largura, d: layout.profundidade }, AZIMUTE, POLAR)
      void c.zoomTo(Math.min(60, Math.max(1.5, Math.min(livre.w / pr.w, (livre.h - 40) / pr.h) * 0.92)), transicao)
    },
    [layout, livre.w, livre.h],
  )

  useEffect(() => {
    visaoGeral(false)
  }, [visaoGeral])

  const ultimo = useRef(0)
  useEffect(() => {
    const c = ref.current
    if (!c || !comando || comando.n === ultimo.current) return
    ultimo.current = comando.n
    switch (comando.tipo) {
      case 'zoom_in':
        void c.zoomTo(Math.min(c.camera.zoom * 1.5, 60), suave)
        break
      case 'zoom_out':
        void c.zoomTo(Math.max(c.camera.zoom / 1.5, 1.5), suave)
        break
      case 'girar_esquerda':
        void c.rotate(-Math.PI / 2, 0, suave)
        break
      case 'girar_direita':
        void c.rotate(Math.PI / 2, 0, suave)
        break
      case 'recentralizar':
        visaoGeral(suave)
        break
      case 'enquadrar':
        if (comando.regiao) enquadrar(comando.regiao, suave)
        break
    }
  }, [comando, suave, visaoGeral, enquadrar])

  // Voo até o que foi selecionado (ativo, projeto, analista…).
  useEffect(() => {
    if (!selecao) return
    const r = regiaoDaSelecao(selecao)
    if (r) enquadrar(r, suave)
  }, [selecao, enquadrar, suave])

  return (
    // A câmera ortográfica é criada pelo próprio <Canvas orthographic>: assim os
    // controles já nascem ligados a ela (com <OrthographicCamera makeDefault> eles
    // podiam se prender à câmera em perspectiva inicial).
    <>
      <CameraControls
        ref={ref}
        makeDefault
        smoothTime={reduced ? 0 : 0.5}
        minZoom={1.5}
        maxZoom={60}
        minPolarAngle={0.2}
        maxPolarAngle={1.2}
        dollyToCursor
      />
    </>
  )
}
