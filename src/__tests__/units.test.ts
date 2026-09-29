/**
 * units.ts 单测
 * 验证常量与 mm↔px 换算的正确性
 */
import { describe, expect, it } from 'vitest'
import {
  A4_H_MM,
  A4_H_PX,
  A4_W_MM,
  A4_W_PX,
  CUSTOM_MAX_MM,
  CUSTOM_MIN_MM,
  GAP_MM,
  ID_PRESETS,
  LS_KEYS,
  MARGIN_MM,
  MM_TO_PX,
  PX_TO_MM,
  mmToPx,
  pxToMm
} from '@/units'

describe('units.ts', () => {
  describe('核心常量', () => {
    it('MM_TO_PX 应为 96/25.4 ≈ 3.7795275591', () => {
      expect(MM_TO_PX).toBeCloseTo(96 / 25.4, 9)
      expect(MM_TO_PX).toBeCloseTo(3.7795275591, 9)
    })

    it('PX_TO_MM 应为 25.4/96 ≈ 0.2645833333', () => {
      expect(PX_TO_MM).toBeCloseTo(25.4 / 96, 9)
      expect(PX_TO_MM).toBeCloseTo(0.2645833333, 9)
    })

    it('A4_W_MM 应为 210', () => {
      expect(A4_W_MM).toBe(210)
    })

    it('A4_H_MM 应为 297', () => {
      expect(A4_H_MM).toBe(297)
    })

    it('A4_W_PX 应为 ceil(210 * MM_TO_PX) ≈ 794', () => {
      expect(A4_W_PX).toBe(Math.ceil(210 * MM_TO_PX))
      expect(A4_W_PX).toBe(794)
    })

    it('A4_H_PX 应为 ceil(297 * MM_TO_PX) ≈ 1123', () => {
      expect(A4_H_PX).toBe(Math.ceil(297 * MM_TO_PX))
      expect(A4_H_PX).toBe(1123)
    })

    it('MARGIN_MM 应为 10, GAP_MM 应为 8', () => {
      expect(MARGIN_MM).toBe(10)
      expect(GAP_MM).toBe(8)
    })

    it('自定义证件尺寸范围 [1, 300] mm', () => {
      expect(CUSTOM_MIN_MM).toBe(1)
      expect(CUSTOM_MAX_MM).toBe(300)
    })
  })

  describe('mmToPx / pxToMm', () => {
    it('mmToPx(10) ≈ 37.795', () => {
      expect(mmToPx(10)).toBeCloseTo(37.795275591, 6)
      // 工程验收：10mm 在 96 DPI 下应为约 37.8 px
      expect(mmToPx(10)).toBeGreaterThan(37)
      expect(mmToPx(10)).toBeLessThan(38)
    })

    it('mmToPx(0) === 0', () => {
      expect(mmToPx(0)).toBe(0)
    })

    it('mmToPx(A4_W_MM) ≈ A4_W_PX', () => {
      // 不强制严格相等（设计文档允许 0.5px 误差），但应在 0.5 内
      expect(Math.abs(mmToPx(A4_W_MM) - A4_W_PX)).toBeLessThanOrEqual(0.5)
    })

    it('pxToMm(mmToPx(x)) ≈ x（双向换算可逆）', () => {
      const cases = [0, 1, 10, 100, 297, 1000]
      for (const x of cases) {
        expect(pxToMm(mmToPx(x))).toBeCloseTo(x, 9)
      }
    })

    it('mmToPx(297) ≈ 1122.52', () => {
      // A4 高 297mm → ≈ 1122.52 px @ 96 DPI
      expect(mmToPx(297)).toBeGreaterThan(1122)
      expect(mmToPx(297)).toBeLessThan(1123)
    })
  })

  describe('ID_PRESETS 证件预设', () => {
    it('应包含 4 个预设：id-card / bank-card / household / custom', () => {
      expect(Object.keys(ID_PRESETS).sort()).toEqual([
        'bank-card',
        'custom',
        'household',
        'id-card'
      ])
    })

    it('身份证 尺寸 = 89.5 × 57.9 mm（PRD 指定，含塑封保护套外廓）', () => {
      expect(ID_PRESETS['id-card'].w).toBe(89.5)
      expect(ID_PRESETS['id-card'].h).toBe(57.9)
    })

    it('银行卡 尺寸 = 85.6 × 53.98 mm（ISO/IEC 7810 ID-1）', () => {
      expect(ID_PRESETS['bank-card'].w).toBe(85.6)
      expect(ID_PRESETS['bank-card'].h).toBe(53.98)
    })

    it('户口簿 尺寸 = 143 × 105 mm（公安部内页统一规格）', () => {
      expect(ID_PRESETS['household'].w).toBe(143)
      expect(ID_PRESETS['household'].h).toBe(105)
    })

    it('每个预设都有中文名（name field）', () => {
      for (const k of Object.keys(ID_PRESETS)) {
        expect(ID_PRESETS[k as keyof typeof ID_PRESETS].name).toBeTruthy()
        expect(ID_PRESETS[k as keyof typeof ID_PRESETS].name.length).toBeGreaterThan(0)
      }
    })
  })

  describe('LS_KEYS localStorage key 命名', () => {
    it('所有 key 都以 lpt/v1/ 前缀开头', () => {
      const keys = [
        LS_KEYS.invoiceLayout,
        LS_KEYS.ticketLayout,
        LS_KEYS.idLayout,
        LS_KEYS.orientation,
        LS_KEYS.copies,
        LS_KEYS.colorMode
      ]
      for (const k of keys) {
        expect(k.startsWith('lpt/v1/')).toBe(true)
      }
    })

    it('perspective 槽位 key 包含 slot 编号', () => {
      expect(LS_KEYS.perspective(0)).toBe('lpt/v1/perspective/0')
      expect(LS_KEYS.perspective(3)).toBe('lpt/v1/perspective/3')
    })
  })
})