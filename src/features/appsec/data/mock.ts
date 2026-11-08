import {
  ANALISTAS_BASE,
  AREAS_BASE,
  DOCUMENTOS_OBRIGATORIOS,
  NOME_DOCUMENTO,
  PENDENCIAS_MODELO,
  PRAZO_QUALIFICACAO_DIAS,
  PREFIXO,
  SLA_DIAS,
  SQUADS,
  SUFIXOS_MS,
  TECNOLOGIAS,
  TIPOS,
  VERSAO_FORMULARIO,
  VERSOES_ANTERIORES,
  VULNERABILIDADES,
} from './catalogo'
import type {
  AppSecData,
  Analista,
  Area,
  Ativo,
  CategoriaDocumento,
  Criticidade,
  Documento,
  Maturidade,
  Pendencia,
  Projeto,
  Qualificacao,
  Severidade,
  StatusQualificacao,
  StatusVulnerabilidade,
  TipoAtivo,
  Vulnerabilidade,
} from './types'

/**
 * Gera um inventário realista e determinístico (mesma semente → mesmos
 * dados). Para usar a API real, troque `criarAppSecMock` por um fetch que
 * devolva `AppSecData` — o resto da tela não muda.
 */

const DIA = 86400000

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const pad = (n: number, w = 5) => String(n).padStart(w, '0')
const iniciais = (nome: string) =>
  nome
    .split(' ')
    .filter((p) => p.length > 2 || p === p.toUpperCase())
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

export interface OpcoesMock {
  agora?: Date
  seed?: number
}

export function criarAppSecMock({ agora = new Date(), seed = 20261108 }: OpcoesMock = {}): AppSecData {
  const r = rng(seed)
  const int = (min: number, max: number) => Math.floor(min + r() * (max - min + 1))
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)]
  const chance = (p: number) => r() < p
  const poisson = (lambda: number) => {
    const L = Math.exp(-lambda)
    let k = 0
    let p = 1
    do {
      k++
      p *= r()
    } while (p > L)
    return k - 1
  }
  /** Fisher–Yates com o PRNG: embaralhamento uniforme e reprodutível. */
  const embaralhar = <T,>(arr: readonly T[]): T[] => {
    const out = [...arr]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  const iso = (d: number) => new Date(d).toISOString()
  const t0 = agora.getTime()

  const areas: Area[] = AREAS_BASE.map((a) => ({ id: `area-${a.sigla.toLowerCase()}`, sigla: a.sigla, nome: a.nome }))
  const analistas: Analista[] = ANALISTAS_BASE.map((a, i) => ({
    id: `ana-${pad(i + 1, 2)}`,
    nome: a.nome,
    iniciais: iniciais(a.nome),
    especialidades: a.especialidades,
  }))
  const analistasDoTipo = (tipo: TipoAtivo) => analistas.filter((a) => a.especialidades.includes(tipo))

  const projetos: Projeto[] = []
  const ativos: Ativo[] = []
  const vulnerabilidades: Vulnerabilidade[] = []
  const pendencias: Pendencia[] = []
  let seqProjeto = 1
  let seqAtivo = 1
  let seqVuln = 1
  let seqPend = 1

  const qualificacoes: Qualificacao[] = []
  const documentos: Documento[] = []
  let seqQual = 1
  let seqDoc = 1

  function novoDocumento(q: Qualificacao, ativo: Ativo, categoria: CategoriaDocumento, quando: number) {
    const modelo = NOME_DOCUMENTO[categoria]
    const mes = new Date(quando).toISOString().slice(0, 7)
    const kb = { pdf: int(300, 4800), json: int(40, 900), png: int(180, 1600), xlsx: int(30, 400), docx: int(60, 700) }[modelo.formato]
    documentos.push({
      id: `doc-${pad(seqDoc++, 6)}`,
      qualificacaoId: q.id,
      categoria,
      nome: `${modelo.nome}-${ativo.nome}-${mes}.${modelo.formato}`,
      formato: modelo.formato,
      tamanhoKb: kb,
      enviadoEm: iso(Math.min(t0, quando)),
      enviadoPor: chance(0.6) ? `Squad ${projetos.find((p) => p.id === ativo.projetoId)!.squad}` : analistas.find((a) => a.id === q.analistaId)!.nome,
    })
  }

  interface NovaQualificacao {
    ativo: Ativo
    analistaId: string
    status: StatusQualificacao
    maturidade: Maturidade
    versao: string
    progresso: number
    abertaEm: number
    prazo: number
    concluidaEm: number | null
    vigente: boolean
    motivo: string | null
  }

  /** Cria a qualificação e os documentos enviados nela (obrigatórios conforme o status). */
  function novaQualificacao(o: NovaQualificacao): Qualificacao {
    const q: Qualificacao = {
      id: `qlf-${pad(seqQual)}`,
      codigo: `QLF-${pad(seqQual++)}`,
      ativoId: o.ativo.id,
      projetoId: o.ativo.projetoId,
      tipo: o.ativo.tipo,
      versaoFormulario: o.versao,
      status: o.status,
      progresso: o.progresso,
      maturidade: o.maturidade,
      analistaId: o.analistaId,
      abertaEm: iso(o.abertaEm),
      prazo: iso(o.prazo),
      concluidaEm: o.concluidaEm !== null ? iso(o.concluidaEm) : null,
      validadeAte: o.status === 'aprovado' && o.concluidaEm !== null ? iso(o.concluidaEm + 365 * DIA) : null,
      motivo: o.motivo,
      vigente: o.vigente,
    }
    qualificacoes.push(q)
    const ate = o.concluidaEm ?? t0
    for (const categoria of DOCUMENTOS_OBRIGATORIOS[o.ativo.tipo]) {
      const presente =
        o.status === 'aprovado' || o.status === 'depreciado' ? true : o.status === 'reprovado' ? chance(0.8) : chance(o.progresso * 0.9 + 0.05)
      if (presente) novoDocumento(q, o.ativo, categoria, o.abertaEm + r() * Math.max(DIA, ate - o.abertaEm))
    }
    return q
  }

  AREAS_BASE.forEach((areaBase, ai) => {
    const area = areas[ai]
    const canalDigital = ['CD', 'PG', 'IN', 'SG'].includes(area.sigla)
    const legado = ['CO', 'AT'].includes(area.sigla)

    for (const nomeProjeto of areaBase.projetos) {
      const projeto: Projeto = {
        id: `prj-${pad(seqProjeto, 3)}`,
        codigo: `PRJ-${pad(seqProjeto++, 3)}`,
        nome: nomeProjeto,
        areaId: area.id,
        squad: pick(SQUADS),
        analistaId: pick(analistas).id,
      }
      projetos.push(projeto)
      const s = slug(nomeProjeto)

      // Composição típica de um projeto.
      const total = int(14, 50)
      const qtd: Record<TipoAtivo, number> = {
        proxy: int(1, 3),
        web: canalDigital ? int(1, 3) : int(0, 2),
        mobile: canalDigital ? int(1, 2) * 2 : chance(0.2) ? 2 : 0,
        desktop: legado ? int(1, 4) : chance(0.2) ? 1 : 0,
        microservico: 0,
      }
      qtd.microservico = Math.max(4, total - qtd.proxy - qtd.web - qtd.mobile - qtd.desktop)

      for (const tipo of TIPOS) {
        const usados = new Set<string>()
        for (let k = 0; k < qtd[tipo]; k++) {
          let nome: string
          switch (tipo) {
            case 'proxy':
              nome = `${PREFIXO.proxy}-${s}-${['externo', 'interno', 'parceiros'][k] ?? `n${k}`}`
              break
            case 'web':
              nome = `${PREFIXO.web}-${s}${['', '-admin', '-backoffice'][k] ?? `-${k}`}`
              break
            case 'mobile':
              nome = `${PREFIXO.mobile}-${s}-${k % 2 === 0 ? 'android' : 'ios'}${k > 1 ? `-${Math.floor(k / 2) + 1}` : ''}`
              break
            case 'desktop':
              nome = `${PREFIXO.desktop}-${s}${['', '-agente', '-retaguarda', '-relatorios'][k] ?? `-${k}`}`
              break
            default: {
              let suf = SUFIXOS_MS[(k + s.length) % SUFIXOS_MS.length]
              if (k >= SUFIXOS_MS.length) suf = `${suf}-${Math.floor(k / SUFIXOS_MS.length) + 1}`
              nome = `${PREFIXO.microservico}-${s}-${suf}`
            }
          }
          if (usados.has(nome)) nome = `${nome}-${k}`
          usados.add(nome)

          const exposicao = tipo === 'microservico' ? (chance(0.08) ? 'internet' : 'interna') : tipo === 'desktop' ? 'interna' : 'internet'
          const criticidade: Criticidade = ['PG', 'CR'].includes(area.sigla) ? (chance(0.6) ? 'alta' : 'media') : pick(['alta', 'media', 'media', 'baixa'] as const)
          const candidatos = analistasDoTipo(tipo)
          const analistaId = candidatos[(seqAtivo + k) % candidatos.length].id
          const ativo: Ativo = {
            id: `atv-${pad(seqAtivo)}`,
            codigo: `ATV-${pad(seqAtivo++)}`,
            nome,
            tipo,
            projetoId: projeto.id,
            areaId: area.id,
            tecnologia: pick(TECNOLOGIAS[tipo]),
            exposicao,
            criticidade,
          }
          ativos.push(ativo)

          // ---- Qualificação vigente ----
          // Legado desktop tende a ser depreciado.
          const sorteio = r()
          const status: StatusQualificacao =
            tipo === 'desktop' && sorteio < 0.3
              ? 'depreciado'
              : sorteio < 0.58
                ? 'aprovado'
                : sorteio < 0.79
                  ? 'rascunho'
                  : sorteio < 0.89
                    ? 'reprovado'
                    : 'depreciado'
          const maturidade = (
            { aprovado: pick([3, 4, 4, 5] as const), depreciado: pick([2, 3, 4] as const), rascunho: pick([1, 2, 2, 3] as const), reprovado: pick([1, 1, 2] as const) } as const
          )[status] as Maturidade

          let abertaEm: number
          let concluidaEm: number | null = null
          let prazo: number
          if (status === 'aprovado' || status === 'depreciado') {
            concluidaEm = t0 - int(status === 'aprovado' ? 10 : 60, status === 'aprovado' ? 400 : 500) * DIA
            abertaEm = concluidaEm - int(15, 50) * DIA
            prazo = abertaEm + PRAZO_QUALIFICACAO_DIAS * DIA
          } else if (status === 'rascunho') {
            abertaEm = t0 - int(3, 62) * DIA
            prazo = abertaEm + PRAZO_QUALIFICACAO_DIAS * DIA
          } else {
            // Reprovada: prazo para corrigir e reavaliar.
            abertaEm = t0 - int(20, 120) * DIA
            concluidaEm = Math.min(t0 - DIA, abertaEm + int(10, 40) * DIA)
            prazo = concluidaEm + 30 * DIA
          }
          const vigente = novaQualificacao({
            ativo,
            analistaId,
            status,
            maturidade,
            versao: VERSAO_FORMULARIO[tipo],
            progresso: status === 'rascunho' ? Math.round((0.15 + r() * 0.75) * 20) / 20 : 1,
            abertaEm,
            prazo,
            concluidaEm,
            vigente: true,
            motivo:
              status === 'reprovado'
                ? pick([
                    'Vulnerabilidade crítica sem plano de correção',
                    'Respostas negativas na seção de autenticação',
                    'Evidência de pentest não apresentada',
                    'Segredos fora do cofre corporativo',
                  ])
                : status === 'depreciado'
                  ? pick(['Substituído por nova versão', 'Desligado em produção', 'Fora do escopo após migração'])
                  : null,
          })

          // ---- Histórico: requalificações anteriores, mais antigas e menos maduras ----
          const nHistorico = chance(0.5) ? int(1, 2) : 0
          let antes = abertaEm
          for (let h = 0; h < nHistorico; h++) {
            const fim = antes - int(5, 40) * DIA
            const inicio = fim - int(20, 60) * DIA
            const aprovadaAntes = chance(0.72)
            const versoes = VERSOES_ANTERIORES[tipo]
            novaQualificacao({
              ativo,
              analistaId: pick(candidatos).id,
              status: aprovadaAntes ? 'aprovado' : 'reprovado',
              maturidade: Math.max(1, maturidade - int(0, 2)) as Maturidade,
              versao: versoes[Math.max(0, versoes.length - 1 - h)],
              progresso: 1,
              abertaEm: inicio,
              prazo: inicio + PRAZO_QUALIFICACAO_DIAS * DIA,
              concluidaEm: fim,
              vigente: false,
              motivo: aprovadaAntes ? null : 'Pendências não resolvidas no prazo',
            })
            antes = inicio - int(200, 330) * DIA
          }

          // ---- Vulnerabilidades (registradas na qualificação vigente) ----
          const lambda = { reprovado: 4.5, rascunho: 2.2, aprovado: 0.9, depreciado: 0.6 }[status]
          // Sorteio sem repetição: o mesmo achado não aparece duas vezes no ativo.
          const modelos = embaralhar(VULNERABILIDADES[tipo])
          const n = Math.min(modelos.length, poisson(lambda * (exposicao === 'internet' ? 1.3 : 1)))
          let temAceite = false
          for (let v = 0; v < n; v++) {
            const modelo = modelos[v]
            const pAberta = status === 'aprovado' ? 0.3 : status === 'depreciado' ? 0.35 : 0.65
            let vs: StatusVulnerabilidade = chance(pAberta) ? (chance(0.45) ? 'em_correcao' : 'aberta') : chance(0.15) ? 'risco_aceito' : 'corrigida'
            // Achados abertos tendem a ser recentes; os antigos já foram tratados.
            const sla = SLA_DIAS[modelo.severidade]
            const aberta = t0 - (vs === 'aberta' || vs === 'em_correcao' ? int(1, Math.round(sla * 1.3)) : int(20, 320)) * DIA
            // Qualificação aprovada não convive com crítica aberta sem aceite de risco.
            if (status === 'aprovado' && modelo.severidade === 'critica' && (vs === 'aberta' || vs === 'em_correcao')) vs = chance(0.5) ? 'risco_aceito' : 'corrigida'
            vulnerabilidades.push({
              id: `vul-${pad(seqVuln)}`,
              codigo: `VUL-${pad(seqVuln++)}`,
              ativoId: ativo.id,
              qualificacaoId: vigente.id,
              titulo: modelo.titulo,
              cwe: modelo.cwe,
              cvss: faixaCvss(modelo.severidade, r()),
              severidade: modelo.severidade,
              status: vs,
              origem: modelo.origem,
              abertaEm: iso(aberta),
              prazo: iso(aberta + sla * DIA),
              corrigidaEm: vs === 'corrigida' ? iso(Math.min(t0, aberta + int(1, sla + 30) * DIA)) : null,
            })
            // Risco aceito exige o termo assinado anexado à qualificação.
            if (vs === 'risco_aceito' && !temAceite) {
              novoDocumento(vigente, ativo, 'aceite_risco', aberta + int(1, 10) * DIA)
              temAceite = true
            }
          }

          // ---- Pendências da qualificação vigente ----
          const qtdPend = status === 'rascunho' ? int(1, 4) : status === 'reprovado' ? int(2, 5) : status === 'aprovado' && chance(0.18) ? 1 : 0
          for (let p = 0; p < qtdPend; p++) {
            const concluida = status === 'aprovado' ? chance(0.4) : chance(0.2)
            pendencias.push({
              id: `pen-${pad(seqPend)}`,
              codigo: `PEN-${pad(seqPend++)}`,
              qualificacaoId: vigente.id,
              ativoId: ativo.id,
              descricao: status === 'aprovado' ? 'Agendar reteste após correção' : pick(PENDENCIAS_MODELO),
              responsavel: chance(0.65) ? `Squad ${projeto.squad}` : analistas.find((a) => a.id === analistaId)!.nome,
              prazo: iso(t0 + int(-18, 40) * DIA),
              status: concluida ? 'concluida' : 'aberta',
            })
          }
        }
      }
    }
  })

  return { geradoEm: agora.toISOString(), areas, analistas, projetos, ativos, qualificacoes, documentos, vulnerabilidades, pendencias }
}

function faixaCvss(sev: Severidade, t: number): number {
  const [min, max] = { critica: [9, 10], alta: [7, 8.9], media: [4, 6.9], baixa: [1.5, 3.9] }[sev]
  return Math.round((min + t * (max - min)) * 10) / 10
}
