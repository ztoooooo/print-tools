<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { toast } from '@/utils/canvas-helpers'
import { CHANGELOG } from '@/data/changelog'
import type { ChangeKind } from '@/data/changelog'

const ui = useUiStore()
const email = '747473366@qq.com'

/** 当前版本与版本日期（取更新日志首条，单一数据源） */
const current = computed(() => CHANGELOG[0])

const KIND_META: Record<ChangeKind, { label: string; cls: string }> = {
  new: { label: '新增', cls: 'k-new' },
  improve: { label: '优化', cls: 'k-improve' },
  fix: { label: '修复', cls: 'k-fix' }
}

const visible = computed({
  get: () => ui.activeDialog === 'about',
  set: (v) => {
    if (!v) ui.closeDialog()
  }
})

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(email)
    toast('邮箱已复制', 'success')
  } catch {
    toast('复制失败，请手动选择', 'warning')
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="关于"
    width="600px"
    class="lpt-dialog"
    append-to-body
  >
    <div class="dlg-body">
      <section class="hero card">
        <span class="brand-mark">印</span>
        <div>
          <h2>票据打印</h2>
          <p class="ver">版本 {{ current.version }} · 纯前端本地工具 · 离线可用</p>
        </div>
      </section>

      <section class="card">
        <h3>更新日志</h3>
        <div class="log">
          <div v-for="entry in CHANGELOG" :key="entry.version" class="log-entry">
            <div class="log-head">
              <span class="log-ver">v{{ entry.version }}</span>
              <span v-if="entry.title" class="log-title">{{ entry.title }}</span>
              <span class="log-date">{{ entry.date }}</span>
            </div>
            <ul class="log-list">
              <li v-for="(c, i) in entry.changes" :key="i" class="log-item">
                <span class="log-tag" :class="KIND_META[c.kind].cls">
                  {{ KIND_META[c.kind].label }}
                </span>
                <span class="log-text">{{ c.text }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="card">
        <h3>功能介绍</h3>
        <ul class="feat-list">
          <li><b>发票 / 车票 / 证件</b>三个独立工作区，文件互不干扰。</li>
          <li>支持 <b>PDF、JPG、PNG</b>；PDF 自动逐页拆分为独立页面。</li>
          <li>多种排版模式：单张居中、双打、合并、网格、自动堆叠与分页。</li>
          <li>证件支持四角<b>透视矫正</b>（基于 OpenCV，本地完成）。</li>
          <li>文件可<b>拖拽排序</b>，预览、打印、导出顺序实时同步。</li>
          <li>所见即所得：<b>预览 = 打印 = 导出 PDF</b>，同一套布局渲染。</li>
          <li>支持纸张方向、彩色 / 黑白、打印份数、自定义水印等设置。</li>
        </ul>
      </section>

      <section class="card">
        <h3>安全与隐私</h3>
        <ul class="safe-list">
          <li><span class="dot ok"></span><b>零后端、零上传</b>：所有文件只存在于你的浏览器内存中，不会发送到任何服务器。</li>
          <li><span class="dot ok"></span><b>断网可用</b>：首次打开加载后，即使拔掉网线也能正常处理与打印。</li>
          <li><span class="dot ok"></span><b>无账号、无追踪、无统计</b>：不收集任何个人信息。</li>
          <li><span class="dot ok"></span>所有图像处理（旋转、灰度、水印、透视矫正）均在本机完成。</li>
          <li><span class="dot warn"></span>刷新或关闭页面后文件会清空，请及时打印或导出 PDF 保存。</li>
        </ul>
      </section>

      <section class="card">
        <h3>联系作者</h3>
        <p class="contact-line">
          使用中遇到问题或有建议，欢迎邮件联系：
        </p>
        <div class="email-row">
          <a class="email" :href="`mailto:${email}`">{{ email }}</a>
          <button type="button" class="copy-btn" @click="copyEmail">复制</button>
        </div>
      </section>
    </div>
  </el-dialog>
</template>

<style scoped>
.dlg-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 68vh;
  overflow-y: auto;
  padding-right: 4px;
}
.card {
  background: var(--paper-card);
  border: 1px solid var(--line-base);
  border-radius: 10px;
  padding: 16px 18px;
}
.card h2,
.card h3 {
  margin: 0 0 10px;
  color: var(--ink-strong);
}
.card h3 {
  font-size: 14px;
}
.hero {
  display: flex;
  align-items: center;
  gap: 14px;
}
.hero h2 {
  font-size: 18px;
  margin-bottom: 2px;
}
.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 7px;
  background: var(--brand-seal);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ver {
  margin: 0;
  font-size: 12px;
  color: var(--ink-secondary);
}
.feat-list,
.safe-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
}
.feat-list li {
  position: relative;
  padding: 4px 0 4px 16px;
  font-size: 12.5px;
  color: var(--ink-body);
  line-height: 1.55;
}
.feat-list li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 11px;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--brand-seal);
}
.safe-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 0;
  font-size: 12.5px;
  color: var(--ink-body);
  line-height: 1.55;
}
.dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  margin-top: 6px;
}
.dot.ok {
  background: var(--success);
}
.dot.warn {
  background: var(--warning);
}
.contact-line {
  font-size: 12.5px;
  color: var(--ink-body);
  margin: 0 0 8px;
}
.email-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.email {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-blue);
  text-decoration: none;
}
.email:hover {
  text-decoration: underline;
}
.copy-btn {
  height: 26px;
  padding: 0 12px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--paper-raised);
  color: var(--ink-body);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}
.copy-btn:hover {
  border-color: var(--ink-blue);
  color: var(--ink-blue);
}

/* ---------- 更新日志 ---------- */
.log {
  display: flex;
  flex-direction: column;
}
.log-entry {
  padding: 8px 0;
  border-bottom: 1px solid var(--line-soft);
}
.log-entry:first-child {
  padding-top: 2px;
}
.log-entry:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.log-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.log-ver {
  font-family: var(--font-num);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink-strong);
}
.log-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-body);
}
.log-date {
  margin-left: auto;
  font-family: var(--font-num);
  font-size: 11px;
  color: var(--ink-placeholder);
}
.log-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.log-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12.5px;
  color: var(--ink-body);
  line-height: 1.5;
}
.log-tag {
  flex-shrink: 0;
  min-width: 32px;
  text-align: center;
  padding: 0 5px;
  margin-top: 2px;
  height: 17px;
  line-height: 17px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 600;
}
.log-tag.k-new {
  background: var(--success-soft);
  color: var(--success);
}
.log-tag.k-improve {
  background: var(--ink-blue-soft);
  color: var(--ink-blue);
}
.log-tag.k-fix {
  background: var(--warning-soft);
  color: var(--warning);
}
.log-text {
  min-width: 0;
}
</style>
