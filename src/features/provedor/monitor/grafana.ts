import { accessPoints } from '../data'
import type { Alarme, Severidade } from './tipos'

/**
 * Integração com o Grafana: alertas ativos (Alertmanager do Grafana) viram
 * alarmes no mapa, e cada ponto pode abrir um painel do Grafana embutido.
 */
export interface GrafanaConfig {
  /** Endereço do Grafana (ou de um proxy do provedor que guarda o token). */
  url: string
  token?: string
  /** Painel por ponto: uid e slug do dashboard, id do painel e a variável que recebe o ponto. */
  painel?: { uid: string; slug: string; painelId: number; variavel: string }
}
export interface GrafanaAlerta {
  fingerprint?: string
  labels: Record<string, string>
  annotations?: Record<string, string>
  startsAt: string
  status?: { state?: string }
}

const SEVERIDADE: Record<string, Severidade> = { critical: 'critica', critica: 'critica', high: 'alta', error: 'alta', warning: 'aviso', aviso: 'aviso', info: 'info' }

/** Ponto do mapa de um alerta: rótulo `ponto`, ou `instance`/`host` contendo o id. */
export function pontoDoAlerta(labels: Record<string, string>): string | undefined {
  if (labels.ponto && accessPoints.some((p) => p.id === labels.ponto)) return labels.ponto
  const texto = [labels.instance, labels.host, labels.device, labels.alertname].filter(Boolean).join(' ').toUpperCase()
  return accessPoints.find((p) => texto.includes(p.id))?.id
}

export function mapearAlertasGrafana(alertas: GrafanaAlerta[]): Alarme[] {
  return alertas
    .filter((a) => (a.status?.state ?? 'active') === 'active')
    .map((a, k) => ({
      id: 'gf-' + (a.fingerprint ?? k),
      pontoId: pontoDoAlerta(a.labels),
      severidade: SEVERIDADE[(a.labels.severity ?? '').toLowerCase()] ?? 'aviso',
      titulo: a.annotations?.summary ?? a.annotations?.description ?? a.labels.alertname ?? 'Alerta',
      desde: Date.parse(a.startsAt),
      fonte: 'Grafana',
    }))
}

export async function alertasGrafana(config: GrafanaConfig): Promise<Alarme[]> {
  const resposta = await fetch(config.url.replace(/\/$/, '') + '/api/alertmanager/grafana/api/v2/alerts?active=true', {
    headers: config.token ? { Authorization: 'Bearer ' + config.token } : {},
  })
  if (!resposta.ok) throw new Error(`Grafana respondeu ${resposta.status}`)
  return mapearAlertasGrafana((await resposta.json()) as GrafanaAlerta[])
}

/** Endereço do painel do ponto para embutir num iframe (exige `allow_embedding` no Grafana). */
export function urlPainelGrafana(config: GrafanaConfig, pontoId: string, periodo = 'now-6h'): string | null {
  if (!config.painel) return null
  const { uid, slug, painelId, variavel } = config.painel
  const q = new URLSearchParams({ orgId: '1', panelId: String(painelId), from: periodo, to: 'now', theme: 'dark', ['var-' + variavel]: pontoId })
  return `${config.url.replace(/\/$/, '')}/d-solo/${uid}/${slug}?${q}`
}
