import { defineStore } from 'pinia'
import { LS_KEYS } from '@/units'
import { storageGet, storageSet } from '@/utils/canvas-helpers'
import type { Corner } from '@/types'

type Slot = 0 | 1 | 2 | 3

interface PerspectiveState {
  corners: Record<Slot, Corner[]>
}

function emptyCorners(): Corner[] {
  return [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 }
  ]
}

function loadCorners(slot: Slot): Corner[] {
  return storageGet<Corner[] | null>(LS_KEYS.perspective(slot), null) || emptyCorners()
}

export const usePerspectiveStore = defineStore('perspective', {
  state: (): PerspectiveState => ({
    corners: {
      0: loadCorners(0),
      1: loadCorners(1),
      2: loadCorners(2),
      3: loadCorners(3)
    }
  }),
  actions: {
    /** 设置角点坐标（边界由调用方校验） */
    setCorner(slot: Slot, idx: 0 | 1 | 2 | 3, x: number, y: number) {
      const arr = this.corners[slot]
      arr[idx] = { x, y }
      storageSet(LS_KEYS.perspective(slot), arr)
    },
    /** 重置某槽位角点 */
    reset(slot: Slot) {
      this.corners[slot] = emptyCorners()
      storageSet(LS_KEYS.perspective(slot), this.corners[slot])
    },
    /** 初始化某槽位角点为图像四角 */
    initFromImage(slot: Slot, w: number, h: number) {
      const arr = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h }
      ]
      this.corners[slot] = arr
      storageSet(LS_KEYS.perspective(slot), arr)
    },
    getCorners(slot: Slot): Corner[] {
      return this.corners[slot]
    }
  }
})