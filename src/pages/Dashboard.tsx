import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Stat } from '../components/ui/Stat'
import { StatusBadge } from '../components/ui/StatusBadge'
import { BUILDING_TYPE_LABEL, OWNER_LABEL, STAGE_COLOR } from '../lib/catalog'
import { costSummary } from '../lib/estimates'
import { fmt, fmtDate, fmtMoney, fmtPct } from '../lib/format'
import { overallProgress, plannedProgress, scheduleStatus } from '../lib/progress'
import { useProjects } from '../store/projects'
import type { OwnerKind } from '../types'

const BuildingScene = lazy(() =>
  import('../components/viewer/BuildingScene').then((m) => ({ default: m.BuildingScene })),
)

type Filter = 'todas' | OwnerKind

export function Dashboard() {
  const projects = useProjects((s) => s.projects)
  const resetDemo = useProjects((s) => s.resetDemo)
  const [filter, setFilter] = useState<Filter>('todas')
  const [focusId, setFocusId] = useState<string>()

  const visible = useMemo(
    () => projects.filter((p) => filter === 'todas' || p.owner === filter),
    [projects, filter],
  )
  const focus = visible.find((p) => p.id === focusId) ?? visible[0]

  const summary = useMemo(() => {
    const costs = visible.map(costSummary)
    const avg = visible.length ? visible.reduce((s, p) => s + overallProgress(p.stages), 0) / visible.length : 0
    return {
      avg,
      late: visible.filter((p) => scheduleStatus(p) === 'atrasada').length,
      builtArea: costs.reduce((s, c) => s + c.quantities.builtArea, 0),
      planned: costs.reduce((s, c) => s + c.plannedTotal, 0),
      used: costs.reduce((s, c) => s + c.usedTotal, 0),
    }
  }, [visible])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Obras</h1>
          <p className="muted">Acompanhe todas as obras em andamento em um só lugar.</p>
        </div>
        <div className="row gap">
          <div className="segmented" role="tablist" aria-label="Filtrar por gestor">
            {(['todas', 'prefeitura', 'construtora'] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f === 'todas' ? 'Todas' : OWNER_LABEL[f]}
              </button>
            ))}
          </div>
          <Link className="btn btn-primary" to="/obras/nova">
            + Nova obra
          </Link>
        </div>
      </div>

      <div className="stats">
        <Stat label="Obras" value={visible.length} hint={`${summary.late} atrasada(s)`} tone={summary.late ? 'warn' : undefined} />
        <Stat label="Progresso médio" value={fmtPct(summary.avg)} />
        <Stat label="Área construída" value={`${fmt(summary.builtArea)} m²`} />
        <Stat label="Orçado (estimativa)" value={fmtMoney(summary.planned)} hint={`Realizado: ${fmtMoney(summary.used)}`} />
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <p>Nenhuma obra cadastrada{filter !== 'todas' ? ` para ${OWNER_LABEL[filter]}` : ''}.</p>
          <div className="row gap center">
            <Link className="btn btn-primary" to="/obras/nova">
              Cadastrar obra
            </Link>
            <button className="btn" onClick={resetDemo}>
              Carregar exemplos
            </button>
          </div>
        </div>
      ) : (
        <div className="dashboard-grid">
          <div className="project-list">
            {visible.map((p) => {
              const progress = overallProgress(p.stages)
              return (
                <article
                  key={p.id}
                  className={`project-card${focus?.id === p.id ? ' focused' : ''}`}
                  onMouseEnter={() => setFocusId(p.id)}
                  onFocus={() => setFocusId(p.id)}
                >
                  <Link to={`/obras/${p.id}`} className="card-link">
                    <div className="row between">
                      <span className={`tag tag-${p.owner}`}>{OWNER_LABEL[p.owner]}</span>
                      <StatusBadge status={scheduleStatus(p)} />
                    </div>
                    <h3>{p.name}</h3>
                    <p className="muted small">
                      {BUILDING_TYPE_LABEL[p.type]}
                      {p.type === 'predio' && ` · ${p.floors} pav. · ${p.units} un./andar`}
                      {p.type === 'condominio' && ` · ${p.units} casas`} · {p.client}
                    </p>
                    <div className="row between small">
                      <span>{fmtPct(progress)} concluído</span>
                      <span className="muted">Previsto: {fmtPct(plannedProgress(p))}</span>
                    </div>
                    <ProgressBar value={progress} planned={plannedProgress(p)} />
                    <div className="stage-strip" aria-label="Etapas">
                      {p.stages.map((s) => (
                        <span key={s.id} title={`${s.name}: ${fmtPct(s.progress)}`} style={{ flex: s.weight }}>
                          <i style={{ width: `${s.progress}%`, background: STAGE_COLOR[s.id] }} />
                        </span>
                      ))}
                    </div>
                    <p className="muted small">
                      {fmtDate(p.startDate)} → {fmtDate(p.endDate)}
                    </p>
                  </Link>
                </article>
              )
            })}
          </div>

          {focus && (
            <aside className="preview">
              <div className="preview-canvas">
                <Suspense fallback={<div className="loading">Carregando 3D…</div>}>
                  <BuildingScene key={focus.id} project={focus} autoRotate interactive={false} />
                </Suspense>
              </div>
              <div className="preview-info">
                <div>
                  <strong>{focus.name}</strong>
                  <p className="muted small">{focus.address}</p>
                </div>
                <Link className="btn btn-primary" to={`/obras/${focus.id}`}>
                  Abrir obra
                </Link>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
