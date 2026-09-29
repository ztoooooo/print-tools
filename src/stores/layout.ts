import { defineStore } from 'pinia'
import { LS_KEYS } from '@/units'
import { storageGet, storageSet } from '@/utils/canvas-helpers'
import type { IdMode, InvoiceMode, TicketMode } from '@/types'

interface LayoutState {
  invoice: InvoiceMode
  ticket: TicketMode
  id: IdMode
}

const keyMap: Record<'invoice' | 'ticket' | 'id', string> = {
  invoice: LS_KEYS.invoiceLayout,
  ticket: LS_KEYS.ticketLayout,
  id: LS_KEYS.idLayout
}

/** 各 Tab 合法的排版模式白名单 */
const VALID_MODES = {
  invoice: ['single', 'double', 'merge2', 'auto'],
  ticket: ['single', 'top-bottom', 'left-right', 'grid2x2'],
  id: ['double-col', 'double-row', 'center', 'auto']
} as const

/**
 * 读取并校验持久化的排版模式。
 * localStorage 可能残留旧版本/被手工改坏的值，非法值一律回落到默认值，
 * 否则排版引擎会因未知模式返回 undefined 导致界面崩溃。
 */
function loadMode<T extends string>(tab: keyof typeof VALID_MODES, fallback: T): T {
  const raw = storageGet<string>(keyMap[tab], fallback)
  const allowed: readonly string[] = VALID_MODES[tab]
  return (allowed.includes(raw) ? raw : fallback) as T
}

export const useLayoutStore = defineStore('layout', {
  state: (): LayoutState => ({
    invoice: loadMode<InvoiceMode>('invoice', 'single'),
    ticket: loadMode<TicketMode>('ticket', 'single'),
    id: loadMode<IdMode>('id', 'double-col')
  }),
  actions: {
    setMode(tab: 'invoice' | 'ticket' | 'id', mode: InvoiceMode | TicketMode | IdMode) {
      // 非法模式直接忽略，避免污染状态
      const allowed: readonly string[] = VALID_MODES[tab]
      if (!allowed.includes(mode)) return
      ;(this as any)[tab] = mode
      storageSet(keyMap[tab], mode)
    },
    hydrate() {
      // Pinia 已通过 state 默认值读取 localStorage，无需额外动作
    }
  }
})