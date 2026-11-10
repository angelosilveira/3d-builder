import { accessPoints, clientById, clientsByPoint, regions, type Incident } from '../data'
import { groupOpenOutages } from '../outages'
import type { Alarme, FonteMonitoramento, Leitura, MedicaoPonto } from './tipos'

/** Capacidade do enlace de cada ponto e dos troncos que saem da sede. */
export const capacidadePonto = (tecnologia: 'radio' | 'fiber') => (tecnologia === 'radio' ? 300 : 1000)
export const CAPACIDADE_TRONCO = 1000
export const CAPACIDADE_TOTAL = 2000

const onda = (t: number, periodo: number, fase: number) => Math.sin((t / periodo) * Math.PI * 2 + fase)

/**
 * Leitura simulada: o tráfego de cada ponto oscila em torno do consumo típico
 * dos seus clientes, e os incidentes abertos aparecem como degradação (perda,
 * latência, clientes offline). Serve para desenvolver o mapa sem um Zabbix.
 */
export function leituraSimulada(incidentes: readonly Incident[], agora = Date.now()): Leitura {
  const t = agora / 1000
  const falhas = new Set(groupOpenOutages(incidentes).map((g) => g.pointId))
  const afetados = new Map<string, number>()
  for (const i of incidentes) {
    const p = clientById.get(i.clientId)?.pointId
    if (p) afetados.set(p, (afetados.get(p) ?? 0) + (i.kind === 'offline' ? 1 : 0.4))
  }
  const alarmes: Alarme[] = []
  const pontos: MedicaoPonto[] = accessPoints.map((p, k) => {
    const clientes = clientsByPoint.get(p.id)!.length
    const capacidade = capacidadePonto(p.technology)
    const falha = falhas.has(p.id)
    const queda = afetados.get(p.id) ?? 0
    // Consumo médio por cliente no horário comercial, com variação lenta e ruído.
    const porCliente = (p.technology === 'radio' ? 1.7 : 4.2) * (1 + 0.16 * onda(t, 47, k) + 0.07 * onda(t, 9, k * 2.3))
    const online = Math.max(0, clientes - Math.round(queda) - (falha ? Math.round(clientes * 0.12) : 0))
    const trafego = Math.min(capacidade * 0.98, online * porCliente * (falha ? 0.55 : 1))
    const uso = trafego / capacidade
    const estado = falha ? 'degradado' : uso > 0.92 ? 'degradado' : 'ok'
    if (falha) alarmes.push({ id: 'sim-falha-' + p.id, pontoId: p.id, severidade: 'critica', titulo: `${p.id}: perda de pacotes e clientes sem conexão`, desde: agora - 52 * 60000, fonte: 'Simulação' })
    else if (uso > 0.85) alarmes.push({ id: 'sim-uso-' + p.id, pontoId: p.id, severidade: 'aviso', titulo: `${p.id}: enlace acima de 85% de uso`, desde: agora - 18 * 60000, fonte: 'Simulação' })
    return {
      pontoId: p.id,
      estado,
      trafegoMbps: trafego,
      capacidadeMbps: capacidade,
      latenciaMs: (p.technology === 'radio' ? 9 : 3) + (falha ? 38 + 14 * onda(t, 5, k) : 1.4 * (1 + onda(t, 7, k))) + uso * 6,
      perdaPct: falha ? 6 + 3 * (1 + onda(t, 4, k)) : Math.max(0, 0.15 * onda(t, 13, k)),
      clientesOnline: online,
      temperaturaC: 38 + (k % 5) * 2 + 2 * onda(t, 61, k),
      sinalDbm: p.technology === 'fiber' ? -19 - (k % 4) - 0.4 * onda(t, 23, k) : undefined,
    }
  })
  const porRegiao = new Map<string, number>()
  accessPoints.forEach((p, k) => porRegiao.set(p.regionId, (porRegiao.get(p.regionId) ?? 0) + pontos[k].trafegoMbps))
  const total = pontos.reduce((s, m) => s + m.trafegoMbps, 0)
  return {
    em: agora,
    pontos,
    enlaces: regions.map((r) => ({ regiaoId: r.id, trafegoMbps: porRegiao.get(r.id) ?? 0, capacidadeMbps: CAPACIDADE_TRONCO })),
    alarmes,
    // Parte do tráfego é atendida por cache local; a saída para a internet é menor que a soma.
    totalMbps: total * 0.2,
    capacidadeTotalMbps: CAPACIDADE_TOTAL,
  }
}

export function fonteSimulada(incidentes: () => readonly Incident[]): FonteMonitoramento {
  return { id: 'simulada', nome: 'Simulação', intervalo: 2000, ler: async () => leituraSimulada(incidentes()) }
}
