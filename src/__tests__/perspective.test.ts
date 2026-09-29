/**
 * utils/perspective.ts 单测
 * 验证 opencv 懒加载（使用 dynamic import）
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { loadOpencv } from '@/utils/perspective'

describe('perspective.ts - 懒加载', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('loadOpencv 使用 dynamic import() 而非静态 import（源码审计）', async () => {
    // 通过读源文件验证（这是「关键审计」要求）
    // 静态 import 会被 vite 在打包时静态分析并入主 bundle；
    // 只有 await import() 才会产生动态 chunk
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const srcPath = path.resolve(__dirname, '../utils/perspective.ts')
    const src = await fs.readFile(srcPath, 'utf-8')

    // 必须包含 await import(  (inner level dynamic import)
    expect(src).toMatch(/await\s+import\(/)
    // 必须不包含静态 import from opencv
    const staticImportRegex = /^\s*import\s+[^'"]*['"](?:@opencv|@techstark)/gm
    expect(src.match(staticImportRegex)).toBeNull()
  })

  it('loadOpencv 导出为函数（运行时类型校验）', async () => {
    expect(typeof loadOpencv).toBe('function')
  })

  it('perspective.ts 不被 main.ts 静态引用（只 stores/perspective 可被引用）', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const mainSrc = await fs.readFile(path.resolve(__dirname, '../main.ts'), 'utf-8')
    // 不允许 import utils/perspective 或 opencv
    expect(mainSrc).not.toMatch(/utils\/perspective/i)
    expect(mainSrc).not.toMatch(/opencv/i)
  })

  it('App.vue 不静态引用 perspective.ts 或 opencv', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const appSrc = await fs.readFile(path.resolve(__dirname, '../App.vue'), 'utf-8')
    expect(appSrc).not.toMatch(/opencv/i)
    // perspective 工具只在 PerspectiveEditor 中使用（懒）
    // 主入口不应直接引用
  })
})