import { defineStore } from 'pinia'
import { LS_KEYS } from '@/units'
import { storageGet, storageSet } from '@/utils/canvas-helpers'
import type { TabKey } from '@/types'

/** 水印应用范围 */
export type WatermarkScope = 'id-only' | 'all'

/** 水印配置 */
export interface WatermarkSettings {
  enabled: boolean
  text: string
  scope: WatermarkScope
  /** 字号占页面短边的比例分母（越大字越小，建议 15~40） */
  fontSizeRatio: number
  /** 不透明度 0~1 */
  opacity: number
  /** 颜色（十六进制） */
  color: string
}

interface SettingsState {
  watermark: WatermarkSettings
}

const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: true,
  text: '本地票据打印',
  scope: 'id-only',
  fontSizeRatio: 24,
  opacity: 0.05,
  color: '#000000'
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    watermark: {
      ...DEFAULT_WATERMARK,
      ...storageGet<{ watermark?: Partial<WatermarkSettings> }>(LS_KEYS.settings, {}).watermark
    }
  }),
  getters: {
    /** 指定 Tab 是否应该绘制水印 */
    shouldDraw: (state) => (tab: TabKey) => {
      if (!state.watermark.enabled || !state.watermark.text.trim()) return false
      if (state.watermark.scope === 'all') return true
      return tab === 'id'
    }
  },
  actions: {
    updateWatermark(patch: Partial<WatermarkSettings>) {
      this.watermark = { ...this.watermark, ...patch }
      this.persist()
    },
    resetWatermark() {
      this.watermark = { ...DEFAULT_WATERMARK }
      this.persist()
    },
    persist() {
      storageSet(LS_KEYS.settings, { watermark: this.watermark })
    }
  }
})
