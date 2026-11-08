import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { SEVERIDADES, TIPO_LABEL } from '../data/catalogo'
import { pendenciaVencida, vulnAberta, vulnVencida } from '../data/derived'
import { useAppSecData } from '../data/store'
import type { Selecao } from '../data/types'
import { useAppSecUi, type Aba } from '../state/uiStore'
import { useMascara } from '../state/useMascara'
import { dataCurta, num, pct, textoPrazo } from './format'
import { BarraEmpilhada, contarStatus, IconeTipo, PilulaPendencia, PilulaSeveridade, PilulaStatus, STATUS_PARTES } from './ui'

export const ALTURA_LINHA = 38

interface Coluna<T> {
  rotulo: string
  render: (item: T) => ReactNode
  classe?: string
}

interface TabelaProps<T> {
  legenda: string
  itens: T[]
  colunas: Coluna<T>[]
  codigo: (item: T) => string
  sel: (item: T) => Selecao
  selecionadoId: string | null
}

/**
 * Tabela virtualizada: só as linhas visíveis vão para o DOM, mas a semântica
 * de tabela é mantida (aria-rowcount/aria-rowindex) para leitores de tela.
 */
function TabelaVirtual<T>({ legenda, itens, colunas, codigo, sel, selecionadoId }: TabelaProps<T>) {
  const selecionar = useAppSecUi((s) => s.selecionar)
  const caixa = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(0)
  const [altura, setAltura] = useState(240)

  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => setAltura(el.clientHeight || 240)) : null
    ro?.observe(el)
    setAltura(el.clientHeight || 240)
    return () => ro?.disconnect()
  }, [])

  // Seleção vinda da cena: rola até a linha, se ela estiver fora da vista.
  const posSelecionado = useMemo(() => (selecionadoId ? itens.findIndex((i) => sel(i).id === selecionadoId) : -1), [itens, selecionadoId, sel])
  useEffect(() => {
    const el = caixa.current
    if (!el || posSelecionado < 0) return
    const topo = posSelecionado * ALTURA_LINHA
    if (topo < el.scrollTop || topo > el.scrollTop + el.clientHeight - ALTURA_LINHA * 2) {
      el.scrollTop = Math.max(0, topo - el.clientHeight / 2)
    }
  }, [posSelecionado])

  const inicio = Math.max(0, Math.floor(scroll / ALTURA_LINHA) - 6)
  const fim = Math.min(itens.length, Math.ceil((scroll + altura) / ALTURA_LINHA) + 6)
  const visiveis = itens.slice(inicio, fim)

  return (
    <div className="aps-tabela-caixa" ref={caixa} onScroll={(e) => setScroll(e.currentTarget.scrollTop)}>
      <table className="aps-tabela" aria-rowcount={itens.length + 1}>
        <caption className="aps-sr">
          {legenda} ({num(itens.length)})
        </caption>
        <thead>
          <tr aria-rowindex={1}>
            <th scope="col">Código</th>
            {colunas.map((c) => (
              <th key={c.rotulo} scope="col" className={c.classe}>
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inicio > 0 && <tr aria-hidden style={{ height: inicio * ALTURA_LINHA }} />}
          {visiveis.map((item, k) => {
            const s = sel(item)
            const ativa = s.id === selecionadoId
            return (
              <tr
                key={s.id}
                aria-rowindex={inicio + k + 2}
                aria-current={ativa ? 'true' : undefined}
                className={ativa ? 'is-sel' : undefined}
                style={{ height: ALTURA_LINHA }}
                onClick={() => selecionar(s)}
              >
                <th scope="row" data-label="Código">
                  {/* Enter/Espaço no botão sobem como clique até a linha. */}
                  <button type="button" className="aps-linha-btn aps-mono" aria-label={`Selecionar ${codigo(item)}`}>
                    {codigo(item)}
                  </button>
                </th>
                {colunas.map((c) => (
                  <td key={c.rotulo} data-label={c.rotulo} className={c.classe}>
                    {c.render(item)}
                  </td>
                ))}
              </tr>
            )
          })}
          {fim < itens.length && <tr aria-hidden style={{ height: (itens.length - fim) * ALTURA_LINHA }} />}
        </tbody>
      </table>
      {itens.length === 0 && <p className="aps-vazio">Nenhum item com os filtros atuais. Ajuste ou limpe os filtros à esquerda.</p>}
    </div>
  )
}

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'ativos', rotulo: 'Ativos' },
  { id: 'vulnerabilidades', rotulo: 'Vulnerabilidades' },
  { id: 'pendencias', rotulo: 'Pendências' },
  { id: 'projetos', rotulo: 'Projetos' },
  { id: 'analistas', rotulo: 'Analistas' },
]

export function DataTabs() {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const mascara = useMascara()
  const aba = useAppSecUi((s) => s.aba)
  const setAba = useAppSecUi((s) => s.setAba)
  const selecao = useAppSecUi((s) => s.selecao)
  const base = useId()
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const agora = indice.agora
  const dentro = useCallback((ativoId: string) => mascara[indice.posAtivo.get(ativoId) ?? -1] === 1, [mascara, indice])

  // Listas já ordenadas por prioridade de ação.
  const listas = useMemo(() => {
    const ativos = data.ativos.filter((a) => dentro(a.id)).sort((a, b) => indice.risco[indice.posAtivo.get(b.id)!] - indice.risco[indice.posAtivo.get(a.id)!])
    const vulnerabilidades = data.vulnerabilidades
      .filter((v) => vulnAberta(v) && dentro(v.ativoId))
      .sort(
        (a, b) =>
          Number(vulnVencida(b, agora)) - Number(vulnVencida(a, agora)) ||
          SEVERIDADES.indexOf(a.severidade) - SEVERIDADES.indexOf(b.severidade) ||
          a.prazo.localeCompare(b.prazo),
      )
    const pendencias = data.pendencias.filter((p) => p.status === 'aberta' && dentro(p.ativoId)).sort((a, b) => a.prazo.localeCompare(b.prazo))
    const projetos = data.projetos
      .map((p) => {
        const ativosP = (indice.ativosPorProjeto.get(p.id) ?? []).filter((a) => dentro(a.id))
        const criticas = ativosP.reduce((s, a) => s + (indice.vulnsPorAtivo.get(a.id) ?? []).filter((v) => v.severidade === 'critica' && vulnAberta(v)).length, 0)
        return { projeto: p, ativos: ativosP, criticas, status: contarStatus(ativosP) }
      })
      .filter((p) => p.ativos.length > 0)
      .sort((a, b) => b.criticas - a.criticas || b.status.reprovado - a.status.reprovado)
    const analistas = data.analistas
      .map((a) => {
        const ativosA = (indice.ativosPorAnalista.get(a.id) ?? []).filter((x) => dentro(x.id))
        const pend = ativosA.reduce((s, x) => s + (indice.pendPorAtivo.get(x.id) ?? []).filter((p) => pendenciaVencida(p, agora)).length, 0)
        return { analista: a, ativos: ativosA, status: contarStatus(ativosA), pendVencidas: pend }
      })
      .sort((a, b) => b.status.rascunho - a.status.rascunho)
    return { ativos, vulnerabilidades, pendencias, projetos, analistas }
  }, [data, indice, dentro, agora])

  const contagem: Record<Aba, number> = {
    ativos: listas.ativos.length,
    vulnerabilidades: listas.vulnerabilidades.length,
    pendencias: listas.pendencias.length,
    projetos: listas.projetos.length,
    analistas: listas.analistas.length,
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const destino = { ArrowRight: (i + 1) % ABAS.length, ArrowLeft: (i - 1 + ABAS.length) % ABAS.length, Home: 0, End: ABAS.length - 1 }[e.key]
    if (destino === undefined) return
    e.preventDefault()
    setAba(ABAS[destino].id)
    tabs.current[destino]?.focus()
  }

  const selId = selecao?.id ?? null

  return (
    <section className="aps-panel aps-tabs" aria-label="Listas de ativos, vulnerabilidades, pendências, projetos e analistas">
      <div role="tablist" className="aps-tablist" aria-label="Escolha a lista">
        {ABAS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={aba === t.id}
            aria-controls={`${base}-painel`}
            tabIndex={aba === t.id ? 0 : -1}
            className={aba === t.id ? 'is-ativa' : undefined}
            onClick={() => setAba(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.rotulo}
            <span className="aps-tab-n aps-mono">{num(contagem[t.id])}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-painel`} aria-labelledby={`${base}-tab-${aba}`} className="aps-tabpanel">
        {aba === 'ativos' && (
          <TabelaVirtual
            legenda="Ativos ordenados por risco"
            itens={listas.ativos}
            codigo={(a) => a.codigo}
            sel={(a) => ({ tipo: 'ativo', id: a.id })}
            selecionadoId={selId}
            colunas={[
              {
                rotulo: 'Ativo',
                classe: 'aps-col-longa',
                render: (a) => (
                  <span className="aps-cel-ativo">
                    <IconeTipo tipo={a.tipo} />
                    <span className="aps-mono" title={`${TIPO_LABEL[a.tipo]} · ${a.nome}`}>
                      {a.nome}
                    </span>
                  </span>
                ),
              },
              { rotulo: 'Status', render: (a) => <PilulaStatus status={a.qualificacao.status} /> },
              { rotulo: 'Vuln. abertas', classe: 'aps-num', render: (a) => <span className="aps-mono">{indice.abertas[indice.posAtivo.get(a.id)!] || '—'}</span> },
            ]}
          />
        )}
        {aba === 'vulnerabilidades' && (
          <TabelaVirtual
            legenda="Vulnerabilidades abertas, fora do SLA primeiro"
            itens={listas.vulnerabilidades}
            codigo={(v) => v.codigo}
            sel={(v) => ({ tipo: 'vulnerabilidade', id: v.id })}
            selecionadoId={selId}
            colunas={[
              { rotulo: 'Severidade', render: (v) => <PilulaSeveridade severidade={v.severidade} /> },
              { rotulo: 'Vulnerabilidade', classe: 'aps-col-longa', render: (v) => <span title={v.titulo}>{v.titulo}</span> },
              {
                rotulo: 'Prazo',
                render: (v) => (
                  <span className={`aps-mono${vulnVencida(v, agora) ? ' aps-txt-ruim' : ''}`} title={textoPrazo(v.prazo, agora)}>
                    {dataCurta(v.prazo)}
                  </span>
                ),
              },
            ]}
          />
        )}
        {aba === 'pendencias' && (
          <TabelaVirtual
            legenda="Pendências abertas por prazo"
            itens={listas.pendencias}
            codigo={(p) => p.codigo}
            sel={(p) => ({ tipo: 'pendencia', id: p.id })}
            selecionadoId={selId}
            colunas={[
              { rotulo: 'Pendência', classe: 'aps-col-longa', render: (p) => <span title={p.descricao}>{p.descricao}</span> },
              { rotulo: 'Situação', render: (p) => <PilulaPendencia status={p.status} vencida={pendenciaVencida(p, agora)} /> },
              { rotulo: 'Prazo', render: (p) => <span className="aps-mono">{dataCurta(p.prazo)}</span> },
            ]}
          />
        )}
        {aba === 'projetos' && (
          <TabelaVirtual
            legenda="Projetos com mais vulnerabilidades críticas primeiro"
            itens={listas.projetos}
            codigo={(p) => p.projeto.codigo}
            sel={(p) => ({ tipo: 'projeto', id: p.projeto.id })}
            selecionadoId={selId}
            colunas={[
              { rotulo: 'Projeto', classe: 'aps-col-longa', render: (p) => p.projeto.nome },
              { rotulo: 'Status dos ativos', render: (p) => <BarraEmpilhada partes={STATUS_PARTES(p.status)} rotulo={`Ativos de ${p.projeto.nome}`} /> },
              { rotulo: 'Críticas', classe: 'aps-num', render: (p) => <span className={`aps-mono${p.criticas ? ' aps-txt-ruim' : ''}`}>{p.criticas}</span> },
            ]}
          />
        )}
        {aba === 'analistas' && (
          <TabelaVirtual
            legenda="Analistas com mais rascunhos primeiro"
            itens={listas.analistas}
            codigo={(a) => a.analista.iniciais}
            sel={(a) => ({ tipo: 'analista', id: a.analista.id })}
            selecionadoId={selId}
            colunas={[
              { rotulo: 'Analista', classe: 'aps-col-longa', render: (a) => a.analista.nome },
              { rotulo: 'Ativos', classe: 'aps-num', render: (a) => <span className="aps-mono">{num(a.ativos.length)}</span> },
              { rotulo: 'Aprovados', classe: 'aps-num', render: (a) => <span className="aps-mono">{pct(a.status.aprovado / Math.max(1, a.ativos.length - a.status.depreciado))}</span> },
              { rotulo: 'Rascunhos', classe: 'aps-num', render: (a) => <span className="aps-mono">{a.status.rascunho}</span> },
              { rotulo: 'Pend. vencidas', classe: 'aps-num', render: (a) => <span className={`aps-mono${a.pendVencidas ? ' aps-txt-ruim' : ''}`}>{a.pendVencidas}</span> },
            ]}
          />
        )}
      </div>
    </section>
  )
}
