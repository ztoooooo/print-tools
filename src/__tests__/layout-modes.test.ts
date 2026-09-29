/**
 * 排版模式专项回归测试 —— 针对本次修复的问题
 *
 * 修复点：
 *  1. 证件预设尺寸此前走「图片像素 / 2」，导致 1:1 物理尺寸完全失效 → 改为严格取 ID_PRESETS
 *  2. 身份证尺寸与 PRD 不符（85.6×53.98 → 89.5×57.9）
 *  3. 户口簿尺寸不准（130×90 → 143×105 公安部内页规格）
 *  4. 物理尺寸不再由像素反推 RENDER_SCALE，直接取 ParsedPage.widthMM/heightMM
 *  5. layoutId.double-col 存在未完成的空 if 分支 + rowH 逻辑不自洽
 *  6. layoutId.center 只显示第 1 张
 *  7. layoutInvoice.merge2 单张时被复制成 2 份（与 double 模式职责重叠）
 */
import { describe, expect, it } from 'vitest'
import { A4_H_MM, A4_W_MM, GAP_MM, ID_PRESETS, MARGIN_MM, PRINT_DPI } from '@/units'
import { layoutId, layoutInvoice, layoutTicket } from '@/utils/canvas-helpers'
import { makePage, makeSlot } from './fixtures'

/** 像素 → mm（按 PRINT_DPI） */
const pxToMm = (px: number) => (px / PRINT_DPI) * 25.4

const usableW = A4_W_MM - 2 * MARGIN_MM
const usableH = A4_H_MM - 2 * MARGIN_MM

function slotList(pages: ReturnType<typeof makePage>[], preset?: 'id-card' | 'bank-card' | 'household') {
  const arr = [0, 1, 2, 3].map((i) => {
    const p = pages[i] ?? null
    const s = makeSlot(i as 0 | 1 | 2 | 3, p)
    if (preset) s.sizePreset = preset
    return s
  })
  return arr
}

/** 断言所有 item 都在纸张可用区内 */
function assertNoOverflow(pages: { items: Array<{ xMM: number; yMM: number; renderWMM: number; renderHMM: number }> }[]) {
  for (const pg of pages) {
    for (const it of pg.items) {
      expect(it.xMM).toBeGreaterThanOrEqual(0)
      expect(it.yMM).toBeGreaterThanOrEqual(0)
      expect(it.xMM + it.renderWMM).toBeLessThanOrEqual(A4_W_MM + 0.01)
      expect(it.yMM + it.renderHMM).toBeLessThanOrEqual(A4_H_MM + 0.01)
    }
  }
}

describe('【修复验证】证件严格 1:1 物理尺寸', () => {
  it('身份证：无论图片多大，渲染尺寸恒 = 89.5 × 57.9 mm', () => {
    for (const size of [
      { width: 300, height: 200 },
      { width: 3000, height: 2000 },
      { width: 120, height: 400 }
    ]) {
      const p = makePage('id.jpg', size)
      const out = layoutId(slotList([p], 'id-card'), 'center')
      const it0 = out[0].items[0]
      expect(it0.wMM).toBeCloseTo(ID_PRESETS['id-card'].w, 6)
      expect(it0.hMM).toBeCloseTo(ID_PRESETS['id-card'].h, 6)
      expect(it0.renderWMM).toBeCloseTo(89.5, 6)
      expect(it0.renderHMM).toBeCloseTo(57.9, 6)
    }
  })

  it('银行卡：渲染尺寸 = 85.6 × 53.98 mm', () => {
    const p = makePage('card.jpg', { width: 999, height: 999 })
    const out = layoutId(slotList([p], 'bank-card'), 'center')
    const it0 = out[0].items[0]
    expect(it0.wMM).toBeCloseTo(85.6, 6)
    expect(it0.hMM).toBeCloseTo(53.98, 6)
  })

  it('户口簿：渲染尺寸 = 143 × 105 mm', () => {
    const p = makePage('hk.jpg', { width: 500, height: 500 })
    const out = layoutId(slotList([p], 'household'), 'center')
    const it0 = out[0].items[0]
    expect(it0.wMM).toBeCloseTo(143, 6)
    expect(it0.hMM).toBeCloseTo(105, 6)
  })

  it('自定义尺寸：严格使用输入的 mm 值', () => {
    const p = makePage('id.jpg', { width: 2000, height: 1000 })
    const slots = slotList([p])
    slots[0].sizePreset = 'custom'
    slots[0].customW = 66.6
    slots[0].customH = 44.4
    const out = layoutId(slots, 'center')
    expect(out[0].items[0].wMM).toBe(66.6)
    expect(out[0].items[0].hMM).toBe(44.4)
  })

  it('超限保护：300×300mm 自定义尺寸不会溢出 A4，且保持等比', () => {
    const p = makePage('id.jpg', { width: 1000, height: 1000 })
    const slots = slotList([p])
    slots[0].sizePreset = 'custom'
    slots[0].customW = 300
    slots[0].customH = 300
    const out = layoutId(slots, 'center')
    const it0 = out[0].items[0]
    expect(it0.renderWMM).toBeLessThanOrEqual(usableW + 0.01)
    expect(it0.renderHMM).toBeLessThanOrEqual(usableH + 0.01)
    // 正方形 → 缩小后仍是正方形
    expect(it0.renderWMM).toBeCloseTo(it0.renderHMM, 6)
    assertNoOverflow(out)
  })
})

describe('【修复验证】物理尺寸直接取 ParsedPage 的 mm（不反推像素）', () => {
  it('票据物理尺寸 = 像素按 PRINT_DPI 换算的 mm', () => {
    const p = makePage('inv.pdf', { width: 800, height: 400 })
    const out = layoutInvoice([p], 'single')
    const it0 = out[0].items[0]
    expect(it0.wMM).toBeCloseTo(pxToMm(800), 6)
    expect(it0.hMM).toBeCloseTo(pxToMm(400), 6)
  })

  it('旋转 90° 后 w/h 互换', () => {
    const p = makePage('inv.pdf', { width: 800, height: 400, rotation: 90 })
    const out = layoutInvoice([p], 'single')
    const it0 = out[0].items[0]
    expect(it0.wMM).toBeCloseTo(pxToMm(400), 6)
    expect(it0.hMM).toBeCloseTo(pxToMm(800), 6)
  })

  it('旋转 180° 不改变 w/h', () => {
    const p = makePage('inv.pdf', { width: 800, height: 400, rotation: 180 })
    const out = layoutInvoice([p], 'single')
    const it0 = out[0].items[0]
    expect(it0.wMM).toBeCloseTo(pxToMm(800), 6)
    expect(it0.hMM).toBeCloseTo(pxToMm(400), 6)
  })
})

describe('【修复验证】证件 4 种排版模式', () => {
  it('double-col：4 张 → 1 页 2 行 × 2 列，x/y 各 2 个不同值', () => {
    const pages = Array.from({ length: 4 }, (_, i) => makePage(`id${i}.jpg`))
    const out = layoutId(slotList(pages, 'id-card'), 'double-col')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(4)
    const xs = out[0].items.map((i) => Math.round(i.xMM))
    const ys = out[0].items.map((i) => Math.round(i.yMM))
    expect(new Set(xs).size).toBe(2)
    expect(new Set(ys).size).toBe(2)
    assertNoOverflow(out)
  })

  it('double-col：每行 2 张并排，左列 x = MARGIN', () => {
    const pages = Array.from({ length: 2 }, (_, i) => makePage(`id${i}.jpg`))
    const out = layoutId(slotList(pages, 'id-card'), 'double-col')
    expect(out[0].items[0].xMM).toBeGreaterThanOrEqual(MARGIN_MM)
    expect(out[0].items[1].xMM).toBeGreaterThan(out[0].items[0].xMM)
  })

  it('double-row：4 张 → 2 页，每页 2 张上下', () => {
    const pages = Array.from({ length: 4 }, (_, i) => makePage(`id${i}.jpg`))
    const out = layoutId(slotList(pages, 'id-card'), 'double-row')
    expect(out.length).toBe(2)
    expect(out[0].items.length).toBe(2)
    expect(out[1].items.length).toBe(2)
    // 每页内上下
    expect(out[0].items[0].yMM).toBeLessThan(out[0].items[1].yMM)
    assertNoOverflow(out)
  })

  it('center：多张上下居中排列（不再只显示第 1 张）', () => {
    const pages = Array.from({ length: 3 }, (_, i) => makePage(`id${i}.jpg`))
    const out = layoutId(slotList(pages, 'id-card'), 'center')
    const total = out.reduce((s, p) => s + p.items.length, 0)
    expect(total).toBe(3)
    // 第一页内多张上下排列
    expect(out[0].items.length).toBeGreaterThan(1)
    expect(out[0].items[0].yMM).toBeLessThan(out[0].items[1].yMM)
  })

  it('center：单张时垂直居中', () => {
    const p = makePage('id.jpg')
    const out = layoutId(slotList([p], 'id-card'), 'center')
    const it0 = out[0].items[0]
    const expectedY = MARGIN_MM + (usableH - ID_PRESETS['id-card'].h) / 2
    expect(it0.yMM).toBeCloseTo(expectedY, 3)
  })

  it('auto：4 张 → 2 页，每页最多 2 张', () => {
    const pages = Array.from({ length: 4 }, (_, i) => makePage(`id${i}.jpg`))
    const out = layoutId(slotList(pages, 'id-card'), 'auto')
    expect(out.length).toBe(2)
    for (const pg of out) {
      expect(pg.items.length).toBeLessThanOrEqual(2)
    }
    assertNoOverflow(out)
  })

  it('所有模式的 item 均不溢出 A4', () => {
    const pages = Array.from({ length: 4 }, (_, i) => makePage(`id${i}.jpg`))
    for (const mode of ['double-col', 'double-row', 'center', 'auto'] as const) {
      assertNoOverflow(layoutId(slotList(pages, 'id-card'), mode))
    }
  })
})

describe('【修复验证】发票 merge2 语义', () => {
  it('2 张 → 上下各一张，pageIndex 0/1', () => {
    const out = layoutInvoice([makePage('a.pdf'), makePage('b.pdf')], 'merge2')
    expect(out[0].items.length).toBe(2)
    expect(out[0].items[0].pageIndex).toBe(0)
    expect(out[0].items[1].pageIndex).toBe(1)
  })

  it('1 张 → 只排 1 张（不再复制）', () => {
    const out = layoutInvoice([makePage('a.pdf')], 'merge2')
    expect(out[0].items.length).toBe(1)
  })
})

describe('【修复验证】车票排版 + 自动分页', () => {
  it('top-bottom：2 张 → 1 页上下', () => {
    const out = layoutTicket([makePage('a'), makePage('b')], 'top-bottom')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(2)
    expect(out[0].items[0].yMM).toBeLessThan(out[0].items[1].yMM)
  })

  it('left-right：2 张 → 1 页左右', () => {
    const out = layoutTicket([makePage('a'), makePage('b')], 'left-right')
    expect(out.length).toBe(1)
    expect(out[0].items[0].xMM).toBeLessThan(out[0].items[1].xMM)
  })

  it('grid2x2：8 张 → 2 页，每页 4 张 2×2', () => {
    const pages = Array.from({ length: 8 }, (_, i) => makePage(`t${i}`))
    const out = layoutTicket(pages, 'grid2x2')
    expect(out.length).toBe(2)
    expect(out[0].items.length).toBe(4)
    expect(out[1].items.length).toBe(4)
    assertNoOverflow(out)
  })

  it('grid2x2：2 张 → 只排 2 张，不产生空 item', () => {
    const out = layoutTicket([makePage('a'), makePage('b')], 'grid2x2')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(2)
  })

  it('auto（发票）12 张 → 全部落位，无丢失', () => {
    const pages = Array.from({ length: 12 }, (_, i) => makePage(`p${i}`))
    const out = layoutInvoice(pages, 'auto')
    const total = out.reduce((s, p) => s + p.items.length, 0)
    expect(total).toBe(12)
    assertNoOverflow(out)
  })

  it('merge2：5 张 → 3 页（2+2+1），无数据丢失', () => {
    const pages = Array.from({ length: 5 }, (_, i) => makePage(`inv${i}.pdf`))
    const out = layoutInvoice(pages, 'merge2')
    expect(out.length).toBe(3)
    expect(out.map((p) => p.items.length)).toEqual([2, 2, 1])
    expect(out.reduce((s, p) => s + p.items.length, 0)).toBe(5)
    assertNoOverflow(out)
  })

  it('车票 top-bottom：5 张 → 3 页（2+2+1），无数据丢失', () => {
    const pages = Array.from({ length: 5 }, (_, i) => makePage(`t${i}.pdf`))
    const out = layoutTicket(pages, 'top-bottom')
    expect(out.length).toBe(3)
    expect(out.reduce((s, p) => s + p.items.length, 0)).toBe(5)
    assertNoOverflow(out)
  })

  it('车票 left-right：5 张 → 3 页（2+2+1），无数据丢失', () => {
    const pages = Array.from({ length: 5 }, (_, i) => makePage(`t${i}.pdf`))
    const out = layoutTicket(pages, 'left-right')
    expect(out.length).toBe(3)
    expect(out.reduce((s, p) => s + p.items.length, 0)).toBe(5)
    assertNoOverflow(out)
  })

  it('相邻元素间距不小于 GAP_MM', () => {
    const pages = Array.from({ length: 6 }, (_, i) => makePage(`p${i}`))
    const out = layoutInvoice(pages, 'auto')
    const items = out[0].items
    if (items.length >= 2) {
      const gap = items[1].yMM - (items[0].yMM + items[0].renderHMM)
      expect(gap).toBeGreaterThan(GAP_MM - 0.01)
    }
  })
})

/**
 * 回归：单张居中 / 双打 此前硬编码 pages[0] 且恒定返回 1 页，
 * 多文件时后续票据被静默丢弃（预览/打印/导出都看不到）。
 */
describe('【修复验证】单张居中 / 双打 逐张分页', () => {
  it('single：5 张 → 5 页，每页 1 张，全部落位', () => {
    const pages = Array.from({ length: 5 }, (_, i) => makePage(`inv${i}.pdf`))
    const out = layoutInvoice(pages, 'single')
    expect(out.length).toBe(5)
    expect(out.every((p) => p.items.length === 1)).toBe(true)
    // 顺序与页码一一对应
    out.forEach((pg, i) => {
      expect(pg.index).toBe(i)
      expect(pg.items[0].pageIndex).toBe(i)
      expect(pg.items[0].bitmap).toBe(pages[i].bitmap)
    })
    assertNoOverflow(out)
  })

  it('single：单张时仍只 1 页（不凭空产生空页）', () => {
    const out = layoutInvoice([makePage('a.pdf')], 'single')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(1)
  })

  it('double：5 张 → 5 页，每页同一张上下复制两份', () => {
    const pages = Array.from({ length: 5 }, (_, i) => makePage(`inv${i}.pdf`))
    const out = layoutInvoice(pages, 'double')
    expect(out.length).toBe(5)
    out.forEach((pg, i) => {
      expect(pg.items.length).toBe(2)
      // 同一页内两份来自同一张原图
      expect(pg.items[0].bitmap).toBe(pages[i].bitmap)
      expect(pg.items[1].bitmap).toBe(pages[i].bitmap)
      // 上、下位置
      expect(pg.items[0].yMM).toBeLessThan(pg.items[1].yMM)
    })
    assertNoOverflow(out)
  })

  it('车票 single 复用发票逻辑：5 张 → 5 页', () => {
    const pages = Array.from({ length: 5 }, (_, i) => makePage(`t${i}.pdf`))
    expect(layoutTicket(pages, 'single').length).toBe(5)
  })
})

/**
 * 回归：排版层此前忽略纸张方向，横向时仍按 210×297 计算可用区，
 * 导致内容溢出到纸张外（预览被截断、导出 PDF 也只有左半幅）。
 */
describe('【修复验证】纸张方向参与排版计算', () => {
  const LAND_W = A4_H_MM // 横向宽 = 297
  const LAND_H = A4_W_MM // 横向高 = 210
  const landUsableW = LAND_W - 2 * MARGIN_MM
  const landUsableH = LAND_H - 2 * MARGIN_MM

  function assertInLandscape(
    pagesArr: Array<{ items: Array<{ xMM: number; yMM: number; renderWMM: number; renderHMM: number }> }>
  ) {
    for (const pg of pagesArr) {
      for (const it of pg.items) {
        expect(it.xMM).toBeGreaterThanOrEqual(0)
        expect(it.yMM).toBeGreaterThanOrEqual(0)
        expect(it.xMM + it.renderWMM).toBeLessThanOrEqual(LAND_W + 0.01)
        expect(it.yMM + it.renderHMM).toBeLessThanOrEqual(LAND_H + 0.01)
      }
    }
  }

  it('横向：single / double / merge2 / auto 均不溢出 297×210', () => {
    const pages = Array.from({ length: 6 }, (_, i) => makePage(`inv${i}.pdf`))
    for (const mode of ['single', 'double', 'merge2', 'auto'] as const) {
      assertInLandscape(layoutInvoice(pages, mode, 'landscape'))
    }
  })

  it('横向：车票 / 证件 各模式均不溢出 297×210', () => {
    const pages = Array.from({ length: 6 }, (_, i) => makePage(`t${i}.pdf`))
    for (const mode of ['single', 'top-bottom', 'left-right', 'grid2x2'] as const) {
      assertInLandscape(layoutTicket(pages, mode, 'landscape'))
    }
    const idPages = Array.from({ length: 4 }, (_, i) => makePage(`id${i}.jpg`))
    for (const mode of ['double-col', 'double-row', 'center', 'auto'] as const) {
      assertInLandscape(layoutId(slotList(idPages, 'id-card'), mode, 'landscape'))
    }
  })

  it('横向：左右两联使用更宽的可用区（横向 > 纵向）', () => {
    const a = makePage('a.pdf')
    const b = makePage('b.pdf')
    const portrait = layoutTicket([a, b], 'left-right', 'portrait')[0]
    const landscape = layoutTicket([a, b], 'left-right', 'landscape')[0]
    const portraitGap = portrait.items[1].xMM - portrait.items[0].xMM
    const landscapeGap = landscape.items[1].xMM - landscape.items[0].xMM
    expect(landscapeGap).toBeGreaterThan(portraitGap)
  })

  it('横向：2×2 网格的单元格按 297×210 计算', () => {
    const pages = Array.from({ length: 4 }, (_, i) => makePage(`t${i}.pdf`))
    const cellW = (landUsableW - GAP_MM) / 2
    const cellH = (landUsableH - GAP_MM) / 2
    const out = layoutTicket(pages, 'grid2x2', 'landscape')
    // 第 4 张（右下角）的起点应落在右半 / 下半
    const last = out[0].items[3]
    expect(last.xMM).toBeGreaterThan(MARGIN_MM + cellW)
    expect(last.yMM).toBeGreaterThan(MARGIN_MM + cellH)
  })

  it('未传方向时默认纵向（向后兼容）', () => {
    const p = makePage('a.pdf')
    expect(layoutInvoice([p], 'single')).toEqual(layoutInvoice([p], 'single', 'portrait'))
  })
})
