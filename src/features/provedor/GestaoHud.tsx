import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../shared/hooks/useReducedMotion'
import type { Camada } from './camadas'
import { pct, reaisCurto } from './gestao/base'
import { osVencida, horasRestantes } from './gestao/equipe'
import { nivelOperador, type Modulo } from './gestao/saude'
import { useGestao, type Efeito } from './gestao/store'
import type { OperacaoCompleta } from './gestao/useOperacao'
import { Icon } from './icons'
import { useMonitorStore } from './monitor'

/** Módulos de gestão no dock; cada um liga a camada correspondente no mapa. */
export const MODULOS: { id: Modulo; rotulo: string; icone: Parameters<typeof Icon>[0]['name']; camada: Camada | null }[] = [
  { id: 'financeiro', rotulo: 'Financeiro', icone: 'coin', camada: 'financeiro' },
  { id: 'atendimento', rotulo: 'Atendimento', icone: 'wrench', camada: 'atendimento' },
  { id: 'equipe', rotulo: 'Equipe', icone: 'people', camada: 'atendimento' },
  { id: 'estoque', rotulo: 'Estoque', icone: 'box', camada: null },
  { id: 'monitor', rotulo: 'Monitoramento', icone: 'pulse', camada: 'monitor' },
  { id: 'missoes', rotulo: 'Missões', icone: 'trophy', camada: null },
]
export const MODULO_LABEL = Object.fromEntries(MODULOS.map((m) => [m.id, m.rotulo])) as Record<Modulo, string>

/* ---------------- Número que conta ---------------- */

/** Anima o valor até o alvo (salta direto com movimento reduzido). */
export function useContagem(alvo: number, duracao = 700) {
  const reduced = useReducedMotion()
  const [valor, setValor] = useState(alvo)
  const atual = useRef(alvo)
  useEffect(() => {
    const de = atual.current
    if (reduced || de === alvo || typeof requestAnimationFrame === 'undefined') {
      atual.current = alvo
      setValor(alvo)
      return
    }
    const inicio = performance.now()
    let raf = 0
    const passo = (agora: number) => {
      const u = Math.min(1, (agora - inicio) / duracao)
      atual.current = de + (alvo - de) * (1 - Math.pow(1 - u, 3))
      setValor(atual.current)
      if (u < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [alvo, duracao, reduced])
  return valor
}

/* ---------------- Placar: saúde da operação ---------------- */

export function Placar({ op, abrir }: { op: OperacaoCompleta; abrir: () => void }) {
  const xp = useGestao((s) => s.xp)
  const { total } = op.saude
  const { atual, proximo, progresso } = op.nivel
  const mostrado = useContagem(total)
  const operador = nivelOperador(xp)
  const anterior = useRef(total)
  const [delta, setDelta] = useState<{ v: number; n: number } | null>(null)
  useEffect(() => {
    const d = total - anterior.current
    anterior.current = total
    if (!d) return
    setDelta((x) => ({ v: d, n: (x?.n ?? 0) + 1 }))
    const id = window.setTimeout(() => setDelta(null), 2200)
    return () => window.clearTimeout(id)
  }, [total])
  const r = 15,
    volta = 2 * Math.PI * r
  return (
    <button
      className={'pv-placar nivel-' + atual.ordem}
      onClick={abrir}
      title="Ver missões e saúde da operação"
      aria-label={`Saúde da operação: ${total} de 1.000, nível ${atual.nome}${proximo ? `, faltam ${proximo.min - total} para ${proximo.nome}` : ''}. Operador nível ${operador.nivel}, ${xp} XP. Abrir missões`}
    >
      <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
        <circle cx="20" cy="20" r={r} className="trilho" />
        <circle cx="20" cy="20" r={r} className="arco" strokeDasharray={`${volta * progresso} ${volta}`} transform="rotate(-90 20 20)" />
        <text x="20" y="24" textAnchor="middle">
          {atual.ordem}
        </text>
      </svg>
      <span className="pv-placar-txt" aria-hidden="true">
        <span>
          <strong>{Math.round(mostrado)}</strong>
          <em>{atual.nome}</em>
          {delta && (
            <b key={delta.n} className={delta.v < 0 ? 'neg' : undefined}>
              {delta.v > 0 ? '+' : ''}
              {delta.v}
            </b>
          )}
        </span>
        <small>
          Saúde da operação · Nv {operador.nivel} · {xp} XP
        </small>
        <i>
          <u style={{ width: pct(operador.progresso) }} />
        </i>
      </span>
    </button>
  )
}

/* ---------------- Dock de módulos ---------------- */

export function Dock({ op, modulo, camada, abrir, verRede }: { op: OperacaoCompleta; modulo: Modulo | null; camada: Camada; abrir: (m: Modulo) => void; verRede: () => void }) {
  const alarmes = useMonitorStore((s) => s.leitura.alarmes.filter((a) => a.severidade === 'critica' || a.severidade === 'alta').length)
  const selos: Partial<Record<Modulo, number>> = {
    financeiro: op.financeiro.contasVencidas,
    atendimento: op.ordens.filter((o) => o.status === 'aberta').length,
    estoque: op.estoque.filter((s) => s.critico).length,
    monitor: alarmes,
    missoes: op.missoes.filter((m) => !m.concluida).length,
  }
  return (
    <nav className="pv-dock" aria-label="Módulos de gestão">
      <button className={camada === 'rede' && !modulo ? 'ativo' : undefined} aria-pressed={camada === 'rede' && !modulo} onClick={verRede} title="Rede: clientes, pontos e incidentes">
        <Icon name="network" />
        <span>Rede</span>
        {op.incidentes.length > 0 && <b aria-label={`${op.incidentes.length} incidentes`}>{op.incidentes.length}</b>}
      </button>
      {MODULOS.map((m) => (
        <button key={m.id} className={modulo === m.id ? 'ativo' : undefined} aria-pressed={modulo === m.id} onClick={() => abrir(m.id)} title={m.rotulo}>
          <Icon name={m.icone} />
          <span>{m.rotulo}</span>
          {!!selos[m.id] && <b aria-label={`${selos[m.id]} pendências`}>{selos[m.id]}</b>}
        </button>
      ))}
    </nav>
  )
}

/* ---------------- Faixa de indicadores da camada ---------------- */

function Kpi({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: 'ok' | 'aviso' | 'ruim' }) {
  return (
    <div className={tom}>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  )
}
export function FaixaKpis({ op, camada }: { op: OperacaoCompleta; camada: Camada }) {
  const leitura = useMonitorStore((s) => s.leitura)
  const f = op.financeiro
  if (camada === 'rede') return null
  return (
    <dl className="pv-faixa" aria-label={`Indicadores: ${camada}`}>
      {camada === 'financeiro' && (
        <>
          <Kpi rotulo="Receita mensal" valor={reaisCurto(f.mrr)} />
          <Kpi rotulo="Recebido no mês" valor={`${reaisCurto(f.recebidoMes)} · ${pct(f.recebidoMes / f.mrr)}`} tom="ok" />
          <Kpi rotulo="Vencido" valor={`${reaisCurto(f.vencido)} · ${pct(f.inadimplencia, 1)}`} tom={f.inadimplencia > 0.08 ? 'ruim' : 'aviso'} />
          <Kpi rotulo="A pagar em 7 dias" valor={reaisCurto(f.aPagar7dias)} tom={f.contasVencidas ? 'ruim' : undefined} />
          <Kpi rotulo="Saldo em caixa" valor={reaisCurto(f.saldo)} />
        </>
      )}
      {camada === 'atendimento' && (
        <>
          <Kpi rotulo="Ordens abertas" valor={String(op.ordens.length)} />
          <Kpi rotulo="Sem técnico" valor={String(op.ordens.filter((o) => o.status === 'aberta').length)} tom={op.ordens.some((o) => o.status === 'aberta') ? 'aviso' : 'ok'} />
          <Kpi rotulo="Vencem em 4 h" valor={String(op.ordens.filter((o) => !osVencida(o) && horasRestantes(o) <= 4).length)} tom="aviso" />
          <Kpi rotulo="Prazo estourado" valor={String(op.ordens.filter(osVencida).length)} tom={op.ordens.some(osVencida) ? 'ruim' : 'ok'} />
        </>
      )}
      {camada === 'monitor' && (
        <>
          <Kpi rotulo="Saída para a internet" valor={`${(leitura.totalMbps / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} Gb/s`} />
          <Kpi rotulo="Uso do link" valor={pct(leitura.totalMbps / leitura.capacidadeTotalMbps)} tom={leitura.totalMbps / leitura.capacidadeTotalMbps > 0.85 ? 'ruim' : 'ok'} />
          <Kpi rotulo="Pontos com problema" valor={String(leitura.pontos.filter((p) => p.estado !== 'ok').length)} tom={leitura.pontos.some((p) => p.estado !== 'ok') ? 'ruim' : 'ok'} />
          <Kpi rotulo="Alarmes ativos" valor={String(leitura.alarmes.length)} tom={leitura.alarmes.length ? 'aviso' : 'ok'} />
        </>
      )}
    </dl>
  )
}

/* ---------------- Avisos (toasts) ---------------- */

const ICONE_EFEITO: Record<Efeito['tipo'], Parameters<typeof Icon>[0]['name']> = {
  recebimento: 'coin',
  pagamento: 'bill',
  os: 'check',
  despacho: 'truck',
  estoque: 'box',
  missao: 'trophy',
  conquista: 'trophy',
}
function Aviso({ e }: { e: Efeito }) {
  const dispensar = useGestao((s) => s.dispensarEfeito)
  useEffect(() => {
    const id = window.setTimeout(() => dispensar(e.id), e.tipo === 'missao' || e.tipo === 'conquista' ? 6000 : 4200)
    return () => window.clearTimeout(id)
  }, [e.id, e.tipo, dispensar])
  return (
    <li className={'pv-aviso ' + e.tipo}>
      <Icon name={ICONE_EFEITO[e.tipo]} />
      <span>{e.mensagem}</span>
      {e.xp > 0 && <b>+{e.xp} XP</b>}
      <button onClick={() => dispensar(e.id)} aria-label="Dispensar aviso">
        ×
      </button>
    </li>
  )
}
export function Avisos() {
  const efeitos = useGestao((s) => s.efeitos)
  return (
    <div className="pv-avisos" role="status" aria-live="polite" aria-label="Avisos da gestão">
      <ul>
        {efeitos.map((e) => (
          <Aviso key={e.id} e={e} />
        ))}
      </ul>
    </div>
  )
}

/* ---------------- Recompensas de missões e conquistas ---------------- */

/** Dá o XP de cada missão e conquista uma única vez, quando ela se completa. */
export function useRecompensas(op: OperacaoCompleta) {
  const premiar = useGestao((s) => s.premiar)
  const premiadas = useGestao((s) => s.premiadas)
  useEffect(() => {
    for (const m of op.missoes) if (m.concluida && !premiadas['missao:' + m.id]) premiar('missao:' + m.id, 'missao', m.xp, `Missão cumprida: ${m.titulo}`)
    // A conquista só vale depois de alguma ação: abrir a tela com o estoque em ordem não é mérito do turno.
    const agiu = Object.keys(premiadas).length > 0
    for (const c of op.conquistas) if (agiu && c.obtida && !premiadas['conquista:' + c.id]) premiar('conquista:' + c.id, 'conquista', 50, `Conquista: ${c.nome}`)
  }, [op.missoes, op.conquistas, premiadas, premiar])
}
