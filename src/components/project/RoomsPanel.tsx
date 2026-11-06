import { ROOM_KIND_LABEL } from '../../lib/catalog'
import { fmt, fmtPct } from '../../lib/format'
import { useProjects } from '../../store/projects'
import type { Project } from '../../types'
import { ProgressBar } from '../ui/ProgressBar'

interface Props {
  project: Project
  selectedRoomId?: string
  onSelectRoom: (id: string | undefined) => void
}

const statusOf = (p: number) => (p >= 100 ? 'Pronto' : p > 0 ? 'Em andamento' : 'Não iniciado')

export function RoomsPanel({ project, selectedRoomId, onSelectRoom }: Props) {
  const updateRoom = useProjects((s) => s.updateRoom)
  return (
    <div className="panel-body">
      <p className="muted small">Acabamento por cômodo (piso, revestimento, pintura). Clique no 3D para selecionar.</p>
      <ul className="room-list">
        {project.rooms.map((r) => (
          <li
            key={r.id}
            className={selectedRoomId === r.id ? 'selected' : ''}
            onClick={() => onSelectRoom(r.id)}
          >
            <div className="row between">
              <span>
                <strong>{r.name}</strong>{' '}
                <span className="muted small">
                  {ROOM_KIND_LABEL[r.kind]} · {fmt(r.width)}×{fmt(r.depth)} m · {fmt(r.width * r.depth)} m²
                </span>
              </span>
              <span className={`pill pill-${r.progress >= 100 ? 'ok' : r.progress > 0 ? 'mid' : 'none'}`}>
                {statusOf(r.progress)}
              </span>
            </div>
            <div className="row gap">
              <ProgressBar value={r.progress} size="sm" />
              <span className="small num-col">{fmtPct(r.progress)}</span>
            </div>
            {selectedRoomId === r.id && (
              <div className="row gap wrap" onClick={(e) => e.stopPropagation()}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={r.progress}
                  onChange={(e) => updateRoom(project.id, r.id, { progress: Number(e.target.value) })}
                  aria-label={`Acabamento de ${r.name}`}
                />
                <button className="btn btn-sm" onClick={() => updateRoom(project.id, r.id, { progress: 100 })}>
                  Marcar como pronto
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
