import { useNavigate } from 'react-router-dom'
import { OWNER_LABEL } from '../../lib/catalog'
import { useProjects } from '../../store/projects'
import type { OwnerKind, Project } from '../../types'
import { RoomsEditor } from '../RoomsEditor'

export function InfoPanel({ project }: { project: Project }) {
  const update = useProjects((s) => s.updateProject)
  const remove = useProjects((s) => s.deleteProject)
  const navigate = useNavigate()
  const set = (patch: Partial<Project>) => update(project.id, patch)

  return (
    <div className="panel-body">
      <div className="form-grid">
        <label className="span-2">
          Nome
          <input value={project.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label>
          Gestor
          <select value={project.owner} onChange={(e) => set({ owner: e.target.value as OwnerKind })}>
            {(Object.keys(OWNER_LABEL) as OwnerKind[]).map((o) => (
              <option key={o} value={o}>
                {OWNER_LABEL[o]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cliente / órgão
          <input value={project.client} onChange={(e) => set({ client: e.target.value })} />
        </label>
        <label className="span-2">
          Endereço
          <input value={project.address} onChange={(e) => set({ address: e.target.value })} />
        </label>
        <label>
          Início
          <input type="date" value={project.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </label>
        <label>
          Término previsto
          <input type="date" value={project.endDate} onChange={(e) => set({ endDate: e.target.value })} />
        </label>
        {project.type !== 'apartamento' && (
          <label>
            Pavimentos
            <input type="number" min={1} value={project.floors} onChange={(e) => set({ floors: Math.max(1, Number(e.target.value)) })} />
          </label>
        )}
        {(project.type === 'predio' || project.type === 'condominio') && (
          <label>
            {project.type === 'predio' ? 'Apartamentos por andar' : 'Casas'}
            <input type="number" min={1} value={project.units} onChange={(e) => set({ units: Math.max(1, Number(e.target.value)) })} />
          </label>
        )}
      </div>

      <h4>Planta (cômodos)</h4>
      <RoomsEditor rooms={project.rooms} onChange={(rooms) => set({ rooms })} />

      <div className="danger-zone">
        <button
          className="btn btn-danger"
          onClick={() => {
            if (confirm(`Excluir a obra "${project.name}"? Esta ação não pode ser desfeita.`)) {
              remove(project.id)
              navigate('/')
            }
          }}
        >
          Excluir obra
        </button>
      </div>
    </div>
  )
}
