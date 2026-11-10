import { useMemo, useState, type ReactNode } from 'react'
import { accessPoints, clientById, closeIncident, pointById, readIncidents, type AccessPoint, type Client, type Incident } from './data'
import { dataCurta, dias, HOJE, pct, reais, reaisCurto } from './gestao/base'
import {
  funcionarios,
  horasRestantes,
  iniciais,
  osVencida,
  SETOR_LABEL,
  STATUS_OS_LABEL,
  tecnicos,
  tecnicosLivres,
  TIPO_OS_LABEL,
  type OrdemServico,
  type Setor,
} from './gestao/equipe'
import { loteReposicao, valorEstoque } from './gestao/estoque'
import {
  atraso,
  CATEGORIA_LABEL,
  contasBase,
  contaVencida,
  DIAS_BLOQUEIO,
  faturas,
  faturasAbertas,
  fluxoHistorico,
  SITUACAO_LABEL,
  situacaoFinanceira,
  type ContaPagar,
  type Fatura,
} from './gestao/financeiro'
import { nivelOperador, PILAR_LABEL, PILARES, type Modulo, type Pilar } from './gestao/saude'
import { useGestao } from './gestao/store'
import type { OperacaoCompleta } from './gestao/useOperacao'
import { Icon } from './icons'
import { grafana, painelDoPonto, useMonitorStore } from './monitor'
import { ESTADO_PONTO_LABEL, utilizacao, type Severidade } from './monitor/tipos'

export interface PainelProps {
  op: OperacaoCompleta
  abrirCliente: (c: Client) => void
  abrirPonto: (p: AccessPoint) => void
  abrirModulo: (m: Modulo) => void
  /** Chamado quando uma ordem concluída encerra o incidente do cliente. */
  aoMudarIncidentes: (lista: Incident[]) => void
}

/* ---------------- Peças comuns ---------------- */

function Tile({ rotulo, valor, nota, tom }: { rotulo: string; valor: ReactNode; nota?: ReactNode; tom?: 'ok' | 'aviso' | 'ruim' }) {
  return (
    <div className={'pv-tile' + (tom ? ' ' + tom : '')}>
      <span>{rotulo}</span>
      <strong>{valor}</strong>
      {nota && <small>{nota}</small>}
    </div>
  )
}
/** Barra de proporção com marcador opcional (meta, mínimo). */
function Medidor({ valor, marca, rotulo, tom }: { valor: number; marca?: number; rotulo: string; tom?: 'ok' | 'aviso' | 'ruim' }) {
  const v = Math.max(0, Math.min(1, valor))
  return (
    <span className={'pv-medidor' + (tom ? ' ' + tom : '')} role="meter" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <i style={{ width: pct(v) }} />
      {marca !== undefined && <b style={{ left: pct(Math.min(1, marca)) }} />}
    </span>
  )
}
function Abas<T extends string>({ abas, ativa, mudar, rotulo }: { abas: [T, string, number?][]; ativa: T; mudar: (a: T) => void; rotulo: string }) {
  return (
    <div className="pv-abas" role="tablist" aria-label={rotulo}>
      {abas.map(([id, texto, n]) => (
        <button key={id} role="tab" aria-selected={ativa === id} onClick={() => mudar(id)}>
          {texto}
          {n !== undefined && <b>{n}</b>}
        </button>
      ))}
    </div>
  )
}
const Cabecalho = ({ kicker, titulo, children }: { kicker: string; titulo: string; children?: ReactNode }) => (
  <>
    <span className="pv-kicker">{kicker}</span>
    <h2>{titulo}</h2>
    {children && <p className="pv-empty">{children}</p>}
  </>
)

/* ---------------- Financeiro ---------------- */

function LinhaFatura({ f, abrirCliente }: { f: Fatura; abrirCliente: (c: Client) => void }) {
  const receber = useGestao((s) => s.registrarPagamento)
  const c = clientById.get(f.clientId)!
  const d = atraso(f)
  return (
    <li className="pv-lanc">
      <button className="pv-lanc-nome" onClick={() => abrirCliente(c)} title="Abrir o cliente no mapa">
        <strong>{c.name}</strong>
        <small>
          {c.id} · venc. {dataCurta(f.due)} · {d > 0 ? `${d} ${d === 1 ? 'dia' : 'dias'} de atraso${d >= DIAS_BLOQUEIO ? ' · bloqueado' : ''}` : d === 0 ? 'vence hoje' : `vence em ${-d} dias`}
        </small>
      </button>
      <span className="pv-valor">{reais(f.cents)}</span>
      <button className="pv-acao-mini" onClick={() => receber(f)} aria-label={`Registrar pagamento de ${reais(f.cents)} de ${c.name}`}>
        Receber
      </button>
    </li>
  )
}

function FluxoDeCaixa({ op }: { op: OperacaoCompleta }) {
  const f = op.financeiro
  const meses = [...fluxoHistorico, { mes: 'nov', entradas: f.recebidoMes, saidas: f.pagoMes }]
  const teto = Math.max(...meses.flatMap((m) => [m.entradas, m.saidas])) * 1.08
  const [foco, setFoco] = useState<number | null>(null)
  const H = 120
  return (
    <figure className="pv-grafico">
      <figcaption>
        Entradas e saídas por mês
        <span className="pv-grafico-legenda">
          <span>
            <i className="entradas" /> Entradas
          </span>
          <span>
            <i className="saidas" /> Saídas
          </span>
        </span>
      </figcaption>
      <div className="pv-barras" style={{ height: H }} onMouseLeave={() => setFoco(null)}>
        {meses.map((m, k) => (
          <button key={m.mes} className={'pv-mes' + (foco === k ? ' foco' : '')} onMouseEnter={() => setFoco(k)} onFocus={() => setFoco(k)} onBlur={() => setFoco(null)} aria-label={`${m.mes}: entradas ${reaisCurto(m.entradas)}, saídas ${reaisCurto(m.saidas)}`}>
            <i className="entradas" style={{ height: (m.entradas / teto) * H }} />
            <i className="saidas" style={{ height: (m.saidas / teto) * H }} />
            <span>{m.mes}{k === meses.length - 1 ? '*' : ''}</span>
          </button>
        ))}
        {foco !== null && (
          <div className="pv-dica-grafico" style={{ left: `${((foco + 0.5) / meses.length) * 100}%` }} role="tooltip">
            <strong>{meses[foco].mes}/2026</strong>
            <span>Entradas {reaisCurto(meses[foco].entradas)}</span>
            <span>Saídas {reaisCurto(meses[foco].saidas)}</span>
            <span>Resultado {reaisCurto(meses[foco].entradas - meses[foco].saidas)}</span>
          </div>
        )}
      </div>
      <small className="pv-empty">* Novembro em andamento: recebido e pago até hoje.</small>
      <table className="pv-sr">
        <caption>Fluxo de caixa mensal</caption>
        <thead>
          <tr>
            <th>Mês</th>
            <th>Entradas</th>
            <th>Saídas</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.mes}>
              <td>{m.mes}</td>
              <td>{reais(m.entradas)}</td>
              <td>{reais(m.saidas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function Financeiro({ op, abrirCliente }: PainelProps) {
  const pagas = useGestao((s) => s.pagas)
  const contasPagas = useGestao((s) => s.contasPagas)
  const extras = useGestao((s) => s.contasExtras)
  const pagar = useGestao((s) => s.pagarConta)
  const [aba, setAba] = useState<'receber' | 'pagar' | 'fluxo'>('receber')
  const [faixa, setFaixa] = useState<'vencidas' | 'hoje' | 'a_vencer'>('vencidas')
  const [pagina, setPagina] = useState(0)
  const f = op.financeiro
  const abertas = useMemo(() => faturas.filter((x) => !pagas[x.id]).sort((a, b) => atraso(b) - atraso(a)), [pagas])
  const porFaixa = { vencidas: abertas.filter((x) => atraso(x) > 0), hoje: abertas.filter((x) => atraso(x) === 0), a_vencer: abertas.filter((x) => atraso(x) < 0).reverse() }
  const lista = porFaixa[faixa]
  const contas = [...contasBase, ...extras].filter((c) => !c.quitada && !contasPagas[c.id]).sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  const POR_PAGINA = 12
  return (
    <section className="pv-gestao">
      <Cabecalho kicker="FINANCEIRO · NOVEMBRO/2026" titulo="Contas e caixa">
        No mapa: telhado âmbar é cliente em atraso, vermelho é bloqueado; as colunas mostram quanto cada bairro já pagou.
      </Cabecalho>
      <div className="pv-tiles">
        <Tile rotulo="Receita mensal" valor={reaisCurto(f.mrr)} nota={`ticket médio ${reais(f.ticketMedio)}`} />
        <Tile rotulo="Recebido no mês" valor={pct(f.recebidoMes / f.mrr)} nota={<Medidor valor={f.recebidoMes / f.mrr} rotulo="Recebido sobre a receita do mês" tom="ok" />} tom="ok" />
        <Tile rotulo="Inadimplência" valor={pct(f.inadimplencia, 1)} nota={`${reaisCurto(f.vencido)} · ${f.clientesAtrasados + f.clientesBloqueados} clientes`} tom={f.inadimplencia > 0.08 ? 'ruim' : 'aviso'} />
        <Tile rotulo="Saldo em caixa" valor={reaisCurto(f.saldo)} nota={`a pagar ${reaisCurto(f.aPagar)}`} tom={f.saldo < f.aPagar7dias ? 'ruim' : undefined} />
      </div>
      <Abas
        rotulo="Lançamentos"
        ativa={aba}
        mudar={setAba}
        abas={[
          ['receber', 'A receber', abertas.length],
          ['pagar', 'A pagar', contas.length],
          ['fluxo', 'Fluxo de caixa'],
        ]}
      />
      {aba === 'receber' && (
        <>
          <div className="pv-chips" role="group" aria-label="Situação das faturas">
            {(
              [
                ['vencidas', 'Vencidas'],
                ['hoje', 'Vencem hoje'],
                ['a_vencer', 'A vencer'],
              ] as const
            ).map(([id, texto]) => (
              <button
                key={id}
                aria-pressed={faixa === id}
                onClick={() => {
                  setFaixa(id)
                  setPagina(0)
                }}
              >
                {texto} <b>{porFaixa[id].length}</b>
              </button>
            ))}
          </div>
          <ul className="pv-lancs" aria-label="Faturas em aberto">
            {lista.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((x) => (
              <LinhaFatura key={x.id} f={x} abrirCliente={abrirCliente} />
            ))}
          </ul>
          {!lista.length && <p className="pv-empty">Nenhuma fatura nesta situação.</p>}
          {lista.length > POR_PAGINA && (
            <div className="pv-pagination">
              <button disabled={!pagina} onClick={() => setPagina(pagina - 1)}>
                Anterior
              </button>
              <span>
                {pagina + 1} / {Math.ceil(lista.length / POR_PAGINA)}
              </span>
              <button disabled={(pagina + 1) * POR_PAGINA >= lista.length} onClick={() => setPagina(pagina + 1)}>
                Próxima
              </button>
            </div>
          )}
        </>
      )}
      {aba === 'pagar' && (
        <>
          <p className="pv-empty">
            {reaisCurto(f.aPagar7dias)} vencem em 7 dias · {f.contasVencidas ? `${f.contasVencidas} ${f.contasVencidas === 1 ? 'conta vencida' : 'contas vencidas'} (${reaisCurto(f.aPagarVencido)})` : 'nenhuma conta vencida'}
          </p>
          <ul className="pv-lancs" aria-label="Contas a pagar">
            {contas.map((c: ContaPagar) => {
              const d = dias(c.vencimento, HOJE)
              return (
                <li className={'pv-lanc' + (contaVencida(c) ? ' vencida' : '')} key={c.id}>
                  <span className="pv-lanc-nome">
                    <strong>{c.descricao}</strong>
                    <small>
                      {c.fornecedor} · {CATEGORIA_LABEL[c.categoria]} · venc. {dataCurta(c.vencimento)}
                      {d > 0 ? ` · vencida há ${d} ${d === 1 ? 'dia' : 'dias'}` : d === 0 ? ' · vence hoje' : ''}
                    </small>
                  </span>
                  <span className="pv-valor">{reais(c.cents)}</span>
                  <button className="pv-acao-mini" onClick={() => pagar(c)} aria-label={`Pagar ${c.descricao}, ${reais(c.cents)}`}>
                    Pagar
                  </button>
                </li>
              )
            })}
          </ul>
          {!contas.length && <p className="pv-empty">Tudo pago. Nenhuma conta em aberto.</p>}
        </>
      )}
      {aba === 'fluxo' && <FluxoDeCaixa op={op} />}
    </section>
  )
}

/** Situação financeira e faturas na ficha do cliente. */
export function FaturasDoCliente({ client }: { client: Client }) {
  const pagas = useGestao((s) => s.pagas)
  const receber = useGestao((s) => s.registrarPagamento)
  const abertas = faturasAbertas(client.id, pagas)
  const situacao = situacaoFinanceira(client.id, pagas)
  const total = abertas.reduce((s, f) => s + f.cents, 0)
  return (
    <>
      <div className="pv-section-title">
        <h3>Financeiro</h3>
        <span className={'pv-situacao ' + situacao}>{SITUACAO_LABEL[situacao]}</span>
      </div>
      {abertas.length ? (
        <ul className="pv-lancs" aria-label="Faturas em aberto do cliente">
          {abertas.map((f) => {
            const d = atraso(f)
            return (
              <li className={'pv-lanc' + (d > 0 ? ' vencida' : '')} key={f.id}>
                <span className="pv-lanc-nome">
                  <strong>Venc. {dataCurta(f.due)}/2026</strong>
                  <small>{d > 0 ? `${d} ${d === 1 ? 'dia' : 'dias'} de atraso` : d === 0 ? 'vence hoje' : `vence em ${-d} dias`}</small>
                </span>
                <span className="pv-valor">{reais(f.cents)}</span>
                <button className="pv-acao-mini" onClick={() => receber(f)} aria-label={`Registrar pagamento da fatura de ${dataCurta(f.due)}`}>
                  Receber
                </button>
              </li>
            )
          })}
          <li className="pv-lanc total">
            <span className="pv-lanc-nome">
              <strong>Total em aberto</strong>
            </span>
            <span className="pv-valor">{reais(total)}</span>
          </li>
        </ul>
      ) : (
        <p className="pv-empty">Nenhuma fatura em aberto.</p>
      )}
    </>
  )
}

/* ---------------- Atendimento ---------------- */

const prazoTexto = (os: OrdemServico) => {
  const h = horasRestantes(os)
  if (h < 0) return `prazo estourado há ${Math.ceil(-h)} h`
  return h < 24 ? `vence em ${Math.max(1, Math.round(h))} h` : `vence em ${Math.round(h / 24)} dias`
}

export function AcoesOS({ os, op, aoMudarIncidentes }: { os: OrdemServico; op: OperacaoCompleta; aoMudarIncidentes: (l: Incident[]) => void }) {
  const despachar = useGestao((s) => s.despachar)
  const concluir = useGestao((s) => s.concluirOS)
  const livres = tecnicosLivres(op.ordens)
  const [escolhido, setEscolhido] = useState('')
  const tecnico = os.tecnicoId ? funcionarios.find((f) => f.id === os.tecnicoId) : undefined
  if (os.status === 'aberta') {
    const id = livres.some((t) => t.id === escolhido) ? escolhido : livres[0]?.id
    return livres.length ? (
      <span className="pv-os-acoes">
        <select aria-label={`Técnico para ${os.id}`} value={id} onChange={(e) => setEscolhido(e.target.value)}>
          {livres.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <button className="pv-acao-mini" onClick={() => despachar(os, id!)}>
          Despachar
        </button>
      </span>
    ) : (
      <small className="pv-os-espera">Todos os técnicos estão ocupados. Conclua uma ordem para liberar alguém.</small>
    )
  }
  return (
    <span className="pv-os-acoes">
      <small>
        {tecnico?.nome} · {STATUS_OS_LABEL[os.status].toLowerCase()}
      </small>
      <button
        className="pv-acao-mini"
        disabled={os.status !== 'em_atendimento'}
        onClick={() => {
          concluir(os)
          if (os.incidente) {
            closeIncident(os.incidente)
            aoMudarIncidentes(readIncidents())
          }
        }}
      >
        {os.status === 'em_atendimento' ? 'Concluir' : 'A caminho…'}
      </button>
    </span>
  )
}

function LinhaOS({ os, op, abrirCliente, aoMudarIncidentes }: { os: OrdemServico } & Pick<PainelProps, 'op' | 'abrirCliente' | 'aoMudarIncidentes'>) {
  const c = clientById.get(os.clientId)!
  const urg = osVencida(os) ? 'offline' : horasRestantes(os) <= 4 ? 'unstable' : 'azul'
  return (
    <li className="pv-os">
      <button className="pv-lanc-nome" onClick={() => abrirCliente(c)} title="Abrir o cliente no mapa">
        <strong>
          <i className={'pv-os-tipo ' + urg}>{TIPO_OS_LABEL[os.tipo]}</i> {c.name}
        </strong>
        <small>
          {os.id} · {c.address} · <span className={urg}>{prazoTexto(os)}</span>
        </small>
        <small>{os.descricao}</small>
      </button>
      <AcoesOS os={os} op={op} aoMudarIncidentes={aoMudarIncidentes} />
    </li>
  )
}

function Atendimento(props: PainelProps) {
  const { op } = props
  const concluidas = useGestao((s) => s.concluidas)
  const [aba, setAba] = useState<'aberta' | 'andamento'>('aberta')
  const semTecnico = op.ordens.filter((o) => o.status === 'aberta')
  const andamento = op.ordens.filter((o) => o.status !== 'aberta')
  const lista = aba === 'aberta' ? semTecnico : andamento
  return (
    <section className="pv-gestao">
      <Cabecalho kicker="ATENDIMENTO · ORDENS DE SERVIÇO" titulo="Campo e chamados">
        No mapa: cada pino é uma ordem (R reparo, I instalação, T troca de plano, M mudança, X retirada) e as viaturas mostram onde está cada técnico.
      </Cabecalho>
      <div className="pv-tiles">
        <Tile rotulo="Ordens abertas" valor={op.ordens.length} />
        <Tile rotulo="Sem técnico" valor={semTecnico.length} tom={semTecnico.length ? 'aviso' : 'ok'} />
        <Tile rotulo="Vencem em 4 h" valor={op.ordens.filter((o) => !osVencida(o) && horasRestantes(o) <= 4).length} tom="aviso" />
        <Tile rotulo="Concluídas hoje" valor={concluidas.length} nota={concluidas.length ? `${concluidas.filter((c) => c.noPrazo).length} no prazo` : undefined} tom="ok" />
      </div>
      <Abas
        rotulo="Ordens de serviço"
        ativa={aba}
        mudar={setAba}
        abas={[
          ['aberta', 'Aguardando técnico', semTecnico.length],
          ['andamento', 'Em andamento', andamento.length],
        ]}
      />
      <ul className="pv-lancs" aria-label="Ordens de serviço">
        {lista.map((os) => (
          <LinhaOS key={os.id} os={os} {...props} />
        ))}
      </ul>
      {!lista.length && <p className="pv-empty">{aba === 'aberta' ? 'Nenhuma ordem esperando técnico.' : 'Nenhum atendimento em andamento.'}</p>}
    </section>
  )
}

/** Ordens de serviço do cliente, na ficha dele. */
export function OrdensDoCliente({ client, op, aoMudarIncidentes }: { client: Client; op: OperacaoCompleta; aoMudarIncidentes: (l: Incident[]) => void }) {
  const lista = op.ordens.filter((o) => o.clientId === client.id)
  if (!lista.length) return null
  return (
    <>
      <div className="pv-section-title">
        <h3>Ordens de serviço</h3>
        <b>{lista.length}</b>
      </div>
      <ul className="pv-lancs">
        {lista.map((os) => (
          <li className="pv-os" key={os.id}>
            <span className="pv-lanc-nome">
              <strong>
                {os.id} · {TIPO_OS_LABEL[os.tipo]}
              </strong>
              <small>
                {os.descricao} · {prazoTexto(os)}
              </small>
            </span>
            <AcoesOS os={os} op={op} aoMudarIncidentes={aoMudarIncidentes} />
          </li>
        ))}
      </ul>
    </>
  )
}

/* ---------------- Equipe ---------------- */

function Equipe({ op }: PainelProps) {
  const xpSessao = useGestao((s) => s.xpTecnico)
  const concluidas = useGestao((s) => s.concluidas)
  const ranking = tecnicos
    .concat(funcionarios.filter((f) => f.setor === 'campo' && !f.veiculo))
    .map((t) => ({ t, xp: t.xp + (xpSessao[t.id] ?? 0), hoje: concluidas.filter((c) => c.tecnicoId === t.id).length }))
    .sort((a, b) => b.xp - a.xp)
  const presentes = funcionarios.filter((f) => f.presenca === 'trabalhando').length
  const folha = funcionarios.reduce((s, f) => s + f.salario, 0)
  const setores = [...new Set(funcionarios.map((f) => f.setor))].filter((s) => s !== 'campo') as Setor[]
  const situacao = (id: string) => {
    const os = op.ordens.find((o) => o.tecnicoId === id)
    return os ? `${STATUS_OS_LABEL[os.status]} · ${os.id}` : 'Disponível na base'
  }
  return (
    <section className="pv-gestao">
      <Cabecalho kicker="EQUIPE · 10/11/2026" titulo="Funcionários">
        {funcionarios.length} pessoas · {presentes} trabalhando hoje · folha mensal de {reaisCurto(folha)}
      </Cabecalho>
      <div className="pv-section-title">
        <h3>Ranking dos técnicos no mês</h3>
        <b>{ranking.length}</b>
      </div>
      <ol className="pv-ranking" aria-label="Ranking dos técnicos por XP">
        {ranking.map(({ t, xp, hoje }, k) => (
          <li key={t.id} className={t.presenca !== 'trabalhando' ? 'ausente' : undefined}>
            <span className={'pv-medalha m' + Math.min(k + 1, 4)} aria-hidden="true">
              {k + 1}
            </span>
            <span className="pv-row-label">
              <strong>{t.nome}</strong>
              <small>
                {t.presenca === 'trabalhando' ? (t.veiculo ? `${t.veiculo} · ${situacao(t.id)}` : t.cargo) : t.presenca === 'folga' ? 'Folga hoje' : 'Férias'}
                {t.nota ? ` · nota ${t.nota.toLocaleString('pt-BR')}` : ''}
              </small>
              <Medidor valor={xp / ranking[0].xp} rotulo={`${xp} XP`} />
            </span>
            <span className="pv-xp">
              {xp.toLocaleString('pt-BR')} XP
              <small>
                {t.osMes + hoje} OS{hoje ? ` · +${hoje} hoje` : ''}
              </small>
            </span>
          </li>
        ))}
      </ol>
      {setores.map((s) => {
        const lista = funcionarios.filter((f) => f.setor === s)
        return (
          <div key={s}>
            <div className="pv-section-title">
              <h3>{SETOR_LABEL[s]}</h3>
              <b>{lista.length}</b>
            </div>
            <ul className="pv-pessoas">
              {lista.map((f) => (
                <li key={f.id} className={f.presenca !== 'trabalhando' ? 'ausente' : undefined}>
                  <span className="pv-avatar online">{iniciais(f.nome)}</span>
                  <span className="pv-row-label">
                    <strong>{f.nome}</strong>
                    <small>
                      {f.cargo}
                      {f.presenca !== 'trabalhando' && ` · ${f.presenca === 'folga' ? 'folga hoje' : 'férias'}`}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

/* ---------------- Estoque ---------------- */

function Estoque({ op }: PainelProps) {
  const repor = useGestao((s) => s.reporItem)
  const criticos = op.estoque.filter((s) => s.critico)
  const categorias = [...new Set(op.estoque.map((s) => s.item.categoria))]
  return (
    <section className="pv-gestao">
      <Cabecalho kicker="ESTOQUE · ALMOXARIFADO CENTRAL" titulo="Materiais">
        Cada ordem concluída baixa o material usado. Repor cria o pedido e lança a compra em contas a pagar.
      </Cabecalho>
      <div className="pv-tiles">
        <Tile rotulo="Valor em estoque" valor={reaisCurto(valorEstoque([...op.estoque]))} />
        <Tile rotulo="Abaixo do mínimo" valor={criticos.length} nota={criticos.length ? 'sem pedido a caminho' : 'tudo coberto'} tom={criticos.length ? 'ruim' : 'ok'} />
      </div>
      {categorias.map((cat) => (
        <div key={cat}>
          <div className="pv-section-title">
            <h3>{cat}</h3>
          </div>
          <ul className="pv-itens">
            {op.estoque
              .filter((s) => s.item.categoria === cat)
              .map((s) => {
                const teto = s.item.minimo * 2.2
                const lote = loteReposicao(s)
                return (
                  <li key={s.item.id} className={s.critico ? 'critico' : s.baixo ? 'baixo' : undefined}>
                    <div>
                      <strong>{s.item.nome}</strong>
                      <span>
                        {s.saldo.toLocaleString('pt-BR')} {s.item.unidade}
                        <small> / mín. {s.item.minimo.toLocaleString('pt-BR')}</small>
                      </span>
                    </div>
                    <Medidor valor={s.saldo / teto} marca={s.item.minimo / teto} rotulo={`${s.item.nome}: ${s.saldo} de mínimo ${s.item.minimo}`} tom={s.critico ? 'ruim' : s.baixo ? 'aviso' : 'ok'} />
                    <div>
                      <small>
                        {s.cobertura < 1 ? 'menos de 1 semana de consumo' : `${s.cobertura.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} semanas de consumo`}
                        {s.aCaminho > 0 && ` · +${s.aCaminho.toLocaleString('pt-BR')} a caminho`}
                      </small>
                      {s.baixo && lote > 0 && (
                        <button className="pv-acao-mini" onClick={() => repor(s.item.id)} aria-label={`Repor ${s.item.nome}: pedir ${lote} ${s.item.unidade}`}>
                          Repor · {reaisCurto(lote * s.item.custo)}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </section>
  )
}

/* ---------------- Monitoramento ---------------- */

const SEV: Record<Severidade, [string, string]> = { critica: ['offline', 'Crítico'], alta: ['offline', 'Alto'], aviso: ['unstable', 'Aviso'], info: ['azul', 'Info'] }

function Monitor({ abrirPonto }: PainelProps) {
  const { leitura, historico, fonte, simulada, erro } = useMonitorStore()
  const pontos = [...leitura.pontos].sort((a, b) => (b.estado !== 'ok' ? 1 : 0) - (a.estado !== 'ok' ? 1 : 0) || utilizacao(b) - utilizacao(a))
  const max = Math.max(1, ...historico) * 1.05,
    min = Math.min(...historico, max) * 0.95
  const linha = historico.map((v, i) => `${(i / Math.max(1, historico.length - 1)) * 100},${34 - ((v - min) / Math.max(1, max - min)) * 30}`).join(' ')
  const uso = leitura.totalMbps / leitura.capacidadeTotalMbps
  return (
    <section className="pv-gestao">
      <Cabecalho kicker={`MONITORAMENTO · FONTE: ${fonte.toUpperCase()}`} titulo="Rede ao vivo">
        No mapa: os pulsos na fibra andam mais rápido e mudam de cor conforme o uso; cada ponto tem uma coluna de ocupação do enlace.
      </Cabecalho>
      {erro && <p className="pv-obra-aviso">Falha ao consultar a fonte: {erro}. Mostrando a última leitura.</p>}
      <div className="pv-tiles">
        <Tile
          rotulo="Saída para a internet"
          valor={`${(leitura.totalMbps / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} Gb/s`}
          nota={
            historico.length > 1 ? (
              <svg className="pv-spark" viewBox="0 0 100 36" preserveAspectRatio="none" role="img" aria-label="Tráfego total nos últimos minutos">
                <polyline points={linha} />
              </svg>
            ) : (
              'coletando…'
            )
          }
        />
        <Tile rotulo="Uso do link" valor={pct(uso)} nota={<Medidor valor={uso} rotulo="Uso do link de internet" tom={uso > 0.85 ? 'ruim' : uso > 0.65 ? 'aviso' : 'ok'} />} tom={uso > 0.85 ? 'ruim' : undefined} />
      </div>
      <div className="pv-section-title">
        <h3>Alarmes</h3>
        <b>{leitura.alarmes.length}</b>
      </div>
      {leitura.alarmes.length ? (
        <ul className="pv-lancs">
          {leitura.alarmes.map((a) => {
            const p = a.pontoId ? pointById.get(a.pontoId) : undefined
            return (
              <li className="pv-lanc" key={a.id}>
                <button className="pv-lanc-nome" disabled={!p} onClick={() => p && abrirPonto(p)}>
                  <strong>
                    <i className={'pv-os-tipo ' + SEV[a.severidade][0]}>{SEV[a.severidade][1]}</i> {a.titulo}
                  </strong>
                  <small>
                    {a.fonte} · há {Math.max(1, Math.round((leitura.em - a.desde) / 60000))} min
                  </small>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="pv-empty">Nenhum alarme ativo.</p>
      )}
      <div className="pv-section-title">
        <h3>Pontos de acesso</h3>
        <b>{accessPoints.length}</b>
      </div>
      <table className="pv-tabela">
        <thead>
          <tr>
            <th>Ponto</th>
            <th>Tráfego</th>
            <th>Uso</th>
            <th>Lat.</th>
            <th>Perda</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((m) => {
            const u = utilizacao(m)
            return (
              <tr key={m.pontoId} className={m.estado !== 'ok' ? 'alerta' : undefined}>
                <th>
                  <button onClick={() => abrirPonto(pointById.get(m.pontoId)!)} title={ESTADO_PONTO_LABEL[m.estado]}>
                    <i className={m.estado === 'ok' ? 'online' : 'offline'} />
                    {m.pontoId}
                  </button>
                </th>
                <td>{Math.round(m.trafegoMbps)} Mb/s</td>
                <td>
                  <Medidor valor={u} rotulo={`Uso de ${m.pontoId}: ${pct(u)}`} tom={u > 0.85 ? 'ruim' : u > 0.65 ? 'aviso' : 'ok'} />
                </td>
                <td>{Math.round(m.latenciaMs)} ms</td>
                <td>{m.perdaPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <details className="pv-device">
        <summary>Conectar Zabbix e Grafana</summary>
        <p>
          {simulada
            ? 'Hoje os números são simulados a partir dos incidentes. Para dados reais, configure VITE_MONITOR_FONTE=zabbix e VITE_ZABBIX_URL (e VITE_GRAFANA_URL para os alertas); cada host é ligado ao ponto pela tag "ponto" ou pelo id no nome.'
            : 'Fonte real configurada. Cada host é ligado ao ponto pela tag "ponto" ou pelo id no nome do host.'}
          {grafana ? ' Alertas do Grafana ativos.' : ''}
        </p>
      </details>
    </section>
  )
}

/** Painel do Grafana embutido na ficha do ponto, quando configurado. */
export function PainelGrafana({ ponto }: { ponto: AccessPoint }) {
  const url = painelDoPonto(ponto.id)
  if (!url) return null
  return (
    <details className="pv-device" open>
      <summary>Gráfico do Grafana</summary>
      <iframe className="pv-grafana" src={url} title={`Painel do Grafana de ${ponto.id}`} loading="lazy" />
    </details>
  )
}

/* ---------------- Missões ---------------- */

function Missoes({ op, abrirModulo }: PainelProps) {
  const xp = useGestao((s) => s.xp)
  const reiniciar = useGestao((s) => s.reiniciar)
  const operador = nivelOperador(xp)
  const { total, fracoes } = op.saude
  const { atual, proximo } = op.nivel
  return (
    <section className="pv-gestao">
      <Cabecalho kicker="CENTRAL DE COMANDO · TURNO DE HOJE" titulo="Missões e saúde da operação" />
      <div className="pv-saude">
        <div>
          <strong>{total}</strong>
          <span>
            / 1.000 · {atual.nome}
            {proximo && <small>faltam {proximo.min - total} para {proximo.nome}</small>}
          </span>
        </div>
        <ul aria-label="Composição da saúde da operação">
          {(Object.keys(PILARES) as Pilar[]).map((p) => (
            <li key={p}>
              <span>{PILAR_LABEL[p]}</span>
              <Medidor valor={fracoes[p]} rotulo={`${PILAR_LABEL[p]}: ${Math.round(PILARES[p] * fracoes[p])} de ${PILARES[p]}`} tom={fracoes[p] < 0.5 ? 'ruim' : fracoes[p] < 0.8 ? 'aviso' : 'ok'} />
              <b>
                {Math.round(PILARES[p] * fracoes[p])}
                <small>/{PILARES[p]}</small>
              </b>
            </li>
          ))}
        </ul>
      </div>
      <div className="pv-operador">
        <span className="pv-medalha m1" aria-hidden="true">
          {operador.nivel}
        </span>
        <span className="pv-row-label">
          <strong>Operador nível {operador.nivel}</strong>
          <small>
            {xp} XP no turno · faltam {operador.falta} para o nível {operador.nivel + 1}
          </small>
          <Medidor valor={operador.progresso} rotulo={`Progresso do nível: ${pct(operador.progresso)}`} />
        </span>
      </div>
      <div className="pv-section-title">
        <h3>Missões do turno</h3>
        <b>
          {op.missoes.filter((m) => m.concluida).length}/{op.missoes.length}
        </b>
      </div>
      <ol className="pv-missoes">
        {op.missoes.map((m) => (
          <li key={m.id} className={m.concluida ? 'feita' : undefined}>
            <span className="pv-missao-icone" aria-hidden="true">
              <Icon name={m.concluida ? 'check' : 'trophy'} />
            </span>
            <span className="pv-row-label">
              <strong>{m.titulo}</strong>
              <small>{m.descricao}</small>
              <Medidor valor={m.total ? m.feito / m.total : 0} rotulo={`${m.titulo}: ${m.feito} de ${m.total}`} tom={m.concluida ? 'ok' : 'aviso'} />
            </span>
            <span className="pv-missao-acao">
              <b>+{m.xp} XP</b>
              <small>
                {m.feito}/{m.total}
              </small>
              {!m.concluida && (
                <button className="pv-acao-mini" onClick={() => abrirModulo(m.modulo)} aria-label={`Ir para a missão: ${m.titulo}`}>
                  Ir
                </button>
              )}
            </span>
          </li>
        ))}
      </ol>
      <div className="pv-section-title">
        <h3>Conquistas</h3>
        <b>
          {op.conquistas.filter((c) => c.obtida).length}/{op.conquistas.length}
        </b>
      </div>
      <ul className="pv-conquistas">
        {op.conquistas.map((c) => (
          <li key={c.id} className={c.obtida ? 'obtida' : undefined} title={c.descricao} aria-label={`${c.nome}: ${c.descricao}. ${c.obtida ? 'Obtida' : 'Ainda não obtida'}`}>
            <Icon name={c.obtida ? 'trophy' : 'check'} />
            <span>{c.nome}</span>
          </li>
        ))}
      </ul>
      <button
        className="pv-link pv-reiniciar"
        onClick={() => {
          if (window.confirm('Reiniciar a demonstração? Pagamentos, ordens concluídas, pedidos e XP voltam ao início.')) reiniciar()
        }}
      >
        Reiniciar a demonstração
      </button>
    </section>
  )
}

/* ---------------- Roteador ---------------- */

export function PainelGestao({ modulo, ...props }: PainelProps & { modulo: Modulo }) {
  if (modulo === 'financeiro') return <Financeiro {...props} />
  if (modulo === 'atendimento') return <Atendimento {...props} />
  if (modulo === 'equipe') return <Equipe {...props} />
  if (modulo === 'estoque') return <Estoque {...props} />
  if (modulo === 'monitor') return <Monitor {...props} />
  return <Missoes {...props} />
}
