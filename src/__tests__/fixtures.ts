/**
 * 测试 fixture 工具：构造 ParsedPage / ParsedSlot
 */
import type { ParsedPage, ParsedSlot } from '@/types'
import { PRINT_DPI } from '@/units'

/**
 * 构造一个 ParsedPage（默认 400x600 px）。
 * 物理尺寸 = 像素 / PRINT_DPI(300) × 25.4 ≈ 33.87 × 50.80 mm。
 */
export function makePage(
  name: string,
  opts: { width?: number; height?: number; rotation?: 0 | 90 | 180 | 270; size?: number } = {}
): ParsedPage {
  const w = opts.width ?? 400
  const h = opts.height ?? 600
  const bitmap = document.createElement('canvas')
  bitmap.width = w
  bitmap.height = h
  return {
    id: `id-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    name,
    size: opts.size ?? 1024,
    width: w,
    height: h,
    widthMM: (w / PRINT_DPI) * 25.4,
    heightMM: (h / PRINT_DPI) * 25.4,
    bitmap,
    rotation: opts.rotation ?? 0,
    mime: 'jpg'
  }
}

/**
 * 构造一个 ParsedSlot（证件用）
 */
export function makeSlot(
  slot: 0 | 1 | 2 | 3,
  page: ParsedPage | null = null,
  opts: { customW?: number; customH?: number; preset?: ParsedSlot['sizePreset'] } = {}
): ParsedSlot {
  return {
    slot,
    page,
    sizePreset: opts.preset ?? 'id-card',
    customW: opts.customW ?? 85.6,
    customH: opts.customH ?? 53.98,
    edited: false
  }
}