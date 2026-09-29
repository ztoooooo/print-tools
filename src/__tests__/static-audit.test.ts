/**
 * 静态审计：WYSIWYG 三位一体 + opencv 懒加载 + 持久化范围
 *
 * 不依赖单元测试运行，而是读源码验证：
 * 1. PreviewCanvas / pdf-export / print 三链路都消费 layout() 输出
 * 2. perspective.ts 用 dynamic import
 * 3. main.ts 不静态引用 opencv
 * 4. localStorage 仅持久化配置，不持久化文件/bitmap
 */
import { describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const SRC_ROOT = path.resolve(__dirname, '..')

async function readSrc(rel: string): Promise<string> {
  return fs.readFile(path.join(SRC_ROOT, rel), 'utf-8')
}

describe('静态审计：WYSIWYG 三位一体', () => {
  it('PreviewCanvas.vue 调用 layout() + mmToPx 渲染', async () => {
    const src = await readSrc('components/PreviewCanvas.vue')
    expect(src).toMatch(/layoutInvoice|layoutTicket|layoutId/)
    expect(src).toMatch(/MM_TO_PX/)
    // 使用 layout 的 mm 输出
    expect(src).toMatch(/item\.xMM/)
    expect(src).toMatch(/item\.yMM/)
  })

  it('pdf-export.ts 调用 layout 输出且喂给 pdf-lib mm 坐标', async () => {
    const src = await readSrc('utils/pdf-export.ts')
    // 直接吃 LayoutPage[] 入参
    expect(src).toMatch(/pages:\s*LayoutPage\[\]/)
    // 使用 item.xMM / item.renderWMM
    expect(src).toMatch(/item\.xMM/)
    expect(src).toMatch(/item\.renderWMM|item\.renderHMM/)
    // 内部转换为 pdf-lib 坐标系（hMM - yMM - renderHMM）
    expect(src).toMatch(/hMM\s*-\s*item\.yMM/)
  })

  it('styles/index.scss：@media print 控制可见性，无第二个布局路径', async () => {
    const src = await readSrc('styles/index.scss')
    expect(src).toMatch(/@media\s+print/)
    expect(src).toMatch(/\.no-print/)
    expect(src).toMatch(/@page/)
  })

  it('App.vue 打印路径走 window.print()（不重新计算坐标）', async () => {
    const src = await readSrc('App.vue')
    expect(src).toMatch(/window\.print/)
    // 打印前应该先检查 currentLayouts（共用 layout 输出）
    expect(src).toMatch(/currentLayouts|layoutInvoice|layoutTicket|layoutId/)
  })
})

describe('静态审计：opencv 懒加载', () => {
  it('perspective.ts 使用 await import()', async () => {
    const src = await readSrc('utils/perspective.ts')
    expect(src).toMatch(/await\s+import\(/)
    // 不允许出现顶层静态 import opencv
    const top = src.split(/\n/).filter((l) => /^\s*import\b/.test(l))
    for (const line of top) {
      expect(line).not.toMatch(/opencv/i)
    }
  })

  it('main.ts 不静态引用 opencv', async () => {
    const src = await readSrc('main.ts')
    expect(src).not.toMatch(/opencv/i)
  })

  it('App.vue 不静态引用 opencv', async () => {
    const src = await readSrc('App.vue')
    expect(src).not.toMatch(/opencv/i)
  })

  it('vite.config.ts 在 optimizeDeps.include 强制预构建 opencv（必需）', async () => {
    const src = await readSrc('../vite.config.ts')
    expect(src).toMatch(/optimizeDeps/)
    expect(src).toMatch(/include/)
    expect(src).toMatch(/@techstark\/opencv-js/)
    // 不能再 exclude 它，否则 dev 下 ESM 命名空间为空
    expect(src).not.toMatch(/exclude:\s*\[[^\]]*opencv/)
  })
})

describe('静态审计：三 Tab 隔离', () => {
  it('files.ts 状态为 {invoice, ticket, id} 三独立数组', async () => {
    const src = await readSrc('stores/files.ts')
    expect(src).toMatch(/invoice:\s*ParsedPage\[\]/)
    expect(src).toMatch(/ticket:\s*ParsedPage\[\]/)
    expect(src).toMatch(/id:\s*ParsedSlot\[\]/)
  })

  it('layout.ts 状态为 {invoice, ticket, id} 三独立排版模式', async () => {
    const src = await readSrc('stores/layout.ts')
    expect(src).toMatch(/invoice:\s*InvoiceMode/)
    expect(src).toMatch(/ticket:\s*TicketMode/)
    expect(src).toMatch(/id:\s*IdMode/)
  })
})

describe('静态审计：边界处理', () => {
  it('files.ts addFiles 每个文件独立 try/catch', async () => {
    const src = await readSrc('stores/files.ts')
    // addFiles 内应有 try/catch
    expect(src).toMatch(/try\s*\{/)
    expect(src).toMatch(/catch/)
  })

  it('LeftPanel.vue 自定义尺寸范围 [1, 300] mm', async () => {
    const src = await readSrc('components/LeftPanel.vue')
    expect(src).toMatch(/CUSTOM_MIN_MM/)
    expect(src).toMatch(/CUSTOM_MAX_MM/)
  })

  it('App.vue 无文件时点击打印/导出有提示', async () => {
    const src = await readSrc('App.vue')
    expect(src).toMatch(/confirm/)
    expect(src).toMatch(/请先添加文件/)
  })

  it('units.ts 定义 CUSTOM_MIN_MM=1, CUSTOM_MAX_MM=300', async () => {
    const src = await readSrc('units.ts')
    expect(src).toMatch(/CUSTOM_MIN_MM\s*=\s*1/)
    expect(src).toMatch(/CUSTOM_MAX_MM\s*=\s*300/)
  })
})

describe('静态审计：localStorage 持久化范围', () => {
  it('LS_KEYS 仅持久化配置项（不包含文件/bitmap）', async () => {
    const src = await readSrc('units.ts')
    // keys: invoiceLayout, ticketLayout, idLayout, orientation, copies, colorMode, perspective/{slot}
    const lsKeysMatch = src.match(/export\s+const\s+LS_KEYS[^=]*=\s*\{([\s\S]*?)\}\s+as\s+const/)
    expect(lsKeysMatch).toBeTruthy()
    if (lsKeysMatch) {
      const body = lsKeysMatch[1]
      // 不应包含任何 bitmap / file / image 相关 key
      expect(body).not.toMatch(/bitmap/i)
      expect(body).not.toMatch(/file/i)
      expect(body).not.toMatch(/image/i)
      expect(body).not.toMatch(/canvas/i)
    }
  })

  it('files.ts 不调用 storageSet（文件不写入 localStorage）', async () => {
    const src = await readSrc('stores/files.ts')
    expect(src).not.toMatch(/storageSet/)
  })

  it('ui.ts 持久化 orientation/copies/colorMode', async () => {
    const src = await readSrc('stores/ui.ts')
    expect(src).toMatch(/storageSet\(LS_KEYS\.orientation/)
    expect(src).toMatch(/storageSet\(LS_KEYS\.copies/)
    expect(src).toMatch(/storageSet\(LS_KEYS\.colorMode/)
  })

  it('layout.ts 持久化三种排版模式', async () => {
    const src = await readSrc('stores/layout.ts')
    expect(src).toMatch(/storageSet\(keyMap\[tab\]/)
  })

  it('perspective.ts 仅持久化角点', async () => {
    const src = await readSrc('stores/perspective.ts')
    expect(src).toMatch(/storageSet\(LS_KEYS\.perspective/)
  })
})

describe('静态审计：其他关注点', () => {
  it('Main entry 缺少 vue-router 注册但 package.json 依赖了 vue-router（无害，但有冗余）', async () => {
    const src = await readSrc('main.ts')
    const pkg = await readSrc('../package.json')
    // 不强制失败，记录观察
    expect(src).not.toMatch(/createRouter/)
    // package.json 包含 vue-router
    expect(pkg).toMatch(/vue-router/)
  })

  it('TopMenu.vue 提供「重置全部」按钮 + 二次确认，并提供「设置」「关于」入口', async () => {
    const src = await readSrc('components/TopMenu.vue')
    // 必须有重置入口
    expect(src).toMatch(/resetAll/)
    // 必须走二次确认（ElMessageBox.confirm 或封装 confirmAction）
    expect(src).toMatch(/ElMessageBox\.confirm|confirmAction/)
    // 不使用下拉菜单
    expect(src).not.toMatch(/el-sub-menu/)
    // 设置 / 关于弹窗入口（v1.2：弹窗而非独立页面）
    expect(src).toMatch(/openDialog\('settings'\)/)
    expect(src).toMatch(/openDialog\('about'\)/)
  })
})

describe('静态审计：多页预览翻页', () => {
  it('PreviewCanvas.vue 提供翻页工具条（页码 / 上一下一 / 单页与滚动切换）', async () => {
    const src = await readSrc('components/PreviewCanvas.vue')
    expect(src).toMatch(/class="pager no-print"/)
    expect(src).toMatch(/function goTo\(/)
    expect(src).toMatch(/上一页/)
    expect(src).toMatch(/下一页/)
    expect(src).toMatch(/首页/)
    expect(src).toMatch(/末页/)
    // 两种预览方式
    expect(src).toMatch(/page.*scroll|scroll.*page/)
    expect(src).toMatch(/单页翻页/)
    expect(src).toMatch(/连续滚动/)
  })

  it('分页模式下非当前页用 class 隐藏（不能移除 DOM，否则打印会丢页）', async () => {
    const src = await readSrc('components/PreviewCanvas.vue')
    expect(src).toMatch(/page-off/)
    expect(src).toMatch(/function isPageVisible/)
    // 禁止用 v-if 控制分页显隐（v-if 会卸载 canvas，破坏打印与 ref）
    expect(src).not.toMatch(/v-if="isPageVisible/)
    expect(src).not.toMatch(/v-show="isPageVisible/)
  })

  it('翻页工具条位于 #print-area 之外不可打印时会被 .no-print 隐藏', async () => {
    const src = await readSrc('styles/index.scss')
    expect(src).toMatch(/\.no-print\s*\{\s*display:\s*none\s*!important/)
  })

  it('PreviewCanvas.vue 注入随纸张方向变化的 @page 规则', async () => {
    const src = await readSrc('components/PreviewCanvas.vue')
    expect(src).toMatch(/@page\s*\{\s*size:\s*A4\s*\$\{ui\.orientation\}/)
  })

  it('units.ts LS_KEYS 包含 previewMode（仅配置，不含文件）', async () => {
    const src = await readSrc('units.ts')
    expect(src).toMatch(/previewMode:\s*'lpt\/v1\/previewMode'/)
  })
})

describe('静态审计：打印物理尺寸 1:1', () => {
  it('打印时 page-wrapper 强制为 A4 物理毫米（纵向 210×297 / 横向 297×210）', async () => {
    const src = await readSrc('styles/index.scss')
    expect(src).toMatch(/\.page-wrapper\.portrait[\s\S]*?width:\s*210mm\s*!important[\s\S]*?height:\s*297mm\s*!important/)
    expect(src).toMatch(/\.page-wrapper\.landscape[\s\S]*?width:\s*297mm\s*!important[\s\S]*?height:\s*210mm\s*!important/)
  })

  it('打印时清掉预览内边距与页间距，避免多出空白纸', async () => {
    const src = await readSrc('styles/index.scss')
    expect(src).toMatch(/\.pages-stack[\s\S]*?padding:\s*0\s*!important/)
    expect(src).toMatch(/\.pages-stack[\s\S]*?gap:\s*0\s*!important/)
    expect(src).toMatch(/#print-area\s*\{[\s\S]*?padding:\s*0\s*!important/)
    // 最后一页不再强制分页
    expect(src).toMatch(/\.page-wrapper:last-child[\s\S]*?break-after:\s*auto/)
  })

  it('PreviewCanvas.vue 给 page-wrapper 打上方向 class', async () => {
    const src = await readSrc('components/PreviewCanvas.vue')
    expect(src).toMatch(/:class="\[ui\.orientation/)
  })
})

describe('静态审计：证件四点编辑器跟随当前页', () => {
  it('PerspectiveEditor.vue 按 page-index 定位、向上同步槽位', async () => {
    const src = await readSrc('components/PerspectiveEditor.vue')
    expect(src).toMatch(/pageIndex:\s*number/)
    expect(src).toMatch(/'update:activeSlot'/)
    // 接收当前缩放系数，角点覆盖层按排版项的 mm 坐标 × 缩放偏移绘制
    expect(src).toMatch(/zoom:\s*number/)
    expect(src).toMatch(/it\.xMM\s*\*\s*MM_TO_PX\s*\*\s*props\.zoom/)
    expect(src).toMatch(/it\.yMM\s*\*\s*MM_TO_PX\s*\*\s*props\.zoom/)
  })

  it('PreviewCanvas.vue 将编辑器挂载在「当前槽位所在页」并联动翻页', async () => {
    const src = await readSrc('components/PreviewCanvas.vue')
    expect(src).toMatch(/activeIdSlotPage/)
    expect(src).toMatch(/idx === activeIdSlotPage/)
    expect(src).toMatch(/activeIdSlotPage, \(i\)/)
    // 缩放变化时覆盖层跟随
    expect(src).toMatch(/:zoom="effectivePercent \/ 100"/)
  })
})

describe('静态审计：排版契约（逐张分页 + 纸张方向）', () => {
  it('排版函数签名接受 orientation，且默认纵向', async () => {
    const src = await readSrc('utils/canvas-helpers.ts')
    expect(src).toMatch(/layoutInvoice\(\s*pages: ParsedPage\[\],\s*mode: InvoiceMode,\s*orientation: Orientation = 'portrait'\s*\)/)
    expect(src).toMatch(/layoutTicket\(\s*pages: ParsedPage\[\],\s*mode: TicketMode,\s*orientation: Orientation = 'portrait'\s*\)/)
    expect(src).toMatch(/layoutId\(\s*slots: ParsedSlot\[\],\s*mode: IdMode,\s*orientation: Orientation = 'portrait'\s*\)/)
  })

  it('排版层不再硬编码 A4 纵向尺寸，统一走 usableArea()', async () => {
    const src = await readSrc('utils/canvas-helpers.ts')
    expect(src).toMatch(/function usableArea\(/)
    // 除了 usableArea 自身与 import 行，不应再出现裸的 A4_W_MM - 2 * MARGIN_MM
    expect(src).not.toMatch(/A4_W_MM - 2 \* MARGIN_MM/)
    expect(src).not.toMatch(/A4_H_MM - 2 \* MARGIN_MM/)
    // 分页阈值也不能写死 A4_H_MM
    expect(src).not.toMatch(/>\s*A4_H_MM - MARGIN_MM/)
  })

  it('PreviewCanvas.vue / App.vue 都把 ui.orientation 传进排版层（预览/状态栏/导出同一真源）', async () => {
    for (const f of ['components/PreviewCanvas.vue', 'App.vue']) {
      const src = await readSrc(f)
      expect(src).toMatch(/layoutInvoice\(files\.invoice, layout\.invoice, ui\.orientation\)/)
      expect(src).toMatch(/layoutTicket\(files\.ticket, layout\.ticket, ui\.orientation\)/)
      expect(src).toMatch(/layoutId\(files\.id, layout\.id, ui\.orientation\)/)
    }
  })

  it('PerspectiveEditor.vue 也按方向取排版项（否则横向时红点错位）', async () => {
    const src = await readSrc('components/PerspectiveEditor.vue')
    expect(src).toMatch(/layoutId\(files\.id, layout\.id, ui\.orientation\)/)
  })
})

describe('静态审计：左侧面板上传与操作按钮', () => {
  it('证件 Tab 提供上传入口（每个槽位 + 批量）', async () => {
    const src = await readSrc('components/LeftPanel.vue')
    // 槽位上传入口
    expect(src).toMatch(/class="slot-drop"/)
    expect(src).toMatch(/onSlotPick/)
    // 批量上传入口
    expect(src).toMatch(/class="dropzone dropzone-sm"/)
    // 拖拽对整块槽位生效（空/满槽位都可替换）
    expect(src).toMatch(/class="slot-box"[\s\S]{0,200}@drop="\(e\) => onSlotDrop\(s\.slot, e\)"/)
  })

  it('文件列表的旋转 / 删除改为独立按钮（不再是 el-button link 纯文字）', async () => {
    const src = await readSrc('components/LeftPanel.vue')
    expect(src).toMatch(/class="act-btn act-rotate"/)
    expect(src).toMatch(/class="act-btn act-del"/)
    expect(src).toMatch(/type="button"/)
    // 旧实现：link 按钮 + 纯文字
    expect(src).not.toMatch(/el-button size="small" link @click="rotate/)
    expect(src).not.toMatch(/el-button size="small" link type="danger" @click="removePage/)
  })

  it('图标用内联 SVG，不引入图标库依赖', async () => {
    const src = await readSrc('components/LeftPanel.vue')
    const pkg = await readSrc('../package.json')
    expect(src).toMatch(/const RotateIcon/)
    expect(src).toMatch(/const TrashIcon/)
    expect(src).not.toMatch(/@element-plus\/icons-vue/)
    expect(pkg).not.toMatch(/@element-plus\/icons-vue/)
  })

  it('图片类 accept 同时支持 PDF 与图片', async () => {
    const src = await readSrc('components/LeftPanel.vue')
    expect(src).toMatch(/const ACCEPT = '\.pdf,\.jpg,\.jpeg,\.png,image\/\*'/)
    // 所有 file input 统一使用 ACCEPT 常量
    const inputs = src.match(/<input[^>]*type="file"[^>]*>/g) ?? []
    expect(inputs.length).toBeGreaterThanOrEqual(3)
    for (const i of inputs) expect(i).toContain(':accept="ACCEPT"')
  })
})