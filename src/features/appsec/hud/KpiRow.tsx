import { useMemo, type ReactNode } from 'react'
import { calcularKpis, filtrosAtivos } from '../data/derived'
import { useAppSecData } from '../data/store'
import { useAppSecUi } from '../state/uiStore'
import { useMascara } from '../state/useMascara'
import { num, pct } from './format'

function Kpi({ rotulo, valor, nota, tom }: { rotulo: string; valor: ReactNode; nota: ReactNode; tom?: 'ruim' | 'alerta' | 'ok' }) {
  return (
    <li className={`aps-kpi aps-panel${tom ? ` aps-kpi-${tom}` : ''}`}>
      <p className="aps-kpi-rotulo">{rotulo}</p>
      <p className="aps-kpi-valor aps-display">{valor}</p>
      <p className="aps-kpi-nota">{nota}</p>
    </li>
  )
}

export function KpiRow() {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  const filtros = useAppSecUi((s) => s.filtros)
  const mascara = useMascara()
  const filtrado = filtrosAtivos(filtros) > 0
  const k = useMemo(() => calcularKpis(data, indice, filtrado ? mascara : undefined), [data, indice, mascara, filtrado])

  return (
    <ul className="aps-kpis" aria-label={filtrado ? 'Indicadores dos ativos filtrados' : 'Indicadores de todos os ativos'}>
      <Kpi rotulo="Aprovados" valor={pct(k.aprovadosPct)} nota={`dos ${num(k.ativos)} ativos${filtrado ? ' no filtro' : ''} · ${num(k.requalificacaoVencida)} a requalificar`} tom="ok" />
      <Kpi rotulo="Rascunhos" valor={num(k.rascunhos)} nota={`formulários em edição · ${num(k.reprovados)} reprovados`} />
      <Kpi rotulo="Críticas abertas" valor={num(k.criticasAbertas)} nota={`vulnerabilidades · +${num(k.criticasNovasSemana)} em 7 dias`} tom="ruim" />
      <Kpi rotulo="Fora do SLA" valor={num(k.vulnsVencidas)} nota="vulnerabilidades abertas além do prazo" tom="ruim" />
      <Kpi rotulo="Pendências vencidas" valor={num(k.pendenciasVencidas)} nota={`${num(k.pendenciasVencendo7d)} vencem em 7 dias`} tom="alerta" />
    </ul>
  )
}
