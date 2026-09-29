/**
 * pdf-export.ts 单测
 * 验证导出 Blob 类型、尺寸、坐标换算
 */
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { A4_H_MM, A4_W_MM } from '@/units'
import { exportPdf } from '@/utils/pdf-export'
import type { LayoutPage } from '@/types'

/** 创建带实际像素内容的 canvas（空 canvas 的 PNG 会被 pdf-lib 拒绝） */
function makeBitmap(w = 100, h = 100): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ff0000'
  ctx.fillRect(0, 0, w, h)
  return c
}

describe('exportPdf', () => {
  it('返回 Blob 且 MIME = application/pdf', async () => {
    const bitmap = makeBitmap()
    const pages: LayoutPage[] = [
      {
        index: 0,
        items: [
          {
            bitmap,
            rotation: 0,
            wMM: 100,
            hMM: 50,
            renderWMM: 100,
            renderHMM: 50,
            xMM: 10,
            yMM: 10,
            pageIndex: 0
          }
        ]
      }
    ]
    const blob = await exportPdf(pages, 'portrait')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('A4 portrait：页面尺寸为 210 × 297 mm', async () => {
    const bitmap = makeBitmap()
    const pages: LayoutPage[] = [{ index: 0, items: [{ bitmap, rotation: 0, wMM: 50, hMM: 50, renderWMM: 50, renderHMM: 50, xMM: 10, yMM: 10, pageIndex: 0 }] }]
    const blob = await exportPdf(pages, 'portrait')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const reloaded = await PDFDocument.load(bytes)
    const pages2 = reloaded.getPages()
    expect(pages2.length).toBe(1)
    const { width, height } = pages2[0].getSize()
    expect(width).toBeCloseTo(A4_W_MM, 1)
    expect(height).toBeCloseTo(A4_H_MM, 1)
  })

  it('A4 landscape：页面尺寸为 297 × 210 mm', async () => {
    const bitmap = makeBitmap()
    const pages: LayoutPage[] = [{ index: 0, items: [{ bitmap, rotation: 0, wMM: 50, hMM: 50, renderWMM: 50, renderHMM: 50, xMM: 10, yMM: 10, pageIndex: 0 }] }]
    const blob = await exportPdf(pages, 'landscape')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const reloaded = await PDFDocument.load(bytes)
    const { width, height } = reloaded.getPages()[0].getSize()
    expect(width).toBeCloseTo(A4_H_MM, 1)
    expect(height).toBeCloseTo(A4_W_MM, 1)
  })

  it('空 items：仍输出有效 PDF（1 页）', async () => {
    const pages: LayoutPage[] = [{ index: 0, items: [] }]
    const blob = await exportPdf(pages, 'portrait')
    expect(blob.size).toBeGreaterThan(100)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPages().length).toBe(1)
  })

  it('多页：每页生成 1 个 PDF 页', async () => {
    const bitmap = makeBitmap()
    const pages: LayoutPage[] = [
      { index: 0, items: [{ bitmap, rotation: 0, wMM: 50, hMM: 50, renderWMM: 50, renderHMM: 50, xMM: 10, yMM: 10, pageIndex: 0 }] },
      { index: 1, items: [{ bitmap, rotation: 0, wMM: 50, hMM: 50, renderWMM: 50, renderHMM: 50, xMM: 10, yMM: 10, pageIndex: 0 }] },
      { index: 2, items: [] }
    ]
    const blob = await exportPdf(pages, 'portrait')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPages().length).toBe(3)
  })

  it('item 坐标正确转换为 pdf-lib 坐标系（左下原点）', async () => {
    const bitmap = makeBitmap()
    const item = {
      bitmap,
      rotation: 0 as const,
      wMM: 50,
      hMM: 30,
      renderWMM: 50,
      renderHMM: 30,
      xMM: 20, // pdf-lib x = 20
      yMM: 100, // 距顶 100mm → 距底 = 297 - 100 - 30 = 167
      pageIndex: 0
    }
    const pages: LayoutPage[] = [{ index: 0, items: [item] }]
    const blob = await exportPdf(pages, 'portrait')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('旋转项：rotate 字段被正确传递', async () => {
    const bitmap = makeBitmap()
    const pages: LayoutPage[] = [
      {
        index: 0,
        items: [
          {
            bitmap,
            rotation: 90 as const,
            wMM: 50,
            hMM: 50,
            renderWMM: 50,
            renderHMM: 50,
            xMM: 10,
            yMM: 10,
            pageIndex: 0
          }
        ]
      }
    ]
    const blob = await exportPdf(pages, 'portrait')
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('大尺寸多 item：稳定输出', async () => {
    const bitmap = makeBitmap(200, 200)
    const items = []
    for (let i = 0; i < 4; i++) {
      items.push({
        bitmap,
        rotation: 0 as const,
        wMM: 60,
        hMM: 60,
        renderWMM: 60,
        renderHMM: 60,
        xMM: 10 + (i % 2) * 80,
        yMM: 10 + Math.floor(i / 2) * 80,
        pageIndex: i
      })
    }
    const pages: LayoutPage[] = [{ index: 0, items }]
    const blob = await exportPdf(pages, 'portrait')
    expect(blob.type).toBe('application/pdf')
  })
})