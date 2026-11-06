/** Quem é o dono/gestor da obra. */
export type OwnerKind = 'prefeitura' | 'construtora'

/** Tipologia da edificação — define o modelo 3D padrão. */
export type BuildingType = 'casa' | 'apartamento' | 'predio' | 'condominio'

export type RoomKind =
  | 'sala'
  | 'quarto'
  | 'cozinha'
  | 'banheiro'
  | 'area_servico'
  | 'garagem'
  | 'varanda'
  | 'escritorio'
  | 'circulacao'
  | 'outro'

export interface Room {
  id: string
  name: string
  kind: RoomKind
  /** Largura (eixo X), em metros. */
  width: number
  /** Profundidade (eixo Z), em metros. */
  depth: number
  /** Progresso de acabamento específico do cômodo (0–100). */
  progress: number
}

/** Etapas físicas da obra. A ordem importa para a animação 3D. */
export type StageId =
  | 'fundacao'
  | 'estrutura'
  | 'alvenaria'
  | 'instalacoes'
  | 'cobertura'
  | 'acabamento'

export interface Stage {
  id: StageId
  name: string
  /** Peso da etapa no progresso total (soma = 100). */
  weight: number
  /** Percentual concluído da etapa (0–100). */
  progress: number
}

export type MaterialId =
  | 'cimento'
  | 'areia'
  | 'brita'
  | 'aco'
  | 'tijolo'
  | 'telha'
  | 'piso'
  | 'tinta'

export interface MaterialInfo {
  id: MaterialId
  name: string
  unit: string
  /** Preço unitário de referência (R$). */
  unitPrice: number
}

export interface MaterialUsage {
  id: string
  materialId: MaterialId
  quantity: number
  date: string
  note?: string
}

export type LaborRole = 'pedreiro' | 'ajudante' | 'servente'

export interface LaborEntry {
  id: string
  role: LaborRole
  /** Quantidade de trabalhadores no dia. */
  workers: number
  /** Horas trabalhadas por trabalhador, por dia. */
  hours: number
  /** Quantidade de dias do apontamento. */
  days: number
  date: string
  note?: string
}

export interface Project {
  id: string
  name: string
  owner: OwnerKind
  /** Nome do órgão/cliente (ex.: Secretaria de Obras, cliente final). */
  client: string
  address: string
  type: BuildingType
  /** Pavimentos (prédio) — 1 para os demais. */
  floors: number
  /** Unidades (casas no condomínio, apartamentos por andar no prédio). */
  units: number
  /** Pé-direito, em metros. */
  wallHeight: number
  rooms: Room[]
  stages: Stage[]
  materialUsage: MaterialUsage[]
  labor: LaborEntry[]
  startDate: string
  endDate: string
  createdAt: string
  /** Origem da planta: manual (questionário), pdf ou template. */
  source: 'questionario' | 'pdf' | 'template'
}

export type ProjectDraft = Omit<
  Project,
  'id' | 'stages' | 'materialUsage' | 'labor' | 'createdAt'
>
