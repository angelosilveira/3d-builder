/** Almoxarifado: saldo, mínimo e consumo dos materiais usados em instalações e reparos. */
export interface ItemEstoque {
  id: string
  nome: string
  categoria: 'Equipamento do cliente' | 'Cabos e conectores' | 'Rede óptica' | 'Energia'
  unidade: string
  saldo: number
  minimo: number
  /** Custo unitário em centavos. */
  custo: number
  consumoSemana: number
}
const item = (id: string, nome: string, categoria: ItemEstoque['categoria'], unidade: string, saldo: number, minimo: number, custoReais: number, consumoSemana: number): ItemEstoque => ({
  id,
  nome,
  categoria,
  unidade,
  saldo,
  minimo,
  custo: Math.round(custoReais * 100),
  consumoSemana,
})
export const itensEstoque: ItemEstoque[] = [
  item('onu', 'ONU GPON G1', 'Equipamento do cliente', 'un.', 46, 60, 149, 22),
  item('roteador-ax1800', 'Roteador Atlas AX1800', 'Equipamento do cliente', 'un.', 38, 40, 189, 12),
  item('roteador-ax3000', 'Roteador Atlas AX3000', 'Equipamento do cliente', 'un.', 64, 30, 289, 9),
  item('cpe', 'Antena CPE 5 GHz', 'Equipamento do cliente', 'un.', 21, 20, 329, 6),
  item('poe', 'Fonte PoE 24 V', 'Equipamento do cliente', 'un.', 55, 25, 39, 7),
  item('mesh', 'Ponto mesh M2', 'Equipamento do cliente', 'un.', 14, 10, 219, 3),
  item('drop', 'Cabo drop óptico 1 fibra', 'Cabos e conectores', 'm', 5200, 8000, 0.92, 2400),
  item('cabo-36f', 'Cabo óptico 36 fibras AS', 'Cabos e conectores', 'm', 2100, 1500, 4.8, 350),
  item('conector', 'Conector SC/APC de campo', 'Cabos e conectores', 'un.', 420, 500, 6.5, 90),
  item('patch', 'Cordão óptico SC/APC', 'Cabos e conectores', 'un.', 130, 80, 12, 25),
  item('splitter-8', 'Splitter óptico 1:8', 'Rede óptica', 'un.', 18, 12, 58, 3),
  item('splitter-16', 'Splitter óptico 1:16', 'Rede óptica', 'un.', 9, 10, 96, 2),
  item('cto', 'Caixa de atendimento (CTO) 1:8', 'Rede óptica', 'un.', 6, 8, 215, 2),
  item('bateria', 'Bateria estacionária 12 V', 'Energia', 'un.', 4, 8, 890, 1),
]
export const itemPorId = new Map(itensEstoque.map((i) => [i.id, i]))

export type Quantidades = Readonly<Record<string, number>>
export interface SituacaoItem {
  item: ItemEstoque
  saldo: number
  aCaminho: number
  /** Abaixo do mínimo mesmo contando os pedidos a caminho. */
  critico: boolean
  /** Abaixo do mínimo hoje (pode estar coberto por pedido). */
  baixo: boolean
  /** Semanas de cobertura no ritmo atual de consumo. */
  cobertura: number
}
export function situacaoEstoque(consumo: Quantidades, pedidos: Quantidades): SituacaoItem[] {
  return itensEstoque.map((it) => {
    const saldo = Math.max(0, it.saldo - (consumo[it.id] ?? 0))
    const aCaminho = pedidos[it.id] ?? 0
    return { item: it, saldo, aCaminho, baixo: saldo < it.minimo, critico: saldo + aCaminho < it.minimo, cobertura: saldo / it.consumoSemana }
  })
}
/** Lote de reposição: volta ao dobro do mínimo. */
export const loteReposicao = (s: SituacaoItem) => Math.max(0, s.item.minimo * 2 - s.saldo - s.aCaminho)
export const valorEstoque = (lista: SituacaoItem[]) => lista.reduce((t, s) => t + s.saldo * s.item.custo, 0)

/** Materiais baixados do estoque ao concluir cada tipo de ordem de serviço. */
export const KIT_OS: Record<string, Record<string, number>> = {
  'instalacao:fiber': { onu: 1, 'roteador-ax1800': 1, drop: 80, conector: 2, patch: 1 },
  'instalacao:radio': { cpe: 1, poe: 1, 'roteador-ax1800': 1 },
  'reparo:fiber': { conector: 2, drop: 15 },
  'reparo:radio': { poe: 1 },
  'upgrade:fiber': { 'roteador-ax3000': 1 },
  'upgrade:radio': { 'roteador-ax3000': 1 },
  'mudanca:fiber': { drop: 60, conector: 2 },
  'mudanca:radio': {},
  'retirada:fiber': {},
  'retirada:radio': {},
}
