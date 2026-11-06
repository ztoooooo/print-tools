<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import dayjs from 'dayjs'
import { useFilesStore } from '@/stores/files'
import { useLayoutStore } from '@/stores/layout'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { downloadBlob, exportPdf } from '@/utils/pdf-export'
import { layoutId, layoutInvoice, layoutTicket } from '@/utils/canvas-helpers'
import { confirm, toast } from '@/utils/canvas-helpers'
import { printDocument, isDbxPlugin } from '@/utils/host'
import TopMenu from './components/TopMenu.vue'
import TabBar from './components/TabBar.vue'
import LeftPanel from './components/LeftPanel.vue'
import PreviewCanvas from './components/PreviewCanvas.vue'
import SettingsPage from './components/SettingsPage.vue'
import AboutPage from './components/AboutPage.vue'

const ui = useUiStore()
const files = useFilesStore()
const layout = useLayoutStore()
const settings = useSettingsStore()

const hasFiles = computed(() => {
  if (ui.activeTab === 'id') return files.id.some((s) => s.page !== null)
  return files[ui.activeTab as 'invoice' | 'ticket'].length > 0
})

const currentLayouts = computed(() => {
  if (ui.activeTab === 'invoice') return layoutInvoice(files.invoice, layout.invoice, ui.orientation)
  if (ui.activeTab === 'ticket') return layoutTicket(files.ticket, layout.ticket, ui.orientation)
  return layoutId(files.id, layout.id, ui.orientation)
})

/** 实际有内容的页数（空页不计入） */
const pageCount = computed(() => currentLayouts.value.filter((p) => p.items.length > 0).length)

/** 当前 Tab 的水印参数（无则 undefined） */
const pdfWatermark = computed(() => {
  if (!settings.shouldDraw(ui.activeTab)) return undefined
  const wm = settings.watermark
  return {
    text: wm.text,
    fontSizeRatio: wm.fontSizeRatio,
    opacity: wm.opacity,
    color: wm.color
  }
})

async function handlePrint() {
  if (!hasFiles.value || currentLayouts.value.every((p) => p.items.length === 0)) {
    await confirm('请先添加文件', '提示')
    return
  }
  // DBX 插件沙箱：iframe 仅 allow-scripts（无 allow-modals），Chromium 会静默忽略
  // 原生打印调用，且 Host API 没有打印能力 → 直接走「另存 PDF」（原生保存对话框可用），
  // 保存后从系统打开 PDF 打印。
  if (isDbxPlugin()) {
    toast('插件沙箱不支持弹出打印窗口，已改为「另存 PDF」，保存后在系统中打印', 'info')
    await handleExportPdf()
    return
  }
  // 打印份数（Web 浏览器环境）
  for (let i = 0; i < ui.copies; i++) {
    const ok = printDocument()
    if (!ok) {
      toast('当前环境不支持直接打印，请改用「另存 PDF」后打印', 'warning')
      break
    }
  }
}

async function handleExportPdf() {
  if (!hasFiles.value || currentLayouts.value.every((p) => p.items.length === 0)) {
    await confirm('请先添加文件', '提示')
    return
  }
  try {
    const blob = await exportPdf(currentLayouts.value, ui.orientation, pdfWatermark.value)
    const filename = `print-${dayjs().format('YYYYMMDD-HHmmss')}.pdf`
    const result = await downloadBlob(blob, filename)
    if (result?.cancelled) {
      toast('已取消保存', 'info')
    } else {
      toast(`已导出 ${filename}`, 'success')
    }
  } catch (e: any) {
    toast(`导出失败：${e?.message || e}`, 'error')
  }
}

/* ---------------- 底部工具栏快捷键 ---------------- */

/** Ctrl/Cmd+P 打印、Ctrl/Cmd+S 另存 PDF（拦截浏览器默认行为；输入框聚焦时不触发） */
function onGlobalKeyDown(e: KeyboardEvent) {
  if (e.repeat) return
  if (!(e.ctrlKey || e.metaKey)) return
  const ae = document.activeElement as HTMLElement | null
  const typing =
    ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)
  if (typing) return
  if (e.key === 'p' || e.key === 'P') {
    e.preventDefault()
    handlePrint()
  } else if (e.key === 's' || e.key === 'S') {
    e.preventDefault()
    handleExportPdf()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeyDown))
</script>

<template>
  <div class="app-root">
    <TopMenu />
    <TabBar />
    <main class="app-main">
      <LeftPanel />
      <PreviewCanvas />
    </main>
    <footer class="app-footer no-print">
      <el-button class="lp-btn-seal" :disabled="!hasFiles" title="打印 (Ctrl+P)" @click="handlePrint">
        打印
      </el-button>
      <el-button
        class="lp-btn-outline-blue"
        :disabled="!hasFiles"
        title="另存 PDF (Ctrl+S)"
        @click="handleExportPdf"
      >
        另存 PDF
      </el-button>
      <div class="status-info tabular">
        <span v-if="ui.activeTab === 'invoice'"><b>{{ files.invoice.length }}</b> 张</span>
        <span v-else-if="ui.activeTab === 'ticket'"><b>{{ files.ticket.length }}</b> 张</span>
        <span v-else><b>{{ files.id.filter((s) => s.page).length }}/4</b> 槽位</span>
        <span class="sep">·</span>
        <span>{{ ui.orientation === 'portrait' ? 'A4 纵向' : 'A4 横向' }}</span>
        <span class="sep">·</span>
        <span>{{ ui.colorMode === 'color' ? '彩色' : '黑白' }}</span>
        <span class="sep">·</span>
        <span><b>{{ ui.copies }}</b> 份</span>
        <span class="sep">·</span>
        <span>共 <b>{{ pageCount }}</b> 页</span>
      </div>
    </footer>

    <!-- 设置 / 关于 弹窗（工作台保持常驻） -->
    <SettingsPage />
    <AboutPage />
  </div>
</template>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--app-bg);
}
.app-main {
  flex: 1;
  display: flex;
  min-height: 0;
}
.app-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 16px;
  background: var(--paper-panel);
  border-top: 1px solid var(--line-base);
  flex-shrink: 0;
}
.status-info {
  margin-left: auto;
  color: var(--ink-secondary);
  font-size: 11px;
  display: flex;
  gap: 0;
  align-items: center;
}
.status-info b {
  font-weight: 700;
  color: var(--ink-body);
}
.sep {
  color: var(--line-strong);
  padding: 0 4px;
}
</style>
