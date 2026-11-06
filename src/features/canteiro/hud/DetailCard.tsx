import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LIMITE_MISTURA_MIN, minutosDesde } from '../data/live'
import { avancoFisico, semanaParaData, terminoPrevisto, terminoProjetado } from '../data/schedule'
import { useObraData } from '../data/store'
import type { Concretagem, ElementoEstrutural, Entidade, Equipamento, Equipe, FuncaoTrabalhador } from '../data/types'
import { useCanteiroStore } from '../state/canteiroStore'
import { useAgora } from '../state/useAgora'
import { useMediaQuery } from '../state/useMediaQuery'
import { useSelecionar } from '../state/useSelecionar'
import { COR_CAPACETE } from '../scene/palette'
import { data as fmtData, diasEntre, hora, num, num1, pct } from './format'
import { Meter } from './Meter'
import { StatusPill } from './StatusPill'

/** Entidade selecionada, montada a partir de seletores com referência estável. */
export function useEntidade(id: string | null): Entidade | null {
  const elemento = useObraData((d) => (id ? d.elementos.find((e) => e.id === id) : undefined))
  const equipamento = useObraData((d) => (id ? d.equipamentos.find((e) => e.id === id) : undefined))
  const concretagem = useObraData((d) => (id ? d.concretagens.find((c) => c.id === id) : undefined))
  const equipe = useObraData((d) => (id ? d.equipes.find((e) => e.id === id) : undefined))
  return useMemo(() => {
    if (elemento) return { tipo: 'elemento', item: elemento }
    if (equipamento) return { tipo: 'equipamento', item: equipamento }
    if (concretagem) return { tipo: 'concretagem', item: concretagem }
    if (equipe) return { tipo: 'equipe', item: equipe }
    return null
  }, [elemento, equipamento, concretagem, equipe])
}

function Campo({ rotulo, children, mono }: { rotulo: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="cnt-field">
      <dt>{rotulo}</dt>
      <dd className={mono ? 'cnt-mono' : undefined}>{children}</dd>
    </div>
  )
}

function Cabecalho({ tipo, codigo, sub, status }: { tipo: string; codigo: string; sub?: ReactNode; status?: ReactNode }) {
  return (
    <header className="cnt-card-head">
      <p className="cnt-eyebrow">{tipo}</p>
      <div className="cnt-card-title">
        <h2 className="cnt-code">{codigo}</h2>
        {status}
      </div>
      {sub && <p className="cnt-card-sub">{sub}</p>}
    </header>
  )
}

function Aviso({ tom, children }: { tom: 'vermelho' | 'amarelo'; children: ReactNode }) {
  return (
    <p className={`cnt-aviso cnt-aviso-${tom}`} role={tom === 'vermelho' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

/* ---------------- Pilar / laje ---------------- */

const DIAS_CURA = 7

function CardElemento({ el }: { el: ElementoEstrutural }) {
  const agora = useAgora(60000)
  const concretagem = useObraData((d) => d.concretagens.find((c) => c.id === el.concretagemId))
  const selecionar = useSelecionar()
  const idade = el.dataConcretagem ? diasEntre(el.dataConcretagem, agora) : null
  const tipo = el.tipo === 'pilar' ? 'Pilar' : 'Laje'

  return (
    <>
      <Cabecalho
        tipo={`${tipo} · ${el.pavimentoNumero}º pavimento`}
        codigo={el.codigo}
        status={<StatusPill status={el.status} />}
      />
      {el.status === 'nao_conforme' && (
        <Aviso tom="vermelho">NC-014 aberta: resistência aos 28 dias abaixo do fck. Extração de testemunhos pendente.</Aviso>
      )}
      <dl className="cnt-fields">
        <Campo rotulo="fck" mono>
          {el.fck} MPa
        </Campo>
        <Campo rotulo="Volume" mono>
          {num1(el.volumeM3)} m³
        </Campo>
        <Campo rotulo="Concretagem" mono>
          {el.dataConcretagem ? fmtData(el.dataConcretagem) : 'Não concretado'}
        </Campo>
        <Campo rotulo="Idade" mono>
          {idade === null ? '—' : idade === 0 ? 'Hoje' : `${idade} dias`}
        </Campo>
      </dl>

      {idade !== null && (
        <section className="cnt-sec" aria-label="Cura">
          <div className="cnt-sec-row">
            <h3>Cura úmida</h3>
            <span className="cnt-mono">{idade >= DIAS_CURA ? 'Concluída' : `Dia ${idade + 1} de ${DIAS_CURA}`}</span>
          </div>
          <Meter valor={Math.min(1, (idade + (idade >= DIAS_CURA ? 0 : 1)) / DIAS_CURA)} tom={idade >= DIAS_CURA ? 'verde' : 'azul'} rotulo="Progresso da cura" />
        </section>
      )}

      {el.rompimentos.length > 0 && (
        <section className="cnt-sec" aria-label="Rompimento de corpos de prova">
          <h3>Rompimento de corpos de prova</h3>
          <table className="cnt-mini-table">
            <thead>
              <tr>
                <th scope="col">Idade</th>
                <th scope="col">Resultado</th>
                <th scope="col">% do fck</th>
              </tr>
            </thead>
            <tbody>
              {el.rompimentos.map((r) => {
                const abaixo = r.mpa !== null && r.idadeDias === 28 && r.mpa < el.fck
                return (
                  <tr key={r.idadeDias} className={abaixo ? 'cnt-row-bad' : undefined}>
                    <td>{r.idadeDias} dias</td>
                    <td className="cnt-mono">{r.mpa === null ? 'Aguardando' : `${num1(r.mpa)} MPa`}</td>
                    <td className="cnt-mono">{r.mpa === null ? '—' : pct(r.mpa / el.fck)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {concretagem && concretagem.status === 'em_andamento' && (
        <section className="cnt-sec">
          <div className="cnt-sec-row">
            <h3>Concretagem em andamento</h3>
            <span className="cnt-mono">
              {num1(concretagem.volumeLancadoM3)} / {num1(concretagem.volumeProgramadoM3)} m³
            </span>
          </div>
          <Meter valor={concretagem.volumeLancadoM3 / concretagem.volumeProgramadoM3} rotulo="Volume lançado" />
          <button type="button" className="cnt-link" onClick={() => selecionar(concretagem.id)}>
            Abrir concretagem {concretagem.codigo}
          </button>
        </section>
      )}
    </>
  )
}

/* ---------------- Caminhão betoneira ---------------- */

function CardBetoneira({ eq }: { eq: Equipamento }) {
  const agora = useAgora(1000)
  const r = eq.remessa!
  const minutos = Math.max(0, minutosDesde(r.saidaUsina, agora))
  const acima = minutos > LIMITE_MISTURA_MIN && eq.status !== 'liberado'
  const proximo = minutos > LIMITE_MISTURA_MIN - 30
  const concretagem = useObraData((d) => d.concretagens.find((c) => c.id === r.concretagemId))
  const slumpOk = concretagem ? Math.abs(r.slumpCm - concretagem.slumpEspecificadoCm) <= 2 : true

  return (
    <>
      <Cabecalho tipo="Caminhão betoneira" codigo={eq.codigo} sub={<span className="cnt-placa">{r.placa}</span>} status={<StatusPill status={eq.status} />} />
      <section className={`cnt-mistura${acima ? ' is-bad' : proximo ? ' is-warn' : ''}`} aria-live="polite">
        <div className="cnt-sec-row">
          <h3>Tempo desde a mistura</h3>
          <span className="cnt-mono">limite {LIMITE_MISTURA_MIN} min</span>
        </div>
        <p className="cnt-mistura-valor">
          <span className="cnt-display">{Math.floor(minutos)}</span> min
        </p>
        <Meter valor={minutos / (LIMITE_MISTURA_MIN * 1.2)} marca={1 / 1.2} tom={acima ? 'vermelho' : proximo ? 'amarelo' : 'azul'} rotulo="Tempo desde a mistura em relação ao limite" />
      </section>
      {acima && <Aviso tom="vermelho">Acima de {LIMITE_MISTURA_MIN} min. Avaliar o concreto com o tecnologista antes de lançar.</Aviso>}
      {eq.observacao && !acima && <Aviso tom="amarelo">{eq.observacao}</Aviso>}
      <dl className="cnt-fields">
        <Campo rotulo="Usina">{r.usina}</Campo>
        <Campo rotulo="Nota fiscal" mono>
          NF {r.notaFiscal}
        </Campo>
        <Campo rotulo="Volume" mono>
          {num1(r.descarregadoM3)} / {num1(r.volumeM3)} m³
        </Campo>
        <Campo rotulo="Slump" mono>
          <span className={slumpOk ? undefined : 'cnt-txt-bad'}>
            {num1(r.slumpCm)} cm
          </span>
          {concretagem && <span className="cnt-muted"> · esp. {concretagem.slumpEspecificadoCm} ± 2</span>}
        </Campo>
        <Campo rotulo="Saída da usina" mono>
          {hora(r.saidaUsina)}
        </Campo>
        <Campo rotulo="Motorista">{eq.operador}</Campo>
      </dl>
    </>
  )
}

/* ---------------- Grua e demais equipamentos ---------------- */

function CardEquipamento({ eq }: { eq: Equipamento }) {
  const agora = useAgora(60000)
  const diasManut = Math.round((new Date(eq.proximaManutencao).getTime() - agora.getTime()) / 86400000)
  const temCarga = eq.capacidadeT !== undefined && eq.cargaAtualT !== undefined
  return (
    <>
      <Cabecalho tipo={eq.nome} codigo={eq.codigo} status={<StatusPill status={eq.status} />} />
      {eq.status === 'parado' && eq.observacao && <Aviso tom="vermelho">{eq.observacao}</Aviso>}
      {temCarga && (
        <section className="cnt-sec" aria-label="Carga">
          <div className="cnt-sec-row">
            <h3>Carga atual</h3>
            <span className="cnt-mono">
              {num1(eq.cargaAtualT!)} de {num1(eq.capacidadeT!)} t
            </span>
          </div>
          <Meter valor={eq.cargaAtualT! / eq.capacidadeT!} marca={0.9} tom={eq.cargaAtualT! / eq.capacidadeT! > 0.9 ? 'vermelho' : 'azul'} rotulo="Carga em relação à capacidade" />
        </section>
      )}
      <dl className="cnt-fields">
        <Campo rotulo="Operador">{eq.operador}</Campo>
        <Campo rotulo="Horímetro" mono>
          {num1(eq.horimetro)} h
        </Campo>
        <Campo rotulo="Utilização hoje" mono>
          {pct(eq.utilizacao)}
        </Campo>
        <Campo rotulo="Próxima manutenção" mono>
          {fmtData(eq.proximaManutencao)}
          <span className={diasManut <= 3 ? 'cnt-txt-warn' : 'cnt-muted'}> · {diasManut <= 0 ? 'hoje' : `em ${diasManut} dias`}</span>
        </Campo>
      </dl>
      {eq.status !== 'parado' && eq.observacao && <p className="cnt-nota">{eq.observacao}</p>}
    </>
  )
}

/* ---------------- Equipe ---------------- */

const FUNCAO: Record<FuncaoTrabalhador, string> = {
  encarregado: 'Encarregado',
  armador: 'Armadores',
  carpinteiro: 'Carpinteiros',
  pedreiro: 'Pedreiros',
  servente: 'Serventes',
  operador: 'Operadores',
  seguranca: 'Técnicos de segurança',
}

function CardEquipe({ eq }: { eq: Equipe }) {
  return (
    <>
      <Cabecalho tipo="Equipe" codigo={eq.codigo} sub={eq.nome} status={<StatusPill status={eq.fvs.status} />} />
      <dl className="cnt-fields">
        <Campo rotulo="Função">
          <span className="cnt-capacete" style={{ background: COR_CAPACETE[eq.funcao] }} aria-hidden /> {FUNCAO[eq.funcao]}
        </Campo>
        <Campo rotulo="Encarregado">{eq.encarregado}</Campo>
        <Campo rotulo="No canteiro" mono>
          {eq.membros} pessoas
        </Campo>
        <Campo rotulo="Local">{eq.local}</Campo>
        <Campo rotulo="FVS" mono>
          {eq.fvs.codigo}
        </Campo>
      </dl>
      <section className="cnt-sec">
        <div className="cnt-sec-row">
          <h3>{eq.atividade}</h3>
          <span className="cnt-mono">{pct(eq.progresso)}</span>
        </div>
        <Meter valor={eq.progresso} tom={eq.progresso >= 1 ? 'verde' : 'azul'} rotulo="Avanço da atividade" />
      </section>
    </>
  )
}

/* ---------------- Concretagem ---------------- */

function CardConcretagem({ c }: { c: Concretagem }) {
  const caminhoes = useObraData((d) => d.equipamentos)
  const selecionar = useSelecionar()
  const lista = caminhoes.filter((e) => c.caminhaoIds.includes(e.id))
  return (
    <>
      <Cabecalho tipo={`Concretagem · ${c.pavimentoNumero}º pavimento`} codigo={c.codigo} sub={c.descricao} status={<StatusPill status={c.status} />} />
      <section className="cnt-sec">
        <div className="cnt-sec-row">
          <h3>Volume lançado</h3>
          <span className="cnt-mono">
            {num1(c.volumeLancadoM3)} / {num1(c.volumeProgramadoM3)} m³
          </span>
        </div>
        <Meter valor={c.volumeLancadoM3 / c.volumeProgramadoM3} tom={c.status === 'concluida' ? 'verde' : 'azul'} rotulo="Volume lançado" />
      </section>
      <dl className="cnt-fields">
        <Campo rotulo="fck" mono>
          {c.fck} MPa
        </Campo>
        <Campo rotulo="Slump especificado" mono>
          {c.slumpEspecificadoCm} ± 2 cm
        </Campo>
        <Campo rotulo="Data" mono>
          {fmtData(c.data)}
        </Campo>
        <Campo rotulo="Elementos" mono>
          {c.elementoIds.length}
        </Campo>
      </dl>
      {lista.length > 0 && (
        <section className="cnt-sec" aria-label="Caminhões">
          <h3>Caminhões</h3>
          <ul className="cnt-list">
            {lista.map((t) => (
              <li key={t.id}>
                <button type="button" className="cnt-list-btn" onClick={() => selecionar(t.id)}>
                  <span className="cnt-mono">{t.codigo}</span>
                  <span className="cnt-placa">{t.remessa?.placa}</span>
                  <StatusPill status={t.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/* ---------------- Visão da obra ---------------- */

function CardObra() {
  const obra = useObraData((d) => d.obra)
  const pavimentos = useObraData((d) => d.pavimentos)
  const materiais = useObraData((d) => d.materiais)
  const equipamentos = useObraData((d) => d.equipamentos)
  const resumo = useMemo(() => {
    const dados = { obra, pavimentos }
    const real = avancoFisico(dados, obra.semanaAtual, 'executado')
    const previsto = avancoFisico(dados, obra.semanaAtual, 'previsto')
    const fimPrev = semanaParaData(obra, terminoPrevisto(dados))
    const fimProj = semanaParaData(obra, terminoProjetado(dados))
    const atrasoDias = Math.round((fimProj.getTime() - fimPrev.getTime()) / 86400000)
    return { real, previsto, fimPrev, fimProj, atrasoDias }
  }, [obra, pavimentos])
  const frota = equipamentos.filter((e) => e.tipo !== 'betoneira')
  const betoneiras = equipamentos.filter((e) => e.tipo === 'betoneira' && e.status !== 'liberado').length

  return (
    <>
      <Cabecalho tipo="Visão da obra" codigo={obra.codigo} sub={obra.nome} />
      <dl className="cnt-fields">
        <Campo rotulo="Endereço">{obra.endereco}</Campo>
        <Campo rotulo="Responsável técnico">{obra.responsavelTecnico}</Campo>
        <Campo rotulo="Mestre de obras">{obra.mestreDeObras}</Campo>
        <Campo rotulo="ART" mono>
          {obra.art.replace('ART ', '')}
        </Campo>
        <Campo rotulo="Término previsto" mono>
          {fmtData(resumo.fimPrev)}
        </Campo>
        <Campo rotulo="Término projetado" mono>
          <span className={resumo.atrasoDias > 7 ? 'cnt-txt-bad' : undefined}>{fmtData(resumo.fimProj)}</span>
          {resumo.atrasoDias > 0 && <span className="cnt-muted"> · +{resumo.atrasoDias} dias</span>}
        </Campo>
      </dl>

      <section className="cnt-sec" aria-label="Materiais críticos">
        <h3>Materiais críticos</h3>
        <ul className="cnt-list cnt-materiais">
          {materiais.map((m) => (
            <li key={m.id}>
              <span className="cnt-mat-nome">{m.nome}</span>
              <span className="cnt-mono cnt-muted">
                {num(m.quantidade)} {m.unidade}
                {m.consumoDiario > 0 && m.quantidade > 0 && ` · ${num(m.quantidade / m.consumoDiario)} d`}
              </span>
              <StatusPill status={m.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="cnt-sec" aria-label="Frota">
        <div className="cnt-sec-row">
          <h3>Frota de equipamentos</h3>
          <span className="cnt-mono cnt-muted">{betoneiras} betoneiras em ciclo</span>
        </div>
        <FrotaLista frota={frota} />
      </section>
    </>
  )
}

function FrotaLista({ frota }: { frota: Equipamento[] }) {
  const selecionar = useSelecionar()
  return (
    <ul className="cnt-list">
      {frota.map((e) => (
        <li key={e.id}>
          <button type="button" className="cnt-list-btn" onClick={() => selecionar(e.id)}>
            <span className="cnt-mono">{e.codigo}</span>
            <span className="cnt-list-nome">{e.nome}</span>
            <StatusPill status={e.status} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/* ---------------- Card ---------------- */

export function DetailCard() {
  const id = useCanteiroStore((s) => s.selecionadoId)
  const selecionar = useSelecionar()
  const entidade = useEntidade(id)
  const mobile = useMediaQuery('(max-width: 820px)')
  const [aberto, setAberto] = useState(false)

  // No celular, o bottom sheet abre sozinho ao selecionar algo.
  useEffect(() => {
    if (id) setAberto(true)
  }, [id])

  let conteudo: ReactNode
  if (!entidade) conteudo = <CardObra />
  else if (entidade.tipo === 'elemento') conteudo = <CardElemento el={entidade.item} />
  else if (entidade.tipo === 'concretagem') conteudo = <CardConcretagem c={entidade.item} />
  else if (entidade.tipo === 'equipe') conteudo = <CardEquipe eq={entidade.item} />
  else if (entidade.item.tipo === 'betoneira') conteudo = <CardBetoneira eq={entidade.item} />
  else conteudo = <CardEquipamento eq={entidade.item} />

  const titulo = entidade ? 'Detalhe do item selecionado' : 'Visão da obra'
  return (
    <aside className={`cnt-panel cnt-detail${mobile && aberto ? ' is-open' : ''}`} aria-label={titulo}>
      <span className="cnt-crop" aria-hidden />
      {mobile && (
        <button type="button" className="cnt-sheet-handle" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          <span aria-hidden />
          {aberto ? 'Recolher detalhes' : 'Mostrar detalhes'}
        </button>
      )}
      {entidade && (
        <button type="button" className="cnt-close" onClick={() => selecionar(null)} aria-label="Fechar e voltar para a visão da obra">
          ×
        </button>
      )}
      <div className="cnt-detail-body" key={id ?? 'obra'}>
        {conteudo}
      </div>
    </aside>
  )
}
