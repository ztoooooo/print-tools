/**
 * PreviewCanvas 多页翻页预览 —— 组件级行为测试
 *
 * 覆盖：
 * 1. 多于一页时出现页码导航；单页模式只渲染当前页（其余用 class 隐藏而非卸载）
 * 2. 上一页 / 下一页 / 页码跳转 + 越界钳制
 * 3. 「连续滚动」模式恢复显示全部页（打印链路依赖所有页都在 DOM 中）
 * 4. 证件 Tab：四点编辑器只挂载在当前槽位所在页，切槽位自动翻页
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import PreviewCanvas from '@/components/PreviewCanvas.vue'
import PerspectiveEditor from '@/components/PerspectiveEditor.vue'
import { useFilesStore } from '@/stores/files'
import { useLayoutStore } from '@/stores/layout'
import { useUiStore } from '@/stores/ui'
import { layoutId, layoutInvoice, layoutTicket } from '@/utils/canvas-helpers'
import { makePage, makeSlot } from './fixtures'
import type { IdMode, InvoiceMode, TabKey, TicketMode } from '@/types'

interface Ctx {
  wrapper: VueWrapper<any>
  files: ReturnType<typeof useFilesStore>
  layout: ReturnType<typeof useLayoutStore>
  ui: ReturnType<typeof useUiStore>
}

async function setup(setupFn: (s: Omit<Ctx, 'wrapper'>) => void): Promise<Ctx> {
  const pinia = createPinia()
  setActivePinia(pinia)
  const files = useFilesStore()
  const layout = useLayoutStore()
  const ui = useUiStore()
  setupFn({ files, layout, ui })
  const wrapper = mount(PreviewCanvas, { global: { plugins: [pinia] } })
  await nextTick()
  await nextTick()
  return { wrapper, files, layout, ui }
}

function pagerValue(wrapper: VueWrapper<any>): string {
  return (wrapper.find('.pager-input').element as HTMLInputElement).value
}

function hiddenPages(wrapper: VueWrapper<any>): number {
  return wrapper.findAll('.page-wrapper.page-off').length
}

/** 当前可见页的下标（单页模式下应恒为 currentPage - 1） */
function visiblePageIndex(wrapper: VueWrapper<any>): number {
  return wrapper.findAll('.page-wrapper').findIndex((w) => !w.classes('page-off'))
}

function buttonByText(wrapper: VueWrapper<any>, text: string) {
  const btn = wrapper.findAll('button').find((b) => b.text().replace(/\s/g, '') === text)
  if (!btn) throw new Error(`未找到按钮：${text}`)
  return btn
}

/** 5 张 200×300mm 的发票：auto 模式每页 1 张 → 5 页 */
function seedFiveInvoices() {
  return (s: Omit<Ctx, 'wrapper'>) => {
    s.layout.invoice = 'auto' as InvoiceMode
    s.files.invoice.push(...Array.from({ length: 5 }, (_, i) => makePage(`inv-${i}.jpg`)))
  }
}

describe('PreviewCanvas 翻页预览', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('多页时出现页码导航，并显示 第 1 / N 页', async () => {
    const { wrapper } = await setup(seedFiveInvoices())
    expect(wrapper.findAll('.page-wrapper').length).toBe(5)
    expect(wrapper.find('.pager').exists()).toBe(true)
    expect(wrapper.text()).toContain('/ 5 页')
    expect(pagerValue(wrapper)).toBe('1')
  })

  it('单页模式只显示当前页（其余保留在 DOM 中，仅隐藏）', async () => {
    const { wrapper } = await setup(seedFiveInvoices())
    expect(hiddenPages(wrapper)).toBe(4)
    // 关键：隐藏页仍在 DOM 里，打印时才能全部输出
    expect(wrapper.findAll('.page-wrapper canvas').length).toBe(5)
  })

  it('「下一页」「上一页」正常翻页且首末页按钮禁用', async () => {
    const { wrapper } = await setup(seedFiveInvoices())

    const prev = buttonByText(wrapper, '上一页')
    const next = buttonByText(wrapper, '下一页')
    expect(prev.attributes('disabled')).toBeDefined()
    expect(next.attributes('disabled')).toBeUndefined()

    await next.trigger('click')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('2')
    expect(visiblePageIndex(wrapper)).toBe(1)
    expect(next.attributes('disabled')).toBeUndefined()

    await buttonByText(wrapper, '上一页').trigger('click')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('1')
    expect(visiblePageIndex(wrapper)).toBe(0)

    await buttonByText(wrapper, '末页').trigger('click')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('5')
    expect(visiblePageIndex(wrapper)).toBe(4)
    expect(buttonByText(wrapper, '下一页').attributes('disabled')).toBeDefined()

    await buttonByText(wrapper, '首页').trigger('click')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('1')
    expect(visiblePageIndex(wrapper)).toBe(0)
  })

  it('页码输入可跳转，越界自动钳制到合法范围，非法输入保持原页', async () => {
    const { wrapper } = await setup(seedFiveInvoices())
    const input = wrapper.find('.pager-input')

    await input.setValue('4')
    await input.trigger('blur')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('4')
    expect(visiblePageIndex(wrapper)).toBe(3)

    await input.setValue('99')
    await input.trigger('blur')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('5')
    expect(visiblePageIndex(wrapper)).toBe(4)

    // 0 / 非数字 → 视为非法，停留在当前页
    await input.setValue('0')
    await input.trigger('blur')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('5')

    await input.setValue('abc')
    await input.trigger('blur')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('5')
    expect(visiblePageIndex(wrapper)).toBe(4)

    await buttonByText(wrapper, '首页').trigger('click')
    await nextTick()
    await input.setValue('0')
    await input.trigger('blur')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('1')
  })

  it('「连续滚动」模式显示全部页，切回单页仍停留在原页', async () => {
    const { wrapper } = await setup(seedFiveInvoices())

    await buttonByText(wrapper, '下一页').trigger('click')
    await nextTick()
    expect(visiblePageIndex(wrapper)).toBe(1)

    await buttonByText(wrapper, '连续滚动').trigger('click')
    await nextTick()
    expect(hiddenPages(wrapper)).toBe(0)

    await buttonByText(wrapper, '单页翻页').trigger('click')
    await nextTick()
    expect(hiddenPages(wrapper)).toBe(4)
    expect(pagerValue(wrapper)).toBe('2')
    expect(visiblePageIndex(wrapper)).toBe(1)
  })

  it('只有一页时不显示页码导航', async () => {
    const { wrapper } = await setup((s) => {
      s.layout.invoice = 'single' as InvoiceMode
      s.files.invoice.push(makePage('one.jpg'))
    })
    expect(wrapper.findAll('.page-wrapper').length).toBe(1)
    expect(wrapper.find('.pager').exists()).toBe(false)
  })

  it('空内容时不显示页码导航', async () => {
    const { wrapper } = await setup(() => {})
    expect(wrapper.find('.pager').exists()).toBe(false)
  })

  it('删除文件导致页数减少时，页码自动回收而不越界', async () => {
    const { wrapper, files } = await setup(seedFiveInvoices())
    await buttonByText(wrapper, '末页').trigger('click')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('5')

    files.invoice.splice(0, 3)
    await nextTick()
    await nextTick()
    expect(wrapper.findAll('.page-wrapper').length).toBe(2)
    expect(pagerValue(wrapper)).toBe('2')
  })

  it('三 Tab 页码独立：切换 Tab 后回到第 1 页且文件互不影响', async () => {
    const { wrapper, files, layout, ui } = await setup(seedFiveInvoices())
    await buttonByText(wrapper, '末页').trigger('click')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('5')

    layout.ticket = 'top-bottom' as TicketMode // 每 2 张一页 → 3 张 = 2 页
    files.ticket.push(makePage('t-0.jpg'), makePage('t-1.jpg'), makePage('t-2.jpg'))
    ui.activeTab = 'ticket' as TabKey
    await nextTick()
    await nextTick()

    expect(wrapper.findAll('.page-wrapper').length).toBe(2)
    expect(pagerValue(wrapper)).toBe('1')
    expect(visiblePageIndex(wrapper)).toBe(0)

    // 回到发票 Tab，页码同样是第 1 页（不沿用上一个 Tab 的页码）
    ui.activeTab = 'invoice' as TabKey
    await nextTick()
    await nextTick()
    expect(wrapper.findAll('.page-wrapper').length).toBe(5)
    expect(pagerValue(wrapper)).toBe('1')
  })
})

describe('PreviewCanvas × PerspectiveEditor 分页联动', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  function seedFourSlots() {
    return (s: Omit<Ctx, 'wrapper'>) => {
      s.ui.activeTab = 'id' as TabKey
      s.layout.id = 'double-row' as IdMode // 每页 2 张 → 2 页
      const filled = [
        makeSlot(0, makePage('a.jpg')),
        makeSlot(1, makePage('b.jpg')),
        makeSlot(2, makePage('c.jpg')),
        makeSlot(3, makePage('d.jpg'))
      ]
      s.files.id = filled
    }
  }

  it('4 个槽位 / 双行模式：只挂载一个编辑器，且落在第 1 页', async () => {
    const { wrapper } = await setup(seedFourSlots())
    expect(wrapper.findAll('.page-wrapper').length).toBe(2)
    const editors = wrapper.findAllComponents(PerspectiveEditor)
    expect(editors.length).toBe(1)
    // 编辑器挂载在第一个 page-wrapper 内
    expect(wrapper.findAll('.page-wrapper')[0].findComponent(PerspectiveEditor).exists()).toBe(true)
    expect(hiddenPages(wrapper)).toBe(1)
  })

  it('切换到第 3 个槽位时自动翻到它所在的第 2 页', async () => {
    const { wrapper } = await setup(seedFourSlots())
    const radios = wrapper.find('.pe-toolbar').findAll('input[type="radio"]')
    expect(radios.length).toBe(4)

    await radios[2].setValue()
    await nextTick()
    await nextTick()

    expect(pagerValue(wrapper)).toBe('2')
    expect(hiddenPages(wrapper)).toBe(1)
    expect(wrapper.findAll('.page-wrapper')[1].findComponent(PerspectiveEditor).exists()).toBe(
      true
    )
  })

  it('证件 Tab 没有图片时不渲染编辑器（避免空状态出现无用工具条）', async () => {
    const { wrapper } = await setup((s) => {
      s.ui.activeTab = 'id' as TabKey
    })
    expect(wrapper.findAllComponents(PerspectiveEditor).length).toBe(0)
  })

  it('翻页时自动选中该页第一个槽位（编辑器始终可见）', async () => {
    const { wrapper } = await setup(seedFourSlots())
    await buttonByText(wrapper, '下一页').trigger('click')
    await nextTick()
    await nextTick()
    expect(pagerValue(wrapper)).toBe('2')
    const editors = wrapper.findAllComponents(PerspectiveEditor)
    expect(editors.length).toBe(1)
    expect(
      (editors[0].props('activeSlot') as number) === 2 || (editors[0].props('activeSlot') as number) === 3
    ).toBe(true)
  })
})

describe('排版模式健壮性（损坏的持久化配置不应导致崩溃）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('非法持久化值会被回落到默认模式', () => {
    localStorage.setItem('lpt/v1/ticketLayout', JSON.stringify('grid3x3'))
    localStorage.setItem('lpt/v1/invoiceLayout', JSON.stringify(123))
    localStorage.setItem('lpt/v1/idLayout', JSON.stringify(null))
    const pinia = createPinia()
    setActivePinia(pinia)
    const layout = useLayoutStore()
    expect(layout.ticket).toBe('single')
    expect(layout.invoice).toBe('single')
    expect(layout.id).toBe('double-col')
  })

  it('setMode 忽略非法模式，不污染状态', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const layout = useLayoutStore()
    layout.setMode('invoice', 'nope' as unknown as InvoiceMode)
    expect(layout.invoice).toBe('single')
  })

  it('排版引擎对未知模式也始终返回数组（不会白屏）', () => {
    const p = makePage('x.jpg')
    // 故意绕过类型校验传入非法模式，验证运行时兜底
    const bogus = 'bogus' as never
    expect(Array.isArray(layoutInvoice([p], bogus))).toBe(true)
    expect(Array.isArray(layoutTicket([p], bogus))).toBe(true)
    expect(Array.isArray(layoutId([makeSlot(0, p)], bogus))).toBe(true)
    // 空输入同样返回可渲染的占位页
    expect(layoutInvoice([], bogus).length).toBe(1)
    expect(layoutId([makeSlot(0, null)], bogus).length).toBe(1)
  })
})

/**
 * 回归：单张居中 / 双打（复制两份）此前硬编码只取第 1 张且恒定返回 1 页，
 * 导致多文件时既看不到分页条，也只有首张参与预览/打印/导出。
 */
describe('【修复验证】单张 / 双打 模式逐张分页', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  /** N 张票据 + 指定排版模式（同时切到对应 Tab） */
  function seedN(mode: 'single' | 'double', n: number, tab: 'invoice' | 'ticket' = 'invoice') {
    return (s: Omit<Ctx, 'wrapper'>) => {
      const pages = Array.from({ length: n }, (_, i) => makePage(`${tab}-${i}.jpg`))
      if (tab === 'invoice') {
        s.layout.invoice = mode as InvoiceMode
        s.files.invoice.push(...pages)
      } else {
        s.layout.ticket = mode as TicketMode
        s.files.ticket.push(...pages)
      }
      s.ui.activeTab = tab as TabKey
    }
  }

  it('发票「单张居中」：5 张 → 5 页，并出现分页条', async () => {
    const { wrapper } = await setup(seedN('single', 5))
    expect(wrapper.findAll('.page-wrapper').length).toBe(5)
    expect(wrapper.find('.pager').exists()).toBe(true)
    expect(pagerValue(wrapper)).toBe('1')
  })

  it('发票「双打」：5 张 → 5 页，并出现分页条', async () => {
    const { wrapper } = await setup(seedN('double', 5))
    expect(wrapper.findAll('.page-wrapper').length).toBe(5)
    expect(wrapper.find('.pager').exists()).toBe(true)
  })

  it('车票「单张居中」：5 张 → 5 页，并出现分页条', async () => {
    const { wrapper } = await setup(seedN('single', 5, 'ticket'))
    expect(wrapper.findAll('.page-wrapper').length).toBe(5)
    expect(wrapper.find('.pager').exists()).toBe(true)
  })

  it('单张 / 双打 模式下翻页可用，末页按钮正确禁用', async () => {
    const { wrapper } = await setup(seedN('single', 3))
    await buttonByText(wrapper, '末页').trigger('click')
    await nextTick()
    expect(pagerValue(wrapper)).toBe('3')
    expect(buttonByText(wrapper, '下一页').attributes('disabled')).toBeDefined()
    expect(visiblePageIndex(wrapper)).toBe(2)
  })
})
