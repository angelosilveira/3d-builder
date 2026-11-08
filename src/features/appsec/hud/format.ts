const n0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const n1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const num = (v: number) => n0.format(v)
export const num1 = (v: number) => n1.format(v)
export const pct = (v: number) => `${n0.format(v * 100)}%`
export const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
export const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const DIA = 86400000
/** Dias até o prazo (negativo = vencido há N dias). */
export const diasAte = (iso: string, agora: number) => Math.round((new Date(iso).getTime() - agora) / DIA)

/** "vence em 3 dias", "vence hoje", "vencida há 12 dias". */
export function textoPrazo(iso: string, agora: number): string {
  const d = diasAte(iso, agora)
  if (d === 0) return 'vence hoje'
  if (d > 0) return `vence em ${d} ${d === 1 ? 'dia' : 'dias'}`
  return `vencida há ${-d} ${d === -1 ? 'dia' : 'dias'}`
}
