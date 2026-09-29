// 全局 TS 类型定义

export type TabKey = 'invoice' | 'ticket' | 'id'

/** 弹窗类型：设置 / 关于（工作台常驻，不再切独立页面） */
export type DialogKind = 'settings' | 'about'

export type Orientation = 'portrait' | 'landscape'
export type ColorMode = 'color' | 'bw'

/** 单页已解析文件（发票/车票） */
export interface ParsedPage {
  id: string
  name: string
  size: number
  /** 位图实际像素尺寸（始终保留原始分辨率，不压缩） */
  width: number
  height: number
  /** 物理尺寸（mm）：图片按 PRINT_DPI 由像素换算；PDF 直接取页面真实尺寸 */
  widthMM: number
  heightMM: number
  bitmap: HTMLCanvasElement
  rotation: 0 | 90 | 180 | 270
  mime: 'pdf' | 'jpg' | 'png'
}

/** 证件槽位（每个槽位对应一张证件 + 自定义尺寸） */
export interface ParsedSlot {
  slot: 0 | 1 | 2 | 3
  page: ParsedPage | null
  sizePreset: import('./units').IdSizeKey
  customW: number
  customH: number
  edited: boolean // 用户是否已调整过四点角点
}

/** 透视矫正角点（图像像素坐标） */
export interface Corner {
  x: number
  y: number
}

/** 排版模式 */
export type InvoiceMode = 'single' | 'double' | 'merge2' | 'auto'
export type TicketMode = 'single' | 'top-bottom' | 'left-right' | 'grid2x2'
export type IdMode = 'double-col' | 'double-row' | 'center' | 'auto'

/** 排版引擎输出（mm 单位） */
export interface LayoutItem {
  bitmap: HTMLCanvasElement
  rotation: 0 | 90 | 180 | 270
  /** 图像原始 mm 尺寸（旋转前） */
  wMM: number
  hMM: number
  /** 在当前 A4 上的 mm 坐标 */
  xMM: number
  yMM: number
  /** 实际显示尺寸（mm） */
  renderWMM: number
  renderHMM: number
  pageIndex: number
  /** 槽位类型（证件 Tab 用） */
  slot?: 0 | 1 | 2 | 3
}

export interface LayoutPage {
  index: number
  items: LayoutItem[]
}