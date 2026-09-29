<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useFilesStore } from '@/stores/files'
import { useLayoutStore } from '@/stores/layout'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { downloadBlob, exportPdf } from '@/utils/pdf-export'
import { layoutId, layoutInvoice, layoutTicket } from '@/utils/canvas-helpers'
import { confirm, toast } from '@/utils/canvas-helpers'
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
  // 打印份数
  for (let i = 0; i < ui.copies; i++) {
    window.print()
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
    downloadBlob(blob, filename)
    toast(`已导出 ${filename}`, 'success')
  } catch (e: any) {
    toast(`导出失败：${e?.message || e}`, 'error')
  }
}
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
      <el-button class="lp-btn-seal" :disabled="!hasFiles" @click="handlePrint">打印</el-button>
      <el-button class="lp-btn-outline-blue" :disabled="!hasFiles" @click="handleExportPdf">
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
