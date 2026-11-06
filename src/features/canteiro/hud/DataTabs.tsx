import { useCallback, useId, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Aba } from '../data/lookup'
import { linhaDaSelecao } from '../data/lookup'
import { useObraData } from '../data/store'
import type { Concretagem } from '../data/types'
import { useCanteiroStore } from '../state/canteiroStore'
import { useSelecionar } from '../state/useSelecionar'
import { useEntidade } from './DetailCard'
import { dataCurta, num1, pct } from './format'
import { Meter } from './Meter'
import { StatusPill } from './StatusPill'

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'equipamentos', rotulo: 'Equipamentos' },
  { id: 'concretagens', rotulo: 'Concretagens' },
  { id: 'equipes', rotulo: 'Equipes' },
]

interface Coluna {
  rotulo: string
  num?: boolean
}

interface LinhaProps {
  id: string
  codigo: string
  selecionada: boolean
  celulas: { rotulo: string; conteudo: ReactNode; num?: boolean; longo?: boolean }[]
  onSelecionar: (id: string) => void
}

/** Linha clicável: o código é um botão (foco por teclado); a linha inteira responde ao clique. */
function Linha({ id, codigo, selecionada, celulas, onSelecionar }: LinhaProps) {
  const onClick = useCallback(() => onSelecionar(id), [id, onSelecionar])
  return (
    <tr className={selecionada ? 'is-selected' : undefined} aria-current={selecionada ? 'true' : undefined} onClick={onClick}>
      <th scope="row" data-label="Código">
        {/* O clique (ou Enter/Espaço) no botão sobe até a linha. */}
        <button type="button" className="cnt-row-btn cnt-mono" aria-label={`Selecionar ${codigo} na cena`}>
          {codigo}
        </button>
      </th>
      {celulas.map((c) => (
        <td key={c.rotulo} data-label={c.rotulo} className={c.num ? 'cnt-num' : c.longo ? 'cnt-ellipsis' : undefined}>
          {c.conteudo}
        </td>
      ))}
    </tr>
  )
}

function Tabela({ colunas, children, legenda }: { colunas: Coluna[]; children: ReactNode; legenda: string }) {
  return (
    <table className="cnt-table">
      <caption className="cnt-sr">{legenda}</caption>
      <thead>
        <tr>
          <th scope="col">Código</th>
          {colunas.map((c) => (
            <th key={c.rotulo} scope="col" className={c.num ? 'cnt-num' : undefined}>
              {c.rotulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

/**
 * Concretagens relevantes para hoje: a em andamento, as próximas e as últimas.
 * Se a seleção aponta para uma concretagem antiga, ela entra no topo da lista.
 */
export function concretagensRelevantes(lista: Concretagem[], selecionadaId?: string | null): Concretagem[] {
  const andamento = lista.filter((c) => c.status === 'em_andamento')
  const concluidas = lista.filter((c) => c.status === 'concluida').slice(-4).reverse()
  const proximas = lista.filter((c) => c.status === 'programada').slice(0, 2)
  const base = [...andamento, ...proximas, ...concluidas]
  const extra = selecionadaId && !base.some((c) => c.id === selecionadaId) ? lista.find((c) => c.id === selecionadaId) : undefined
  return extra ? [extra, ...base] : base
}

function Duas({ principal, secundaria }: { principal: ReactNode; secundaria: ReactNode }) {
  return (
    <span className="cnt-cell-2">
      <span>{principal}</span>
      <span className="cnt-cell-sub">{secundaria}</span>
    </span>
  )
}

export function DataTabs() {
  const aba = useCanteiroStore((s) => s.aba)
  const setAba = useCanteiroStore((s) => s.setAba)
  const selecionadoId = useCanteiroStore((s) => s.selecionadoId)
  const entidade = useEntidade(selecionadoId)
  const linhaAtiva = linhaDaSelecao(entidade)
  const selecionar = useSelecionar()
  const equipamentos = useObraData((d) => d.equipamentos)
  const concretagens = useObraData((d) => d.concretagens)
  const equipes = useObraData((d) => d.equipes)
  const relevantes = useMemo(() => concretagensRelevantes(concretagens, linhaAtiva), [concretagens, linhaAtiva])
  const base = useId()
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let prox = i
    if (e.key === 'ArrowRight') prox = (i + 1) % ABAS.length
    else if (e.key === 'ArrowLeft') prox = (i - 1 + ABAS.length) % ABAS.length
    else if (e.key === 'Home') prox = 0
    else if (e.key === 'End') prox = ABAS.length - 1
    else return
    e.preventDefault()
    setAba(ABAS[prox].id)
    tabsRef.current[prox]?.focus()
  }

  const visiveis = equipamentos.filter((e) => e.status !== 'liberado')

  return (
    <section className="cnt-panel cnt-tabs" aria-label="Equipamentos, concretagens e equipes">
      <div role="tablist" className="cnt-tablist" aria-label="Escolha a lista">
        {ABAS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabsRef.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={aba === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={aba === t.id ? 0 : -1}
            className={aba === t.id ? 'is-active' : undefined}
            onClick={() => setAba(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.rotulo}
            <span className="cnt-tab-count cnt-mono">
              {t.id === 'equipamentos' ? visiveis.length : t.id === 'concretagens' ? relevantes.length : equipes.length}
            </span>
          </button>
        ))}
      </div>

      <div className="cnt-tabpanel" role="tabpanel" id={`${base}-panel-${aba}`} aria-labelledby={`${base}-tab-${aba}`} tabIndex={0}>
        {aba === 'equipamentos' && (
          <Tabela legenda="Equipamentos no canteiro" colunas={[{ rotulo: 'Equipamento' }, { rotulo: 'Status' }, { rotulo: 'Utilização', num: true }]}>
            {visiveis.map((e) => (
              <Linha
                key={e.id}
                id={e.id}
                codigo={e.codigo}
                selecionada={linhaAtiva === e.id}
                onSelecionar={selecionar}
                celulas={[
                  { rotulo: 'Equipamento', longo: true, conteudo: e.remessa ? `Betoneira · ${e.remessa.placa}` : e.nome },
                  { rotulo: 'Status', conteudo: <StatusPill status={e.status} /> },
                  {
                    rotulo: 'Utilização',
                    num: true,
                    conteudo: (
                      <span className="cnt-cell-meter">
                        <Meter valor={e.utilizacao} tom={e.status === 'parado' ? 'vermelho' : 'azul'} rotulo={`Utilização de ${e.codigo}`} />
                        <span className="cnt-mono">{pct(e.utilizacao)}</span>
                      </span>
                    ),
                  },
                ]}
              />
            ))}
          </Tabela>
        )}

        {aba === 'concretagens' && (
          <Tabela legenda="Concretagens recentes e programadas" colunas={[{ rotulo: 'Elemento' }, { rotulo: 'Status' }, { rotulo: 'Volume', num: true }]}>
            {relevantes.map((c) => (
              <Linha
                key={c.id}
                id={c.id}
                codigo={c.codigo}
                selecionada={linhaAtiva === c.id}
                onSelecionar={selecionar}
                celulas={[
                  { rotulo: 'Elemento', longo: true, conteudo: <Duas principal={c.descricao} secundaria={<span className="cnt-mono">{dataCurta(c.data)}</span>} /> },
                  { rotulo: 'Status', conteudo: <StatusPill status={c.status} /> },
                  {
                    rotulo: 'Volume',
                    num: true,
                    conteudo: (
                      <span className="cnt-cell-meter">
                        <Meter valor={c.volumeLancadoM3 / c.volumeProgramadoM3} tom={c.status === 'concluida' ? 'verde' : 'azul'} rotulo={`Volume lançado de ${c.codigo}`} />
                        <span className="cnt-mono">{num1(c.volumeProgramadoM3)} m³</span>
                      </span>
                    ),
                  },
                ]}
              />
            ))}
          </Tabela>
        )}

        {aba === 'equipes' && (
          <Tabela legenda="Equipes no canteiro" colunas={[{ rotulo: 'Equipe' }, { rotulo: 'FVS' }, { rotulo: 'Avanço', num: true }]}>
            {equipes.map((e) => (
              <Linha
                key={e.id}
                id={e.id}
                codigo={e.codigo}
                selecionada={linhaAtiva === e.id}
                onSelecionar={selecionar}
                celulas={[
                  { rotulo: 'Equipe', longo: true, conteudo: <Duas principal={`${e.nome} · ${e.membros} pessoas`} secundaria={e.local} /> },
                  { rotulo: 'FVS', conteudo: <StatusPill status={e.fvs.status} /> },
                  {
                    rotulo: 'Avanço',
                    num: true,
                    conteudo: (
                      <span className="cnt-cell-meter">
                        <Meter valor={e.progresso} tom={e.progresso >= 1 ? 'verde' : 'azul'} rotulo={`Avanço de ${e.codigo}`} />
                        <span className="cnt-mono">{pct(e.progresso)}</span>
                      </span>
                    ),
                  },
                ]}
              />
            ))}
          </Tabela>
        )}
      </div>
    </section>
  )
}
