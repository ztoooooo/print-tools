// PDF 导出：基于 pdf-lib 直接吃 layout() 的 mm 坐标
import { PDFDocument, degrees } from 'pdf-lib'
import { A4_H_MM, A4_W_MM, PRINT_DPI } from '@/units'
import { buildWatermarkCanvas } from '@/utils/canvas-helpers'
import type { LayoutPage, Orientation } from '@/types'

/** 水印覆盖参数（与预览共用同一份配置） */
export interface PdfWatermark {
  text: string
  fontSizeRatio: number
  opacity: number
  color: string
}

export async function exportPdf(
  pages: LayoutPage[],
  orientation: Orientation,
  watermark?: PdfWatermark
): Promise<Blob> {
  const pdf = await PDFDocument.create()
  const [wMM, hMM] = orientation === 'portrait' ? [A4_W_MM, A4_H_MM] : [A4_H_MM, A4_W_MM]

  // 水印：按 PRINT_DPI 生成透明 PNG，整页铺满（pdf-lib 无法直接写中文）
  let wmPng: Awaited<ReturnType<typeof pdf.embedPng>> | null = null
  if (watermark && watermark.text.trim()) {
    const wPx = Math.ceil(wMM * (PRINT_DPI / 25.4))
    const hPx = Math.ceil(hMM * (PRINT_DPI / 25.4))
    const wmCanvas = buildWatermarkCanvas(
      wPx,
      hPx,
      watermark.text,
      watermark.fontSizeRatio,
      watermark.opacity,
      watermark.color
    )
    const wmBlob: Blob = await new Promise((resolve, reject) => {
      wmCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob null'))), 'image/png')
    })
    wmPng = await pdf.embedPng(new Uint8Array(await wmBlob.arrayBuffer()))
  }

  for (const layoutPage of pages) {
    const pdfPage = pdf.addPage([wMM, hMM])
    for (const item of layoutPage.items) {
      const blob: Blob = await new Promise((resolve, reject) => {
        item.bitmap.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob null'))), 'image/png')
      })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const png = await pdf.embedPng(bytes)
      // pdf-lib 原点在左下
      pdfPage.drawImage(png, {
        x: item.xMM,
        y: hMM - item.yMM - item.renderHMM,
        width: item.renderWMM,
        height: item.renderHMM,
        rotate: item.rotation ? degrees(item.rotation) : undefined
      })
    }
    // 水印最后叠加在最上层
    if (wmPng) {
      pdfPage.drawImage(wmPng, { x: 0, y: 0, width: wMM, height: hMM })
    }
  }
  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
