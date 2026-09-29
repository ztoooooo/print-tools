import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import { parseFile } from '@/utils/file-parser'
import { toast } from '@/utils/canvas-helpers'
import type { ParsedPage, ParsedSlot, TabKey } from '@/types'

interface FilesState {
  invoice: ParsedPage[]
  ticket: ParsedPage[]
  id: ParsedSlot[]
}

/** 全局去重 key 集合（跨 Tab） */
const dedupCache = new Set<string>()

function dedupKey(file: File): string {
  return `${file.name}_${file.size}`
}

export const useFilesStore = defineStore('files', {
  state: (): FilesState => ({
    invoice: [],
    ticket: [],
    id: [
      { slot: 0, page: null, sizePreset: 'id-card', customW: 89.5, customH: 57.9, edited: false },
      { slot: 1, page: null, sizePreset: 'id-card', customW: 89.5, customH: 57.9, edited: false },
      { slot: 2, page: null, sizePreset: 'id-card', customW: 89.5, customH: 57.9, edited: false },
      { slot: 3, page: null, sizePreset: 'id-card', customW: 89.5, customH: 57.9, edited: false }
    ]
  }),
  actions: {
    /** 添加文件（去重 + 单文件失败不阻塞） */
    async addFiles(tab: TabKey, fileList: FileList | File[]) {
      const arr = Array.from(fileList)
      for (const file of arr) {
        const k = dedupKey(file)
        if (dedupCache.has(k)) {
          toast(`${file.name} 已存在，跳过`, 'warning')
          continue
        }
        try {
          const pages = await parseFile(file)
          if (pages.length === 0) {
            toast(`${file.name} 解析失败：无内容`, 'error')
            continue
          }
          if (tab === 'id') {
            // 证件：依次填入空槽位
            let placed = 0
            for (const p of pages) {
              for (let i = 0; i < this.id.length; i++) {
                if (this.id[i].page === null) {
                  this.id[i] = { ...this.id[i], page: p }
                  placed++
                  break
                }
              }
              if (placed === 0) break
            }
            if (placed > 0) dedupCache.add(k)
            if (placed === 0) toast(`证件槽位已满，跳过 ${file.name}`, 'warning')
          } else {
            ;(this[tab] as ParsedPage[]).push(...pages)
            dedupCache.add(k)
          }
        } catch (e: any) {
          toast(`${file.name} 解析失败：${e?.message || e}`, 'error')
        }
      }
    },
    /** 上传到指定证件槽位（覆盖旧文件并释放其去重记录） */
    async addFileToSlot(slot: ParsedSlot['slot'], file: File) {
      const target = this.id.find((s) => s.slot === slot)
      if (!target) return
      const k = dedupKey(file)

      // 同一文件已在其它槽位 → 拒绝，避免一张证件占两个槽位
      const elsewhere = this.id.some(
        (s) => s.slot !== slot && s.page && `${s.page.name}_${s.page.size}` === k
      )
      if (elsewhere) {
        toast(`${file.name} 已在其它槽位中，跳过`, 'warning')
        return
      }
      // 本槽位已是同一个文件 → 无需重复解析
      if (target.page && `${target.page.name}_${target.page.size}` === k) {
        toast(`${file.name} 已在该槽位`, 'info')
        return
      }

      try {
        const pages = await parseFile(file)
        if (pages.length === 0) {
          toast(`${file.name} 解析失败：无内容`, 'error')
          return
        }
        if (target.page) dedupCache.delete(`${target.page.name}_${target.page.size}`)
        target.page = pages[0]
        target.edited = false
        dedupCache.add(k)
        if (pages.length > 1) {
          toast(`${file.name} 共 ${pages.length} 页，已取第 1 页`, 'info')
        }
      } catch (e: any) {
        toast(`${file.name} 解析失败：${e?.message || e}`, 'error')
      }
    },
    remove(tab: TabKey, id: string) {
      if (tab === 'id') {
        const slot = this.id.find((s) => s.page?.id === id)
        if (slot && slot.page) {
          dedupCache.delete(`${slot.page.name}_${slot.page.size}`)
          slot.page = null
          slot.edited = false
        }
      } else {
        const arr = this[tab] as ParsedPage[]
        const idx = arr.findIndex((p) => p.id === id)
        if (idx >= 0) {
          const removed = arr.splice(idx, 1)[0]
          dedupCache.delete(`${removed.name}_${removed.size}`)
        }
      }
    },
    clear(tab: TabKey) {
      if (tab === 'id') {
        this.id.forEach((s) => {
          if (s.page) dedupCache.delete(`${s.page.name}_${s.page.size}`)
          s.page = null
          s.edited = false
        })
      } else {
        const arr = this[tab] as ParsedPage[]
        arr.forEach((p) => dedupCache.delete(`${p.name}_${p.size}`))
        arr.splice(0, arr.length)
      }
    },
    /** 将 dragId 移动到 targetId 的前 / 后位置（发票 / 车票列表） */
    reorder(
      tab: 'invoice' | 'ticket',
      dragId: string,
      targetId: string,
      position: 'before' | 'after'
    ) {
      if (dragId === targetId) return
      const arr = this[tab] as ParsedPage[]
      const from = arr.findIndex((p) => p.id === dragId)
      let to = arr.findIndex((p) => p.id === targetId)
      if (from < 0 || to < 0) return
      const [moved] = arr.splice(from, 1)
      // 删除原元素后，目标下标若在其之后需前移 1
      if (to > from) to -= 1
      arr.splice(position === 'after' ? to + 1 : to, 0, moved)
    },
    rotate(tab: TabKey, id: string, deg: 0 | 90 | 180 | 270) {
      if (tab === 'id') {
        const slot = this.id.find((s) => s.page?.id === id)
        if (slot?.page) slot.page.rotation = deg
      } else {
        const arr = this[tab] as ParsedPage[]
        const p = arr.find((x) => x.id === id)
        if (p) p.rotation = deg
      }
    }
  }
})