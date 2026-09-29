# 票据打印工具 · 视觉风格规范（Phase 1）

> 主题：**拟物纸张感（Paper-on-Desk）** · 浅色主题
> 适用：Vue 3 + Element Plus + Vite 纯前端本地票据打印工具
> 版本：v1.0 · 视觉设计架构师（米拉）
> 交付对象：体验设计师 / 前端工程师
> 所有数值可直接落地，单位除注明外均为 px。

---

## 1. 设计理念与情绪关键词

### 1.1 一句话定位
**把 A4 预览像一张真实的纸一样「放在桌面上」，其余界面退为安静的衬托。** 拟物只服务于一个目的——让用户相信「预览即所得」；所有装饰都必须为效率让路。

### 1.2 情绪关键词
`专注` `可信` `安静` `纸质温度` `文具感` `不喧宾夺主`

### 1.3 设计原则（5 条，验收依据）

| # | 原则 | 具体含义 / 反例 |
|---|------|----------------|
| P1 | **纸是主角，UI 是背景** | 全界面亮度/对比最高的物体永远是 A4 纸面。控制面板用比桌面更亮但接近纸面的低对比米白，不允许出现比纸面更抢眼的色块。**避免**整面板高饱和填充。 |
| P2 | **拟物只做三层：桌面 → 纸 → 墨** | 材质隐喻限定为「木质/呢面桌面、纸张、墨水、印章」。**避免**渐变按钮、玻璃拟态（glassmorphism）、霓虹、3D 立体图标。 |
| P3 | **点缀色克制到 5% 面积以内** | 品牌朱红只用于：主操作的关键一处、选中态细节、品牌小记号。**避免**把整个主按钮做成大红块（会与「错误红」混淆）。 |
| P4 | **对比靠明度，不靠饱和** | 层级通过「纸面色阶（白→米白→浅灰）」和「墨色阶（浓墨→淡墨）」拉开。功能色低饱和、向暖灰收敛，保持打印工具的专业气质。 |
| P5 | **物理诚实** | A4 严格 210×297mm 比例、投影方向统一（单一光源在左上）、多页叠放像真实纸摞。预览区出现的一切装饰（角点、描边）在打印/导出中必须不存在。 |

### 1.4 明确「避免清单」（降低返工）
- 避免 Element Plus 默认的亮蓝（`#409eff`）作为主色——无辨识度且偏「后台管理系统」。
- 避免纯白（`#FFFFFF`）大面板铺底，界面会发冷、发飘；纸面才允许近白。
- 避免重投影（Material 风格 `0 8px 24px` 高黑度）——纸很轻，投影要柔、要淡。
- 避免圆角过大（>12px）与全圆角胶囊滥用——纸张是方的，工具是专业的。
- 避免拟物纹理图片资源（零网络/构建体积约束）；如要纸纹，用纯 CSS 生成且透明度 <4%。
- 避免 hover 用大幅放大/变色跳动；仅做明度与投影的细微变化。

---

## 2. 完整色板（浅色主题）

> 设计逻辑：低饱和、整体偏暖（色温微向黄/红偏移 2–4%），模拟纸张与木桌；墨色用「带一丝暖的深炭」而非纯黑。
> 全部给出 CSS 变量名（建议挂在 `:root`）。

### 2.1 桌面 / 背景层（Desk）

| 变量 | HEX | 用途 |
|------|-----|------|
| `--desk-base` | `#E8E4DB` | 预览区「桌面」主底色（暖灰，呢面/哑光木桌感） |
| `--desk-deep` | `#DAD4C8` | 桌面远端/边缘渐变加深端，营造桌面纵深 |
| `--app-bg` | `#EDEAE2` | App 最外层兜底背景 |
| `--desk-grain` | `#000000` | 桌面极淡噪点（仅以 2–3% 透明度叠加，见 §5.4） |

> 桌面背景实现：`linear-gradient(160deg, #EDEAE2 0%, #E8E4DB 55%, #DAD4C8 100%)`。

### 2.2 各级纸面色（Paper，三级纸阶）

| 变量 | HEX | 用途 |
|------|-----|------|
| `--paper-a4` | `#FDFDFB` | **A4 预览纸面**（全界面最亮，近白带一丝暖，模拟复印纸） |
| `--paper-panel` | `#F7F5EF` | 左侧控制面板、Tab 条、顶栏、底栏（比纸面略暗的米白卡纸） |
| `--paper-card` | `#FBFAF6` | 文件列表项、槽位、模式卡片等卡片表面 |
| `--paper-raised` | `#FFFFFF` | 浮层 / 下拉 / Popover / Toast（最白，便于与面板分离） |
| `--paper-hover` | `#F2EFE7` | 卡片/列表项 hover 态 |
| `--paper-inset` | `#F0EDE4` | 内嵌区域、禁用底、输入框底（凹陷感） |

### 2.3 墨色文字层级（Ink）

| 变量 | HEX | 对比度（对 `--paper-panel`） | 用途 |
|------|-----|------|------|
| `--ink-strong` | `#26241F` | ≈13.0:1 | 主文字：标题、文件名、数值 |
| `--ink-body` | `#42403A` | ≈9.0:1 | 正文、设置项标签 |
| `--ink-secondary` | `#6E6A5F` | ≈4.8:1 | 次要文字、说明、状态栏 |
| `--ink-placeholder` | `#A39E91` | ≈2.6:1 | 占位、极弱提示 |
| `--ink-disabled` | `#BDB8AB` | ≈1.9:1 | 禁用文字 |

> 墨色均带暖度（R 通道略高于 B），呼应黑墨印在暖纸上的观感，不使用纯黑 `#000` 也不使用冷调 `#2c3e50`。

### 2.4 点缀 / 品牌色（重点选择）

**专业选择：印章朱红（Vermilion Seal Red）为主点缀，墨水蓝（Ink Blue）为次点缀。**

| 变量 | HEX | 用途 |
|------|-----|------|
| `--brand-seal` | `#C0392B` | **主点缀**：主按钮核心、选中态描边/小记号、品牌印章意象 |
| `--brand-seal-deep` | `#A52F23` | 朱红 hover/active 加深 |
| `--brand-seal-soft` | `#F6E7E3` | 朱红极浅底（选中卡片底、徽章底） |
| `--ink-blue` | `#34506B` | 次点缀：信息类强调、链接、次要图标（钢胆墨水蓝） |
| `--ink-blue-soft` | `#E8EDF2` | 墨水蓝浅底 |

**选择理由（为何选「印章朱红」而非墨水蓝作为第一点缀）：**
1. **文化与业务强关联**：发票、票据、证件的核心动作是「盖章生效」，朱红是中文办公场景里「确认、权威、生效」的本能符号，与「打印/确认输出」的产品语义高度同构；墨水蓝更偏「书写/记录」，语义弱于朱红。
2. **辨识度**：99% 的同类工具与 Element Plus 默认方案是蓝色。改用朱红立即脱离「后台模板感」，且落在「文具」意象内，不突兀。
3. **可控性**：朱红面积被严格限制在 5% 以内（P3），不会让工具显得「喜庆/花哨」；大面积仍是纸与墨，红色只在「打印」这一关键决策点出现，天然引导主操作。
4. **与警示红的区分靠明度与语境**：见下条——错误用「玫调赤」、朱红用「朱砂橙红」，二者色相/明度错开，且错误只出现在反馈与删除语境，不会误读。

### 2.5 功能色（低饱和、暖灰收敛）

> 关键：打印工具里红色=警示，必须与朱红点缀协调。因此**错误色用偏玫/暗的赤（`#C14B53` 系），点缀朱红用偏橙的朱砂（`#C0392B`，橙味更足、明度更高）**，并让错误色主要以浅底+深字出现，不与主按钮的实心朱红同框竞争。

| 语义 | 变量 | HEX | 浅底色 | 用途 |
|------|------|-----|--------|------|
| 成功 | `--success` | `#4F8A4B` | `#E7F0E4` `(--success-soft)` | 导出成功、已填槽位 ✓ |
| 警告 | `--warning` | `#B97C2A` | `#F6ECD8` `(--warning-soft)` | 模式提示、旋转建议 |
| 错误 | `--danger` | `#C14B53` | `#F8E6E7` `(--danger-soft)` | 删除、失败、解析错误（玫调赤，区别于朱红） |
| 错误-深 | `--danger-deep` | `#A23B43` | — | 错误 hover |
| 信息 | `--info` | `#34506B` | `#E8EDF2`（=墨水蓝浅底） | 普通提示、信息 Toast |

> 对比度：四种深色文字用于浅底时均 ≥4.5:1。功能色不用于大面积背景。

### 2.6 边框 / 分割线（Hairline）

| 变量 | HEX | 用途 |
|------|-----|------|
| `--line-strong` | `#D8D2C5` | 卡片/槽位描边（默认可见边） |
| `--line-base` | `#E2DDD1` | 区域分割线、面板与画布交界 |
| `--line-soft` | `#ECE8DE` | 极弱分组线、列表项之间 |
| `--line-focus` | `#C0392B` | 聚焦/选中描边（=品牌朱红） |

> 分割线尽量用「纸面色阶差」代替显性 1px 线（P4）；如必须画线，优先 `--line-soft`。

### 2.7 CSS 变量总表（可直接粘贴）

```css
:root {
  /* desk */
  --desk-base:#E8E4DB; --desk-deep:#DAD4C8; --app-bg:#EDEAE2;
  /* paper */
  --paper-a4:#FDFDFB; --paper-panel:#F7F5EF; --paper-card:#FBFAF6;
  --paper-raised:#FFFFFF; --paper-hover:#F2EFE7; --paper-inset:#F0EDE4;
  /* ink */
  --ink-strong:#26241F; --ink-body:#42403A; --ink-secondary:#6E6A5F;
  --ink-placeholder:#A39E91; --ink-disabled:#BDB8AB;
  /* brand */
  --brand-seal:#C0392B; --brand-seal-deep:#A52F23; --brand-seal-soft:#F6E7E3;
  --ink-blue:#34506B; --ink-blue-soft:#E8EDF2;
  /* functional */
  --success:#4F8A4B; --success-soft:#E7F0E4;
  --warning:#B97C2A; --warning-soft:#F6ECD8;
  --danger:#C14B53;  --danger-deep:#A23B43; --danger-soft:#F8E6E7;
  /* line */
  --line-strong:#D8D2C5; --line-base:#E2DDD1; --line-soft:#ECE8DE;
  --line-focus:#C0392B;
}
```

---

## 3. 字体与字号层级

> **v1.1 字体优化（零新增字体 · 零体积）**：在不引入任何新字体的前提下，通过「Windows 优先 YaHei UI + 标题升 700 真·雅黑粗体 + 修正字体平滑」实现用户要的「更黑、更清楚」。原则：**只给标题与关键数值加粗，正文保持常规以维持层级，黑而不糊、密而不挤。**

### 3.1 字体栈（中文优先，零网络字体）

```css
/* Windows：YaHei UI（界面专用，字面略大、小字号更清晰、hinting 更好）；
   不存在时回退传统 Microsoft YaHei；
   macOS：前两者不存在，自然落到 PingFang SC */
--font-sans: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC",
             "Segoe UI", "Hiragino Sans GB", "Source Han Sans SC",
             "Noto Sans CJK SC", system-ui, -apple-system, sans-serif;
/* 数字 / 毫米数值：西文等宽，中文部分回退雅黑 */
--font-num: "SF Mono", "Cascadia Mono", "Consolas", "Roboto Mono",
            "Microsoft YaHei UI", "Microsoft YaHei", monospace;
```

- 不引入任何远程字体（零网络铁律），仅调换系统字体顺序与字重，**构建体积零变化**。
- Windows 实际渲染 **Microsoft YaHei UI**（比传统雅黑专为屏幕 UI 优化、字面略大、小字号更挺）；macOS 落到 **PingFang SC**。
- 数字（份数、mm、页数）统一 `font-variant-numeric: tabular-nums;`，连点递增不抖、状态栏数字列对齐。

### 3.2 字号 / 字重 / 行高阶梯（v1.1 字重）

| Token | 字号 | 行高 | 字重 | 用途 |
|-------|------|------|------|------|
| display-num | 22 | 1.2 | 700 | 预览大页码、份数强调（等宽） |
| title | 15 | 1.35 | 700 | 顶栏品牌名 |
| section | 13 | 1.4 | 700 | 左侧面板分区标题（文件/排版模式/打印设置） |
| body | 13 | 1.5 | 400 | 正文、设置项标签、未选中模式名 |
| label | 12 | 1.4 | 500 | Tab 文字、按钮文字、普通标签 |
| caption | 11 | 1.45 | 400 | 辅助说明、hint、状态栏普通项 |
| micro | 10 | 1.4 | 400 | 徽标、极弱标注 |

### 3.3 元素 → 字重完整对照表（v1.1 定稿）

| 元素 | 选择器参考（mockup） | v1.0 | **v1.1** |
|------|----------------------|------|----------|
| 顶栏品牌名 | `.brand-name` | 600 | **700** |
| 面板分区标题 | `.section-title` | 600 | **700** |
| 槽位标题 | `.slot-title` | 600 | **700** |
| 文件名 | `.file-name` | 500 | **700** |
| 选中模式名 | `.mode-card.selected .mode-name` | 600 | **700** |
| 状态栏关键数值 | `.statusbar b` | 600 | **700** |
| 份数大数值 | `.copies-value` / display-num | 600 | **700** |
| 翻页页码 n / N | 页码输入框 / 计数 | 500 | **700** |
| 打印份数（设置） | `--font-num` 13 | 600 | **700** |
| 序号徽章数字 | `.badge-num` | 600 | **700** |
| 主按钮「打印」 | `.btn-primary-seal` | 500 | **600**（朱红实心，过重会糊） |
| Tab 文字 | `.tab-item` | 500 | **500**（选中靠朱红色，不靠加粗） |
| 按钮文字（普通/次按钮） | `.btn` | 500 | **500** |
| 毫米数值 | `--font-num` 12 | 500 | **500**（密集数字，700 易粘连） |
| 正文 / 设置项标签 | `.sr-label`、body | 400 | **400** |
| 未选中模式名 | `.mode-card .mode-name` | 400 | **400** |
| hint / 辅助 / 状态栏普通项 | `.dz-hint`、caption | 400 | **400** |

> 关键判断：**文件名升 700** 是用户「看得更清楚」的直接命中点；但**正文、毫米数值、按钮/Tab 不升级**——前者靠粗细层级衬托标题，密集数字与小号按钮在 700 下反而粘连、显糊。雅黑（含 YaHei UI）自带真正的 Bold 字形，700 是原生粗体而非浏览器合成（faux bold），可放心使用（取代 v1.0「不用 700」的旧结论）。

### 3.4 字间距与行高（黑而不糊、密而不挤）

- 雅黑粗体笔画宽，小字号下汉字偏挤：**升 700 的标题/文件名统一加 `letter-spacing: 0.2px`**（仅 +0.2px，过大会松散；品牌名 15px 可用 +0.3px）。
- **不要给等宽数字加正字距**：数字间需对齐，数字元素 `letter-spacing: 0`。
- 行高维持阶梯值（标题 1.35–1.4、正文 1.5）；粗体不额外压缩行高，避免上下笔画贴边。
- 含全角标点的句尾若出现行尾挤迫，依靠 0.2px 微 tracking 即可，不调整字号。

### 3.5 字体平滑与渲染（Windows + 雅黑明确值）

```css
body{
  -webkit-font-smoothing: auto;          /* 不要强制 antialiased */
  -moz-osx-font-smoothing: grayscale;    /* 仅 macOS Firefox 生效 */
  text-rendering: auto;                  /* 全局不用 optimizeLegibility */
}
/* 仅大号展示数字（22px）启用几何精度 */
.display-num{ text-rendering: geometricPrecision; }
```

- **移除当前 `body{ -webkit-font-smoothing: antialiased }`**：在 Windows + 雅黑场景，强制 antialiased 会走灰度抗锯齿、笔画偏细发虚，与「更黑更清楚」相悖；改回 `auto` 让雅黑用自带 hinting + ClearType 子像素渲染，最挺最清楚。
- 该属性在 macOS Safari/Chrome 默认即是适合苹方的亚像素/抗锯齿，写 `auto` 不影响 Mac 观感；`-moz-osx-font-smoothing: grayscale` 仅作用于 macOS 火狐，属安全补充。
- `text-rendering` 全局保持 `auto`：`optimizeLegibility` 在部分 Chrome 版本会对中文启用不合预期的字偶距/合字，小字号更糊；仅 22px 大号数字用 `geometricPrecision`。
- 跨平台差异：Windows 以 ClearType 雅黑呈现「黑实」，macOS 以苹方呈现「细腻」，均为系统原生表现，不做平台 hack。

### 3.6 对比度复核（加粗后）

- 加粗本身提升字形识别度，WCAG 对粗文本（≥700、≥14px 等效）对比要求反而放宽到 3:1，故现有墨色在升 700 后**全部仍达标且有余量**，无需改色。
- **墨色维持不动**：`--ink-strong #26241F`、`--ink-body #42403A`、`--ink-secondary #6E6A5F` 不变。不把文字再加深——`#26241F` 在近白纸面上已近极限，继续压黑会与粗笔画叠加导致「过曝/糊成一团」。
- 文件名升 700 后若在极个别浅底上显重，依靠颜色层级（文件名 `--ink-strong`、次要信息 `--ink-secondary`）而非减重来区分。

---

## 4. 间距系统（4px 栅格）

### 4.1 基础标尺

基础单位 **4px**，间距 Token：

| Token | 值 |
|-------|----|
| space-1 | 4 |
| space-2 | 8 |
| space-3 | 12 |
| space-4 | 16 |
| space-5 | 20 |
| space-6 | 24 |
| space-8 | 32 |
| space-10 | 40 |
| space-12 | 48 |

### 4.2 各区域具体数值

| 区域 / 元素 | 内边距 padding | 元素间隔 gap / margin |
|-------------|----------------|----------------------|
| 顶栏 TopMenu（高 48） | 0 16（垂直靠 48 高居中） | 菜单项间 16 |
| Tab 条（高 44） | 0 8；单个 Tab 内边距 8 16 | Tab 之间 2（紧贴排列），活动下划线距底 0 |
| 左侧面板（宽 280） | 整体 padding 16 | 分区 `.panel-section` 之间 margin-bottom 20；分区标题到内容 8 |
| 面板分区卡片 | 卡片式分区 padding 12 | 分区内行间 8（设置行）/ 4（紧凑列表） |
| 文件列表项 | 8 10 | 列表项之间 4；项内「文件名行 / 操作行」之间 6 |
| 上传区 Dropzone | 20 12 | 图标→主文案 6，主文案→hint 4 |
| 证件槽位 | 10 | 槽位之间 10；槽头→尺寸行/文件行 8 |
| A4 预览区（桌面） | 24（内容与容器边缘） | 单页模式：纸面垂直居中，四周 ≥24；连续滚动：页与页之间 32 |
| 多页纸摞（视觉） | — | 投影叠加见 §5.3，纸摞相邻纸偏移 2/张 |
| 底部操作栏（高 52） | 0 16 | 按钮之间 8；按钮组与状态栏间距 16（状态栏 `margin-left:auto`） |
| 翻页工具条 pill | 6 14 | 内部按钮间 6；与视图切换组用 1px 分隔，左右各留 8 |

---

## 5. 圆角、阴影与纸张质感体系（重点）

### 5.1 圆角 Token

整体偏「方」，呼应纸张，圆角克制：

| Token | 值 | 用途 |
|-------|----|------|
| radius-xs | 3 | 序号徽章、小标签 |
| radius-sm | 4 | 输入框、小按钮、提示条 |
| radius-md | 6 | 文件列表项、Dropzone、模式卡片、普通按钮 |
| radius-lg | 8 | 证件槽位、大卡片、Popover |
| radius-paper | 2 | **A4 纸面**（真实纸张几乎不圆角，仅 2px 避免锯齿） |
| radius-pill | 999 | 仅翻页工具条胶囊、角点（圆形） |

### 5.2 A4 纸面多层投影（核心，单光源在左上）

真实纸张的观感来自「贴身接触影 + 中等扩散影 + 远处环境影」三层叠加，全部低黑度、暖调，且偏移偏向**右下方**（光在左上）：

```css
/* A4 纸面默认（轻放在桌面上） */
.shadow-paper {
  box-shadow:
    0 1px 2px rgba(60, 52, 38, 0.10),    /* 第1层：贴身接触影，紧贴纸边 */
    0 6px 12px -4px rgba(60, 52, 38, 0.14), /* 第2层：纸张中部柔影 */
    0 18px 36px -12px rgba(60, 52, 38, 0.20); /* 第3层：远处环境漫反射 */
}
```

要点：
- 投影用**暖黑色** `rgba(60,52,38,*)`（不是纯黑 `rgba(0,0,0,*)`），落在暖桌面上才不发脏。
- 第 1 层偏移极小（1px），第 3 层模糊半径大（36px）但透明度仅 0.20——纸很轻，影子要「淡而散」。
- 纸面边缘可加一圈极细内高光，强化纸厚：`inset 0 0 0 1px rgba(255,255,255,0.6)`。

状态：
- **hover（可交互/当前页）**：第 2、3 层略加深、略上浮——
  `0 1px 2px rgba(60,52,38,.12), 0 10px 20px -6px rgba(60,52,38,.18), 0 26px 48px -14px rgba(60,52,38,.26); transform: translateY(-2px);`
- **被编辑器选中的页**：等同 hover，并可加 `outline: 1px solid var(--brand-seal-soft)`（不打印）。
- **打印 / 导出**：`box-shadow:none !important; transform:none;`（现有打印规则已处理，务必保留）。

### 5.3 面板 / 卡片 / 浮层阴影分级

| 级别 | 用途 | box-shadow |
|------|------|-----------|
| shadow-none | 面板与桌面交界 | `none`，改用 1px `--line-base` 分割（左面板右边框、底栏上边框） |
| shadow-xs | 列表项 hover、卡片 | `0 1px 2px rgba(60,52,38,.06)` |
| shadow-sm | 槽位、内嵌卡片 | `0 1px 3px rgba(60,52,38,.08), 0 0 0 1px var(--line-soft)` |
| shadow-md | 浮层、Popover、下拉 | `0 4px 12px -2px rgba(60,52,38,.12), 0 2px 4px rgba(60,52,38,.08)` |
| shadow-lg | Toast、对话框 | `0 12px 32px -8px rgba(60,52,38,.22), 0 2px 8px rgba(60,52,38,.10)` |
| shadow-paper | A4（见 §5.2） | 三层 |

> 控制面板本身**不使用投影**，它与桌面之间靠「米白面板 vs 暖灰桌面」的明度差 + 1px 分割线区分，保持界面安静（P1/P4）。

**多页纸摞叠放（连续滚动 / 多页时）**：
- 连续滚动模式下，除最上层页面外，可让相邻页面在右下各偏移 2px，形成纸摞：
  `.page-wrapper + .page-wrapper { margin-top: 32px; }`
- 纸摞「下层纸」露出的边缘用纯色 `--paper-a4` + `--line-soft`，仅最上层使用完整三层 `shadow-paper`；避免每页都重影导致画面脏。
- 若要表达厚纸摞，可在纸面下叠加 1–2 个 `::before/::after` 伪元素，`background:var(--paper-a4)`、偏移 2px/4px、仅带第 1 层轻影。

### 5.4 桌面噪点与纸张纤维（可选，默认极弱）

**零图片资源**，全部 CSS 生成，且严格控制透明度，默认甚至可以关闭：

桌面极淡噪点（2–3%），用分层 `radial-gradient` 模拟呢面/细木桌：

```css
.desk-grain::before{
  content:""; position:absolute; inset:0; pointer-events:none;
  background-image:
    radial-gradient(rgba(0,0,0,.03) 1px, transparent 1px),
    radial-gradient(rgba(255,255,255,.025) 1px, transparent 1px);
  background-size: 3px 3px, 5px 5px;
  background-position: 0 0, 1px 2px;
}
```

纸张纤维感（**可选，透明度 <4%，建议默认不加，仅在需要时用于 A4**）：

```css
.paper-fiber{
  background-image:
    repeating-linear-gradient(90deg, rgba(120,105,80,.025) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(0deg,  rgba(120,105,80,.02) 0 1px, transparent 1px 6px);
}
```

- 纸纹**绝不进入打印/导出**：仅作用于预览外壳 `.page-wrapper`，canvas 内容保持纯净白底。
- 在低性能设备 / `prefers-reduced-transparency` 下可整体关闭纹理。

### 5.5 桌面与纸面的明度对比

- 桌面 `#E8E4DB`（明度约 90%）→ A4 `#FDFDFB`（明度约 99%）：明度差约 9%，加上三层投影，纸面清晰浮起但不刺眼。
- 面板 `#F7F5EF`（约 96%）介于两者之间：比桌面亮（与桌面分离）、比 A4 暗（不与纸面争主角）。
- 三级明度排序固定：**A4(99) > 面板(96) > 桌面(90)**，这是 P1「纸是主角」的量化保证，落地时不允许调换。

---

## 6. 关键组件视觉规范

> 每项给出尺寸 / 色值 / 状态。未特别说明的文字颜色遵循 §2.3 墨色阶。

### 6.1 顶栏 TopMenu

- 尺寸：高 48；padding 0 16。
- 底色：`--paper-panel`；下边框 1px `--line-base`；无投影。
- 品牌名：15px / 600 / `--ink-strong`；左侧可放一枚 14×14 朱红「印章方块」小记号（圆角 3、`--brand-seal`、内含白色「印」字 10px），作为品牌锚点。
- 右侧「重置全部」：次按钮样式（见 §6.9），用 `--warning` 描边款而非实心。
- 状态：菜单项 hover 底色 `--paper-hover`，圆角 4。

### 6.2 Tab 栏

- 尺寸：高 44；padding 0 8；底 1px `--line-base`；底 `--paper-panel`。
- Tab：padding 8 16；文字 12px / 500 / `--ink-secondary`。
- 默认：无底色；hover：文字 `--ink-strong`、底 `--paper-hover`（圆角 6）。
- 活动：文字 `--brand-seal`、字重 600；底部 2px `--brand-seal` 指示条（圆角 1）；底色透明，**不使用整块填充**。
- 切换动画：仅颜色与下划线 `transition: .15s`，不跳动。

### 6.3 左侧面板

- 尺寸：宽 280；padding 16；底 `--paper-panel`；右边框 1px `--line-base`；纵向滚动。
- 分区标题：13px / 600 / `--ink-strong`，标题前可加 3×12 的朱红竖条（`--brand-seal`，圆角 1）增强文具/标签感（可选）。
- 分区之间 20；标题到内容 8。
- 滚动条：宽 8，滑块 `--line-strong`、圆角 4、hover `--ink-placeholder`，轨道透明。
- 设置行：标签 13px `--ink-body`；右侧控件；行高 32，行间 8。

### 6.4 排版模式选择器（可视化，替代纯文字单选项）★

用「2×2 网格的小纸张图示卡片」取代当前竖排文字 radio。卡片内上方为示意图（mini A4 + 票据块），下方为文字名。

- 容器：`grid`，2 列；gap 8；卡片高约 64。
- 卡片：底 `--paper-card`；1px `--line-strong`；圆角 6；padding 8；文字 11px `--ink-body`，居中。
- 示意图画布：高 32，宽按 A4 比例（约 22×31 的 2:3 微缩），纸面底 `#FFFFFF`、描边 `--line-strong`、圆角 1；票据块统一用 `--brand-seal`（选中）或 `--ink-placeholder`（未选中）填充，透明度未选中 0.5。

**各模式图示画法（mini 矩形排布）：**

发票（A4 竖向微缩）：
- `single`：A4 正中一个小矩形（约占宽 55%、高 22%）居中。
- `double`：两个同样小矩形，上下居中、间距 2（表达复制两份）。
- `merge2`：两个矩形上下紧贴、合占约高 46%。
- `auto`：3 个矩形错位堆叠（逐级 +1px 偏移），表达自动堆叠。

车票（A4 竖向微缩）：
- `single`：正中一个窄长矩形（宽 80%、高 18%）。
- `top-bottom`：上下两个窄长矩形，分靠上下、间距 4。
- `left-right`：两个窄长矩形旋转 90°（竖向条）左右排列。
- `grid2x2`：2×2 四个小矩形，间距 2。

证件（A4 竖向微缩，证件块比例约 85.6×54 即 1.585:1）：
- `double-col`：两个证件块左右两列（可纵向并列两块）。
- `double-row`：两个证件块上下两行。
- `center`：正中单个证件块。
- `auto`：多块错位堆叠。

状态：
- 默认：如上；hover：底 `--paper-hover`、描边 `--ink-placeholder`。
- 选中：底 `--brand-seal-soft`；描边 1.5px `--brand-seal`；票据块填充 `--brand-seal`；文字 `--brand-seal-deep`、600。卡片右上角可出现 2px 朱红对勾。
- disabled：底 `--paper-inset`、文字 `--ink-disabled`、图示块 `--ink-disabled`。
- 实现可用内联 SVG（与现有内联图标风格一致，零新增依赖），每个模式一个小 SVG 组件。

### 6.5 文件列表项

- 容器：列表 gap 4；项 padding 8 10；圆角 6；默认 1px transparent、底透明。
- 序号徽章：等宽 10px / 600；底 `--brand-seal-soft`、字 `--brand-seal`；尺寸 18×16、圆角 3。
- 文件名：12px / 500 / `--ink-strong`，省略号；hover 不变色。
- 操作按钮（旋转/删除）：胶囊高 24、padding 0 8、文字 11px：
  - 旋转：底 `--ink-blue-soft`、字 `--ink-blue`；hover 实心 `--ink-blue`、白字。
  - 删除：底 `--danger-soft`、字 `--danger`；hover 实心 `--danger`、白字。
- 项 hover：底 `--paper-card` + 1px `--line-soft` + `shadow-xs`。
- 空列表：「暂无文件」12px `--ink-placeholder`，居中、padding 20 0；建议配一张 28×28 线性空纸图标（`--line-strong`）。
- 证件槽位：槽位卡 padding 10、圆角 8、底 `--paper-card`、1px `--line-strong`；已填用 `✓`（`--success`，软底）徽章替代序号；槽位内上传区 dashed 1.5 `--line-strong`、圆角 6，hover 变 `--ink-blue`。

### 6.6 A4 预览纸面

- 尺寸：严格 A4 比例（210:297），按 `PREVIEW_SCALE` 缩放；canvas 铺满、底 `#FFFFFF`。
- 外壳：底 `--paper-a4`、圆角 2、`shadow-paper`（§5.2）、内高光 1px。
- 内容：所见即所得；预览区任何编辑覆盖物（透视框/角点）绝对不进入打印与 PDF。
- 空状态（无文件）：桌面中央显示浅灰 A4 轮廓（1.5px dashed `--line-strong`、底透明或 3% 白），中间放空纸图标 + 文案「从左侧添加文件，开始排版」（13px `--ink-placeholder`）。
- 缩放/翻页条：见 §6.6 收尾说明。

**翻页工具条（浮于桌面底部，sticky）**：胶囊（radius-pill）、底 `rgba(255,255,255,.96)` + `shadow-md`、padding 6 14；「上一页/下一页」用图标小按钮（24×24、圆角 6、hover 底 `--paper-hover`、禁用 `--ink-disabled`）；中间「第 n / N 页」用等宽 13px `--ink-body`，页码输入框 46×24、1px `--line-strong`、focus 描边 `--ink-blue`；视图切换（单页/连续）用 segmented control，选中项底 `--ink-blue-soft`、字 `--ink-blue`。缩放滑块可选，滑块主色 `--ink-blue`。

### 6.7 底部操作栏

- 尺寸：高 52；padding 0 16；底 `--paper-panel`；上边框 1px `--line-base`；无投影。
- 左侧：操作按钮区，按钮间 gap 8。
- 右侧状态栏：`margin-left:auto`；11px `--ink-secondary`；数字用等宽字体；各项间以「·」分隔，分隔点颜色 `--line-strong`（比文字更弱）；关键值（份数、总页数）可 600、`--ink-body`。
- 空状态：无文件时按钮 disabled，状态栏仍展示默认设置（A4 纵向 · 彩色 · 1 份 · 共 0 页）。

### 6.8 主按钮 / 次按钮（视觉权重重点）

统一尺寸：高 32、padding 0 16、圆角 6、字号 12 / 500；`transition: .15s`；active 时 `translateY(1px)`。

- **打印 = 全界面唯一实心朱红按钮（明确决定）**。理由：打印是终点动作且天然对应「盖章生效」，一颗实心朱红足以把视线锁到底部主操作；因全界面仅此一颗实心朱红（其余朱红均为软底/描边/小记号），总面积仍 <5%，不违反 P3。
  - 默认：底 `--brand-seal`、白字、`shadow-xs`；hover：底 `--brand-seal-deep`、`0 2px 8px rgba(192,57,43,.30)`；active：底 `#8F281D`、下沉 1px；disabled：底 `#E3D9CE`、字 `#F5F1EA`、无影。
- **另存 PDF = 墨水蓝描边款（次高权重）**：底 `--paper-raised`、1px `--ink-blue`、字 `--ink-blue`；hover 底 `--ink-blue-soft`；active 底 `#DDE4EC`；disabled 用 `--line-strong` 描边 + `--ink-disabled`。与打印形成「实心红 / 描边蓝」两级权重，一眼分出主次。
- **普通次按钮（重置全部、取消等）**：底 `--paper-raised`、1px `--line-strong`、字 `--ink-body`；hover 底 `--paper-hover`、描边 `--ink-placeholder`；active 底 `--paper-inset`；disabled 底 `--paper-inset`、字 `--ink-disabled`。
- 警告类（重置全部）如需强调，用 `--warning` 描边 + `--warning` 字，不用实心。

### 6.9 Toast

- 容器：底 `--paper-raised`；`shadow-lg`；圆角 6；padding 10 14；最小宽 280；左侧 3px 语义色竖条（成功 `--success` / 警告 `--warning` / 错误 `--danger` / 信息 `--ink-blue`）。
- 文字：12px `--ink-body`；标题可 12px/600；图标用语义色，14px。
- 错误 Toast 竖条为玫调赤 `--danger`，与朱红主按钮不同语境、不同色相，不会误读。
- 进出场：轻微上移 + 淡入（.2s），不用弹跳。

### 6.10 四点透视编辑器角点

- 角点：12px 实心圆、底 `--brand-seal`、2px 白边（`box-shadow:0 0 0 2px #fff`）；hover/激活放大至 14px、`shadow-md`、光标 `grab`；拖拽中光标 `grabbing`。
- 透视连线：1.5px `--brand-seal` dashed（当前槽位）；非当前槽位用 `--ink-placeholder`。被摄证件区域可加 8% 朱红半透明填充。
- 槽位切换：segmented（槽位 1–4），选中项朱红软底 + 朱红字。
- 【裁剪确认】：实心朱红小按钮（高 28、圆角 6），权重低于打印但语义同属「确认生效」；另配「重置角点」墨水蓝描边小按钮。
- 键盘微调提示条：底部 11px 胶囊，底 `--paper-raised` + `shadow-sm`，文字 `--ink-secondary`，提示「方向键微调 1px / Shift+方向键 10px」。

---

## 7. 给前端工程师的落地提示

### 7.1 Element Plus 主题变量映射（覆盖 `:root`）

```css
:root{
  --el-color-primary:#C0392B;              /* 品牌朱红 */
  --el-color-primary-light-3:#D16A5F;
  --el-color-primary-light-5:#DD8E85;
  --el-color-primary-light-7:#EAB3AB;
  --el-color-primary-light-8:#F6E7E3;      /* = soft 底 */
  --el-color-primary-light-9:#FAF1EE;
  --el-color-primary-dark-2:#A52F23;
  --el-color-success:#4F8A4B;  --el-color-success-light-9:#E7F0E4;
  --el-color-warning:#B97C2A;  --el-color-warning-light-9:#F6ECD8;
  --el-color-danger:#C14B53;   --el-color-danger-light-9:#F8E6E7;
  --el-color-info:#34506B;     --el-color-info-light-9:#E8EDF2;
  --el-bg-color:#FBFAF6;       --el-bg-color-page:#EDEAE2;
  --el-fill-color-blank:#FFFFFF;
  --el-text-color-primary:#26241F; --el-text-color-regular:#42403A;
  --el-text-color-secondary:#6E6A5F; --el-text-color-placeholder:#A39E91;
  --el-border-color:#D8D2C5; --el-border-color-light:#E2DDD1;
  --el-border-color-lighter:#ECE8DE; --el-border-radius-base:6px;
}
```

### 7.2 实施要点

- **主色面积克制不能靠全局变量实现**：把 `--el-color-primary` 设为朱红后，切勿给所有按钮加 `type="primary"`，否则满屏朱红。全界面实心朱红仅「打印」「裁剪确认」两处；Tab 选中、模式卡选中、徽章等一律用「软底 + 描边」自定义类（参考 §6）。建议封装 `.btn-primary-seal / .btn-outline-blue / .btn-ghost` 三个按钮类。
- **A4 三层投影、纸厚内高光、纸摞偏移、桌面渐变、噪点/纸纹全部纯 CSS**（见 §5），不引入图片，符合零网络与构建体积约束。
- 噪点用双层 `radial-gradient`、纸纹用 `repeating-linear-gradient`，均为伪元素叠加、`pointer-events:none`。
- **打印 / 导出务必关闭一切装饰**：现有 `@media print` 已清 `box-shadow`，需同时确认 `.desk-grain`、`.paper-fiber`、透视覆盖层在打印态 `display:none`；canvas 本身永远白底 `#FFFFFF`。
- 动效遵循 `prefers-reduced-motion`，纹理遵循系统减少透明设置；低性能设备关闭噪点。
- 所有自定义颜色优先引用 §2.7 CSS 变量，不要在组件里硬编码色值，便于后续统一调整。
