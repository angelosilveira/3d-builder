import type { Room, RoomKind } from '../types'
import { uid } from './id'

/**
 * Extrai cômodos do texto de uma planta baixa. Plantas exportadas de CAD
 * normalmente trazem rótulos como:
 *   "SALA 4,00 x 3,50"   "QUARTO 01 - 3.20X3.00"   "COZINHA A=9,60m²"
 * Reconhecemos dimensões (L x P) e, na falta delas, a área (m²) — nesse caso
 * assumimos um cômodo levemente retangular com a mesma área.
 */

const KIND_KEYWORDS: [RegExp, RoomKind][] = [
  [/\b(su[ií]te|quarto|dormit[oó]rio|dorm)\b/i, 'quarto'],
  [/\b(sala|estar|jantar|living)\b/i, 'sala'],
  [/\b(cozinha|copa)\b/i, 'cozinha'],
  [/\b(banheiro|wc|lavabo|bwc|banho|sanit[aá]rio)\b/i, 'banheiro'],
  [/\b(servi[cç]o|lavanderia|a\.?\s?s\.?)\b/i, 'area_servico'],
  [/\b(garagem|abrigo)\b/i, 'garagem'],
  [/\b(varanda|sacada|terra[cç]o|alpendre)\b/i, 'varanda'],
  [/\b(escrit[oó]rio|home office)\b/i, 'escritorio'],
  [/\b(circula[cç][aã]o|corredor|hall)\b/i, 'circulacao'],
]

const NAME = String.raw`([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ./ ]{1,28}?(?:\s*\d{1,2})?)`
const NUM = String.raw`(\d{1,2}(?:[.,]\d{1,2})?)`
// Separador não atravessa quebras de linha (cada linha é um rótulo).
const SEP = String.raw`[ \t]*[:\-–=]?[ \t]*`

const DIM_RE = new RegExp(`${NAME}${SEP}${NUM}[ \\t]*m?[ \\t]*[xX×*][ \\t]*${NUM}[ \\t]*m?\\b`, 'g')
const AREA_RE = new RegExp(`${NAME}${SEP}(?:a[ \\t]*=[ \\t]*|área[ \\t]*[:=]?[ \\t]*)?${NUM}[ \\t]*m(?:²|2)`, 'gi')

const toNumber = (s: string) => Number(s.replace(',', '.'))

export function guessRoomKind(name: string): RoomKind {
  for (const [re, kind] of KIND_KEYWORDS) if (re.test(name)) return kind
  return 'outro'
}

function cleanName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').replace(/[\s\-–:=]+$/, '').trim()
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

export function parsePlantText(text: string): Room[] {
  const rooms: Room[] = []
  const seen = new Set<string>()
  const normalized = text.replace(/ /g, ' ')

  const push = (rawName: string, width: number, depth: number) => {
    const name = cleanName(rawName)
    const kind = guessRoomKind(name)
    // Descarta ruídos: textos sem palavra-chave de cômodo ou medidas absurdas.
    if (kind === 'outro' || width < 0.8 || depth < 0.8 || width > 30 || depth > 30) return
    const key = `${name}|${width}|${depth}`
    if (seen.has(key)) return
    seen.add(key)
    rooms.push({ id: uid('r_'), name, kind, width, depth, progress: 0 })
  }

  for (const m of normalized.matchAll(DIM_RE)) push(m[1], toNumber(m[2]), toNumber(m[3]))

  const namesWithDims = new Set(rooms.map((r) => r.name))
  for (const m of normalized.matchAll(AREA_RE)) {
    const name = cleanName(m[1])
    if (namesWithDims.has(name)) continue
    const area = toNumber(m[2])
    if (!(area > 0)) continue
    const width = Math.round(Math.sqrt(area * 1.25) * 100) / 100
    const depth = Math.round((area / width) * 100) / 100
    push(m[1], width, depth)
  }

  return rooms
}

export interface TextItem {
  str: string
  x: number
  /** Coordenada Y do PDF (cresce para cima). */
  y: number
}

/** Texto que é só uma medida: "4,00 x 3,50", "A=9,60m²", "12 m2". */
const MEASURE_ONLY = /^\s*(?:a\s*=\s*|área\s*[:=]?\s*)?\d{1,2}(?:[.,]\d{1,2})?\s*(?:m?\s*[xX×*]\s*\d{1,2}(?:[.,]\d{1,2})?\s*m?|m(?:²|2))\s*$/i

/**
 * Em plantas de CAD o nome do cômodo e a medida costumam ser textos
 * separados, um abaixo do outro. Pareamos cada nome com a medida mais
 * próxima logo abaixo (ou na mesma linha) e devolvemos um texto com um
 * rótulo por linha, pronto para o parsePlantText.
 */
export function textFromItems(items: TextItem[], maxDistance = 45): string {
  const clean = items.map((it) => ({ ...it, str: it.str.trim() })).filter((it) => it.str)
  const measures = clean.filter((it) => MEASURE_ONLY.test(it.str))
  const names = clean.filter((it) => !MEASURE_ONLY.test(it.str) && guessRoomKind(it.str) !== 'outro')
  const used = new Set<TextItem>()
  const lines: string[] = []

  for (const name of names) {
    let best: TextItem | undefined
    let bestScore = Infinity
    for (const m of measures) {
      if (used.has(m)) continue
      const dy = name.y - m.y // positivo = medida abaixo do nome
      const dx = Math.abs(name.x - m.x)
      if (dy < -2 || dy > maxDistance || dx > maxDistance * 2) continue
      const score = dx + Math.abs(dy) * 1.5
      if (score < bestScore) {
        bestScore = score
        best = m
      }
    }
    if (best) {
      used.add(best)
      lines.push(`${name.str} ${best.str}`)
    } else {
      lines.push(name.str)
    }
  }
  // Textos que já trazem nome + medida juntos, e o restante, um por linha.
  for (const it of clean) if (!names.includes(it) && !used.has(it)) lines.push(it.str)
  return lines.join('\n')
}
