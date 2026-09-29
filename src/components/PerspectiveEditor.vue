<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useFilesStore } from '@/stores/files'
import { useLayoutStore } from '@/stores/layout'
import { usePerspectiveStore } from '@/stores/perspective'
import { useUiStore } from '@/stores/ui'
import { warp } from '@/utils/perspective'
import { layoutId, toast } from '@/utils/canvas-helpers'
import { MM_TO_PX, PREVIEW_SCALE } from '@/units'
import type { Corner, LayoutItem } from '@/types'

type Slot = 0 | 1 | 2 | 3

interface Props {
  /** 本页已渲染的 A4 画布 */
  page: HTMLCanvasElement
  /** 本页在排版结果中的下标（0 基） */
  pageIndex: number
  /** 当前编辑的证件槽位 */
  activeSlot: Slot
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:activeSlot': [slot: Slot] }>()

const files = useFilesStore()
const layout = useLayoutStore()
const perspective = usePerspectiveStore()
const ui = useUiStore()

const overlayRef = ref<SVGSVGElement>()
const dragging = ref<Slot | null>(null)
const selected = ref<Slot | null>(null)

/** 本页的排版项（方向必须与预览一致，否则覆盖层会错位） */
const pageItems = computed<LayoutItem[]>(
  () => layoutId(files.id, layout.id, ui.orientation)[props.pageIndex]?.items ?? []
)

/** 当前激活槽位在本页的排版项（未填写或不在本页时为 null） */
const activeItem = computed<LayoutItem | null>(
  () => pageItems.value.find((i) => i.slot === props.activeSlot) ?? null
)

const activeSlotData = computed(() => files.id.find((x) => x.slot === props.activeSlot) ?? null)

/** 图像在页面上占据的显示区域（相对 page-wrapper 左上角，px） */
const box = computed(() => {
  const it = activeItem.value
  if (!it) return null
  return {
    left: it.xMM * MM_TO_PX * PREVIEW_SCALE,
    top: it.yMM * MM_TO_PX * PREVIEW_SCALE,
    w: it.renderWMM * MM_TO_PX * PREVIEW_SCALE,
    h: it.renderHMM * MM_TO_PX * PREVIEW_SCALE
  }
})

/** 图像原始像素 → 显示像素 的缩放比 */
const displayScale = computed(() => {
  const b = box.value
  const p = activeSlotData.value?.page
  if (!b || !p || p.width <= 0) return 1
  return b.w / p.width
})

const cornersImage = computed<Corner[]>(() => perspective.getCorners(props.activeSlot))

/** 角点在 SVG 坐标系（= 图像显示区域坐标）中的位置 */
const cornerDisplay = computed(() => {
  const s = displayScale.value || 1
  return cornersImage.value.map((c) => ({ x: c.x * s, y: c.y * s }))
})

/**
 * 每个槽位「当前角点对应的图像」指纹（模块级，跨编辑器挂载/卸载保留）。
 * 图像变化（换图、裁剪后尺寸变化）→ 角点自动按新图四角重置，
 * 避免沿用上一张图的角点导致红点跑偏。
 */
const syncedImageKey = new Map<number, string>()

/** 槽位 / 图片尺寸变化时，按新图重置角点 */
const syncKey = computed(() => {
  const p = activeSlotData.value?.page
  return `${props.activeSlot}|${p?.id ?? ''}|${p?.width ?? 0}x${p?.height ?? 0}`
})

function ensureCorners() {
  selected.value = null
  const p = activeSlotData.value?.page
  const slot = props.activeSlot
  if (!p || p.width <= 0 || p.height <= 0) {
    syncedImageKey.delete(slot)
    return
  }
  const key = `${p.id}|${p.width}x${p.height}`
  if (syncedImageKey.get(slot) !== key) {
    perspective.initFromImage(slot, p.width, p.height)
    syncedImageKey.set(slot, key)
  }
}

watch(syncKey, ensureCorners, { immediate: true })

function onSlotChange(v: unknown) {
  const n = Number(v)
  if (n === 0 || n === 1 || n === 2 || n === 3) emit('update:activeSlot', n)
}

function startDrag(idx: Slot, e: MouseEvent) {
  e.preventDefault()
  dragging.value = idx
  selected.value = idx
}

function onMove(e: MouseEvent) {
  const dragIdx = dragging.value
  if (dragIdx == null) return
  const svg = overlayRef.value
  const p = activeSlotData.value?.page
  if (!svg || !p) return
  const rect = svg.getBoundingClientRect()
  const scale = rect.width > 0 ? rect.width / p.width : displayScale.value || 1
  const ix = Math.max(0, Math.min(p.width, Math.round((e.clientX - rect.left) / scale)))
  const iy = Math.max(0, Math.min(p.height, Math.round((e.clientY - rect.top) / scale)))
  perspective.setCorner(props.activeSlot, dragIdx, ix, iy)
}

function endDrag() {
  dragging.value = null
}

function onKey(e: KeyboardEvent) {
  const sel = selected.value
  if (sel == null) return
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
  const p = activeSlotData.value?.page
  if (!p) return
  const step = e.shiftKey ? 10 : 1
  const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
  const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
  e.preventDefault()
  const c = perspective.getCorners(props.activeSlot)[sel]
  const nx = Math.max(0, Math.min(p.width, c.x + dx))
  const ny = Math.max(0, Math.min(p.height, c.y + dy))
  perspective.setCorner(props.activeSlot, sel, nx, ny)
}

async function applyCrop() {
  const s = activeSlotData.value
  if (!s?.page) {
    toast('当前槽位没有图片', 'warning')
    return
  }
  try {
    const corners = perspective.getCorners(props.activeSlot)
    if (corners.every((c) => c.x === 0 && c.y === 0)) {
      toast('请先调整角点', 'warning')
      return
    }
    const newCanvas = await warp(s.page.bitmap, corners)
    // 物理尺寸按像素比例同步（裁剪只改变像素覆盖范围，不改变像素密度）
    const sx = s.page.width > 0 ? newCanvas.width / s.page.width : 1
    const sy = s.page.height > 0 ? newCanvas.height / s.page.height : 1
    s.page.widthMM = s.page.widthMM * sx
    s.page.heightMM = s.page.heightMM * sy
    s.page.bitmap = newCanvas
    s.page.width = newCanvas.width
    s.page.height = newCanvas.height
    perspective.reset(props.activeSlot)
    s.edited = true
    toast('矫正完成', 'success')
  } catch (e: any) {
    toast(`透视矫正不可用，已使用原图（${e?.message || e}）`, 'warning')
  }
}

function resetSlot() {
  const s = activeSlotData.value
  if (!s?.page) return
  perspective.initFromImage(s.slot, s.page.width, s.page.height)
}

onMounted(() => {
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="perspective-editor no-print">
    <div class="pe-toolbar">
      <span class="pe-label">编辑槽位</span>
      <el-radio-group
        class="pe-slot-group"
        :model-value="activeSlot"
        size="small"
        @change="onSlotChange"
      >
        <el-radio-button v-for="s in files.id" :key="s.slot" :value="s.slot" :disabled="!s.page">
          {{ s.slot + 1 }}
        </el-radio-button>
      </el-radio-group>
      <span class="pe-divider"></span>
      <el-button class="pe-reset" size="small" @click="resetSlot">重置角点</el-button>
      <el-button class="pe-confirm" size="small" @click="applyCrop">裁剪确认</el-button>
    </div>

    <svg
      v-if="box"
      ref="overlayRef"
      class="pe-overlay"
      :style="{ left: box.left + 'px', top: box.top + 'px', width: box.w + 'px', height: box.h + 'px' }"
      :viewBox="`0 0 ${box.w} ${box.h}`"
      preserveAspectRatio="none"
    >
      <polygon
        v-if="cornerDisplay.length === 4"
        :points="cornerDisplay.map((c) => `${c.x},${c.y}`).join(' ')"
        fill="rgba(192, 57, 43, 0.08)"
        stroke="#C0392B"
        stroke-width="1.5"
        stroke-dasharray="6 4"
        stroke-linejoin="round"
      />
      <circle
        v-for="(c, idx) in cornerDisplay"
        :key="idx"
        :cx="c.x"
        :cy="c.y"
        :r="selected === idx ? 7 : 6"
        :fill="selected === idx ? '#A52F23' : '#C0392B'"
        stroke="#fff"
        stroke-width="2"
        class="pe-handle"
        @mousedown="startDrag(idx as Slot, $event)"
        @click="selected = idx as Slot"
      />
    </svg>

    <!-- 键盘微调提示胶囊 -->
    <div class="pe-kbd-hint">方向键微调 1px，Shift+方向键 10px</div>
  </div>
</template>

<style scoped>
.perspective-editor {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.pe-toolbar {
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.97);
  padding: 6px 12px;
  border-radius: 999px;
  box-shadow:
    0 4px 12px -2px rgba(60, 52, 38, 0.12),
    0 2px 4px rgba(60, 52, 38, 0.08);
  pointer-events: auto;
  z-index: 10;
}
.pe-label {
  font-size: 11px;
  color: var(--ink-secondary);
  white-space: nowrap;
}
.pe-divider {
  width: 1px;
  height: 16px;
  background: var(--line-base);
}

/* 槽位 segmented：横向不换行、不被压缩 */
.pe-slot-group {
  flex: 0 0 auto;
}
.pe-slot-group :deep(.el-radio-group) {
  flex-wrap: nowrap;
}
.pe-slot-group :deep(.el-radio-button) {
  flex: 0 0 auto;
}
.pe-slot-group :deep(.el-radio-button__inner) {
  border-radius: 0;
}
.pe-slot-group :deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-start-start-radius: 999px;
  border-end-start-radius: 999px;
}
.pe-slot-group :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-start-end-radius: 999px;
  border-end-end-radius: 999px;
}

/* 重置角点：墨水蓝描边 */
.pe-reset {
  background: var(--paper-raised);
  border-color: var(--ink-blue);
  color: var(--ink-blue);
  font-weight: 500;
}
.pe-reset:hover,
.pe-reset:focus {
  background: var(--ink-blue-soft);
  border-color: var(--ink-blue);
  color: var(--ink-blue);
}

/* 裁剪确认：全界面第二颗实心朱红（600） */
.pe-confirm {
  background: var(--brand-seal);
  border-color: var(--brand-seal);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(60, 52, 38, 0.1);
}
.pe-confirm:hover,
.pe-confirm:focus {
  background: var(--brand-seal-deep);
  border-color: var(--brand-seal-deep);
  color: #fff;
}

.pe-overlay {
  position: absolute;
  pointer-events: auto;
  overflow: visible;
}
.pe-handle {
  cursor: grab;
}
.pe-handle:active {
  cursor: grabbing;
}

.pe-kbd-hint {
  position: fixed;
  bottom: 64px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--paper-raised);
  border-radius: 999px;
  padding: 6px 14px;
  box-shadow:
    0 1px 3px rgba(60, 52, 38, 0.08),
    0 0 0 1px var(--line-soft);
  font-size: 11px;
  color: var(--ink-secondary);
  white-space: nowrap;
  pointer-events: auto;
  z-index: 30;
}
</style>
