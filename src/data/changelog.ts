// 更新日志数据源：在「关于」弹窗中渲染。
// 每发布一个版本，在数组头部（最新在前）追加一条即可。
// kind: new 新增 / improve 优化 / fix 修复

export type ChangeKind = 'new' | 'improve' | 'fix'

export interface ChangeItem {
  kind: ChangeKind
  text: string
}

export interface ChangelogEntry {
  version: string
  date: string
  title?: string
  changes: ChangeItem[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.4.0',
    date: '2026-09-29',
    title: '预览交互升级',
    changes: [
      { kind: 'new', text: '预览工具条常驻悬浮底部，只有一个文件时也显示。' },
      { kind: 'new', text: '新增显示缩放：可按 25%–300% 调整预览大小，并提供「适应」模式。' },
      { kind: 'new', text: '支持 Ctrl/Cmd + +/-/0 快捷键缩放，缩放比例自动记住。' },
      { kind: 'improve', text: '证件透视矫正的角点框随预览缩放同步，缩放后不再错位。' }
    ]
  },
  {
    version: '1.3.0',
    date: '2026-09-29',
    title: '高清渲染与弹窗化',
    changes: [
      { kind: 'improve', text: '图片与 PDF 按原始分辨率 / 300 DPI 高清显示，细节更清楚。' },
      { kind: 'improve', text: '「设置」「关于」改为弹窗打开，工作台不再被整页切换。' },
      { kind: 'new', text: '新增自定义水印：内容、范围、字号、不透明度与颜色均可配置。' },
      { kind: 'fix', text: '修复透视矫正不可用及导出 PDF 水印不一致的问题。' }
    ]
  },
  {
    version: '1.0.0',
    date: '2026-09-28',
    title: '首个版本',
    changes: [
      { kind: 'new', text: '发票 / 车票 / 证件三个独立工作区，文件互不干扰。' },
      { kind: 'new', text: '支持 PDF、JPG、PNG，PDF 自动逐页拆分。' },
      { kind: 'new', text: '多种排版模式，文件可拖拽排序。' },
      { kind: 'new', text: '纯前端本地处理，零后端、零上传，离线可用。' }
    ]
  }
]
