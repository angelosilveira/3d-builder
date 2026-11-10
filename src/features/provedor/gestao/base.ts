/** Data e hora de referência dos dados de demonstração (o "agora" da operação). */
export const HOJE = '2026-11-10'
export const AGORA = Date.parse('2026-11-10T10:30:00-03:00')

const DIA = 86400000
const meioDia = (iso: string) => Date.parse(iso.slice(0, 10) + 'T12:00:00Z')
/** Dias de `a` até `b` (negativo se `b` é anterior). */
export const dias = (a: string, b: string) => Math.round((meioDia(b) - meioDia(a)) / DIA)
export const maisDias = (iso: string, n: number) => new Date(meioDia(iso) + n * DIA).toISOString().slice(0, 10)

export const reais = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
/** Valor compacto para indicadores: R$ 264 mil, R$ 1,2 mi. */
export function reaisCurto(cents: number) {
  const v = cents / 100
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return 'R$ ' + (v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi'
  if (abs >= 10_000) return 'R$ ' + Math.round(v / 1000).toLocaleString('pt-BR') + ' mil'
  return 'R$ ' + Math.round(v).toLocaleString('pt-BR')
}
export const pct = (v: number, casas = 0) => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas }) + '%'
export const dataCurta = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)
export const limitar = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v))
