const n1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const n0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const nAuto = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export const num1 = (v: number) => n1.format(v)
export const num0 = (v: number) => n0.format(v)
export const num = (v: number) => nAuto.format(v)
export const pct = (v: number) => `${n0.format(v * 100)}%`

export const hora = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
export const horaSeg = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
export const data = (iso: string | Date) => new Date(iso).toLocaleDateString('pt-BR')
export const dataCurta = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
export const mes = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')

export const diasEntre = (de: string | Date, ate: Date) => Math.floor((ate.getTime() - new Date(de).getTime()) / 86400000)

/** Variação com sinal (ex.: +1,5 / −2). Usa o sinal de menos tipográfico. */
export function delta(v: number, casas = 0): string {
  const f = casas ? num1(Math.abs(v)) : num0(Math.abs(v))
  if (Math.abs(v) < (casas ? 0.05 : 0.5)) return '0'
  return `${v > 0 ? '+' : '−'}${f}`
}
