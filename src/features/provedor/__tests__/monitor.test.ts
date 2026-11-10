import { describe, expect, it } from 'vitest'
import { accessPoints, demoIncidents, regions } from '../data'
import { mapearAlertasGrafana, pontoDoAlerta, urlPainelGrafana } from '../monitor/grafana'
import { leituraSimulada } from '../monitor/simulada'
import { utilizacao } from '../monitor/tipos'
import { CHAVES_PADRAO, mapearZabbix, pontoDoHost } from '../monitor/zabbix'

describe('Fonte simulada', () => {
  it('mede todos os pontos dentro da capacidade e reflete as quedas', () => {
    const calma = leituraSimulada([], 1_794_000_000_000)
    expect(calma.pontos.map((p) => p.pontoId)).toEqual(accessPoints.map((p) => p.id))
    expect(calma.pontos.every((p) => p.trafegoMbps > 0 && utilizacao(p) < 1)).toBe(true)
    expect(calma.enlaces).toHaveLength(regions.length)
    expect(calma.alarmes.filter((a) => a.severidade === 'critica')).toHaveLength(0)
    expect(calma.totalMbps).toBeLessThan(calma.capacidadeTotalMbps)

    const comQueda = leituraSimulada(demoIncidents, 1_794_000_000_000)
    const torre = comQueda.pontos.find((p) => p.pontoId === 'ERB-17')!
    expect(torre.estado).toBe('degradado')
    expect(torre.perdaPct).toBeGreaterThan(5)
    expect(torre.trafegoMbps).toBeLessThan(calma.pontos.find((p) => p.pontoId === 'ERB-17')!.trafegoMbps)
    expect(comQueda.alarmes.some((a) => a.pontoId === 'ERB-17' && a.severidade === 'critica')).toBe(true)
  })
})

describe('Adaptador do Zabbix', () => {
  const hosts = [
    { hostid: '101', host: 'rb-centro-01', name: 'Roteador', tags: [{ tag: 'ponto', value: 'ERB-17' }] },
    { hostid: '102', host: 'POP-18 Central de fibra' },
    { hostid: '103', host: 'servidor-dns' },
  ]
  it('liga hosts aos pontos pela tag ou pelo nome', () => {
    expect(hosts.map(pontoDoHost)).toEqual(['ERB-17', 'POP-18', undefined])
  })
  it('converte itens e triggers para o contrato do mapa', () => {
    const leitura = mapearZabbix({
      hosts,
      items: [
        { hostid: '101', key_: CHAVES_PADRAO.disponivel, lastvalue: '1' },
        { hostid: '101', key_: CHAVES_PADRAO.trafegoBps, lastvalue: '184000000' },
        { hostid: '101', key_: CHAVES_PADRAO.latenciaSeg, lastvalue: '0.012' },
        { hostid: '101', key_: CHAVES_PADRAO.perdaPct, lastvalue: '7.5' },
        { hostid: '102', key_: CHAVES_PADRAO.disponivel, lastvalue: '0' },
        { hostid: '103', key_: CHAVES_PADRAO.trafegoBps, lastvalue: '999' },
      ],
      triggers: [{ triggerid: '9', description: 'Perda de pacotes alta', priority: '4', lastchange: '1794300000', hosts: [{ hostid: '101' }] }],
    })
    const torre = leitura.pontos.find((p) => p.pontoId === 'ERB-17')!
    expect(torre).toMatchObject({ estado: 'degradado', trafegoMbps: 184, perdaPct: 7.5 })
    expect(torre.latenciaMs).toBeCloseTo(12)
    expect(leitura.pontos.find((p) => p.pontoId === 'POP-18')).toMatchObject({ estado: 'fora', trafegoMbps: 0, clientesOnline: 0 })
    // Ponto sem host no Zabbix aparece como fora do ar, não como saudável.
    expect(leitura.pontos.find((p) => p.pontoId === 'ERB-01')?.estado).toBe('fora')
    expect(leitura.alarmes).toEqual([{ id: 'zbx-9', pontoId: 'ERB-17', severidade: 'alta', titulo: 'Perda de pacotes alta', desde: 1794300000000, fonte: 'Zabbix' }])
    expect(leitura.totalMbps).toBe(184)
  })
})

describe('Adaptador do Grafana', () => {
  it('alertas ativos viram alarmes ligados ao ponto', () => {
    const alarmes = mapearAlertasGrafana([
      { fingerprint: 'a1', labels: { alertname: 'OLT sem energia', severity: 'critical', ponto: 'POP-20' }, annotations: { summary: 'POP-20 na bateria' }, startsAt: '2026-11-10T12:00:00Z', status: { state: 'active' } },
      { labels: { alertname: 'CPU alta', instance: 'erb-19.rede:9100', severity: 'warning' }, startsAt: '2026-11-10T12:05:00Z' },
      { labels: { alertname: 'Silenciado', severity: 'info' }, startsAt: '2026-11-10T12:05:00Z', status: { state: 'suppressed' } },
    ])
    expect(alarmes).toHaveLength(2)
    expect(alarmes[0]).toMatchObject({ id: 'gf-a1', pontoId: 'POP-20', severidade: 'critica', titulo: 'POP-20 na bateria', fonte: 'Grafana' })
    expect(alarmes[1]).toMatchObject({ pontoId: 'ERB-19', severidade: 'aviso', titulo: 'CPU alta' })
    expect(pontoDoAlerta({ alertname: 'Genérico' })).toBeUndefined()
  })
  it('monta o endereço do painel do ponto', () => {
    const url = urlPainelGrafana({ url: 'https://grafana.exemplo.com.br/', painel: { uid: 'abc', slug: 'pontos', painelId: 4, variavel: 'ponto' } }, 'ERB-17')!
    expect(url.startsWith('https://grafana.exemplo.com.br/d-solo/abc/pontos?')).toBe(true)
    expect(new URL(url).searchParams.get('var-ponto')).toBe('ERB-17')
    expect(urlPainelGrafana({ url: 'https://g' }, 'ERB-17')).toBeNull()
  })
})
