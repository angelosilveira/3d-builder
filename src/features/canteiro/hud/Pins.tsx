import { useCallback, useMemo } from 'react'
import { alertasAtivos } from '../data/live'
import { useObraData } from '../data/store'
import type { Alerta } from '../data/types'
import { ancoraDe } from '../scene/layout'
import { registrarPin } from '../scene/pinRegistry'
import { useCanteiroStore } from '../state/canteiroStore'
import { useAgora } from '../state/useAgora'
import { useSelecionar } from '../state/useSelecionar'

function Pin({ alerta, pos }: { alerta: Alerta; pos: [number, number, number] }) {
  const selecionar = useSelecionar()
  const selecionado = useCanteiroStore((s) => s.selecionadoId === alerta.alvoId)
  const ref = useCallback((el: HTMLButtonElement | null) => registrarPin(alerta.id, el, pos), [alerta.id, pos])
  return (
    <button
      ref={ref}
      type="button"
      className={`cnt-pin cnt-pin-${alerta.severidade}${selecionado ? ' is-selected' : ''}`}
      onClick={() => selecionar(alerta.alvoId)}
      aria-label={`${alerta.titulo}. ${alerta.descricao}`}
    >
      <span className="cnt-pin-head" aria-hidden>
        !
      </span>
      <span className="cnt-pin-label">{alerta.titulo}</span>
    </button>
  )
}

/** Pins 3D sobre itens que exigem atenção (posicionados pelo PinProjector). */
export function PinsLayer() {
  const dados = useObraData((d) => d)
  const agora = useAgora(5000)
  const isHoje = useCanteiroStore((s) => s.semana === null || Math.abs(s.semana - dados.obra.semanaAtual) < 0.05)
  const pins = useMemo(
    () =>
      alertasAtivos(dados, agora)
        // Caminhões só existem na cena "hoje".
        .filter((a) => isHoje || !dados.equipamentos.some((e) => e.id === a.alvoId && e.tipo === 'betoneira'))
        .map((a) => ({ alerta: a, pos: ancoraDe(dados, a.alvoId, { acima: 3 }) }))
        .filter((p): p is { alerta: Alerta; pos: [number, number, number] } => p.pos !== null),
    [dados, agora, isHoje],
  )
  return (
    <div className="cnt-pins" aria-label="Alertas no canteiro">
      {pins.map((p) => (
        <Pin key={p.alerta.id} alerta={p.alerta} pos={p.pos} />
      ))}
    </div>
  )
}
