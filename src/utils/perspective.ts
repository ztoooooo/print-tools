// opencv-js 懒加载 + warpPerspective（证件 Tab 专用）
import type { Corner } from '@/types'

let cvPromise: Promise<any> | null = null

/**
 * 懒加载并正确初始化 opencv-js。
 *
 * ⚠️ 关键坑：@techstark/opencv-js 的默认导出是 Emscripten「工厂函数」，
 *    直接在它上面访问 matFromArray / Mat 会得到 undefined。
 *    必须 调用工厂函数 并等待其 Promise resolve（WASM 运行时初始化完成），
 *    resolve 出的 Module 对象上才挂有 matFromArray、Mat、imread 等绑定。
 */
export function loadOpencv(): Promise<any> {
  if (cvPromise) return cvPromise
  cvPromise = (async () => {
    try {
      // 动态 import 仅在证件 Tab 首次使用时执行
      const mod: any = await import('@techstark/opencv-js')
      const exported = mod.default ?? mod

      // 不同打包 / interop 下，导出可能是：
      //   1) 工厂函数（需调用）
      //   2) Promise（Vite/Rollup 对 UMD 的 ESM 包装：工厂已被立即执行，
      //      default 即运行时初始化 Promise）
      //   3) 已就绪 Module（带 Mat）
      //   4) 未就绪 Module（仅有 onRuntimeInitialized 回调）
      let cv: any
      if (exported instanceof Promise) {
        cv = await exported
      } else if (typeof exported === 'function') {
        cv = await exported()
      } else if (exported && exported.Mat) {
        cv = exported
      } else {
        await new Promise<void>((resolve) => {
          exported.onRuntimeInitialized = () => resolve()
        })
        cv = exported
      }

      if (!cv || typeof cv.matFromArray !== 'function') {
        throw new Error('OpenCV 运行时已初始化，但 matFromArray 绑定缺失')
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
