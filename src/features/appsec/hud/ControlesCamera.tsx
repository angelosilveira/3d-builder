import { useAppSecUi, type ComandoCamera } from '../state/uiStore'
import { BotaoRede } from './Rede'

const BOTOES: { tipo: ComandoCamera; rotulo: string; icone: string }[] = [
  { tipo: 'zoom_in', rotulo: 'Aproximar', icone: 'M12 6v12M6 12h12' },
  { tipo: 'zoom_out', rotulo: 'Afastar', icone: 'M6 12h12' },
  { tipo: 'girar_esquerda', rotulo: 'Girar 90° para a esquerda', icone: 'M9 5 5 9l4 4M5 9h9a5 5 0 0 1 0 10h-3' },
  { tipo: 'girar_direita', rotulo: 'Girar 90° para a direita', icone: 'M15 5l4 4-4 4M19 9h-9a5 5 0 0 0 0 10h3' },
  { tipo: 'recentralizar', rotulo: 'Ver o mapa inteiro', icone: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' },
]

export function ControlesCamera() {
  const comandar = useAppSecUi((s) => s.comandar)
  return (
    <div className="aps-panel aps-camera" role="toolbar" aria-label="Controles da câmera">
      {BOTOES.map((b) => (
        <button key={b.tipo} type="button" className="aps-icon-btn" aria-label={b.rotulo} title={b.rotulo} onClick={() => comandar(b.tipo)}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path d={b.icone} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
      <span className="aps-camera-sep" aria-hidden />
      <BotaoRede />
    </div>
  )
}
