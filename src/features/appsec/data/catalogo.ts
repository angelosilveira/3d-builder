import type {
  Autenticacao,
  CategoriaDocumento,
  ClassificacaoDados,
  Protocolo,
  Criticidade,
  Maturidade,
  OrigemVulnerabilidade,
  Severidade,
  StatusPendencia,
  StatusQualificacao,
  StatusVulnerabilidade,
  TipoAtivo,
} from './types'

export const TIPOS: TipoAtivo[] = ['proxy', 'web', 'mobile', 'desktop', 'microservico']

export const TIPO_LABEL: Record<TipoAtivo, string> = {
  proxy: 'Proxy',
  microservico: 'Microserviço',
  web: 'Aplicação web',
  mobile: 'Mobile',
  desktop: 'Desktop',
}

export const TIPO_PLURAL: Record<TipoAtivo, string> = {
  proxy: 'Proxies',
  microservico: 'Microserviços',
  web: 'Aplicações web',
  mobile: 'Apps mobile',
  desktop: 'Apps desktop',
}

export const STATUS: StatusQualificacao[] = ['aprovado', 'rascunho', 'reprovado', 'depreciado']

export const STATUS_LABEL: Record<StatusQualificacao, string> = {
  aprovado: 'Aprovado',
  rascunho: 'Rascunho',
  reprovado: 'Reprovado',
  depreciado: 'Depreciado',
}

export const SEVERIDADES: Severidade[] = ['critica', 'alta', 'media', 'baixa']

export const SEVERIDADE_LABEL: Record<Severidade, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

/** Peso de cada severidade no índice de risco do ativo. */
export const SEVERIDADE_PESO: Record<Severidade, number> = { critica: 10, alta: 5, media: 2, baixa: 0.5 }

/** SLA de correção, em dias. */
export const SLA_DIAS: Record<Severidade, number> = { critica: 15, alta: 30, media: 90, baixa: 180 }

export const STATUS_VULN_LABEL: Record<StatusVulnerabilidade, string> = {
  aberta: 'Aberta',
  em_correcao: 'Em correção',
  risco_aceito: 'Risco aceito',
  corrigida: 'Corrigida',
}

export const STATUS_PENDENCIA_LABEL: Record<StatusPendencia, string> = {
  aberta: 'Aberta',
  concluida: 'Concluída',
}

export const ORIGEM_LABEL: Record<OrigemVulnerabilidade, string> = {
  pentest: 'Pentest',
  sast: 'SAST',
  dast: 'DAST',
  sca: 'SCA (dependências)',
  revisao: 'Revisão de arquitetura',
}

export const CRITICIDADE_LABEL: Record<Criticidade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

export const AREAS_BASE: { sigla: string; nome: string; projetos: string[] }[] = [
  {
    sigla: 'CD',
    nome: 'Canais digitais',
    projetos: ['Super App', 'Internet Banking PF', 'Internet Banking PJ', 'Onboarding digital', 'Login unificado', 'Notificações', 'Chat de atendimento', 'Área do cliente', 'Biometria facial', 'Token digital', 'Portal institucional', 'Central de ajuda', 'Perfil do cliente', 'Agendamentos', 'Comprovantes', 'Assistente virtual', 'Home personalizada', 'Cadastro simplificado', 'Recuperação de acesso', 'Modo offline'],
  },
  {
    sigla: 'PG',
    nome: 'Pagamentos',
    projetos: ['Pix', 'Pix agendado', 'Pix por aproximação', 'Boletos', 'TED e DOC', 'Cartão de débito', 'Carteira digital', 'Link de pagamento', 'Maquininha', 'Conciliação', 'Antifraude transacional', 'Limites', 'QR Code', 'Débito automático', 'Pagamento de contas', 'Câmbio'],
  },
  {
    sigla: 'CR',
    nome: 'Crédito',
    projetos: ['Empréstimo pessoal', 'Consignado', 'Crédito imobiliário', 'Financiamento de veículos', 'Cartão de crédito', 'Limite pré-aprovado', 'Análise de crédito', 'Renegociação', 'Antecipação de recebíveis', 'Score interno', 'Cobrança', 'Crédito rural', 'Capital de giro'],
  },
  {
    sigla: 'IN',
    nome: 'Investimentos',
    projetos: ['Home broker', 'Renda fixa', 'Fundos', 'Previdência', 'Tesouro direto', 'Perfil de investidor', 'Carteira consolidada', 'Ofertas públicas', 'Câmbio turismo', 'Robô advisor', 'Relatórios fiscais'],
  },
  {
    sigla: 'SG',
    nome: 'Seguros',
    projetos: ['Seguro auto', 'Seguro residencial', 'Seguro de vida', 'Sinistros', 'Assistência 24h', 'Cotação online', 'Seguro celular', 'Portal do corretor', 'Seguro viagem'],
  },
  {
    sigla: 'AT',
    nome: 'Atendimento',
    projetos: ['URA inteligente', 'CRM', 'Ouvidoria', 'Backoffice de agências', 'Gestão de filas', 'Atendimento por vídeo', 'Base de conhecimento', 'Pesquisa de satisfação', 'Gestão de reclamações'],
  },
  {
    sigla: 'DA',
    nome: 'Dados e analytics',
    projetos: ['Data lake', 'Open Finance', 'Motor de recomendação', 'Feature store', 'Painéis executivos', 'Catálogo de dados', 'Ingestão em tempo real', 'MLOps', 'Prevenção à lavagem de dinheiro', 'Qualidade de dados'],
  },
  {
    sigla: 'CO',
    nome: 'Corporativo',
    projetos: ['ERP financeiro', 'Folha de pagamento', 'Portal do colaborador', 'Gestão de contratos', 'Compras', 'Jurídico', 'Gestão de acessos (IAM)', 'Service desk', 'Contabilidade', 'Gestão de riscos', 'Auditoria interna', 'Tesouraria', 'Patrimônio'],
  },
]

export const ANALISTAS_BASE: { nome: string; especialidades: TipoAtivo[] }[] = [
  { nome: 'Ana Ribeiro', especialidades: ['web', 'microservico'] },
  { nome: 'Bruno Tavares', especialidades: ['mobile'] },
  { nome: 'Camila Nogueira', especialidades: ['proxy', 'microservico'] },
  { nome: 'Diego Martins', especialidades: ['web'] },
  { nome: 'Eduarda Lins', especialidades: ['microservico'] },
  { nome: 'Felipe Araújo', especialidades: ['desktop', 'web'] },
  { nome: 'Gabriela Moura', especialidades: ['mobile', 'web'] },
  { nome: 'Henrique Prado', especialidades: ['proxy'] },
  { nome: 'Isabela Freitas', especialidades: ['microservico', 'web'] },
  { nome: 'João Pedro Lima', especialidades: ['desktop'] },
  { nome: 'Karina Dias', especialidades: ['web', 'proxy'] },
  { nome: 'Lucas Fernandes', especialidades: ['microservico'] },
  { nome: 'Mariana Costa', especialidades: ['mobile', 'microservico'] },
  { nome: 'Rafael Monteiro', especialidades: ['web', 'desktop'] },
  { nome: 'Sofia Almeida', especialidades: ['proxy', 'web'] },
  { nome: 'Thiago Barros', especialidades: ['microservico', 'mobile'] },
]

export const SQUADS = ['Atlas', 'Bússola', 'Cometa', 'Dínamo', 'Eclipse', 'Faro', 'Gênesis', 'Horizonte', 'Ícaro', 'Jade', 'Kairós', 'Lumen', 'Meridiano', 'Nexus', 'Órbita', 'Prisma', 'Quasar', 'Radar', 'Sirius', 'Tétis']

export const TECNOLOGIAS: Record<TipoAtivo, string[]> = {
  proxy: ['Kong Gateway', 'NGINX', 'Envoy', 'Apigee', 'HAProxy', 'Traefik'],
  microservico: ['Java · Spring Boot', 'Kotlin · Ktor', 'Node.js · NestJS', 'Go', '.NET 8', 'Python · FastAPI'],
  web: ['React', 'Angular', 'Vue', 'Next.js', 'JSF (legado)'],
  mobile: ['Android · Kotlin', 'iOS · Swift', 'React Native', 'Flutter'],
  desktop: ['Electron', '.NET WPF', 'Java Swing', 'Delphi (legado)'],
}

/** Prefixos de nome do artefato por tipo (viram parte do código do ativo). */
export const PREFIXO: Record<TipoAtivo, string> = {
  proxy: 'gw',
  microservico: 'ms',
  web: 'web',
  mobile: 'app',
  desktop: 'dsk',
}

export const SUFIXOS_MS = ['api', 'core', 'orquestrador', 'consulta', 'eventos', 'limites', 'cadastro', 'autorizador', 'notificador', 'integrador', 'auditoria', 'regras', 'extrato', 'saldo', 'conciliador', 'agenda', 'documentos', 'antifraude']

export interface ModeloVulnerabilidade {
  titulo: string
  cwe: string
  severidade: Severidade
  origem: OrigemVulnerabilidade
}

/** Achados típicos por tipo de ativo (usados para gerar os mocks). */
export const VULNERABILIDADES: Record<TipoAtivo, ModeloVulnerabilidade[]> = {
  proxy: [
    { titulo: 'TLS 1.0/1.1 habilitado no listener público', cwe: 'CWE-327', severidade: 'alta', origem: 'dast' },
    { titulo: 'Rate limiting ausente em rota de autenticação', cwe: 'CWE-307', severidade: 'alta', origem: 'pentest' },
    { titulo: 'Cabeçalho HSTS ausente', cwe: 'CWE-319', severidade: 'media', origem: 'dast' },
    { titulo: 'Rota administrativa exposta à internet', cwe: 'CWE-284', severidade: 'critica', origem: 'pentest' },
    { titulo: 'Validação de JWT sem checagem de audiência', cwe: 'CWE-347', severidade: 'critica', origem: 'revisao' },
    { titulo: 'CORS permissivo (Access-Control-Allow-Origin: *)', cwe: 'CWE-942', severidade: 'media', origem: 'dast' },
    { titulo: 'Versão do gateway com CVE conhecida', cwe: 'CWE-1104', severidade: 'alta', origem: 'sca' },
    { titulo: 'Logs de acesso registram tokens de sessão', cwe: 'CWE-532', severidade: 'media', origem: 'revisao' },
  ],
  microservico: [
    { titulo: 'SQL injection em filtro de consulta', cwe: 'CWE-89', severidade: 'critica', origem: 'pentest' },
    { titulo: 'IDOR: consulta de conta de outro cliente', cwe: 'CWE-639', severidade: 'critica', origem: 'pentest' },
    { titulo: 'Segredo de banco no código-fonte', cwe: 'CWE-798', severidade: 'alta', origem: 'sast' },
    { titulo: 'Desserialização insegura em fila de eventos', cwe: 'CWE-502', severidade: 'alta', origem: 'sast' },
    { titulo: 'Dependência com CVE crítica (jackson-databind)', cwe: 'CWE-1104', severidade: 'alta', origem: 'sca' },
    { titulo: 'SSRF em integração com parceiro', cwe: 'CWE-918', severidade: 'alta', origem: 'pentest' },
    { titulo: 'Stack trace exposto na resposta de erro', cwe: 'CWE-209', severidade: 'baixa', origem: 'dast' },
    { titulo: 'Ausência de autorização por escopo no endpoint', cwe: 'CWE-285', severidade: 'media', origem: 'revisao' },
    { titulo: 'Log com dados pessoais sem mascaramento', cwe: 'CWE-532', severidade: 'media', origem: 'revisao' },
    { titulo: 'Imagem de contêiner com pacotes desatualizados', cwe: 'CWE-1104', severidade: 'baixa', origem: 'sca' },
  ],
  web: [
    { titulo: 'XSS armazenado em campo de observação', cwe: 'CWE-79', severidade: 'alta', origem: 'pentest' },
    { titulo: 'XSS refletido em parâmetro de busca', cwe: 'CWE-79', severidade: 'media', origem: 'dast' },
    { titulo: 'Content-Security-Policy ausente', cwe: 'CWE-1021', severidade: 'media', origem: 'dast' },
    { titulo: 'Token de sessão em localStorage', cwe: 'CWE-922', severidade: 'media', origem: 'revisao' },
    { titulo: 'CSRF em alteração de dados cadastrais', cwe: 'CWE-352', severidade: 'alta', origem: 'pentest' },
    { titulo: 'Biblioteca front-end com CVE (lodash)', cwe: 'CWE-1104', severidade: 'baixa', origem: 'sca' },
    { titulo: 'Clickjacking: X-Frame-Options ausente', cwe: 'CWE-1021', severidade: 'baixa', origem: 'dast' },
    { titulo: 'Bypass de MFA na troca de senha', cwe: 'CWE-308', severidade: 'critica', origem: 'pentest' },
  ],
  mobile: [
    { titulo: 'Ausência de certificate pinning', cwe: 'CWE-295', severidade: 'alta', origem: 'pentest' },
    { titulo: 'Token armazenado sem Keychain/Keystore', cwe: 'CWE-312', severidade: 'alta', origem: 'pentest' },
    { titulo: 'Detecção de root/jailbreak contornável', cwe: 'CWE-693', severidade: 'media', origem: 'pentest' },
    { titulo: 'Chave de API embutida no binário', cwe: 'CWE-798', severidade: 'critica', origem: 'sast' },
    { titulo: 'Logs de depuração habilitados em release', cwe: 'CWE-489', severidade: 'baixa', origem: 'sast' },
    { titulo: 'Deep link sem validação de origem', cwe: 'CWE-939', severidade: 'media', origem: 'revisao' },
    { titulo: 'Captura de tela permitida em telas sensíveis', cwe: 'CWE-200', severidade: 'baixa', origem: 'revisao' },
  ],
  desktop: [
    { titulo: 'Binário sem assinatura de código', cwe: 'CWE-347', severidade: 'alta', origem: 'revisao' },
    { titulo: 'Atualização automática sem verificação de integridade', cwe: 'CWE-494', severidade: 'critica', origem: 'pentest' },
    { titulo: 'DLL hijacking no diretório de instalação', cwe: 'CWE-427', severidade: 'alta', origem: 'pentest' },
    { titulo: 'Credenciais salvas em texto claro no registro', cwe: 'CWE-256', severidade: 'alta', origem: 'pentest' },
    { titulo: 'Electron com nodeIntegration habilitado', cwe: 'CWE-94', severidade: 'alta', origem: 'sast' },
    { titulo: 'Runtime desatualizado com CVE conhecida', cwe: 'CWE-1104', severidade: 'media', origem: 'sca' },
  ],
}

export const PENDENCIAS_MODELO = [
  'Anexar evidência de pentest',
  'Anexar SBOM atualizado',
  'Responder seção de criptografia',
  'Responder seção de autenticação',
  'Enviar diagrama de arquitetura',
  'Comprovar rotação de segredos',
  'Registrar plano de correção das vulnerabilidades altas',
  'Validar cabeçalhos de segurança em produção',
  'Confirmar retenção e mascaramento de logs',
  'Atualizar dono técnico do ativo',
  'Agendar reteste após correção',
  'Anexar aceite de risco assinado',
]

export interface SecaoFormulario {
  id: string
  titulo: string
  perguntas: { id: string; texto: string }[]
}

const secao = (id: string, titulo: string, perguntas: string[]): SecaoFormulario => ({
  id,
  titulo,
  perguntas: perguntas.map((texto, i) => ({ id: `${id}-${i + 1}`, texto })),
})

const COMUNS = [
  secao('gov', 'Governança', ['Dono técnico e squad responsável estão cadastrados?', 'Existe diagrama de arquitetura atualizado?', 'Os dados tratados foram classificados (LGPD)?']),
  secao('dep', 'Dependências', ['O SBOM é gerado no pipeline?', 'O SCA bloqueia CVEs críticas no build?']),
]

/** Formulário de qualificação por tipo de ativo (versão atual). */
export const FORMULARIOS: Record<TipoAtivo, SecaoFormulario[]> = {
  proxy: [
    secao('tls', 'Transporte e TLS', ['Apenas TLS 1.2+ com suítes fortes?', 'HSTS habilitado com includeSubDomains?', 'Certificados com renovação automatizada?']),
    secao('borda', 'Proteções de borda', ['WAF ativo em modo bloqueio?', 'Rate limiting nas rotas sensíveis?', 'Rotas administrativas restritas à rede interna?']),
    secao('auth', 'Autenticação na borda', ['Valida assinatura, expiração e audiência do JWT?', 'mTLS com os serviços de backend?']),
    ...COMUNS,
  ],
  microservico: [
    secao('auth', 'Autenticação e autorização', ['Todos os endpoints exigem token?', 'Autorização por escopo e por recurso (anti-IDOR)?', 'Comunicação serviço a serviço autenticada?']),
    secao('dados', 'Entrada e dados', ['Consultas parametrizadas em todo acesso a banco?', 'Validação de entrada por esquema?', 'Dados pessoais mascarados em logs?']),
    secao('seg', 'Segredos', ['Segredos em cofre (sem variáveis no código)?', 'Rotação de credenciais automatizada?']),
    secao('obs', 'Observabilidade', ['Eventos de segurança enviados ao SIEM?', 'Erros sem stack trace para o cliente?']),
    ...COMUNS,
  ],
  web: [
    secao('front', 'Proteções do navegador', ['Content-Security-Policy restritiva?', 'Cookies com Secure, HttpOnly e SameSite?', 'Proteção contra clickjacking?']),
    secao('sessao', 'Sessão e autenticação', ['MFA nas operações sensíveis?', 'Sessão expira por inatividade?', 'Token fora de localStorage?']),
    secao('entrada', 'Entrada e saída', ['Escape de saída contra XSS?', 'Proteção contra CSRF?']),
    ...COMUNS,
  ],
  mobile: [
    secao('arm', 'Armazenamento (MASVS-STORAGE)', ['Tokens no Keychain/Keystore?', 'Sem dados sensíveis em logs ou backups?']),
    secao('rede', 'Comunicação (MASVS-NETWORK)', ['Certificate pinning implementado?', 'Sem tráfego em texto claro?']),
    secao('res', 'Resiliência (MASVS-RESILIENCE)', ['Detecção de root/jailbreak e hooking?', 'Ofuscação do binário de release?']),
    secao('plat', 'Plataforma (MASVS-PLATFORM)', ['Deep links validados?', 'Bloqueio de captura em telas sensíveis?']),
    ...COMUNS,
  ],
  desktop: [
    secao('dist', 'Distribuição', ['Binários assinados digitalmente?', 'Atualização verifica assinatura e integridade?']),
    secao('local', 'Armazenamento local', ['Credenciais protegidas pelo cofre do SO?', 'Diretório de instalação sem permissão de escrita para usuários?']),
    secao('runtime', 'Runtime', ['Runtime e frameworks em versão suportada?', 'Electron com contextIsolation e sem nodeIntegration?']),
    ...COMUNS,
  ],
}

export const VERSAO_FORMULARIO: Record<TipoAtivo, string> = {
  proxy: 'v3.2',
  microservico: 'v4.1',
  web: 'v4.0',
  mobile: 'v2.3',
  desktop: 'v1.8',
}

export const MATURIDADES: Maturidade[] = [1, 2, 3, 4, 5]

export const MATURIDADE_LABEL: Record<Maturidade, string> = {
  1: 'Inicial',
  2: 'Repetível',
  3: 'Definido',
  4: 'Gerenciado',
  5: 'Otimizado',
}

export const CATEGORIA_DOC_LABEL: Record<CategoriaDocumento, string> = {
  pentest: 'Relatório de pentest',
  sbom: 'SBOM',
  arquitetura: 'Diagrama de arquitetura',
  evidencia: 'Evidência técnica',
  aceite_risco: 'Aceite de risco',
}

/** Documentos que cada formulário exige para a qualificação ser aprovada. */
export const DOCUMENTOS_OBRIGATORIOS: Record<TipoAtivo, CategoriaDocumento[]> = {
  proxy: ['arquitetura', 'evidencia', 'pentest'],
  microservico: ['arquitetura', 'sbom'],
  web: ['arquitetura', 'sbom', 'pentest'],
  mobile: ['sbom', 'pentest'],
  desktop: ['sbom', 'evidencia'],
}

/** Nome típico do arquivo enviado em cada categoria. */
export const NOME_DOCUMENTO: Record<CategoriaDocumento, { nome: string; formato: 'pdf' | 'json' | 'png' | 'xlsx' | 'docx' }> = {
  pentest: { nome: 'relatorio-pentest', formato: 'pdf' },
  sbom: { nome: 'sbom-cyclonedx', formato: 'json' },
  arquitetura: { nome: 'diagrama-arquitetura', formato: 'png' },
  evidencia: { nome: 'evidencias-configuracao', formato: 'xlsx' },
  aceite_risco: { nome: 'aceite-de-risco-assinado', formato: 'pdf' },
}

/** Versões anteriores dos formulários (para o histórico de requalificações). */
export const VERSOES_ANTERIORES: Record<TipoAtivo, string[]> = {
  proxy: ['v2.4', 'v3.0', 'v3.1'],
  microservico: ['v3.2', 'v3.6', 'v4.0'],
  web: ['v3.1', 'v3.5', 'v3.8'],
  mobile: ['v1.6', 'v2.0', 'v2.2'],
  desktop: ['v1.2', 'v1.5', 'v1.7'],
}

/** Prazo padrão (dias) para concluir uma qualificação aberta. */
export const PRAZO_QUALIFICACAO_DIAS = 45

/* ---------------- Rede de conexões ---------------- */

export const PROTOCOLO_LABEL: Record<Protocolo, string> = { https: 'HTTPS', grpc: 'gRPC', graphql: 'GraphQL', mensageria: 'Mensageria' }
export const AUTENTICACAO_LABEL: Record<Autenticacao, string> = {
  mtls: 'mTLS',
  oauth2: 'OAuth 2.0',
  jwt: 'JWT',
  api_key: 'API key',
  nenhuma: 'Sem autenticação',
}
export const DADOS_LABEL: Record<ClassificacaoDados, string> = { sensiveis: 'Dados sensíveis', internos: 'Dados internos', publicos: 'Dados públicos' }
