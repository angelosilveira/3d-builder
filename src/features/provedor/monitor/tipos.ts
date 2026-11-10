/**
 * Contrato de monitoramento do mapa. Qualquer fonte (simulação, Zabbix,
 * Grafana ou outra) entrega uma `Leitura` neste formato; o mapa e os painéis
 * não sabem de onde os números vieram.
 */
export type EstadoPonto = 'ok' | 'degradado' | 'fora'
export const ESTADO_PONTO_LABEL: Record<EstadoPonto, string> = { ok: 'Operacional', degradado: 'Degradado', fora: 'Fora do ar' }

export interface MedicaoPonto {
  /** Id do ponto de acesso no mapa (ERB-17, POP-18…). */
  pontoId: string
  estado: EstadoPonto
  /** Tráfego de descida no enlace do ponto. */
  trafegoMbps: number
  capacidadeMbps: number
  latenciaMs: number
  perdaPct: number
  clientesOnline: number
  temperaturaC?: number
  /** Potência óptica recebida (pontos de fibra). */
  sinalDbm?: number
}
export interface MedicaoEnlace {
  /** Região atendida pelo enlace que sai da sede. */
  regiaoId: string
  trafegoMbps: number
  capacidadeMbps: number
}
export type Severidade = 'info' | 'aviso' | 'alta' | 'critica'
export interface Alarme {
  id: string
  pontoId?: string
  severidade: Severidade
  titulo: string
  /** Início do alarme (ms desde 1970). */
  desde: number
  fonte: string
}
export interface Leitura {
  /** Momento da coleta (ms desde 1970). */
  em: number
  pontos: MedicaoPonto[]
  enlaces: MedicaoEnlace[]
  alarmes: Alarme[]
  /** Tráfego total na saída para a internet. */
  totalMbps: number
  capacidadeTotalMbps: number
}
export interface FonteMonitoramento {
  id: 'simulada' | 'zabbix' | 'grafana'
  nome: string
  /** Intervalo sugerido entre coletas (ms). */
  intervalo: number
  ler: () => Promise<Leitura>
}
export const utilizacao = (m: { trafegoMbps: number; capacidadeMbps: number }) => (m.capacidadeMbps ? m.trafegoMbps / m.capacidadeMbps : 0)
