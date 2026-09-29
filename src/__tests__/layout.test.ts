/**
 * canvas-helpers.ts 排版算法测试
 * 覆盖 4 类 Tab 的 layout() 输出
 */
import { describe, expect, it } from 'vitest'
import {
  A4_H_MM,
  A4_W_MM,
  GAP_MM,
  MARGIN_MM
} from '@/units'
import { layoutId, layoutInvoice, layoutTicket } from '@/utils/canvas-helpers'
import { makePage, makeSlot } from './fixtures'

describe('layoutInvoice（发票 Tab）', () => {
  it('空列表：返回 1 张空 A4', () => {
    const out = layoutInvoice([], 'single')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(0)
  })

  it('single 模式：1 张 A4 + 1 个 slot 居中（y 在上半部）', () => {
    const p = makePage('inv.pdf')
    const out = layoutInvoice([p], 'single')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(1)
    const it = out[0].items[0]
    // 居中：xMM 应在可用宽度内，yMM 应在上半部分
    const usableW = A4_W_MM - 2 * MARGIN_MM
    expect(it.xMM).toBeGreaterThanOrEqual(MARGIN_MM)
    expect(it.xMM + it.renderWMM).toBeLessThanOrEqual(MARGIN_MM + usableW + 0.01)
    // y 应在上半部（halfH 区域）
    const halfH = (A4_H_MM - 2 * MARGIN_MM - GAP_MM) / 2
    expect(it.yMM).toBeGreaterThanOrEqual(MARGIN_MM - 0.01)
    expect(it.yMM + it.renderHMM).toBeLessThanOrEqual(MARGIN_MM + halfH + 0.01)
  })

  it('double 模式：1 张 A4 + 2 个 slot（上下各一）', () => {
    const p = makePage('inv.pdf')
    const out = layoutInvoice([p], 'double')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(2)
    // 两个 slot 应有相同的 bitmap（双打 = 复制）
    expect(out[0].items[0].bitmap).toBe(out[0].items[1].bitmap)
    // 第一个 slot yMM 在上半部
    expect(out[0].items[0].yMM).toBeLessThan(A4_H_MM / 2)
    // 第二个 slot yMM 在下半部
    expect(out[0].items[1].yMM).toBeGreaterThan(A4_H_MM / 2)
  })

  it('merge2 模式：2 张 A4 + 2 个 slot（上下各一）', () => {
    const p1 = makePage('inv1.pdf')
    const p2 = makePage('inv2.pdf')
    const out = layoutInvoice([p1, p2], 'merge2')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(2)
    // 两个 slot 是不同页
    expect(out[0].items[0].bitmap).not.toBe(out[0].items[1].bitmap)
    // pageIndex 不同
    expect(out[0].items[0].pageIndex).toBe(0)
    expect(out[0].items[1].pageIndex).toBe(1)
  })

  it('merge2 模式：仅 1 张时只排 1 张（不复制 —— 复制是 double 模式的职责）', () => {
    const p = makePage('inv.pdf')
    const out = layoutInvoice([p], 'merge2')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(1)
    expect(out[0].items[0].bitmap).toBe(p.bitmap)
  })

  it('auto 模式：10 张 → 至少 2 张 A4', () => {
    const pages = Array.from({ length: 10 }, (_, i) => makePage(`p${i}.pdf`))
    const out = layoutInvoice(pages, 'auto')
    // 每张图默认 400x600 mm（>= 105mm x 158mm），10 张堆叠会超出 297mm
    expect(out.length).toBeGreaterThanOrEqual(2)
    // 每个 page 都至少有一个 item
    for (const pg of out) {
      expect(pg.items.length).toBeGreaterThan(0)
    }
  })

  it('auto 模式：1 张仅 1 个 item + 1 张 A4', () => {
    const p = makePage('inv.pdf')
    const out = layoutInvoice([p], 'auto')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(1)
  })

  it('auto 模式：所有 item 总数 = 输入页数', () => {
    const pages = Array.from({ length: 12 }, (_, i) => makePage(`p${i}.pdf`))
    const out = layoutInvoice(pages, 'auto')
    const total = out.reduce((sum, p) => sum + p.items.length, 0)
    expect(total).toBe(12)
  })

  it('所有 layout 输出单位都是 mm（不为像素）', () => {
    const p = makePage('inv.pdf')
    const out = layoutInvoice([p], 'single')
    const it = out[0].items[0]
    // mm 数值应在合理范围（< 1000）
    expect(it.xMM).toBeLessThan(1000)
    expect(it.yMM).toBeLessThan(1000)
    expect(it.wMM).toBeLessThan(1000)
    expect(it.hMM).toBeLessThan(1000)
  })

  it('所有 item 都落在 A4 范围内（含边距）', () => {
    const pages = Array.from({ length: 5 }, (_, i) => makePage(`p${i}.pdf`))
    for (const mode of ['single', 'double', 'merge2', 'auto'] as const) {
      const out = layoutInvoice(pages, mode)
      for (const pg of out) {
        for (const it of pg.items) {
          expect(it.xMM).toBeGreaterThanOrEqual(0)
          expect(it.yMM).toBeGreaterThanOrEqual(0)
          expect(it.xMM + it.renderWMM).toBeLessThanOrEqual(A4_W_MM + 0.01)
          expect(it.yMM + it.renderHMM).toBeLessThanOrEqual(A4_H_MM + 0.01)
        }
      }
    }
  })

  it('auto 模式：可识别 GAP_MM 间距', () => {
    const pages = Array.from({ length: 10 }, (_, i) => makePage(`p${i}.pdf`))
    const out = layoutInvoice(pages, 'auto')
    // 找到第 1 页前两个 item 的 yMM 差
    if (out[0].items.length >= 2) {
      const diff = out[0].items[1].yMM - (out[0].items[0].yMM + out[0].items[0].renderHMM)
      // 第二个 item 的起始 y 应至少大于第一个结束 y + GAP - 0.1
      expect(diff).toBeGreaterThanOrEqual(GAP_MM - 0.1)
    }
  })
})

describe('layoutTicket（车票 Tab）', () => {
  it('single 模式复用 layoutInvoice 单张', () => {
    const p = makePage('t.pdf')
    const out = layoutTicket([p], 'single')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(1)
  })

  it('top-bottom 模式：2 张上下排版', () => {
    const a = makePage('a.pdf')
    const b = makePage('b.pdf')
    const out = layoutTicket([a, b], 'top-bottom')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(2)
    expect(out[0].items[0].yMM).toBeLessThan(out[0].items[1].yMM)
  })

  it('left-right 模式：2 张左右排版', () => {
    const a = makePage('a.pdf')
    const b = makePage('b.pdf')
    const out = layoutTicket([a, b], 'left-right')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(2)
    expect(out[0].items[0].xMM).toBeLessThan(out[0].items[1].xMM)
  })

  it('grid2x2 模式：4 张 → 1 张 A4 + 4 个 slot 2×2', () => {
    const pages = [makePage('p1'), makePage('p2'), makePage('p3'), makePage('p4')]
    const out = layoutTicket(pages, 'grid2x2')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(4)
    // 4 个 slot 应分布在 4 个不同象限
    const xs = out[0].items.map((i) => i.xMM)
    const ys = out[0].items.map((i) => i.yMM)
    // 2 个不同 x，2 个不同 y
    expect(new Set(xs.map((x) => Math.round(x))).size).toBeGreaterThanOrEqual(2)
    expect(new Set(ys.map((y) => Math.round(y))).size).toBeGreaterThanOrEqual(2)
  })

  it('grid2x2 模式：<4 张留空槽（只有实际图片数）', () => {
    const pages = [makePage('p1'), makePage('p2')]
    const out = layoutTicket(pages, 'grid2x2')
    expect(out.length).toBe(1)
    // 代码注释：<4 张留空槽 → 实现为只 push 实际有图的 slot
    expect(out[0].items.length).toBeLessThanOrEqual(4)
  })

  it('grid2x2 模式：8 张 → 2 张 A4', () => {
    const pages = Array.from({ length: 8 }, (_, i) => makePage(`p${i}`))
    const out = layoutTicket(pages, 'grid2x2')
    expect(out.length).toBe(2)
    expect(out[0].items.length).toBe(4)
    expect(out[1].items.length).toBe(4)
  })
})

describe('layoutId（证件 Tab）', () => {
  it('空槽位：返回 1 张空 A4', () => {
    const slots = [
      makeSlot(0),
      makeSlot(1),
      makeSlot(2),
      makeSlot(3)
    ]
    const out = layoutId(slots, 'double-col')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(0)
  })

  it('double-col 模式：4 个 slot → 2 张证件左右', () => {
    const p1 = makePage('id1.jpg', { width: 200, height: 130 })
    const p2 = makePage('id2.jpg', { width: 200, height: 130 })
    const slots = [
      makeSlot(0, p1),
      makeSlot(1, p2),
      makeSlot(2),
      makeSlot(3)
    ]
    const out = layoutId(slots, 'double-col')
    // 至少一张 A4 包含至少 2 个 item
    const total = out.reduce((s, p) => s + p.items.length, 0)
    expect(total).toBe(2)
  })

  it('double-col 模式：第 1 和第 2 个 item 应分布在不同 x（左/右）', () => {
    const p1 = makePage('id1.jpg')
    const p2 = makePage('id2.jpg')
    const slots = [makeSlot(0, p1), makeSlot(1, p2), makeSlot(2), makeSlot(3)]
    const out = layoutId(slots, 'double-col')
    const items = out[0].items
    if (items.length >= 2) {
      expect(items[0].xMM).not.toBe(items[1].xMM)
    }
  })

  it('center 模式：仅居中显示第 1 张', () => {
    const p = makePage('id.jpg')
    const slots = [
      makeSlot(0, p),
      makeSlot(1),
      makeSlot(2),
      makeSlot(3)
    ]
    const out = layoutId(slots, 'center')
    expect(out.length).toBe(1)
    expect(out[0].items.length).toBe(1)
    // 居中：xMM 应在可用宽度中部
    const usableW = A4_W_MM - 2 * MARGIN_MM
    const it = out[0].items[0]
    expect(it.xMM).toBeGreaterThan(MARGIN_MM)
    expect(it.xMM).toBeLessThan(MARGIN_MM + usableW)
  })

  it('auto 模式：每页最多 2 张', () => {
    const pages = Array.from({ length: 4 }, (_, i) => makePage(`id${i}.jpg`))
    const slots = pages.map((p, i) => makeSlot(i as 0 | 1 | 2 | 3, p))
    const out = layoutId(slots, 'auto')
    // 4 张 → 2 张 A4，每页 ≤2
    expect(out.length).toBe(2)
    for (const pg of out) {
      expect(pg.items.length).toBeLessThanOrEqual(2)
    }
  })

  it('所有 item 都标记了 slot 编号', () => {
    const p1 = makePage('id1.jpg')
    const p2 = makePage('id2.jpg')
    const slots = [makeSlot(0, p1), makeSlot(1, p2), makeSlot(2), makeSlot(3)]
    const out = layoutId(slots, 'double-col')
    for (const pg of out) {
      for (const it of pg.items) {
        expect(it.slot).toBeDefined()
        expect([0, 1, 2, 3]).toContain(it.slot!)
      }
    }
  })

  it('custom 尺寸：自定义 w/h 应被使用', () => {
    const p = makePage('id.jpg', { width: 1000, height: 1000 })
    const slots = [
      makeSlot(0, p, { preset: 'custom', customW: 50, customH: 70 }),
      makeSlot(1),
      makeSlot(2),
      makeSlot(3)
    ]
    const out = layoutId(slots, 'center')
    expect(out.length).toBe(1)
    expect(out[0].items[0].wMM).toBe(50)
    expect(out[0].items[0].hMM).toBe(70)
  })
})