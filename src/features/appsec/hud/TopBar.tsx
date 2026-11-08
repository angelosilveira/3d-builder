import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { buscar, type ResultadoBusca } from '../data/derived'
import { useAppSecData } from '../data/store'
import { useAppSecUi } from '../state/uiStore'
import { num } from './format'

const GRUPO: Record<ResultadoBusca['tipo'], string> = {
  ativo: 'Ativo',
  qualificacao: 'Qualificação',
  projeto: 'Projeto',
  vulnerabilidade: 'Vulnerabilidade',
  analista: 'Analista',
}

function Busca() {
  const data = useAppSecData((s) => s.data)
  const selecionar = useAppSecUi((s) => s.selecionar)
  const [termo, setTermo] = useState('')
  const [ativo, setAtivo] = useState(0)
  const [aberto, setAberto] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const listaId = useId()
  const resultados = useMemo(() => buscar(data, termo), [data, termo])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const escolher = useCallback(
    (r: ResultadoBusca) => {
      selecionar({ tipo: r.tipo, id: r.id })
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
      escolher(resultados[ativo])
    } else if (e.key === 'Escape') {
      setTermo('')
      setAberto(false)
      input.current?.blur()
    }
  }

  const mostrar = aberto && termo.trim().length > 0
  return (
    <div className="aps-busca">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="aps-busca-icone">
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
        aria-label="Buscar ativos, projetos, vulnerabilidades e analistas"
        placeholder="Buscar ativo, projeto, qualificação (QLF-…), vulnerabilidade ou analista…"
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
        <ul className="aps-panel aps-busca-lista" role="listbox" id={listaId} aria-label="Resultados da busca">
          {resultados.length === 0 ? (
            <li role="presentation" className="aps-busca-vazio">
              Nada encontrado para “{termo}”. Tente o nome do ativo (ms-pix…), um código (ATV-00012) ou um CWE.
            </li>
          ) : (
            resultados.map((r, i) => (
              <li
                key={`${r.tipo}-${r.id}`}
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={i === ativo}
                className={i === ativo ? 'is-ativo' : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => escolher(r)}
              >
                <span className="aps-busca-titulo">{r.titulo}</span>
                <span className="aps-busca-meta">
                  {GRUPO[r.tipo]} · {r.detalhe}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export function TopBar() {
  const data = useAppSecData((s) => s.data)
  return (
    <header className="aps-topbar aps-panel">
      <Link to="/" className="aps-voltar" aria-label="Voltar para o sistema">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path d="M12 2.5 4 5.5v6c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10v-6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          Qualificação <b>AppSec</b>
        </span>
      </Link>
      <Busca />
      <p className="aps-escopo">
        <span>{num(data.ativos.length)} ativos</span>
        <span>{data.projetos.length} projetos</span>
        <span>{data.areas.length} áreas</span>
      </p>
      <div className="aps-usuario">
        <span className="aps-avatar" aria-hidden>
          LC
        </span>
        <span className="aps-usuario-txt">
          <strong>Luiza Carvalho</strong>
          <span>Coordenação AppSec</span>
        </span>
      </div>
    </header>
  )
}
