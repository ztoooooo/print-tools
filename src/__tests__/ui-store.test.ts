/**
 * ui.ts store 单测
 * 验证 activeTab / orientation / colorMode / copies setter + 持久化
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '@/stores/ui'
import { LS_KEYS } from '@/units'

describe('ui store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('state 默认值：invoice / portrait / color / 1', () => {
    const ui = useUiStore()
    expect(ui.activeTab).toBe('invoice')
    expect(ui.orientation).toBe('portrait')
    expect(ui.colorMode).toBe('color')
    expect(ui.copies).toBe(1)
  })

  it('setTab 切换 activeTab', () => {
    const ui = useUiStore()
    ui.setTab('ticket')
    expect(ui.activeTab).toBe('ticket')
    ui.setTab('id')
    expect(ui.activeTab).toBe('id')
  })

  it('toggleOrientation 翻转 portrait/landscape', () => {
    const ui = useUiStore()
    expect(ui.orientation).toBe('portrait')
    ui.toggleOrientation()
    expect(ui.orientation).toBe('landscape')
    ui.toggleOrientation()
    expect(ui.orientation).toBe('portrait')
  })

  it('toggleOrientation 持久化到 localStorage', () => {
    const ui = useUiStore()
    ui.toggleOrientation()
    expect(localStorage.getItem(LS_KEYS.orientation)).toBe('"landscape"')
  })

  it('setColorMode 切换并持久化', () => {
    const ui = useUiStore()
    ui.setColorMode('bw')
    expect(ui.colorMode).toBe('bw')
    expect(localStorage.getItem(LS_KEYS.colorMode)).toBe('"bw"')
  })

  it('setCopies 持久化 + 限制 ≥1', () => {
    const ui = useUiStore()
    ui.setCopies(5)
    expect(ui.copies).toBe(5)
    expect(localStorage.getItem(LS_KEYS.copies)).toBe('5')

    ui.setCopies(0)
    expect(ui.copies).toBe(1) // 最低 1

    ui.setCopies(-3)
    expect(ui.copies).toBe(1)

    ui.setCopies(NaN as any)
    expect(ui.copies).toBe(1)
  })

  it('state 初始化时从 localStorage 读取持久化值', () => {
    localStorage.setItem(LS_KEYS.orientation, '"landscape"')
    localStorage.setItem(LS_KEYS.colorMode, '"bw"')
    localStorage.setItem(LS_KEYS.copies, '7')
    setActivePinia(createPinia())
    const ui = useUiStore()
    expect(ui.orientation).toBe('landscape')
    expect(ui.colorMode).toBe('bw')
    expect(ui.copies).toBe(7)
  })
})