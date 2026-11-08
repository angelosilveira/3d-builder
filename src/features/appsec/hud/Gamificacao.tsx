import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { FILTROS_VAZIOS } from '../data/derived'
import { COMPONENTE_LABEL, type Componente, conquistas, type Missao, missoes, nivelDe, NIVEIS, PESOS, pontuacao, rankingAreas } from '../data/gamificacao'
import { useAppSecData } from '../data/store'
import type { Ativo } from '../data/types'
import { cenaAnimada, PLACA_H } from '../scene/Ecossistema'
import { registrarAncora } from '../scene/rotulos'
import { type Efeito, useEfeitos } from '../state/efeitos'
import { useAppSecUi } from '../state/uiStore'
import { num } from './format'

/* ---------------- Números que contam ---------------- */

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Valor exibido que "conta" até o alvo. Na montagem conta a partir de zero;
 * depois, a partir do valor anterior. Com movimento reduzido, salta direto.
 */
export function useContagem(alvo: number, duracao = 900): number {
  const reduced = useReducedMotion()
  const [mostrado, setMostrado] = useState(reduced ? alvo : 0)
  const atual = useRef(mostrado)
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame === 'undefined') {
      atual.current = alvo
      setMostrado(alvo)
      return
    }
    const de = atual.current
    if (de === alvo) return
    const inicio = performance.now()
    let raf = 0
    const passo = (agora: number) => {
      const u = Math.min(1, (agora - inicio) / duracao)
      const v = de + (alvo - de) * easeOut(u)
      atual.current = v
      setMostrado(v)
      if (u < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [alvo, duracao, reduced])
  return mostrado
}

/** Número animado para a vista; leitores de tela recebem só o valor final. */
export function NumeroAnimado({ valor, formatar = (v: number) => num(Math.round(v)) }: { valor: number; formatar?: (v: number) => string }) {
  const mostrado = useContagem(valor)
  return (
    <>
      <span aria-hidden>{formatar(mostrado)}</span>
      <span className="aps-sr">{formatar(valor)}</span>
    </>
  )
}

/* ---------------- Postura (topbar) ---------------- */

export function usePostura() {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  return useMemo(() => {
    const p = pontuacao(data, indice)
    return { ...p, ...nivelDe(p.total) }
  }, [data, indice])
}

/** Selo hexagonal do nível (1–5 faixas preenchidas). */
function SeloNivel({ ordem }: { ordem: number }) {
  return (
    <svg viewBox="0 0 32 36" width="30" height="34" aria-hidden className={`aps-selo aps-selo-${ordem}`}>
      <path d="M16 1.5 30 9.5v17L16 34.5 2 26.5v-17z" className="aps-selo-fundo" />
      {NIVEIS.map((n) => (
        <rect key={n.ordem} x={9} y={25 - n.ordem * 3.4} width={14} height={2.2} rx={1.1} className={n.ordem <= ordem ? 'is-on' : 'is-off'} />
      ))}
    </svg>
  )
}

export function PainelPostura() {
  const { total, atual, proximo, progresso } = usePostura()
  const selecionar = useAppSecUi((s) => s.selecionar)
  const anterior = useRef(total)
  const [delta, setDelta] = useState<{ v: number; n: number } | null>(null)
  useEffect(() => {
    const d = total - anterior.current
    anterior.current = total
    if (d === 0) return
    setDelta((x) => ({ v: d, n: (x?.n ?? 0) + 1 }))
    const id = window.setTimeout(() => setDelta(null), 2400)
    return () => window.clearTimeout(id)
  }, [total])
  const nivelAnterior = useRef(atual.ordem)
  const [subiu, setSubiu] = useState(false)
  useEffect(() => {
    if (atual.ordem > nivelAnterior.current) {
      setSubiu(true)
      const id = window.setTimeout(() => setSubiu(false), 2600)
      nivelAnterior.current = atual.ordem
      return () => window.clearTimeout(id)
    }
    nivelAnterior.current = atual.ordem
  }, [atual.ordem])

  const falta = proximo ? proximo.min - total : 0
  const rotulo = `Postura de segurança: ${num(total)} de 1.000 pontos, nível ${atual.nome}${proximo ? `. Faltam ${num(falta)} pontos para ${proximo.nome}` : ''}. Ver missões`
  return (
    <button type="button" className={`aps-postura${subiu ? ' is-subiu' : ''}`} onClick={() => selecionar(null)} aria-label={rotulo} title="Ver missões e ranking">
      <SeloNivel ordem={atual.ordem} />
      <span className="aps-postura-txt">
        <span className="aps-postura-linha">
          <b className="aps-display aps-postura-pts">
            <NumeroAnimado valor={total} />
          </b>
          <span className="aps-postura-nivel">{atual.nome}</span>
          {delta && (
            <span key={delta.n} className={`aps-postura-delta${delta.v < 0 ? ' is-neg' : ''}`} aria-hidden>
              {delta.v > 0 ? '+' : ''}
              {delta.v}
            </span>
          )}
        </span>
        <span className="aps-postura-barra" aria-hidden>
          <i style={{ width: `${progresso * 100}%` }} />
        </span>
        <span className="aps-postura-prox" aria-hidden>
          {proximo ? `${num(falta)} pts para ${proximo.nome}` : 'Nível máximo'}
        </span>
      </span>
    </button>
  )
}

/* ---------------- Visão geral: composição, missões e ranking ---------------- */

export function ComposicaoPostura() {
  const { total, fracoes, atual } = usePostura()
  return (
    <div className="aps-composicao">
      <p className="aps-composicao-total">
        <b className="aps-display">
          <NumeroAnimado valor={total} />
        </b>
        <span className="aps-muted"> / 1.000 · nível {atual.nome}</span>
      </p>
      <ul aria-label="Composição da pontuação de postura">
        {(Object.keys(PESOS) as Componente[]).map((k) => (
          <li key={k}>
            <span>{COMPONENTE_LABEL[k]}</span>
            <span className="aps-composicao-barra" aria-hidden>
              <i style={{ width: `${fracoes[k] * 100}%` }} />
            </span>
            <span className="aps-mono">
              {num(PESOS[k] * fracoes[k])}
              <span className="aps-muted">/{PESOS[k]}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ListaMissoes() {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const layout = useAppSecData((s) => s.layout)
  const setFiltros = useAppSecUi((s) => s.setFiltros)
  const selecionar = useAppSecUi((s) => s.selecionar)
  const comandar = useAppSecUi((s) => s.comandar)
  const lista = useMemo(() => missoes(data, indice), [data, indice])

  const ir = useCallback(
    (m: Missao) => {
      setFiltros({ ...FILTROS_VAZIOS, ...m.filtros })
      if (m.foco.tipo === 'area') {
        const r = layout.areaPorId.get(m.foco.id)
        if (r) comandar('enquadrar', { x: r.x, z: r.z, w: r.w, d: r.d })
      } else {
        selecionar({ tipo: m.foco.tipo, id: m.foco.id })
      }
    },
    [layout, setFiltros, selecionar, comandar],
  )

  if (!lista.length) return <p className="aps-muted aps-pequeno">Nenhuma missão pendente. Postura exemplar!</p>
  return (
    <ol className="aps-missoes">
      {lista.map((m, k) => (
        <li key={m.id} className="aps-missao" style={{ animationDelay: `${k * 90}ms` }}>
          <span className="aps-missao-icone" aria-hidden>
            {m.foco.tipo === 'area' ? '⏱' : m.foco.tipo === 'projeto' ? '▤' : '✎'}
          </span>
          <span className="aps-missao-txt">
            <strong>{m.titulo}</strong>
            <span className="aps-muted aps-pequeno">{m.descricao}</span>
            <span className="aps-missao-prog" role="meter" aria-label={`Progresso da missão: ${Math.round(m.progresso * 100)}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(m.progresso * 100)}>
              <i style={{ width: `${m.progresso * 100}%` }} />
            </span>
          </span>
          <span className="aps-missao-acao">
            <span className="aps-recompensa" title="Pontos de postura estimados ao concluir">
              +{m.recompensa} pts
            </span>
            <button type="button" className="aps-btn-ir" onClick={() => ir(m)} aria-label={`Ir para a missão: ${m.titulo}`}>
              Ir
            </button>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function RankingAreas() {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const layout = useAppSecData((s) => s.layout)
  const comandar = useAppSecUi((s) => s.comandar)
  const ranking = useMemo(() => rankingAreas(data, indice), [data, indice])
  const max = ranking[0]?.pontos || 1
  return (
    <ol className="aps-ranking" aria-label="Ranking das áreas por pontuação de postura">
      {ranking.map((r) => {
        const ret = layout.areaPorId.get(r.area.id)
        return (
          <li key={r.area.id}>
            <button
              type="button"
              className="aps-ranking-btn"
              onClick={() => ret && comandar('enquadrar', { x: ret.x, z: ret.z, w: ret.w, d: ret.d })}
              aria-label={`${r.posicao}º ${r.area.nome}: ${num(r.pontos)} pontos, nível ${r.nivel.nome}. Aproximar no mapa`}
            >
              <span className={`aps-medalha aps-medalha-${Math.min(r.posicao, 4)}`} aria-hidden>
                {r.posicao}
              </span>
              <span className="aps-ranking-nome">
                {r.area.nome}
                <span className="aps-muted aps-pequeno"> · {r.nivel.nome}</span>
              </span>
              <span className="aps-mono">{num(r.pontos)}</span>
              <span className="aps-ranking-barra" aria-hidden>
                <i style={{ width: `${(r.pontos / max) * 100}%` }} />
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------------- Conquistas do projeto ---------------- */

const ICONE_CONQUISTA: Record<string, string> = {
  sem_criticas: 'M12 2.5 4 5.5v6c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10v-6z',
  documentacao: 'M7 3h7l4 4v14H7z M14 3v4h4 M10 12h5 M10 16h5',
  em_dia: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 8v4l3 2',
  maduro: 'M5 19h3v-4H5z M10.5 19h3v-8h-3z M16 19h3V7h-3z',
  aprovado: 'M5 12.5 10 17l9-10',
}

export function Conquistas({ ativos }: { ativos: Ativo[] }) {
  const indice = useAppSecData((s) => s.indice)
  const lista = useMemo(() => conquistas(indice, ativos), [indice, ativos])
  const obtidas = lista.filter((c) => c.obtida).length
  return (
    <div>
      <p className="aps-muted aps-pequeno aps-conquistas-resumo">
        {obtidas} de {lista.length} conquistas
      </p>
      <ul className="aps-conquistas">
        {lista.map((c) => (
          <li key={c.id} className={c.obtida ? 'is-obtida' : undefined} title={c.descricao} aria-label={`${c.nome}: ${c.descricao}. ${c.obtida ? 'Obtida' : 'Ainda não obtida'}`}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path d={ICONE_CONQUISTA[c.id]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{c.nome}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- Efeitos: "+N pts" flutuando e toasts ---------------- */

const DURACAO_FLUTUANTE = 1800
const DURACAO_TOAST = 4200

interface Flutuante {
  id: number
  texto: string
  tipo: Efeito['tipo']
  pos: [number, number, number]
}

function UmFlutuante({ f, fim }: { f: Flutuante; fim: (id: number) => void }) {
  const ref = useCallback((el: HTMLSpanElement | null) => registrarAncora(`fx:${f.id}`, el, f.pos), [f.id, f.pos])
  useEffect(() => {
    const id = window.setTimeout(() => fim(f.id), DURACAO_FLUTUANTE)
    return () => window.clearTimeout(id)
  }, [f.id, fim])
  return (
    <span ref={ref} className={`aps-flutuante aps-flutuante-${f.tipo}`} aria-hidden>
      <span>{f.texto}</span>
    </span>
  )
}

/** "+N pts" que sobe a partir do ativo onde a ação aconteceu. */
export function Flutuantes() {
  const [lista, setLista] = useState<Flutuante[]>([])
  useEffect(
    () =>
      useEfeitos.subscribe((s, prev) => {
        const vistos = new Set(prev.efeitos.map((e) => e.id))
        const novos: Flutuante[] = []
        const { indice, layout } = useAppSecData.getState()
        for (const e of s.efeitos) {
          if (vistos.has(e.id) || !e.flutuante || !e.ativoId) continue
          const i = indice.posAtivo.get(e.ativoId)
          if (i === undefined) continue
          novos.push({ id: e.id, texto: e.flutuante, tipo: e.tipo, pos: [layout.pos[i * 2], (cenaAnimada.topo[i] || PLACA_H + 1) + 0.6, layout.pos[i * 2 + 1]] })
        }
        if (novos.length) setLista((l) => [...l, ...novos])
      }),
    [],
  )
  const fim = useCallback((id: number) => setLista((l) => l.filter((f) => f.id !== id)), [])
  return (
    <div className="aps-flutuantes">
      {lista.map((f) => (
        <UmFlutuante key={f.id} f={f} fim={fim} />
      ))}
    </div>
  )
}

function Toast({ e }: { e: Efeito }) {
  const remover = useEfeitos((s) => s.remover)
  useEffect(() => {
    const id = window.setTimeout(() => remover(e.id), e.tipo === 'acao' ? DURACAO_TOAST : DURACAO_TOAST + 1600)
    return () => window.clearTimeout(id)
  }, [e.id, e.tipo, remover])
  return (
    <li className={`aps-toast aps-toast-${e.tipo}`}>
      <span className="aps-toast-icone" aria-hidden>
        {e.tipo === 'acao' ? '✓' : e.tipo === 'conquista' ? '★' : '▲'}
      </span>
      <span>{e.mensagem}</span>
      <button type="button" className="aps-toast-fechar" onClick={() => remover(e.id)} aria-label="Dispensar aviso">
        ×
      </button>
    </li>
  )
}

/** Avisos das ações (anunciados a leitores de tela). */
export function Toasts() {
  const efeitos = useEfeitos((s) => s.efeitos)
  return (
    <div className="aps-toasts" role="status" aria-live="polite" aria-label="Avisos">
      <ul>
        {efeitos.map((e) => (
          <Toast key={e.id} e={e} />
        ))}
      </ul>
    </div>
  )
}
