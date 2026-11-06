import { avancoFisico, semanaParaData } from './schedule'
import type {
  Alerta,
  Concretagem,
  ElementoEstrutural,
  Equipamento,
  Equipe,
  Material,
  Obra,
  ObraData,
  Pavimento,
  Rompimento,
} from './types'

/**
 * Gera dados realistas e internamente consistentes a partir de poucos
 * parâmetros por obra. Tudo deriva do mesmo cronograma: pavimentos →
 * elementos → concretagens → caminhões → equipes → KPIs. Trocar por API =
 * trocar `carregarObras()` no store por um fetch que devolva `ObraData`.
 */

export interface ConfigObra {
  id: string
  codigo: string
  nome: string
  endereco: string
  pavimentos: number
  semanaAtual: number
  planta: Obra['planta']
  /** Semanas por pavimento: previsto e real. */
  ritmoEstrutura: { previsto: number; real: number }
  ritmoAlvenaria: { previsto: number; real: number; duracaoPrevista: number; inicioPrevisto: number; inicioReal: number }
  diasSemAcidente: number
  /** Elemento com rompimento abaixo do fck (gera NC). */
  naoConformidade?: { pavimento: number; pilar: number; mpa28: number }
}

export const OBRAS_CONFIG: ConfigObra[] = [
  {
    id: 'ob-01',
    codigo: 'OB-01',
    nome: 'Residencial Ipê',
    endereco: 'Rua das Paineiras, 410 — Jardim Botânico',
    pavimentos: 8,
    semanaAtual: 28,
    planta: { largura: 18, profundidade: 12, peDireito: 3, colunas: 4, linhas: 3 },
    ritmoEstrutura: { previsto: 3.5, real: 3.5 },
    ritmoAlvenaria: { previsto: 3.5, real: 5.2, duracaoPrevista: 4, inicioPrevisto: 15, inicioReal: 15 },
    diasSemAcidente: 214,
    naoConformidade: { pavimento: 2, pilar: 7, mpa28: 26.4 },
  },
  {
    id: 'ob-02',
    codigo: 'OB-02',
    nome: 'Edifício Aroeira',
    endereco: 'Av. Brasil, 1.920 — Centro',
    pavimentos: 12,
    semanaAtual: 16.65,
    planta: { largura: 24, profundidade: 12, peDireito: 3, colunas: 5, linhas: 3 },
    ritmoEstrutura: { previsto: 3, real: 3.2 },
    ritmoAlvenaria: { previsto: 3, real: 3.4, duracaoPrevista: 3.5, inicioPrevisto: 15, inicioReal: 16 },
    diasSemAcidente: 87,
  },
  {
    id: 'ob-03',
    codigo: 'OB-03',
    nome: 'Residencial Jatobá',
    endereco: 'Rua Ipiranga, 77 — Vila Nova',
    pavimentos: 6,
    semanaAtual: 27.14,
    planta: { largura: 18, profundidade: 12, peDireito: 2.9, colunas: 4, linhas: 3 },
    ritmoEstrutura: { previsto: 3.4, real: 3.3 },
    ritmoAlvenaria: { previsto: 3.6, real: 3.8, duracaoPrevista: 4, inicioPrevisto: 14, inicioReal: 14 },
    diasSemAcidente: 402,
    naoConformidade: { pavimento: 4, pilar: 3, mpa28: 31.2 },
  },
]

const INICIO_ESTRUTURA = 8
const VOLUME_CAMINHAO = 8
const FCK_PILAR = 35
const FCK_LAJE = 30

/** PRNG determinístico (mulberry32) para variações estáveis entre recargas. */
function rng(seed: string) {
  let h = 1779033703
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10
const minutosAtras = (agora: Date, min: number) => new Date(agora.getTime() - min * 60000).toISOString()
const diasDepois = (agora: Date, dias: number) => new Date(agora.getTime() + dias * 86400000).toISOString()
const pad = (n: number, w = 3) => String(n).padStart(w, '0')

function execucao(inicio: number, ritmo: number, hoje: number) {
  if (inicio >= hoje) return { inicio: null, fim: null, progresso: 0 }
  const fim = inicio + ritmo
  if (fim <= hoje) return { inicio, fim, progresso: 1 }
  return { inicio, fim: null, progresso: (hoje - inicio) / ritmo }
}

export function volumeLaje(planta: Obra['planta']) {
  const laje = planta.largura * planta.profundidade * 0.15
  const vigas = (planta.linhas * planta.largura + planta.colunas * planta.profundidade) * 0.15 * 0.4
  return round1(laje + vigas)
}

export function criarObraMock(cfg: ConfigObra, agora: Date): ObraData {
  const rand = rng(cfg.id)
  const hoje = cfg.semanaAtual
  const inicio = new Date(agora.getTime() - hoje * 7 * 86400000).toISOString()

  const obra: Obra = {
    id: cfg.id,
    codigo: cfg.codigo,
    nome: cfg.nome,
    endereco: cfg.endereco,
    responsavelTecnico: 'Eng. Marina Duarte · CREA-SP 5063412',
    mestreDeObras: 'Valdir Souza',
    art: `ART 2826${pad(Math.floor(rand() * 999999), 6)}`,
    inicio,
    semanaAtual: hoje,
    duracaoSemanas: Math.ceil(
      cfg.ritmoAlvenaria.inicioPrevisto + (cfg.pavimentos - 1) * cfg.ritmoAlvenaria.previsto + cfg.ritmoAlvenaria.duracaoPrevista + 10,
    ),
    pesoFundacao: 0.15,
    semanasFundacao: INICIO_ESTRUTURA,
    planta: cfg.planta,
  }
  const dataSemana = (s: number) => semanaParaData(obra, s).toISOString()

  // ---------- Pavimentos ----------
  const pavimentos: Pavimento[] = Array.from({ length: cfg.pavimentos }, (_, i) => {
    const prevE = INICIO_ESTRUTURA + i * cfg.ritmoEstrutura.previsto
    const realE = INICIO_ESTRUTURA + i * cfg.ritmoEstrutura.real
    const prevA = cfg.ritmoAlvenaria.inicioPrevisto + i * cfg.ritmoAlvenaria.previsto
    const realA = cfg.ritmoAlvenaria.inicioReal + i * cfg.ritmoAlvenaria.real
    return {
      id: `${cfg.id}-pav-${i + 1}`,
      numero: i + 1,
      nome: `${i + 1}º pavimento`,
      estrutura: {
        previsto: { inicio: prevE, fim: prevE + cfg.ritmoEstrutura.previsto },
        executado: execucao(realE, cfg.ritmoEstrutura.real, hoje),
      },
      alvenaria: {
        previsto: { inicio: prevA, fim: prevA + cfg.ritmoAlvenaria.duracaoPrevista },
        executado: execucao(realA, cfg.ritmoAlvenaria.real, hoje),
      },
    }
  })

  const atual = pavimentos.find((p) => p.estrutura.executado.inicio !== null && p.estrutura.executado.fim === null)
  const numeroAtual = atual?.numero ?? cfg.pavimentos
  const alvenariaAtual = pavimentos.find((p) => p.alvenaria.executado.inicio !== null && p.alvenaria.executado.fim === null)

  // ---------- Elementos e concretagens ----------
  const elementos: ElementoEstrutural[] = []
  const concretagens: Concretagem[] = []
  const nPilares = cfg.planta.colunas * cfg.planta.linhas
  const volLaje = volumeLaje(cfg.planta)
  const volPilar = 0.5
  let seq = 1

  const rompimentos = (fck: number, dataISO: string | null, nc?: number): Rompimento[] => {
    if (!dataISO) return []
    const idade = (agora.getTime() - new Date(dataISO).getTime()) / 86400000
    const r7 = round1(fck * (0.7 + rand() * 0.06))
    const r28 = nc ?? round1(fck * (1.04 + rand() * 0.1))
    return [
      { idadeDias: 7, mpa: idade >= 7 ? r7 : null },
      { idadeDias: 28, mpa: idade >= 28 ? r28 : null },
    ]
  }

  for (const pav of pavimentos) {
    const e = pav.estrutura.executado
    const pilaresProntos = e.inicio !== null && (e.fim !== null || e.progresso >= 0.25)
    const lajePronta = e.fim !== null
    const lajeHoje = pav.numero === numeroAtual && e.inicio !== null && e.fim === null

    const dataPilares = pilaresProntos && e.inicio !== null ? dataSemana(e.inicio + cfg.ritmoEstrutura.real * 0.25) : null
    const dataLaje = lajePronta && e.inicio !== null ? dataSemana(e.inicio + cfg.ritmoEstrutura.real * 0.7) : lajeHoje ? agora.toISOString() : null

    const cPilaresId = `${cfg.id}-c-${pad(seq)}`
    const cPilares: Concretagem = {
      id: cPilaresId,
      codigo: `C-${pad(seq++)}`,
      descricao: `Pilares do ${pav.nome}`,
      elementoIds: [],
      pavimentoNumero: pav.numero,
      fck: FCK_PILAR,
      slumpEspecificadoCm: 12,
      volumeProgramadoM3: round1(nPilares * volPilar),
      volumeLancadoM3: pilaresProntos ? round1(nPilares * volPilar) : 0,
      data: dataPilares ?? dataSemana(pav.estrutura.previsto.inicio + cfg.ritmoEstrutura.previsto * 0.25),
      status: pilaresProntos ? 'concluida' : 'programada',
      etapa: pilaresProntos ? 'cura' : 'saida_usina',
      marcos: {},
      caminhaoIds: [],
    }
    const cLajeId = `${cfg.id}-c-${pad(seq)}`
    const cLaje: Concretagem = {
      id: cLajeId,
      codigo: `C-${pad(seq++)}`,
      descricao: `Vigas e laje L${pav.numero}`,
      elementoIds: [],
      pavimentoNumero: pav.numero,
      fck: FCK_LAJE,
      slumpEspecificadoCm: 10,
      volumeProgramadoM3: volLaje,
      volumeLancadoM3: lajePronta ? volLaje : 0,
      data: dataLaje ?? dataSemana(pav.estrutura.previsto.inicio + cfg.ritmoEstrutura.previsto * 0.7),
      status: lajePronta ? 'concluida' : 'programada',
      etapa: lajePronta ? 'cura' : 'saida_usina',
      marcos: {},
      caminhaoIds: [],
    }

    for (let k = 1; k <= nPilares; k++) {
      const nc = cfg.naoConformidade && cfg.naoConformidade.pavimento === pav.numero && cfg.naoConformidade.pilar === k
      const id = `${pav.id}-P${k}`
      cPilares.elementoIds.push(id)
      elementos.push({
        id,
        codigo: `P${k}`,
        tipo: 'pilar',
        pavimentoId: pav.id,
        pavimentoNumero: pav.numero,
        fck: FCK_PILAR,
        volumeM3: volPilar,
        concretagemId: cPilaresId,
        dataConcretagem: dataPilares,
        rompimentos: rompimentos(FCK_PILAR, dataPilares, nc ? cfg.naoConformidade!.mpa28 : undefined),
        status: nc && cfg.naoConformidade!.mpa28 < FCK_PILAR ? 'nao_conforme' : pilaresProntos ? 'concluido' : e.inicio !== null ? 'em_execucao' : 'planejado',
        indiceMalha: k - 1,
      })
    }
    const lajeId = `${pav.id}-L`
    cLaje.elementoIds.push(lajeId)
    elementos.push({
      id: lajeId,
      codigo: `L${pav.numero}`,
      tipo: 'laje',
      pavimentoId: pav.id,
      pavimentoNumero: pav.numero,
      fck: FCK_LAJE,
      volumeM3: volLaje,
      concretagemId: cLajeId,
      dataConcretagem: dataLaje,
      rompimentos: lajePronta ? rompimentos(FCK_LAJE, dataLaje) : [],
      status: lajePronta ? 'concluido' : lajeHoje ? 'em_execucao' : 'planejado',
    })
    concretagens.push(cPilares, cLaje)
  }

  // ---------- Concretagem de hoje + caminhões ----------
  const hojeC = concretagens.find((c) => c.pavimentoNumero === numeroAtual && c.descricao.startsWith('Vigas'))!
  const entregues = Math.max(1, Math.floor((hojeC.volumeProgramadoM3 * 0.42) / VOLUME_CAMINHAO))
  const descarregadoBT01 = 3.2
  hojeC.status = 'em_andamento'
  hojeC.etapa = 'lancamento'
  hojeC.volumeLancadoM3 = round1(entregues * VOLUME_CAMINHAO + descarregadoBT01)
  hojeC.data = agora.toISOString()
  hojeC.marcos = {
    saida_usina: minutosAtras(agora, 290),
    em_transito: minutosAtras(agora, 286),
    na_obra: minutosAtras(agora, 248),
    lancamento: minutosAtras(agora, 205),
  }
  const volBT03 = Math.max(2, round1(hojeC.volumeProgramadoM3 - (entregues + 2) * VOLUME_CAMINHAO))
  const usina = 'Concreteira Vale Verde · unidade Contorno'
  const nf = (n: number) => `${48 + n}.${pad(Math.floor(rand() * 999))}`

  const caminhoes: Equipamento[] = [
    {
      id: `${cfg.id}-BT-01`,
      codigo: 'BT-01',
      nome: 'Caminhão betoneira 8 m³',
      tipo: 'betoneira',
      status: 'descarregando',
      operador: 'Antônio Ferraz',
      horimetro: 0,
      proximaManutencao: diasDepois(agora, 21),
      utilizacao: descarregadoBT01 / VOLUME_CAMINHAO,
      remessa: {
        placa: 'RTA-4E21',
        usina,
        notaFiscal: nf(1),
        volumeM3: VOLUME_CAMINHAO,
        descarregadoM3: descarregadoBT01,
        slumpCm: 10.5,
        saidaUsina: minutosAtras(agora, 52),
        concretagemId: hojeC.id,
      },
    },
    {
      id: `${cfg.id}-BT-02`,
      codigo: 'BT-02',
      nome: 'Caminhão betoneira 8 m³',
      tipo: 'betoneira',
      status: 'aguardando',
      operador: 'Edson Carvalho',
      horimetro: 0,
      proximaManutencao: diasDepois(agora, 9),
      utilizacao: 0,
      observacao: 'Na fila desde a parada da bomba para desentupimento.',
      remessa: {
        placa: 'QMB-7H05',
        usina,
        notaFiscal: nf(2),
        volumeM3: VOLUME_CAMINHAO,
        descarregadoM3: 0,
        slumpCm: 8.0,
        saidaUsina: minutosAtras(agora, 151),
        concretagemId: hojeC.id,
      },
    },
    {
      id: `${cfg.id}-BT-03`,
      codigo: 'BT-03',
      nome: 'Caminhão betoneira 8 m³',
      tipo: 'betoneira',
      status: 'em_transito',
      operador: 'Luís Antunes',
      horimetro: 0,
      proximaManutencao: diasDepois(agora, 30),
      utilizacao: 0,
      remessa: {
        placa: 'SGF-2C88',
        usina,
        notaFiscal: nf(3),
        volumeM3: volBT03,
        descarregadoM3: 0,
        slumpCm: 10.0,
        saidaUsina: minutosAtras(agora, 24),
        concretagemId: hojeC.id,
      },
    },
  ]
  hojeC.caminhaoIds = caminhoes.map((c) => c.id)

  const equipamentos: Equipamento[] = [
    {
      id: `${cfg.id}-GR-01`,
      codigo: 'GR-01',
      nome: 'Grua de torre · lança 40 m',
      tipo: 'grua',
      status: 'operando',
      operador: 'Josué Lima',
      horimetro: round1(3200 + hoje * 52),
      cargaAtualT: 1.4,
      capacidadeT: 8,
      proximaManutencao: diasDepois(agora, 6),
      utilizacao: 0.68,
    },
    {
      id: `${cfg.id}-BB-01`,
      codigo: 'BB-01',
      nome: 'Bomba de concreto com lança 36 m',
      tipo: 'bomba',
      status: 'operando',
      operador: 'Reinaldo Pires',
      horimetro: round1(1900 + hoje * 11),
      proximaManutencao: diasDepois(agora, 12),
      utilizacao: 0.55,
      observacao: 'Parada das 08h05 às 10h15 para desentupimento da tubulação.',
    },
    ...caminhoes,
    {
      id: `${cfg.id}-EL-01`,
      codigo: 'EL-01',
      nome: 'Elevador de cremalheira',
      tipo: 'elevador',
      status: 'operando',
      operador: 'Cícero Alves',
      horimetro: round1(900 + hoje * 30),
      cargaAtualT: 0.6,
      capacidadeT: 1.5,
      proximaManutencao: diasDepois(agora, 3),
      utilizacao: 0.74,
    },
    {
      id: `${cfg.id}-ES-01`,
      codigo: 'ES-01',
      nome: 'Escavadeira hidráulica 20 t',
      tipo: 'escavadeira',
      status: 'operando',
      operador: 'Wellington Rocha',
      horimetro: round1(6100 + hoje * 18),
      proximaManutencao: diasDepois(agora, 18),
      utilizacao: 0.61,
      observacao: 'Escavação do reservatório inferior.',
    },
    {
      id: `${cfg.id}-RE-01`,
      codigo: 'RE-01',
      nome: 'Retroescavadeira',
      tipo: 'retroescavadeira',
      status: 'parado',
      operador: 'Gilmar Teixeira',
      horimetro: round1(8400 + hoje * 9),
      proximaManutencao: diasDepois(agora, 0),
      utilizacao: 0.12,
      observacao: 'Vazamento no cilindro hidráulico da caçamba. Aguardando mecânico há 3h.',
    },
  ]

  // ---------- Equipes ----------
  const nomeAtual = `${numeroAtual}º pavimento`
  const equipes: Equipe[] = [
    {
      id: `${cfg.id}-EQ-01`,
      codigo: 'EQ-01',
      nome: 'Armação',
      funcao: 'armador',
      encarregado: 'Raimundo Nonato',
      membros: 6,
      local: nomeAtual,
      pavimentoNumero: numeroAtual,
      atividade: `Conferência da armação de vigas e laje L${numeroAtual}`,
      fvs: { codigo: `FVS-ARM-${pad(numeroAtual, 2)}`, status: 'aprovada' },
      progresso: 1,
      zona: 'pavimento_atual',
    },
    {
      id: `${cfg.id}-EQ-02`,
      codigo: 'EQ-02',
      nome: 'Carpintaria',
      funcao: 'carpinteiro',
      encarregado: 'Francisco Moura',
      membros: 5,
      local: nomeAtual,
      pavimentoNumero: numeroAtual,
      atividade: `Acompanhamento das fôrmas durante a concretagem da L${numeroAtual}`,
      fvs: { codigo: `FVS-FOR-${pad(numeroAtual, 2)}`, status: 'aprovada' },
      progresso: 0.9,
      zona: 'pavimento_atual',
    },
    {
      id: `${cfg.id}-EQ-03`,
      codigo: 'EQ-03',
      nome: 'Concretagem',
      funcao: 'pedreiro',
      encarregado: 'Sebastião Prado',
      membros: 6,
      local: `${nomeAtual} · bomba`,
      pavimentoNumero: numeroAtual,
      atividade: `Lançamento e adensamento da L${numeroAtual}`,
      fvs: { codigo: `FVS-CON-${pad(numeroAtual, 2)}`, status: 'em_verificacao' },
      progresso: hojeC.volumeLancadoM3 / hojeC.volumeProgramadoM3,
      zona: 'bomba',
    },
    {
      id: `${cfg.id}-EQ-04`,
      codigo: 'EQ-04',
      nome: 'Alvenaria',
      funcao: 'pedreiro',
      encarregado: 'José Arimatéia',
      membros: 5,
      local: alvenariaAtual ? alvenariaAtual.nome : 'Térreo',
      pavimentoNumero: alvenariaAtual?.numero ?? 0,
      atividade: alvenariaAtual ? `Alvenaria de vedação do ${alvenariaAtual.nome}` : 'Marcação da primeira fiada',
      fvs: { codigo: `FVS-ALV-${pad(alvenariaAtual?.numero ?? 0, 2)}`, status: 'aberta' },
      progresso: alvenariaAtual?.alvenaria.executado.progresso ?? 0.1,
      zona: 'alvenaria',
    },
    {
      id: `${cfg.id}-EQ-05`,
      codigo: 'EQ-05',
      nome: 'Apoio e logística',
      funcao: 'servente',
      encarregado: 'Marcos Vinícius',
      membros: 4,
      local: 'Área de estoque',
      pavimentoNumero: 0,
      atividade: 'Recebimento e movimentação de blocos cerâmicos',
      fvs: { codigo: 'FVS-REC-MAT', status: 'aprovada' },
      progresso: 0.6,
      zona: 'estoque',
    },
    {
      id: `${cfg.id}-EQ-06`,
      codigo: 'EQ-06',
      nome: 'Segurança do trabalho',
      funcao: 'seguranca',
      encarregado: 'Patrícia Gomes',
      membros: 2,
      local: 'Circulação do canteiro',
      pavimentoNumero: 0,
      atividade: 'Inspeção de guarda-corpos e linhas de vida',
      fvs: { codigo: 'CHK-SEG-DIA', status: 'em_verificacao' },
      progresso: 0.45,
      zona: 'circulacao',
    },
  ]

  // ---------- Materiais ----------
  const materiais: Material[] = [
    { id: 'm-cimento', nome: 'Cimento CP II-E-32', unidade: 'sc', quantidade: 420, consumoDiario: 60, status: 'em_estoque' },
    { id: 'm-aco', nome: 'Aço CA-50 Ø10 mm', unidade: 't', quantidade: 3.8, consumoDiario: 0.6, status: 'em_estoque' },
    { id: 'm-bloco', nome: 'Bloco cerâmico 14×19×39', unidade: 'un', quantidade: 1900, consumoDiario: 850, status: 'estoque_baixo' },
    { id: 'm-argamassa', nome: 'Argamassa de assentamento', unidade: 'sc', quantidade: 0, consumoDiario: 40, status: 'em_falta' },
    { id: 'm-areia', nome: 'Areia média lavada', unidade: 'm³', quantidade: 22, consumoDiario: 3, status: 'em_estoque' },
    { id: 'm-desmoldante', nome: 'Desmoldante para fôrmas', unidade: 'L', quantidade: 35, consumoDiario: 12, status: 'estoque_baixo' },
  ]

  // ---------- Alertas fixos (os de tempo de mistura são calculados ao vivo) ----------
  const alertasFixos: Alerta[] = [
    {
      id: `${cfg.id}-al-concretagem`,
      titulo: `Concretagem da L${numeroAtual} atrasada`,
      descricao: 'Lançamento começou 2h10 após o programado: bomba parada para desentupimento.',
      severidade: 'atencao',
      alvoId: hojeC.id,
      tipo: 'concretagem_atrasada',
    },
    {
      id: `${cfg.id}-al-re01`,
      titulo: 'Retroescavadeira RE-01 parada',
      descricao: 'Vazamento hidráulico. Aguardando mecânico há 3h.',
      severidade: 'atencao',
      alvoId: `${cfg.id}-RE-01`,
      tipo: 'equipamento_parado',
    },
  ]
  const nc = elementos.find((el) => el.status === 'nao_conforme')
  if (nc) {
    const r28 = nc.rompimentos.find((r) => r.idadeDias === 28)?.mpa
    alertasFixos.unshift({
      id: `${cfg.id}-al-nc`,
      titulo: `NC-014 aberta · ${nc.codigo} do ${nc.pavimentoNumero}º pavimento`,
      descricao: `Rompimento aos 28 dias: ${String(r28).replace('.', ',')} MPa, abaixo do fck ${nc.fck} MPa. Extração de testemunhos pendente.`,
      severidade: 'critico',
      alvoId: nc.id,
      tipo: 'nc_qualidade',
    })
  }

  const trabalhadores = equipes.reduce((s, e) => s + e.membros, 0) + 5 + 3
  const avancoOntem = avancoFisico({ obra, pavimentos }, hoje - 1 / 7, 'executado')
  return {
    obra,
    pavimentos,
    elementos,
    concretagens,
    equipamentos,
    equipes,
    materiais,
    alertasFixos,
    kpis: { concretoHojeM3: hojeC.volumeLancadoM3, trabalhadores, diasSemAcidente: cfg.diasSemAcidente },
    kpisOntem: {
      concretoHojeM3: 11.5,
      trabalhadores: trabalhadores + 2,
      diasSemAcidente: cfg.diasSemAcidente - 1,
      avancoReal: avancoOntem,
    },
  }
}

export function criarTodasObras(agora = new Date()): Record<string, ObraData> {
  return Object.fromEntries(OBRAS_CONFIG.map((c) => [c.id, criarObraMock(c, agora)]))
}
