import { districts } from './city'
import { accessPoints, clientById, clients, headquarters, pointById, regions, type Client } from './data'
import { tecnicos, tempoViagem, iniciais, osVencida, horasRestantes, type OrdemServico } from './gestao/equipe'
import { financeiroPorArea, situacaoFinanceira, type Pagas } from './gestao/financeiro'
import type { Efeito } from './gestao/store'
import { box, connectionPoint, ground, markerHeight, paintFaces, pointTop, type Face, type Pixel, type Point, type Projection } from './landscape'
import { leituraAtual } from './monitor'
import { utilizacao } from './monitor/tipos'

/**
 * Camadas de gestão sobre o mapa. Cada camada responde a uma pergunta:
 *   financeiro   quem está devendo e quanto cada bairro já pagou no mês?
 *   atendimento  onde estão as ordens de serviço e os técnicos?
 *   monitor      quanto tráfego passa em cada enlace e que ponto está mal?
 * A parte parada vai no canvas base; o que se move, no canvas de efeitos.
 */
export type Camada = 'rede' | 'financeiro' | 'atendimento' | 'monitor'
export const CAMADA_LABEL: Record<Camada, string> = { rede: 'Rede', financeiro: 'Financeiro', atendimento: 'Atendimento', monitor: 'Monitoramento' }
export interface DadosCamada {
  camada: Camada
  pagas: Pagas
  ordens: readonly OrdemServico[]
}

const COR = { ok: '#66e8bc', aviso: '#ffc665', ruim: '#ff7978', ouro: '#ffd45e', tinta: '#0d1621', texto: '#edf2f2', azul: '#7cc4f2' }
const visivel = (cam: Projection, [x, y]: Pixel, folga = 40) => x > -folga && y > -folga && x < cam.width + folga && y < cam.height + folga
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const suave = (t: number) => t * t * (3 - 2 * t)

function etiqueta(ctx: CanvasRenderingContext2D, x: number, y: number, texto: string, fundo: string, cor = COR.texto, borda?: string) {
  ctx.font = '600 10px ui-monospace, monospace'
  const w = ctx.measureText(texto).width + 10
  ctx.fillStyle = fundo
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - 8, w, 16, 4)
  ctx.fill()
  if (borda) {
    ctx.strokeStyle = borda
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.fillStyle = cor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(texto, x, y + 0.5)
}

/** Coluna 3D empilhada (de baixo para cima) em um ponto do mapa. */
function coluna(ctx: CanvasRenderingContext2D, cam: Projection, x: number, z: number, lado: number, partes: { altura: number; cores: string[] }[], alpha = 0.92) {
  ctx.globalAlpha = alpha
  let y = ground + 0.02
  for (const p of partes) {
    if (p.altura <= 0.001) continue
    const faces: Face[] = []
    box(faces, x, y, z, lado, p.altura, lado, p.cores)
    paintFaces(ctx, faces, cam)
    y += p.altura
  }
  ctx.globalAlpha = 1
  return y
}
const tons = (a: string, b: string, c: string) => [a, a, b, b, c]

/* ---------------- Camada estática ---------------- */

export function pintarCamada(ctx: CanvasRenderingContext2D, cam: Projection, d: DadosCamada) {
  if (d.camada !== 'financeiro') return
  // Casas com fatura em atraso (âmbar) ou contrato bloqueado (vermelho).
  for (const c of clients) {
    const s = situacaoFinanceira(c.id, d.pagas)
    if (s !== 'atrasado' && s !== 'bloqueado') continue
    const p = cam.project(c.x, ground + 0.62, c.z)
    if (!visivel(cam, p, 6)) continue
    const r = Math.max(2.2, Math.min(5, cam.scale * 0.11))
    ctx.beginPath()
    ctx.moveTo(p[0], p[1] - r)
    ctx.lineTo(p[0] + r, p[1])
    ctx.lineTo(p[0], p[1] + r)
    ctx.lineTo(p[0] - r, p[1])
    ctx.closePath()
    ctx.fillStyle = s === 'bloqueado' ? COR.ruim : COR.aviso
    ctx.fill()
    ctx.strokeStyle = COR.tinta
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  // Uma coluna por bairro/região: recebido no mês, a receber e vencido.
  const areas = financeiroPorArea(d.pagas)
  const centros: { id: string; nome: string; x: number; z: number }[] = [
    ...districts.map((b) => ({ id: b.id, nome: b.name, x: b.x, z: b.z })),
    ...regions.map((r) => ({ id: r.id, nome: r.name, x: r.x, z: r.z })),
  ]
  const ordem = centros.sort((a, b) => cam.depth(a.x, a.z) - cam.depth(b.x, b.z))
  for (const c of ordem) {
    const a = areas.get(c.id)
    if (!a || !visivel(cam, cam.project(c.x, ground, c.z), 80)) continue
    const H = 5.2
    const recebido = a.recebido / a.faturado
    const vencido = Math.min(1 - recebido, a.vencido / a.faturado)
    const topo = coluna(ctx, cam, c.x, c.z, 1.25, [
      { altura: H * recebido, cores: tons('#2f9b78', '#3fbf95', '#7ff0cb') },
      { altura: H * (1 - recebido - vencido), cores: tons('#3b566b', '#4b6a82', '#6d8ea8') },
      { altura: H * vencido, cores: tons('#c4504d', '#e06b66', '#ff9d97') },
    ])
    const [x, y] = cam.project(c.x, topo + 0.35, c.z)
    etiqueta(ctx, x, y - 9, `${Math.round(recebido * 100)}% recebido`, '#10242cee', COR.ok, '#2f6f62')
    if (a.vencido > 0) etiqueta(ctx, x, y + 9, `${(a.vencido / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} vencido`, '#3a1f22ee', '#ffb3ad')
  }
}

/* ---------------- Viaturas e ordens ---------------- */

/** Vaga de cada viatura no pátio da sede. */
export const vaga = (k: number): [number, number] => [3.4 + k * 1.05, 2.35]

/** Posição da viatura no trajeto (u de 0 a 1) da base até o cliente. Na zona rural segue o enlace. */
export function rotaViatura(k: number, cliente: Client, u: number): Point {
  const [vx, vz] = vaga(k)
  if (cliente.regionId === headquarters.id) return [lerp(vx, cliente.x, suave(u)), ground, lerp(vz, cliente.z, suave(u))]
  const ilha = regions.find((r) => r.id === cliente.regionId)!
  if (u < 0.12) return [lerp(vx, 0, u / 0.12), ground, lerp(vz, 0, u / 0.12)]
  if (u < 0.75) return connectionPoint(ilha, 0.04 + ((u - 0.12) / 0.63) * 0.96)
  const t = suave((u - 0.75) / 0.25)
  return [lerp(ilha.x, cliente.x, t), ground, lerp(ilha.z, cliente.z, t)]
}

export interface Viatura {
  tecnicoId: string
  sigla: string
  pos: Point
  estado: 'base' | 'a_caminho' | 'em_atendimento' | 'ausente'
  os?: OrdemServico
}
export function viaturas(ordens: readonly OrdemServico[], agoraMs: number): Viatura[] {
  return tecnicos.map((t, k) => {
    const os = ordens.find((o) => o.tecnicoId === t.id && (o.status === 'a_caminho' || o.status === 'em_atendimento'))
    const [vx, vz] = vaga(k)
    const base: Viatura = { tecnicoId: t.id, sigla: iniciais(t.nome), pos: [vx, ground, vz], estado: t.presenca === 'trabalhando' ? 'base' : 'ausente' }
    if (!os) return base
    const cliente = clientById.get(os.clientId)!
    if (os.status === 'em_atendimento') return { ...base, os, estado: 'em_atendimento', pos: [cliente.x + 0.55, ground, cliente.z + 0.1] }
    const u = Math.max(0, Math.min(1, (agoraMs - (os.despachadaEm ?? agoraMs)) / tempoViagem(cliente)))
    return { ...base, os, estado: 'a_caminho', pos: rotaViatura(k, cliente, u) }
  })
}

function desenharViatura(ctx: CanvasRenderingContext2D, cam: Projection, v: Viatura, agora: number, still: boolean) {
  const [x, y, z] = v.pos
  const pe = cam.project(x, y, z)
  if (!visivel(cam, pe)) return
  const faces: Face[] = []
  const apagada = v.estado === 'ausente'
  const lataria = apagada ? tons('#6f7f89', '#84949e', '#a4b2ba') : tons('#c9d6da', '#e6eff0', '#ffffff')
  box(faces, x, y + 0.07, z, 0.86, 0.3, 0.42, lataria)
  box(faces, x, y + 0.17, z + 0.215, 0.86, 0.07, 0.012, apagada ? ['#5e6b73'] : ['#2fb894'])
  box(faces, x + 0.27, y + 0.37, z, 0.3, 0.2, 0.38, tons('#28505e', '#3d7384', '#69a7b5'))
  for (const dx of [-0.26, 0.26]) box(faces, x + dx, y, z + 0.215, 0.17, 0.14, 0.03, ['#1f2d31'])
  paintFaces(ctx, faces, cam)
  const [tx, ty] = cam.project(x, y + 0.95, z)
  if (v.estado === 'em_atendimento' && !still) {
    const fase = (agora % 1400) / 1400
    ctx.strokeStyle = `rgba(121,227,189,${0.8 * (1 - fase)})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(pe[0], pe[1], 6 + fase * 12, (6 + fase * 12) * 0.5, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (cam.scale > 13 || v.estado !== 'base')
    etiqueta(ctx, tx, ty, v.sigla, apagada ? '#27343ddd' : v.estado === 'base' ? '#1b3a3bee' : '#1f5f52ee', apagada ? '#93a4b0' : COR.texto, v.estado === 'a_caminho' ? COR.ok : undefined)
}

const LETRA: Record<OrdemServico['tipo'], string> = { instalacao: 'I', reparo: 'R', upgrade: 'T', mudanca: 'M', retirada: 'X' }
function corOS(os: OrdemServico) {
  return osVencida(os) ? COR.ruim : horasRestantes(os) <= 4 ? COR.aviso : COR.azul
}
const posOS = (cam: Projection, os: OrdemServico): Pixel => {
  const c = clientById.get(os.clientId)!
  return cam.project(c.x, markerHeight + 0.75, c.z)
}

function desenharOrdens(ctx: CanvasRenderingContext2D, cam: Projection, ordens: readonly OrdemServico[], agora: number, still: boolean) {
  for (const os of ordens) {
    const [x, y] = posOS(cam, os)
    if (!visivel(cam, [x, y])) continue
    const cor = corOS(os)
    const c = clientById.get(os.clientId)!
    const [bx, by] = cam.project(c.x, ground + 0.3, c.z)
    ctx.strokeStyle = cor
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(x, y + 8)
    ctx.lineTo(bx, by)
    ctx.stroke()
    // Sem técnico: anel tracejado pulsando para chamar atenção.
    if (os.status === 'aberta') {
      const fase = still ? 0.4 : (agora % 1600) / 1600
      ctx.setLineDash([3, 3])
      ctx.globalAlpha = 1 - fase * 0.8
      ctx.beginPath()
      ctx.arc(x, y, 10 + fase * 7, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }
    ctx.beginPath()
    ctx.arc(x, y, 8.5, 0, Math.PI * 2)
    ctx.fillStyle = os.status === 'aberta' ? '#14212c' : cor
    ctx.fill()
    ctx.lineWidth = 1.8
    ctx.stroke()
    ctx.fillStyle = os.status === 'aberta' ? cor : COR.tinta
    ctx.font = '700 10px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(LETRA[os.tipo], x, y + 0.5)
  }
}

/** Ordem de serviço sob o cursor (camada de atendimento). */
export function pickCamada(cam: Projection, x: number, y: number, d: DadosCamada): OrdemServico | undefined {
  if (d.camada !== 'atendimento') return undefined
  return d.ordens.find((os) => {
    const [px, py] = posOS(cam, os)
    return Math.hypot(x - px, y - py) < 11
  })
}

/* ---------------- Monitoramento ---------------- */

const corUso = (u: number) => (u > 0.85 ? COR.ruim : u > 0.65 ? COR.aviso : COR.ok)

function desenharMonitor(ctx: CanvasRenderingContext2D, cam: Projection, agora: number, still: boolean) {
  const leitura = leituraAtual()
  const t = still ? 0 : agora / 1000
  // Troncos da sede até cada região: espessura e pacotes proporcionais ao uso.
  for (const [k, e] of leitura.enlaces.entries()) {
    const ilha = regions.find((r) => r.id === e.regiaoId)
    if (!ilha) continue
    const u = utilizacao(e)
    const cor = corUso(u)
    ctx.beginPath()
    for (let i = 0; i <= 32; i++) {
      const [x, y] = cam.project(...connectionPoint(ilha, i / 32))
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.strokeStyle = cor
    ctx.globalAlpha = 0.28
    ctx.lineWidth = 3 + u * 7
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.lineWidth = 1.4
    ctx.stroke()
    const n = 3 + Math.round(u * 9)
    ctx.fillStyle = '#eafff7'
    for (let i = 0; i < n; i++) {
      const [x, y] = cam.project(...connectionPoint(ilha, (t * (0.1 + u * 0.16) + i / n + k * 0.13) % 1))
      ctx.beginPath()
      ctx.arc(x, y, 2.3, 0, Math.PI * 2)
      ctx.fill()
    }
    const [mx, my] = cam.project(...connectionPoint(ilha, 0.5))
    etiqueta(ctx, mx, my - 12, `${Math.round(e.trafegoMbps)} Mb/s · ${Math.round(u * 100)}%`, '#10242cee', cor, cor)
  }
  // Cada ponto: enlace com pacotes e uma coluna de uso ao lado.
  const porDepth = [...leitura.pontos].sort((a, b) => {
    const pa = pointById.get(a.pontoId)!,
      pb = pointById.get(b.pontoId)!
    return cam.depth(pa.x, pa.z) - cam.depth(pb.x, pb.z)
  })
  for (const m of porDepth) {
    const p = pointById.get(m.pontoId)!
    const ilha = p.regionId === headquarters.id ? headquarters : regions.find((r) => r.id === p.regionId)!
    const pe = cam.project(p.x, ground, p.z)
    if (!visivel(cam, pe, 120)) continue
    const u = utilizacao(m)
    const cor = m.estado === 'ok' ? corUso(u) : COR.ruim
    if (m.estado !== 'fora') {
      const k = accessPoints.indexOf(p)
      ctx.fillStyle = cor
      for (let i = 0; i < 2 + Math.round(u * 3); i++) {
        const f = (t * (0.22 + u * 0.3) + i / 4 + k * 0.17) % 1
        const [x, y] = cam.project(lerp(ilha.x, p.x, f), 0.93, lerp(ilha.z, p.z, f))
        ctx.beginPath()
        ctx.arc(x, y, 1.9, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const cx = p.x + 0.62,
      cz = p.z + 0.5
    const cores = m.estado === 'ok' ? (u > 0.85 ? tons('#c4504d', '#e06b66', '#ff9d97') : u > 0.65 ? tons('#b98a35', '#e0ad4e', '#ffd88a') : tons('#2f9b78', '#3fbf95', '#7ff0cb')) : tons('#c4504d', '#e06b66', '#ff9d97')
    const topo = coluna(ctx, cam, cx, cz, 0.3, [
      { altura: 0.25 + u * 3, cores },
      { altura: (1 - u) * 3, cores: tons('#2a3d4b55', '#35495955', '#4a627555') },
    ])
    if (m.estado !== 'ok') {
      const fase = still ? 0.3 : (agora % 1200) / 1200
      ctx.strokeStyle = COR.ruim
      ctx.globalAlpha = 1 - fase
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(pe[0], pe[1], 8 + fase * 22, (8 + fase * 22) * 0.5, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    if (cam.scale > 15 || m.estado !== 'ok') {
      const [x, y] = cam.project(cx, topo + 0.3, cz)
      etiqueta(ctx, x, y, m.estado === 'fora' ? 'FORA' : `${Math.round(m.trafegoMbps)} Mb/s`, '#10242cee', cor, m.estado === 'ok' ? undefined : COR.ruim)
    }
  }
  // Núcleo da sede: saída para a internet.
  const [sx, sy] = cam.project(0, pointTop(accessPoints[0]) + 2.6, 0)
  const total = utilizacao({ trafegoMbps: leitura.totalMbps, capacidadeMbps: leitura.capacidadeTotalMbps })
  etiqueta(ctx, sx, sy, `Internet ${(leitura.totalMbps / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} Gb/s · ${Math.round(total * 100)}%`, '#10242cf2', corUso(total), corUso(total))
}

/* ---------------- Efeitos de recompensa ---------------- */

interface Animacao {
  tipo: 'moedas_entram' | 'moedas_saem' | 'confete' | 'texto' | 'onda' | 'caixas'
  x: number
  z: number
  inicio: number
  duracao: number
  texto?: string
  cor?: string
  n?: number
}
const animacoes: Animacao[] = []
const SEDE: [number, number] = [0.4, -3.2]

/** Transforma uma recompensa da store em animação no mapa. */
export function dispararEfeito(e: Efeito, agora = performance.now()) {
  const c = e.clientId ? clientById.get(e.clientId) : undefined
  const [x, z] = c ? [c.x, c.z] : SEDE
  const xp = e.xp ? `+${e.xp} XP` : undefined
  const add = (a: Omit<Animacao, 'inicio' | 'x' | 'z'> & { x?: number; z?: number; atraso?: number }) => animacoes.push({ x, z, ...a, inicio: agora + (a.atraso ?? 0) })
  if (e.tipo === 'recebimento') {
    add({ tipo: 'moedas_entram', duracao: 1500, n: 7 })
    add({ tipo: 'onda', duracao: 900, cor: COR.ok })
    add({ tipo: 'texto', duracao: 1900, texto: '+' + ((e.valor ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), cor: COR.ouro })
  } else if (e.tipo === 'pagamento') {
    add({ tipo: 'moedas_saem', duracao: 1500, n: 9 })
    add({ tipo: 'texto', duracao: 1900, texto: '−' + ((e.valor ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }), cor: '#ffb3ad' })
  } else if (e.tipo === 'os') {
    add({ tipo: 'confete', duracao: 1600, n: 46 })
    add({ tipo: 'onda', duracao: 1000, cor: COR.ok })
  } else if (e.tipo === 'despacho') {
    add({ tipo: 'onda', duracao: 900, cor: COR.azul })
  } else if (e.tipo === 'estoque') {
    add({ tipo: 'caixas', duracao: 1500, n: 5 })
  } else {
    add({ tipo: 'confete', duracao: 2200, n: 90 })
    add({ tipo: 'onda', duracao: 1400, cor: COR.ouro })
    add({ tipo: 'onda', duracao: 1400, cor: COR.ouro, atraso: 350 })
  }
  if (xp) add({ tipo: 'texto', duracao: 2000, texto: xp, cor: '#b8f5df', atraso: e.tipo === 'recebimento' || e.tipo === 'pagamento' ? 500 : 0 })
}
export const haEfeitos = () => animacoes.length > 0

function moeda(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number) {
  ctx.fillStyle = '#b8862b'
  ctx.beginPath()
  ctx.ellipse(x, y + 1, Math.max(0.6, r * Math.abs(Math.cos(giro))), r, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = COR.ouro
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(0.6, r * Math.abs(Math.cos(giro))), r, 0, 0, Math.PI * 2)
  ctx.fill()
}
const CONFETE = ['#79e3bd', '#ffd45e', '#7cc4f2', '#ff918a', '#ffffff']

function desenharEfeitos(ctx: CanvasRenderingContext2D, cam: Projection, agora: number) {
  for (let i = animacoes.length - 1; i >= 0; i--) if (agora > animacoes[i].inicio + animacoes[i].duracao) animacoes.splice(i, 1)
  for (const [k, a] of animacoes.entries()) {
    const u = (agora - a.inicio) / a.duracao
    if (u < 0) continue
    if (a.tipo === 'onda') {
      const [x, y] = cam.project(a.x, ground + 0.05, a.z)
      const r = cam.scale * (0.4 + u * 2.6)
      ctx.strokeStyle = a.cor!
      ctx.globalAlpha = 1 - u
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    } else if (a.tipo === 'texto') {
      const [x, y] = cam.project(a.x, ground + 1.4, a.z)
      const sobe = 34 * (1 - Math.pow(1 - u, 2)) + (k % 3) * 16
      ctx.globalAlpha = u < 0.75 ? 1 : (1 - u) / 0.25
      ctx.font = '700 14px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 3
      ctx.strokeStyle = COR.tinta
      ctx.strokeText(a.texto!, x, y - sobe)
      ctx.fillStyle = a.cor!
      ctx.fillText(a.texto!, x, y - sobe)
      ctx.globalAlpha = 1
    } else if (a.tipo === 'moedas_entram' || a.tipo === 'moedas_saem') {
      for (let n = 0; n < a.n!; n++) {
        const t = u * 1.5 - (n / a.n!) * 0.5
        if (t <= 0 || t >= 1) continue
        const entra = a.tipo === 'moedas_entram'
        const [fx, fz] = entra ? [a.x, a.z] : SEDE
        const ang = n * 2.4
        // Recebimento: da casa até a sede. Pagamento: da sede para fora do mapa.
        const [tx, tz] = entra ? SEDE : [SEDE[0] + Math.cos(ang) * 9, SEDE[1] + Math.sin(ang) * 6]
        const alto = Math.sin(t * Math.PI) * (entra ? 4.5 : 3) + (entra ? 0 : t * 7)
        const [x, y] = cam.project(lerp(fx, tx, suave(t)), ground + 0.8 + alto, lerp(fz, tz, suave(t)))
        ctx.globalAlpha = entra ? 1 : 1 - t * t
        moeda(ctx, x, y, Math.max(2.4, Math.min(6, cam.scale * 0.16)), t * 12 + n)
        ctx.globalAlpha = 1
      }
    } else if (a.tipo === 'caixas') {
      for (let n = 0; n < a.n!; n++) {
        const t = u * 1.4 - (n / a.n!) * 0.4
        if (t <= 0 || t >= 1) continue
        const queda = 1 - Math.pow(1 - t, 2)
        const faces: Face[] = []
        box(faces, a.x + (n - 2) * 0.55, ground + (1 - queda) * 6, a.z + 3.6 + (n % 2) * 0.5, 0.42, 0.34, 0.42, tons('#a77b4f', '#c39463', '#e0b98a'))
        ctx.globalAlpha = Math.min(1, t * 4)
        paintFaces(ctx, faces, cam)
        ctx.globalAlpha = 1
      }
    } else {
      for (let n = 0; n < a.n!; n++) {
        const ang = n * 2.399,
          forca = 1.2 + ((n * 37) % 10) / 6
        const px = a.x + Math.cos(ang) * forca * u * 1.6,
          pz = a.z + Math.sin(ang) * forca * u * 1.2
        const py = ground + 0.6 + forca * 3.2 * u - 6.5 * u * u
        if (py < ground) continue
        const [x, y] = cam.project(px, py, pz)
        ctx.fillStyle = CONFETE[n % CONFETE.length]
        ctx.globalAlpha = u < 0.7 ? 1 : (1 - u) / 0.3
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(u * 9 + n)
        ctx.fillRect(-2.2, -1.2, 4.4, 2.4)
        ctx.restore()
        ctx.globalAlpha = 1
      }
    }
  }
}

/* ---------------- Camada animada ---------------- */

/** Clientes que pagaram a fatura do mês: origem das moedas que entram na sede. */
let pagantes: Client[] | null = null

export function animarCamada(ctx: CanvasRenderingContext2D, cam: Projection, agora: number, still: boolean, d: DadosCamada) {
  if (d.camada === 'financeiro' && !still) {
    pagantes ??= clients.filter((c) => !c.invoices.some((f) => f.due.startsWith('2026-11')))
    // Recebimentos do dia: uma moeda sai de uma casa a cada ~0,7 s e voa até a sede.
    const passo = 700,
      voo = 2600
    for (let j = 0; j < 4; j++) {
      const n = Math.floor(agora / passo) - j
      const t = (agora - n * passo) / voo
      if (t <= 0 || t >= 1) continue
      const c = pagantes[(n * 7919) % pagantes.length]
      const [x, y] = cam.project(lerp(c.x, SEDE[0], suave(t)), ground + 0.6 + Math.sin(t * Math.PI) * 5, lerp(c.z, SEDE[1], suave(t)))
      ctx.globalAlpha = Math.min(1, t * 6, (1 - t) * 6)
      moeda(ctx, x, y, Math.max(2, Math.min(5, cam.scale * 0.14)), t * 14)
      ctx.globalAlpha = 1
    }
  }
  if (d.camada === 'atendimento') {
    const frota = viaturas(d.ordens, Date.now())
    // Rota tracejada de quem está a caminho.
    for (const [k, v] of frota.entries()) {
      if (v.estado !== 'a_caminho' || !v.os) continue
      const cliente = clientById.get(v.os.clientId)!
      ctx.beginPath()
      for (let i = 0; i <= 24; i++) {
        const [x, y] = cam.project(...rotaViatura(k, cliente, i / 24))
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
      ctx.setLineDash([5, 5])
      ctx.lineDashOffset = still ? 0 : -(agora / 60) % 10
      ctx.strokeStyle = 'rgba(121,227,189,.75)'
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.setLineDash([])
    }
    desenharOrdens(ctx, cam, d.ordens, agora, still)
    for (const v of [...frota].sort((a, b) => cam.depth(a.pos[0], a.pos[2]) - cam.depth(b.pos[0], b.pos[2]))) desenharViatura(ctx, cam, v, agora, still)
  }
  if (d.camada === 'monitor') desenharMonitor(ctx, cam, agora, still)
  if (!still) desenharEfeitos(ctx, cam, agora)
}
