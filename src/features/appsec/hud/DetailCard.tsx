import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import {
  CATEGORIA_DOC_LABEL,
  CRITICIDADE_LABEL,
  FORMULARIOS,
  ORIGEM_LABEL,
  SEVERIDADES,
  SEVERIDADE_LABEL,
  STATUS_LABEL,
  TIPO_LABEL,
  TIPOS,
} from '../data/catalogo'
import {
  abertasPorSeveridade,
  contarStatus,
  documentosFaltando,
  maturidadeMedia,
  pendenciaVencida,
  qualificacaoVencida,
  requalificacaoVencida,
  respostasDo,
  statusDoAtivo,
  vulnAberta,
  vulnVencida,
} from '../data/derived'
import { useAppSecData } from '../data/store'
import type { Ativo, Qualificacao, Resposta, Selecao, Vulnerabilidade } from '../data/types'
import { nivelDe, pontuacao } from '../data/gamificacao'
import { useAcaoGamificada } from '../state/useAcaoGamificada'
import { useAppSecUi } from '../state/uiStore'
import { ComposicaoPostura, Conquistas, ListaMissoes, RankingAreas } from './Gamificacao'
import { data as fmtData, num, num1, pct, textoPrazo } from './format'
import {
  BarraEmpilhada,
  IconeTipo,
  Medidor,
  NivelMaturidade,
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

function Cabecalho({ eyebrow, titulo, codigo, selo, mono }: { eyebrow: ReactNode; titulo: string; codigo?: ReactNode; selo?: ReactNode; mono?: boolean }) {
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

function Aviso({ tom, children }: { tom: 'ruim' | 'alerta' | 'neutro' | 'info'; children: ReactNode }) {
  return <p className={`aps-aviso aps-aviso-${tom}`}>{children}</p>
}

/** Link interno que troca a seleção (ativo, projeto, analista…). */
function Ir({ sel, children, rotulo }: { sel: Selecao; children: ReactNode; rotulo?: string }) {
  const selecionar = useAppSecUi((s) => s.selecionar)
  return (
    <button type="button" className="aps-ir" onClick={() => selecionar(sel)} aria-label={rotulo}>
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
        const status = statusDoAtivo(indice, i)
        return (
          <li key={a.id}>
            <Ir sel={{ tipo: 'ativo', id: a.id }}>
              <IconeTipo tipo={a.tipo} />
              <span className="aps-lista-nome aps-mono">{a.nome}</span>
              <span className="aps-lista-extra">{indice.abertas[i] ? `${indice.abertas[i]} vuln.` : ''}</span>
              <i className={`aps-dot aps-bg-${status}`} title={STATUS_LABEL[status]} />
            </Ir>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------------- Formulário ---------------- */

const RESPOSTA: Record<Exclude<Resposta, null> | 'vazia', { rotulo: string; classe: string; simbolo: string }> = {
  sim: { rotulo: 'Sim', classe: 'ok', simbolo: '✓' },
  nao: { rotulo: 'Não', classe: 'ruim', simbolo: '✕' },
  parcial: { rotulo: 'Parcial', classe: 'alerta', simbolo: '◐' },
  nao_se_aplica: { rotulo: 'Não se aplica', classe: 'neutro', simbolo: '–' },
  vazia: { rotulo: 'Sem resposta', classe: 'vazia', simbolo: '○' },
}

function Formulario({ q }: { q: Qualificacao }) {
  const respostas = useMemo(() => respostasDo(q), [q])
  return (
    <div className="aps-form">
      <p className="aps-muted aps-pequeno">
        Formulário de {TIPO_LABEL[q.tipo].toLowerCase()} {q.versaoFormulario} · {pct(q.progresso)} respondido
      </p>
      {FORMULARIOS[q.tipo].map((s) => {
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

/* ---------------- Abas internas da qualificação ---------------- */

type AbaQual = 'formulario' | 'pendencias' | 'documentos' | 'vulnerabilidades' | 'historico'

function AbasQualificacao({ abas, conteudo }: { abas: { id: AbaQual; rotulo: string; n?: number; alerta?: boolean }[]; conteudo: Record<AbaQual, ReactNode> }) {
  const [ativa, setAtiva] = useState<AbaQual>('formulario')
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const destino = { ArrowRight: (i + 1) % abas.length, ArrowLeft: (i - 1 + abas.length) % abas.length, Home: 0, End: abas.length - 1 }[e.key]
    if (destino === undefined) return
    e.preventDefault()
    setAtiva(abas[destino].id)
    refs.current[destino]?.focus()
  }
  return (
    <div className="aps-qtabs">
      <div role="tablist" aria-label="Detalhes da qualificação" className="aps-qtablist">
        {abas.map((a, i) => (
          <button
            key={a.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${base}-${a.id}`}
            aria-selected={ativa === a.id}
            aria-controls={`${base}-painel`}
            tabIndex={ativa === a.id ? 0 : -1}
            className={ativa === a.id ? 'is-ativa' : undefined}
            onClick={() => setAtiva(a.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {a.rotulo}
            {a.n !== undefined && <span className={`aps-qtab-n aps-mono${a.alerta ? ' is-alerta' : ''}`}>{a.n}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-painel`} aria-labelledby={`${base}-${ativa}`} className="aps-qtabpanel">
        {conteudo[ativa]}
      </div>
    </div>
  )
}

const KB = (kb: number) => (kb >= 1024 ? `${num1(kb / 1024)} MB` : `${num(kb)} KB`)

/* ---------------- Card da qualificação (ativo) ---------------- */

function CardQualificacao({ ativo, q }: { ativo: Ativo; q: Qualificacao }) {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const agora = indice.agora
  const projeto = data.projetos.find((p) => p.id === ativo.projetoId)!
  const area = data.areas.find((a) => a.id === ativo.areaId)!
  const analista = data.analistas.find((a) => a.id === q.analistaId)!
  const docs = indice.docsPorQual.get(q.id) ?? []
  const faltando = documentosFaltando(q, docs)
  const pend = indice.pendPorQual.get(q.id) ?? []
  const pendAbertas = pend.filter((p) => p.status === 'aberta').length
  const vulns = useMemo(
    () =>
      (indice.vulnsPorAtivo.get(ativo.id) ?? [])
        .filter((v) => v.qualificacaoId === q.id)
        .sort((a, b) => Number(vulnAberta(b)) - Number(vulnAberta(a)) || SEVERIDADES.indexOf(a.severidade) - SEVERIDADES.indexOf(b.severidade)),
    [indice, ativo.id, q.id],
  )
  const historico = indice.historico.get(ativo.id) ?? [q]
  const vencida = qualificacaoVencida(q, agora)
  const acao = useAcaoGamificada()
  const concluirPendencia = useAppSecData((s) => s.concluirPendencia)
  const enviarDocumento = useAppSecData((s) => s.enviarDocumento)
  const editavel = q.vigente && q.status !== 'depreciado'
  const requalificar = q.vigente && requalificacaoVencida(q, agora)

  return (
    <>
      <Cabecalho
        eyebrow={<TipoRotulo tipo={ativo.tipo} />}
        titulo={ativo.nome}
        codigo={
          <>
            {ativo.codigo} · {q.codigo}
          </>
        }
        selo={<PilulaStatus status={q.status} />}
        mono
      />
      {!q.vigente && (
        <Aviso tom="info">
          Qualificação anterior (histórico).{' '}
          <Ir sel={{ tipo: 'ativo', id: ativo.id }}>Ver a qualificação vigente</Ir>
        </Aviso>
      )}
      {q.status === 'reprovado' && q.motivo && <Aviso tom="ruim">Reprovada: {q.motivo}.</Aviso>}
      {q.status === 'depreciado' && q.motivo && <Aviso tom="neutro">Depreciada: {q.motivo}.</Aviso>}
      {vencida && <Aviso tom="ruim">Prazo para resolver {textoPrazo(q.prazo, agora).replace('vencida', 'vencido')}.</Aviso>}
      {requalificar && <Aviso tom="alerta">Validade encerrada em {fmtData(q.validadeAte!)}. É preciso requalificar.</Aviso>}

      <dl className="aps-campos">
        <Campo rotulo="Maturidade">
          <NivelMaturidade nivel={q.maturidade} />
        </Campo>
        {q.status === 'aprovado' && q.validadeAte ? (
          <Campo rotulo="Válida até" mono>
            {fmtData(q.validadeAte)}
          </Campo>
        ) : (
          <Campo rotulo="Prazo para resolver" mono>
            <span className={vencida ? 'aps-txt-ruim' : undefined}>{fmtData(q.prazo)}</span>
          </Campo>
        )}
        <Campo rotulo="Projeto">
          <Ir sel={{ tipo: 'projeto', id: projeto.id }}>{projeto.nome}</Ir>
        </Campo>
        <Campo rotulo="Analista">
          <Ir sel={{ tipo: 'analista', id: analista.id }}>{analista.nome}</Ir>
        </Campo>
        <Campo rotulo="Área">{area.nome}</Campo>
        <Campo rotulo="Tecnologia">{ativo.tecnologia}</Campo>
        <Campo rotulo="Exposição">{ativo.exposicao === 'internet' ? 'Internet' : 'Rede interna'}</Campo>
        <Campo rotulo="Criticidade">{CRITICIDADE_LABEL[ativo.criticidade]}</Campo>
      </dl>
      <div className="aps-qresumo">
        <Medidor valor={q.progresso} rotulo="Progresso do formulário" tom={q.status === 'reprovado' ? 'ruim' : q.progresso >= 1 ? 'ok' : 'info'} />
        <p className="aps-muted aps-pequeno">
          Aberta em {fmtData(q.abertaEm)}
          {q.concluidaEm && ` · concluída em ${fmtData(q.concluidaEm)}`}
        </p>
      </div>

      <AbasQualificacao
        abas={[
          { id: 'formulario', rotulo: 'Formulário' },
          { id: 'pendencias', rotulo: 'Pendências', n: pendAbertas, alerta: pend.some((p) => pendenciaVencida(p, agora)) },
          { id: 'documentos', rotulo: 'Documentos', n: docs.length, alerta: faltando.length > 0 },
          { id: 'vulnerabilidades', rotulo: 'Vulnerabilidades', n: vulns.filter(vulnAberta).length },
          { id: 'historico', rotulo: 'Histórico', n: historico.length },
        ]}
        conteudo={{
          formulario: <Formulario q={q} />,
          pendencias:
            pend.length === 0 ? (
              <p className="aps-muted aps-pequeno">Nenhuma pendência nesta qualificação.</p>
            ) : (
              <ul className="aps-lista">
                {pend.map((p) => (
                  <li key={p.id} className={editavel && p.status === 'aberta' ? 'aps-com-acao' : undefined}>
                    <Ir sel={{ tipo: 'pendencia', id: p.id }}>
                      <span className="aps-lista-nome">{p.descricao}</span>
                      <span className="aps-lista-extra">{fmtData(p.prazo)}</span>
                      <PilulaPendencia status={p.status} vencida={pendenciaVencida(p, agora)} />
                    </Ir>
                    {editavel && p.status === 'aberta' && (
                      <button
                        type="button"
                        className="aps-btn-acao"
                        onClick={() => acao(() => concluirPendencia(p.id), ativo.id, `Pendência ${p.codigo} concluída`)}
                        aria-label={`Concluir pendência: ${p.descricao}`}
                      >
                        Concluir
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ),
          documentos: (
            <div className="aps-docs">
              {faltando.length > 0 && (
                <ul className="aps-docs-faltando" aria-label="Documentos obrigatórios faltando">
                  {faltando.map((c) => (
                    <li key={c}>
                      <span className="aps-doc-icone is-faltando" aria-hidden />
                      <span>
                        <strong>{CATEGORIA_DOC_LABEL[c]}</strong>
                        <span className="aps-muted"> · obrigatório, ainda não enviado</span>
                      </span>
                      {editavel && (
                        <button
                          type="button"
                          className="aps-btn-acao"
                          onClick={() => acao(() => enviarDocumento(q.id, c), ativo.id, `${CATEGORIA_DOC_LABEL[c]} enviado`)}
                          aria-label={`Enviar ${CATEGORIA_DOC_LABEL[c]}`}
                        >
                          Enviar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {docs.length === 0 ? (
                <p className="aps-muted aps-pequeno">Nenhum documento enviado.</p>
              ) : (
                <ul className="aps-docs-lista" aria-label="Documentos enviados">
                  {docs.map((d) => (
                    <li key={d.id}>
                      <span className={`aps-doc-icone aps-doc-${d.formato}`} aria-hidden>
                        {d.formato}
                      </span>
                      <span className="aps-doc-txt">
                        <span className="aps-doc-cat">{CATEGORIA_DOC_LABEL[d.categoria]}</span>
                        <span className="aps-mono aps-doc-nome" title={d.nome}>
                          {d.nome}
                        </span>
                        <span className="aps-muted aps-pequeno">
                          {KB(d.tamanhoKb)} · {fmtData(d.enviadoEm)} · {d.enviadoPor}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
          vulnerabilidades:
            vulns.length === 0 ? (
              <p className="aps-muted aps-pequeno">Nenhuma vulnerabilidade registrada nesta qualificação.</p>
            ) : (
              <ul className="aps-lista">
                {vulns.map((v) => (
                  <li key={v.id}>
                    <Ir sel={{ tipo: 'vulnerabilidade', id: v.id }}>
                      <PilulaSeveridade severidade={v.severidade} />
                      <span className={`aps-lista-nome${vulnAberta(v) ? '' : ' is-fechada'}`}>{v.titulo}</span>
                      <PilulaVuln status={v.status} vencida={vulnVencida(v, agora)} />
                    </Ir>
                  </li>
                ))}
              </ul>
            ),
          historico: (
            <ol className="aps-hist" aria-label="Qualificações do ativo, da mais recente para a mais antiga">
              {historico.map((h) => (
                <li key={h.id} className={h.id === q.id ? 'is-atual' : undefined}>
                  <Ir sel={{ tipo: 'qualificacao', id: h.id }} rotulo={`${h.codigo}, ${STATUS_LABEL[h.status]}, maturidade ${h.maturidade}, aberta em ${fmtData(h.abertaEm)}`}>
                    <span className="aps-hist-data aps-mono">{fmtData(h.abertaEm)}</span>
                    <span className="aps-hist-cod aps-mono">
                      {h.codigo} · {h.versaoFormulario}
                    </span>
                    <NivelMaturidade nivel={h.maturidade} comRotulo={false} />
                    <PilulaStatus status={h.status} />
                    {h.vigente && <span className="aps-hist-vigente">vigente</span>}
                  </Ir>
                </li>
              ))}
            </ol>
          ),
        }}
      />
      {editavel && (pendAbertas > 0 || faltando.length > 0) && (
        <p className="aps-muted aps-pequeno aps-nota-sim">Ações de concluir e enviar são simuladas neste protótipo e não são salvas.</p>
      )}
    </>
  )
}

/* ---------------- Demais cards ---------------- */

function CardProjeto({ id }: { id: string }) {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const projeto = data.projetos.find((p) => p.id === id)!
  const area = data.areas.find((a) => a.id === projeto.areaId)!
  const analista = data.analistas.find((a) => a.id === projeto.analistaId)!
  const ativos = useMemo(() => indice.ativosPorProjeto.get(id) ?? [], [indice, id])
  const vulns = useMemo(() => ativos.flatMap((a) => indice.vulnsPorAtivo.get(a.id) ?? []), [ativos, indice])
  const status = contarStatus(indice, ativos)
  const porTipo = TIPOS.map((t) => [t, ativos.filter((a) => a.tipo === t).length] as const).filter(([, n]) => n > 0)
  const vigentes = ativos.map((a) => indice.vigente.get(a.id)!).filter(Boolean)
  const vencidas = vigentes.filter((q) => qualificacaoVencida(q, indice.agora)).length
  const semDocs = vigentes.filter((q) => documentosFaltando(q, indice.docsPorQual.get(q.id) ?? []).length > 0).length
  const postura = useMemo(() => {
    const total = pontuacao(data, indice, ativos).total
    return { total, nivel: nivelDe(total).atual }
  }, [data, indice, ativos])
  const proximas = vigentes
    .filter((q) => q.status === 'rascunho' || q.status === 'reprovado')
    .sort((a, b) => a.prazo.localeCompare(b.prazo))
    .slice(0, 6)

  return (
    <>
      <Cabecalho
        eyebrow={`Projeto · ${area.nome}`}
        titulo={projeto.nome}
        codigo={projeto.codigo}
        selo={
          <span className="aps-selo-pts" title="Pontuação de postura do projeto">
            <b className="aps-mono">{num(postura.total)}</b> pts · {postura.nivel.nome}
          </span>
        }
      />
      <dl className="aps-campos">
        <Campo rotulo="Squad">{projeto.squad}</Campo>
        <Campo rotulo="Analista líder">
          <Ir sel={{ tipo: 'analista', id: analista.id }}>{analista.nome}</Ir>
        </Campo>
      </dl>
      <Secao titulo={`${ativos.length} qualificações vigentes`} extra={<span className="aps-mono aps-muted">{pct(status.aprovado / Math.max(1, ativos.length - status.depreciado))} aprovadas</span>}>
        <BarraEmpilhada partes={STATUS_PARTES(status)} rotulo="Qualificações por status" />
        <ul className="aps-tipos">
          {porTipo.map(([t, n]) => (
            <li key={t}>
              <IconeTipo tipo={t} /> <b className="aps-mono">{n}</b> {TIPO_LABEL[t]}
            </li>
          ))}
        </ul>
        <dl className="aps-campos">
          <Campo rotulo="Maturidade média" mono>
            {num1(maturidadeMedia(indice, ativos))} de 5
          </Campo>
          <Campo rotulo="Prazos vencidos" mono>
            <span className={vencidas ? 'aps-txt-ruim' : undefined}>{vencidas}</span>
          </Campo>
          <Campo rotulo="Documentos faltando" mono>
            <span className={semDocs ? 'aps-txt-ruim' : undefined}>{semDocs}</span>
          </Campo>
        </dl>
      </Secao>
      {proximas.length > 0 && (
        <Secao titulo="Qualificações em aberto por prazo">
          <ul className="aps-lista">
            {proximas.map((q) => {
              const a = indice.ativoPorId.get(q.ativoId)!
              const venc = qualificacaoVencida(q, indice.agora)
              return (
                <li key={q.id}>
                  <Ir sel={{ tipo: 'qualificacao', id: q.id }}>
                    <IconeTipo tipo={a.tipo} />
                    <span className="aps-lista-nome aps-mono">{a.nome}</span>
                    <span className={`aps-lista-extra${venc ? ' aps-txt-ruim' : ''}`}>{fmtData(q.prazo)}</span>
                    <i className={`aps-dot aps-bg-${q.status}`} title={STATUS_LABEL[q.status]} />
                  </Ir>
                </li>
              )
            })}
          </ul>
        </Secao>
      )}
      <Secao titulo="Conquistas">
        <Conquistas ativos={ativos} />
      </Secao>
      <Secao titulo="Vulnerabilidades abertas">
        <ContagemSeveridade vulns={vulns} />
      </Secao>
    </>
  )
}

function CardVulnerabilidade({ id }: { id: string }) {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const v = data.vulnerabilidades.find((x) => x.id === id)!
  const ativo = indice.ativoPorId.get(v.ativoId)!
  const q = indice.qualPorId.get(v.qualificacaoId)
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
        </Campo>
        {v.corrigidaEm && (
          <Campo rotulo="Corrigida em" mono>
            {fmtData(v.corrigidaEm)}
          </Campo>
        )}
        {q && (
          <Campo rotulo="Qualificação" mono>
            <Ir sel={{ tipo: 'qualificacao', id: q.id }}>{q.codigo}</Ir>
          </Campo>
        )}
      </dl>
      <Secao titulo="Ativo afetado">
        <ul className="aps-lista">
          <li>
            <Ir sel={{ tipo: 'ativo', id: ativo.id }}>
              <IconeTipo tipo={ativo.tipo} />
              <span className="aps-lista-nome aps-mono">{ativo.nome}</span>
              {q && <PilulaStatus status={q.status} />}
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
  const q = indice.qualPorId.get(p.qualificacaoId)
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
        {q && (
          <Campo rotulo="Qualificação" mono>
            <Ir sel={{ tipo: 'qualificacao', id: q.id }}>{q.codigo}</Ir>
          </Campo>
        )}
      </dl>
      <Secao titulo="Ativo">
        <ul className="aps-lista">
          <li>
            <Ir sel={{ tipo: 'ativo', id: ativo.id }}>
              <IconeTipo tipo={ativo.tipo} />
              <span className="aps-lista-nome aps-mono">{ativo.nome}</span>
              {q && <PilulaStatus status={q.status} />}
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
  const ativos = useMemo(() => indice.ativosPorAnalista.get(id) ?? [], [indice, id])
  const status = contarStatus(indice, ativos)
  const vencidas = ativos.filter((a) => qualificacaoVencida(indice.vigente.get(a.id)!, indice.agora)).length
  const pendVencidas = ativos.reduce((s, a) => s + (indice.pendPorAtivo.get(a.id) ?? []).filter((p) => pendenciaVencida(p, indice.agora)).length, 0)
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
      <Secao titulo={`${num(ativos.length)} qualificações vigentes`}>
        <BarraEmpilhada partes={STATUS_PARTES(status)} rotulo="Qualificações por status" />
        <dl className="aps-campos">
          <Campo rotulo="Rascunhos para revisar" mono>
            {status.rascunho}
          </Campo>
          <Campo rotulo="Maturidade média" mono>
            {num1(maturidadeMedia(indice, ativos))} de 5
          </Campo>
          <Campo rotulo="Prazos vencidos" mono>
            <span className={vencidas ? 'aps-txt-ruim' : undefined}>{vencidas}</span>
          </Campo>
          <Campo rotulo="Pendências vencidas" mono>
            <span className={pendVencidas ? 'aps-txt-ruim' : undefined}>{pendVencidas}</span>
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
  const carga = useMemo(
    () =>
      data.analistas
        .map((a) => {
          const ativos = indice.ativosPorAnalista.get(a.id) ?? []
          return { analista: a, rascunhos: contarStatus(indice, ativos).rascunho, total: ativos.length }
        })
        .sort((a, b) => b.rascunhos - a.rascunhos)
        .slice(0, 5),
    [data, indice],
  )

  return (
    <>
      <Cabecalho eyebrow="Visão geral" titulo="Onde agir primeiro" />
      <Secao titulo="Postura de segurança">
        <ComposicaoPostura />
      </Secao>
      <Secao titulo="Missões" extra={<span className="aps-muted aps-pequeno">maior alavanca agora</span>}>
        <ListaMissoes />
      </Secao>
      <Secao titulo="Ranking das áreas" extra={<span className="aps-muted aps-pequeno">pontos de postura</span>}>
        <RankingAreas />
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

  let conteudo: ReactNode = null
  let rotulo = 'Visão geral'
  if (!selecao) conteudo = <CardVisaoGeral />
  else if (selecao.tipo === 'ativo' || selecao.tipo === 'qualificacao') {
    const q = selecao.tipo === 'ativo' ? indice.vigente.get(selecao.id) : indice.qualPorId.get(selecao.id)
    const a = q ? indice.ativoPorId.get(q.ativoId) : undefined
    if (a && q) conteudo = <CardQualificacao ativo={a} q={q} />
    rotulo = 'Detalhe da qualificação'
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
