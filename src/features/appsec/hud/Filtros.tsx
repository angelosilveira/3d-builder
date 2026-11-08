import { useMemo } from 'react'
import { SEVERIDADE_LABEL, STATUS, STATUS_LABEL, TIPO_PLURAL, TIPOS } from '../data/catalogo'
import { filtrosAtivos } from '../data/derived'
import { useAppSecData } from '../data/store'
import type { Severidade, StatusQualificacao, TipoAtivo } from '../data/types'
import { useAppSecUi } from '../state/uiStore'
import { num } from './format'
import { IconeTipo } from './ui'

const NIVEIS: { valor: Severidade | null; rotulo: string; descricao: string }[] = [
  { valor: null, rotulo: 'Todas', descricao: 'Todos os ativos' },
  { valor: 'critica', rotulo: SEVERIDADE_LABEL.critica, descricao: 'Com vulnerabilidade crítica aberta' },
  { valor: 'alta', rotulo: 'Alta+', descricao: 'Com vulnerabilidade alta ou crítica aberta' },
  { valor: 'media', rotulo: 'Média+', descricao: 'Com vulnerabilidade média ou mais grave aberta' },
]

function alternar<T>(lista: T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item]
}

/** Filtros da cena e da tabela. Os chips também são a legenda das formas e cores. */
export function Filtros() {
  const data = useAppSecData((s) => s.data)
  const filtros = useAppSecUi((s) => s.filtros)
  const setFiltros = useAppSecUi((s) => s.setFiltros)
  const limpar = useAppSecUi((s) => s.limparFiltros)
  const ativos = filtrosAtivos(filtros)

  const contagem = useMemo(() => {
    const tipo = Object.fromEntries(TIPOS.map((t) => [t, 0])) as Record<TipoAtivo, number>
    const status = Object.fromEntries(STATUS.map((s) => [s, 0])) as Record<StatusQualificacao, number>
    for (const a of data.ativos) {
      tipo[a.tipo]++
      status[a.qualificacao.status]++
    }
    return { tipo, status }
  }, [data])

  return (
    <section className="aps-panel aps-filtros" aria-label="Filtros e legenda">
      <div className="aps-filtros-topo">
        <h2>Filtros</h2>
        <button type="button" className="aps-link" onClick={limpar} disabled={!ativos}>
          {ativos ? `Limpar filtros (${ativos})` : 'Sem filtros'}
        </button>
      </div>

      <fieldset className="aps-grupo">
        <legend>Tipo de ativo · forma no mapa</legend>
        <div className="aps-chips">
          {TIPOS.map((t) => {
            const on = filtros.tipos.includes(t)
            return (
              <button
                key={t}
                type="button"
                className={`aps-chip${on ? ' is-on' : ''}`}
                aria-pressed={on}
                aria-label={`${TIPO_PLURAL[t]}, ${num(contagem.tipo[t])} ativos`}
                onClick={() => setFiltros({ tipos: alternar(filtros.tipos, t) })}
              >
                <IconeTipo tipo={t} />
                {TIPO_PLURAL[t]}
                <span className="aps-chip-n">{num(contagem.tipo[t])}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="aps-grupo">
        <legend>Status do formulário · cor no mapa</legend>
        <div className="aps-chips">
          {STATUS.map((s) => {
            const on = filtros.status.includes(s)
            return (
              <button
                key={s}
                type="button"
                className={`aps-chip${on ? ' is-on' : ''}`}
                aria-pressed={on}
                aria-label={`${STATUS_LABEL[s]}, ${num(contagem.status[s])} ativos`}
                onClick={() => setFiltros({ status: alternar(filtros.status, s) })}
              >
                <i className={`aps-dot aps-bg-${s}`} aria-hidden />
                {STATUS_LABEL[s]}
                <span className="aps-chip-n">{num(contagem.status[s])}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="aps-grupo">
        <legend>Com vulnerabilidade aberta</legend>
        <div className="aps-seg" role="radiogroup" aria-label="Severidade mínima">
          {NIVEIS.map((n) => (
            <button key={n.rotulo} type="button" role="radio" aria-checked={filtros.severidade === n.valor} aria-label={n.descricao} title={n.descricao} onClick={() => setFiltros({ severidade: n.valor })}>
              {n.rotulo}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="aps-grupo aps-selects">
        <label>
          Área
          <select value={filtros.areaId ?? ''} onChange={(e) => setFiltros({ areaId: e.target.value || null })}>
            <option value="">Todas as áreas</option>
            {data.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Analista
          <select value={filtros.analistaId ?? ''} onChange={(e) => setFiltros({ analistaId: e.target.value || null })}>
            <option value="">Todos os analistas</option>
            {data.analistas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="aps-check">
          <input type="checkbox" checked={filtros.apenasPendenciaVencida} onChange={(e) => setFiltros({ apenasPendenciaVencida: e.target.checked })} />
          Só com pendência vencida
        </label>
      </div>

      <ul className="aps-legenda" aria-label="Marcadores no mapa">
        <li>
          <i className="aps-leg-losango" aria-hidden /> Vulnerabilidade crítica ou alta aberta
        </li>
        <li>
          <i className="aps-leg-anel" aria-hidden /> Pendência vencida
        </li>
        <li>
          <i className="aps-leg-esmaecido" aria-hidden /> Fora do filtro
        </li>
      </ul>
    </section>
  )
}
