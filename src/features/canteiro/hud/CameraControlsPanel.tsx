import { useCallback } from 'react'
import { useCanteiroStore, type ComandoCamera } from '../state/canteiroStore'

const BOTOES: { tipo: ComandoCamera; rotulo: string; icone: string }[] = [
  { tipo: 'zoom_in', rotulo: 'Aproximar', icone: 'M12 6v12M6 12h12' },
  { tipo: 'zoom_out', rotulo: 'Afastar', icone: 'M6 12h12' },
  { tipo: 'girar_esquerda', rotulo: 'Girar 90° para a esquerda', icone: 'M9 5 5 9l4 4M5 9h9a5 5 0 0 1 0 10h-3' },
  { tipo: 'girar_direita', rotulo: 'Girar 90° para a direita', icone: 'M15 5l4 4-4 4M19 9h-9a5 5 0 0 0 0 10h3' },
  { tipo: 'recentralizar', rotulo: 'Recentralizar a vista do canteiro', icone: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
]

export function CameraControlsPanel() {
  const comandar = useCanteiroStore((s) => s.comandar)
  const onClick = useCallback((tipo: ComandoCamera) => () => comandar(tipo), [comandar])
  return (
    <div className="cnt-panel cnt-camera" role="toolbar" aria-label="Controles da câmera" aria-orientation="horizontal">
      {BOTOES.map((b) => (
        <button key={b.tipo} type="button" className="cnt-icon-btn" aria-label={b.rotulo} title={b.rotulo} onClick={onClick(b.tipo)}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path d={b.icone} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  )
}
