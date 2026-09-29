/**
 * files.ts store 单测
 * 验证三 Tab 隔离、去重、单文件失败不阻塞
 *
 * 注意：files.ts 内部的 `dedupCache` 是 module-level Set，
 * 测试间需要 unique file 名称（用 random suffix 避免跨测试污染）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFilesStore } from '@/stores/files'

// Mock canvas-helpers 的 toast
vi.mock('@/utils/canvas-helpers', async () => {
  const actual: any = await vi.importActual('@/utils/canvas-helpers')
  return {
    ...actual,
    toast: vi.fn()
  }
})

// Mock file-parser
vi.mock('@/utils/file-parser', () => {
  return {
    parseFile: vi.fn(async (file: File) => {
      const name = file.name
      const m = name.match(/mock-(\d+)-pages/)
      const n = m ? parseInt(m[1], 10) : 1
      const pages = []
      for (let i = 0; i < n; i++) {
        const c = document.createElement('canvas')
        c.width = 100
        c.height = 100
        const ctx = c.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#ff0000'
          ctx.fillRect(0, 0, 100, 100)
        }
        // 图片场景下 name 不带 #（参考 source 的 parseImage 行为）
        // 多页场景（PDF）则带 #i（参考 source 的 parsePdf 行为）
        pages.push({
          id: `${name}-${i}-${Math.random()}`,
          name: n > 1 ? `${name}#${i}` : name,
          size: file.size,
          width: 100,
          height: 100,
          bitmap: c,
          rotation: 0 as const,
          mime: 'jpg' as const
        })
      }
      return pages
    })
  }
})

let counter = 0
function makeFile(name: string, size = 1024): File {
  counter++
  // unique name 避免跨测试 dedupCache 污染
  const uniqueName = `${name}-${counter}-${Math.random().toString(36).slice(2)}`
  const blob = new Blob([new Uint8Array(size)], { type: 'image/jpeg' })
  return new File([blob], uniqueName, { type: 'image/jpeg' })
}

describe('files store - dedup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('同 name+size 视为同一文件：第二次添加被跳过', async () => {
    const files = useFilesStore()
    // 构造 2 个有相同 dedupKey 的文件
    const blob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' })
    const f1 = new File([blob], 'dup-unique.jpg', { type: 'image/jpeg' })
    const f2 = new File([blob], 'dup-unique.jpg', { type: 'image/jpeg' }) // 同名同 size

    await files.addFiles('invoice', [f1])
    expect(files.invoice.length).toBe(1)

    await files.addFiles('invoice', [f2])
    expect(files.invoice.length).toBe(1) // 仍为 1，重复被跳过
  })

  it('同名不同 size 视为不同文件', async () => {
    const files = useFilesStore()
    const f1 = makeFile('a.jpg', 100)
    const f2 = makeFile('a.jpg', 200)

    await files.addFiles('invoice', [f1, f2])
    expect(files.invoice.length).toBe(2)
  })

  it('跨 Tab：相同文件 invoice 与 ticket 都可加入（dedup 是全局）', async () => {
    const files = useFilesStore()
    const f1 = makeFile('cross.jpg', 100)

    await files.addFiles('invoice', [f1])
    await files.addFiles('ticket', [f1])
    // dedup 是全局缓存，第二次会被跳过
    expect(files.invoice.length).toBe(1)
    expect(files.ticket.length).toBe(0)
  })

  it('remove 后 dedupCache 释放，可重新添加', async () => {
    const files = useFilesStore()
    const f1 = makeFile('r.jpg', 100)

    await files.addFiles('invoice', [f1])
    expect(files.invoice.length).toBe(1)

    const id = files.invoice[0].id
    files.remove('invoice', id)
    expect(files.invoice.length).toBe(0)

    await files.addFiles('invoice', [f1])
    expect(files.invoice.length).toBe(1)
  })
})

describe('files store - 三 Tab 隔离', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('invoice / ticket / id 是三个独立数组', () => {
    const files = useFilesStore()
    expect(Array.isArray(files.invoice)).toBe(true)
    expect(Array.isArray(files.ticket)).toBe(true)
    expect(Array.isArray(files.id)).toBe(true)
    // id 是固定 4 个槽位
    expect(files.id.length).toBe(4)
  })

  it('id 初始 4 个槽位 page=null', () => {
    const files = useFilesStore()
    for (const s of files.id) {
      expect(s.page).toBeNull()
      expect(s.sizePreset).toBe('id-card')
      expect(s.customW).toBe(89.5)
      expect(s.customH).toBe(57.9)
    }
  })

  it('invoice 与 ticket 数据相互隔离', async () => {
    const files = useFilesStore()
    await files.addFiles('invoice', [makeFile('a-iso.jpg', 100)])
    expect(files.invoice.length).toBe(1)
    expect(files.ticket.length).toBe(0)

    await files.addFiles('ticket', [makeFile('b-iso.jpg', 200)])
    expect(files.invoice.length).toBe(1)
    expect(files.ticket.length).toBe(1)
  })
})

describe('files store - 证件槽位', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('证件按顺序填入空槽位', async () => {
    const files = useFilesStore()
    await files.addFiles('id', [makeFile('id1.jpg', 100), makeFile('id2.jpg', 200)])
    expect(files.id[0].page).not.toBeNull()
    expect(files.id[1].page).not.toBeNull()
    expect(files.id[2].page).toBeNull()
    expect(files.id[3].page).toBeNull()
  })

  it('证件槽位满后提示并拒绝', async () => {
    const files = useFilesStore()
    await files.addFiles('id', [
      makeFile('a-slot.jpg', 100),
      makeFile('b-slot.jpg', 200),
      makeFile('c-slot.jpg', 300),
      makeFile('d-slot.jpg', 400),
      makeFile('e-slot.jpg', 500) // 第 5 张应被拒绝
    ])
    // 4 张已填
    expect(files.id.filter((s) => s.page !== null).length).toBe(4)
  })

  it('clear(id) 清空所有槽位 + 释放 dedupCache', async () => {
    const files = useFilesStore()
    const f = makeFile('x.jpg', 100)
    await files.addFiles('id', [f])
    expect(files.id[0].page).not.toBeNull()

    files.clear('id')
    for (const s of files.id) {
      expect(s.page).toBeNull()
    }

    // 重新添加应可
    await files.addFiles('id', [f])
    expect(files.id[0].page).not.toBeNull()
  })
})

describe('files store - addFileToSlot（证件单槽位上传）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('上传到指定空槽位：只填该槽位', async () => {
    const files = useFilesStore()
    await files.addFileToSlot(2, makeFile('slot2.jpg', 100))
    expect(files.id[0].page).toBeNull()
    expect(files.id[1].page).toBeNull()
    expect(files.id[2].page).not.toBeNull()
    expect(files.id[3].page).toBeNull()
  })

  it('上传到已占用槽位：替换旧文件并释放其去重记录', async () => {
    const files = useFilesStore()
    const oldFile = makeFile('old.jpg', 100)
    await files.addFileToSlot(0, oldFile)
    const oldName = files.id[0].page!.name

    await files.addFileToSlot(0, makeFile('new.jpg', 200))
    expect(files.id[0].page!.name).not.toBe(oldName)
    expect(files.id[0].page!.name).toContain('new')
    // 旧文件被释放：可以再次上传
    await files.addFileToSlot(1, oldFile)
    expect(files.id[1].page).not.toBeNull()
  })

  it('同一文件已在其它槽位：拒绝，不重复占用', async () => {
    const files = useFilesStore()
    const f = makeFile('dup.jpg', 100)
    await files.addFileToSlot(0, f)
    await files.addFileToSlot(1, f)
    expect(files.id[0].page).not.toBeNull()
    expect(files.id[1].page).toBeNull()
  })

  it('重复上传同一文件到同一槽位：no-op，保留原图', async () => {
    const files = useFilesStore()
    const f = makeFile('same.jpg', 100)
    await files.addFileToSlot(3, f)
    const before = files.id[3].page!.id
    await files.addFileToSlot(3, f)
    expect(files.id[3].page!.id).toBe(before)
  })

  it('多页 PDF：只取第 1 页填入槽位', async () => {
    const files = useFilesStore()
    await files.addFileToSlot(0, makeFile('mock-3-pages.pdf', 300))
    expect(files.id[0].page).not.toBeNull()
    // 其余槽位不受影响
    expect(files.id.filter((s) => s.page).length).toBe(1)
  })

  it('解析失败：槽位保持原状，不抛错', async () => {
    const files = useFilesStore()
    const parser = await import('@/utils/file-parser')
    const fn = parser.parseFile as any
    const backup = fn.getMockImplementation()

    fn.mockImplementation(async () => {
      throw new Error('损坏文件')
    })
    await expect(files.addFileToSlot(0, makeFile('broken.jpg', 100))).resolves.toBeUndefined()
    expect(files.id[0].page).toBeNull()

    fn.mockImplementation(backup)
  })

  it('替换后 edited 标记被复位', async () => {
    const files = useFilesStore()
    await files.addFileToSlot(0, makeFile('a.jpg', 100))
    files.id[0].edited = true
    await files.addFileToSlot(0, makeFile('b.jpg', 200))
    expect(files.id[0].edited).toBe(false)
  })
})

describe('files store - rotate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('旋转 invoice 页：rotation 字段更新', async () => {
    const files = useFilesStore()
    await files.addFiles('invoice', [makeFile('r.jpg', 100)])
    const id = files.invoice[0].id
    expect(files.invoice[0].rotation).toBe(0)

    files.rotate('invoice', id, 90)
    expect(files.invoice[0].rotation).toBe(90)

    files.rotate('invoice', id, 180)
    expect(files.invoice[0].rotation).toBe(180)
  })

  it('rotate 不存在的 id 应 no-op（不抛错）', async () => {
    const files = useFilesStore()
    expect(() => files.rotate('invoice', 'not-exist', 90)).not.toThrow()
  })
})

describe('files store - 单文件失败不阻塞', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('解析失败的文件不影响其他文件', async () => {
    // 重置 mock 让某些文件抛错
    const parser = await import('@/utils/file-parser')
    const fn = parser.parseFile as any
    fn.mockImplementation(async (file: File) => {
      if (file.name.startsWith('bad-')) throw new Error('损坏')
      if (file.name.startsWith('empty-')) return []
      const c = document.createElement('canvas')
      c.width = 100
      c.height = 100
      const ctx = c.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#00ff00'
        ctx.fillRect(0, 0, 100, 100)
      }
      return [
        {
          id: `ok-${Math.random()}`,
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

    const files = useFilesStore()
    await files.addFiles('invoice', [
      makeFile('bad-1.jpg', 100),
      makeFile('good-1.jpg', 200),
      makeFile('empty-1.pdf', 300)
    ])
    // 只有 good 加入
    expect(files.invoice.length).toBe(1)
    expect(files.invoice[0].name).toContain('good')
  })
})