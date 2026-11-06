import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InfoPanel } from '../components/project/InfoPanel'
import { LaborPanel } from '../components/project/LaborPanel'
import { MaterialsPanel } from '../components/project/MaterialsPanel'
import { RoomsPanel } from '../components/project/RoomsPanel'
import { StagesPanel } from '../components/project/StagesPanel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Stat } from '../components/ui/Stat'
import { StatusBadge } from '../components/ui/StatusBadge'
import { BuildingScene } from '../components/viewer/BuildingScene'
import type { ViewMode } from '../components/viewer/UnitModel'
import { BUILDING_TYPE_LABEL, OWNER_LABEL, ROOM_KIND_LABEL, STAGE_COLOR } from '../lib/catalog'
import { costSummary } from '../lib/estimates'
import { fmt, fmtDate, fmtMoney, fmtPct } from '../lib/format'
import { overallProgress, plannedProgress, scheduleStatus, simulateAt } from '../lib/progress'
import { useProject } from '../store/projects'

type Tab = 'etapas' | 'comodos' | 'materiais' | 'mao_de_obra' | 'dados'

const TABS: [Tab, string][] = [
  ['etapas', 'Etapas'],
  ['comodos', 'Cômodos'],
  ['materiais', 'Materiais'],
  ['mao_de_obra', 'Mão de obra'],
  ['dados', 'Dados'],
]

const REPLAY_SECONDS = 7

export default function ProjectPage() {
  const { id } = useParams()
  const project = useProject(id)
  const [tab, setTab] = useState<Tab>('etapas')
  const [mode, setMode] = useState<ViewMode>('obra')
  const [selectedRoomId, setSelectedRoomId] = useState<string>()
  /** null = estado atual; número = instante do replay (0–1). */
  const [replayT, setReplayT] = useState<number | null>(null)
  const [replayKey, setReplayKey] = useState(0)
  const raf = useRef<number>(0)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const playReplay = () => {
    cancelAnimationFrame(raf.current)
    setReplayKey((k) => k + 1)
    const start = performance.now()
    const tick = (now: number) => {
      const t = (now - start) / 1000 / REPLAY_SECONDS
      if (t >= 1) {
        setReplayT(null)
        return
      }
      setReplayT(t)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const shown = useMemo(
    () => (project && replayT !== null ? simulateAt(project, replayT) : project),
    [project, replayT],
  )
  const costs = useMemo(() => (project ? costSummary(project) : undefined), [project])

  if (!project || !shown || !costs) {
    return (
      <div className="empty">
        Obra não encontrada. <Link to="/">Voltar para obras</Link>
      </div>
    )
  }

  const progress = overallProgress(project.stages)
  const planned = plannedProgress(project)
  const selectedRoom = project.rooms.find((r) => r.id === selectedRoomId)
  const status = scheduleStatus(project)

  const selectRoom = (roomId: string | undefined) => {
    setSelectedRoomId(roomId)
    if (roomId) setTab('comodos')
  }

  return (
    <div className="page project-page">
      <div className="page-head">
        <div>
          <Link to="/" className="muted small">
            ← Obras
          </Link>
          <h1>{project.name}</h1>
          <p className="muted">
            <span className={`tag tag-${project.owner}`}>{OWNER_LABEL[project.owner]}</span> {BUILDING_TYPE_LABEL[project.type]}
            {project.type === 'predio' && ` · ${project.floors} pavimentos · ${project.units} apto(s)/andar`}
            {project.type === 'condominio' && ` · ${project.units} casas`}
            {project.client && ` · ${project.client}`}
            {project.address && ` · ${project.address}`}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="stats">
        <Stat
          label="Progresso da obra"
          value={fmtPct(progress)}
          hint={<ProgressBar value={progress} planned={planned} size="sm" />}
          tone={status === 'atrasada' ? 'bad' : status === 'adiantada' || status === 'concluida' ? 'good' : undefined}
        />
        <Stat label="Previsto para hoje" value={fmtPct(planned)} hint={`${fmtDate(project.startDate)} → ${fmtDate(project.endDate)}`} />
        <Stat label="Área construída" value={`${fmt(costs.quantities.builtArea)} m²`} hint={`${project.rooms.length} cômodos por unidade`} />
        <Stat
          label="Custo realizado"
          value={fmtMoney(costs.usedTotal)}
          hint={`de ${fmtMoney(costs.plannedTotal)} estimados`}
          tone={costs.usedTotal > costs.plannedTotal * (progress / 100) * 1.1 ? 'warn' : undefined}
        />
      </div>

      <div className="project-grid">
        <section className="viewer card">
          <div className="viewer-toolbar">
            <div className="segmented">
              <button className={mode === 'obra' ? 'active' : ''} onClick={() => setMode('obra')}>
                Obra
              </button>
              <button className={mode === 'status' ? 'active' : ''} onClick={() => setMode('status')}>
                Status por cômodo
              </button>
            </div>
            <button className="btn" onClick={playReplay} disabled={replayT !== null}>
              {replayT !== null ? `Reproduzindo… ${fmtPct(overallProgress(shown.stages))}` : '▶ Reproduzir evolução'}
            </button>
          </div>

          <div className="viewer-canvas">
            <BuildingScene
              project={shown}
              mode={mode}
              selectedRoomId={selectedRoomId}
              onSelectRoom={selectRoom}
              replayKey={replayKey}
            />

            <div className="legend">
              {mode === 'obra' ? (
                shown.stages.map((s) => (
                  <span key={s.id}>
                    <i style={{ background: STAGE_COLOR[s.id] }} /> {s.name} {fmtPct(s.progress)}
                  </span>
                ))
              ) : (
                <>
                  <span><i style={{ background: '#ef4444' }} /> Não iniciado</span>
                  <span><i style={{ background: '#eab308' }} /> Em andamento</span>
                  <span><i style={{ background: '#22c55e' }} /> Pronto</span>
                </>
              )}
            </div>

            {selectedRoom && (
              <div className="room-popover">
                <div className="row between">
                  <strong>{selectedRoom.name}</strong>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedRoomId(undefined)} aria-label="Fechar">
                    ✕
                  </button>
                </div>
                <p className="small muted">
                  {ROOM_KIND_LABEL[selectedRoom.kind]} · {fmt(selectedRoom.width)} × {fmt(selectedRoom.depth)} m ·{' '}
                  {fmt(selectedRoom.width * selectedRoom.depth)} m²
                </p>
                <ProgressBar value={selectedRoom.progress} size="sm" />
                <p className="small">Acabamento: {fmtPct(selectedRoom.progress)}</p>
              </div>
            )}
          </div>
          <p className="muted small viewer-hint">Arraste para girar · role para aproximar · clique em um cômodo para ver detalhes</p>
        </section>

        <section className="side card">
          <div className="tabs" role="tablist">
            {TABS.map(([key, label]) => (
              <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'etapas' && <StagesPanel project={project} />}
          {tab === 'comodos' && <RoomsPanel project={project} selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />}
          {tab === 'materiais' && <MaterialsPanel project={project} />}
          {tab === 'mao_de_obra' && <LaborPanel project={project} />}
          {tab === 'dados' && <InfoPanel project={project} />}
        </section>
      </div>
    </div>
  )
}
