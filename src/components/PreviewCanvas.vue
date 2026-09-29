<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useFilesStore } from '@/stores/files'
import { useLayoutStore } from '@/stores/layout'
import { useUiStore } from '@/stores/ui'
import {
  A4_H_PX,
  A4_W_PX,
  A4_H_PRINT_PX,
  A4_W_PRINT_PX,
  LS_KEYS,
  PRINT_MM_TO_PX
} from '@/units'
import {
  drawPage,
  drawWatermark,
  layoutId,
  layoutInvoice,
  layoutTicket,
  storageGet,
  storageSet,
  toGrayscale
} from '@/utils/canvas-helpers'
import { useSettingsStore } from '@/stores/settings'
import type { LayoutPage } from '@/types'
import PerspectiveEditor from './PerspectiveEditor.vue'

const ui = useUiStore()
const files = useFilesStore()
const layout = useLayoutStore()
const settings = useSettingsStore()

/** 已渲染完成的 A4 画布（每页一张，预览 / 打印共用） */
const pages = ref<HTMLCanvasElement[]>([])
/** 模板中每个 canvas 的 DOM 引用 */
const canvasRefs = ref<Record<number, HTMLCanvasElement>>({})
/** 预览滚动容器（用于「适应」模式测量可用空间） */
const containerRef = ref<HTMLElement | null>(null)

/** 预览方式：page = 单页翻页（默认） / scroll = 连续滚动 */
type ViewMode = 'page' | 'scroll'
const viewMode = ref<ViewMode>(
  storageGet<string>(LS_KEYS.previewMode, 'page') === 'scroll' ? 'scroll' : 'page'
)
watch(viewMode, (v) => storageSet(LS_KEYS.previewMode, v))

/** 当前页码（1 起） */
const currentPage = ref(1)
/** 页码输入框（文本，避免 number 类型的空值陷阱） */
const pageInput = ref('1')
/** 证件 Tab 当前编辑槽位 */
const activeIdSlot = ref<0 | 1 | 2 | 3>(0)

/** 缩放模式：fit = 适应窗口（默认） / custom = 自定义百分比 */
type ZoomMode = 'fit' | 'custom'
const zoomMode = ref<ZoomMode>(
  storageGet<string>(LS_KEYS.zoomMode, 'fit') === 'custom' ? 'custom' : 'fit'
)
/** 自定义缩放百分比（以 96 DPI 真实大小为 100%） */
const zoomPercent = ref(clampZoom(Number(storageGet<number>(LS_KEYS.zoomPercent, 65)) || 65))
watch(zoomMode, (v) => storageSet(LS_KEYS.zoomMode, v))
watch(zoomPercent, (v) => storageSet(LS_KEYS.zoomPercent, v))

/** 缩放百分比限制与步进 */
const ZOOM_MIN = 25
const ZOOM_MAX = 300
const ZOOM_STEP = 10
function clampZoom(v: number) {
  return Math.min(Math.max(Number.isFinite(v) ? Math.round(v) : 65, ZOOM_MIN), ZOOM_MAX)
}

/** 「适应窗口」下应使用的缩放百分比：让整页（含边距）完整落在可视区域 */
const fitPercent = ref(65)
function measureFit() {
  const el = containerRef.value
  if (!el) return
  const baseW = ui.orientation === 'portrait' ? A4_W_PX : A4_H_PX
  const baseH = ui.orientation === 'portrait' ? A4_H_PX : A4_W_PX
  // 容器内可用宽高（预留内边距与底部悬浮条空间）
  const availW = el.clientWidth - 40
  const availH = el.clientHeight - 76
  const scale = Math.min(availW / baseW, availH / baseH)
  fitPercent.value = clampZoom(scale * 100)
}

/** 界面实际生效的百分比（适应模式取测量值，自定义取用户值） */
const effectivePercent = computed(() =>
  zoomMode.value === 'fit' ? fitPercent.value : zoomPercent.value
)

function setCustomZoom(v: number) {
  zoomPercent.value = clampZoom(v)
  zoomMode.value = 'custom'
}
function zoomIn() {
  setCustomZoom(
    (zoomMode.value === 'custom' ? zoomPercent.value : fitPercent.value) + ZOOM_STEP
  )
}
function zoomOut() {
  setCustomZoom(
    (zoomMode.value === 'custom' ? zoomPercent.value : fitPercent.value) - ZOOM_STEP
  )
}
function zoomFit() {
  zoomMode.value = 'fit'
}

/**
 * backing 画布像素尺寸（PRINT_DPI = 300），位图与坐标都以此为基准，保证清晰。
 * 屏幕显示尺寸由 displayDims（96 DPI × 当前缩放百分比）通过 CSS 缩小，
 * 浏览器对「大 backing → 小显示」做高质量下采样，因此锐利。
 */
const dims = computed(() => {
  const w = ui.orientation === 'portrait' ? A4_W_PRINT_PX : A4_H_PRINT_PX
  const h = ui.orientation === 'portrait' ? A4_H_PRINT_PX : A4_W_PRINT_PX
  return { w, h }
})

/** 屏幕显示尺寸（CSS px）：以 96 DPI A4 真实大小为 100%，再乘缩放百分比 */
const displayDims = computed(() => {
  const baseW = ui.orientation === 'portrait' ? A4_W_PX : A4_H_PX
  const baseH = ui.orientation === 'portrait' ? A4_H_PX : A4_W_PX
  const k = effectivePercent.value / 100
  return { w: baseW * k, h: baseH * k }
})

const layouts = computed<LayoutPage[]>(() => {
  if (ui.activeTab === 'invoice') return layoutInvoice(files.invoice, layout.invoice, ui.orientation)
  if (ui.activeTab === 'ticket') return layoutTicket(files.ticket, layout.ticket, ui.orientation)
  return layoutId(files.id, layout.id, ui.orientation)
})

/** 总页数 */
const pageCount = computed(() => Math.max(1, pages.value.length))
/** 存在实际内容时即常驻显示悬浮工具条（单页也显示）；纯空占位页不显示 */
const showPager = computed(() => layouts.value.some((p) => p.items.length > 0))

/** 证件 Tab 且已有图片时才显示四点矫正编辑器 */
const hasIdContent = computed(() => files.id.some((s) => s.page !== null))
const showEditor = computed(() => ui.activeTab === 'id' && hasIdContent.value)

/** 该页在当前预览方式下是否可见 */
function isPageVisible(idx: number) {
  return viewMode.value === 'scroll' || idx === currentPage.value - 1
}

/* ---------------- 渲染 ---------------- */

function renderOne(
  layoutPage: LayoutPage,
  isBw: boolean,
  grayCache: WeakMap<HTMLCanvasElement, HTMLCanvasElement>
) {
  const { w, h } = dims.value
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  // 白底
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  for (const item of layoutPage.items) {
    let bm = item.bitmap
    // 灰度处理（缓存）
    if (isBw) {
      if (!grayCache.has(bm)) grayCache.set(bm, toGrayscale(bm))
      bm = grayCache.get(bm)!
    }
    // 应用旋转
    const rot = item.rotation
    if (rot !== 0) {
      const c2 = document.createElement('canvas')
      const swap = rot === 90 || rot === 270
      c2.width = swap ? bm.height : bm.width
      c2.height = swap ? bm.width : bm.height
      const cx = c2.getContext('2d')!
      cx.translate(c2.width / 2, c2.height / 2)
      cx.rotate((rot * Math.PI) / 180)
      cx.drawImage(bm, -bm.width / 2, -bm.height / 2)
      bm = c2
    }
    drawPage(
      ctx,
      bm,
      item.xMM * PRINT_MM_TO_PX,
      item.yMM * PRINT_MM_TO_PX,
      item.renderWMM * PRINT_MM_TO_PX,
      item.renderHMM * PRINT_MM_TO_PX,
      0
    )
  }

  // 水印（范围由设置决定）
  if (settings.shouldDraw(ui.activeTab)) {
    const wm = settings.watermark
    drawWatermark(ctx, wm.text, w, h, wm.fontSizeRatio, wm.opacity, wm.color)
  }

  return c
}

function renderAll() {
  const isBw = ui.colorMode === 'bw'
  const grayCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()
  pages.value = layouts.value.map((lp) => renderOne(lp, isBw, grayCache))
}

// 当 pages 数组变化时，把每个 page 的内容画到模板里对应的 canvas 上
async function paintToDom() {
  await nextTick()
  for (let i = 0; i < pages.value.length; i++) {
    const target = canvasRefs.value[i]
    const src = pages.value[i]
    if (!target || !src) continue
    // 保证目标 canvas 像素尺寸与源一致
    if (target.width !== src.width || target.height !== src.height) {
      target.width = src.width
      target.height = src.height
    }
    const ctx = target.getContext('2d')
    if (!ctx) continue
    ctx.clearRect(0, 0, target.width, target.height)
    ctx.drawImage(src, 0, 0)
  }
}

// 注意：不用 deep —— layouts 依赖 files 内元素的 rotation / bitmap 等响应式属性，
// 这些变化会让 computed 重算并返回新引用，足以触发重绘；deep 会深遍历 Canvas 造成性能问题。
watch(
  () =>
    [
      layouts.value,
      ui.colorMode,
      ui.activeTab,
      ui.orientation,
      settings.watermark
    ] as const,
  () => {
    renderAll()
    paintToDom()
  },
  { immediate: true }
)

onMounted(paintToDom)

/* ---------------- 适应窗口：测量与尺寸监听 ---------------- */

let resizeObs: ResizeObserver | null = null
onMounted(() => {
  measureFit()
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(() => measureFit())
    resizeObs.observe(containerRef.value)
  }
  window.addEventListener('resize', measureFit)
})
onUnmounted(() => {
  resizeObs?.disconnect()
  window.removeEventListener('resize', measureFit)
})
// 纸张方向变化后，基准宽高互换，需要重新测量
watch(
  () => ui.orientation,
  () => nextTick(measureFit)
)

/* ---------------- 翻页 ---------------- */

function goTo(n: number) {
  const max = pageCount.value
  const v = Math.floor(Number(n))
  currentPage.value = Math.min(Math.max(Number.isFinite(v) ? v : 1, 1), max)
}

function commitJump() {
  const n = Number(pageInput.value)
  if (!Number.isFinite(n) || n < 1) {
    pageInput.value = String(currentPage.value)
    return
  }
  goTo(n)
  pageInput.value = String(currentPage.value)
}

// 页数变化时钳制页码
watch(
  () => pages.value.length,
  () => {
    if (currentPage.value > pageCount.value) currentPage.value = pageCount.value
    if (currentPage.value < 1) currentPage.value = 1
  }
)

/** 证件 Tab：让编辑器跟着当前页走 */
function syncEditorToPage(n: number) {
  if (!showEditor.value) return
  const first = layouts.value[n - 1]?.items.find((it) => it.slot !== undefined)?.slot
  if (first !== undefined && first !== activeIdSlot.value) activeIdSlot.value = first
}

// 页码变化时同步输入框，并让证件编辑器跟随当前页
watch(currentPage, (n) => {
  pageInput.value = String(n)
  syncEditorToPage(n)
})

// 切 Tab 回到第 1 页，并重置证件编辑槽位
watch(
  () => ui.activeTab,
  () => {
    currentPage.value = 1
    pageInput.value = '1'
    if (showEditor.value) {
      activeIdSlot.value = files.id.find((s) => s.page)?.slot ?? 0
      syncEditorToPage(1)
    } else {
      activeIdSlot.value = 0
    }
  }
)

/* ---------------- 证件：槽位 ↔ 页码联动 ---------------- */

/** 当前编辑槽位所在页（0 基）；找不到则回落到第 1 页 */
const activeIdSlotPage = computed(() => {
  if (!showEditor.value) return 0
  const i = layouts.value.findIndex((p) => p.items.some((it) => it.slot === activeIdSlot.value))
  return i < 0 ? 0 : i
})

// 切换槽位 → 自动翻到该槽位所在页
watch(activeIdSlotPage, (i) => {
  if (showEditor.value && currentPage.value !== i + 1) goTo(i + 1)
})

/* ---------------- 键盘翻页 ---------------- */

function onKeyDown(e: KeyboardEvent) {
  // 缩放快捷键（任意预览方式下都可用，输入框聚焦时不拦截）
  const ae = document.activeElement as HTMLElement | null
  const typing =
    ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)
  if ((e.ctrlKey || e.metaKey) && !typing) {
    if (e.key === '=' || e.key === '+') {
      e.preventDefault()
      zoomIn()
      return
    }
    if (e.key === '-') {
      e.preventDefault()
      zoomOut()
      return
    }
    if (e.key === '0') {
      e.preventDefault()
      zoomFit()
      return
    }
  }

  if (viewMode.value !== 'page' || !showPager.value) return
  if (typing) return
  if (e.key === 'PageDown') {
    e.preventDefault()
    goTo(currentPage.value + 1)
  } else if (e.key === 'PageUp') {
    e.preventDefault()
    goTo(currentPage.value - 1)
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

/* ---------------- 打印页面尺寸（跟随纸张方向） ---------------- */

// @page 无法用 class 动态切换，这里注入一条随方向变化的规则覆盖静态默认值
watchEffect(() => {
  const ID = 'lpt-page-rule'
  let el = document.getElementById(ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = ID
    document.head.appendChild(el)
  }
  el.textContent = `@page { size: A4 ${ui.orientation}; margin: 0; }`
})

function setCanvasRef(idx: number, el: any) {
  if (el) {
    canvasRefs.value[idx] = el as HTMLCanvasElement
    // 立刻把对应页绘制进去，避免出现空白帧
    const src = pages.value[idx]
    if (src && el.width === src.width && el.height === src.height) {
      const ctx = el.getContext('2d')
      ctx?.drawImage(src, 0, 0)
    }
  } else {
    delete canvasRefs.value[idx]
  }
}
</script>

<template>
  <div class="preview-container" id="print-area" ref="containerRef">
    <div class="pages-stack" :class="{ 'with-editor': showEditor }">
      <div
        v-for="(page, idx) in pages"
        :key="idx"
        class="page-wrapper"
        :class="[ui.orientation, { 'page-off': !isPageVisible(idx) }]"
        :style="{ width: displayDims.w + 'px', height: displayDims.h + 'px' }"
      >
        <canvas
          :ref="(el) => setCanvasRef(idx, el)"
          :width="dims.w"
          :height="dims.h"
          :style="{ width: '100%', height: '100%', display: 'block' }"
          class="page-canvas"
        />
        <PerspectiveEditor
          v-if="showEditor && idx === activeIdSlotPage"
          :page="page"
          :page-index="idx"
          :active-slot="activeIdSlot"
          :zoom="effectivePercent / 100"
          @update:active-slot="activeIdSlot = $event"
        />
      </div>
    </div>

    <!-- 悬浮工具条：有文件即常驻（单页也显示） -->
    <div class="pager no-print" v-if="showPager">
      <div class="pager-pill">
        <button class="pager-icon" :disabled="currentPage <= 1" title="首页" @click="goTo(1)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" />
          </svg>
        </button>
        <button class="pager-icon" :disabled="currentPage <= 1" title="上一页"
                @click="goTo(currentPage - 1)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span class="pager-jump">
          <input
            class="pager-input"
            v-model="pageInput"
            inputmode="numeric"
            aria-label="页码"
            @keyup.enter="commitJump"
            @blur="commitJump"
          />
          / {{ pageCount }} 页
        </span>
        <button class="pager-icon" :disabled="currentPage >= pageCount" title="下一页"
                @click="goTo(currentPage + 1)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <button class="pager-icon" :disabled="currentPage >= pageCount" title="末页"
                @click="goTo(pageCount)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m13 17 5-5-5-5" /><path d="m6 17 5-5-5-5" />
          </svg>
        </button>
        <span class="pager-sep"></span>
        <button
          class="view-item"
          :class="{ active: viewMode === 'page' }"
          title="单页翻页"
          @click="viewMode = 'page'"
        >
          单页
        </button>
        <button
          class="view-item"
          :class="{ active: viewMode === 'scroll' }"
          title="连续滚动"
          @click="viewMode = 'scroll'"
        >
          连续
        </button>

        <span class="pager-sep"></span>
        <!-- 缩放控件 -->
        <button class="pager-icon" title="缩小 (Ctrl -)" :disabled="effectivePercent <= ZOOM_MIN"
                @click="zoomOut">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button
          class="zoom-value"
          :class="{ active: zoomMode === 'custom' }"
          :title="zoomMode === 'fit' ? '当前适应窗口，点击切换为自定义' : '点击适应窗口 (Ctrl 0)'"
          @click="zoomMode === 'fit' ? setCustomZoom(effectivePercent) : zoomFit()"
        >
          {{ effectivePercent }}%
        </button>
        <button class="pager-icon" title="放大 (Ctrl +)" :disabled="effectivePercent >= ZOOM_MAX"
                @click="zoomIn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button class="zoom-fit" :class="{ active: zoomMode === 'fit' }" title="适应窗口 (Ctrl 0)"
                @click="zoomFit">
          适应
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-container {
  position: relative;
  flex: 1;
  overflow: auto;
  padding: 24px;
  box-sizing: border-box;
  /* 让工具条在内容不足一屏时也能被 margin:auto 推到底部 */
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #edeae2 0%, #e8e4db 55%, #dad4c8 100%);
}

/* §5.4 桌面极淡噪点（2–3%），纯 CSS，不进打印 */
.preview-container::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
    radial-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 3px 3px, 5px 5px;
  background-position: 0 0, 1px 2px;
}
.pages-stack {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  /* 底部留出悬浮条空间，避免最后一页被遮挡 */
  padding-bottom: 64px;
}
.pages-stack.with-editor {
  padding-top: 56px;
}
.page-wrapper {
  position: relative;
  flex-shrink: 0;
  background: var(--paper-a4);
  border-radius: 2px;
  box-shadow:
    0 1px 2px rgba(60, 52, 38, 0.1),
    0 6px 12px -4px rgba(60, 52, 38, 0.14),
    0 18px 36px -12px rgba(60, 52, 38, 0.2);
  /* §5.2 纸厚内高光 */
  outline: 1px solid rgba(255, 255, 255, 0.6);
  outline-offset: -1px;
}
.page-wrapper.page-off {
  display: none;
}
.page-canvas {
  display: block;
  background: #fff;
}

/* ---------- 悬浮工具条 ---------- */
.pager {
  position: sticky;
  bottom: 12px;
  z-index: 20;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.pager-pill {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 4px 12px -2px rgba(60, 52, 38, 0.12),
    0 2px 4px rgba(60, 52, 38, 0.08);
}
.pager-icon {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-body);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pager-icon:hover:not(:disabled) {
  background: var(--paper-hover);
}
.pager-icon:disabled {
  color: var(--ink-disabled);
  cursor: not-allowed;
}
.pager-jump {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 2px;
  font-family: var(--font-num);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--ink-body);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pager-input {
  width: 40px;
  height: 24px;
  padding: 0 4px;
  text-align: center;
  font-family: var(--font-num);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-strong);
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: #fff;
  outline: none;
}
.pager-input:focus {
  border-color: var(--brand-seal);
}
.pager-sep {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--line-base);
}
.view-item {
  height: 24px;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-secondary);
  cursor: pointer;
}
.view-item:hover {
  color: var(--ink-strong);
}
.view-item.active {
  background: var(--ink-blue-soft);
  color: var(--ink-blue);
  font-weight: 600;
}

/* ---------- 缩放控件 ---------- */
.zoom-value {
  min-width: 48px;
  height: 24px;
  padding: 0 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-family: var(--font-num);
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-body);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  white-space: nowrap;
}
.zoom-value:hover {
  background: var(--paper-hover);
}
.zoom-value.active {
  background: var(--ink-blue-soft);
  color: var(--ink-blue);
}
.zoom-fit {
  height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-secondary);
  cursor: pointer;
}
.zoom-fit:hover {
  color: var(--ink-strong);
}
.zoom-fit.active {
  background: var(--ink-blue-soft);
  color: var(--ink-blue);
  font-weight: 600;
}

/* ---------- 响应式 ---------- */
@media (max-width: 768px) {
  .preview-container {
    padding: 14px;
  }
  .pages-stack {
    gap: 20px;
    padding-bottom: 60px;
  }
  .pager-pill {
    gap: 2px;
    padding: 6px 10px;
    max-width: calc(100vw - 24px);
    overflow-x: auto;
  }
  .pager-jump {
    font-size: 12px;
  }
  .pager-sep {
    margin: 0 2px;
  }
}

@media (max-width: 480px) {
  .pager-pill {
    gap: 1px;
    padding: 5px 8px;
  }
  /* 极窄屏隐藏文字型视图切换，保留核心翻页与缩放 */
  .view-item {
    display: none;
  }
  .zoom-fit {
    padding: 0 6px;
  }
}
</style>
