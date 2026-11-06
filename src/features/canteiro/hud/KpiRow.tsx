import { useMemo, type ReactNode } from 'react'
import { avancoFisico } from '../data/schedule'
import { useObraData } from '../data/store'
import { delta, num0, num1, pct } from './format'

interface KpiProps {
  rotulo: string
  valor: ReactNode
  unidade?: string
  variacao: string
  /** Se a variação é boa, ruim ou neutra para quem lê. */
  sentido: 'bom' | 'ruim' | 'neutro'
  complemento?: ReactNode
}

function Kpi({ rotulo, valor, unidade, variacao, sentido, complemento }: KpiProps) {
  return (
    <li className="cnt-kpi cnt-panel">
      <p className="cnt-kpi-label">{rotulo}</p>
      <p className="cnt-kpi-value">
        <span className="cnt-display">{valor}</span>
        {unidade && <span className="cnt-kpi-unit">{unidade}</span>}
      </p>
      <p className="cnt-kpi-foot">
        <span className={`cnt-delta cnt-delta-${sentido}`}>{variacao}</span>
        <span className="cnt-muted"> vs ontem</span>
        {complemento}
      </p>
    </li>
  )
}

export function KpiRow() {
  const obra = useObraData((d) => d.obra)
  const pavimentos = useObraData((d) => d.pavimentos)
  const kpis = useObraData((d) => d.kpis)
  const ontem = useObraData((d) => d.kpisOntem)

  const avanco = useMemo(() => {
    const dados = { obra, pavimentos }
    return {
      real: avancoFisico(dados, obra.semanaAtual, 'executado'),
      previsto: avancoFisico(dados, obra.semanaAtual, 'previsto'),
    }
  }, [obra, pavimentos])
  const pp = (avanco.real - ontem.avancoReal) * 100
  const atrasado = avanco.real < avanco.previsto - 0.02

  return (
    <ul className="cnt-kpis" aria-label="Indicadores da obra hoje">
      <Kpi
        rotulo="Avanço físico"
        valor={num0(avanco.real * 100)}
        unidade="%"
        variacao={`${delta(pp, 1)} p.p.`}
        sentido={pp > 0 ? 'bom' : 'neutro'}
        complemento={
          <span className={`cnt-kpi-prev${atrasado ? ' is-bad' : ''}`}>
            previsto {pct(avanco.previsto)}
          </span>
        }
      />
      <Kpi
        rotulo="Concreto lançado hoje"
        valor={num1(kpis.concretoHojeM3)}
        unidade="m³"
        variacao={`${delta(kpis.concretoHojeM3 - ontem.concretoHojeM3, 1)} m³`}
        sentido="neutro"
      />
      <Kpi
        rotulo="Trabalhadores no canteiro"
        valor={kpis.trabalhadores}
        variacao={delta(kpis.trabalhadores - ontem.trabalhadores)}
        sentido="neutro"
      />
      <Kpi rotulo="Dias sem acidente" valor={kpis.diasSemAcidente} variacao={delta(kpis.diasSemAcidente - ontem.diasSemAcidente)} sentido="bom" />
    </ul>
  )
}
