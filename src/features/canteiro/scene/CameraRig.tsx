import { CameraControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import type CameraControlsImpl from 'camera-controls'
import { useObraDataStore } from '../data/store'
import { useCanteiroStore } from '../state/canteiroStore'
import { useReducedMotion } from '../state/useReducedMotion'
import { ancoraDe, CENTRO_PREDIO } from './layout'

/** Ângulos isométricos clássicos: azimute 45°, elevação ~35° (polar ~55°). */
const AZIMUTE = Math.PI / 4
const POLAR = 0.96
const RAIO = 160

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null)
  const reduced = useReducedMotion()
  const size = useThree((s) => s.size)
  const obraId = useCanteiroStore((s) => s.obraId)
  const comando = useCanteiroStore((s) => s.comando)
  const selecionadoId = useCanteiroStore((s) => s.selecionadoId)

  // No celular a cena tem menos HUD por cima: enquadra mais justo.
  const zoomInicial = Math.max(3.2, size.width > 820 ? Math.min(size.width / 100, size.height / 86) : Math.min(size.width / 74, size.height / 60))
  const suave = !reduced
  const camera = useThree((s) => s.camera)

  // Desloca o "centro" da vista para a área livre entre os painéis do HUD
  // (à esquerda do card de detalhe). No celular o HUD não cobre a cena.
  useEffect(() => {
    const desktop = size.width > 820
    const dx = desktop ? Math.min(220, size.width * 0.15) : 0
    // Positivo sobe o conteúdo: tira o prédio de trás da tabela e do cronograma.
    const dy = desktop ? Math.min(90, size.height * 0.1) : 0
    camera.setViewOffset(size.width, size.height, dx, dy, size.width, size.height)
    camera.updateProjectionMatrix()
    return () => {
      camera.clearViewOffset()
    }
  }, [camera, size.width, size.height])

  const recentralizar = useCallback(
    (transicao: boolean) => {
      const c = ref.current
      if (!c) return
      const [tx, , tz] = CENTRO_PREDIO
      const ty = 9
      const x = tx + RAIO * Math.sin(POLAR) * Math.sin(AZIMUTE)
      const y = ty + RAIO * Math.cos(POLAR)
      const z = tz + RAIO * Math.sin(POLAR) * Math.cos(AZIMUTE)
      void c.setLookAt(x, y, z, tx + 2, ty, tz + 4, transicao)
      void c.zoomTo(zoomInicial, transicao)
    },
    [zoomInicial],
  )

  // Enquadramento inicial e ao trocar de obra.
  useEffect(() => {
    recentralizar(false)
  }, [obraId, recentralizar])

  // Comandos dos botões de câmera (cada pedido é processado uma única vez).
  const ultimoComando = useRef(0)
  useEffect(() => {
    const c = ref.current
    if (!c || !comando || comando.n === ultimoComando.current) return
    ultimoComando.current = comando.n
    const zoom = c.camera.zoom
    switch (comando.tipo) {
      case 'zoom_in':
        void c.zoomTo(Math.min(zoom * 1.4, 80), suave)
        break
      case 'zoom_out':
        void c.zoomTo(Math.max(zoom / 1.4, 2), suave)
        break
      case 'girar_esquerda':
        void c.rotate(-Math.PI / 2, 0, suave)
        break
      case 'girar_direita':
        void c.rotate(Math.PI / 2, 0, suave)
        break
      case 'recentralizar':
        recentralizar(suave)
        break
    }
  }, [comando, suave, recentralizar])

  // Voo suave até o objeto selecionado.
  useEffect(() => {
    const c = ref.current
    if (!c || !selecionadoId) return
    const { obraId: id } = useCanteiroStore.getState()
    const data = useObraDataStore.getState().obras[id]
    const alvo = data ? ancoraDe(data, selecionadoId) : null
    if (!alvo) return
    void c.moveTo(alvo[0], alvo[1], alvo[2], suave)
    void c.zoomTo(Math.max(c.camera.zoom, zoomInicial * 1.6), suave)
  }, [selecionadoId, suave, zoomInicial])

  return (
    // Câmera ortográfica criada pelo <Canvas orthographic> (ver CanteiroScene):
    // os controles já nascem ligados a ela.
    <>
      <CameraControls
        ref={ref}
        makeDefault
        smoothTime={reduced ? 0 : 0.55}
        minZoom={2}
        maxZoom={80}
        minPolarAngle={0.35}
        maxPolarAngle={1.25}
        dollyToCursor
      />
    </>
  )
}
