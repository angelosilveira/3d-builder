# Monitoramento: como ligar o Zabbix e o Grafana

O mapa lê tudo de um contrato só (`tipos.ts`): por ponto de acesso, o estado, o tráfego,
a latência e a perda; por tronco, o tráfego; e a lista de alarmes. Hoje a fonte é a
simulação (`simulada.ts`). Para usar dados reais não é preciso mexer no mapa nem nos painéis.

## 1. Escolher a fonte (arquivo `.env` do Vite)

```
VITE_MONITOR_FONTE=zabbix
VITE_ZABBIX_URL=https://seu-proxy/zabbix/api_jsonrpc.php
VITE_GRAFANA_URL=https://seu-proxy/grafana
VITE_GRAFANA_PAINEL=uid/slug/painelId/variavel
```

- Sem `VITE_MONITOR_FONTE`, vale a simulação.
- Com `VITE_GRAFANA_URL`, os alertas ativos do Grafana entram na lista de alarmes; com
  `VITE_GRAFANA_PAINEL`, a ficha de cada ponto mostra o painel dele embutido.

## 2. Não coloque token no navegador

`VITE_ZABBIX_TOKEN` e `VITE_GRAFANA_TOKEN` existem para teste local, mas tudo que começa
com `VITE_` vai para o JavaScript público do site. Em produção, aponte as URLs para um
proxy do provedor (uma função serverless ou o próprio servidor) que acrescenta o token e
libera CORS só para o domínio do painel.

## 3. Ligar cada host a um ponto do mapa

- Zabbix: tag `ponto` no host (ex.: `ponto = ERB-17`), ou o id do ponto no nome do host.
- Grafana: rótulo `ponto` no alerta, ou o id em `instance` / `host`.

Um ponto sem host aparece como "fora do ar" de propósito: melhor um alarme falso do que
um ponto sem monitoramento parecer saudável.

## 4. Ajustar as chaves dos itens

As chaves variam de um Zabbix para outro. Os padrões estão em `CHAVES_PADRAO`
(`zabbix.ts`): `icmpping`, `net.if.in[uplink]`, `icmppingsec`, `icmppingloss`,
`sensor.temp.value`, `optical.rx.power`, `clients.online`.

## 5. Outra ferramenta

Qualquer fonte serve: implemente `FonteMonitoramento` (uma função `ler()` que devolve
uma `Leitura`) e registre em `index.ts`. As conversões são funções puras, testadas com
respostas de exemplo em `__tests__/monitor.test.ts`.
