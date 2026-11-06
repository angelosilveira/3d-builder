import { lazy, Suspense } from 'react'
import { BrowserRouter, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'

// As telas com 3D/pdf.js são carregadas sob demanda.
const ProjectPage = lazy(() => import('./pages/ProjectPage'))
const NewProjectWizard = lazy(() => import('./pages/NewProjectWizard'))
const CanteiroPage = lazy(() => import('./features/canteiro/CanteiroPage'))

function Shell() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden>▲</span>
          Obra<b>3D</b>
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Obras
          </NavLink>
          <NavLink to="/obras/nova">Nova obra</NavLink>
          <NavLink to="/canteiro">Canteiro ao vivo</NavLink>
        </nav>
      </header>
      <main className="content">
        <Suspense fallback={<div className="loading">Carregando…</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Gêmeo digital do canteiro: tela cheia, com HUD próprio. */}
        <Route
          path="/canteiro"
          element={
            <Suspense fallback={<div className="loading">Carregando canteiro…</div>}>
              <CanteiroPage />
            </Suspense>
          }
        />
        <Route element={<Shell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/obras/nova" element={<NewProjectWizard />} />
          <Route path="/obras/:id" element={<ProjectPage />} />
          <Route path="*" element={<div className="empty">Página não encontrada.</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
