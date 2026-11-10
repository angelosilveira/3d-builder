import { accessPoints, clientsByPoint, regions } from '../data'
import { CAPACIDADE_TOTAL, CAPACIDADE_TRONCO, capacidadePonto } from './simulada'
import type { Alarme, FonteMonitoramento, Leitura, MedicaoPonto, Severidade } from './tipos'

/**
 * Adaptador do Zabbix (API JSON-RPC, 6.4 ou mais novo).
 *
 * Como cada host é ligado a um ponto do mapa:
 *   1. pela tag `ponto` do host (ex.: ponto = ERB-17), ou
 *   2. pelo nome do host contendo o id do ponto (ex.: "ERB-17 Torre da Cidade").
 *
 * As chaves dos itens variam de um ambiente para outro; ajuste `chaves`.
 */
export interface ZabbixConfig {
  /** URL do api_jsonrpc.php — de preferência um proxy do próprio provedor, que guarda o token. */
  url: string
  /** Token de API. Evite no navegador: fica visível para quem abrir o site. */
  token?: string
  chaves: {
    disponivel: string
    trafegoBps: string
    latenciaSeg: string
    perdaPct: string
    temperaturaC: string
    sinalDbm: string
    clientesOnline: string
  }
}
export const CHAVES_PADRAO: ZabbixConfig['chaves'] = {
  disponivel: 'icmpping',
  trafegoBps: 'net.if.in[uplink]',
  latenciaSeg: 'icmppingsec',
  perdaPct: 'icmppingloss',
  temperaturaC: 'sensor.temp.value',
  sinalDbm: 'optical.rx.power',
  clientesOnline: 'clients.online',
}

export interface ZabbixHost {
  hostid: string
  host: string
  name?: string
  tags?: { tag: string; value: string }[]
}
export interface ZabbixItem {
  hostid: string
  key_: string
  lastvalue: string
}
export interface ZabbixTrigger {
  triggerid: string
  description: string
  /** 0 não classificada … 5 desastre. */
  priority: string
  /** Segundos desde 1970. */
  lastchange: string
  hosts?: { hostid: string }[]
}

const SEVERIDADE: Severidade[] = ['info', 'info', 'aviso', 'aviso', 'alta', 'critica']

/** Ponto do mapa correspondente a um host do Zabbix (ou undefined se não houver). */
export function pontoDoHost(host: ZabbixHost): string | undefined {
  const tag = host.tags?.find((t) => t.tag.toLowerCase() === 'ponto')?.value
  if (tag && accessPoints.some((p) => p.id === tag)) return tag
  const texto = (host.host + ' ' + (host.name ?? '')).toUpperCase()
  return accessPoints.find((p) => texto.includes(p.id))?.id
}

/** Converte a resposta do Zabbix para o contrato do mapa. Função pura: testável com payloads gravados. */
export function mapearZabbix(dados: { hosts: ZabbixHost[]; items: ZabbixItem[]; triggers: ZabbixTrigger[] }, chaves = CHAVES_PADRAO, agora = Date.now()): Leitura {
  const pontoPorHost = new Map<string, string>()
  for (const h of dados.hosts) {
    const p = pontoDoHost(h)
    if (p) pontoPorHost.set(h.hostid, p)
  }
  const valores = new Map<string, Map<string, number>>()
  for (const it of dados.items) {
    const ponto = pontoPorHost.get(it.hostid)
    const v = Number(it.lastvalue)
    if (!ponto || !Number.isFinite(v)) continue
    if (!valores.has(ponto)) valores.set(ponto, new Map())
    valores.get(ponto)!.set(it.key_, v)
  }
  const alarmes: Alarme[] = dados.triggers.map((t) => ({
    id: 'zbx-' + t.triggerid,
    pontoId: t.hosts?.map((h) => pontoPorHost.get(h.hostid)).find(Boolean),
    severidade: SEVERIDADE[Number(t.priority)] ?? 'info',
    titulo: t.description,
    desde: Number(t.lastchange) * 1000,
    fonte: 'Zabbix',
  }))
  const grave = new Set(alarmes.filter((a) => a.severidade === 'alta' || a.severidade === 'critica').map((a) => a.pontoId))
  const pontos: MedicaoPonto[] = accessPoints.map((p) => {
    const v = valores.get(p.id)
    const capacidade = capacidadePonto(p.technology)
    const clientes = clientsByPoint.get(p.id)!.length
    // Sem host ou sem resposta ao ping: o ponto é tratado como fora do ar.
    const vivo = v?.get(chaves.disponivel)
    const fora = !v || vivo === 0
    return {
      pontoId: p.id,
      estado: fora ? 'fora' : grave.has(p.id) ? 'degradado' : 'ok',
      trafegoMbps: fora ? 0 : (v.get(chaves.trafegoBps) ?? 0) / 1e6,
      capacidadeMbps: capacidade,
      latenciaMs: (v?.get(chaves.latenciaSeg) ?? 0) * 1000,
      perdaPct: v?.get(chaves.perdaPct) ?? (fora ? 100 : 0),
      clientesOnline: fora ? 0 : (v.get(chaves.clientesOnline) ?? clientes),
      temperaturaC: v?.get(chaves.temperaturaC),
      sinalDbm: v?.get(chaves.sinalDbm),
    }
  })
  const porRegiao = new Map<string, number>()
  accessPoints.forEach((p, k) => porRegiao.set(p.regionId, (porRegiao.get(p.regionId) ?? 0) + pontos[k].trafegoMbps))
  return {
    em: agora,
    pontos,
    enlaces: regions.map((r) => ({ regiaoId: r.id, trafegoMbps: porRegiao.get(r.id) ?? 0, capacidadeMbps: CAPACIDADE_TRONCO })),
    alarmes,
    totalMbps: pontos.reduce((s, m) => s + m.trafegoMbps, 0),
    capacidadeTotalMbps: CAPACIDADE_TOTAL,
  }
}

async function chamar<T>(config: ZabbixConfig, method: string, params: unknown): Promise<T> {
  const resposta = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json-rpc', ...(config.token ? { Authorization: 'Bearer ' + config.token } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  })
  if (!resposta.ok) throw new Error(`Zabbix respondeu ${resposta.status}`)
  const corpo = (await resposta.json()) as { result?: T; error?: { data?: string; message?: string } }
  if (corpo.error || corpo.result === undefined) throw new Error('Zabbix: ' + (corpo.error?.data ?? corpo.error?.message ?? 'resposta sem resultado'))
  return corpo.result
}

export function fonteZabbix(config: ZabbixConfig): FonteMonitoramento {
  return {
    id: 'zabbix',
    nome: 'Zabbix',
    intervalo: 30000,
    async ler() {
      const hosts = await chamar<ZabbixHost[]>(config, 'host.get', { output: ['hostid', 'host', 'name'], selectTags: ['tag', 'value'], monitored_hosts: true })
      const ids = hosts.filter(pontoDoHost).map((h) => h.hostid)
      const [items, triggers] = await Promise.all([
        chamar<ZabbixItem[]>(config, 'item.get', { output: ['hostid', 'key_', 'lastvalue'], hostids: ids, filter: { key_: Object.values(config.chaves) } }),
        chamar<ZabbixTrigger[]>(config, 'trigger.get', {
          output: ['triggerid', 'description', 'priority', 'lastchange'],
          hostids: ids,
          selectHosts: ['hostid'],
          only_true: true,
          monitored: true,
          skipDependent: true,
          expandDescription: true,
        }),
      ])
      return mapearZabbix({ hosts, items, triggers }, config.chaves)
    },
  }
}
