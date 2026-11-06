import { parsePlantText, textFromItems, type TextItem } from './plantParser'
import type { Room } from '../types'

export interface PdfImportResult {
  rooms: Room[]
  text: string
  pages: number
  /** Miniatura da 1ª página (data URL) para conferência visual. */
  preview?: string
}

/**
 * Lê um PDF de planta no navegador (pdf.js), extrai o texto de todas as
 * páginas e tenta identificar cômodos e medidas. O pdf.js é carregado sob
 * demanda para não pesar o bundle inicial.
 */
export async function importPlantPdf(file: File): Promise<PdfImportResult> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const chunks: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const items: TextItem[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      // Usa o centro horizontal do texto para parear nome ↔ medida.
      items.push({ str: item.str, x: item.transform[4] + item.width / 2, y: item.transform[5] })
    }
    chunks.push(textFromItems(items))
  }

  let preview: string | undefined
  try {
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const scale = 480 / viewport.width
    const scaled = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = scaled.width
    canvas.height = scaled.height
    await page.render({ canvas, viewport: scaled }).promise
    preview = canvas.toDataURL('image/png')
  } catch {
    preview = undefined
  }

  const text = chunks.join('\n')
  return { rooms: parsePlantText(text), text, pages: doc.numPages, preview }
}
