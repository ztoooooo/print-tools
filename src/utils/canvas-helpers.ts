// 画布绘制、水印、灰度、localStorage 封装、Toast 封装
import { ElMessage, ElMessageBox } from 'element-plus'

// ============ localStorage 封装（仅 string/number/boolean/array/object） ============

export function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function storageSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 配额溢出等场景静默忽略
  }
}

// ============ Toast 封装（保持组件层与 ElementPlus 解耦） ============

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export function toast(msg: string, type: ToastType = 'info') {
  ElMessage({ message: msg, type, duration: 2500 })
}

/** 只读提示（单按钮） */
export async function confirm(msg: string, title = '提示'): Promise<void> {
  await ElMessageBox.alert(msg, title, { confirmButtonText: '知道了' })
}

/** 二次确认（确定 / 取消），返回 true 表示用户点了确定 */
export async function confirmAction(
  msg: string,
  title = '确认操作',
  confirmText = '确定'
): Promise<boolean> {
  try {
    await ElMessageBox.confirm(msg, title, {
      confirmButtonText: confirmText,
      cancelButtonText: '取消',
      type: 'warning'
    })
    return true
  } catch {
    return false
  }
}

// ============ 绘制单张票据 ============

/** 在 ctx 上绘制一张 ParsedPage 到 (x, y, w, h) 矩形（像素坐标） */
export function drawPage(
  ctx: CanvasRenderingContext2D,
  bitmap: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: 0 | 90 | 180 | 270 = 0
) {
  ctx.save()
  if (rotation === 0) {
    ctx.drawImage(bitmap, x, y, w, h)
  } else {
    // 旋转中心 = 矩形中心
    const cx = x + w / 2
    const cy = y + h / 2
    ctx.translate(cx, cy)
    ctx.rotate((rotation * Math.PI) / 180)
    if (rotation === 90 || rotation === 270) {
      ctx.drawImage(bitmap, -h / 2, -w / 2, h, w)
    } else {
      ctx.drawImage(bitmap, -w / 2, -h / 2, w, h)
    }
  }
  ctx.restore()
}

/** #RRGGBB → [r,g,b]；非法颜色回退黑色 */
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [0, 0, 0]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 半透明对角线水印 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  text: string,
  W: number,
  H: number,
  fontSizeRatio = 18,
  alpha = 0.06,
  color = '#000000'
) {
  const t = text.trim()
  if (!t) return
  const [r, g, b] = hexToRgb(color)
  ctx.save()
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
  // 字号基于短边，横向纸张下水印大小也协调
  const base = Math.min(W, H)
  ctx.font = `bold ${Math.floor(base / fontSizeRatio)}px sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  const stepX = W / 2
  const stepY = H / 4
  for (let y = -stepY; y < H + stepY; y += stepY) {
    for (let x = -stepX; x < W + stepX; x += stepX) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(-Math.PI / 6)
      ctx.fillText(t, 0, 0)
      ctx.restore()
    }
  }
  ctx.restore()
}

/**
 * 生成一张仅含水印的透明画布（尺寸 = A4 物理像素），
 * 供 PDF 导出整页叠加；与预览的水印绘制参数保持一致。
 */
export function buildWatermarkCanvas(
  W: number,
  H: number,
  text: string,
  fontSizeRatio: number,
  alpha: number,
  color: string
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  drawWatermark(ctx, text, W, H, fontSizeRatio, alpha, color)
  return c
}

/** Canvas 转灰度（副本） */
export function toGrayscale(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  const img = ctx.getImageData(0, 0, out.width, out.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    // 亮度加权灰度（Rec. 601）
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = gray
  }
  ctx.putImageData(img, 0, 0)
  return out
}

// ============ 工具：克隆 bitmap（旋转前快照等场景） ============

export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  out.getContext('2d')!.drawImage(src, 0, 0)
  return out
}

// ============ 排版引擎（layout）============
// 所有 Tab 共享的 layout() 实现
// 单位约定：内部全部使用 mm 输出（xMM/yMM/renderWMM/renderHMM）
// 下游预览：* MM_TO_PX 转 px 后 drawImage
// 下游导出：mm 直接喂 pdf-lib.drawImage
// **本文件是「预览 / 打印 / 导出」三者共用的唯一布局真源**

import { A4_H_MM, A4_W_MM, GAP_MM, MARGIN_MM, ID_PRESETS } from '@/units'
import type {
  IdMode,
  InvoiceMode,
  LayoutItem,
  LayoutPage,
  Orientation,
  ParsedPage,
  ParsedSlot,
  TicketMode
} from '@/types'

/** 可用排版区域（mm）：随纸张方向互换宽高 */
function usableArea(orientation: Orientation = 'portrait') {
  const pageW = orientation === 'portrait' ? A4_W_MM : A4_H_MM
  const pageH = orientation === 'portrait' ? A4_H_MM : A4_W_MM
  return {
    pageW,
    pageH,
    usableW: pageW - 2 * MARGIN_MM,
    usableH: pageH - 2 * MARGIN_MM
  }
}

/** 等比缩放以「适配」盒内（可放大可缩小）—— 用于票据类素材 */
function fitKeepAspect(srcW: number, srcH: number, maxW: number, maxH: number) {
  if (srcW <= 0 || srcH <= 0) return { w: 0, h: 0 }
  const r = Math.min(maxW / srcW, maxH / srcH)
  return { w: srcW * r, h: srcH * r }
}

/** 等比缩放以「不超出」盒（只缩小不放大）—— 用于证件类「严格物理尺寸」素材 */
function clampSize(w: number, h: number, maxW: number, maxH: number) {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 }
  const r = Math.min(1, maxW / w, maxH / h)
  return { w: w * r, h: h * r }
}

/**
 * 票据原始物理尺寸（mm）：直接取解析时记录的 widthMM / heightMM，
 * 与位图像素解耦（位图始终保留原始分辨率）。
 * 旋转 90°/270° 时宽高互换。
 */
function pageWHmm(page: ParsedPage): { w: number; h: number } {
  const swap = page.rotation === 90 || page.rotation === 270
  return swap
    ? { w: page.heightMM, h: page.widthMM }
    : { w: page.widthMM, h: page.heightMM }
}

/**
 * 证件物理尺寸（mm）：预设直接取 ID_PRESETS，自定义取 customW/H。
 * 严格 1:1 物理尺寸，不做任何像素推断（PRD §5.6）。
 */
function slotWHmm(s: ParsedSlot): { w: number; h: number } {
  if (s.sizePreset === 'custom') return { w: s.customW, h: s.customH }
  const p = ID_PRESETS[s.sizePreset]
  return { w: p.w, h: p.h }
}

// ---------- 发票 ----------

export function layoutInvoice(
  pages: ParsedPage[],
  mode: InvoiceMode,
  orientation: Orientation = 'portrait'
): LayoutPage[] {
  if (pages.length === 0) return [{ index: 0, items: [] }]
  const { pageH, usableW, usableH } = usableArea(orientation)
  const halfH = (usableH - GAP_MM) / 2

  const itemOf = (
    p: ParsedPage,
    boxW: number,
    boxH: number,
    x: number,
    y: number,
    pageIndex: number
  ): LayoutItem => {
    const wh = pageWHmm(p)
    const fit = fitKeepAspect(wh.w, wh.h, boxW, boxH)
    return {
      bitmap: p.bitmap,
      rotation: p.rotation,
      wMM: wh.w,
      hMM: wh.h,
      renderWMM: fit.w,
      renderHMM: fit.h,
      // 在盒内水平居中、垂直居中
      xMM: x + (boxW - fit.w) / 2,
      yMM: y + (boxH - fit.h) / 2,
      pageIndex
    }
  }

  switch (mode) {
    // 单张居中：每张票据独占一页，置于 A4 上部、底部留白（多文件自动分页）
    case 'single': {
      return pages.map((p, i) => ({
        index: i,
        items: [itemOf(p, usableW, halfH, MARGIN_MM, MARGIN_MM, i)]
      }))
    }

    // 双打（复制两份）：每张票据各占一页，同一张上下各一份；多文件自动分页
    case 'double': {
      return pages.map((p, i) => ({
        index: i,
        items: [
          itemOf(p, usableW, halfH, MARGIN_MM, MARGIN_MM, i),
          itemOf(p, usableW, halfH, MARGIN_MM, MARGIN_MM + halfH + GAP_MM, i)
        ]
      }))
    }

    // 每 2 张一页上下各一张；多文件自动分页（不丢数据）
    case 'merge2': {
      const out: LayoutPage[] = []
      for (let i = 0; i < pages.length; i += 2) {
        const group = pages.slice(i, i + 2)
        const items = group.map((p, k) =>
          itemOf(p, usableW, halfH, MARGIN_MM, MARGIN_MM + k * (halfH + GAP_MM), i + k)
        )
        out.push({ index: out.length, items })
      }
      return out
    }

    // 竖向自动堆叠，超出 A4 可用高度自动分页
    case 'auto': {
      const out: LayoutPage[] = []
      let cur: LayoutPage = { index: 0, items: [] }
      let curY = MARGIN_MM
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i]
        const wh = pageWHmm(p)
        const fit = fitKeepAspect(wh.w, wh.h, usableW, usableH)
        // 放不下且当前页已有内容 → 换页
        if (curY + fit.h > pageH - MARGIN_MM && cur.items.length > 0) {
          out.push(cur)
          cur = { index: out.length, items: [] }
          curY = MARGIN_MM
        }
        cur.items.push({
          bitmap: p.bitmap,
          rotation: p.rotation,
          wMM: wh.w,
          hMM: wh.h,
          renderWMM: fit.w,
          renderHMM: fit.h,
          xMM: MARGIN_MM + (usableW - fit.w) / 2,
          yMM: curY,
          pageIndex: i
        })
        curY += fit.h + GAP_MM
      }
      if (cur.items.length > 0) out.push(cur)
      return out
    }

    // 兜底：未知模式（历史/损坏的持久化配置）按「单张」处理，保证返回值恒为数组
    default:
      return layoutInvoice(pages, 'single', orientation)
  }
}

// ---------- 车票 ----------

export function layoutTicket(
  pages: ParsedPage[],
  mode: TicketMode,
  orientation: Orientation = 'portrait'
): LayoutPage[] {
  if (pages.length === 0) return [{ index: 0, items: [] }]
  const { usableW, usableH } = usableArea(orientation)
  const halfH = (usableH - GAP_MM) / 2
  const halfW = (usableW - GAP_MM) / 2

  switch (mode) {
    // 单张：与发票「单张居中」一致（同样逐张分页）
    case 'single':
      return layoutInvoice(pages, 'single', orientation)

    // 每 2 张一页上下；多文件自动分页（不丢数据）
    case 'top-bottom': {
      const out: LayoutPage[] = []
      for (let i = 0; i < pages.length; i += 2) {
        const group = pages.slice(i, i + 2)
        const items = group.map((p, k) => {
          const wh = pageWHmm(p)
          const fit = fitKeepAspect(wh.w, wh.h, usableW, halfH)
          return {
            bitmap: p.bitmap,
            rotation: p.rotation,
            wMM: wh.w,
            hMM: wh.h,
            renderWMM: fit.w,
            renderHMM: fit.h,
            xMM: MARGIN_MM + (usableW - fit.w) / 2,
            yMM: MARGIN_MM + k * (halfH + GAP_MM) + (halfH - fit.h) / 2,
            pageIndex: i + k
          } as LayoutItem
        })
        out.push({ index: out.length, items })
      }
      return out
    }

    // 每 2 张一页左右；多文件自动分页（不丢数据）
    case 'left-right': {
      const out: LayoutPage[] = []
      for (let i = 0; i < pages.length; i += 2) {
        const group = pages.slice(i, i + 2)
        const items = group.map((p, k) => {
          const wh = pageWHmm(p)
          const fit = fitKeepAspect(wh.w, wh.h, halfW, usableH)
          return {
            bitmap: p.bitmap,
            rotation: p.rotation,
            wMM: wh.w,
            hMM: wh.h,
            renderWMM: fit.w,
            renderHMM: fit.h,
            xMM: MARGIN_MM + k * (halfW + GAP_MM) + (halfW - fit.w) / 2,
            yMM: MARGIN_MM + (usableH - fit.h) / 2,
            pageIndex: i + k
          } as LayoutItem
        })
        out.push({ index: out.length, items })
      }
      return out
    }

    // 2×2 网格，每 4 张一页
    case 'grid2x2': {
      const cellW = (usableW - GAP_MM) / 2
      const cellH = (usableH - GAP_MM) / 2
      const out: LayoutPage[] = []
      for (let i = 0; i < pages.length; i += 4) {
        const items: LayoutItem[] = []
        for (let k = 0; k < 4; k++) {
          const p = pages[i + k]
          if (!p) continue
          const wh = pageWHmm(p)
          const fit = fitKeepAspect(wh.w, wh.h, cellW, cellH)
          const col = k % 2
          const row = Math.floor(k / 2)
          items.push({
            bitmap: p.bitmap,
            rotation: p.rotation,
            wMM: wh.w,
            hMM: wh.h,
            renderWMM: fit.w,
            renderHMM: fit.h,
            xMM: MARGIN_MM + col * (cellW + GAP_MM) + (cellW - fit.w) / 2,
            yMM: MARGIN_MM + row * (cellH + GAP_MM) + (cellH - fit.h) / 2,
            pageIndex: i + k
          })
        }
        out.push({ index: out.length, items })
      }
      return out
    }

    // 兜底：未知模式按「单张」处理
    default:
      return layoutInvoice(pages, 'single', orientation)
  }
}

// ---------- 证件 ----------
// 全部走「严格物理尺寸」：预设/自定义 mm 值直接作为渲染尺寸，
// 仅在超出可用区域时才等比缩小，避免溢出纸张。

export function layoutId(
  slots: ParsedSlot[],
  mode: IdMode,
  orientation: Orientation = 'portrait'
): LayoutPage[] {
  const filled = slots.filter((s) => s.page !== null)
  if (filled.length === 0) return [{ index: 0, items: [] }]
  const { pageH, usableW, usableH } = usableArea(orientation)

  /** 生成证件 item：物理尺寸严格 1:1，超限才缩小 */
  const makeItem = (
    s: ParsedSlot,
    xMM: number,
    yMM: number,
    maxW: number,
    maxH: number
  ): LayoutItem => {
    const phys = slotWHmm(s)
    const size = clampSize(phys.w, phys.h, maxW, maxH)
    return {
      bitmap: s.page!.bitmap,
      rotation: s.page!.rotation,
      wMM: size.w,
      hMM: size.h,
      renderWMM: size.w,
      renderHMM: size.h,
      xMM,
      yMM,
      pageIndex: 0,
      slot: s.slot
    }
  }

  switch (mode) {
    // 单页双列左右排版（每行 2 张，适配身份证正反面并排）
    case 'double-col': {
      const cellW = (usableW - GAP_MM) / 2
      const out: LayoutPage[] = []
      let cur: LayoutPage = { index: 0, items: [] }
      let y = MARGIN_MM
      for (let i = 0; i < filled.length; i += 2) {
        const group = filled.slice(i, i + 2)
        const rowH = Math.max(
          ...group.map((s) => {
            const phys = slotWHmm(s)
            return clampSize(phys.w, phys.h, cellW, usableH).h
          })
        )
        // 本行放不下 → 换页
        if (y + rowH > pageH - MARGIN_MM && cur.items.length > 0) {
          out.push(cur)
          cur = { index: out.length, items: [] }
          y = MARGIN_MM
        }
        group.forEach((s, k) => {
          const x = MARGIN_MM + k * (cellW + GAP_MM)
          cur.items.push(makeItem(s, x, y, cellW, usableH))
        })
        y += rowH + GAP_MM
      }
      if (cur.items.length > 0) out.push(cur)
      return out
    }

    // 单页双行上下排版（每行 1 张水平居中，每页 2 行）
    case 'double-row': {
      const rowH = (usableH - GAP_MM) / 2
      const out: LayoutPage[] = []
      for (let i = 0; i < filled.length; i += 2) {
        const group = filled.slice(i, i + 2)
        const items = group.map((s, k) => {
          const phys = slotWHmm(s)
          const size = clampSize(phys.w, phys.h, usableW, rowH)
          return makeItem(
            s,
            MARGIN_MM + (usableW - size.w) / 2,
            MARGIN_MM + k * (rowH + GAP_MM) + (rowH - size.h) / 2,
            usableW,
            rowH
          )
        })
        out.push({ index: out.length, items })
      }
      return out
    }

    // 单页上下居中排版（整体垂直居中；超出可用高度自动分页）
    case 'center': {
      const out: LayoutPage[] = []
      let group: Array<{ s: ParsedSlot; size: { w: number; h: number } }> = []
      const totalOf = (g: typeof group) =>
        g.reduce((acc, it, i) => acc + it.size.h + (i > 0 ? GAP_MM : 0), 0)

      const flush = () => {
        if (group.length === 0) return
        const totalH = totalOf(group)
        let y = MARGIN_MM + Math.max(0, (usableH - totalH) / 2)
        const items: LayoutItem[] = group.map((g) => {
          const item = makeItem(
            g.s,
            MARGIN_MM + (usableW - g.size.w) / 2,
            y,
            usableW,
            usableH
          )
          y += g.size.h + GAP_MM
          return item
        })
        out.push({ index: out.length, items })
        group = []
      }

      for (const s of filled) {
        const phys = slotWHmm(s)
        const size = clampSize(phys.w, phys.h, usableW, usableH)
        const curH = totalOf(group)
        const addH = (group.length > 0 ? GAP_MM : 0) + size.h
        if (group.length > 0 && curH + addH > usableH) flush()
        group.push({ s, size })
      }
      flush()
      return out
    }

    // 多证件自动分页（每页最多 2 张，上下居中）
    case 'auto': {
      const out: LayoutPage[] = []
      const halfH = (usableH - GAP_MM) / 2
      for (let i = 0; i < filled.length; i += 2) {
        const group = filled.slice(i, i + 2)
        const items = group.map((s, k) => {
          const phys = slotWHmm(s)
          const size = clampSize(phys.w, phys.h, usableW, halfH)
          return makeItem(
            s,
            MARGIN_MM + (usableW - size.w) / 2,
            MARGIN_MM + k * (halfH + GAP_MM) + (halfH - size.h) / 2,
            usableW,
            halfH
          )
        })
        out.push({ index: out.length, items })
      }
      return out
    }

    // 兜底：未知模式按「双列」处理
    default:
      return layoutId(slots, 'double-col', orientation)
  }
}
