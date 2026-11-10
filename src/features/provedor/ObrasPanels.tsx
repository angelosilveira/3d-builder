import { dateLabel, pointById, type AccessPoint } from './data'
import { Icon } from './icons'
import {
  diasEntre,
  etapaAtual,
  executadoObra,
  fimObra,
  HOJE_OBRAS,
  inicioObra,
  janelaObras,
  obras,
  pessoasEmCampo,
  previstoObra,
  progressoGeral,
  progressoNoMapa,
  somarDias,
  STATUS_OBRA_LABEL,
  statusObra,
  TIPO_OBRA_LABEL,
  type Obra,
  type StatusObra,
} from './obras'

const pct = (v: number) => Math.round(v * 100) + '%'
const reais = (v: number) =>
  v >= 1_000_000
    ? 'R$ ' + (v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export const iconeObra = (o: Obra) => (o.tipo === 'torre' ? 'tower' : o.tipo === 'estacao' || o.tipo === 'vala' || o.tipo === 'aerea' ? 'network' : 'obra')

export function StatusObraPill({ status }: { status: StatusObra }) {
  return (
    <span className={'pv-obra-status ' + status}>
      <i />
      {STATUS_OBRA_LABEL[status]}
    </span>
  )
}

/** Barra de progresso com o marcador do previsto. */
function Barra({ executado, previsto, rotulo }: { executado: number; previsto?: number; rotulo: string }) {
  return (
    <span className="pv-obra-barra" role="meter" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(executado * 100)}>
      <i style={{ width: pct(executado) }} />
      {previsto !== undefined && <b style={{ left: pct(previsto) }} title={'Previsto: ' + pct(previsto)} />}
    </span>
  )
}

/* ---------------- Linha do tempo (4D) ---------------- */

export function LinhaDoTempo({ data, setData }: { data: string | null; setData: (d: string | null) => void }) {
  const total = diasEntre(janelaObras.inicio, janelaObras.fim)
  const atual = data ?? HOJE_OBRAS
  const valor = diasEntre(janelaObras.inicio, atual)
  const hoje = diasEntre(janelaObras.inicio, HOJE_OBRAS)
  return (
    <section className="pv-tempo">
      <div className="pv-tempo-topo">
        <span>
          <Icon name="calendar" />
          <strong>{dateLabel(atual)}</strong>
          <small>{!data ? 'hoje · executado' : data < HOJE_OBRAS ? 'histórico' : 'previsto no cronograma'}</small>
        </span>
        {data && (
          <button className="pv-link" onClick={() => setData(null)}>
            Voltar para hoje
          </button>
        )}
      </div>
      <div className="pv-tempo-trilho">
        <input
          type="range"
          min={0}
          max={total}
          value={valor}
          aria-label="Linha do tempo das obras"
          aria-valuetext={dateLabel(atual) + (data ? '' : ', hoje')}
          onChange={(e) => {
            const d = somarDias(janelaObras.inicio, Number(e.target.value))
            setData(d === HOJE_OBRAS ? null : d)
          }}
        />
        <i className="pv-tempo-hoje" style={{ left: `calc(${(hoje / total) * 100}% )` }} aria-hidden="true" />
      </div>
      <div className="pv-tempo-legenda" aria-hidden="true">
        <span>{dateLabel(janelaObras.inicio)}</span>
        <span>{dateLabel(janelaObras.fim)}</span>
      </div>
    </section>
  )
}

/* ---------------- Lista ---------------- */

export function ListaObras({ data, setData, escolher }: { data: string | null; setData: (d: string | null) => void; escolher: (o: Obra) => void }) {
  const contagem = obras.reduce<Record<StatusObra, number>>((acc, o) => ({ ...acc, [statusObra(o)]: acc[statusObra(o)] + 1 }), {
    planejada: 0,
    em_andamento: 0,
    atrasada: 0,
    concluida: 0,
  })
  const investimento = obras.reduce((s, o) => s + o.orcamento, 0)
  const emCampo = obras.filter((o) => ['em_andamento', 'atrasada'].includes(statusObra(o))).reduce((s, o) => s + pessoasEmCampo(o), 0)
  return (
    <section>
      <span className="pv-kicker">SEDE URBANA · ARACATU</span>
      <h2>Obras da rede</h2>
      <p className="pv-empty">
        {obras.length} obras · {contagem.em_andamento + contagem.atrasada} em andamento
        {contagem.atrasada ? ` (${contagem.atrasada} atrasada${contagem.atrasada > 1 ? 's' : ''})` : ''} · {emCampo} pessoas em campo hoje ·{' '}
        {reais(investimento)} em investimento
      </p>
      <LinhaDoTempo data={data} setData={setData} />
      <div className="pv-section-title">
        <h3>Obras</h3>
        <b>{obras.length}</b>
      </div>
      {obras.map((o) => (
        <LinhaObra key={o.id} obra={o} data={data} onClick={() => escolher(o)} />
      ))}
    </section>
  )
}

export function LinhaObra({ obra, data, onClick }: { obra: Obra; data: string | null; onClick: () => void }) {
  const mostrado = progressoGeral(obra, data)
  // Na linha do tempo, o selo mostra a situação prevista para a data escolhida.
  const status: StatusObra = !data ? statusObra(obra) : mostrado >= 0.999 ? 'concluida' : mostrado <= 0 ? 'planejada' : 'em_andamento'
  return (
    <button className="pv-row pv-obra-row" onClick={onClick}>
      <span className={'pv-region-icon pv-obra-icone ' + status}>
        <Icon name={iconeObra(obra)} />
      </span>
      <span className="pv-row-label">
        <strong>{obra.nome}</strong>
        <small>
          {obra.id} · {TIPO_OBRA_LABEL[obra.tipo]} · até {dateLabel(fimObra(obra))}
        </small>
        <Barra executado={mostrado} previsto={data ? undefined : previstoObra(obra)} rotulo={`${obra.nome}: ${pct(mostrado)} ${data ? 'previsto' : 'executado'}`} />
      </span>
      <span className="pv-obra-pct">
        {pct(mostrado)}
        <StatusObraPill status={status} />
      </span>
    </button>
  )
}

/** Resumo das obras no painel da cidade. */
export function ResumoObras({ abrir, escolher }: { abrir: () => void; escolher: (o: Obra) => void }) {
  const ativas = obras.filter((o) => statusObra(o) !== 'concluida' && statusObra(o) !== 'planejada')
  return (
    <section>
      <div className="pv-section-title">
        <h3>Obras em andamento</h3>
        <b>{ativas.length}</b>
      </div>
      {ativas.slice(0, 3).map((o) => (
        <LinhaObra key={o.id} obra={o} data={null} onClick={() => escolher(o)} />
      ))}
      <button className="pv-hq-link" onClick={abrir}>
        <Icon name="obra" />
        Ver todas as obras e o cronograma
        <Icon name="arrow" />
      </button>
    </section>
  )
}

/* ---------------- Ficha da obra ---------------- */

export function ObraDetalhe({ obra, data, setData, abrirPonto }: { obra: Obra; data: string | null; setData: (d: string | null) => void; abrirPonto: (p: AccessPoint) => void }) {
  const exec = executadoObra(obra)
  const prev = previstoObra(obra)
  const status = statusObra(obra)
  const diff = Math.round((prev - exec) * 100)
  const etapa = etapaAtual(obra)
  const ponto = obra.pontoId ? pointById.get(obra.pontoId) : undefined
  const inicio = inicioObra(obra)
  const fim = fimObra(obra)
  const total = Math.max(1, diasEntre(inicio, fim))
  const marcador = data ?? HOJE_OBRAS
  const pos = (d: string) => Math.max(0, Math.min(100, (diasEntre(inicio, d) / total) * 100))
  const mapa = progressoNoMapa(obra, data)
  const pessoas = pessoasEmCampo(obra)
  return (
    <section className="pv-obra">
      <div className="pv-detail-title">
        <span className="pv-kicker">
          OBRA · {obra.id} · {TIPO_OBRA_LABEL[obra.tipo].toUpperCase()}
        </span>
        <h2>{obra.nome}</h2>
        <StatusObraPill status={status} />
        <p>{obra.objetivo}</p>
      </div>

      <div className="pv-pxe" aria-label="Previsto x executado">
        <div>
          <span>Executado</span>
          <strong>{pct(exec)}</strong>
        </div>
        <div>
          <span>Previsto para hoje</span>
          <strong>{pct(prev)}</strong>
        </div>
        <Barra executado={exec} previsto={prev} rotulo={`Executado ${pct(exec)}; previsto para hoje ${pct(prev)}`} />
        <p className={diff > 8 ? 'ruim' : undefined}>
          {status === 'concluida'
            ? 'Obra entregue.'
            : status === 'planejada'
              ? `Começa em ${dateLabel(inicio)}.`
              : diff > 1
                ? `${diff} p.p. atrás do cronograma`
                : diff < -1
                  ? `${-diff} p.p. adiantada`
                  : 'Dentro do cronograma'}
        </p>
      </div>
      {obra.observacao && <p className="pv-obra-aviso">{obra.observacao}</p>}

      <dl className="pv-data">
        {[
          ['Início', dateLabel(inicio)],
          ['Previsão de término', dateLabel(fim)],
          ['Etapa atual', status === 'concluida' ? '—' : (etapa?.nome ?? '—')],
          ['Clientes beneficiados', obra.beneficiados.toLocaleString('pt-BR')],
          ...(obra.bairro ? [['Bairro', obra.bairro]] : []),
          ['Responsável', obra.responsavel],
          ['Executora', obra.contratada],
        ].map(([dt, dd]) => (
          <div key={dt}>
            <dt>{dt}</dt>
            <dd>{dd}</dd>
          </div>
        ))}
      </dl>

      <div className="pv-section-title">
        <h3>Custos</h3>
        <b>{pct(obra.gasto / obra.orcamento)}</b>
      </div>
      <div className="pv-custos">
        <span>
          {reais(obra.gasto)} <small>de {reais(obra.orcamento)}</small>
        </span>
        <Barra executado={obra.gasto / obra.orcamento} previsto={exec} rotulo={`Gasto ${pct(obra.gasto / obra.orcamento)} do orçamento`} />
        <small>A marca mostra o avanço físico ({pct(exec)}): gasto acima dela pede atenção.</small>
      </div>

      {obra.pontoId && (
        <>
          <div className="pv-section-title">
            <h3>Ponto de acesso</h3>
          </div>
          {ponto ? (
            <button className="pv-row" onClick={() => abrirPonto(ponto)}>
              <span className="pv-region-icon">
                <Icon name={ponto.technology === 'radio' ? 'tower' : 'network'} />
              </span>
              <span className="pv-row-label">
                <strong>{ponto.name}</strong>
                <small>{ponto.id} · Ver ficha técnica</small>
              </span>
              <Icon name="arrow" />
            </button>
          ) : (
            <p className="pv-empty">
              Novo ponto <strong>{obra.pontoId}</strong>: entra em operação ao final da obra.
            </p>
          )}
        </>
      )}

      <div className="pv-section-title">
        <h3>Etapas</h3>
        <b>{obra.etapas.length}</b>
      </div>
      <ol className="pv-etapas" aria-label="Etapas da obra">
        {obra.etapas.map((et) => {
          const feito = data ? mapa[et.id] : et.executado
          return (
            <li key={et.id}>
              <div>
                <strong>{et.nome}</strong>
                <small>
                  {dateLabel(et.inicio)} – {dateLabel(et.fim)} · {pct(feito)}
                </small>
              </div>
              <span className="pv-gantt" aria-hidden="true">
                <span className="pv-gantt-plano" style={{ left: pos(et.inicio) + '%', width: Math.max(2, pos(et.fim) - pos(et.inicio)) + '%' }}>
                  <i style={{ width: pct(feito) }} />
                </span>
                <b style={{ left: pos(marcador) + '%' }} />
              </span>
            </li>
          )
        })}
      </ol>
      <button className="pv-link pv-obra-tempo" onClick={() => setData(data ? null : fim)}>
        <Icon name="calendar" />
        {data ? 'Voltar para hoje no mapa' : 'Ver a obra pronta no mapa (fim do cronograma)'}
      </button>

      <div className="pv-section-title">
        <h3>Materiais</h3>
        <b>{obra.materiais.length}</b>
      </div>
      <ul className="pv-materiais">
        {obra.materiais.map((mt) => (
          <li key={mt.item}>
            <div>
              <strong>{mt.item}</strong>
              <small>{mt.especificacao}</small>
            </div>
            <span className={mt.entregue < mt.previsto ? 'falta' : undefined}>
              {mt.entregue.toLocaleString('pt-BR')} / {mt.previsto.toLocaleString('pt-BR')} {mt.unidade}
            </span>
          </li>
        ))}
      </ul>

      <div className="pv-section-title">
        <h3>Equipe em campo hoje</h3>
        <b>{pessoas}</b>
      </div>
      {pessoas ? (
        <ul className="pv-equipe">
          {obra.equipe.map((q) => (
            <li key={q.funcao}>
              <b>{q.pessoas}</b> {q.funcao}
            </li>
          ))}
        </ul>
      ) : (
        <p className="pv-empty">{status === 'concluida' ? 'Obra concluída, sem equipe mobilizada.' : 'Nenhuma equipe mobilizada ainda.'}</p>
      )}
    </section>
  )
}

/** Obras ligadas a um ponto de acesso (para a ficha do ponto). */
export function ObrasDoPonto({ ponto, escolher }: { ponto: AccessPoint; escolher: (o: Obra) => void }) {
  const lista = obras.filter((o) => o.pontoId === ponto.id)
  if (!lista.length) return null
  return (
    <section>
      <div className="pv-section-title">
        <h3>Obras neste ponto</h3>
        <b>{lista.length}</b>
      </div>
      {lista.map((o) => (
        <LinhaObra key={o.id} obra={o} data={null} onClick={() => escolher(o)} />
      ))}
    </section>
  )
}
