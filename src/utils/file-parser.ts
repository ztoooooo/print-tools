// 文件解析：PDF 拆页 + 图片加载 + 去重 key
import { nanoid } from 'nanoid'
import * as pdfjsLib from 'pdfjs-dist'
// @ts-ignore - pdfjs worker 通过 vite asset 引入
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDF_RASTER_DPI, PRINT_DPI } from '@/units'
import type { ParsedPage } from '@/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export function dedupKey(f: File): string {
  return `${f.name}_${f.size}`
}

async function parsePdf(file: File): Promise<ParsedPage[]> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const out: ParsedPage[] = []
  // pdfjs viewport 以 96 DPI 为基准，scale = 目标 DPI / 96
  const scale = PDF_RASTER_DPI / 96
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    // 物理尺寸：取 scale=1 的视口（96 DPI），换算成 mm
    const baseVp = page.getViewport({ scale: 1 })
    const widthMM = (baseVp.width / 96) * 25.4
    const heightMM = (baseVp.height / 96) * 25.4

    const vp = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(vp.width)
    canvas.height = Math.ceil(vp.height)
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport: vp }).promise
    out.push({
      id: nanoid(),
      name: `${file.name}#${i}`,
      size: file.size,
      width: canvas.width,
      height: canvas.height,
      widthMM,
      heightMM,
      bitmap: canvas,
      rotation: 0,
      mime: 'pdf'
    })
  }
  return out
}

async function parseImage(file: File): Promise<ParsedPage> {
  // 始终保留原始分辨率位图；物理尺寸按 PRINT_DPI 由像素换算
  const img = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    return {
      id: nanoid(),
      name: file.name,
      size: file.size,
      width: canvas.width,
      height: canvas.height,
      widthMM: (canvas.width / PRINT_DPI) * 25.4,
      heightMM: (canvas.height / PRINT_DPI) * 25.4,
      bitmap: canvas,
      rotation: 0,
      mime: file.type.includes('png') ? 'png' : 'jpg'
    }
  } finally {
    img.close?.()
  }
}

/** 统一入口：自动识别类型 */
export async function parseFile(file: File): Promise<ParsedPage[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return parsePdf(file)
  }
  if (
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    file.type.startsWith('image/')
  ) {
    return [await parseImage(file)]
  }
  throw new Error('不支持的文件类型')
}

/** 应用旋转到 bitmap（旋转后替换原图） */
export function applyRotation(page: ParsedPage): HTMLCanvasElement {
  if (page.rotation === 0) return page.bitmap
  const { width, height } = page
  const swap = page.rotation === 90 || page.rotation === 270
  const out = document.createElement('canvas')
  out.width = swap ? height : width
  out.height = swap ? width : height
  const ctx = out.getContext('2d')!
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((page.rotation * Math.PI) / 180)
  ctx.drawImage(page.bitmap, -width / 2, -height / 2)
  page.width = out.width
  page.height = out.height
  // 物理尺寸同步互换
  if (swap) {
    const w = page.widthMM
    page.widthMM = page.heightMM
    page.heightMM = w
  }
  page.bitmap = out
  page.rotation = 0
  return out
}
