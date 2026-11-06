import { ROOM_KIND_LABEL } from '../lib/catalog'
import { fmt } from '../lib/format'
import { uid } from '../lib/id'
import type { Room, RoomKind } from '../types'

interface Props {
  rooms: Room[]
  onChange: (rooms: Room[]) => void
}

const KINDS = Object.keys(ROOM_KIND_LABEL) as RoomKind[]

export function RoomsEditor({ rooms, onChange }: Props) {
  const update = (id: string, patch: Partial<Room>) =>
    onChange(rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const remove = (id: string) => onChange(rooms.filter((r) => r.id !== id))
  const add = () =>
    onChange([...rooms, { id: uid('r_'), name: `Cômodo ${rooms.length + 1}`, kind: 'outro', width: 3, depth: 3, progress: 0 }])

  const total = rooms.reduce((s, r) => s + r.width * r.depth, 0)

  return (
    <div className="rooms-editor">
      <table className="table">
        <thead>
          <tr>
            <th>Cômodo</th>
            <th>Tipo</th>
            <th>Largura (m)</th>
            <th>Profundidade (m)</th>
            <th className="num">Área</th>
            <th aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r.id}>
              <td>
                <input value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} aria-label="Nome do cômodo" />
              </td>
              <td>
                <select value={r.kind} onChange={(e) => update(r.id, { kind: e.target.value as RoomKind })} aria-label="Tipo">
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {ROOM_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input type="number" min={0.5} step={0.05} value={r.width} onChange={(e) => update(r.id, { width: Number(e.target.value) })} aria-label="Largura" />
              </td>
              <td>
                <input type="number" min={0.5} step={0.05} value={r.depth} onChange={(e) => update(r.id, { depth: Number(e.target.value) })} aria-label="Profundidade" />
              </td>
              <td className="num">{fmt(r.width * r.depth)} m²</td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(r.id)} aria-label={`Remover ${r.name}`}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              <button className="btn btn-sm" onClick={add}>
                + Adicionar cômodo
              </button>
            </td>
            <td className="num">
              <strong>{fmt(total)} m²</strong>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
