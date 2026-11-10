import { useEffect, useMemo, useState } from 'react'
import type { Incident } from '../data'
import { groupOpenOutages } from '../outages'
import { listarOS, VIAGEM_MAXIMA } from './equipe'
import { situacaoEstoque } from './estoque'
import { resumoFinanceiro } from './financeiro'
import { conquistas, missoes, nivelSaude, saudeOperacao, type Operacao } from './saude'
import { useGestao } from './store'

/** Relógio que só anda enquanto há técnico a caminho (para a chegada virar "em atendimento"). */
function useRelogio(ativo: boolean) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ativo) return
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [ativo])
  return agora
}

/** Fotografia da operação: ordens, financeiro, estoque, saúde, missões e conquistas. */
export function useOperacao(incidentes: readonly Incident[]) {
  const pagas = useGestao((s) => s.pagas)
  const contasPagas = useGestao((s) => s.contasPagas)
  const contasExtras = useGestao((s) => s.contasExtras)
  const pedidos = useGestao((s) => s.pedidos)
  const consumo = useGestao((s) => s.consumo)
  const estadoOS = useGestao((s) => s.os)
  const recebidoHoje = useGestao((s) => s.recebidoHoje)
  const pagoHoje = useGestao((s) => s.pagoHoje)
  const cobrancas = useGestao((s) => s.cobrancas)

  // Só há o que esperar enquanto alguma viatura ainda não chegou (a viagem mais longa dura 20 s).
  const [viajando, setViajando] = useState(false)
  useEffect(() => {
    const ultima = Math.max(0, ...Object.values(estadoOS).map((e) => (e.status === 'a_caminho' ? (e.despachadaEm ?? 0) : 0)))
    const resta = ultima + VIAGEM_MAXIMA + 1500 - Date.now()
    setViajando(resta > 0)
    if (resta <= 0) return
    const id = window.setTimeout(() => setViajando(false), resta)
    return () => window.clearTimeout(id)
  }, [estadoOS])
  const agora = useRelogio(viajando)
  const ordens = useMemo(() => listarOS(incidentes, estadoOS, agora), [incidentes, estadoOS, agora])
  const financeiro = useMemo(() => resumoFinanceiro(pagas, contasPagas, contasExtras, recebidoHoje, pagoHoje), [pagas, contasPagas, contasExtras, recebidoHoje, pagoHoje])
  const estoque = useMemo(() => situacaoEstoque(consumo, pedidos), [consumo, pedidos])
  const falhas = useMemo(() => groupOpenOutages(incidentes).length, [incidentes])

  return useMemo(() => {
    const op: Operacao = { incidentes, falhas, ordens, financeiro, estoque }
    const saude = saudeOperacao(op)
    const lista = missoes(op, contasPagas, cobrancas)
    return { ...op, saude, nivel: nivelSaude(saude.total), missoes: lista, conquistas: conquistas(op, lista) }
  }, [incidentes, falhas, ordens, financeiro, estoque, contasPagas, cobrancas])
}
export type OperacaoCompleta = ReturnType<typeof useOperacao>
