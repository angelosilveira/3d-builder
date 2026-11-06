import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { alertasAtivos } from '../data/live'
import { buscar } from '../data/lookup'
import { avancoFisico } from '../data/schedule'
import { useObraData, useObraDataStore } from '../data/store'
import type { ObraData } from '../data/types'
import { useCanteiroStore } from '../state/canteiroStore'
import { useAgora } from '../state/useAgora'
import { useSelecionar } from '../state/useSelecionar'
import { horaSeg, pct } from './format'

function Marca() {
  return (
    <a className="cnt-brand" href="/" aria-label="Obra3D — voltar para a lista de obras">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path d="M3 21V9l9-6 9 6v12" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 21v-7h8v7" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span>
        Obra<b>3D</b>
      </span>
    </a>
  )
}

function BuscaGlobal() {
  const dados = useObraData((d) => d)
  const selecionar = useSelecionar()
  const [termo, setTermo] = useState('')
  const [ativo, setAtivo] = useState(0)
  const [aberto, setAberto] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const listaId = useId()
  const resultados = useMemo(() => buscar(dados, termo), [dados, termo])

  // Atalho "/" foca a busca (exceto quando já se está digitando em um campo).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return
      const alvo = e.target as HTMLElement
      if (alvo.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const escolher = useCallback(
    (id: string) => {
      selecionar(id)
      setTermo('')
      setAberto(false)
      input.current?.blur()
    },
    [selecionar],
  )

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAberto(true)
      setAtivo((i) => Math.min(i + 1, resultados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && resultados[ativo]) {
      e.preventDefault()
      escolher(resultados[ativo].id)
    } else if (e.key === 'Escape') {
      setTermo('')
      setAberto(false)
      input.current?.blur()
    }
  }

  const mostrar = aberto && termo.trim().length > 0
  return (
    <div className="cnt-search">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="cnt-search-icon">
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={mostrar && resultados[ativo] ? `${listaId}-${ativo}` : undefined}
        aria-label="Buscar elementos, equipamentos, equipes e concretagens"
        placeholder="Buscar elementos, equipamentos, equipes, concretagens…"
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value)
          setAtivo(0)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => window.setTimeout(() => setAberto(false), 120)}
        onKeyDown={onKeyDown}
      />
      <kbd aria-hidden>/</kbd>
      {mostrar && (
        <ul className="cnt-panel cnt-search-results" role="listbox" id={listaId} aria-label="Resultados da busca">
          {resultados.length === 0 ? (
            <li className="cnt-search-empty" role="presentation">
              Nada encontrado para “{termo}”. Tente um código como P12, BT-02 ou C-012.
            </li>
          ) : (
            resultados.map((r, i) => (
              <li
                key={r.id}
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={i === ativo}
                className={i === ativo ? 'is-active' : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => escolher(r.id)}
              >
                <span className="cnt-search-title">{r.titulo}</span>
                <span className="cnt-search-meta">
                  {r.grupo} · {r.subtitulo}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

const percentualObra = (d: ObraData) => avancoFisico(d, d.obra.semanaAtual, 'executado')

function SeletorObra() {
  const obras = useObraDataStore((s) => s.obras)
  const obraId = useCanteiroStore((s) => s.obraId)
  const setObra = useCanteiroStore((s) => s.setObra)
  const opcoes = useMemo(
    () => Object.values(obras).map((d) => ({ id: d.obra.id, rotulo: `${d.obra.codigo} · ${d.obra.nome} · ${pct(percentualObra(d))} executado` })),
    // O percentual vem do cronograma, que não muda com os ticks ao vivo.
    [obras],
  )
  return (
    <label className="cnt-obra">
      <span className="cnt-sr">Obra</span>
      <select value={obraId} onChange={(e) => setObra(e.target.value)}>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  )
}

function AoVivo() {
  const agora = useAgora(1000)
  return (
    <p className="cnt-live">
      <span className="cnt-live-dot" aria-hidden />
      <span>Ao vivo</span>
      <time className="cnt-mono" dateTime={agora.toISOString()}>
        {horaSeg(agora)}
      </time>
    </p>
  )
}

function Notificacoes() {
  const dados = useObraData((d) => d)
  const agora = useAgora(5000)
  const alertas = useMemo(() => alertasAtivos(dados, agora), [dados, agora])
  const selecionar = useSelecionar()
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const painelId = useId()

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  const criticos = alertas.filter((a) => a.severidade === 'critico').length
  return (
    <div className="cnt-notif" ref={raiz}>
      <button
        type="button"
        className="cnt-icon-btn"
        aria-expanded={aberto}
        aria-controls={painelId}
        aria-label={`Notificações: ${alertas.length} alertas, ${criticos} críticos`}
        onClick={() => setAberto((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z M10 20.5h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        {alertas.length > 0 && <span className={`cnt-badge${criticos ? ' is-bad' : ''}`}>{alertas.length}</span>}
      </button>
      {aberto && (
        <div className="cnt-panel cnt-notif-panel" id={painelId}>
          <p className="cnt-eyebrow">Precisa da sua atenção</p>
          <ul className="cnt-list">
            {alertas.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`cnt-alerta cnt-alerta-${a.severidade}`}
                  onClick={() => {
                    selecionar(a.alvoId)
                    setAberto(false)
                  }}
                >
                  <strong>{a.titulo}</strong>
                  <span>{a.descricao}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  return (
    <header className="cnt-topbar cnt-panel">
      <Marca />
      <BuscaGlobal />
      <SeletorObra />
      <div className="cnt-topbar-end">
        <AoVivo />
        <Notificacoes />
        <div className="cnt-user">
          <span className="cnt-avatar" aria-hidden>
            MD
          </span>
          <span className="cnt-user-txt">
            <strong>Marina Duarte</strong>
            <span>Engenheira responsável</span>
          </span>
        </div>
      </div>
    </header>
  )
}
