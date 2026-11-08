import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import {
  CRITICIDADE_LABEL,
  FORMULARIOS,
  ORIGEM_LABEL,
  SEVERIDADES,
  SEVERIDADE_LABEL,
  STATUS_LABEL,
  TIPO_LABEL,
  TIPOS,
} from '../data/catalogo'
import { abertasPorSeveridade, pendenciaVencida, respostasDo, vulnAberta, vulnVencida } from '../data/derived'
import { useAppSecData } from '../data/store'
import type { Ativo, Resposta, Selecao, Vulnerabilidade } from '../data/types'
import { useAppSecUi } from '../state/uiStore'
import { data as fmtData, num, pct, textoPrazo } from './format'
import {
  BarraEmpilhada,
  contarStatus,
  IconeTipo,
  Medidor,
  PilulaPendencia,
  PilulaSeveridade,
  PilulaStatus,
  PilulaVuln,
  STATUS_PARTES,
  TipoRotulo,
} from './ui'

/* ---------------- Peças comuns ---------------- */

function Campo({ rotulo, children, mono }: { rotulo: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="aps-campo">
      <dt>{rotulo}</dt>
      <dd className={mono ? 'aps-mono' : undefined}>{children}</dd>
    </div>
  )
}

function Cabecalho({ eyebrow, titulo, codigo, selo, mono }: { eyebrow: ReactNode; titulo: string; codigo?: string; selo?: ReactNode; mono?: boolean }) {
  return (
    <header className="aps-card-head">
      <p className="aps-eyebrow">{eyebrow}</p>
      <h2 className={mono ? 'aps-titulo aps-titulo-mono' : 'aps-titulo'}>{titulo}</h2>
      {(codigo || selo) && (
        <div className="aps-card-meta">
          {codigo && <span className="aps-mono aps-codigo">{codigo}</span>}
          {selo}
        </div>
      )}
    </header>
  )
}

function Secao({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="aps-sec">
      <div className="aps-sec-topo">
        <h3>{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  )
}

function Aviso({ tom, children }: { tom: 'ruim' | 'alerta' | 'neutro'; children: ReactNode }) {
  return <p className={`aps-aviso aps-aviso-${tom}`}>{children}</p>
}

/** Link interno que troca a seleção (ativo, projeto, analista…). */
function Ir({ sel, children }: { sel: Selecao; children: ReactNode }) {
  const selecionar = useAppSecUi((s) => s.selecionar)
  return (
    <button type="button" className="aps-ir" onClick={() => selecionar(sel)}>
      {children}
    </button>
  )
}

function ContagemSeveridade({ vulns }: { vulns: Vulnerabilidade[] }) {
  const c = abertasPorSeveridade(vulns)
  return (
    <ul className="aps-sevs" aria-label="Vulnerabilidades abertas por severidade">
      {SEVERIDADES.map((s) => (
        <li key={s} className={c[s] ? undefined : 'is-zero'}>
          <span className={`aps-sev-dot aps-sevbg-${s}`} aria-hidden />
          <b className="aps-mono">{c[s]}</b> {SEVERIDADE_LABEL[s]}
        </li>
      ))}
    </ul>
  )
}

function ListaAtivos({ ativos, limite = 6 }: { ativos: Ativo[]; limite?: number }) {
  const indice = useAppSecData((s) => s.indice)
  const ordenados = useMemo(
    () => [...ativos].sort((a, b) => indice.risco[indice.posAtivo.get(b.id)!] - indice.risco[indice.posAtivo.get(a.id)!]).slice(0, limite),
    [ativos, indice, limite],
  )
  return (
    <ul className="aps-lista">
      {ordenados.map((a) => {
        const i = indice.posAtivo.get(a.id)!
        return (
          <li key={a.id}>
            <Ir sel={{ tipo: 'ativo', id: a.id }}>
              <IconeTipo tipo={a.tipo} />
              <span className="aps-lista-nome aps-mono">{a.nome}</span>
              <span className="aps-lista-extra">{indice.abertas[i] ? `${indice.abertas[i]} vuln.` : ''}</span>
              <i className={`aps-dot aps-bg-${a.qualificacao.status}`} title={STATUS_LABEL[a.qualificacao.status]} />
            </Ir>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------------- Formulário de qualificação ---------------- */

const RESPOSTA: Record<Exclude<Resposta, null> | 'vazia', { rotulo: string; classe: string; simbolo: string }> = {
  sim: { rotulo: 'Sim', classe: 'ok', simbolo: '✓' },
  nao: { rotulo: 'Não', classe: 'ruim', simbolo: '✕' },
  parcial: { rotulo: 'Parcial', classe: 'alerta', simbolo: '◐' },
  nao_se_aplica: { rotulo: 'Não se aplica', classe: 'neutro', simbolo: '–' },
  vazia: { rotulo: 'Sem resposta', classe: 'vazia', simbolo: '○' },
}

function Formulario({ ativo }: { ativo: Ativo }) {
  const respostas = useMemo(() => respostasDo(ativo), [ativo])
  const secoes = FORMULARIOS[ativo.tipo]
  return (
    <div className="aps-form">
      {secoes.map((s) => {
        const resp = s.perguntas.map((p) => respostas[p.id])
        const respondidas = resp.filter((r) => r !== null).length
        const negativas = resp.filter((r) => r === 'nao').length
        return (
          <details key={s.id} className="aps-form-sec">
            <summary>
              <span>{s.titulo}</span>
              <span className={`aps-mono aps-form-conta${negativas ? ' is-ruim' : respondidas < resp.length ? ' is-parcial' : ''}`}>
                {respondidas}/{resp.length}
                {negativas ? ` · ${negativas} não` : ''}
              </span>
            </summary>
            <ul>
              {s.perguntas.map((p) => {
                const r = RESPOSTA[respostas[p.id] ?? 'vazia']
                return (
                  <li key={p.id}>
                    <span className={`aps-resp aps-resp-${r.classe}`} aria-label={r.rotulo} title={r.rotulo}>
                      {r.simbolo}
                    </span>
                    <span>{p.texto}</span>
                  </li>
                )
              })}
            </ul>
          </details>
        )
      })}
    </div>
  )
}

/* ---------------- Cards por tipo ---------------- */

function CardAtivo({ ativo }: { ativo: Ativo }) {
  const indice = useAppSecData((s) => s.indice)
  const data = useAppSecData((s) => s.data)
  const projeto = data.projetos.find((p) => p.id === ativo.projetoId)!
  const area = data.areas.find((a) => a.id === ativo.areaId)!
  const analista = data.analistas.find((a) => a.id === ativo.analistaId)!
  const vulns = useMemo(
    () =>
      [...(indice.vulnsPorAtivo.get(ativo.id) ?? [])].sort(
        (a, b) => Number(vulnAberta(b)) - Number(vulnAberta(a)) || SEVERIDADES.indexOf(a.severidade) - SEVERIDADES.indexOf(b.severidade),
      ),
    [indice, ativo.id],
  )
  const pend = indice.pendPorAtivo.get(ativo.id) ?? []
  const q = ativo.qualificacao
  const validadeVencida = q.validadeAte && new Date(q.validadeAte).getTime() < indice.agora

  return (
    <>
      <Cabecalho eyebrow={<TipoRotulo tipo={ativo.tipo} />} titulo={ativo.nome} codigo={ativo.codigo} selo={<PilulaStatus status={q.status} />} mono />
      {q.status === 'reprovado' && q.motivo && <Aviso tom="ruim">Reprovado: {q.motivo}.</Aviso>}
      {q.status === 'depreciado' && q.motivo && <Aviso tom="neutro">Depreciado: {q.motivo}.</Aviso>}
      {validadeVencida && <Aviso tom="alerta">Qualificação vencida em {fmtData(q.validadeAte!)}. É preciso requalificar.</Aviso>}
      <dl className="aps-campos">
        <Campo rotulo="Projeto">
          <Ir sel={{ tipo: 'projeto', id: projeto.id }}>{projeto.nome}</Ir>
        </Campo>
        <Campo rotulo="Área">{area.nome}</Campo>
        <Campo rotulo="Analista">
          <Ir sel={{ tipo: 'analista', id: analista.id }}>{analista.nome}</Ir>
        </Campo>
        <Campo rotulo="Tecnologia">{ativo.tecnologia}</Campo>
        <Campo rotulo="Exposição">{ativo.exposicao === 'internet' ? 'Internet' : 'Rede interna'}</Campo>
        <Campo rotulo="Criticidade">{CRITICIDADE_LABEL[ativo.criticidade]}</Campo>
      </dl>

      <Secao titulo={`Formulário de qualificação ${q.versaoFormulario}`} extra={<span className="aps-mono aps-muted">{pct(q.progresso)} respondido</span>}>
        <Medidor valor={q.progresso} rotulo="Progresso do formulário" tom={q.status === 'reprovado' ? 'ruim' : q.progresso >= 1 ? 'ok' : 'info'} />
        <p className="aps-muted aps-pequeno">
          Atualizado em {fmtData(q.atualizadoEm)}
          {q.aprovadoEm && ` · aprovado em ${fmtData(q.aprovadoEm)}`}
          {q.validadeAte && !validadeVencida && ` · válido até ${fmtData(q.validadeAte)}`}
        </p>
        <Formulario ativo={ativo} />
      </Secao>

      <Secao titulo="Vulnerabilidades" extra={<span className="aps-mono aps-muted">{vulns.filter(vulnAberta).length} abertas de {vulns.length}</span>}>
        {vulns.length === 0 ? (
          <p className="aps-muted aps-pequeno">Nenhuma vulnerabilidade registrada para este ativo.</p>
        ) : (
          <ul className="aps-lista">
            {vulns.map((v) => (
              <li key={v.id}>
                <Ir sel={{ tipo: 'vulnerabilidade', id: v.id }}>
                  <PilulaSeveridade severidade={v.severidade} />
                  <span className={`aps-lista-nome${vulnAberta(v) ? '' : ' is-fechada'}`}>{v.titulo}</span>
                  <PilulaVuln status={v.status} vencida={vulnVencida(v, indice.agora)} />
                </Ir>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Pendências" extra={<span className="aps-mono aps-muted">{pend.filter((p) => p.status === 'aberta').length} abertas</span>}>
        {pend.length === 0 ? (
          <p className="aps-muted aps-pequeno">Sem pendências.</p>
        ) : (
          <ul className="aps-lista">
            {pend.map((p) => (
              <li key={p.id}>
                <Ir sel={{ tipo: 'pendencia', id: p.id }}>
                  <span className="aps-lista-nome">{p.descricao}</span>
                  <PilulaPendencia status={p.status} vencida={pendenciaVencida(p, indice.agora)} />
                </Ir>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </>
  )
}

function CardProjeto({ id }: { id: string }) {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const projeto = data.projetos.find((p) => p.id === id)!
  const area = data.areas.find((a) => a.id === projeto.areaId)!
  const analista = data.analistas.find((a) => a.id === projeto.analistaId)!
  const ativos = indice.ativosPorProjeto.get(id) ?? []
  const vulns = useMemo(() => ativos.flatMap((a) => indice.vulnsPorAtivo.get(a.id) ?? []), [ativos, indice])
  const pendVencidas = ativos.reduce((s, a) => s + (indice.pendPorAtivo.get(a.id) ?? []).filter((p) => pendenciaVencida(p, indice.agora)).length, 0)
  const status = contarStatus(ativos)
  const porTipo = TIPOS.map((t) => [t, ativos.filter((a) => a.tipo === t).length] as const).filter(([, n]) => n > 0)

  return (
    <>
      <Cabecalho eyebrow={`Projeto · ${area.nome}`} titulo={projeto.nome} codigo={projeto.codigo} />
      <dl className="aps-campos">
        <Campo rotulo="Squad">{projeto.squad}</Campo>
        <Campo rotulo="Analista líder">
          <Ir sel={{ tipo: 'analista', id: analista.id }}>{analista.nome}</Ir>
        </Campo>
      </dl>
      <Secao titulo={`${ativos.length} ativos`} extra={<span className="aps-mono aps-muted">{pct(status.aprovado / Math.max(1, ativos.length - status.depreciado))} aprovados</span>}>
        <BarraEmpilhada partes={STATUS_PARTES(status)} rotulo="Ativos por status" />
        <ul className="aps-tipos">
          {porTipo.map(([t, n]) => (
            <li key={t}>
              <IconeTipo tipo={t} /> <b className="aps-mono">{n}</b> {TIPO_LABEL[t]}
            </li>
          ))}
        </ul>
      </Secao>
      <Secao titulo="Vulnerabilidades abertas">
        <ContagemSeveridade vulns={vulns} />
        {pendVencidas > 0 && <Aviso tom="alerta">{pendVencidas} pendências vencidas neste projeto.</Aviso>}
      </Secao>
      <Secao titulo="Ativos com maior risco">
        <ListaAtivos ativos={ativos} />
      </Secao>
    </>
  )
}

function CardVulnerabilidade({ id }: { id: string }) {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const v = data.vulnerabilidades.find((x) => x.id === id)!
  const ativo = indice.ativoPorId.get(v.ativoId)!
  const vencida = vulnVencida(v, indice.agora)
  return (
    <>
      <Cabecalho eyebrow={`Vulnerabilidade · ${ORIGEM_LABEL[v.origem]}`} titulo={v.titulo} codigo={v.codigo} selo={<PilulaSeveridade severidade={v.severidade} />} />
      {vencida && <Aviso tom="ruim">Fora do SLA: prazo {textoPrazo(v.prazo, indice.agora).replace('vencida', 'vencido')}.</Aviso>}
      <dl className="aps-campos">
        <Campo rotulo="CVSS" mono>
          {v.cvss.toFixed(1)}
        </Campo>
        <Campo rotulo="CWE" mono>
          {v.cwe}
        </Campo>
        <Campo rotulo="Status">
          <PilulaVuln status={v.status} vencida={vencida} />
        </Campo>
        <Campo rotulo="Aberta em" mono>
          {fmtData(v.abertaEm)}
        </Campo>
        <Campo rotulo="Prazo (SLA)" mono>
          {fmtData(v.prazo)}
          {vulnAberta(v) && !vencida && <span className="aps-muted"> · {textoPrazo(v.prazo, indice.agora)}</span>}
        </Campo>
        {v.corrigidaEm && (
          <Campo rotulo="Corrigida em" mono>
            {fmtData(v.corrigidaEm)}
          </Campo>
        )}
      </dl>
      <Secao titulo="Ativo afetado">
        <ul className="aps-lista">
          <li>
            <Ir sel={{ tipo: 'ativo', id: ativo.id }}>
              <IconeTipo tipo={ativo.tipo} />
              <span className="aps-lista-nome aps-mono">{ativo.nome}</span>
              <PilulaStatus status={ativo.qualificacao.status} />
            </Ir>
          </li>
        </ul>
      </Secao>
    </>
  )
}

function CardPendencia({ id }: { id: string }) {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const p = data.pendencias.find((x) => x.id === id)!
  const ativo = indice.ativoPorId.get(p.ativoId)!
  const vencida = pendenciaVencida(p, indice.agora)
  return (
    <>
      <Cabecalho eyebrow="Pendência da qualificação" titulo={p.descricao} codigo={p.codigo} selo={<PilulaPendencia status={p.status} vencida={vencida} />} />
      <dl className="aps-campos">
        <Campo rotulo="Responsável">{p.responsavel}</Campo>
        <Campo rotulo="Prazo" mono>
          {fmtData(p.prazo)}
          {p.status === 'aberta' && <span className={vencida ? 'aps-txt-ruim' : 'aps-muted'}> · {textoPrazo(p.prazo, indice.agora)}</span>}
        </Campo>
      </dl>
      <Secao titulo="Ativo">
        <ul className="aps-lista">
          <li>
            <Ir sel={{ tipo: 'ativo', id: ativo.id }}>
              <IconeTipo tipo={ativo.tipo} />
              <span className="aps-lista-nome aps-mono">{ativo.nome}</span>
              <PilulaStatus status={ativo.qualificacao.status} />
            </Ir>
          </li>
        </ul>
      </Secao>
    </>
  )
}

function CardAnalista({ id }: { id: string }) {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const filtros = useAppSecUi((s) => s.filtros)
  const setFiltros = useAppSecUi((s) => s.setFiltros)
  const analista = data.analistas.find((a) => a.id === id)!
  const ativos = indice.ativosPorAnalista.get(id) ?? []
  const vulns = useMemo(() => ativos.flatMap((a) => indice.vulnsPorAtivo.get(a.id) ?? []), [ativos, indice])
  const pendVencidas = ativos.reduce((s, a) => s + (indice.pendPorAtivo.get(a.id) ?? []).filter((p) => pendenciaVencida(p, indice.agora)).length, 0)
  const status = contarStatus(ativos)
  const filtrando = filtros.analistaId === id
  return (
    <>
      <Cabecalho eyebrow="Analista AppSec" titulo={analista.nome} />
      <ul className="aps-tipos" aria-label="Especialidades">
        {analista.especialidades.map((t) => (
          <li key={t}>
            <IconeTipo tipo={t} /> {TIPO_LABEL[t]}
          </li>
        ))}
      </ul>
      <Secao titulo={`${num(ativos.length)} ativos sob responsabilidade`}>
        <BarraEmpilhada partes={STATUS_PARTES(status)} rotulo="Ativos por status" />
        <dl className="aps-campos">
          <Campo rotulo="Rascunhos para revisar" mono>
            {status.rascunho}
          </Campo>
          <Campo rotulo="Reprovados" mono>
            {status.reprovado}
          </Campo>
          <Campo rotulo="Pendências vencidas" mono>
            <span className={pendVencidas ? 'aps-txt-ruim' : undefined}>{pendVencidas}</span>
          </Campo>
          <Campo rotulo="Vulnerabilidades abertas" mono>
            {vulns.filter(vulnAberta).length}
          </Campo>
        </dl>
        <button type="button" className="aps-btn" aria-pressed={filtrando} onClick={() => setFiltros({ analistaId: filtrando ? null : id })}>
          {filtrando ? 'Remover filtro deste analista' : 'Filtrar o mapa por este analista'}
        </button>
      </Secao>
      <Secao titulo="Ativos com maior risco">
        <ListaAtivos ativos={ativos} />
      </Secao>
    </>
  )
}

function CardVisaoGeral() {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const comandar = useAppSecUi((s) => s.comandar)
  const layout = useAppSecData((s) => s.layout)
  const porArea = useMemo(
    () =>
      data.areas.map((a) => {
        const ativos = data.ativos.filter((x) => x.areaId === a.id)
        const criticas = ativos.reduce(
          (s, x) => s + (indice.vulnsPorAtivo.get(x.id) ?? []).filter((v) => v.severidade === 'critica' && vulnAberta(v)).length,
          0,
        )
        return { area: a, status: contarStatus(ativos), total: ativos.length, criticas }
      }),
    [data, indice],
  )
  const carga = useMemo(
    () =>
      data.analistas
        .map((a) => {
          const ativos = indice.ativosPorAnalista.get(a.id) ?? []
          return { analista: a, rascunhos: ativos.filter((x) => x.qualificacao.status === 'rascunho').length, total: ativos.length }
        })
        .sort((a, b) => b.rascunhos - a.rascunhos)
        .slice(0, 5),
    [data, indice],
  )

  return (
    <>
      <Cabecalho eyebrow="Visão geral" titulo="Onde agir primeiro" />
      <Secao titulo="Áreas">
        <ul className="aps-areas">
          {porArea.map(({ area, status, total, criticas }) => {
            const r = layout.areaPorId.get(area.id)!
            return (
              <li key={area.id}>
                <button type="button" className="aps-area-btn" onClick={() => comandar('enquadrar', { x: r.x, z: r.z, w: r.w, d: r.d })}>
                  <span className="aps-area-nome">{area.nome}</span>
                  <span className="aps-mono aps-muted">{num(total)}</span>
                  <span className={`aps-mono aps-area-crit${criticas ? ' is-ruim' : ''}`} title="Vulnerabilidades críticas abertas">
                    {criticas} crít.
                  </span>
                  <BarraEmpilhada partes={STATUS_PARTES(status)} rotulo={`Ativos de ${area.nome} por status`} />
                </button>
              </li>
            )
          })}
        </ul>
      </Secao>
      <Secao titulo="Ativos com maior risco">
        <ListaAtivos ativos={data.ativos} limite={6} />
      </Secao>
      <Secao titulo="Rascunhos por analista">
        <ul className="aps-lista">
          {carga.map(({ analista, rascunhos, total }) => (
            <li key={analista.id}>
              <Ir sel={{ tipo: 'analista', id: analista.id }}>
                <span className="aps-avatar aps-avatar-sm" aria-hidden>
                  {analista.iniciais}
                </span>
                <span className="aps-lista-nome">{analista.nome}</span>
                <span className="aps-mono aps-muted">
                  {rascunhos} de {total}
                </span>
              </Ir>
            </li>
          ))}
        </ul>
      </Secao>
    </>
  )
}

/* ---------------- Card ---------------- */

export function DetailCard() {
  const selecao = useAppSecUi((s) => s.selecao)
  const selecionar = useAppSecUi((s) => s.selecionar)
  const indice = useAppSecData((s) => s.indice)
  const mobile = useMediaQuery('(max-width: 900px)')
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    if (selecao) setAberto(true)
  }, [selecao])

  let conteudo: ReactNode
  let rotulo = 'Visão geral'
  if (!selecao) conteudo = <CardVisaoGeral />
  else if (selecao.tipo === 'ativo') {
    const a = indice.ativoPorId.get(selecao.id)
    conteudo = a ? <CardAtivo ativo={a} /> : null
    rotulo = 'Detalhe do ativo'
  } else if (selecao.tipo === 'projeto') {
    conteudo = <CardProjeto id={selecao.id} />
    rotulo = 'Detalhe do projeto'
  } else if (selecao.tipo === 'vulnerabilidade') {
    conteudo = <CardVulnerabilidade id={selecao.id} />
    rotulo = 'Detalhe da vulnerabilidade'
  } else if (selecao.tipo === 'pendencia') {
    conteudo = <CardPendencia id={selecao.id} />
    rotulo = 'Detalhe da pendência'
  } else {
    conteudo = <CardAnalista id={selecao.id} />
    rotulo = 'Detalhe do analista'
  }

  return (
    <aside className={`aps-panel aps-detalhe${mobile && aberto ? ' is-aberto' : ''}`} aria-label={rotulo}>
      {mobile && (
        <button type="button" className="aps-alca" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          <span aria-hidden />
          {aberto ? 'Recolher detalhes' : 'Mostrar detalhes'}
        </button>
      )}
      {selecao && (
        <button type="button" className="aps-fechar" onClick={() => selecionar(null)} aria-label="Fechar e voltar para a visão geral">
          ×
        </button>
      )}
      <div className="aps-detalhe-corpo" key={selecao ? `${selecao.tipo}:${selecao.id}` : 'geral'}>
        {conteudo}
      </div>
    </aside>
  )
}
