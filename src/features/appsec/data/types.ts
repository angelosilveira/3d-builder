/**
 * Domínio de qualificação de segurança de aplicações (AppSec).
 * Os nomes seguem o vocabulário do time: ativos são qualificados por
 * formulário; vulnerabilidades e pendências ficam ligadas ao ativo.
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

export interface Qualificacao {
  status: StatusQualificacao
  versaoFormulario: string
  /** Fração do formulário respondida (0–1). */
  progresso: number
  atualizadoEm: string
  aprovadoEm: string | null
  /** Data limite para requalificação (só para aprovados). */
  validadeAte: string | null
  motivo: string | null
}

export interface Ativo {
  id: string
  codigo: string
  nome: string
  tipo: TipoAtivo
  projetoId: string
  areaId: string
  analistaId: string
  tecnologia: string
  exposicao: Exposicao
  criticidade: Criticidade
  qualificacao: Qualificacao
}

export interface Vulnerabilidade {
  id: string
  codigo: string
  ativoId: string
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
  ativoId: string
  descricao: string
  responsavel: string
  prazo: string
  status: StatusPendencia
}

export interface AppSecData {
  /** Momento de referência dos dados (o "agora" dos prazos). */
  geradoEm: string
  areas: Area[]
  analistas: Analista[]
  projetos: Projeto[]
  ativos: Ativo[]
  vulnerabilidades: Vulnerabilidade[]
  pendencias: Pendencia[]
}

/** O que pode estar selecionado na tela. */
export type Selecao =
  | { tipo: 'ativo'; id: string }
  | { tipo: 'projeto'; id: string }
  | { tipo: 'vulnerabilidade'; id: string }
  | { tipo: 'pendencia'; id: string }
  | { tipo: 'analista'; id: string }
