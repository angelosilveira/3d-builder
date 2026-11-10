import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { clientById } from '../data'
import { HOJE, maisDias } from './base'
import { estadoInicialOS, osVencida, tecnologiaDaOS, type EstadoOS, type OrdemServico, type TipoOS } from './equipe'
import { itemPorId, KIT_OS, loteReposicao, situacaoEstoque } from './estoque'
import { atraso, type ContaPagar, type Fatura } from './financeiro'

/** Recompensa ou aviso gerado por uma ação: vira toast, "+XP" e efeito no mapa. */
export interface Efeito {
  id: number
  tipo: 'recebimento' | 'pagamento' | 'os' | 'despacho' | 'estoque' | 'missao' | 'conquista'
  mensagem: string
  xp: number
  /** Casa onde o efeito acontece no mapa. */
  clientId?: string
  /** Valor em centavos (moedas no mapa). */
  valor?: number
}
export interface OSConcluida {
  id: string
  tipo: TipoOS
  clientId: string
  tecnicoId: string
  noPrazo: boolean
}

interface Dados {
  /** Faturas recebidas nesta sessão. */
  pagas: Record<string, true>
  contasPagas: Record<string, true>
  /** Contas criadas por compras de estoque. */
  contasExtras: ContaPagar[]
  /** Itens comprados que ainda não chegaram. */
  pedidos: Record<string, number>
  /** Baixas de estoque das ordens concluídas. */
  consumo: Record<string, number>
  os: Record<string, EstadoOS>
  concluidas: OSConcluida[]
  xp: number
  xpTecnico: Record<string, number>
  recebidoHoje: number
  pagoHoje: number
  /** Faturas vencidas recuperadas (missão de cobrança). */
  cobrancas: number
  /** Missões e conquistas que já deram recompensa. */
  premiadas: Record<string, true>
}
interface Acoes {
  efeitos: Efeito[]
  registrarPagamento: (fatura: Fatura) => void
  pagarConta: (conta: ContaPagar) => void
  reporItem: (itemId: string) => void
  despachar: (os: OrdemServico, tecnicoId: string) => void
  /** Conclui a ordem; o incidente (se houver) é encerrado por quem chama. */
  concluirOS: (os: OrdemServico) => void
  premiar: (id: string, tipo: 'missao' | 'conquista', xp: number, mensagem: string) => void
  dispensarEfeito: (id: number) => void
  reiniciar: () => void
}
export type GestaoState = Dados & Acoes

export const XP = { os: 40, osNoPrazo: 20, pagamento: 10, cobranca: 25, conta: 15, reposicao: 20, despacho: 5 }

function inicial(): Dados {
  const os: Record<string, EstadoOS> = {}
  // Quem já estava a caminho aparece no meio do trajeto.
  for (const [id, e] of Object.entries(estadoInicialOS)) os[id] = e.status === 'a_caminho' ? { ...e, despachadaEm: Date.now() - 3500 } : e
  return {
    pagas: {},
    contasPagas: {},
    contasExtras: [],
    pedidos: {},
    consumo: {},
    os,
    concluidas: [],
    xp: 0,
    xpTecnico: {},
    recebidoHoje: 0,
    pagoHoje: 0,
    cobrancas: 0,
    premiadas: {},
  }
}

let seq = 1
const novoEfeito = (e: Omit<Efeito, 'id'>): Efeito => ({ ...e, id: seq++ })
const fila = (efeitos: Efeito[], e: Omit<Efeito, 'id'>) => [...efeitos.slice(-5), novoEfeito(e)]
const dinheiro = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const useGestao = create<GestaoState>()(
  persist(
    (set) => ({
      ...inicial(),
      efeitos: [],

      registrarPagamento: (fatura) =>
        set((s) => {
          if (s.pagas[fatura.id]) return s
          const vencida = atraso(fatura) > 0
          const xp = vencida ? XP.cobranca : XP.pagamento
          const nome = clientById.get(fatura.clientId)?.name ?? fatura.clientId
          return {
            pagas: { ...s.pagas, [fatura.id]: true },
            recebidoHoje: s.recebidoHoje + fatura.cents,
            cobrancas: s.cobrancas + (vencida ? 1 : 0),
            xp: s.xp + xp,
            efeitos: fila(s.efeitos, {
              tipo: 'recebimento',
              mensagem: `${vencida ? 'Fatura vencida recuperada' : 'Pagamento registrado'}: ${dinheiro(fatura.cents)} de ${nome}`,
              xp,
              clientId: fatura.clientId,
              valor: fatura.cents,
            }),
          }
        }),

      pagarConta: (conta) =>
        set((s) => {
          if (s.contasPagas[conta.id] || conta.quitada) return s
          return {
            contasPagas: { ...s.contasPagas, [conta.id]: true },
            pagoHoje: s.pagoHoje + conta.cents,
            xp: s.xp + XP.conta,
            efeitos: fila(s.efeitos, { tipo: 'pagamento', mensagem: `Conta paga: ${conta.descricao} · ${dinheiro(conta.cents)}`, xp: XP.conta, valor: conta.cents }),
          }
        }),

      reporItem: (itemId) =>
        set((s) => {
          const situacao = situacaoEstoque(s.consumo, s.pedidos).find((x) => x.item.id === itemId)
          const qtd = situacao ? loteReposicao(situacao) : 0
          if (!situacao || qtd <= 0) return s
          const it = situacao.item
          const compra: ContaPagar = {
            id: 'CP-EST-' + it.id + '-' + (s.contasExtras.length + 1),
            descricao: `Compra de ${qtd.toLocaleString('pt-BR')} ${it.unidade} de ${it.nome}`,
            fornecedor: 'Distribuidora Óptica BA',
            categoria: 'fornecedores',
            vencimento: maisDias(HOJE, 28),
            cents: qtd * it.custo,
          }
          return {
            pedidos: { ...s.pedidos, [itemId]: (s.pedidos[itemId] ?? 0) + qtd },
            contasExtras: [...s.contasExtras, compra],
            xp: s.xp + XP.reposicao,
            efeitos: fila(s.efeitos, {
              tipo: 'estoque',
              mensagem: `Pedido de ${qtd.toLocaleString('pt-BR')} ${it.unidade} de ${it.nome} · conta de ${dinheiro(compra.cents)} lançada`,
              xp: XP.reposicao,
            }),
          }
        }),

      despachar: (os, tecnicoId) =>
        set((s) => ({
          os: { ...s.os, [os.id]: { status: 'a_caminho', tecnicoId, despachadaEm: Date.now() } },
          xp: s.xp + XP.despacho,
          efeitos: fila(s.efeitos, { tipo: 'despacho', mensagem: `Técnico a caminho de ${clientById.get(os.clientId)?.name ?? os.clientId}`, xp: XP.despacho, clientId: os.clientId }),
        })),

      concluirOS: (os) =>
        set((s) => {
          if (s.os[os.id]?.status === 'concluida' || !os.tecnicoId) return s
          const noPrazo = !osVencida(os)
          const xp = XP.os + (noPrazo ? XP.osNoPrazo : 0)
          const consumo = { ...s.consumo }
          for (const [id, qtd] of Object.entries(KIT_OS[os.tipo + ':' + tecnologiaDaOS(os)] ?? {})) if (itemPorId.has(id)) consumo[id] = (consumo[id] ?? 0) + qtd
          return {
            os: { ...s.os, [os.id]: { status: 'concluida', tecnicoId: os.tecnicoId } },
            concluidas: [...s.concluidas, { id: os.id, tipo: os.tipo, clientId: os.clientId, tecnicoId: os.tecnicoId, noPrazo }],
            consumo,
            xp: s.xp + xp,
            xpTecnico: { ...s.xpTecnico, [os.tecnicoId]: (s.xpTecnico[os.tecnicoId] ?? 0) + xp },
            efeitos: fila(s.efeitos, {
              tipo: 'os',
              mensagem: `${os.id} concluída${noPrazo ? ' no prazo' : ''} · ${clientById.get(os.clientId)?.name ?? os.clientId}`,
              xp,
              clientId: os.clientId,
            }),
          }
        }),

      premiar: (id, tipo, xp, mensagem) =>
        set((s) => (s.premiadas[id] ? s : { premiadas: { ...s.premiadas, [id]: true }, xp: s.xp + xp, efeitos: fila(s.efeitos, { tipo, mensagem, xp }) })),

      dispensarEfeito: (id) => set((s) => ({ efeitos: s.efeitos.filter((e) => e.id !== id) })),
      reiniciar: () => set({ ...inicial(), efeitos: [] }),
    }),
    {
      name: 'obra3d:provedor:gestao:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ efeitos: _efeitos, ...resto }) => Object.fromEntries(Object.entries(resto).filter(([, v]) => typeof v !== 'function')) as unknown as GestaoState,
    },
  ),
)
