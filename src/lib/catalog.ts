import type {
  BuildingType,
  LaborRole,
  MaterialId,
  MaterialInfo,
  OwnerKind,
  RoomKind,
  Stage,
  StageId,
} from '../types'

export const BUILDING_TYPE_LABEL: Record<BuildingType, string> = {
  casa: 'Casa',
  apartamento: 'Apartamento',
  predio: 'Prédio',
  condominio: 'Condomínio',
}

export const OWNER_LABEL: Record<OwnerKind, string> = {
  prefeitura: 'Prefeitura',
  construtora: 'Construtora',
}

export const ROOM_KIND_LABEL: Record<RoomKind, string> = {
  sala: 'Sala',
  quarto: 'Quarto',
  cozinha: 'Cozinha',
  banheiro: 'Banheiro',
  area_servico: 'Área de serviço',
  garagem: 'Garagem',
  varanda: 'Varanda',
  escritorio: 'Escritório',
  circulacao: 'Circulação',
  outro: 'Outro',
}

/** Cor do piso acabado por tipo de cômodo (visual 3D). */
export const ROOM_FLOOR_COLOR: Record<RoomKind, string> = {
  sala: '#c8a27a',
  quarto: '#b98d63',
  cozinha: '#d9d4c7',
  banheiro: '#cfe0e8',
  area_servico: '#d6d3cb',
  garagem: '#9ca3af',
  varanda: '#a8a29e',
  escritorio: '#b08968',
  circulacao: '#d4c4a8',
  outro: '#c7c2b8',
}

/** Etapas padrão com pesos típicos de um cronograma físico-financeiro. */
export const DEFAULT_STAGES: Stage[] = [
  { id: 'fundacao', name: 'Fundação', weight: 15, progress: 0 },
  { id: 'estrutura', name: 'Estrutura', weight: 20, progress: 0 },
  { id: 'alvenaria', name: 'Alvenaria', weight: 20, progress: 0 },
  { id: 'instalacoes', name: 'Instalações', weight: 10, progress: 0 },
  { id: 'cobertura', name: 'Cobertura', weight: 15, progress: 0 },
  { id: 'acabamento', name: 'Acabamento', weight: 20, progress: 0 },
]

export const STAGE_COLOR: Record<StageId, string> = {
  fundacao: '#78716c',
  estrutura: '#64748b',
  alvenaria: '#c2410c',
  instalacoes: '#2563eb',
  cobertura: '#b45309',
  acabamento: '#16a34a',
}

export const MATERIALS: Record<MaterialId, MaterialInfo> = {
  cimento: { id: 'cimento', name: 'Cimento (saco 50 kg)', unit: 'sc', unitPrice: 38 },
  areia: { id: 'areia', name: 'Areia', unit: 'm³', unitPrice: 140 },
  brita: { id: 'brita', name: 'Brita', unit: 'm³', unitPrice: 160 },
  aco: { id: 'aco', name: 'Aço (vergalhão)', unit: 'kg', unitPrice: 8.5 },
  tijolo: { id: 'tijolo', name: 'Tijolo cerâmico 9×19×19', unit: 'un', unitPrice: 1.1 },
  telha: { id: 'telha', name: 'Telha cerâmica', unit: 'un', unitPrice: 2.4 },
  piso: { id: 'piso', name: 'Piso cerâmico', unit: 'm²', unitPrice: 45 },
  tinta: { id: 'tinta', name: 'Tinta acrílica', unit: 'L', unitPrice: 22 },
}

export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[]

export const LABOR_LABEL: Record<LaborRole, string> = {
  pedreiro: 'Pedreiro',
  ajudante: 'Ajudante',
  servente: 'Servente',
}

/** Custo de referência por hora (R$) — ajustável no futuro por região. */
export const LABOR_HOURLY_RATE: Record<LaborRole, number> = {
  pedreiro: 32,
  ajudante: 22,
  servente: 18,
}

export const LABOR_ROLES = Object.keys(LABOR_LABEL) as LaborRole[]
