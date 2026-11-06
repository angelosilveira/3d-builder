import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { avancoFisico, desviosPavimentos, estadosPavimentos, pavimentosVisiveis, semanaParaData, type Desvio } from '../data/schedule'
import { useObraData } from '../data/store'
import type { ObraData } from '../data/types'
import { useCanteiroStore } from '../state/canteiroStore'
import { useReducedMotion } from '../state/useReducedMotion'
import { dataCurta, mes, pct } from './format'

const DURACAO_REPLAY_MS = 7000
/** A data "gruda" em hoje quando o cursor passa perto. */
const IMA_SEMANAS = 0.35

interface Faixa {
  inicio: number
  fim: number
}
interface LinhaGantt {
  numero: number
  estruturaPrev: Faixa
  alvenariaPrev: Faixa
  estruturaExec: Faixa | null
  alvenariaExec: Faixa | null
}

/** Amostra o executado (com projeção) para achar início e fim reais/projetados de cada etapa. */
function montarGantt(data: Pick<ObraData, 'obra' | 'pavimentos'>, fimEscala: number): LinhaGantt[] {
  const passo = 0.25
  const faixas = data.pavimentos.map(() => ({ e: { inicio: -1, fim: -1 }, a: { inicio: -1, fim: -1 } }))
  for (let s = 0; s <= fimEscala; s += passo) {
    estadosPavimentos(data, s, 'executado').forEach((st, i) => {
      const f = faixas[i]
      if (st.estrutura > 0 && f.e.inicio < 0) f.e.inicio = s - passo
      if (st.estrutura >= 1 && f.e.fim < 0) f.e.fim = s
      if (st.alvenaria > 0 && f.a.inicio < 0) f.a.inicio = s - passo
      if (st.alvenaria >= 1 && f.a.fim < 0) f.a.fim = s
    })
  }
  const fechar = (f: { inicio: number; fim: number }) => (f.inicio < 0 ? null : { inicio: f.inicio, fim: f.fim < 0 ? fimEscala : f.fim })
  return data.pavimentos.map((p, i) => ({
    numero: p.numero,
    estruturaPrev: p.estrutura.previsto,
    alvenariaPrev: p.alvenaria.previsto,
    estruturaExec: fechar(faixas[i].e),
    alvenariaExec: fechar(faixas[i].a),
  }))
}

const COR_DESVIO_VAR: Record<Desvio, string> = {
  adiantado: 'var(--prancha)',
  no_prazo: 'var(--executado)',
  atrasado: 'var(--atraso)',
  nao_iniciado: 'var(--prancha)',
}

export function Schedule4D() {
  const obra = useObraData((d) => d.obra)
  const pavimentos = useObraData((d) => d.pavimentos)
  const semanaSel = useCanteiroStore((s) => s.semana)
  const setSemana = useCanteiroStore((s) => s.setSemana)
  const comparar = useCanteiroStore((s) => s.comparar)
  const setComparar = useCanteiroStore((s) => s.setComparar)
  const reduced = useReducedMotion()

  const hoje = obra.semanaAtual
  const semana = semanaSel ?? hoje
  const fimEscala = obra.duracaoSemanas
  const dados = useMemo(() => ({ obra, pavimentos }), [obra, pavimentos])
  const gantt = useMemo(() => montarGantt(dados, fimEscala), [dados, fimEscala])
  const desvios = useMemo(() => desviosPavimentos(dados, semana), [dados, semana])
  const visiveis = useMemo(() => pavimentosVisiveis(dados, semana), [dados, semana])
  const avanco = useMemo(
    () => ({ exec: avancoFisico(dados, semana, 'executado'), prev: avancoFisico(dados, semana, 'previsto') }),
    [dados, semana],
  )
  const meses = useMemo(() => {
    const out: { x: number; rotulo: string }[] = []
    const inicio = new Date(obra.inicio)
    const d = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1)
    const fim = semanaParaData(obra, fimEscala)
    while (d < fim) {
      const s = (d.getTime() - inicio.getTime()) / (7 * 86400000)
      out.push({ x: s / fimEscala, rotulo: d.getMonth() === 0 ? `${mes(d)} ${String(d.getFullYear()).slice(2)}` : mes(d) })
      d.setMonth(d.getMonth() + 1)
    }
    return out
  }, [obra, fimEscala])

  // ---------- Reproduzir a obra do início até hoje ----------
  const [tocando, setTocando] = useState(false)
  const raf = useRef(0)
  useEffect(() => {
    if (!tocando) return
    if (reduced) {
      setSemana(null)
      setTocando(false)
      return
    }
    const t0 = performance.now()
    const tick = (t: number) => {
      const f = Math.min(1, (t - t0) / DURACAO_REPLAY_MS)
      if (f >= 1) {
        setSemana(null)
        setTocando(false)
        return
      }
      setSemana(f * hoje)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [tocando, reduced, hoje, setSemana])

  const definir = useCallback(
    (v: number) => {
      const s = Math.min(fimEscala, Math.max(0, v))
      setSemana(Math.abs(s - hoje) < IMA_SEMANAS ? null : s)
    },
    [fimEscala, hoje, setSemana],
  )
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTocando(false)
    definir(Number(e.target.value))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const passos: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4 }
    if (e.key in passos) {
      e.preventDefault()
      setTocando(false)
      definir(Math.round(semana) + passos[e.key])
    } else if (e.key === 'Home') {
      e.preventDefault()
      definir(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      definir(fimEscala)
    }
  }

  const x = (s: number) => (s / fimEscala) * 100
  const n = pavimentos.length
  const dataCursor = semanaParaData(obra, semana)
  const momento = semanaSel === null ? 'hoje' : semana < hoje ? 'executado' : 'projeção'
  const textoValor = `Semana ${Math.round(semana)}, ${dataCursor.toLocaleDateString('pt-BR')}, ${visiveis.length} de ${n} pavimentos com estrutura${momento === 'projeção' ? ', projeção' : ''}`

  return (
    <section className={`cnt-4d cnt-panel${comparar ? ' is-comparing' : ''}`} aria-label="Cronograma 4D">
      <div className="cnt-4d-side">
        <p className="cnt-eyebrow">Cronograma 4D</p>
        <p className="cnt-4d-read">
          <span className="cnt-display">{String(Math.round(semana)).padStart(2, '0')}</span>
          <span className="cnt-4d-read-txt">
            <span>semana</span>
            <span className={`cnt-4d-momento is-${momento === 'projeção' ? 'projecao' : momento}`}>{momento}</span>
          </span>
        </p>
        <button type="button" className="cnt-btn cnt-btn-sm" onClick={() => setTocando((v) => !v)} aria-pressed={tocando}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
            {tocando ? <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" /> : <path d="M4 2.5v11l9-5.5z" fill="currentColor" />}
          </svg>
          {tocando ? 'Pausar' : 'Reproduzir obra'}
        </button>
      </div>

      <div className="cnt-4d-chart">
        <div className="cnt-4d-ylabels" aria-hidden>
          {pavimentos.map((p, i) =>
            n <= 6 || i % 2 === 0 || i === n - 1 ? (
              <span key={p.id} style={{ bottom: `${((i + 0.5) / n) * 100}%` }}>
                {p.numero}º
              </span>
            ) : null,
          )}
        </div>
        <div className="cnt-4d-plot" style={{ ['--linhas' as string]: n }}>
          {/* Escada: um degrau por pavimento (1º embaixo). Previsto tracejado, executado sólido. */}
          {gantt.map((g, i) => {
            const cor = comparar ? COR_DESVIO_VAR[desvios[i]] : 'var(--prancha)'
            return (
              <div key={g.numero} className="cnt-4d-row" style={{ bottom: `${(i / n) * 100}%`, height: `${100 / n}%` }}>
                <span className="cnt-4d-prev" style={{ left: `${x(g.estruturaPrev.inicio)}%`, width: `${x(g.estruturaPrev.fim - g.estruturaPrev.inicio)}%` }} />
                <span className="cnt-4d-prev is-alv" style={{ left: `${x(g.alvenariaPrev.inicio)}%`, width: `${x(g.alvenariaPrev.fim - g.alvenariaPrev.inicio)}%` }} />
                {g.estruturaExec && (
                  <span
                    className={`cnt-4d-exec${g.estruturaExec.fim > hoje ? ' is-proj' : ''}`}
                    style={{
                      left: `${x(g.estruturaExec.inicio)}%`,
                      width: `${x(g.estruturaExec.fim - g.estruturaExec.inicio)}%`,
                      ['--corte' as string]: `${Math.min(100, Math.max(0, ((hoje - g.estruturaExec.inicio) / (g.estruturaExec.fim - g.estruturaExec.inicio)) * 100))}%`,
                      background: cor,
                    }}
                  />
                )}
                {g.alvenariaExec && (
                  <span
                    className={`cnt-4d-exec is-alv${g.alvenariaExec.fim > hoje ? ' is-proj' : ''}`}
                    style={{
                      left: `${x(g.alvenariaExec.inicio)}%`,
                      width: `${x(g.alvenariaExec.fim - g.alvenariaExec.inicio)}%`,
                      ['--corte' as string]: `${Math.min(100, Math.max(0, ((hoje - g.alvenariaExec.inicio) / (g.alvenariaExec.fim - g.alvenariaExec.inicio)) * 100))}%`,
                      background: comparar ? cor : 'var(--alvenaria)',
                    }}
                  />
                )}
              </div>
            )
          })}
          <span className="cnt-4d-futuro" style={{ left: `${x(semana)}%` }} aria-hidden />
          <span className="cnt-4d-hoje" style={{ left: `${x(hoje)}%` }} aria-hidden>
            {/* Perto do cursor, o carimbo já informa a data. */}
            {Math.abs(x(semana) - x(hoje)) > 7 && <i>hoje</i>}
          </span>
          <span className="cnt-4d-cursor" style={{ left: `${x(semana)}%` }} aria-hidden>
            <span className={`cnt-4d-stamp cnt-mono${x(semana) > 88 ? ' is-fim' : x(semana) < 10 ? ' is-inicio' : ''}`}>
              <b>{dataCurta(dataCursor)}</b>
              <span>
                {visiveis.length} de {n} pav.
              </span>
            </span>
          </span>
          <input
            className="cnt-4d-range"
            type="range"
            min={0}
            max={fimEscala}
            step="any"
            value={semana}
            onChange={onChange}
            onKeyDown={onKeyDown}
            aria-label="Data do cronograma 4D: arraste para ver o prédio crescer ou regredir"
            aria-valuetext={textoValor}
          />
        </div>
        <div className="cnt-4d-axis" aria-hidden>
          {meses.map((m) => (
            <span key={`${m.rotulo}-${m.x}`} style={{ left: `${m.x * 100}%` }}>
              {m.rotulo}
            </span>
          ))}
        </div>
      </div>

      <div className="cnt-4d-side cnt-4d-controls">
        <button type="button" role="switch" aria-checked={comparar} className="cnt-switch" onClick={() => setComparar(!comparar)}>
          <span className="cnt-switch-track" aria-hidden>
            <span />
          </span>
          Previsto x Executado
        </button>
        {comparar ? (
          <ul className="cnt-4d-legend" aria-label="Legenda do desvio">
            <li>
              <i style={{ background: 'var(--executado)' }} /> No prazo
            </li>
            <li>
              <i style={{ background: 'var(--prancha)' }} /> Adiantado
            </li>
            <li>
              <i style={{ background: 'var(--atraso)' }} /> Atrasado
            </li>
          </ul>
        ) : (
          <p className="cnt-4d-avanco cnt-mono">
            exec. {pct(avanco.exec)} · prev. {pct(avanco.prev)}
          </p>
        )}
        <button type="button" className="cnt-link" onClick={() => setSemana(null)} disabled={semanaSel === null}>
          Voltar para hoje
        </button>
      </div>
    </section>
  )
}
