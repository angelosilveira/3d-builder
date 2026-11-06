interface Props {
  /** 0–1 */
  valor: number
  /** Marca de referência (0–1), ex.: previsto ou limite. */
  marca?: number
  tom?: 'azul' | 'verde' | 'amarelo' | 'vermelho'
  rotulo: string
}

/** Barra de progresso fina com marca opcional (previsto/limite). */
export function Meter({ valor, marca, tom = 'azul', rotulo }: Props) {
  const v = Math.min(1, Math.max(0, valor))
  return (
    <span
      className={`cnt-meter cnt-meter-${tom}`}
      role="meter"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <i style={{ width: `${v * 100}%` }} />
      {marca !== undefined && <b style={{ left: `${Math.min(1, Math.max(0, marca)) * 100}%` }} aria-hidden />}
    </span>
  )
}
