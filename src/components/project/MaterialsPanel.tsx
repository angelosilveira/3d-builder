import { useState, type FormEvent } from 'react'
import { MATERIAL_IDS, MATERIALS } from '../../lib/catalog'
import { materialStatus } from '../../lib/estimates'
import { fmt, fmtDate, fmtMoney, today } from '../../lib/format'
import { useProjects } from '../../store/projects'
import type { MaterialId, Project } from '../../types'

export function MaterialsPanel({ project }: { project: Project }) {
  const add = useProjects((s) => s.addMaterialUsage)
  const remove = useProjects((s) => s.removeMaterialUsage)
  const [materialId, setMaterialId] = useState<MaterialId>('cimento')
  const [quantity, setQuantity] = useState('')
  const [date, setDate] = useState(today())

  const rows = materialStatus(project)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = Number(quantity.replace(',', '.'))
    if (!(q > 0)) return
    add(project.id, { materialId, quantity: q, date })
    setQuantity('')
  }

  return (
    <div className="panel-body">
      <table className="table compact">
        <thead>
          <tr>
            <th>Material</th>
            <th className="num">Previsto</th>
            <th className="num" title="Quanto já deveria ter sido gasto pelo avanço físico">Esperado</th>
            <th className="num">Gasto</th>
            <th className="num">Desvio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const info = MATERIALS[r.id]
            const tone = r.expected === 0 ? '' : r.deviation > 0.1 ? 'bad' : r.deviation < -0.1 ? 'warn' : 'good'
            return (
              <tr key={r.id}>
                <td>
                  {info.name}
                  <div className="mini-bar">
                    <i style={{ width: `${Math.min(100, (r.used / (r.planned || 1)) * 100)}%` }} />
                  </div>
                </td>
                <td className="num">
                  {fmt(r.planned)} {info.unit}
                </td>
                <td className="num">{fmt(r.expected)}</td>
                <td className="num">{fmt(r.used)}</td>
                <td className={`num tone-${tone}`}>
                  {r.expected === 0 ? '—' : `${r.deviation > 0 ? '+' : ''}${Math.round(r.deviation * 100)}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Custo</td>
            <td className="num">{fmtMoney(rows.reduce((s, r) => s + r.plannedCost, 0))}</td>
            <td />
            <td className="num">{fmtMoney(rows.reduce((s, r) => s + r.usedCost, 0))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <p className="muted small">Desvio = gasto ÷ esperado para o avanço atual. Acima de +10% indica possível desperdício.</p>

      <form className="inline-form" onSubmit={submit}>
        <h4>Lançar consumo</h4>
        <select value={materialId} onChange={(e) => setMaterialId(e.target.value as MaterialId)} aria-label="Material">
          {MATERIAL_IDS.map((id) => (
            <option key={id} value={id}>
              {MATERIALS[id].name}
            </option>
          ))}
        </select>
        <input inputMode="decimal" placeholder={`Qtd. (${MATERIALS[materialId].unit})`} value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label="Quantidade" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" />
        <button className="btn btn-primary" type="submit">
          Lançar
        </button>
      </form>

      {project.materialUsage.length > 0 && (
        <ul className="log">
          {project.materialUsage.slice(0, 30).map((u) => (
            <li key={u.id}>
              <span>
                {fmtDate(u.date)} · {MATERIALS[u.materialId].name}: <strong>{fmt(u.quantity)} {MATERIALS[u.materialId].unit}</strong>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(project.id, u.id)} aria-label="Remover lançamento">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
