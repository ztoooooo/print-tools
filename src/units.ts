// 唯一常量源：所有 mm/px 换算、纸张尺寸、证件预设均在此处定义
// 其他文件禁止硬编码 3.7795、210、297 等数值

/** 96 DPI 下 1mm 等于多少像素 */
export const MM_TO_PX = 96 / 25.4
export const PX_TO_MM = 25.4 / 96

/** A4 纸张 */
export const A4_W_MM = 210
export const A4_H_MM = 297
export const A4_W_PX = Math.ceil(A4_W_MM * MM_TO_PX) // 794 @96dpi
export const A4_H_PX = Math.ceil(A4_H_MM * MM_TO_PX) // 1123 @96dpi

/**
 * 打印 / 页面合成分辨率（DPI）。
 * 预览、打印、导出 PDF 的页面画布统一按此 DPI 栅化，保证清晰；
 * 位图本身始终保留原始分辨率，不因页面 DPI 被压缩。
 */
export const PRINT_DPI = 300
/** 1mm 在 PRINT_DPI 下的像素数 */
export const PRINT_MM_TO_PX = PRINT_DPI / 25.4
/** A4 在 PRINT_DPI 下的像素尺寸（纵向） */
export const A4_W_PRINT_PX = Math.ceil(A4_W_MM * PRINT_MM_TO_PX) // 2480
export const A4_H_PRINT_PX = Math.ceil(A4_H_MM * PRINT_MM_TO_PX) // 3508

/**
 * PDF 页面光栅化 DPI（仅在 PDF 作为素材被拆页时使用）。
 * 取较高值以还原 PDF 矢量细节；PDF 页面物理尺寸另行记录。
 */
export const PDF_RASTER_DPI = 300

/** 边距与间距 */
export const MARGIN_MM = 10
export const GAP_MM = 8
export const MARGIN_PX = MARGIN_MM * MM_TO_PX
export const GAP_PX = GAP_MM * MM_TO_PX

/** 证件预设尺寸（mm）
 *  - 身份证：89.5 × 57.9（PRD 指定，含塑封保护套外廓；裸卡标准为 85.6×54）
 *  - 银行卡：85.60 × 53.98（ISO/IEC 7810 ID-1 国际标准）
 *  - 户口簿：143 × 105（公安部居民户口簿内页统一规格）
 */
export type IdSizeKey = 'id-card' | 'bank-card' | 'household' | 'custom'

export const ID_PRESETS: Record<IdSizeKey, { w: number; h: number; name: string }> = {
  'id-card': { w: 89.5, h: 57.9, name: '身份证' },
  'bank-card': { w: 85.6, h: 53.98, name: '银行卡' },
  'household': { w: 143, h: 105, name: '户口簿' },
  'custom': { w: 85, h: 54, name: '自定义' }
}

/** 证件自定义尺寸合法范围 */
export const CUSTOM_MIN_MM = 1
export const CUSTOM_MAX_MM = 300

/** localStorage key 约定（统一前缀） */
export const LS_KEYS = {
  invoiceLayout: 'lpt/v1/invoiceLayout',
  ticketLayout: 'lpt/v1/ticketLayout',
  idLayout: 'lpt/v1/idLayout',
  orientation: 'lpt/v1/orientation',
  copies: 'lpt/v1/copies',
  colorMode: 'lpt/v1/colorMode',
  previewMode: 'lpt/v1/previewMode',
  zoomMode: 'lpt/v1/zoomMode',
  zoomPercent: 'lpt/v1/zoomPercent',
  settings: 'lpt/v1/settings',
  activeTab: 'lpt/v1/activeTab',
  perspective: (slot: number) => `lpt/v1/perspective/${slot}`
} as const

export const mmToPx = (mm: number): number => mm * MM_TO_PX
export const pxToMm = (px: number): number => px / MM_TO_PX