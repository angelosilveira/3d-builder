const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export const fmt = (n: number) => number.format(n)
export const fmtMoney = (n: number) => money.format(n)
export const fmtPct = (n: number) => `${Math.round(n)}%`
export const fmtDate = (iso: string) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—'
export const today = () => new Date().toISOString().slice(0, 10)
