import type { Alerta, Equipamento, ObraData } from './types'

/** Limite de tempo entre a mistura na usina e o lançamento (NBR 7212). */
export const LIMITE_MISTURA_MIN = 150
const VAZAO_M3_POR_TICK = 0.35

export const minutosDesde = (iso: string, agora: Date) => (agora.getTime() - new Date(iso).getTime()) / 60000

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Avança a simulação "ao vivo" um passo. Pura e com compartilhamento
 * estrutural: só os objetos que mudaram ganham nova referência, para que os
 * seletores do HUD re-renderizem apenas o que mudou.
 */
export function simularTick(data: ObraData, agora: Date, tick: number): ObraData {
  const concretagem = data.concretagens.find((c) => c.status === 'em_andamento')
  let concretagens = data.concretagens
  let equipamentos = data.equipamentos
  let equipes = data.equipes
  let kpis = data.kpis

  if (concretagem) {
    const caminhoes = equipamentos.filter((e) => e.tipo === 'betoneira' && e.remessa?.concretagemId === concretagem.id)
    const ativo = caminhoes.find((c) => c.status === 'descarregando')
    if (ativo?.remessa && concretagem.volumeLancadoM3 < concretagem.volumeProgramadoM3) {
      const restanteCaminhao = ativo.remessa.volumeM3 - ativo.remessa.descarregadoM3
      const restanteObra = concretagem.volumeProgramadoM3 - concretagem.volumeLancadoM3
      const vazao = Math.min(VAZAO_M3_POR_TICK, restanteCaminhao, restanteObra)
      const descarregado = round1(ativo.remessa.descarregadoM3 + vazao)
      const terminou = descarregado >= ativo.remessa.volumeM3 - 0.05

      const atualizados = new Map<string, Equipamento>()
      atualizados.set(ativo.id, {
        ...ativo,
        status: terminou ? 'liberado' : 'descarregando',
        utilizacao: descarregado / ativo.remessa.volumeM3,
        remessa: { ...ativo.remessa, descarregadoM3: descarregado },
      })
      if (terminou) {
        // Fila anda: quem aguardava encosta na bomba e quem estava em trânsito chega.
        const fila = caminhoes.find((c) => c.status === 'aguardando')
        if (fila) atualizados.set(fila.id, { ...fila, status: 'descarregando', observacao: undefined })
        const transito = caminhoes.find((c) => c.status === 'em_transito')
        if (transito) atualizados.set(transito.id, { ...transito, status: 'aguardando' })
      }
      equipamentos = equipamentos.map((e) => atualizados.get(e.id) ?? e)

      const lancado = round1(Math.min(concretagem.volumeProgramadoM3, concretagem.volumeLancadoM3 + vazao))
      const completa = lancado >= concretagem.volumeProgramadoM3
      const novaConcretagem = {
        ...concretagem,
        volumeLancadoM3: lancado,
        etapa: completa ? ('adensamento' as const) : concretagem.etapa,
        marcos: completa ? { ...concretagem.marcos, adensamento: agora.toISOString() } : concretagem.marcos,
      }
      concretagens = concretagens.map((c) => (c.id === concretagem.id ? novaConcretagem : c))
      equipes = equipes.map((e) =>
        e.zona === 'bomba' ? { ...e, progresso: lancado / concretagem.volumeProgramadoM3 } : e,
      )
      kpis = { ...kpis, concretoHojeM3: lancado }
    }
  }

  // Grua: carga oscila conforme içamentos; horímetro anda com o relógio.
  equipamentos = equipamentos.map((e) => {
    if (e.tipo !== 'grua' || e.capacidadeT === undefined) return e
    const carga = round1(0.6 + 1.6 * (0.5 + 0.5 * Math.sin(tick / 4)))
    return { ...e, cargaAtualT: carga, horimetro: Math.round((e.horimetro + 0.001) * 1000) / 1000 }
  })

  // Catraca: entradas e saídas pontuais de trabalhadores.
  if (tick % 5 === 0) {
    const delta = tick % 10 === 0 ? 1 : -1
    kpis = { ...kpis, trabalhadores: Math.max(0, kpis.trabalhadores + delta) }
  }

  if (concretagens === data.concretagens && equipamentos === data.equipamentos && kpis === data.kpis && equipes === data.equipes) return data
  return { ...data, concretagens, equipamentos, equipes, kpis }
}

/** Alertas fixos + alertas calculados (tempo desde a mistura acima do limite). */
export function alertasAtivos(data: ObraData, agora: Date): Alerta[] {
  const mistura: Alerta[] = data.equipamentos
    .filter((e) => e.remessa && (e.status === 'aguardando' || e.status === 'em_transito' || e.status === 'descarregando'))
    .filter((e) => minutosDesde(e.remessa!.saidaUsina, agora) > LIMITE_MISTURA_MIN)
    .map((e) => ({
      id: `${e.id}-al-mistura`,
      titulo: `${e.codigo} · ${Math.floor(minutosDesde(e.remessa!.saidaUsina, agora))} min desde a mistura`,
      descricao: `Acima do limite de ${LIMITE_MISTURA_MIN} min. Avaliar o concreto com o tecnologista antes de lançar.`,
      severidade: 'critico' as const,
      alvoId: e.id,
      tipo: 'tempo_mistura' as const,
    }))
  return [...mistura, ...data.alertasFixos]
}
