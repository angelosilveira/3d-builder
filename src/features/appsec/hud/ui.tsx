import type { ReactNode } from 'react'
import { MATURIDADE_LABEL, SEVERIDADE_LABEL, STATUS_LABEL, STATUS_PENDENCIA_LABEL, STATUS_VULN_LABEL, TIPO_LABEL } from '../data/catalogo'
import type { Maturidade, Severidade, StatusPendencia, StatusQualificacao, StatusVulnerabilidade, TipoAtivo } from '../data/types'

/** Ícone com a mesma forma usada na cena 3D para cada tipo de ativo. */
export function IconeTipo({ tipo, tamanho = 14 }: { tipo: TipoAtivo; tamanho?: number }) {
  const formas: Record<TipoAtivo, ReactNode> = {
    proxy: <path d="M8 2 14 13H2z" />,
    microservico: <rect x="3" y="3" width="10" height="10" rx="1" />,
    web: <circle cx="8" cy="8" r="5.5" />,
    mobile: <rect x="5.2" y="1.5" width="5.6" height="13" rx="1.2" />,
    desktop: <rect x="1.5" y="4.5" width="13" height="7" rx="1" />,
  }
  return (
    <svg className="aps-icone" viewBox="0 0 16 16" width={tamanho} height={tamanho} aria-hidden fill="currentColor">
      {formas[tipo]}
    </svg>
  )
}

export function TipoRotulo({ tipo }: { tipo: TipoAtivo }) {
  return (
    <span className="aps-tipo">
      <IconeTipo tipo={tipo} /> {TIPO_LABEL[tipo]}
    </span>
  )
}

/** Status do formulário de qualificação (cor = mesma do ativo na cena). */
export function PilulaStatus({ status }: { status: StatusQualificacao }) {
  return (
    <span className={`aps-pill aps-st-${status}`}>
      <i aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function PilulaSeveridade({ severidade }: { severidade: Severidade }) {
  return <span className={`aps-sev aps-sev-${severidade}`}>{SEVERIDADE_LABEL[severidade]}</span>
}

const TOM_VULN: Record<StatusVulnerabilidade, string> = { aberta: 'alerta', em_correcao: 'info', risco_aceito: 'neutro', corrigida: 'ok' }

export function PilulaVuln({ status, vencida }: { status: StatusVulnerabilidade; vencida?: boolean }) {
  return (
    <span className={`aps-pill aps-tom-${vencida ? 'ruim' : TOM_VULN[status]}`}>
      <i aria-hidden />
      {vencida ? 'Fora do SLA' : STATUS_VULN_LABEL[status]}
    </span>
  )
}

export function PilulaPendencia({ status, vencida }: { status: StatusPendencia; vencida: boolean }) {
  return (
    <span className={`aps-pill aps-tom-${status === 'concluida' ? 'ok' : vencida ? 'ruim' : 'alerta'}`}>
      <i aria-hidden />
      {status === 'aberta' && vencida ? 'Vencida' : STATUS_PENDENCIA_LABEL[status]}
    </span>
  )
}

/** Barra empilhada (ex.: ativos por status). */
export function BarraEmpilhada({ partes, rotulo }: { partes: { chave: string; valor: number; classe: string; titulo: string }[]; rotulo: string }) {
  const total = partes.reduce((s, p) => s + p.valor, 0) || 1
  return (
    <span className="aps-stack" role="img" aria-label={`${rotulo}: ${partes.map((p) => `${p.titulo} ${p.valor}`).join(', ')}`}>
      {partes.map((p) =>
        p.valor > 0 ? <i key={p.chave} className={p.classe} style={{ flexGrow: p.valor / total }} title={`${p.titulo}: ${p.valor}`} /> : null,
      )}
    </span>
  )
}

export function Medidor({ valor, rotulo, tom = 'info' }: { valor: number; rotulo: string; tom?: 'info' | 'ok' | 'ruim' | 'alerta' }) {
  const v = Math.min(1, Math.max(0, valor))
  return (
    <span className={`aps-meter aps-meter-${tom}`} role="meter" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <i style={{ width: `${v * 100}%` }} />
    </span>
  )
}

export const STATUS_PARTES = (contagem: Record<StatusQualificacao, number>) =>
  (['aprovado', 'rascunho', 'reprovado', 'depreciado'] as StatusQualificacao[]).map((s) => ({
    chave: s,
    valor: contagem[s],
    classe: `aps-bg-${s}`,
    titulo: STATUS_LABEL[s],
  }))

/** Maturidade como 5 degraus crescentes (mesma ideia da altura no mapa). */
export function NivelMaturidade({ nivel, comRotulo = true }: { nivel: Maturidade; comRotulo?: boolean }) {
  return (
    <span className="aps-mat" role="img" aria-label={`Maturidade ${nivel} de 5: ${MATURIDADE_LABEL[nivel]}`}>
      <span className="aps-mat-degraus" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <i key={n} className={n <= nivel ? 'is-on' : undefined} style={{ height: `${4 + n * 2.4}px` }} />
        ))}
      </span>
      {comRotulo && (
        <span className="aps-mat-txt">
          {nivel} · {MATURIDADE_LABEL[nivel]}
        </span>
      )}
    </span>
  )
}
