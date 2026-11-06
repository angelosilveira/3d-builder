/**
 * Tipos de domínio do gêmeo digital do canteiro.
 * Tempo do cronograma é medido em semanas desde o início da obra (número
 * fracionário); datas de eventos do dia são ISO strings.
 */

export interface Intervalo {
  inicio: number
  fim: number
}

/** Execução real de uma etapa, conhecida até "hoje". */
export interface Execucao {
  inicio: number | null
  fim: number | null
  /** Progresso (0–1) medido na semana atual da obra. */
  progresso: number
}

export interface EtapaPavimento {
  previsto: Intervalo
  executado: Execucao
}

export interface Pavimento {
  id: string
  /** 1 = primeiro pavimento. */
  numero: number
  nome: string
  estrutura: EtapaPavimento
  alvenaria: EtapaPavimento
}

export type StatusElemento = 'planejado' | 'em_execucao' | 'concluido' | 'nao_conforme'

export interface Rompimento {
  idadeDias: 7 | 28
  /** Resistência à compressão, em MPa. null = aguardando laboratório. */
  mpa: number | null
}

export interface ElementoEstrutural {
  id: string
  codigo: string
  tipo: 'pilar' | 'laje'
  pavimentoId: string
  pavimentoNumero: number
  /** Resistência característica especificada, em MPa. */
  fck: number
  volumeM3: number
  concretagemId: string | null
  dataConcretagem: string | null
  rompimentos: Rompimento[]
  status: StatusElemento
  /** Posição do pilar na malha (índice). */
  indiceMalha?: number
}

export type EtapaConcretagem =
  | 'saida_usina'
  | 'em_transito'
  | 'na_obra'
  | 'lancamento'
  | 'adensamento'
  | 'cura'

export type StatusConcretagem = 'programada' | 'em_andamento' | 'concluida' | 'atrasada'

export interface Concretagem {
  id: string
  codigo: string
  descricao: string
  elementoIds: string[]
  pavimentoNumero: number
  fck: number
  slumpEspecificadoCm: number
  volumeProgramadoM3: number
  volumeLancadoM3: number
  data: string
  status: StatusConcretagem
  etapa: EtapaConcretagem
  /** Horário em que cada etapa começou (ISO), na ordem da sequência. */
  marcos: Partial<Record<EtapaConcretagem, string>>
  caminhaoIds: string[]
}

export type TipoEquipamento =
  | 'grua'
  | 'betoneira'
  | 'bomba'
  | 'escavadeira'
  | 'retroescavadeira'
  | 'elevador'

export type StatusEquipamento =
  | 'operando'
  | 'parado'
  | 'manutencao'
  | 'em_transito'
  | 'aguardando'
  | 'descarregando'
  | 'liberado'

export interface RemessaConcreto {
  placa: string
  usina: string
  notaFiscal: string
  volumeM3: number
  /** Volume já descarregado na obra. */
  descarregadoM3: number
  slumpCm: number
  saidaUsina: string
  concretagemId: string
}

export interface Equipamento {
  id: string
  codigo: string
  nome: string
  tipo: TipoEquipamento
  status: StatusEquipamento
  operador: string
  horimetro: number
  /** Carga atual e capacidade, em toneladas (quando aplicável). */
  cargaAtualT?: number
  capacidadeT?: number
  proximaManutencao: string
  /** Utilização no dia (0–1). */
  utilizacao: number
  observacao?: string
  remessa?: RemessaConcreto
}

export type FuncaoTrabalhador =
  | 'encarregado'
  | 'armador'
  | 'carpinteiro'
  | 'pedreiro'
  | 'servente'
  | 'operador'
  | 'seguranca'

export interface Equipe {
  id: string
  codigo: string
  nome: string
  funcao: FuncaoTrabalhador
  encarregado: string
  membros: number
  local: string
  /** Pavimento de trabalho (0 = térreo/canteiro). */
  pavimentoNumero: number
  atividade: string
  fvs: { codigo: string; status: 'aberta' | 'em_verificacao' | 'aprovada' }
  /** Avanço da atividade (0–1). */
  progresso: number
  /** Área do canteiro onde a equipe aparece na cena. */
  zona: 'pavimento_atual' | 'alvenaria' | 'bomba' | 'estoque' | 'circulacao'
}

export type StatusMaterial = 'em_estoque' | 'estoque_baixo' | 'em_falta'

export interface Material {
  id: string
  nome: string
  unidade: string
  quantidade: number
  consumoDiario: number
  status: StatusMaterial
}

export type SeveridadeAlerta = 'critico' | 'atencao'

export interface Alerta {
  id: string
  titulo: string
  descricao: string
  severidade: SeveridadeAlerta
  /** Id do objeto da cena a que o alerta se refere. */
  alvoId: string
  tipo: 'concretagem_atrasada' | 'equipamento_parado' | 'nc_qualidade' | 'tempo_mistura'
}

export interface Kpis {
  concretoHojeM3: number
  trabalhadores: number
  diasSemAcidente: number
}

export interface Obra {
  id: string
  codigo: string
  nome: string
  endereco: string
  responsavelTecnico: string
  mestreDeObras: string
  art: string
  /** Data (ISO) da semana 0. */
  inicio: string
  /** Semana atual (fracionária). */
  semanaAtual: number
  /** Duração prevista, em semanas. */
  duracaoSemanas: number
  /** Peso da fundação no avanço físico e sua duração, em semanas. */
  pesoFundacao: number
  semanasFundacao: number
  /** Dimensões da planta-tipo, em metros. */
  planta: { largura: number; profundidade: number; peDireito: number; colunas: number; linhas: number }
}

/** Tudo o que a tela precisa de uma obra. */
export interface ObraData {
  obra: Obra
  pavimentos: Pavimento[]
  elementos: ElementoEstrutural[]
  concretagens: Concretagem[]
  equipamentos: Equipamento[]
  equipes: Equipe[]
  materiais: Material[]
  alertasFixos: Alerta[]
  kpis: Kpis
  kpisOntem: Kpis & { avancoReal: number }
}

export type TipoEntidade = 'elemento' | 'concretagem' | 'equipamento' | 'equipe'

export type Entidade =
  | { tipo: 'elemento'; item: ElementoEstrutural }
  | { tipo: 'concretagem'; item: Concretagem }
  | { tipo: 'equipamento'; item: Equipamento }
  | { tipo: 'equipe'; item: Equipe }
