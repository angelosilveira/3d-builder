import {
  ANALISTAS_BASE,
  AREAS_BASE,
  PENDENCIAS_MODELO,
  PREFIXO,
  SLA_DIAS,
  SQUADS,
  SUFIXOS_MS,
  TECNOLOGIAS,
  TIPOS,
  VERSAO_FORMULARIO,
  VULNERABILIDADES,
} from './catalogo'
import type {
  AppSecData,
  Analista,
  Area,
  Ativo,
  Criticidade,
  Pendencia,
  Projeto,
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

          // Status da qualificação: legado desktop tende a ser depreciado.
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

          const exposicao = tipo === 'microservico' ? (chance(0.08) ? 'internet' : 'interna') : tipo === 'desktop' ? 'interna' : 'internet'
          const criticidade: Criticidade = ['PG', 'CR'].includes(area.sigla) ? (chance(0.6) ? 'alta' : 'media') : pick(['alta', 'media', 'media', 'baixa'] as const)
          const aprovadoEm = status === 'aprovado' || status === 'depreciado' ? t0 - int(10, 420) * DIA : null
          const candidatos = analistasDoTipo(tipo)
          const ativo: Ativo = {
            id: `atv-${pad(seqAtivo)}`,
            codigo: `ATV-${pad(seqAtivo++)}`,
            nome,
            tipo,
            projetoId: projeto.id,
            areaId: area.id,
            analistaId: candidatos[(seqAtivo + k) % candidatos.length].id,
            tecnologia: pick(TECNOLOGIAS[tipo]),
            exposicao,
            criticidade,
            qualificacao: {
              status,
              versaoFormulario: VERSAO_FORMULARIO[tipo],
              progresso: status === 'rascunho' ? Math.round((0.15 + r() * 0.75) * 20) / 20 : 1,
              atualizadoEm: iso(t0 - int(0, 60) * DIA - int(0, 86400) * 1000),
              aprovadoEm: aprovadoEm !== null ? iso(aprovadoEm) : null,
              validadeAte: status === 'aprovado' && aprovadoEm !== null ? iso(aprovadoEm + 365 * DIA) : null,
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
            },
          }
          ativos.push(ativo)

          // ---- Vulnerabilidades ----
          const lambda = { reprovado: 4.5, rascunho: 2.2, aprovado: 0.9, depreciado: 0.6 }[status]
          // Sorteio sem repetição: o mesmo achado não aparece duas vezes no ativo.
          const modelos = embaralhar(VULNERABILIDADES[tipo])
          const n = Math.min(modelos.length, poisson(lambda * (exposicao === 'internet' ? 1.3 : 1)))
          for (let v = 0; v < n; v++) {
            const modelo = modelos[v]
            const pAberta = status === 'aprovado' ? 0.3 : status === 'depreciado' ? 0.35 : 0.65
            let vs: StatusVulnerabilidade = chance(pAberta) ? (chance(0.45) ? 'em_correcao' : 'aberta') : chance(0.15) ? 'risco_aceito' : 'corrigida'
            // Achados abertos tendem a ser recentes; os antigos já foram tratados.
            const sla = SLA_DIAS[modelo.severidade]
            const abertaEm = t0 - (vs === 'aberta' || vs === 'em_correcao' ? int(1, Math.round(sla * 1.3)) : int(20, 320)) * DIA
            const prazo = abertaEm + sla * DIA
            // Ativo aprovado não convive com crítica aberta sem aceite de risco.
            if (status === 'aprovado' && modelo.severidade === 'critica' && (vs === 'aberta' || vs === 'em_correcao')) vs = chance(0.5) ? 'risco_aceito' : 'corrigida'
            const cvss = faixaCvss(modelo.severidade, r())
            vulnerabilidades.push({
              id: `vul-${pad(seqVuln)}`,
              codigo: `VUL-${pad(seqVuln++)}`,
              ativoId: ativo.id,
              titulo: modelo.titulo,
              cwe: modelo.cwe,
              cvss,
              severidade: modelo.severidade,
              status: vs,
              origem: modelo.origem,
              abertaEm: iso(abertaEm),
              prazo: iso(prazo),
              corrigidaEm: vs === 'corrigida' ? iso(Math.min(t0, abertaEm + int(1, SLA_DIAS[modelo.severidade] + 30) * DIA)) : null,
            })
          }

          // ---- Pendências da qualificação ----
          const qtdPend = status === 'rascunho' ? int(1, 4) : status === 'reprovado' ? int(2, 5) : status === 'aprovado' && chance(0.18) ? 1 : 0
          for (let p = 0; p < qtdPend; p++) {
            const concluida = status === 'aprovado' ? chance(0.4) : chance(0.2)
            pendencias.push({
              id: `pen-${pad(seqPend)}`,
              codigo: `PEN-${pad(seqPend++)}`,
              ativoId: ativo.id,
              descricao: status === 'aprovado' ? 'Agendar reteste após correção' : pick(PENDENCIAS_MODELO),
              responsavel: chance(0.65) ? `Squad ${projeto.squad}` : analistas.find((a) => a.id === ativo.analistaId)!.nome,
              prazo: iso(t0 + int(-18, 40) * DIA),
              status: concluida ? 'concluida' : 'aberta',
            })
          }
        }
      }
    }
  })

  return { geradoEm: agora.toISOString(), areas, analistas, projetos, ativos, vulnerabilidades, pendencias }
}

function faixaCvss(sev: Severidade, t: number): number {
  const [min, max] = { critica: [9, 10], alta: [7, 8.9], media: [4, 6.9], baixa: [1.5, 3.9] }[sev]
  return Math.round((min + t * (max - min)) * 10) / 10
}
