/**
 * Obras do próprio provedor dentro da sede (Aracatu): expansão e reforço da
 * rede. Cada obra tem etapas com datas planejadas e o quanto já foi executado,
 * materiais (previsto x entregue), equipe em campo e custos. O mapa desenha o
 * canteiro conforme a etapa em que a obra está.
 */

export type TipoObra = 'torre' | 'estacao' | 'predio' | 'vala' | 'aerea' | 'energia' | 'galpao'
export type StatusObra = 'planejada' | 'em_andamento' | 'atrasada' | 'concluida'

export interface Etapa {
  id: string
  nome: string
  inicio: string
  fim: string
  /** Fração executada (0–1) na data de referência. */
  executado: number
}

export interface MaterialObra {
  item: string
  especificacao: string
  previsto: number
  entregue: number
  unidade: string
}

export interface EquipeObra {
  funcao: string
  pessoas: number
}

/** Onde a obra fica: um lote (centro e tamanho) ou um trecho (de A até B). */
export type LocalObra =
  | { forma: 'lote'; x: number; z: number; w: number; d: number }
  | { forma: 'trecho'; de: [number, number]; ate: [number, number] }
  | { forma: 'ponto'; x: number; z: number }

export interface Obra {
  id: string
  nome: string
  tipo: TipoObra
  objetivo: string
  local: LocalObra
  /** Ponto de acesso criado ou reforçado pela obra. */
  pontoId?: string
  bairro?: string
  contratada: string
  responsavel: string
  orcamento: number
  gasto: number
  /** Clientes que passam a ser atendidos (ou deixam de ter quedas) quando a obra termina. */
  beneficiados: number
  etapas: Etapa[]
  materiais: MaterialObra[]
  equipe: EquipeObra[]
  observacao?: string
}

/** Data de referência dos dados de demonstração (o "hoje" das obras). */
export const HOJE_OBRAS = '2026-11-10'

export const TIPO_OBRA_LABEL: Record<TipoObra, string> = {
  torre: 'Torre de rádio',
  estacao: 'Estação óptica',
  predio: 'Edificação',
  vala: 'Rede subterrânea',
  aerea: 'Rede aérea de fibra',
  energia: 'Energia',
  galpao: 'Galpão',
}
export const STATUS_OBRA_LABEL: Record<StatusObra, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  atrasada: 'Atrasada',
  concluida: 'Concluída',
}

const e = (id: string, nome: string, inicio: string, fim: string, executado: number): Etapa => ({ id, nome, inicio, fim, executado })
const m = (item: string, especificacao: string, previsto: number, entregue: number, unidade: string): MaterialObra => ({
  item,
  especificacao,
  previsto,
  entregue,
  unidade,
})

export const obras: Obra[] = [
  {
    id: 'OB-01',
    nome: 'Torre Novo Horizonte',
    tipo: 'torre',
    objetivo: 'Nova ERB para cobrir o loteamento Novo Horizonte e aliviar a Torre da Cidade (ERB-17).',
    local: { forma: 'lote', x: 31.2, z: -4.6, w: 3.4, d: 3.2 },
    pontoId: 'ERB-29',
    bairro: 'Novo Horizonte',
    contratada: 'Verticalis Torres',
    responsavel: 'Eng. Carla Menezes',
    orcamento: 486000,
    gasto: 301500,
    beneficiados: 180,
    etapas: [
      e('licenca', 'Licenças e sondagem do solo', '2026-09-14', '2026-09-28', 1),
      e('fundacao', 'Fundação (sapatas e blocos)', '2026-09-29', '2026-10-20', 1),
      e('estrutura', 'Montagem da estrutura · 30 m', '2026-10-21', '2026-11-20', 0.55),
      e('antenas', 'Antenas setoriais e rádios', '2026-11-21', '2026-12-05', 0),
      e('energia', 'Energia e enlace com a sede', '2026-12-01', '2026-12-12', 0),
      e('ativacao', 'Testes e ativação', '2026-12-13', '2026-12-18', 0),
    ],
    materiais: [
      m('Estrutura treliçada', 'Aço galvanizado · módulos de 6 m', 5, 5, 'módulos'),
      m('Concreto usinado', 'fck 30 MPa', 18, 18, 'm³'),
      m('Antena setorial', 'Setor de 120° · 5 GHz', 3, 0, 'un.'),
      m('Rádio de acesso', 'Dupla polarização · PoE', 3, 3, 'un.'),
      m('Cabo de rede externo', 'Cat6 blindado · capa UV', 120, 60, 'm'),
      m('Banco de baterias', '48 V · 200 Ah', 1, 0, 'banco'),
    ],
    equipe: [
      { funcao: 'Montador de torre', pessoas: 4 },
      { funcao: 'Eletricista', pessoas: 1 },
      { funcao: 'Operador de guindaste', pessoas: 1 },
      { funcao: 'Engenheira responsável', pessoas: 1 },
    ],
    observacao: 'Vento forte suspendeu a montagem em 2 dias; reprogramado para o fim de semana.',
  },
  {
    id: 'OB-02',
    nome: 'Estação óptica Novo Horizonte',
    tipo: 'estacao',
    objetivo: 'POP com OLT GPON para levar fibra até as casas do Novo Horizonte.',
    local: { forma: 'lote', x: 31, z: 3.6, w: 3.2, d: 2.6 },
    pontoId: 'POP-30',
    bairro: 'Novo Horizonte',
    contratada: 'Equipe própria AtlasFibra',
    responsavel: 'Téc. Rodrigo Paiva',
    orcamento: 214000,
    gasto: 132800,
    beneficiados: 192,
    etapas: [
      e('terra', 'Terraplenagem', '2026-10-05', '2026-10-12', 1),
      e('base', 'Base de concreto', '2026-10-13', '2026-10-26', 1),
      e('abrigo', 'Abrigo (shelter) climatizado', '2026-10-27', '2026-11-09', 1),
      e('olt', 'OLT, DIO e splitters', '2026-11-10', '2026-11-24', 0.15),
      e('testes', 'Fusões e certificação', '2026-11-25', '2026-12-10', 0),
    ],
    materiais: [
      m('Shelter', 'Abrigo metálico 3 × 2,4 m', 1, 1, 'un.'),
      m('OLT', 'GPON · 8 portas PON', 1, 1, 'un.'),
      m('Distribuidor óptico', 'DIO · 48 fibras', 2, 1, 'un.'),
      m('Splitter óptico', 'Balanceado · 1:16', 12, 4, 'un.'),
      m('Nobreak', 'Dupla conversão · 3 kVA', 1, 0, 'un.'),
    ],
    equipe: [
      { funcao: 'Técnico de telecom', pessoas: 2 },
      { funcao: 'Emendador óptico', pessoas: 1 },
      { funcao: 'Eletricista', pessoas: 1 },
    ],
  },
  {
    id: 'OB-03',
    nome: 'Centro de Operações da Rede',
    tipo: 'predio',
    objetivo: 'Nova sede operacional com NOC 24 h, sala de equipamentos e base das equipes de campo.',
    local: { forma: 'lote', x: -31.2, z: -2.2, w: 5.4, d: 5 },
    contratada: 'Construtora Serra Alta',
    responsavel: 'Eng. Marcos Tavares',
    orcamento: 2850000,
    gasto: 1712000,
    beneficiados: 2560,
    etapas: [
      e('fundacao', 'Fundação', '2026-06-01', '2026-07-15', 1),
      e('estrutura', 'Estrutura · 4 pavimentos', '2026-07-16', '2026-10-31', 0.75),
      e('alvenaria', 'Alvenaria e fachada', '2026-10-01', '2026-12-20', 0.2),
      e('instalacoes', 'Elétrica, climatização e cabeamento', '2026-11-15', '2027-02-10', 0),
      e('datacenter', 'Sala de equipamentos e NOC', '2027-01-10', '2027-03-10', 0),
      e('acabamento', 'Acabamento e mudança', '2027-02-20', '2027-03-30', 0),
    ],
    materiais: [
      m('Concreto usinado', 'fck 30 MPa', 420, 330, 'm³'),
      m('Aço CA-50', 'Vergalhões', 38, 31, 't'),
      m('Bloco cerâmico', '14 × 19 × 39 cm', 18000, 5200, 'un.'),
      m('Vidro de fachada', 'Laminado 8 mm', 260, 0, 'm²'),
      m('Climatização de precisão', 'Sala de equipamentos · 20 TR', 2, 0, 'un.'),
    ],
    equipe: [
      { funcao: 'Pedreiro', pessoas: 6 },
      { funcao: 'Armador', pessoas: 3 },
      { funcao: 'Carpinteiro', pessoas: 2 },
      { funcao: 'Ajudante', pessoas: 5 },
      { funcao: 'Operador de grua', pessoas: 1 },
      { funcao: 'Engenheiro', pessoas: 1 },
    ],
    observacao: 'Atraso na entrega do aço segurou a laje do 4º pavimento por 3 semanas.',
  },
  {
    id: 'OB-04',
    nome: 'Anel óptico Norte',
    tipo: 'vala',
    objetivo: 'Rota subterrânea redundante entre os bairros do norte: se um cabo romper, o tráfego volta pelo outro lado.',
    local: { forma: 'trecho', de: [-15, -20.6], ate: [13, -20.6] },
    contratada: 'Valetec Infraestrutura',
    responsavel: 'Eng. Paula Rezende',
    orcamento: 690000,
    gasto: 241000,
    beneficiados: 768,
    etapas: [
      e('projeto', 'Projeto e licença municipal', '2026-10-20', '2026-10-31', 1),
      e('vala', 'Abertura de vala · 2,6 km', '2026-11-03', '2026-11-28', 0.45),
      e('dutos', 'Dutos e lançamento do cabo', '2026-11-10', '2026-12-10', 0.12),
      e('emendas', 'Emendas e certificação', '2026-12-11', '2026-12-22', 0),
    ],
    materiais: [
      m('Duto PEAD', 'Ø 40 mm · triduto', 2600, 1400, 'm'),
      m('Cabo óptico', '144 fibras · subterrâneo', 2700, 0, 'm'),
      m('Caixa de passagem', 'Concreto · R1', 26, 12, 'un.'),
      m('Fita de sinalização', 'Advertência · fibra óptica', 2600, 2600, 'm'),
    ],
    equipe: [
      { funcao: 'Operador de retroescavadeira', pessoas: 1 },
      { funcao: 'Servente', pessoas: 4 },
      { funcao: 'Encarregado', pessoas: 1 },
    ],
  },
  {
    id: 'OB-05',
    nome: 'Reforço de energia da Torre da Cidade',
    tipo: 'energia',
    objetivo: 'Gerador e baterias na ERB-17 para manter os clientes conectados em quedas de energia.',
    local: { forma: 'lote', x: -27.4, z: -13.8, w: 2.6, d: 2.4 },
    pontoId: 'ERB-17',
    bairro: 'Centro',
    contratada: 'Equipe própria AtlasFibra',
    responsavel: 'Téc. Juliana Freitas',
    orcamento: 98000,
    gasto: 61000,
    beneficiados: 64,
    etapas: [
      e('base', 'Base do gerador', '2026-11-03', '2026-11-06', 1),
      e('gerador', 'Gerador 30 kVA e quadro de transferência', '2026-11-07', '2026-11-14', 0.6),
      e('baterias', 'Banco de baterias', '2026-11-12', '2026-11-18', 0),
      e('comissionamento', 'Comissionamento', '2026-11-19', '2026-11-21', 0),
    ],
    materiais: [
      m('Grupo gerador', 'Diesel · 30 kVA · carenado', 1, 1, 'un.'),
      m('Quadro de transferência', 'QTA automático', 1, 1, 'un.'),
      m('Bateria estacionária', '12 V · 150 Ah', 8, 0, 'un.'),
    ],
    equipe: [
      { funcao: 'Eletricista', pessoas: 2 },
      { funcao: 'Ajudante', pessoas: 1 },
    ],
    observacao: 'Prioridade: a ERB-17 concentra as quedas registradas hoje.',
  },
  {
    id: 'OB-06',
    nome: 'Fibra na Rua da União',
    tipo: 'aerea',
    objetivo: 'Migrar os clientes de rádio da Rua da União para fibra, com mais velocidade e menos instabilidade.',
    local: { forma: 'trecho', de: [9.6, 4.63], ate: [24.4, 4.63] },
    pontoId: 'POP-28',
    bairro: 'Bela União',
    contratada: 'Equipe própria AtlasFibra',
    responsavel: 'Téc. André Vieira',
    orcamento: 74000,
    gasto: 45200,
    beneficiados: 32,
    etapas: [
      e('postes', 'Cordoalha e ferragens nos postes', '2026-10-26', '2026-11-06', 1),
      e('cabo', 'Lançamento do cabo', '2026-11-07', '2026-11-16', 0.6),
      e('cto', 'Caixas de atendimento (CTO)', '2026-11-12', '2026-11-21', 0.2),
      e('migracao', 'Migração dos clientes', '2026-11-20', '2026-11-28', 0),
    ],
    materiais: [
      m('Cabo óptico', '36 fibras · autossustentado', 1600, 1000, 'm'),
      m('Caixa de atendimento', 'CTO 1:8', 4, 1, 'un.'),
      m('ONU', 'Terminal GPON G1', 32, 32, 'un.'),
      m('Ferragens', 'Kits de ancoragem', 22, 22, 'kits'),
    ],
    equipe: [
      { funcao: 'Instalador', pessoas: 2 },
      { funcao: 'Emendador óptico', pessoas: 1 },
    ],
  },
  {
    id: 'OB-07',
    nome: 'Almoxarifado e pátio de bobinas',
    tipo: 'galpao',
    objetivo: 'Estoque de cabos, ONUs e equipamentos perto das equipes, reduzindo o tempo de atendimento.',
    local: { forma: 'lote', x: 0.8, z: 21.6, w: 6, d: 3.4 },
    contratada: 'A contratar',
    responsavel: 'Eng. Marcos Tavares',
    orcamento: 640000,
    gasto: 0,
    beneficiados: 2560,
    etapas: [
      e('terra', 'Terraplenagem', '2026-12-01', '2026-12-15', 0),
      e('galpao', 'Galpão metálico', '2026-12-16', '2027-01-31', 0),
      e('patio', 'Pátio e cercamento', '2027-02-01', '2027-02-15', 0),
    ],
    materiais: [
      m('Estrutura metálica', 'Pórticos e telhas', 1, 0, 'conj.'),
      m('Piso industrial', 'Concreto polido', 380, 0, 'm²'),
    ],
    equipe: [],
    observacao: 'Licitação em andamento; início previsto para dezembro.',
  },
  {
    id: 'OB-08',
    nome: 'Ampliação da Central de fibra',
    tipo: 'estacao',
    objetivo: 'Segunda OLT na Central de fibra (POP-18) para atender a demanda do Centro.',
    local: { forma: 'ponto', x: -9.35, z: -8.2 },
    pontoId: 'POP-18',
    bairro: 'Centro',
    contratada: 'Equipe própria AtlasFibra',
    responsavel: 'Téc. Rodrigo Paiva',
    orcamento: 156000,
    gasto: 149300,
    beneficiados: 256,
    etapas: [
      e('olt', 'Instalação da segunda OLT', '2026-09-21', '2026-10-09', 1),
      e('migracao', 'Rebalanceamento das portas PON', '2026-10-13', '2026-10-30', 1),
    ],
    materiais: [
      m('OLT', 'GPON · 16 portas PON', 1, 1, 'un.'),
      m('Splitter óptico', 'Balanceado · 1:16', 16, 16, 'un.'),
    ],
    equipe: [],
  },
]

export const obraPorId = new Map(obras.map((o) => [o.id, o]))

/* ---------------- Cronograma ---------------- */

const DIA = 86400000
const t = (iso: string) => Date.parse(iso + 'T12:00:00Z')
export const diasEntre = (a: string, b: string) => Math.round((t(b) - t(a)) / DIA)
export const somarDias = (iso: string, dias: number) => new Date(t(iso) + dias * DIA).toISOString().slice(0, 10)

const duracao = (et: Etapa) => Math.max(1, diasEntre(et.inicio, et.fim) + 1)

/** Quanto da etapa deveria estar pronto na data (linear entre início e fim). */
export function previstoEtapa(et: Etapa, data: string) {
  const total = duracao(et)
  return Math.max(0, Math.min(1, (diasEntre(et.inicio, data) + 1) / total))
}

/** Média das etapas ponderada pela duração. */
function media(obra: Obra, valor: (et: Etapa) => number) {
  let soma = 0
  let peso = 0
  for (const et of obra.etapas) {
    const p = duracao(et)
    soma += valor(et) * p
    peso += p
  }
  return peso ? soma / peso : 0
}
export const executadoObra = (obra: Obra) => media(obra, (et) => et.executado)
export const previstoObra = (obra: Obra, data = HOJE_OBRAS) => media(obra, (et) => previstoEtapa(et, data))
export const inicioObra = (obra: Obra) => obra.etapas.reduce((a, et) => (et.inicio < a ? et.inicio : a), obra.etapas[0].inicio)
export const fimObra = (obra: Obra) => obra.etapas.reduce((a, et) => (et.fim > a ? et.fim : a), obra.etapas[0].fim)

export function statusObra(obra: Obra, data = HOJE_OBRAS): StatusObra {
  const exec = executadoObra(obra)
  if (exec >= 0.999) return 'concluida'
  if (exec === 0 && data < inicioObra(obra)) return 'planejada'
  return previstoObra(obra, data) - exec > 0.08 ? 'atrasada' : 'em_andamento'
}

/** Etapa em execução (ou a próxima a começar). */
export function etapaAtual(obra: Obra): Etapa | null {
  return obra.etapas.find((et) => et.executado > 0 && et.executado < 1) ?? obra.etapas.find((et) => et.executado === 0) ?? null
}

/**
 * Progresso por etapa usado para desenhar o canteiro. Sem data, mostra o que
 * foi executado; com uma data da linha do tempo, mostra o planejado naquele dia
 * (para o passado, nunca além do executado; para o futuro, o cronograma).
 */
export function progressoNoMapa(obra: Obra, data: string | null): Record<string, number> {
  const out: Record<string, number> = {}
  for (const et of obra.etapas) {
    if (!data) out[et.id] = et.executado
    else if (data <= HOJE_OBRAS) out[et.id] = Math.min(et.executado, previstoEtapa(et, data) || 0)
    else out[et.id] = Math.max(et.executado, previstoEtapa(et, data))
  }
  return out
}

/** Progresso geral (0–1) que o mapa mostra para a obra. */
export function progressoGeral(obra: Obra, data: string | null) {
  const p = progressoNoMapa(obra, data)
  return media(obra, (et) => p[et.id])
}

/** Janela da linha do tempo: do início da obra mais antiga ao fim da última. */
export const janelaObras = {
  inicio: obras.map(inicioObra).sort()[0],
  fim: obras.map(fimObra).sort().at(-1)!,
}

export const pessoasEmCampo = (obra: Obra) => obra.equipe.reduce((s, x) => s + x.pessoas, 0)

/** Centro da obra no mapa (para câmera, pino e efeitos). */
export function centroObra(obra: Obra): [number, number] {
  const l = obra.local
  if (l.forma === 'trecho') return [(l.de[0] + l.ate[0]) / 2, (l.de[1] + l.ate[1]) / 2]
  return [l.x, l.z]
}
/** Extensão (maior lado) da obra em metros do mapa, para enquadrar. */
export function tamanhoObra(obra: Obra) {
  const l = obra.local
  if (l.forma === 'trecho') return Math.hypot(l.ate[0] - l.de[0], l.ate[1] - l.de[1])
  if (l.forma === 'lote') return Math.max(l.w, l.d)
  return 2
}
