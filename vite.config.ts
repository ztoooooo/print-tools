/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
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
})