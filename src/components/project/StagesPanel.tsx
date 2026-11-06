import { STAGE_COLOR } from '../../lib/catalog'
import { fmtPct } from '../../lib/format'
import { useProjects } from '../../store/projects'
import type { Project } from '../../types'

export function StagesPanel({ project }: { project: Project }) {
  const setStageProgress = useProjects((s) => s.setStageProgress)
  return (
    <div className="panel-body">
      <p className="muted small">
        Arraste para atualizar o avanço físico de cada etapa. O modelo 3D é atualizado em tempo real.
      </p>
      <ul className="stage-list">
        {project.stages.map((st) => (
          <li key={st.id}>
            <div className="row between">
              <span>
                <i className="dot" style={{ background: STAGE_COLOR[st.id] }} /> {st.name}
                <span className="muted small"> · peso {st.weight}%</span>
              </span>
              <strong>{fmtPct(st.progress)}</strong>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={st.progress}
              style={{ accentColor: STAGE_COLOR[st.id] }}
              onChange={(e) => setStageProgress(project.id, st.id, Number(e.target.value))}
              aria-label={`Progresso de ${st.name}`}
            />
            {st.id === 'acabamento' && (
              <p className="muted small">Calculado pela média dos cômodos (aba Cômodos). Ajustar aqui aplica o valor a todos.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
