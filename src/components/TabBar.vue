<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import type { TabKey } from '@/types'

const ui = useUiStore()
const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'invoice', label: '发票' },
  { key: 'ticket', label: '车票' },
  { key: 'id', label: '证件' }
]
</script>

<template>
  <div class="tab-bar no-print">
    <div
      v-for="t in tabs"
      :key="t.key"
      class="tab-item"
      :class="{ active: ui.activeTab === t.key }"
      @click="ui.setTab(t.key)"
    >
      {{ t.label }}
    </div>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  align-items: stretch;
  height: 44px;
  flex-shrink: 0;
  background: var(--paper-panel);
  border-bottom: 1px solid var(--line-base);
  padding: 0 8px;
}
.tab-item {
  display: flex;
  align-items: center;
  padding: 0 16px;
  margin-bottom: -1px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-secondary);
  border-bottom: 2px solid transparent;
  transition:
    color 0.15s,
    background 0.15s;
}
.tab-item:hover {
  color: var(--ink-strong);
  background: var(--paper-hover);
  border-radius: 6px 6px 0 0;
}
.tab-item.active {
  color: var(--brand-seal);
  font-weight: 700;
  border-bottom-color: var(--brand-seal);
}
.tab-item.active:hover {
  color: var(--brand-seal);
  background: transparent;
}
</style>