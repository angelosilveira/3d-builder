import { useEffect } from 'react'
import { create } from 'zustand'
import type { Incident } from '../data'
import { alertasGrafana, urlPainelGrafana, type GrafanaConfig } from './grafana'
import { fonteSimulada, leituraSimulada } from './simulada'
import type { FonteMonitoramento, Leitura } from './tipos'
import { CHAVES_PADRAO, fonteZabbix } from './zabbix'

/**
 * Escolha da fonte por variáveis de ambiente (arquivo .env do Vite):
 *
 *   VITE_MONITOR_FONTE=zabbix            simulada (padrão) | zabbix
 *   VITE_ZABBIX_URL=https://.../api_jsonrpc.php
 *   VITE_GRAFANA_URL=https://grafana.exemplo.com.br
 *   VITE_GRAFANA_PAINEL=uid/slug/painelId/variavel   painel aberto por ponto
 *
 * Tokens (VITE_ZABBIX_TOKEN, VITE_GRAFANA_TOKEN) ficam visíveis no navegador:
 * em produção, aponte as URLs para um proxy do provedor que injeta o token.
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

export const grafana: GrafanaConfig | null = env.VITE_GRAFANA_URL
  ? {
      url: env.VITE_GRAFANA_URL,
      token: env.VITE_GRAFANA_TOKEN,
      painel: (() => {
        const [uid, slug, painelId, variavel] = (env.VITE_GRAFANA_PAINEL ?? '').split('/')
        return uid && slug && painelId ? { uid, slug, painelId: Number(painelId), variavel: variavel || 'ponto' } : undefined
      })(),
    }
  : null
export const painelDoPonto = (pontoId: string) => (grafana ? urlPainelGrafana(grafana, pontoId) : null)

function criarFonte(incidentes: () => readonly Incident[]): FonteMonitoramento {
  const base =
    env.VITE_MONITOR_FONTE === 'zabbix' && env.VITE_ZABBIX_URL
      ? fonteZabbix({ url: env.VITE_ZABBIX_URL, token: env.VITE_ZABBIX_TOKEN, chaves: CHAVES_PADRAO })
      : fonteSimulada(incidentes)
  if (!grafana) return base
  // Com Grafana configurado, os alertas dele se somam aos da fonte principal.
  return {
    ...base,
    nome: base.nome + ' + Grafana',
    async ler() {
      const [leitura, extras] = await Promise.all([base.ler(), alertasGrafana(grafana).catch(() => [])])
      return { ...leitura, alarmes: [...leitura.alarmes, ...extras] }
    },
  }
}

const HISTORICO = 40
interface MonitorState {
  fonte: string
  simulada: boolean
  leitura: Leitura
  /** Últimas amostras de tráfego total (Mbps), para o gráfico. */
  historico: number[]
  erro: string | null
}
let incidentesAtuais: readonly Incident[] = []
const fonte = criarFonte(() => incidentesAtuais)

export const useMonitorStore = create<MonitorState>()(() => {
  const leitura = leituraSimulada([])
  return { fonte: fonte.nome, simulada: fonte.id === 'simulada', leitura, historico: [], erro: null }
})
/** Leitura mais recente, lida a cada quadro pelo mapa sem passar pelo React. */
export const leituraAtual = () => useMonitorStore.getState().leitura

async function coletar() {
  try {
    const leitura = await fonte.ler()
    useMonitorStore.setState((s) => ({ leitura, erro: null, historico: [...s.historico.slice(-(HISTORICO - 1)), leitura.totalMbps] }))
  } catch (e) {
    useMonitorStore.setState({ erro: e instanceof Error ? e.message : 'Falha ao consultar o monitoramento' })
  }
}

/** Mantém a coleta rodando enquanto a tela estiver aberta e visível. */
export function useMonitoramento(incidentes: readonly Incident[]) {
  incidentesAtuais = incidentes
  useEffect(() => {
    void coletar()
    const id = window.setInterval(() => {
      if (!document.hidden) void coletar()
    }, fonte.intervalo)
    return () => window.clearInterval(id)
  }, [])
  // Um incidente aberto ou encerrado aparece na hora na fonte simulada.
  useEffect(() => {
    if (fonte.id === 'simulada') void coletar()
  }, [incidentes])
}
