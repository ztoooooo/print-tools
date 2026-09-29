import { defineStore } from 'pinia'
import { LS_KEYS } from '@/units'
import { storageGet, storageSet } from '@/utils/canvas-helpers'
import type { ColorMode, DialogKind, Orientation, TabKey } from '@/types'

interface UiState {
  /** 当前打开的弹窗（null = 无弹窗，工作台常驻） */
  activeDialog: DialogKind | null
  activeTab: TabKey
  orientation: Orientation
  colorMode: ColorMode
  copies: number
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    activeDialog: null,
    activeTab: storageGet<TabKey>(LS_KEYS.activeTab, 'invoice'),
    orientation: storageGet<Orientation>(LS_KEYS.orientation, 'portrait'),
    colorMode: storageGet<ColorMode>(LS_KEYS.colorMode, 'color'),
    copies: storageGet<number>(LS_KEYS.copies, 1)
  }),
  actions: {
    openDialog(d: DialogKind) {
      this.activeDialog = d
    },
    closeDialog() {
      this.activeDialog = null
    },
    setTab(k: TabKey) {
      this.activeTab = k
      storageSet(LS_KEYS.activeTab, k)
    },
    toggleOrientation() {
      this.orientation = this.orientation === 'portrait' ? 'landscape' : 'portrait'
      storageSet(LS_KEYS.orientation, this.orientation)
    },
    setOrientation(o: Orientation) {
      this.orientation = o
      storageSet(LS_KEYS.orientation, o)
    },
    setColorMode(m: ColorMode) {
      this.colorMode = m
      storageSet(LS_KEYS.colorMode, m)
    },
    setCopies(n: number) {
      const v = Math.max(1, Math.floor(n) || 1)
      this.copies = v
      storageSet(LS_KEYS.copies, v)
    }
  }
})
