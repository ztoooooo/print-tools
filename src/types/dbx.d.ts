// DBX 插件 Host API 类型声明（仅声明本项目实际使用的子集）
// 文档：https://dbxio.com/cn/docs/plugin-development
// UI 运行在隔离 iframe（opaque origin）中，通过 window.dbxPlugin 与宿主通信。

export interface DbxFileTransferHandle {
  handleId: string
  name: string
  size: number
  contentType?: string
  relativePath?: string
}

export interface DbxSaveTarget {
  handleId: string
  /** 宿主建议的单次写入块大小（字节） */
  chunkBytes: number
}

export interface DbxFileTransfer {
  pick(options: { multiple?: boolean }): Promise<{ files: DbxFileTransferHandle[] }>
  read(
    handleId: string,
    offset: number,
    length?: number
  ): Promise<{ dataBase64: string; length: number; eof: boolean }>
  beginSave(options: {
    name: string
    contentType?: string
    size?: number
  }): Promise<DbxSaveTarget | null>
  write(
    handleId: string,
    offset: number,
    data: string | Uint8Array
  ): Promise<{ written: number; nextOffset: number }>
  finish(handleId: string): Promise<void>
  cancel(handleId: string): Promise<void>
  onDrop(
    fn: (
      files: DbxFileTransferHandle[],
      meta: { dropId: string; truncated: boolean; position: { x: number; y: number } }
    ) => void
  ): () => void
  onDragState(fn: (active: boolean, position?: { x: number; y: number }) => void): () => void
}

export interface DbxCapabilities {
  storage?: boolean
  clipboardWrite?: boolean
  clipboardRead?: boolean
  downloadFile?: boolean
  fileTransfer?: {
    pick?: boolean
    beginSave?: boolean
    read?: boolean
    drop?: boolean
    folderExpansion?: boolean
  }
  [key: string]: unknown
}

export interface DbxPluginApi {
  /** Host 初始化完成 Promise，启动逻辑必须在 await ready 之后 */
  ready: Promise<void>
  readonly contributionId: string
  readonly context: Record<string, unknown>
  readonly locale: string
  readonly theme: unknown
  readonly capabilities: DbxCapabilities
  storage?: {
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
    delete(key: string): Promise<void>
  }
  /** 写系统剪贴板（无需声明权限） */
  copy?(text: string): Promise<void>
  clipboard?: {
    writeText(text: string): Promise<void>
    readText(): Promise<string>
  }
  fileTransfer?: DbxFileTransfer
  onContext(fn: (context: Record<string, unknown>) => void): () => void
  onEvent(fn: (event: unknown) => void): () => void
}

declare global {
  interface Window {
    dbxPlugin?: DbxPluginApi
  }
}

export {}
