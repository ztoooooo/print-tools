/**
 * LeftPanel 组件级测试
 *
 * 覆盖两处用户反馈：
 *  1. 证件 Tab 此前只有槽位网格、**没有任何上传入口**，无法上传内容
 *  2. 文件列表的「旋转 / 删除」按钮此前是 el-button link 纯文字，视觉不突出
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LeftPanel from '@/components/LeftPanel.vue'
import { useFilesStore } from '@/stores/files'
import { useLayoutStore } from '@/stores/layout'
import { useUiStore } from '@/stores/ui'
import { makePage } from './fixtures'
import type { TabKey } from '@/types'

vi.mock('@/utils/canvas-helpers', async () => {
  const actual: any = await vi.importActual('@/utils/canvas-helpers')
  return { ...actual, toast: vi.fn(), confirmAction: vi.fn(async () => true) }
})

vi.mock('@/utils/file-parser', () => ({
  parseFile: vi.fn(async (file: File) => {
    const c = document.createElement('canvas')
    c.width = 100
    c.height = 100
    return [
      {
        id: `mock-${file.name}-${Math.random()}`,
        name: file.name,
        size: file.size,
        width: 100,
        height: 100,
        bitmap: c,
        rotation: 0 as const,
        mime: 'jpg' as const
      }
    ]
  })
}))

let counter = 0
function makeFile(name: string, size = 1024): File {
  counter++
  const blob = new Blob([new Uint8Array(size)], { type: 'image/jpeg' })
  return new File([blob], `${name}-${counter}-${Math.random().toString(36).slice(2)}`, {
    type: 'image/jpeg'
  })
}

interface Ctx {
  wrapper: VueWrapper<any>
  files: ReturnType<typeof useFilesStore>
  layout: ReturnType<typeof useLayoutStore>
  ui: ReturnType<typeof useUiStore>
}

function setup(tab: TabKey): Ctx {
  const pinia = createPinia()
  setActivePinia(pinia)
  const files = useFilesStore()
  const layout = useLayoutStore()
  const ui = useUiStore()
  ui.activeTab = tab
  const wrapper = mount(LeftPanel, { global: { plugins: [pinia] } })
  return { wrapper, files, layout, ui }
}

/** 往指定空槽位塞一个文件（走该槽位内的 file input） */
async function uploadToSlot(wrapper: VueWrapper<any>, slotIdx: number, file: File) {
  const box = wrapper.findAll('.slot-box')[slotIdx]
  const input = box.find('input[type="file"]')
  if (!input.exists()) throw new Error(`槽位 ${slotIdx} 没有上传入口（可能已被占用）`)
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

/** 拖拽文件到指定槽位（空 / 已占用都支持） */
async function dropOnSlot(wrapper: VueWrapper<any>, slotIdx: number, files: File[]) {
  const box = wrapper.findAll('.slot-box')[slotIdx]
  await box.trigger('drop', { dataTransfer: { files } })
  await flushPromises()
}

function btnByTitle(wrapper: VueWrapper<any>, titlePart: string) {
  const b = wrapper.findAll('button.act-btn').find((x) => (x.attributes('title') || '').includes(titlePart))
  if (!b) throw new Error(`未找到按钮：${titlePart}`)
  return b
}

describe('LeftPanel · 证件 Tab 上传能力', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('渲染 4 个槽位上传入口，每个都带 file input', () => {
    const { wrapper } = setup('id')
    const drops = wrapper.findAll('.slot-drop')
    expect(drops.length).toBe(4)
    for (const d of drops) {
      const input = d.find('input[type="file"]')
      expect(input.exists()).toBe(true)
      // 必须接受 PDF 与图片
      expect(input.attributes('accept')).toContain('.pdf')
      expect(input.attributes('accept')).toContain('image/*')
    }
    // 空槽位时不应出现操作按钮
    expect(wrapper.findAll('button.act-btn').length).toBe(0)
  })

  it('提供批量上传入口（自动填入空槽位）', () => {
    const { wrapper } = setup('id')
    // 4 个槽位 + 1 个批量
    expect(wrapper.findAll('input[type="file"]').length).toBe(5)
    const batch = wrapper.findAll('input[type="file"]')[0]
    expect(batch.attributes('multiple')).toBeDefined()
    expect(wrapper.text()).toContain('已填 0 / 4')
  })

  it('上传后该槽位变为「文件名 + 操作按钮」，其余槽位仍可上传', async () => {
    const { wrapper, files } = setup('id')
    await uploadToSlot(wrapper, 1, makeFile('id.jpg'))

    expect(files.id[1].page).not.toBeNull()
    expect(files.id[0].page).toBeNull()
    // 只剩 3 个可上传入口
    expect(wrapper.findAll('.slot-drop').length).toBe(3)
    // 上传的槽位显示文件名
    expect(wrapper.find('.slot-file').exists()).toBe(true)
    expect(wrapper.find('.slot-file .file-name').text()).toContain('id.jpg')
    // 计数更新
    expect(wrapper.text()).toContain('已填 1 / 4')
  })

  it('槽位「旋转」按钮：0° → 90° → 180°', async () => {
    const { wrapper, files } = setup('id')
    await uploadToSlot(wrapper, 0, makeFile('rot.jpg'))
    expect(files.id[0].page!.rotation).toBe(0)

    const rot = btnByTitle(wrapper, '旋转')
    expect(rot.text()).toContain('旋转 0°')

    await rot.trigger('click')
    expect(files.id[0].page!.rotation).toBe(90)
    expect(btnByTitle(wrapper, '旋转').text()).toContain('旋转 90°')

    await btnByTitle(wrapper, '旋转').trigger('click')
    expect(files.id[0].page!.rotation).toBe(180)
  })

  it('槽位「移除」按钮：清空该槽位并恢复上传入口', async () => {
    const { wrapper, files } = setup('id')
    await uploadToSlot(wrapper, 2, makeFile('rm.jpg'))
    expect(wrapper.findAll('.slot-drop').length).toBe(3)

    await btnByTitle(wrapper, '移除').trigger('click')
    expect(files.id[2].page).toBeNull()
    expect(wrapper.findAll('.slot-drop').length).toBe(4)
  })

  it('替换已占用槽位的图片：拖拽新图到该槽位即替换', async () => {
    const { wrapper, files } = setup('id')
    await uploadToSlot(wrapper, 0, makeFile('first.jpg'))
    const firstName = files.id[0].page!.name
    expect(firstName).toContain('first')

    await dropOnSlot(wrapper, 0, [makeFile('second.jpg')])
    expect(files.id[0].page!.name).not.toBe(firstName)
    expect(files.id[0].page!.name).toContain('second')
    // 替换不产生额外槽位占用
    expect(files.id.filter((s) => s.page).length).toBe(1)
  })

  it('拖拽到空槽位同样可上传', async () => {
    const { wrapper, files } = setup('id')
    await dropOnSlot(wrapper, 3, [makeFile('dropped.jpg')])
    expect(files.id[3].page).not.toBeNull()
    expect(files.id[3].page!.name).toContain('dropped')
    expect(files.id[0].page).toBeNull()
  })

  it('拖拽多个文件到某个槽位：按顺序填入空槽位', async () => {
    const { wrapper, files } = setup('id')
    await dropOnSlot(wrapper, 0, [makeFile('m1.jpg', 100), makeFile('m2.jpg', 200)])
    expect(files.id.filter((s) => s.page).length).toBe(2)
  })
})

describe('LeftPanel · 旋转 / 删除按钮视觉与行为', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('发票 Tab 不渲染证件槽位，但有批量上传入口', () => {
    const { wrapper } = setup('invoice')
    expect(wrapper.findAll('.slot-drop').length).toBe(0)
    expect(wrapper.findAll('input[type="file"][multiple]').length).toBe(1)
  })

  it('每个文件渲染「旋转」+「删除」两个独立按钮，且都带中文 title', async () => {
    const { wrapper, files } = setup('invoice')
    files.invoice.push(makePage('a.pdf'), makePage('b.pdf'))
    await wrapper.vm.$nextTick()

    const btns = wrapper.findAll('button.act-btn')
    expect(btns.length).toBe(4) // 2 个文件 × 2 个按钮

    // 旋转按钮：显示当前角度，title 说明动作
    const rotates = btns.filter((b) => b.classes('act-rotate'))
    const dels = btns.filter((b) => b.classes('act-del'))
    expect(rotates.length).toBe(2)
    expect(dels.length).toBe(2)

    for (const b of rotates) {
      expect(b.text()).toMatch(/旋转 \d+°/)
      expect(b.attributes('title')).toContain('旋转 90°')
      expect(b.attributes('type')).toBe('button')
    }
    for (const b of dels) {
      expect(b.text()).toBe('删除')
      expect(b.attributes('title')).toBeTruthy()
      expect(b.attributes('type')).toBe('button')
    }
  })

  it('按钮内的图标 SVG 处于 SVG 命名空间（图标能被正确渲染）', async () => {
    const { wrapper, files } = setup('invoice')
    files.invoice.push(makePage('icon.pdf'))
    await wrapper.vm.$nextTick()

    const svgs = wrapper.findAll('button.act-btn svg')
    expect(svgs.length).toBe(2)
    for (const s of svgs) {
      expect((s.element as SVGElement).namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect((s.element as SVGElement).querySelector('path')).not.toBeNull()
    }
  })

  it('点击旋转按钮更新 store 中的 rotation（0 → 90 → 180 → 270 → 0）', async () => {
    const { wrapper, files } = setup('invoice')
    const p = makePage('r.pdf')
    files.invoice.push(p)
    await wrapper.vm.$nextTick()

    for (const expectDeg of [90, 180, 270, 0]) {
      await btnByTitle(wrapper, '旋转').trigger('click')
      expect(files.invoice[0].rotation).toBe(expectDeg)
    }
  })

  it('点击删除按钮移除该文件', async () => {
    const { wrapper, files } = setup('invoice')
    files.invoice.push(makePage('x.pdf'), makePage('y.pdf'))
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.file-item').length).toBe(2)

    await btnByTitle(wrapper, '删除').trigger('click')
    expect(files.invoice.length).toBe(1)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.file-item').length).toBe(1)
  })

  it('空列表时显示占位提示，不渲染任何操作按钮', () => {
    const { wrapper } = setup('invoice')
    expect(wrapper.text()).toContain('暂无文件')
    expect(wrapper.findAll('button.act-btn').length).toBe(0)
  })
})
