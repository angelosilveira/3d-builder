import { useState, type FormEvent } from 'react'
import { LABOR_HOURLY_RATE, LABOR_LABEL, LABOR_ROLES } from '../../lib/catalog'
import { laborStatus } from '../../lib/estimates'
import { fmt, fmtDate, fmtMoney, today } from '../../lib/format'
import { useProjects } from '../../store/projects'
import type { LaborRole, Project } from '../../types'
import { ProgressBar } from '../ui/ProgressBar'

export function LaborPanel({ project }: { project: Project }) {
  const add = useProjects((s) => s.addLabor)
  const remove = useProjects((s) => s.removeLabor)
  const [role, setRole] = useState<LaborRole>('pedreiro')
  const [workers, setWorkers] = useState(1)
  const [hours, setHours] = useState(8)
  const [days, setDays] = useState(1)
  const [date, setDate] = useState(today())

  const rows = laborStatus(project)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (workers < 1 || hours <= 0 || days < 1) return
    add(project.id, { role, workers, hours, days, date })
  }

  return (
    <div className="panel-body">
      <ul className="labor-list">
        {rows.map((r) => (
          <li key={r.role}>
            <div className="row between">
              <strong>{LABOR_LABEL[r.role]}</strong>
              <span className="small">
                {fmt(r.usedHours)} h de {fmt(r.plannedHours)} h previstas
              </span>
            </div>
            <ProgressBar value={(r.usedHours / (r.plannedHours || 1)) * 100} planned={(r.expectedHours / (r.plannedHours || 1)) * 100} size="sm" />
            <div className="row between small muted">
              <span>{fmt(r.workerDays)} diárias · {fmtMoney(r.usedCost)}</span>
              <span>R$ {LABOR_HOURLY_RATE[r.role]}/h</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">A marca vertical indica as horas esperadas para o avanço físico atual.</p>

      <form className="inline-form" onSubmit={submit}>
        <h4>Apontar mão de obra</h4>
        <select value={role} onChange={(e) => setRole(e.target.value as LaborRole)} aria-label="Função">
          {LABOR_ROLES.map((r) => (
            <option key={r} value={r}>
              {LABOR_LABEL[r]}
            </option>
          ))}
        </select>
        <label className="mini">
          Pessoas
          <input type="number" min={1} value={workers} onChange={(e) => setWorkers(Number(e.target.value))} />
        </label>
        <label className="mini">
          h/dia
          <input type="number" min={1} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
        </label>
        <label className="mini">
          Dias
          <input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" />
        <button className="btn btn-primary" type="submit">
          Apontar
        </button>
      </form>

      {project.labor.length > 0 && (
        <ul className="log">
          {project.labor.slice(0, 30).map((l) => (
            <li key={l.id}>
              <span>
                {fmtDate(l.date)} · {l.workers} {LABOR_LABEL[l.role].toLowerCase()}(s) × {l.hours} h × {l.days} dia(s) ={' '}
                <strong>{fmt(l.workers * l.hours * l.days)} h</strong>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(project.id, l.id)} aria-label="Remover apontamento">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
