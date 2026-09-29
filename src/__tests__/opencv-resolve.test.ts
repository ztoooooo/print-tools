import { describe, it, expect, vi } from 'vitest'
import { resolveCvModule, loadOpencv } from '@/utils/perspective'

/** 构造一个「已就绪 cv」假对象，只挂解析所需的关键绑定 */
function fakeReadyCv(extra: Record<string, any> = {}) {
  return {
    Mat: vi.fn(),
    matFromArray: vi.fn(),
    warpPerspective: vi.fn(),
    ...extra
  }
}

describe('resolveCvModule 各种模块形态', () => {
  it('直接是已就绪运行时时原样返回', async () => {
    const ready = fakeReadyCv()
    expect(await resolveCvModule(ready)).toBe(ready)
  })

  it('工厂函数：调用后同步返回 Module', async () => {
    const ready = fakeReadyCv()
    const factory = vi.fn(() => ready)
    expect(await resolveCvModule(factory)).toBe(ready)
    expect(factory).toHaveBeenCalled()
  })

  it('工厂函数：调用后返回 Promise（真实 opencv 形态）', async () => {
    const ready = fakeReadyCv()
    const factory = vi.fn(() => Promise.resolve(ready))
    expect(await resolveCvModule(factory)).toBe(ready)
  })

  it('本身就是初始化 Promise', async () => {
    const ready = fakeReadyCv()
    expect(await resolveCvModule(Promise.resolve(ready))).toBe(ready)
  })

  it('esbuild interop：{ default: 工厂 }', async () => {
    const ready = fakeReadyCv()
    const factory = () => Promise.resolve(ready)
    expect(await resolveCvModule({ default: factory })).toBe(ready)
  })

  it('esbuild interop：{ default: Promise }', async () => {
    const ready = fakeReadyCv()
    expect(await resolveCvModule({ default: Promise.resolve(ready) })).toBe(ready)
  })

  it('Rollup __toESM 双层包装：{ default: { default: Promise } }', async () => {
    const ready = fakeReadyCv()
    const mod = { default: { default: Promise.resolve(ready) } }
    expect(await resolveCvModule(mod)).toBe(ready)
  })

  it('更深的三层 default 嵌套也能解', async () => {
    const ready = fakeReadyCv()
    const mod = { default: { default: { default: Promise.resolve(ready) } } }
    expect(await resolveCvModule(mod)).toBe(ready)
  })

  it('未就绪 Module + onRuntimeInitialized 回调', async () => {
    const ready = fakeReadyCv()
    // 真实 Emscripten Module 上 onRuntimeInitialized 槽位已存在（初始为 null）
    const mod: any = { onRuntimeInitialized: null }
    const p = resolveCvModule(mod)
    // 解析器会把自己的回调挂到 onRuntimeInitialized 上
    expect(typeof mod.onRuntimeInitialized).toBe('function')
    // wasm 就绪：先补齐绑定，再触发回调
    Object.assign(mod, {
      Mat: ready.Mat,
      matFromArray: ready.matFromArray,
      warpPerspective: ready.warpPerspective
    })
    mod.onRuntimeInitialized()
    expect(await p).toBe(mod)
  })

  it('无 default、模块藏在重命名键上（直接 import 压缩 chunk）', async () => {
    const ready = fakeReadyCv()
    const mod = { o: { default: Promise.resolve(ready) } }
    expect(await resolveCvModule(mod)).toBe(ready)
  })

  it('无法识别的形态时抛出明确错误', async () => {
    await expect(resolveCvModule({ foo: 1 })).rejects.toThrow(/无法识别的 OpenCV 模块形态/)
  })

  it('循环引用的 default 链不会死循环', async () => {
    const a: any = {}
    const b: any = { default: a }
    a.default = b
    await expect(resolveCvModule(a)).rejects.toThrow()
  })
})

// loadOpencv 是 resolveCvModule 的薄包装；静态 mock 校验典型 esbuild 形态。
// 真实的浏览器集成（含 wasm）由 headless Chrome 端到端验证，不在 jsdom 里做。
vi.mock('@techstark/opencv-js', () => {
  const ready = fakeReadyCv()
  return {
    // 具名导出在 esbuild 形态下为 undefined；显式列出避免 vitest 严格 mock 抛错
    Mat: undefined,
    matFromArray: undefined,
    warpPerspective: undefined,
    default: () => Promise.resolve(ready)
  }
})

describe('loadOpencv', () => {
  it('从 esbuild 预构建模块解析出已就绪运行时', async () => {
    const cv = await loadOpencv()
    expect(typeof cv.matFromArray).toBe('function')
    expect(typeof cv.Mat).toBe('function')
    expect(typeof cv.warpPerspective).toBe('function')
  })
})
