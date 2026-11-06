import { useMemo } from 'react'
import { useObraData } from '../data/store'
import type { EtapaConcretagem, Equipamento } from '../data/types'
import { useCanteiroStore } from '../state/canteiroStore'
import { hora, num1 } from './format'

const ETAPAS: { id: EtapaConcretagem; rotulo: string }[] = [
  { id: 'saida_usina', rotulo: 'Saída da usina' },
  { id: 'em_transito', rotulo: 'Em trânsito' },
  { id: 'na_obra', rotulo: 'Na obra' },
  { id: 'lancamento', rotulo: 'Lançamento' },
  { id: 'adensamento', rotulo: 'Adensamento' },
  { id: 'cura', rotulo: 'Cura' },
]

/** Etapa em que um caminhão está, na mesma sequência da concretagem. */
function etapaDoCaminhao(c: Equipamento): EtapaConcretagem {
  switch (c.status) {
    case 'em_transito':
      return 'em_transito'
    case 'aguardando':
      return 'na_obra'
    case 'descarregando':
      return 'lancamento'
    default:
      return 'adensamento'
  }
}

/** Linha do tempo da concretagem em andamento (ou do caminhão selecionado). */
export function TrackingTimeline() {
  const concretagem = useObraData((d) => d.concretagens.find((c) => c.status === 'em_andamento'))
  const selecionadoId = useCanteiroStore((s) => s.selecionadoId)
  const caminhao = useObraData((d) =>
    d.equipamentos.find((e) => e.id === selecionadoId && e.tipo === 'betoneira' && e.remessa?.concretagemId === concretagem?.id),
  )

  const { atual, marcos, titulo } = useMemo(() => {
    if (caminhao?.remessa) {
      return {
        atual: etapaDoCaminhao(caminhao),
        marcos: { saida_usina: caminhao.remessa.saidaUsina } as Partial<Record<EtapaConcretagem, string>>,
        titulo: `${caminhao.codigo} · ${caminhao.remessa.placa}`,
      }
    }
    return { atual: concretagem?.etapa, marcos: concretagem?.marcos ?? {}, titulo: concretagem?.descricao }
  }, [caminhao, concretagem])

  if (!concretagem || !atual) {
    return (
      <section className="cnt-panel cnt-track" aria-label="Rastreamento da concretagem">
        <p className="cnt-eyebrow">Rastreamento</p>
        <p className="cnt-muted">Nenhuma concretagem em andamento hoje.</p>
      </section>
    )
  }
  const idxAtual = ETAPAS.findIndex((e) => e.id === atual)

  return (
    <section className="cnt-panel cnt-track" aria-label="Rastreamento da concretagem em andamento">
      <div className="cnt-track-head">
        <p className="cnt-eyebrow">
          Rastreamento · <span className="cnt-mono">{concretagem.codigo}</span>
        </p>
        <p className="cnt-track-title">{titulo}</p>
        <p className="cnt-mono cnt-muted">
          {num1(concretagem.volumeLancadoM3)} de {num1(concretagem.volumeProgramadoM3)} m³
        </p>
      </div>
      {/* A ordem é uma sequência real do processo: por isso a numeração. */}
      <ol className="cnt-steps">
        {ETAPAS.map((e, i) => {
          const estado = i < idxAtual ? 'done' : i === idxAtual ? 'current' : 'todo'
          const quando = marcos[e.id]
          return (
            <li key={e.id} className={`cnt-step is-${estado}`} aria-current={estado === 'current' ? 'step' : undefined}>
              <span className="cnt-step-n cnt-mono">{i + 1}</span>
              <span className="cnt-step-label">{e.rotulo}</span>
              <span className="cnt-step-time cnt-mono">{quando ? hora(quando) : estado === 'current' ? 'agora' : ''}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
