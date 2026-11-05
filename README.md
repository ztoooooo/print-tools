<div align="center">

# 🧾 票据打印 · Print Tools

**纯前端 · 本地运行 · 离线可用** 的票据 / 证件排版打印工具

把 PDF、JPG、PNG 发票、车票、证件按多种模式排到 A4 纸上，所见即所得地打印或导出 PDF。

![Vue](https://img.shields.io/badge/Vue-3-42B883?logo=vue.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Element Plus](https://img.shields.io/badge/Element_Plus-2.9-409EFF?logo=element&logoColor=white)
![License](https://img.shields.io/badge/license-Internal-7C3AED)
![Offline](https://img.shields.io/badge/100%25-offline-22C55E)
![Live Demo](https://img.shields.io/badge/在线演示-click%20me-000000?style=flat-square)

### 👉 [点此立即在线使用](https://ztoooooo.github.io/print-tools/)

**https://ztoooooo.github.io/print-tools/**

</div>

---

## 📸 界面预览

<div align="center">

### 工作台
图片保留原始分辨率，页面按 **300 DPI** 合成，预览 / 打印 / 导出一样清晰；可自定义水印。

![工作台](docs/screenshots/workspace.jpg)

</div>

<table>
<tr>
<td width="50%" align="center">
<b>设置 · 水印</b><br><br>
水印内容、应用范围、字号、不透明度与颜色均可调
<br><br>
<img src="docs/screenshots/settings.jpg" alt="设置">
</td>
<td width="50%" align="center">
<b>关于 · 安全说明</b><br><br>
零后端零上传，功能与隐私一目了然
<br><br>
<img src="docs/screenshots/about.jpg" alt="关于">
</td>
</tr>
</table>

---

## ✨ 功能特性

| 模块 | 说明 |
| --- | --- |
| 🗂️ **三个工作区** | 发票、车票、证件独立隔离，文件互不干扰 |
| 📄 **多格式支持** | PDF 自动逐页拆分，JPG / PNG 直接导入 |
| 🧩 **多种排版** | 单张居中、双打、上下合并、左右两联、2×2 网格、自动堆叠分页 |
| 🔍 **高清渲染** | 图片保留原始分辨率，页面按 300 DPI 合成，锐利不糊 |
| 💧 **自定义水印** | 内容、范围、字号、不透明度、颜色自由配置 |
| ↕️ **拖拽排序** | 文件列表拖动即重排，预览与导出顺序实时同步 |
| 📐 **透视矫正** | 证件四角矫正（OpenCV WASM 懒加载，本地完成） |
| 🎯 **所见即所得** | 预览 = 打印 = 导出 PDF，共用同一布局真源 |
| 💾 **偏好持久化** | 纸张方向、色彩、份数等设置自动记住 |

---

## 🚀 快速开始

**环境要求：** Node.js 18+（推荐 20+），npm / pnpm / yarn

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
#   ➜ http://127.0.0.1:5173

# 3. 生产构建（含类型检查）
npm run build

# 4. 本地预览生产构建
npm run preview
```

### 📖 使用步骤

1. 选择顶部「发票 / 车票 / 证件」工作区
2. 拖入或点击上传 PDF / JPG / PNG
3. 在文件列表中拖动排序，或对单张旋转、删除
4. 在「排版模式」中选择布局
5. 左侧「打印设置」调纸张方向 / 色彩 / 份数；右上角「设置」配水印
6. 点底部「**打印**」直接输出，或「**另存 PDF**」导出

---

## 🛠️ 技术栈

- **框架：** Vue 3（`<script setup>`）+ Vite 5 + TypeScript
- **状态管理：** Pinia
- **UI 组件：** Element Plus
- **PDF：** pdfjs-dist（解析）/ pdf-lib（导出）
- **图像处理：** @techstark/opencv-js（WASM，懒加载）
- **样式：** SCSS

## 📁 目录结构

```
src/
├─ components/    # 界面组件（菜单、左面板、预览、弹窗、透视编辑器）
├─ stores/        # Pinia 状态（文件、布局、界面、设置、角点）
├─ utils/
│  ├─ host.ts     # 宿主适配层（Web 浏览器 / DBX 沙箱双模式）
│  ├─ file-parser.ts  # 文件解析
│  ├─ canvas-helpers.ts # 画布绘制、布局真源、持久化封装
│  ├─ pdf-export.ts    # PDF 导出
│  └─ perspective.ts   # OpenCV 矫正（懒加载）
├─ styles/        # 全局样式与打印规则
├─ types/         # 类型（含 dbx.d.ts Host API 声明）
├─ types.ts       # 全局类型
├─ units.ts       # 常量与 mm/px 换算（唯一常量源）
└─ main.ts        # 应用入口（挂载前先 initHost 预载宿主存储）
```

---

## 🧩 作为 DBX 插件运行

本项目同时是一个 **DBX 纯前端插件（universal 包）**，同一份业务代码编译为两种产物：

| 目标 | 命令 | 输出 | 存储 / 落盘方式 |
| --- | --- | --- | --- |
| Web 版 | `npm run build` | `dist/` | localStorage + 浏览器下载 |
| DBX 插件 | `npm run build:dbx` | `ui/` | Host `storage` + `fileTransfer` 原生保存对话框 |

双模式由 `src/utils/host.ts` 统一适配，业务组件与 store 不感知运行环境。

### 沙箱适配要点

DBX 插件 UI 运行在 opaque-origin 的隔离 iframe 中（`sandbox="allow-scripts"`），与普通浏览器有三点关键差异，已全部在适配层处理：

1. **`localStorage` 直接抛错** → 启动时 `initHost()` 把 Host `storage` 预载到内存缓存，`storageGet/Set` 保持同步签名，store 层零改动；写操作异步穿透到 Host。
2. **anchor 下载不可靠** → PDF 导出走 `fileTransfer.beginSave/write/finish` 原生保存对话框（分块写入），无该能力时回退浏览器下载。
3. **`navigator.clipboard` 不可用** → 复制邮箱走 `dbxPlugin.copy`；`window.print()` 做了异常兜底与「改用 PDF」引导。

### 插件工程文件

- `manifest.json` —— 插件身份、`workbench` 贡献点、最小权限（仅 `host.storage`）、中英文本地化
- `dbx-plugin.toml` —— CLI 打包范围与 dev 构建命令
- `assets/plugin.svg` —— 插件图标（包根 `assets/`，与 `ui/` 平级）
- `scripts/dbx-watch.mjs` —— watch 构建包装器，成功后输出 `DBX_UI_BUILD_SUCCESS` 触发热重载

### 本地调试与打包

```bash
# 独立开发宿主（浏览器打开 http://127.0.0.1:5190，无需 DBX 桌面端）
npm run dbx:dev

# 打包未签名审核候选包 -> release/<id>-<version>-universal.dbxp
npm run dbx:pack
```

> ⚠️ Windows 下 `dbx-plugin dev` 经 CMD.EXE 拉起构建命令，**项目路径含中文/空格会导致 cwd 解析失败**。请把仓库放在纯 ASCII 路径下调试；`package` 打包不受影响。
>
> 本地安装未签名包需在 DBX 插件中心开启「允许安装未签名开发包」。正式上架走 [t8y2/dbx-store](https://github.com/t8y2/dbx-store) 审核签名流程，开发者不持有商店私钥。

参考文档：https://dbxio.com/cn/docs/plugin-development

---

## 🔒 隐私与安全

- **零后端、零上传** —— 文件只存在于你的浏览器内存，不发往任何服务器
- **断网可用** —— 首次加载后，拔掉网线也能处理与打印
- **无账号 · 无追踪 · 无统计**
- 所有图像操作（旋转、灰度、水印、透视矫正）均在本机完成
- ⚠️ 刷新或关闭页面后文件会清空，请及时打印或导出 PDF

---

## 📮 联系作者

使用中遇到问题或有改进建议，欢迎邮件联系：

**[747473366@qq.com](mailto:747473366@qq.com)**

<div align="center">

⭐ 如果这个工具对你有帮助，欢迎点个 Star ⭐

</div>
