import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { lazy, Suspense } from 'react'
import { SceneErrorBoundary } from '../../shared/components/SceneErrorBoundary'
import { ControlesCamera } from './hud/ControlesCamera'
import { DataTabs } from './hud/DataTabs'
import { DetailCard } from './hud/DetailCard'
import { Filtros } from './hud/Filtros'
import { Flutuantes, Toasts } from './hud/Gamificacao'
import { KpiRow } from './hud/KpiRow'
import { Rotulos } from './hud/Rotulos'
import { Tooltip } from './hud/Tooltip'
import { TopBar } from './hud/TopBar'
import './appsec.css'

const AppSecScene = lazy(() => import('./scene/AppSecScene'))

/**
 * Mapa 3D da qualificação de AppSec: 3.000+ ativos agrupados por área e
 * projeto, com filtros, card de detalhe e listas sincronizados com a cena.
 * Camadas: data/ (tipos, mock, derivados, layout) → state/ → scene/ (R3F) e hud/ (React).
 */
export default function AppSecPage() {
  return (
    <div className="aps">
      <TopBar />
      <main className="aps-scene" aria-label="Mapa 3D dos ativos">
        <SceneErrorBoundary prefixo="aps">
          <Suspense fallback={<div className="aps-scene-loading">Montando o mapa de ativos…</div>}>
            <AppSecScene />
          </Suspense>
        </SceneErrorBoundary>
        <Rotulos />
        <Flutuantes />
        <ControlesCamera />
      </main>
      <div className="aps-hud">
        <KpiRow />
        <Filtros />
        <DetailCard />
        <DataTabs />
      </div>
      <Tooltip />
      <Toasts />
    </div>
  )
}
