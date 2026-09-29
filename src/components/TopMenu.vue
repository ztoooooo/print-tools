<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { useFilesStore } from '@/stores/files'
import { useUiStore } from '@/stores/ui'
import { toast } from '@/utils/canvas-helpers'

const files = useFilesStore()
const ui = useUiStore()

async function resetAll() {
  try {
    await ElMessageBox.confirm(
      '确定要清空三个 Tab 中的全部文件吗？\n此操作不可撤销，已配置的排版模式将被保留。',
      '重置全部',
      {
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--warning'
      }
    )
  } catch {
    return // 用户点击了取消
  }
  ;(Object.keys(files.$state) as Array<'invoice' | 'ticket' | 'id'>).forEach((tab) => {
    files.clear(tab)
  })
  toast('已清空所有文件', 'success')
}
</script>

<template>
  <div class="top-menu no-print">
    <span class="brand-mark" aria-hidden="true">印</span>
    <span class="brand-title">票据打印</span>
    <span class="brand-sub">本地 · 离线可用</span>
    <div class="top-menu-spacer" />
    <el-button class="lp-btn-outline-warning" size="small" @click="resetAll">
      重置全部
    </el-button>
    <el-button size="small" @click="ui.openDialog('settings')">设置</el-button>
    <el-button size="small" @click="ui.openDialog('about')">关于</el-button>
  </div>
</template>

<style scoped>
.top-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  flex-shrink: 0;
  background: var(--paper-panel);
  border-bottom: 1px solid var(--line-base);
  padding: 0 16px;
}
.brand-mark {
  width: 22px;
  height: 22px;
  border-radius: 3px;
  background: var(--brand-seal);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.brand-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--ink-strong);
}
.brand-sub {
  font-size: 11px;
  color: var(--ink-placeholder);
  margin-left: 2px;
}
.top-menu-spacer {
  flex: 1;
}
</style>
