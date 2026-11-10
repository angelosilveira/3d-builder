import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '../../shared/hooks/useReducedMotion'
import { CAMADA_LABEL, type Camada } from './camadas'
import { criarCidade, type Alvo, type Cidade, type CoresCasa } from './cidade3d/cena'
import type { Horario } from './cidade3d/city-kit.js'
import { areas, cidade as planta, obras3d, pontoNaRota, pontos, rotaViatura, ruas, sede, vagaViatura } from './cidade3d/planta'
import { cityStreets, districts } from './city'
import { accessPoints, clientById, clientsByPoint, headquarters, islands, pointById, statusText } from './data'
import { horasRestantes, iniciais, osVencida, tecnicos, tempoViagem, TIPO_OS_LABEL, type OrdemServico } from './gestao/equipe'
import { financeiroPorArea, situacaoFinanceira, SITUACAO_LABEL } from './gestao/financeiro'
import { useGestao, type Efeito } from './gestao/store'
import { Icon } from './icons'
import { useMonitorStore } from './monitor'
import { utilizacao } from './monitor/tipos'
import type { MapaProps } from './NetworkMap'
import { obraPorId, obras, progressoGeral, STATUS_OBRA_LABEL, statusObra } from './obras'

/**
 * Mapa do provedor como cidade 3D (WebGL). Recebe as mesmas propriedades do
 * mapa plano: a página não sabe qual dos dois está na tela.
 */

interface Ancora {
  el: HTMLElement
  p: [number, number, number]
  /** Faixa de distância da câmera em que o rótulo aparece. */
  min: number
  max: number
  ultimo?: string
}
const COR_TELHADO = { atrasado: '#f2b23e', bloqueado: '#e5484d' }
const corUso = (u: number) => (u > 0.85 ? '#ff7978' : u > 0.65 ? '#ffc665' : '#66e8bc')
const LETRA_OS: Record<OrdemServico['tipo'], string> = { instalacao: 'I', reparo: 'R', upgrade: 'T', mudanca: 'M', retirada: 'X' }
const LEGENDA: Record<Camada, [string, string][]> = {
  rede: [
    ['online', 'Operacional'],
    ['unstable', 'Instável'],
    ['offline', 'Sem conexão'],
  ],
  financeiro: [
    ['online', 'Recebido no mês'],
    ['neutro', 'A receber'],
    ['unstable', 'Telhado âmbar: em atraso'],
    ['offline', 'Telhado vermelho: bloqueado'],
  ],
  atendimento: [
    ['azul', 'Ordem no prazo'],
    ['unstable', 'Vence em até 4 h'],
    ['offline', 'Prazo estourado'],
  ],
  monitor: [
    ['online', 'Uso até 65%'],
    ['unstable', '65% a 85%'],
    ['offline', 'Acima de 85% ou falha'],
  ],
}
const HORARIOS: [Horario, string][] = [
  ['dia', 'Dia'],
  ['entardecer', 'Entardecer'],
  ['noite', 'Noite'],
]

interface Flutuante {
  id: number
  x: number
  y: number
  texto: string
  tipo: Efeito['tipo']
  /** Deslocamento (px) até a sede, para as moedas. */
  dx: number
  dy: number
}

export default function Cidade3D({
  trocarMapa,
  aoFalhar,
  camada,
  obra,
  dataObras,
  selectObra,
  activeGroup,
  area,
  selectArea,
  groups,
  investigate,
  island,
  site,
  client,
  incidents,
  selectIsland,
  selectSite,
  selectClient,
}: MapaProps & { aoFalhar: () => void }) {
  const reduced = useReducedMotion()
  const host = useRef<HTMLDivElement>(null)
  const cena = useRef<Cidade | null>(null)
  const ancoras = useRef(new Map<string, Ancora>())
  const dica = useRef<HTMLDivElement>(null)
  const [pronta, setPronta] = useState(false)
  const [horario, setHorario] = useState<Horario>('dia')
  const [perto, setPerto] = useState(false)
  const [flutuantes, setFlutuantes] = useState<Flutuante[]>([])
  const leitura = useMonitorStore((s) => s.leitura)
  // Callbacks mais recentes, para os ouvintes criados uma única vez.
  const acoes = useRef({ selectClient, selectSite, selectObra, selectIsland, incidents, camada })
  acoes.current = { selectClient, selectSite, selectObra, selectIsland, incidents, camada }

  /* ---------- Montagem da cena ---------- */
  useEffect(() => {
    const el = host.current
    if (!el) return
    let c: Cidade
    try {
      c = criarCidade(el)
    } catch {
      aoFalhar()
      return
    }
    cena.current = c
    c.aoEscolher((alvo) => {
      const a = acoes.current
      if (!alvo) return
      if (alvo.tipo === 'cliente') a.selectClient(clientById.get(alvo.id)!)
      else if (alvo.tipo === 'ponto') a.selectSite(pointById.get(alvo.id)!)
      else if (alvo.tipo === 'obra') a.selectObra(obraPorId.get(alvo.id)!)
      else a.selectIsland(headquarters)
    })
    let ultimo: Alvo = null
    const mover = (e: PointerEvent) => {
      const tip = dica.current
      if (!tip || tip.hidden) return
      const b = el.getBoundingClientRect()
      tip.style.left = Math.max(5, Math.min(b.width - tip.offsetWidth - 5, e.clientX - b.left + 14)) + 'px'
      tip.style.top = Math.max(5, e.clientY - b.top - 34) + 'px'
    }
    el.addEventListener('pointermove', mover)
    c.aoPassar((alvo) => {
      const tip = dica.current
      if (!tip) return
      if (JSON.stringify(alvo) === JSON.stringify(ultimo)) return
      ultimo = alvo
      tip.hidden = !alvo
      if (!alvo) return
      const a = acoes.current
      if (alvo.tipo === 'cliente') {
        const cli = clientById.get(alvo.id)!
        const fin = a.camada.camada === 'financeiro' ? SITUACAO_LABEL[situacaoFinanceira(cli.id, a.camada.pagas)] : statusText[a.incidents.get(cli.id)?.kind ?? 'online']
        tip.textContent = cli.name + ' · ' + fin
      } else if (alvo.tipo === 'ponto') tip.textContent = pointById.get(alvo.id)!.name + ' · ' + alvo.id
      else if (alvo.tipo === 'obra') tip.textContent = obraPorId.get(alvo.id)!.nome
      else tip.textContent = 'Sede da AtlasFibra'
    })
    // Rótulos HTML acompanham a câmera; some o que estiver longe demais ou fora da tela.
    let pertoAgora = false
    const parar = c.stage.onTick(() => {
      const dist = c.distancia()
      for (const a of ancoras.current.values()) {
        const s = c.projetar(...a.p)
        const visivel = s.visivel && dist >= a.min && dist < a.max
        const chave = visivel ? `${s.x.toFixed(1)}|${s.y.toFixed(1)}` : 'x'
        if (chave === a.ultimo) continue
        a.ultimo = chave
        a.el.hidden = !visivel
        if (visivel) {
          a.el.style.left = s.x + 'px'
          a.el.style.top = s.y + 'px'
        }
      }
      const agora = dist < 520
      if (agora !== pertoAgora) setPerto((pertoAgora = agora))
    })
    setPronta(true)
    return () => {
      parar()
      el.removeEventListener('pointermove', mover)
      cena.current = null
      setPronta(false)
      c.dispose()
    }
  }, [aoFalhar])

  const fixar =
    (id: string, p: [number, number, number], min = 0, max = Infinity) =>
    (el: HTMLElement | null) => {
      if (el) ancoras.current.set(id, { el, p, min, max })
      else ancoras.current.delete(id)
    }

  /* ---------- Câmera e destaque seguem a seleção ---------- */
  useEffect(() => {
    const c = cena.current
    if (!c || !pronta) return
    if (client) {
      const p = c.posicaoDaCasa(client.id)!
      c.voarPara(p.x, p.z, 95)
      const kind = incidents.get(client.id)?.kind
      c.destacar({ x: p.x, z: p.z, raio: 8, cor: kind === 'offline' ? '#ff7978' : kind === 'unstable' ? '#ffc665' : '#8de9d5' })
    } else if (obra) {
      const p = obras3d[obra.id]
      const meio = p.ate ? [(p.x + p.ate[0]) / 2, (p.z + p.ate[1]) / 2] : [p.x, p.z]
      c.voarPara(meio[0], meio[1], p.ate ? 420 : 190)
      c.destacar(p.ate ? null : { x: p.x, z: p.z, raio: 22 })
    } else if (site) {
      const p = pontos.get(site.id)!
      c.voarPara(p.x, p.z, site.technology === 'radio' ? 330 : 230)
      c.destacar({ x: p.x, z: p.z, raio: 12, cobertura: site.technology === 'radio' })
    } else {
      c.destacar(null)
      if (area) {
        const a = area.kind === 'street' ? ruas.get(area.id)! : areas.get(area.id)!
        c.voarPara(a.x, a.z, area.kind === 'street' ? 260 : 560)
      } else if (island === headquarters) c.voarPara(0, 0, c.distGeral * 0.52)
      else if (island) {
        const a = areas.get(island.id)!
        c.voarPara(a.x, a.z, 620)
      } else c.visaoGeral()
    }
  }, [pronta, client, site, obra, area, island, incidents])

  /* ---------- Casas: cor por camada e foco ---------- */
  const membros = useMemo(() => (activeGroup ? new Set(activeGroup.reports.map((r) => r.clientId)) : null), [activeGroup])
  useEffect(() => {
    const c = cena.current
    if (!c || !pronta) return
    const financeiro = camada.camada === 'financeiro'
    if (!financeiro && !area && !membros) {
      // Só os clientes com incidente ganham telhado colorido na camada de rede.
      c.pintarCasas(incidents.size ? (id) => (incidents.has(id) ? { telhado: incidents.get(id)!.kind === 'offline' ? '#e5484d' : '#f2b23e' } : null) : null)
      return
    }
    c.pintarCasas((id): CoresCasa | null => {
      const cli = clientById.get(id)!
      const fora = (area && (cli.districtId !== area.districtId || (area.kind === 'street' && cli.streetId !== area.id))) || (membros && !membros.has(id))
      const s = financeiro ? situacaoFinanceira(id, camada.pagas) : null
      const telhado = s === 'atrasado' || s === 'bloqueado' ? COR_TELHADO[s] : !financeiro && incidents.has(id) ? '#e5484d' : null
      return fora || telhado ? { apagada: !!fora, telhado } : null
    })
  }, [pronta, camada, area, membros, incidents])

  /* ---------- Obras na data da linha do tempo ---------- */
  useEffect(() => {
    if (pronta) cena.current?.montarObras(dataObras)
  }, [pronta, dataObras])

  /* ---------- Colunas (financeiro / monitoramento) e pulsos ---------- */
  const finArea = useMemo(() => (camada.camada === 'financeiro' ? financeiroPorArea(camada.pagas) : null), [camada])
  useEffect(() => {
    const c = cena.current
    if (!c || !pronta) return
    if (finArea) {
      c.definirColunas(
        [...finArea.values()].map((a) => {
          const pos = areas.get(a.id)!
          const recebido = a.recebido / a.faturado,
            vencido = Math.min(1 - recebido, a.vencido / a.faturado)
          return {
            x: pos.x,
            z: pos.z,
            lado: 16,
            partes: [
              { fracao: recebido, cor: '#3fbf95' },
              { fracao: 1 - recebido - vencido, cor: '#6d8ea8', opacidade: 0.5 },
              { fracao: vencido, cor: '#e06b66' },
            ],
          }
        }),
      )
    } else if (camada.camada === 'monitor') {
      c.definirColunas(
        leitura.pontos.map((m) => {
          const pos = pontos.get(m.pontoId)!
          const u = m.estado === 'fora' ? 0 : utilizacao(m)
          return {
            x: pos.x + 14,
            z: pos.z + 6,
            lado: 5,
            altura: 46,
            partes: [
              { fracao: Math.max(0.03, u), cor: m.estado === 'ok' ? corUso(u) : '#ff7978' },
              { fracao: 1 - Math.max(0.03, u), cor: '#5b7286', opacidade: 0.3 },
            ],
          }
        }),
      )
    } else c.definirColunas([])
    // Pulsos de luz na fibra: no monitoramento, cor e velocidade seguem o uso de cada tronco.
    if (camada.camada === 'monitor') {
      const porRegiao: Record<string, { cor: string; velocidade: number }> = {}
      for (const e of leitura.enlaces) porRegiao[e.regiaoId] = { cor: corUso(utilizacao(e)), velocidade: 18 + utilizacao(e) * 46 }
      const uSede = leitura.capacidadeTotalMbps ? leitura.totalMbps / leitura.capacidadeTotalMbps : 0
      porRegiao[headquarters.id] = { cor: corUso(uSede), velocidade: 18 + uSede * 46 }
      c.pulsos(porRegiao)
    } else c.pulsos({})
  }, [pronta, camada.camada, finArea, leitura])

  /* ---------- Viaturas (camada de atendimento) ---------- */
  useEffect(() => {
    const c = cena.current
    if (!c || !pronta) return
    const visivel = camada.camada === 'atendimento'
    const posicionar = () => {
      tecnicos.forEach((t, k) => {
        const os = camada.ordens.find((o) => o.tecnicoId === t.id && (o.status === 'a_caminho' || o.status === 'em_atendimento'))
        const vaga = vagaViatura(k)
        if (!os) return c.moverViatura(k, vaga.x, vaga.z, Math.PI / 2, visivel && t.presenca === 'trabalhando')
        const cli = clientById.get(os.clientId)!
        const u = os.status === 'em_atendimento' ? 1 : Math.max(0, Math.min(1, (Date.now() - (os.despachadaEm ?? Date.now())) / tempoViagem(cli)))
        const p = pontoNaRota(rotaViatura(k, cli.id), u)
        c.moverViatura(k, p.x, p.z, p.ang, visivel)
        // A etiqueta do técnico acompanha a viatura.
        const tag = ancoras.current.get('vtr:' + t.id)
        if (tag) tag.p = [p.x, 7, p.z]
      })
    }
    posicionar()
    if (!visivel) return
    return c.stage.onTick(posicionar)
  }, [pronta, camada])

  useEffect(() => {
    if (pronta) cena.current?.horario(horario)
  }, [pronta, horario])

  /* ---------- Recompensas: "+XP", valores e moedas saindo da casa ---------- */
  useEffect(
    () =>
      useGestao.subscribe((s, prev) => {
        const c = cena.current
        if (!c) return
        const vistos = new Set(prev.efeitos.map((e) => e.id))
        const novos: Flutuante[] = []
        for (const e of s.efeitos) {
          if (vistos.has(e.id)) continue
          const casa = e.clientId ? c.posicaoDaCasa(e.clientId) : undefined
          const origem = c.projetar(casa?.x ?? sede.x, casa ? 9 : 34, casa?.z ?? sede.z)
          const destino = c.projetar(sede.x, 30, sede.z)
          if (!origem.visivel) continue
          const texto = e.tipo === 'recebimento' ? '+' + ((e.valor ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : e.xp ? `+${e.xp} XP` : '✓'
          novos.push({ id: e.id, x: origem.x, y: origem.y, texto, tipo: e.tipo, dx: destino.x - origem.x, dy: destino.y - origem.y })
        }
        if (!novos.length) return
        setFlutuantes((l) => [...l, ...novos])
        window.setTimeout(() => setFlutuantes((l) => l.filter((f) => !novos.includes(f))), 2400)
      }),
    [],
  )

  /* ---------- Controles ---------- */
  const zoom = (fator: number) => {
    const c = cena.current
    if (!c) return
    const alvo = c.stage.controls.target
    c.voarPara(alvo.x, alvo.z, Math.max(45, Math.min(c.distGeral * 1.4, c.distancia() * fator)), 0.5)
  }
  const girar = () => {
    const c = cena.current
    if (!c) return
    const { camera, controls } = c.stage
    const de = camera.position.clone().sub(controls.target)
    const raio = Math.hypot(de.x, de.z),
      a0 = Math.atan2(de.x, de.z)
    c.stage.tween(reduced ? 0 : 0.8, (k) => {
      const a = a0 + (Math.PI / 4) * k
      camera.position.set(controls.target.x + Math.sin(a) * raio, camera.position.y, controls.target.z + Math.cos(a) * raio)
    })
  }

  const cam = camada.camada
  const selecionado = client ? cena.current?.posicaoDaCasa(client.id) : undefined
  return (
    <section className="pv-map pv-map-3d" aria-label="Cidade 3D da rede">
      <div className="pv-viewport" ref={host}>
        <div ref={dica} hidden className="pv-cursor-hint" aria-hidden="true" />
        {pronta && (
          <>
            {islands.map((it) => {
              const a = it === headquarters ? { x: 0, z: planta.depth / 2 + 30 } : { x: areas.get(it.id)!.x, z: areas.get(it.id)!.z + areas.get(it.id)!.d / 2 + 14 }
              return (
                <button key={it.id} hidden ref={fixar(it.id, [a.x, 0, a.z], 900)} className={'pv-island-label' + (it === headquarters ? ' pv-hq' : '')} onClick={() => selectIsland(it)}>
                  {it === headquarters ? <Icon name="tower" /> : <i style={{ background: it.color }} />}
                  <span className="pv-place-name">
                    <small>{it === headquarters ? 'Sede urbana' : 'Zona rural'}</small>
                    {it.name}
                  </span>
                  {it !== headquarters && (
                    <span aria-hidden="true" className="pv-coverage">
                      {accessPoints.filter((p) => p.regionId === it.id).reduce((s, p) => s + clientsByPoint.get(p.id)!.length, 0)}
                    </span>
                  )}
                </button>
              )
            })}
            {!client &&
              !site &&
              !area &&
              cam !== 'financeiro' &&
              districts.map((d) => {
                const a = areas.get(d.id)!
                return (
                  <button key={d.id} hidden ref={fixar(d.id, [a.x, 26, a.z], 420, 2300)} className="pv-geo-label" onClick={() => selectArea(d)}>
                    {d.name}
                  </button>
                )
              })}
            {area &&
              !site &&
              !client &&
              cityStreets
                .filter((st) => st.districtId === area.districtId && (area.kind === 'district' || area.id === st.id))
                .map((st, i) => {
                  const r = ruas.get(st.id)!
                  return (
                    <button hidden key={st.id} ref={fixar(st.id, [r.x + (area.kind === 'street' ? 0 : i % 2 ? 52 : -52), 12, r.z])} className="pv-geo-label street" onClick={() => selectArea(st)}>
                      {st.name}
                    </button>
                  )
                })}
            {cam !== 'financeiro' &&
              !client &&
              !area &&
              !site &&
              groups
                .filter((g, i) => groups.findIndex((x) => x.pointId === g.pointId) === i)
                .map((g) => {
                  const p = pontos.get(g.pointId)!
                  return (
                    <button hidden key={g.id} ref={fixar(g.id, [p.x, 62, p.z])} className="pv-outage-pin" onClick={() => investigate(g)} aria-label={'Investigar possível falha em ' + g.pointId}>
                      <Icon name="alert" />
                      {g.reports.length} quedas
                    </button>
                  )
                })}
            {accessPoints.map((p) => {
              const pos = pontos.get(p.id)!
              const escolhido = p.id === site?.id && !client
              return (
                <button
                  hidden
                  key={p.id}
                  ref={fixar(p.id, [pos.x, p.technology === 'radio' ? (p.regionId === headquarters.id ? 48 : 40) : 8, pos.z], 0, escolhido ? Infinity : 1250)}
                  onClick={() => selectSite(p)}
                  className={'pv-site-pin ' + p.technology}
                  aria-pressed={escolhido}
                  title={p.name + ' · ' + p.id}
                  aria-label={p.name + ' · ' + p.id}
                >
                  <Icon name={p.technology === 'radio' ? 'tower' : 'network'} />
                  {p.id}
                </button>
              )
            })}
            {obras.map((o) => {
              const p = obras3d[o.id]
              const st = statusObra(o)
              const valor = Math.round(progressoGeral(o, dataObras) * 100)
              const escolhida = obra?.id === o.id
              if (!escolhida && (cam !== 'rede' || client || site || area)) return null
              const x = p.ate ? (p.x + p.ate[0]) / 2 : p.x,
                z = p.ate ? (p.z + p.ate[1]) / 2 : p.z
              return (
                <button
                  hidden
                  key={o.id}
                  ref={fixar('obra:' + o.id, [x, o.tipo === 'predio' ? 46 : o.tipo === 'torre' ? 44 : 16, z], 0, escolhida ? Infinity : 2600)}
                  className={'pv-obra-pin ' + st}
                  aria-pressed={escolhida}
                  onClick={() => selectObra(o)}
                  title={o.nome}
                  aria-label={`Obra ${o.nome}: ${valor}% ${dataObras ? 'previsto na data' : 'executado'}, ${STATUS_OBRA_LABEL[st]}`}
                >
                  <Icon name="obra" />
                  <span>{o.id}</span>
                  <b>{valor}%</b>
                </button>
              )
            })}
            {client && selecionado && (
              <button ref={fixar('sel:' + client.id, [selecionado.x, 13, selecionado.z])} className="pv-selected-home" onClick={() => selectClient(client)}>
                {client.name}
              </button>
            )}
            {/* Incidentes viram pino só na camada de rede (o resto do tempo, o telhado já avisa). */}
            {cam === 'rede' &&
              !client &&
              [...incidents.values()].map((inc) => {
                const p = cena.current?.posicaoDaCasa(inc.clientId)
                const cli = clientById.get(inc.clientId)
                if (!p || !cli) return null
                return (
                  <button hidden key={'inc:' + inc.clientId} ref={fixar('inc:' + inc.clientId, [p.x, 11, p.z], 0, 1500)} className={'pv-alerta-pin ' + inc.kind} onClick={() => selectClient(cli)} aria-label={`${cli.name}: ${statusText[inc.kind]}`}>
                    <i />
                  </button>
                )
              })}
            {cam === 'financeiro' &&
              finArea &&
              [...finArea.values()].map((a) => {
                const pos = areas.get(a.id)!
                return (
                  <span hidden key={'fin:' + a.id} ref={fixar('fin:' + a.id, [pos.x, 82, pos.z])} className="pv-tag fin">
                    <strong>{Math.round((a.recebido / a.faturado) * 100)}% recebido</strong>
                    <small>
                      {pos.nome}
                      {a.vencido > 0 && ` · ${(a.vencido / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} vencido`}
                    </small>
                  </span>
                )
              })}
            {cam === 'monitor' &&
              leitura.pontos.map((m) => {
                const pos = pontos.get(m.pontoId)!
                const u = utilizacao(m)
                const alerta = m.estado !== 'ok'
                return (
                  <span hidden key={'mon:' + m.pontoId} ref={fixar('mon:' + m.pontoId, [pos.x + 14, 54, pos.z + 6], 0, alerta ? Infinity : 1300)} className={'pv-tag mon' + (alerta ? ' alerta' : '')} style={{ color: alerta ? '#ff9d97' : corUso(u) }}>
                    <strong>{m.estado === 'fora' ? 'FORA DO AR' : `${Math.round(m.trafegoMbps)} Mb/s`}</strong>
                    <small>
                      {m.pontoId} · {Math.round(u * 100)}% · {Math.round(m.latenciaMs)} ms
                    </small>
                  </span>
                )
              })}
            {cam === 'monitor' && (
              <span hidden ref={fixar('mon:sede', [sede.x, 44, sede.z])} className="pv-tag mon sede">
                <strong>Internet {(leitura.totalMbps / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} Gb/s</strong>
                <small>{Math.round((leitura.totalMbps / leitura.capacidadeTotalMbps) * 100)}% do link</small>
              </span>
            )}
            {cam === 'atendimento' &&
              camada.ordens.map((os) => {
                const p = cena.current?.posicaoDaCasa(os.clientId)
                const cli = clientById.get(os.clientId)!
                if (!p) return null
                const urg = osVencida(os) ? 'offline' : horasRestantes(os) <= 4 ? 'unstable' : 'azul'
                return (
                  <button
                    hidden
                    key={'os:' + os.id}
                    ref={fixar('os:' + os.id, [p.x, 14, p.z])}
                    className={`pv-os-pin ${urg}${os.status === 'aberta' ? ' sem-tecnico' : ''}`}
                    onClick={() => selectClient(cli)}
                    aria-label={`${os.id}, ${TIPO_OS_LABEL[os.tipo]} para ${cli.name}${os.status === 'aberta' ? ', sem técnico' : ''}`}
                    title={`${os.id} · ${TIPO_OS_LABEL[os.tipo]}`}
                  >
                    {LETRA_OS[os.tipo]}
                  </button>
                )
              })}
            {cam === 'atendimento' &&
              tecnicos.map((t, k) => {
                const os = camada.ordens.find((o) => o.tecnicoId === t.id && (o.status === 'a_caminho' || o.status === 'em_atendimento'))
                if (!os) return null
                const p = pontoNaRota(rotaViatura(k, os.clientId), os.status === 'em_atendimento' ? 1 : 0)
                return (
                  <span hidden key={'vtr:' + t.id + os.status} ref={fixar('vtr:' + t.id, [p.x, 7, p.z])} className={'pv-tag vtr ' + os.status}>
                    <strong>
                      <Icon name="truck" /> {iniciais(t.nome)}
                    </strong>
                    <small>{os.status === 'em_atendimento' ? 'em atendimento' : 'a caminho'}</small>
                  </span>
                )
              })}
            <div className="pv-flutuantes" aria-hidden="true">
              {flutuantes.map((f) => (
                <span key={f.id} className={'pv-flutuante ' + f.tipo} style={{ left: f.x, top: f.y, ['--dx' as string]: f.dx + 'px', ['--dy' as string]: f.dy + 'px' }}>
                  <b>{f.texto}</b>
                  {(f.tipo === 'recebimento' || f.tipo === 'pagamento') && [0, 1, 2, 3, 4].map((n) => <i key={n} style={{ animationDelay: n * 90 + 'ms' }} />)}
                  {(f.tipo === 'os' || f.tipo === 'missao' || f.tipo === 'conquista') && [...Array(14).keys()].map((n) => <u key={n} style={{ ['--a' as string]: n * 26 + 'deg', ['--c' as string]: ['#79e3bd', '#ffd45e', '#7cc4f2', '#ff918a'][n % 4] }} />)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="pv-map-bottom">
        <div className="pv-legend">
          {LEGENDA[cam].map(([classe, texto]) => (
            <span key={texto}>
              <i className={classe} />
              {texto}
            </span>
          ))}
        </div>
        <span className="pv-map-tip">
          {CAMADA_LABEL[cam]} · {perto ? 'clique numa casa para abrir o cliente' : 'arraste para mover · botão direito gira · roda aproxima'}
        </span>
        <div className="pv-map-controls">
          <div className="pv-horario" role="group" aria-label="Horário da cidade">
            {HORARIOS.map(([h, rotulo]) => (
              <button key={h} aria-pressed={horario === h} onClick={() => setHorario(h)}>
                {rotulo}
              </button>
            ))}
          </div>
          <button onClick={() => zoom(1.5)} title="Afastar" aria-label="Afastar">
            <Icon name="minus" />
          </button>
          <button onClick={() => zoom(1 / 1.5)} title="Aproximar" aria-label="Aproximar">
            <Icon name="plus" />
          </button>
          <button onClick={girar} title="Girar a cidade" aria-label="Girar a cidade">
            <Icon name="rotate" />
          </button>
          <button onClick={() => selectIsland(null)} title="Visão geral" aria-label="Visão geral do mapa">
            <Icon name="focus" />
          </button>
          {trocarMapa && (
            <button onClick={trocarMapa} title="Mapa plano (mais leve)" aria-label="Trocar para o mapa plano">
              <Icon name="map" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
