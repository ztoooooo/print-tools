<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useFilesStore } from '@/stores/files'
import { useLayoutStore } from '@/stores/layout'
import { useUiStore } from '@/stores/ui'
import { CUSTOM_MAX_MM, CUSTOM_MIN_MM, ID_PRESETS } from '@/units'
import type { IdSizeKey as _IdSizeKey } from '@/units'
import { confirmAction, toast } from '@/utils/canvas-helpers'
import type { IdMode, InvoiceMode, ParsedPage, TicketMode } from '@/types'

type IdSizeKey = _IdSizeKey
type Slot = 0 | 1 | 2 | 3

const ACCEPT = '.pdf,.jpg,.jpeg,.png,image/*'

/* ---------- 状态 ---------- */

const files = useFilesStore()
const layout = useLayoutStore()
const ui = useUiStore()

const invoiceModes: Array<{ key: InvoiceMode; label: string }> = [
  { key: 'single', label: '单张居中' },
  { key: 'double', label: '双打（复制两份）' },
  { key: 'merge2', label: '上下合并两张' },
  { key: 'auto', label: '自动堆叠' }
]
const ticketModes: Array<{ key: TicketMode; label: string }> = [
  { key: 'single', label: '单张居中' },
  { key: 'top-bottom', label: '上下两联' },
  { key: 'left-right', label: '左右两联' },
  { key: 'grid2x2', label: '2×2 网格' }
]
const idModes: Array<{ key: IdMode; label: string }> = [
  { key: 'double-col', label: '双列' },
  { key: 'double-row', label: '双行' },
  { key: 'center', label: '居中单张' },
  { key: 'auto', label: '自动堆叠' }
]

const currentModes = computed(() => {
  if (ui.activeTab === 'invoice') return invoiceModes
  if (ui.activeTab === 'ticket') return ticketModes
  return idModes
})

const currentMode = computed({
  get() {
    if (ui.activeTab === 'invoice') return layout.invoice
    if (ui.activeTab === 'ticket') return layout.ticket
    return layout.id
  },
  set(v: any) {
    layout.setMode(ui.activeTab, v)
  }
})

const fileList = computed<ParsedPage[]>(() => {
  if (ui.activeTab === 'id') return []
  return files[ui.activeTab as 'invoice' | 'ticket']
})

const fileCount = computed(() => fileList.value.length)
const filledSlotCount = computed(() => files.id.filter((s) => s.page).length)

/* ---------- 排版模式 mini 图示（§6.4 逐模式画法，内联 SVG） ---------- */

type RectSpec = [number, number, number, number] // x y w h

const MODE_RECTS: Record<string, RectSpec[]> = {
  // 发票
  single: [[5, 12, 12, 7]],
  double: [
    [5, 8, 12, 7],
    [5, 17, 12, 7]
  ],
  merge2: [
    [5, 9, 12, 6.5],
    [5, 15.5, 12, 6.5]
  ],
  // 车票
  'top-bottom': [
    [2.5, 7, 17, 6],
    [2.5, 19, 17, 6]
  ],
  'left-right': [
    [5, 6, 4, 19],
    [13, 6, 4, 19]
  ],
  grid2x2: [
    [3, 7, 7, 8],
    [12, 7, 7, 8],
    [3, 17, 7, 8],
    [12, 17, 7, 8]
  ],
  // 证件
  'double-col': [
    [2.5, 7, 7.5, 5],
    [12, 7, 7.5, 5],
    [2.5, 19, 7.5, 5]
  ],
  'double-row': [
    [6.5, 8, 9, 6],
    [6.5, 18, 9, 6]
  ],
  center: [[5, 12.5, 12, 7.5]]
}
// auto 因模式列表中出现两次（发票/证件通用），统一三错位堆叠
MODE_RECTS.auto = [
  [4, 8, 12, 5],
  [5, 14, 12, 5],
  [6, 20, 12, 5]
]

function ModeDiagram(prop: { mode: string }) {
  return h(
    'svg',
    {
      width: 22,
      height: 31,
      viewBox: '0 0 22 31',
      class: 'mode-svg',
      'aria-hidden': 'true'
    },
    [
      h('rect', {
        x: 0.5,
        y: 0.5,
        width: 21,
        height: 30,
        rx: 1,
        fill: '#fff',
        stroke: '#D8D2C5'
      }),
      ...MODE_RECTS[prop.mode].map(([x, y, w, hh]) =>
        h('rect', { x, y, width: w, height: hh, rx: 1, class: 'block' })
      )
    ]
  )
}

/* ---------- 模式卡键盘可达（方向键移动焦点，Enter/Space 选中） ---------- */

function onModeKeydown(e: KeyboardEvent, key: string) {
  const cards = Array.from(
    (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('.mode-card') ?? []
  )
  const idx = cards.indexOf(e.currentTarget as HTMLElement)
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    currentMode.value = key as any
    return
  }
  let next = -1
  if (e.key === 'ArrowRight') next = Math.min(cards.length - 1, idx + 1)
  else if (e.key === 'ArrowLeft') next = Math.max(0, idx - 1)
  else if (e.key === 'ArrowDown') next = Math.min(cards.length - 1, idx + 2)
  else if (e.key === 'ArrowUp') next = Math.max(0, idx - 2)
  if (next >= 0) {
    e.preventDefault()
    cards[next]?.focus()
  }
}

/* ---------- 上传 ---------- */

function onFiles(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files) files.addFiles(ui.activeTab, target.files)
  target.value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.files) files.addFiles(ui.activeTab, e.dataTransfer.files)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

/** 单文件进指定槽位；多文件则自动填入空槽位 */
function onSlotDrop(slot: Slot, e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  const list = e.dataTransfer?.files
  if (!list || list.length === 0) return
  if (list.length === 1) files.addFileToSlot(slot, list[0])
  else files.addFiles('id', list)
}

function onSlotPick(slot: Slot, e: Event) {
  const el = e.target as HTMLInputElement
  const f = el.files?.[0]
  if (f) files.addFileToSlot(slot, f)
  el.value = ''
}

/* ---------- 文件列表内拖拽排序 ---------- */

const REORDER_MIME = 'application/x-lpt-reorder'
/** 正在拖拽的文件 id */
const dragId = ref<string | null>(null)
/** 当前放置目标 */
const dropTarget = ref<{ id: string; position: 'before' | 'after' } | null>(null)

function onItemDragStart(id: string, e: DragEvent) {
  dragId.value = id
  e.dataTransfer?.setData(REORDER_MIME, id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onItemDragOver(id: string, e: DragEvent) {
  // 仅响应列表内部排序拖拽；外部文件拖入交给上传逻辑
  const types = e.dataTransfer ? Array.from(e.dataTransfer.types) : []
  if (!dragId.value || !types.includes(REORDER_MIME)) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const position: 'before' | 'after' =
    e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  dropTarget.value = { id, position }
}

function onItemDrop(id: string, e: DragEvent) {
  const movedId = dragId.value
  if (!movedId) return
  e.preventDefault()
  e.stopPropagation()
  // 直接依据鼠标相对目标项的位置判定前插 / 后插，避免快速移动时 dropTarget 未更新
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const position: 'before' | 'after' =
    e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  files.reorder(ui.activeTab as 'invoice' | 'ticket', movedId, id, position)
  dropTarget.value = null
  dragId.value = null
}

function onItemDragEnd() {
  dragId.value = null
  dropTarget.value = null
}

/* ---------- 文件操作 ---------- */

function removePage(id: string) {
  files.remove(ui.activeTab, id)
}

/** 旋转 90°（发票 / 车票 / 证件槽位通用） */
function rotate(id: string) {
  if (ui.activeTab === 'id') {
    const s = files.id.find((x) => x.page?.id === id)
    if (!s?.page) return
    files.rotate('id', id, ((s.page.rotation + 90) % 360) as 0 | 90 | 180 | 270)
    return
  }
  const p = fileList.value.find((x) => x.id === id)
  if (!p) return
  files.rotate(ui.activeTab, id, ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270)
}

async function clearAll() {
  const tabName = ui.activeTab === 'invoice' ? '发票' : ui.activeTab === 'ticket' ? '车票' : '证件'
  const ok = await confirmAction(
    `确定要清空【${tabName}】Tab 中的全部文件吗？`,
    '清空文件',
    '确定清空'
  )
  if (!ok) return
  files.clear(ui.activeTab)
  toast('已清空当前列表', 'success')
}

function setSlotPreset(slot: Slot, preset: IdSizeKey) {
  const s = files.id.find((x) => x.slot === slot)
  if (!s) return
  s.sizePreset = preset
  if (preset !== 'custom') {
    s.customW = ID_PRESETS[preset].w
    s.customH = ID_PRESETS[preset].h
  }
}

function onCustomInput(slot: Slot, key: 'customW' | 'customH', val: number) {
  const s = files.id.find((x) => x.slot === slot)
  if (!s) return
  if (Number.isNaN(val)) return
  s[key] = Math.max(CUSTOM_MIN_MM, Math.min(CUSTOM_MAX_MM, val))
}

/** 槽位当前尺寸文案 */
function slotSizeText(slot: Slot) {
  const s = files.id.find((x) => x.slot === slot)
  if (!s) return ''
  const p = ID_PRESETS[s.sizePreset]
  const w = s.sizePreset === 'custom' ? s.customW : p.w
  const h = s.sizePreset === 'custom' ? s.customH : p.h
  return `${w} × ${h} mm`
}
</script>

<template>
  <aside class="left-panel no-print">
    <!-- ============ 发票 / 车票 ============ -->
    <template v-if="ui.activeTab !== 'id'">
      <!-- ① 文件 -->
      <section class="panel-section">
        <h2 class="section-title">文件</h2>
        <label class="dropzone" @drop="onDrop" @dragover="onDragOver">
          <svg class="dz-svg" width="26" height="26" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">
            <path d="M12 16V4" />
            <path d="m7 9 5-5 5 5" />
            <path d="M20 16.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5" />
          </svg>
          <span class="dz-text">拖入或点击添加文件</span>
          <span class="dz-hint">支持 PDF / JPG / PNG，PDF 自动拆页 · 已添加 {{ fileCount }} 张</span>
          <input type="file" multiple :accept="ACCEPT" hidden @change="onFiles" />
        </label>
      </section>

      <!-- ② 文件列表（IA：紧跟上传区） -->
      <section class="panel-section">
        <h2 class="section-title">
          文件列表
          <span v-if="fileList.length" class="title-link" @click="clearAll">清空</span>
        </h2>
        <div v-if="fileList.length === 0" class="empty-hint">暂无文件</div>
        <div v-else class="file-list">
          <div
            v-for="(p, idx) in fileList"
            :key="p.id"
            class="file-item"
            :class="{
              dragging: dragId === p.id,
              'drop-before': dropTarget?.id === p.id && dropTarget.position === 'before',
              'drop-after': dropTarget?.id === p.id && dropTarget.position === 'after'
            }"
            draggable="true"
            @dragstart="onItemDragStart(p.id, $event)"
            @dragover="onItemDragOver(p.id, $event)"
            @drop="onItemDrop(p.id, $event)"
            @dragend="onItemDragEnd"
          >
            <!-- 第一行：序号 + 文件名 + 状态标签 -->
            <div class="fi-row fi-row-name">
              <span class="badge-num">{{ String(idx + 1).padStart(2, '0') }}</span>
              <span class="fi-name" :title="p.name">{{ p.name }}</span>
              <span v-if="p.rotation !== 0" class="tag-rotated">已转 {{ p.rotation }}°</span>
            </div>
            <!-- 第二行：操作按钮 + 状态 -->
            <div class="fi-row fi-row-actions">
              <button
                type="button"
                class="mini-btn mini-rotate"
                :title="`顺时针旋转 90°（当前 ${p.rotation}°）`"
                @click="rotate(p.id)"
              >
                {{ p.rotation === 0 ? '旋转' : `旋转 ${p.rotation}°` }}
              </button>
              <button
                type="button"
                class="mini-btn mini-delete"
                title="删除该文件"
                @click="removePage(p.id)"
              >
                删除
              </button>
              <span class="fi-status">就绪 · 可拖动排序</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ③ 排版模式 -->
      <section class="panel-section">
        <h2 class="section-title">排版模式</h2>
        <div class="mode-grid" role="radiogroup" aria-label="排版模式">
          <div
            v-for="m in currentModes"
            :key="m.key"
            class="mode-card"
            :class="{ selected: currentMode === m.key }"
            role="radio"
            tabindex="0"
            :aria-checked="currentMode === m.key"
            :title="m.label"
            @click="currentMode = m.key as any"
            @keydown="(e) => onModeKeydown(e, m.key)"
          >
            <span v-if="currentMode === m.key" class="check">✓</span>
            <ModeDiagram :mode="m.key" />
            <span class="mode-name">{{ m.label }}</span>
          </div>
        </div>

        <!-- grid2x2 旋转建议 warning 条（仅提示，不自动旋转） -->
        <div v-if="ui.activeTab === 'ticket' && currentMode === 'grid2x2'" class="warning-bar" role="note">
          <svg class="wb-icon" width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>建议先旋转 90°，2×2 排列更整齐。不会自动旋转，请逐张点「旋转」。</span>
        </div>
      </section>
    </template>

    <!-- ============ 证件 ============ -->
    <template v-else>
      <!-- ① 证件文件 -->
      <section class="panel-section">
        <h2 class="section-title">
          证件文件
          <span class="title-count">共 {{ filledSlotCount }} / 4 槽位</span>
        </h2>

        <!-- 批量上传区 -->
        <label class="dropzone dropzone-sm" @drop="onDrop" @dragover="onDragOver">
          <span class="dz-text">批量上传，按顺序填空槽</span>
          <span class="dz-hint">已填 {{ filledSlotCount }} / 4 · 同一文件不会重复占用槽位</span>
          <input type="file" multiple :accept="ACCEPT" hidden @change="onFiles" />
        </label>

        <div class="slot-list">
          <div
            v-for="s in files.id"
            :key="s.slot"
            class="slot-card"
            @drop="(e) => onSlotDrop(s.slot, e)"
            @dragover="onDragOver"
          >
            <div class="slot-head">
              <span class="slot-no">槽 {{ s.slot + 1 }}</span>
              <span v-if="s.page" class="badge-check" aria-label="已填">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="3" stroke-linecap="round"
                     stroke-linejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span class="slot-title">{{ ID_PRESETS[s.sizePreset].name }}{{ s.slot < 2 ? (s.slot === 0 ? '正面' : '反面') : '' }}</span>
              <span class="slot-size">{{ slotSizeText(s.slot) }}</span>
            </div>

            <el-select
              :model-value="s.sizePreset"
              size="small"
              class="slot-preset"
              @change="(v: IdSizeKey) => setSlotPreset(s.slot, v)"
            >
              <el-option v-for="(p, k) in ID_PRESETS" :key="k" :label="p.name" :value="k" />
            </el-select>

            <div v-if="s.sizePreset === 'custom'" class="custom-row">
              <el-input-number
                :model-value="s.customW"
                :min="CUSTOM_MIN_MM"
                :max="CUSTOM_MAX_MM"
                size="small"
                :step="1"
                controls-position="right"
                @change="(v: number) => onCustomInput(s.slot, 'customW', v)"
              />
              <span class="x">×</span>
              <el-input-number
                :model-value="s.customH"
                :min="CUSTOM_MIN_MM"
                :max="CUSTOM_MAX_MM"
                size="small"
                :step="1"
                controls-position="right"
                @change="(v: number) => onCustomInput(s.slot, 'customH', v)"
              />
            </div>

            <!-- 空槽 -->
            <label v-if="!s.page" class="slot-empty">
              <span class="se-plus">+</span>
              <span class="se-text">点击或拖拽上传</span>
              <span class="se-size">{{ slotSizeText(s.slot) }}</span>
              <input type="file" :accept="ACCEPT" hidden @change="(e) => onSlotPick(s.slot, e)" />
            </label>

            <!-- 已填 -->
            <div v-else class="slot-file">
              <span class="file-name" :title="s.page.name">
                <span class="fnt">{{ s.page.name }}</span>
                <span v-if="s.edited" class="tag-edited">已矫正</span>
              </span>
              <span class="item-actions">
                <button
                  type="button"
                  class="mini-btn mini-rotate"
                  :title="`顺时针旋转 90°（当前 ${s.page.rotation}°）`"
                  @click="rotate(s.page.id)"
                >
                  旋转 {{ s.page.rotation }}°
                </button>
                <button
                  type="button"
                  class="mini-btn mini-delete"
                  title="移除该槽位图片（也可直接拖新图替换）"
                  @click="files.remove('id', s.page!.id)"
                >
                  移除
                </button>
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ② 证件排版 -->
      <section class="panel-section">
        <h2 class="section-title">证件排版</h2>
        <div class="mode-grid" role="radiogroup" aria-label="证件排版模式">
          <div
            v-for="m in idModes"
            :key="m.key"
            class="mode-card"
            :class="{ selected: currentMode === m.key }"
            role="radio"
            tabindex="0"
            :aria-checked="currentMode === m.key"
            :title="m.label"
            @click="currentMode = m.key as any"
            @keydown="(e) => onModeKeydown(e, m.key)"
          >
            <span v-if="currentMode === m.key" class="check">✓</span>
            <ModeDiagram :mode="m.key" />
            <span class="mode-name">{{ m.label }}</span>
          </div>
        </div>
      </section>
    </template>

    <!-- ③ 打印设置（全局） -->
    <section class="panel-section">
      <h2 class="section-title">打印设置</h2>

      <div class="setting-row">
        <span class="sr-label">纸张方向</span>
        <el-radio-group
          class="sr-control"
          :model-value="ui.orientation"
          size="small"
          @change="(v: any) => ui.setOrientation(v)"
        >
          <el-radio-button value="portrait">纵向</el-radio-button>
          <el-radio-button value="landscape">横向</el-radio-button>
        </el-radio-group>
      </div>

      <div class="setting-row">
        <span class="sr-label">色彩</span>
        <el-radio-group
          class="sr-control"
          :model-value="ui.colorMode"
          size="small"
          @change="(v: any) => ui.setColorMode(v)"
        >
          <el-radio-button value="color">彩色</el-radio-button>
          <el-radio-button value="bw">黑白</el-radio-button>
        </el-radio-group>
      </div>

      <div class="setting-row">
        <span class="sr-label">份数</span>
        <el-input-number
          class="sr-control"
          :model-value="ui.copies"
          :min="1"
          :max="999"
          size="small"
          controls-position="right"
          @change="(v: number) => ui.setCopies(v)"
        />
      </div>
    </section>
  </aside>
</template>

<style scoped>
.left-panel {
  width: 280px;
  flex-shrink: 0;
  background: var(--paper-panel);
  border-right: 1px solid var(--line-base);
  overflow-y: auto;
  padding: 16px;
}
.panel-section {
  margin-bottom: 20px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: var(--ink-strong);
  margin: 0 0 8px;
}
.section-title::before {
  content: '';
  width: 3px;
  height: 12px;
  border-radius: 1px;
  background: var(--brand-seal);
}
.title-link {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--ink-secondary);
  cursor: pointer;
}
.title-link:hover {
  color: var(--danger);
}
.title-count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--ink-secondary);
  font-variant-numeric: tabular-nums;
}

/* ---------- Dropzone ---------- */
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1.5px dashed var(--line-strong);
  border-radius: 6px;
  background: var(--paper-card);
  padding: 20px 12px;
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.dropzone:hover {
  border-color: var(--ink-blue);
  background: var(--paper-hover);
}
.dropzone-sm {
  padding: 14px 12px;
  margin-bottom: 10px;
}
.dz-svg {
  color: var(--ink-secondary);
  margin-bottom: 6px;
}
.dz-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-body);
}
.dz-hint {
  font-size: 11px;
  color: var(--ink-placeholder);
  margin-top: 4px;
}

/* ---------- 文件列表（固定两行） ---------- */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.file-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 7px 10px 8px;
  border-radius: 6px;
  border: 1px solid var(--line-soft);
  background: var(--paper-card);
  cursor: grab;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    opacity 0.15s;
}
.file-item:hover {
  border-color: var(--line-strong);
  box-shadow: 0 1px 2px rgba(60, 52, 38, 0.06);
}
.file-item:active {
  cursor: grabbing;
}
.file-item.dragging {
  opacity: 0.45;
}
/* 放置位置指示线 */
.file-item.drop-before::before,
.file-item.drop-after::after {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  height: 2px;
  border-radius: 1px;
  background: var(--brand-seal);
}
.file-item.drop-before::before {
  top: -4px;
}
.file-item.drop-after::after {
  bottom: -4px;
}
.fi-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.fi-row-name {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: var(--ink-strong);
}
.fi-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fi-row-actions {
  justify-content: flex-start;
}
.fi-status {
  margin-left: auto;
  font-size: 10px;
  color: var(--ink-placeholder);
  white-space: nowrap;
}
.badge-num {
  flex-shrink: 0;
  min-width: 22px;
  height: 16px;
  padding: 0 3px;
  border-radius: 3px;
  background: var(--brand-seal-soft);
  color: var(--brand-seal);
  font-family: var(--font-num);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tag-rotated {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--warning);
  background: var(--warning-soft);
  border-radius: 3px;
  padding: 0 4px;
  height: 16px;
  line-height: 16px;
}
.item-actions {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
}
.mini-btn {
  height: 22px;
  padding: 0 8px;
  border: none;
  border-radius: 999px;
  font-size: 11px;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.mini-rotate {
  background: var(--ink-blue-soft);
  color: var(--ink-blue);
}
.mini-rotate:hover {
  background: var(--ink-blue);
  color: #fff;
}
.mini-delete {
  background: var(--danger-soft);
  color: var(--danger);
}
.mini-delete:hover {
  background: var(--danger);
  color: #fff;
}
.empty-hint {
  font-size: 12px;
  color: var(--ink-placeholder);
  text-align: center;
  padding: 20px 0;
}

/* ---------- 模式卡 2×2 ---------- */
.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.mode-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--paper-card);
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.mode-card:hover {
  background: var(--paper-hover);
  border-color: var(--ink-placeholder);
}
.mode-card.selected {
  padding: 7.5px;
  border: 1.5px solid var(--brand-seal);
  background: var(--brand-seal-soft);
}
.mode-svg {
  display: block;
}
.mode-svg .block {
  fill: #a39e91;
  opacity: 0.5;
}
.mode-card.selected .mode-svg .block {
  fill: var(--brand-seal);
  opacity: 1;
}
.mode-name {
  font-size: 11px;
  font-weight: 400;
  color: var(--ink-body);
  text-align: center;
  line-height: 1.25;
}
.mode-card.selected .mode-name {
  font-weight: 700;
  letter-spacing: 0.2px;
  color: var(--brand-seal-deep);
}
.check {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 13px;
  height: 13px;
  border-radius: 999px;
  background: var(--brand-seal);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 13px;
  text-align: center;
}

/* ---------- Warning 条 ---------- */
.warning-bar {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 8px;
  padding: 7px 10px;
  border-left: 3px solid var(--warning);
  border-radius: 4px;
  background: var(--warning-soft);
  font-size: 11px;
  color: var(--warning);
  line-height: 1.45;
}
.wb-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

/* ---------- 证件槽位 ---------- */
.slot-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.slot-card {
  padding: 10px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--paper-card);
}
.slot-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
}
.slot-no {
  flex-shrink: 0;
  font-family: var(--font-num);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--ink-secondary);
  background: var(--paper-inset);
  border-radius: 3px;
  height: 16px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
}
.badge-check {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--success-soft);
  color: var(--success);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.slot-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: var(--ink-strong);
}
.slot-size {
  margin-left: auto;
  font-family: var(--font-num);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ink-placeholder);
  font-variant-numeric: tabular-nums;
}
.slot-preset {
  width: 100%;
  margin-bottom: 8px;
}
.custom-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}
.custom-row .x {
  color: var(--ink-secondary);
}
.custom-row :deep(.el-input-number) {
  flex: 1;
  min-width: 0;
}
.slot-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 8px;
  border: 1.5px dashed var(--line-strong);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.slot-empty:hover {
  border-color: var(--ink-blue);
}
.se-plus {
  font-size: 14px;
  color: var(--ink-placeholder);
  line-height: 1;
}
.se-text {
  font-size: 11px;
  color: var(--ink-body);
}
.se-size {
  font-size: 10px;
  font-family: var(--font-num);
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ink-placeholder);
  font-variant-numeric: tabular-nums;
}
.slot-file {
  display: flex;
  align-items: center;
  gap: 6px;
}
.slot-file .file-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: var(--ink-strong);
  white-space: nowrap;
  overflow: hidden;
}
.slot-file .file-name .fnt {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tag-edited {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--success);
  background: var(--success-soft);
  border-radius: 3px;
  padding: 0 4px;
  height: 16px;
  line-height: 16px;
}

/* ---------- 打印设置 ---------- */
.setting-row {
  display: flex;
  align-items: center;
  min-height: 32px;
  margin-bottom: 8px;
  gap: 8px;
}
.sr-label {
  font-size: 13px;
  color: var(--ink-body);
  flex-shrink: 0;
}
.sr-control {
  margin-left: auto;
  flex-shrink: 0;
}
</style>