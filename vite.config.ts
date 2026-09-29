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
 * GitHub Pages 子路径：https://<user>.github.io/print-tools/
 * 构建时资源前缀必须带该子路径；本地 dev 仍用根路径。
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/print-tools/' : '/',
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
    include: ['pdfjs-dist'],
    exclude: ['@techstark/opencv-js']
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