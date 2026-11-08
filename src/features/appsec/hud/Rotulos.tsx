import { memo, useCallback, useMemo } from 'react'
import { useAppSecData } from '../data/store'
import type { Area, Projeto } from '../data/types'
import type { Retangulo } from '../data/layout'
import { registrarAncora, ZOOM_PROJETOS } from '../scene/rotulos'
import { PLACA_H } from '../scene/Ecossistema'
import { useAppSecUi } from '../state/uiStore'
import { num } from './format'

const RotuloArea = memo(function RotuloArea({ area, ret, ativos, projetos }: { area: Area; ret: Retangulo; ativos: number; projetos: number }) {
  const comandar = useAppSecUi((s) => s.comandar)
  const ref = useCallback(
    (el: HTMLButtonElement | null) => registrarAncora(`area:${area.id}`, el, [ret.x - ret.w / 2, 0, ret.z - ret.d / 2]),
    [area.id, ret],
  )
  return (
    <button
      ref={ref}
      type="button"
      className="aps-rotulo-area"
      onClick={() => comandar('enquadrar', { x: ret.x, z: ret.z, w: ret.w, d: ret.d })}
      aria-label={`Aproximar da área ${area.nome}: ${projetos} projetos, ${ativos} ativos`}
    >
      <strong>{area.nome}</strong>
      <span>
        {projetos} projetos · {num(ativos)} ativos
      </span>
    </button>
  )
})

const RotuloProjeto = memo(function RotuloProjeto({ projeto, ret }: { projeto: Projeto; ret: Retangulo }) {
  const selecionar = useAppSecUi((s) => s.selecionar)
  const ref = useCallback(
    (el: HTMLButtonElement | null) => registrarAncora(`prj:${projeto.id}`, el, [ret.x - ret.w / 2 + 0.4, PLACA_H, ret.z - ret.d / 2 + 0.2], ZOOM_PROJETOS),
    [projeto.id, ret],
  )
  return (
    <button ref={ref} type="button" className="aps-rotulo-projeto" tabIndex={-1} onClick={() => selecionar({ tipo: 'projeto', id: projeto.id })}>
      {projeto.nome}
    </button>
  )
})

/** Rótulos ancorados no mapa: áreas sempre; projetos só com zoom suficiente. */
export function Rotulos() {
  const data = useAppSecData((s) => s.data)
  const layout = useAppSecData((s) => s.layout)
  const contagem = useMemo(() => {
    const ativos = new Map<string, number>()
    const projetos = new Map<string, number>()
    for (const a of data.ativos) ativos.set(a.areaId, (ativos.get(a.areaId) ?? 0) + 1)
    for (const p of data.projetos) projetos.set(p.areaId, (projetos.get(p.areaId) ?? 0) + 1)
    return { ativos, projetos }
  }, [data])
  return (
    <div className="aps-rotulos">
      {data.areas.map((a) => {
        const ret = layout.areaPorId.get(a.id)
        return ret ? <RotuloArea key={a.id} area={a} ret={ret} ativos={contagem.ativos.get(a.id) ?? 0} projetos={contagem.projetos.get(a.id) ?? 0} /> : null
      })}
      {data.projetos.map((p) => {
        const ret = layout.projetoPorId.get(p.id)
        return ret ? <RotuloProjeto key={p.id} projeto={p} ret={ret} /> : null
      })}
    </div>
  )
}
