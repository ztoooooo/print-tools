<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'

const settings = useSettingsStore()
const ui = useUiStore()

const visible = computed({
  get: () => ui.activeDialog === 'settings',
  set: (v) => {
    if (!v) ui.closeDialog()
  }
})

const wm = computed(() => settings.watermark)

const scopeOptions = [
  { value: 'id-only', label: '仅证件 Tab' },
  { value: 'all', label: '全部 Tab（发票 / 车票 / 证件）' }
] as const
</script>

<template>
  <el-dialog
    v-model="visible"
    title="设置"
    width="560px"
    class="lpt-dialog"
    append-to-body
    :close-on-click-modal="false"
  >
    <div class="dlg-body">
      <!-- 水印设置 -->
      <section class="card">
        <div class="card-head">
          <h2>水印设置</h2>
          <el-switch
            :model-value="wm.enabled"
            inline-prompt
            active-text="开"
            inactive-text="关"
            @change="(v: any) => settings.updateWatermark({ enabled: !!v })"
          />
        </div>

        <div class="card-tip">水印直接绘制在页面画布上，打印与导出的 PDF 都会包含；完全本地生成。</div>

        <fieldset :disabled="!wm.enabled" class="wm-fields">
          <div class="field">
            <label class="field-label" for="wm-text">水印内容</label>
            <el-input
              id="wm-text"
              :model-value="wm.text"
              maxlength="30"
              show-word-limit
              placeholder="例如：仅供报销使用 / 本地票据打印"
              @input="(v: string) => settings.updateWatermark({ text: v })"
            />
          </div>

          <div class="field">
            <label class="field-label">应用范围</label>
            <el-radio-group
              :model-value="wm.scope"
              @change="(v: any) => settings.updateWatermark({ scope: v })"
            >
              <el-radio v-for="o in scopeOptions" :key="o.value" :value="o.value">
                {{ o.label }}
              </el-radio>
            </el-radio-group>
          </div>

          <div class="field field-inline">
            <label class="field-label" for="wm-size">字号大小</label>
            <div class="field-control">
              <el-slider
                id="wm-size"
                :model-value="wm.fontSizeRatio"
                :min="12"
                :max="40"
                :step="1"
                style="max-width: 240px"
                @input="(v: any) => settings.updateWatermark({ fontSizeRatio: Number(v) })"
              />
              <span class="field-hint">越大字越小 · {{ wm.fontSizeRatio }}</span>
            </div>
          </div>

          <div class="field field-inline">
            <label class="field-label" for="wm-opacity">不透明度</label>
            <div class="field-control">
              <el-slider
                id="wm-opacity"
                :model-value="wm.opacity"
                :min="0.02"
                :max="0.3"
                :step="0.01"
                style="max-width: 240px"
                @input="(v: any) => settings.updateWatermark({ opacity: Number(v) })"
              />
              <span class="field-hint">{{ Math.round(wm.opacity * 100) }}%</span>
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="wm-color">水印颜色</label>
            <div class="color-row">
              <el-color-picker
                id="wm-color"
                :model-value="wm.color"
                @change="(v: string | null) => settings.updateWatermark({ color: v || '#000000' })"
              />
              <button type="button" class="reset-link" @click="settings.resetWatermark()">
                恢复默认水印
              </button>
            </div>
          </div>
        </fieldset>
      </section>

      <!-- 打印偏好说明 -->
      <section class="card muted-card">
        <div class="card-head"><h2>打印偏好</h2></div>
        <p class="muted-text">
          纸张方向、色彩模式、打印份数等偏好可在左侧「打印设置」面板中调整，自动记住，下次打开保持一致。
        </p>
      </section>
    </div>
  </el-dialog>
</template>

<style scoped>
.dlg-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.card {
  background: var(--paper-card);
  border: 1px solid var(--line-base);
  border-radius: 10px;
  padding: 16px 18px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.card-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-strong);
}
.card-tip {
  font-size: 11px;
  color: var(--ink-placeholder);
  margin-bottom: 14px;
}
.wm-fields {
  border: none;
  padding: 0;
  margin: 0;
}
.wm-fields:disabled {
  opacity: 0.55;
}
.field {
  margin-bottom: 14px;
}
.field:last-child {
  margin-bottom: 0;
}
.field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-body);
  margin-bottom: 6px;
}
.field-inline {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.field-inline .field-label {
  width: 64px;
  flex-shrink: 0;
  margin-bottom: 0;
  margin-top: 6px;
}
.field-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}
.field-hint {
  font-size: 11px;
  color: var(--ink-placeholder);
  white-space: nowrap;
}
.color-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.reset-link {
  border: none;
  background: none;
  color: var(--ink-blue);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}
.reset-link:hover {
  text-decoration: underline;
}
.muted-card .muted-text {
  font-size: 12px;
  color: var(--ink-secondary);
  margin: 6px 0 0;
  line-height: 1.6;
}
</style>
