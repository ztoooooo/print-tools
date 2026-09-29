import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import './styles/index.scss'
import { useLayoutStore } from './stores/layout'
import { usePerspectiveStore } from './stores/perspective'
import { useUiStore } from './stores/ui'

// 从 localStorage 加载持久化状态（各 store 的 state 默认值已通过 storageGet 读取，
// 这里显式调用以触发 Pinia 注册 + 保留后续版本迁移空间）
function hydrateStores() {
  useUiStore()
  useLayoutStore().hydrate()
  usePerspectiveStore()
}

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(ElementPlus)
for (const [k, v] of Object.entries(ElementPlusIconsVue)) {
  app.component(k, v as any)
}
hydrateStores()
app.mount('#app')