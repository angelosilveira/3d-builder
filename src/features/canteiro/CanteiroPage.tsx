import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { lazy, Suspense } from 'react'
import { useSimulacaoAoVivo } from './data/store'
import { CameraControlsPanel } from './hud/CameraControlsPanel'
import { DataTabs } from './hud/DataTabs'
import { DetailCard } from './hud/DetailCard'
import { KpiRow } from './hud/KpiRow'
import { PinsLayer } from './hud/Pins'
import { SceneErrorBoundary } from './hud/SceneErrorBoundary'
import { Schedule4D } from './hud/Schedule4D'
import { TopBar } from './hud/TopBar'
import { TrackingTimeline } from './hud/TrackingTimeline'
import './canteiro.css'

const CanteiroScene = lazy(() => import('./scene/CanteiroScene'))

/**
 * Gêmeo digital do canteiro: cena 3D em tela cheia + HUD.
 * Camadas: dados (data/) → estado de UI (state/) → cena R3F (scene/) e HUD React (hud/).
 */
export default function CanteiroPage() {
  useSimulacaoAoVivo()
  return (
    <div className="cnt">
      <TopBar />
      <main className="cnt-scene" aria-label="Canteiro de obras em 3D">
        <SceneErrorBoundary>
          <Suspense fallback={<div className="cnt-scene-loading">Montando o canteiro…</div>}>
            <CanteiroScene />
          </Suspense>
        </SceneErrorBoundary>
        <PinsLayer />
        <CameraControlsPanel />
      </main>
      <div className="cnt-hud">
        <KpiRow />
        <DetailCard />
        <TrackingTimeline />
        <DataTabs />
        <Schedule4D />
      </div>
    </div>
  )
}
