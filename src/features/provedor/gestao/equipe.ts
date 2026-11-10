import { clientById, demoIncidents, pointById, type Client, type Incident } from '../data'
import { AGORA } from './base'

/* ---------------- Funcionários ---------------- */

export type Setor = 'campo' | 'atendimento' | 'noc' | 'financeiro' | 'estoque' | 'comercial' | 'gestao'
export const SETOR_LABEL: Record<Setor, string> = {
  campo: 'Técnicos de campo',
  atendimento: 'Atendimento',
  noc: 'NOC',
  financeiro: 'Financeiro',
  estoque: 'Almoxarifado',
  comercial: 'Comercial',
  gestao: 'Gestão',
}
export type Presenca = 'trabalhando' | 'folga' | 'ferias'
export interface Funcionario {
  id: string
  nome: string
  cargo: string
  setor: Setor
  presenca: Presenca
  /** Viatura do técnico de campo. */
  veiculo?: string
  /** XP acumulado no mês antes de hoje (ranking). */
  xp: number
  /** Ordens concluídas no mês. */
  osMes: number
  /** Avaliação média dos clientes (1–5). */
  nota: number
  salario: number
}
const f = (id: string, nome: string, cargo: string, setor: Setor, salario: number, xp = 0, osMes = 0, nota = 0, presenca: Presenca = 'trabalhando', veiculo?: string): Funcionario => ({
  id,
  nome,
  cargo,
  setor,
  presenca,
  veiculo,
  xp,
  osMes,
  nota,
  salario: salario * 100,
})
export const funcionarios: Funcionario[] = [
  f('F-01', 'Diego Macedo', 'Técnico de campo III', 'campo', 3900, 1840, 46, 4.9, 'trabalhando', 'VTR-01'),
  f('F-02', 'Tainá Barros', 'Técnica de campo II', 'campo', 3400, 1710, 43, 4.8, 'trabalhando', 'VTR-02'),
  f('F-03', 'Wesley Duarte', 'Técnico de campo II', 'campo', 3400, 1525, 39, 4.6, 'trabalhando', 'VTR-03'),
  f('F-04', 'Jéssica Pinto', 'Técnica de campo I', 'campo', 2900, 1290, 34, 4.7, 'trabalhando', 'VTR-04'),
  f('F-05', 'Renan Coelho', 'Técnico de campo I', 'campo', 2900, 1105, 31, 4.4, 'trabalhando', 'VTR-05'),
  f('F-06', 'Ícaro Neves', 'Técnico de campo I', 'campo', 2900, 980, 27, 4.5, 'folga', 'VTR-06'),
  f('F-07', 'Larissa Azevedo', 'Emendadora óptica', 'campo', 3600, 1430, 22, 4.8, 'ferias'),
  f('F-08', 'Bianca Ramos', 'Atendente', 'atendimento', 2100),
  f('F-09', 'Otávio Sales', 'Atendente', 'atendimento', 2100),
  f('F-10', 'Camila Farias', 'Supervisora de atendimento', 'atendimento', 3300),
  f('F-11', 'Rodrigo Paiva', 'Analista de redes (NOC)', 'noc', 5200),
  f('F-12', 'Juliana Freitas', 'Analista de redes (NOC)', 'noc', 5200),
  f('F-13', 'Sérgio Moura', 'Analista financeiro', 'financeiro', 3800),
  f('F-14', 'Patrícia Batista', 'Assistente de cobrança', 'financeiro', 2400),
  f('F-15', 'Nelson Menezes', 'Almoxarife', 'estoque', 2600),
  f('F-16', 'Aline Campos', 'Consultora comercial', 'comercial', 2700),
  f('F-17', 'Vítor Lacerda', 'Consultor comercial', 'comercial', 2700, 0, 0, 0, 'folga'),
  f('F-18', 'Carla Menezes', 'Engenheira de redes', 'gestao', 9800),
  f('F-19', 'Marcos Tavares', 'Gerente de operações', 'gestao', 11500),
]
export const funcionarioPorId = new Map(funcionarios.map((x) => [x.id, x]))
export const tecnicos = funcionarios.filter((x) => x.veiculo)
export const iniciais = (nome: string) =>
  nome
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)

/* ---------------- Ordens de serviço ---------------- */

export type TipoOS = 'instalacao' | 'reparo' | 'upgrade' | 'mudanca' | 'retirada'
export const TIPO_OS_LABEL: Record<TipoOS, string> = {
  instalacao: 'Instalação',
  reparo: 'Reparo',
  upgrade: 'Troca de plano',
  mudanca: 'Mudança de endereço',
  retirada: 'Retirada de equipamento',
}
/** Prazo de atendimento (horas) por tipo de ordem. */
export const SLA_HORAS: Record<TipoOS, number> = { reparo: 4, instalacao: 72, upgrade: 48, mudanca: 72, retirada: 120 }
export type StatusOS = 'aberta' | 'a_caminho' | 'em_atendimento' | 'concluida'
export const STATUS_OS_LABEL: Record<StatusOS, string> = {
  aberta: 'Sem técnico',
  a_caminho: 'Técnico a caminho',
  em_atendimento: 'Em atendimento',
  concluida: 'Concluída',
}
export interface OrdemServico {
  id: string
  tipo: TipoOS
  clientId: string
  descricao: string
  abertaEm: number
  prazo: number
  status: StatusOS
  tecnicoId?: string
  /** Momento (Date.now) em que o técnico saiu da base. */
  despachadaEm?: number
  /** Incidente que originou o reparo. */
  incidente?: Incident
}
export interface EstadoOS {
  status: StatusOS
  tecnicoId?: string
  despachadaEm?: number
}

const HORA = 3600000
const agendada = (id: string, tipo: TipoOS, clientId: string, descricao: string, horasAtras: number): OrdemServico => ({
  id,
  tipo,
  clientId,
  descricao,
  abertaEm: AGORA - horasAtras * HORA,
  prazo: AGORA - horasAtras * HORA + SLA_HORAS[tipo] * HORA,
  status: 'aberta',
})
/** Ordens agendadas que não nasceram de incidente. */
const agendadas: OrdemServico[] = [
  agendada('OS-4801', 'instalacao', 'AF-2300', 'Nova instalação · plano 500 Mega', 20),
  agendada('OS-4802', 'instalacao', 'AF-2710', 'Nova instalação · plano 800 Mega', 30),
  agendada('OS-4803', 'instalacao', 'AF-1320', 'Nova instalação via rádio · plano 300 Mega', 70),
  agendada('OS-4804', 'upgrade', 'AF-2150', 'Troca para 800 Mega com roteador AX3000', 26),
  agendada('OS-4805', 'mudanca', 'AF-2480', 'Mudança para a Rua das Rosas', 12),
  agendada('OS-4806', 'retirada', 'AF-1500', 'Cancelamento: retirar ONU e roteador', 50),
]
/** Atendimentos já em curso quando o painel abre. */
export const estadoInicialOS: Record<string, EstadoOS> = {
  'OS-R-AF-1060': { status: 'em_atendimento', tecnicoId: 'F-02' },
  'OS-4801': { status: 'em_atendimento', tecnicoId: 'F-03' },
  'OS-R-AF-1055': { status: 'a_caminho', tecnicoId: 'F-04', despachadaEm: 0 },
}
export const osDoIncidente = (clientId: string) => 'OS-R-' + clientId
export const totalReparosIniciais = demoIncidents.length

/** Tempo de deslocamento da base até o cliente (ms), acelerado para a demonstração. */
export const VIAGEM_MAXIMA = 20000
export function tempoViagem(client: Client) {
  return Math.max(6000, Math.min(VIAGEM_MAXIMA, Math.hypot(client.x, client.z) * 420))
}

/**
 * Ordens em aberto: as agendadas mais um reparo por incidente aberto. O estado
 * (técnico, deslocamento) vem da store; "a caminho" vira "em atendimento" quando
 * o tempo de viagem passa.
 */
export function listarOS(incidentes: readonly Incident[], estado: Readonly<Record<string, EstadoOS>>, agoraMs: number): OrdemServico[] {
  const reparos: OrdemServico[] = incidentes.flatMap((inc) => {
    if (!clientById.has(inc.clientId)) return []
    const aberta = Math.min(AGORA, Date.parse(inc.opened))
    const horas = inc.kind === 'offline' ? SLA_HORAS.reparo : 24
    return [
      {
        id: osDoIncidente(inc.clientId),
        tipo: 'reparo' as const,
        clientId: inc.clientId,
        descricao: inc.note || (inc.kind === 'offline' ? 'Cliente sem conexão.' : 'Conexão instável.'),
        abertaEm: aberta,
        prazo: aberta + horas * HORA,
        status: 'aberta' as const,
        incidente: inc,
      },
    ]
  })
  return [...reparos, ...agendadas]
    .map((os) => {
      const e = estado[os.id]
      if (!e) return os
      const cliente = clientById.get(os.clientId)!
      const chegou = e.status === 'a_caminho' && agoraMs - (e.despachadaEm ?? 0) >= tempoViagem(cliente)
      return { ...os, ...e, status: chegou ? ('em_atendimento' as const) : e.status }
    })
    .filter((os) => os.status !== 'concluida')
    .sort((a, b) => a.prazo - b.prazo)
}

export const osVencida = (os: OrdemServico) => os.prazo < AGORA
/** Horas restantes até o prazo (negativo = estourado). */
export const horasRestantes = (os: OrdemServico) => (os.prazo - AGORA) / HORA
export const tecnologiaDaOS = (os: OrdemServico) => pointById.get(clientById.get(os.clientId)!.pointId)!.technology

/** Técnico livre: trabalhando hoje e sem ordem em andamento. */
export function tecnicosLivres(ordens: readonly OrdemServico[]) {
  const ocupados = new Set(ordens.map((o) => o.tecnicoId).filter(Boolean))
  return tecnicos.filter((t) => t.presenca === 'trabalhando' && !ocupados.has(t.id))
}
