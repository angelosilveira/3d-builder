interface Props {
  value: number
  /** Marcação do progresso planejado (0–100). */
  planned?: number
  color?: string
  size?: 'sm' | 'md'
}

export function ProgressBar({ value, planned, color, size = 'md' }: Props) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <div className={`progress progress-${size}`} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ width: `${v}%`, background: color }} />
      {planned !== undefined && (
        <div className="progress-planned" style={{ left: `${Math.min(100, planned)}%` }} title={`Planejado: ${Math.round(planned)}%`} />
      )}
    </div>
  )
}
