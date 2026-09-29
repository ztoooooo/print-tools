// opencv-js 懒加载 + warpPerspective（证件 Tab 专用）
import type { Corner } from '@/types'

let cvPromise: Promise<any> | null = null

/**
 * 判断对象是否为「已就绪的 OpenCV 运行时」。
 * 运行时 Module 上必然挂着 Mat / matFromArray / warpPerspective 等绑定。
 */
function isReadyCv(v: any): boolean {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof v.matFromArray === 'function' &&
    typeof v.Mat === 'function' &&
    typeof v.warpPerspective === 'function'
  )
}

/**
 * 从 ESM 模块命名空间中取出「最可能是工厂/运行时」的候选。
 *
 * 不同打包器形态：
 *  - esbuild 预构建：namespace.default === 工厂/初始化Promise
 *  - Rollup 生产构建：__toESM 双层包装，真实值可能藏在
 *    namespace.default.default（甚至更深）
 * 优先取 default 链上「最深的一层」；否则回退命名空间本身。
 */
function pickCandidate(mod: any): { value: any; depth: number } {
  let cur = mod
  let depth = 0
  const seen = new Set<any>()
  while (
    cur &&
    typeof cur === 'object' &&
    !seen.has(cur) &&
    Object.prototype.hasOwnProperty.call(cur, 'default') &&
    depth < 8
  ) {
    seen.add(cur)
    cur = cur.default
    depth++
  }
  return { value: cur, depth }
}

/**
 * 递归解析 OpenCV 模块，直到拿到「已就绪运行时」。
 *
 * @param value 模块命名空间 / 工厂函数 / Promise / 运行时 Module
 * @param depth 递归深度保护
 */
export async function resolveCvModule(value: any, depth = 0): Promise<any> {
  if (depth > 10) {
    throw new Error('OpenCV 模块层级过深，解析终止（疑似循环引用）')
  }

  // 1) 已就绪运行时
  if (isReadyCv(value)) return value

  // 2) Promise（cv 未初始化时本身就是初始化 Promise）
  //    必须用 instanceof：Emscripten Module 可能带 then 方法，
  //    鸭子类型会误判（Promise.prototype.then called on incompatible receiver）。
  if (value instanceof Promise) {
    return resolveCvModule(await value, depth + 1)
  }

  // 3) Emscripten 工厂函数：调用后返回 Module 或初始化 Promise
  if (typeof value === 'function') {
    return resolveCvModule(await value(), depth + 1)
  }

  // 4) ESM 模块命名空间（esbuild / Rollup 各种 interop）
  if (value && typeof value === 'object') {
    // Rollup toESM：真实值在 default 链深处
    if (Object.prototype.hasOwnProperty.call(value, 'default')) {
      return resolveCvModule(pickCandidate(value).value, depth + 1)
    }
    // Emscripten 未就绪 Module：等待 onRuntimeInitialized 回调
    if (Object.prototype.hasOwnProperty.call(value, 'onRuntimeInitialized')) {
      await new Promise<void>((resolve, reject) => {
        value.onRuntimeInitialized = () => resolve()
        // 兜底：部分 interop 下回调永不触发，10s 超时避免永久挂死
        setTimeout(() => reject(new Error('OpenCV 运行时初始化超时')), 10000)
      })
      return resolveCvModule(value, depth + 1)
    }

    // 兜底：命名空间没有 default（直接 import 压缩后 chunk 时，
    // Rollup 把绑定挂在单个重命名键如 { o: ... } 上）。
    // 取第一个「对象/函数」类型的具名键继续解析。
    for (const key of Object.keys(value)) {
      const candidate = value[key]
      if (candidate && (typeof candidate === 'object' || typeof candidate === 'function')) {
        return resolveCvModule(candidate, depth + 1)
      }
    }
  }

  throw new Error(
    '无法识别的 OpenCV 模块形态：' +
      Object.prototype.toString.call(value)
  )
}

/**
 * 懒加载并正确初始化 opencv-js。
 *
 * ⚠️ 关键坑：@techstark/opencv-js 的 Emscripten 模块在 WASM 就绪前
 *    导出的是「初始化 Promise」，就绪后才是带 Mat/matFromArray 的 Module；
 *    再叠加 esbuild / Rollup 的 ESM interop 包装，层级不固定。
 *    因此用递归 resolveCvModule 统一解包，而不是硬编码 if/else。
 */
export function loadOpencv(): Promise<any> {
  if (cvPromise) return cvPromise
  cvPromise = (async () => {
    try {
      // 动态 import 仅在证件 Tab 首次使用时执行
      const mod: any = await import('@techstark/opencv-js')
      const cv = await resolveCvModule(mod)
      if (!isReadyCv(cv)) {
        throw new Error('OpenCV 运行时已初始化，但关键绑定缺失')
      }
      return cv
    } catch (e) {
      // 允许失败后重试
      cvPromise = null
      throw e
    }
  })()
  return cvPromise
}

function dist(a: Corner, b: Corner): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** 用 4×1 CV_32FC2 数据构造点矩阵；matFromArray 异常时用 Mat + data32F 兜底 */
function pointMat(cv: any, coords: number[]): any {
  try {
    return cv.matFromArray(4, 1, cv.CV_32FC2, coords)
  } catch {
    const m = new cv.Mat(4, 1, cv.CV_32FC2)
    m.data32F.set(coords)
    return m
  }
}

/** 对图像做透视矫正，输出新 Canvas */
export async function warp(
  canvas: HTMLCanvasElement,
  corners: Corner[]
): Promise<HTMLCanvasElement> {
  const cv = await loadOpencv()
  const w = Math.round(Math.max(dist(corners[0], corners[1]), dist(corners[3], corners[2])))
  const h = Math.round(Math.max(dist(corners[0], corners[3]), dist(corners[1], corners[2])))
  if (w < 2 || h < 2) throw new Error('角点围成的区域过小，请重新调整四个角点')

  // 角点顺序：左上、右上、右下、左下
  const srcCoords = corners.flatMap((c) => [c.x, c.y])
  const dstCoords = [0, 0, w, 0, w, h, 0, h]

  const src = pointMat(cv, srcCoords)
  const dst = pointMat(cv, dstCoords)

  const M = cv.getPerspectiveTransform(src, dst)
  const srcMat = cv.imread(canvas)
  const dstMat = new cv.Mat()
  cv.warpPerspective(srcMat, dstMat, M, new cv.Size(w, h))
  const out = document.createElement('canvas')
  cv.imshow(out, dstMat)
  // 清理 opencv 内存
  try {
    srcMat.delete?.()
    dstMat.delete?.()
    M.delete?.()
    src.delete?.()
    dst.delete?.()
  } catch {
    /* noop */
  }
  return out
}
