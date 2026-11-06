// 宿主适配层：同一套业务代码同时运行在两种环境
//  1. 普通浏览器（Web 版，GitHub Pages / 分享链接）：localStorage、anchor 下载、navigator.clipboard
//  2. DBX 插件沙箱（opaque-origin iframe）：window.dbxPlugin Host API
//     - localStorage 在沙箱里会直接抛错 → 启动时预载到内存，写穿透到 host.storage
//     - anchor 下载不可靠 → fileTransfer.beginSave 分块落盘
//     - navigator.clipboard 不可用 → dbxPlugin.copy
// 文档：https://dbxio.com/cn/docs/plugin-development
import { LS_KEYS } from '@/units'
import type { DbxPluginApi } from '@/types/dbx'

/** 启动时需要预载的全部持久化 key（与 LS_KEYS 保持同源，含证件 4 槽位角点） */
function allStorageKeys(): string[] {
  const keys = [
    LS_KEYS.invoiceLayout,
    LS_KEYS.ticketLayout,
    LS_KEYS.idLayout,
    LS_KEYS.orientation,
    LS_KEYS.copies,
    LS_KEYS.colorMode,
    LS_KEYS.previewMode,
    LS_KEYS.zoomMode,
    LS_KEYS.zoomPercent,
    LS_KEYS.settings,
    LS_KEYS.activeTab,
    LS_KEYS.perspective(0),
    LS_KEYS.perspective(1),
    LS_KEYS.perspective(2),
    LS_KEYS.perspective(3)
  ]
  return keys
}

let dbx: DbxPluginApi | null = null
let ready = false

/** 当前是否运行在 DBX 插件沙箱中 */
export function isDbxPlugin(): boolean {
  return dbx !== null
}

export function dbxCapabilities() {
  return dbx?.capabilities ?? {}
}

/**
 * 应用启动时调用（挂载 Vue 之前 await）。
 * Web 环境立即返回；DBX 环境等待 Host ready 并预载持久化配置。
 */
export async function initHost(): Promise<void> {
  const api = typeof window !== 'undefined' ? window.dbxPlugin : undefined
  if (!api) {
    ready = true
    return
  }
  try {
    await api.ready
    dbx = api
    if (api.storage && api.capabilities?.storage !== false) {
      await preloadHostStorage(api)
    }
  } catch (e) {
    // Host 初始化失败时退化为纯内存模式，保证界面可用（仅配置不持久化）
    console.error('[host] DBX Host 初始化失败，降级为内存模式', e)
    dbx = null
  } finally {
    ready = true
  }
}

// ============ 持久化存储 ============

/** DBX 模式下的内存缓存：key -> 已解析的 JSON 值 */
const memoryStore = new Map<string, unknown>()

async function preloadHostStorage(api: DbxPluginApi): Promise<void> {
  await Promise.all(
    allStorageKeys().map(async (key) => {
      try {
        const value = await api.storage!.get(key)
        if (value !== null && value !== undefined) memoryStore.set(key, value)
      } catch {
        // 单键失败不阻断启动
      }
    })
  )
}

/**
 * 同步读取持久化值（保持与旧 localStorage 封装相同的签名，store 层零改动）。
 * DBX 模式读内存缓存（initHost 已预载）；Web 模式读 localStorage。
 */
export function hostStorageGet<T>(key: string, fallback: T): T {
  if (isDbxPlugin()) {
    if (!memoryStore.has(key)) return fallback
    return memoryStore.get(key) as T
  }
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** 同步写入内存 + 异步穿透到底层存储；失败静默，不阻塞 UI */
export function hostStorageSet(key: string, value: unknown): void {
  if (isDbxPlugin()) {
    memoryStore.set(key, value)
    const api = dbx
    if (api?.storage) {
      Promise.resolve(api.storage.set(key, value)).catch(() => {
        /* 配额/宿主异常：内存值仍在，本次会话不受影响 */
      })
    }
    return
  }
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 配额溢出等场景静默忽略
  }
}

export function hostStorageDelete(key: string): void {
  if (isDbxPlugin()) {
    memoryStore.delete(key)
    dbx?.storage?.delete(key).catch(() => undefined)
    return
  }
  try {
    localStorage.removeItem(key)
  } catch {
    // 忽略
  }
}

// ============ 文件保存（PDF 导出落盘） ============

export interface SaveResult {
  saved: boolean
  /** 用户在原生保存对话框中取消 */
  cancelled: boolean
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/**
 * 保存 Blob 到本地文件。
 * DBX 桌面端走 fileTransfer 原生保存对话框与分块写入；
 * 其余环境（Web 宿主 / 无 fileTransfer）回退为浏览器 anchor 下载。
 */
export async function saveBlob(blob: Blob, filename: string): Promise<SaveResult> {
  const ft = dbx?.fileTransfer
  const ftCaps = dbx?.capabilities?.fileTransfer
  if (isDbxPlugin() && ft && ftCaps?.beginSave !== false) {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const target = await ft.beginSave({
        name: filename,
        contentType: blob.type || 'application/octet-stream',
        size: bytes.length
      })
      // 用户取消保存对话框时宿主返回 null
      if (!target) return { saved: false, cancelled: true }

      const chunkSize = target.chunkBytes || 256 * 1024
      let offset = 0
      while (offset < bytes.length) {
        const end = Math.min(offset + chunkSize, bytes.length)
        const slice = bytes.subarray(offset, end)
        await ft.write(target.handleId, offset, base64FromBytes(slice))
        offset = end
      }
      await ft.finish(target.handleId)
      return { saved: true, cancelled: false }
    } catch (e) {
      // 宿主传输异常：取消句柄后抛出，由调用方提示并可尝试浏览器下载兜底
      console.error('[host] fileTransfer 保存失败', e)
      throw e
    }
  }

  // Web 回退：Blob URL + anchor 下载
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { saved: true, cancelled: false }
}

// ============ 剪贴板 ============

/** 写剪贴板，返回是否成功。DBX 走 Host（无需权限），Web 走 navigator.clipboard */
export async function copyText(text: string): Promise<boolean> {
  if (isDbxPlugin() && dbx) {
    try {
      if (dbx.copy) {
        await dbx.copy(text)
        return true
      }
      if (dbx.clipboard?.writeText) {
        await dbx.clipboard.writeText(text)
        return true
      }
    } catch (e) {
      console.error('[host] 剪贴板写入失败', e)
      return false
    }
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 非安全上下文 / 旧浏览器兜底
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

// ============ 打印 ============

/**
 * 沙箱 iframe 仅 allow-scripts，window.print() 可能被宿主拦截且无统一探测方式。
 * 保留原生调用（Web 版行为不变），同步异常时返回 false 由 UI 引导改用 PDF 导出。
 */
export function printDocument(): boolean {
  try {
    window.print()
    return true
  } catch (e) {
    console.error('[host] 打印被宿主拦截', e)
    return false
  }
}

/** 防御性：确保初始化流程已结束（测试与特殊挂载顺序下使用） */
export function hostReady(): boolean {
  return ready
}
