/**
 * Domínio de qualificação de segurança de aplicações (AppSec).
 *
 *   Área → Projeto → Ativo (proxy, microserviço, web, mobile, desktop)
 *                      └─ Qualificação (formulário do tipo do ativo), com
 *                         status, prazo, maturidade, pendências, documentos,
 *                         vulnerabilidades e histórico (requalificações).
 *
 * Os dados são normalizados como uma API devolveria: cada entidade em sua
 * lista, ligada por ids.
 */

export type TipoAtivo = 'proxy' | 'microservico' | 'web' | 'mobile' | 'desktop'
export type StatusQualificacao = 'aprovado' | 'rascunho' | 'depreciado' | 'reprovado'
export type Severidade = 'critica' | 'alta' | 'media' | 'baixa'
export type StatusVulnerabilidade = 'aberta' | 'em_correcao' | 'risco_aceito' | 'corrigida'
export type StatusPendencia = 'aberta' | 'concluida'
export type OrigemVulnerabilidade = 'pentest' | 'sast' | 'dast' | 'sca' | 'revisao'
export type Exposicao = 'internet' | 'interna'
export type Criticidade = 'alta' | 'media' | 'baixa'
export type Resposta = 'sim' | 'nao' | 'parcial' | 'nao_se_aplica' | null
/** Nível de maturidade da qualificação (1 = inicial … 5 = otimizado). */
export type Maturidade = 1 | 2 | 3 | 4 | 5
export type CategoriaDocumento = 'pentest' | 'sbom' | 'arquitetura' | 'evidencia' | 'aceite_risco'
export type Protocolo = 'https' | 'grpc' | 'graphql' | 'mensageria'
export type Autenticacao = 'mtls' | 'oauth2' | 'jwt' | 'api_key' | 'nenhuma'
export type ClassificacaoDados = 'sensiveis' | 'internos' | 'publicos'

export interface Area {
  id: string
  sigla: string
  nome: string
}

export interface Analista {
  id: string
  nome: string
  iniciais: string
  especialidades: TipoAtivo[]
}

export interface Projeto {
  id: string
  codigo: string
  nome: string
  areaId: string
  /** Squad dona do projeto. */
  squad: string
  analistaId: string
}

/** Item técnico do inventário. O estado de segurança está nas qualificações. */
export interface Ativo {
  id: string
  codigo: string
  nome: string
  tipo: TipoAtivo
  projetoId: string
  areaId: string
  tecnologia: string
  exposicao: Exposicao
  criticidade: Criticidade
}

export interface Qualificacao {
  id: string
  codigo: string
  ativoId: string
  projetoId: string
  /** Tipo do formulário (o mesmo do ativo). */
  tipo: TipoAtivo
  versaoFormulario: string
  status: StatusQualificacao
  /** Fração do formulário respondida (0–1). */
  progresso: number
  maturidade: Maturidade
  analistaId: string
  abertaEm: string
  /** Data para a qualificação ser resolvida (concluída ou reavaliada). */
  prazo: string
  concluidaEm: string | null
  /** Data limite para requalificar (qualificações aprovadas). */
  validadeAte: string | null
  motivo: string | null
  /** A qualificação atual do ativo; as demais são histórico. */
  vigente: boolean
}

export interface Documento {
  id: string
  qualificacaoId: string
  categoria: CategoriaDocumento
  nome: string
  formato: 'pdf' | 'json' | 'png' | 'xlsx' | 'docx'
  tamanhoKb: number
  enviadoEm: string
  enviadoPor: string
}

export interface Vulnerabilidade {
  id: string
  codigo: string
  ativoId: string
  /** Qualificação em que foi registrada. */
  qualificacaoId: string
  titulo: string
  cwe: string
  cvss: number
  severidade: Severidade
  status: StatusVulnerabilidade
  origem: OrigemVulnerabilidade
  abertaEm: string
  /** Prazo de correção pelo SLA da severidade. */
  prazo: string
  corrigidaEm: string | null
}

export interface Pendencia {
  id: string
  codigo: string
  qualificacaoId: string
  ativoId: string
  descricao: string
  responsavel: string
  prazo: string
  status: StatusPendencia
}

/**
 * Chamada entre ativos (origem consome destino): consumidor → proxy →
 * microserviços, inclusive entre projetos. Base do mapa de rede.
 */
export interface Conexao {
  id: string
  origemId: string
  destinoId: string
  protocolo: Protocolo
  autenticacao: Autenticacao
  /** Tráfego cifrado (TLS). */
  criptografada: boolean
  dados: ClassificacaoDados
}

export interface AppSecData {
  /** Momento de referência dos dados (o "agora" dos prazos). */
  geradoEm: string
  areas: Area[]
  analistas: Analista[]
  projetos: Projeto[]
  ativos: Ativo[]
  qualificacoes: Qualificacao[]
  documentos: Documento[]
  vulnerabilidades: Vulnerabilidade[]
  pendencias: Pendencia[]
  conexoes: Conexao[]
}

/** O que pode estar selecionado na tela. */
export type Selecao =
  | { tipo: 'ativo'; id: string }
  | { tipo: 'qualificacao'; id: string }
  | { tipo: 'projeto'; id: string }
  | { tipo: 'vulnerabilidade'; id: string }
  | { tipo: 'pendencia'; id: string }
  | { tipo: 'analista'; id: string }
