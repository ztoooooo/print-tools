/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 构建产物用相对路径前缀，保证在任意部署位置都能正确解析资源：
 * 根路径（反代分享链接）、子路径（GitHub Pages 的 /print-tools/）都通用。
 * 本地 dev 仍用根路径。
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver()],
      dts: false
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: false
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    // @techstark/opencv-js 是 13MB 的 UMD（module.exports = factory()），
    // 真实导出藏在工厂返回值内。必须强制 esbuild 预构建，
    // 否则 dev 下 Vite 直接服务原始 UMD，ESM 命名空间为空（loadOpencv 全分支落空）。
    include: ['pdfjs-dist', '@techstark/opencv-js']
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          'element-plus': ['element-plus']
        }
      }
    }
  },
  server: {
    port: 5173,
    host: '127.0.0.1'
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/__tests__/**/*.test.ts'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    },
    // 组件级测试需要 Vite 处理 element-plus 内部的 CSS 导入
    server: {
      deps: {
        inline: [/element-plus/]
      }
    },
    // Single fork 避免 jsdom + canvas 在 Windows 上的 EPERM 问题
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
}))