<script setup lang="ts">
/**
 * AI 洞察页：配置模型（本地 localStorage）→ 可选自定义提示词 → 流式生成分析报告。
 */
import { ref, onMounted } from 'vue'
import { useChatStore } from '../stores/chat'
import {
  loadAiConfig, saveAiConfig, clearAiConfig, DEFAULT_PROMPT,
  buildAnalysisPayload, streamChat, type AiConfig, type AiOptions,
} from '../services/ai'

const store = useChatStore()
const { state } = store

const cfg = ref<AiConfig & AiOptions>({ baseUrl: '', apiKey: '', model: '', prompt: DEFAULT_PROMPT, includeSample: false })
const showKey = ref(false)
const panelOpen = ref(false)
const testing = ref(false)
const testResult = ref('')

const running = ref(false)
const output = ref('')
const error = ref('')
const elapsed = ref(0)
let aborter: AbortController | null = null
let timer: number | null = null

onMounted(() => {
  cfg.value = loadAiConfig()
})

function persist() {
  saveAiConfig(cfg.value)
  testResult.value = '已保存到本机（localStorage）'
}

function forget() {
  clearAiConfig()
  cfg.value = { baseUrl: '', apiKey: '', model: '', prompt: DEFAULT_PROMPT, includeSample: false }
  testResult.value = '已清除本机保存的配置'
}

async function testConnection() {
  testing.value = true
  testResult.value = ''
  try {
    let got = ''
    await streamChat(cfg.value, '你是连通性测试助手，只输出一个词。', '回复「连通」两个字', (d) => { got += d })
    testResult.value = `✅ 连通成功，模型返回：${got.slice(0, 30)}`
    saveAiConfig(cfg.value)
  } catch (e: any) {
    testResult.value = `❌ ${e.message || String(e)}`
  } finally {
    testing.value = false
  }
}

async function runAnalysis() {
  if (!state.stats || !state.wordCloud) return
  error.value = ''
  output.value = ''
  running.value = true
  elapsed.value = 0
  aborter = new AbortController()
  timer = window.setInterval(() => elapsed.value++, 1000)
  try {
    const payload = buildAnalysisPayload(state.stats, state.wordCloud, state.messages, {
      prompt: cfg.value.prompt,
      includeSample: cfg.value.includeSample,
    })
    await streamChat(
      cfg.value,
      cfg.value.prompt || DEFAULT_PROMPT,
      payload,
      (d) => { output.value += d },
      aborter.signal,
    )
    saveAiConfig(cfg.value)
  } catch (e: any) {
    if (e.name === 'AbortError') error.value = '已取消'
    else error.value = e.message || String(e)
  } finally {
    running.value = false
    if (timer) { clearInterval(timer); timer = null }
    aborter = null
  }
}

function stop() {
  aborter?.abort()
}

/** 简易 markdown 渲染：标题/加粗/列表/段落 */
function renderMd(src: string): string {
  const esc = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^\s*(\d+)\.\s+(.+)$/gm, '<li>$2</li>')
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>')
    .split(/\n{2,}/)
    .map((p) => (/^<(h\d|ul|li)/.test(p.trim()) ? p : `<p>${p.replace(/\n/g, '<br/>')}</p>`))
    .join('\n')
}

function copyOutput() {
  navigator.clipboard.writeText(output.value)
}
</script>

<template>
  <div>
    <div class="page-title">AI 洞察</div>
    <div class="page-sub">
      让大模型基于聚合统计写一份分析报告。配置只存在本机浏览器；默认只发送统计数据，<strong>不发送聊天原文</strong>。
    </div>

    <!-- 配置面板 -->
    <div class="card no-print">
      <div class="cfg-head" @click="panelOpen = !panelOpen" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0;">模型配置 <small v-if="cfg.baseUrl">· {{ cfg.baseUrl }}</small></h3>
        <span class="muted">{{ panelOpen ? '收起 ▲' : '展开 ▼' }}</span>
      </div>

      <div v-show="panelOpen" style="margin-top:16px;">
        <div class="grid-2">
          <div>
            <label class="field-label">接口地址（Base URL，OpenAI 兼容）</label>
            <input v-model="cfg.baseUrl" class="field" placeholder="如 https://api.deepseek.com/v1 或本地 Ollama http://127.0.0.1:11434/v1" />
          </div>
          <div>
            <label class="field-label">模型名称</label>
            <input v-model="cfg.model" class="field" placeholder="如 deepseek-chat / gpt-4o-mini / qwen2.5:7b" />
          </div>
        </div>
        <div style="margin-top:12px;">
          <label class="field-label">API Key（选填，本地模型可留空）</label>
          <div style="display:flex; gap:8px;">
            <input v-model="cfg.apiKey" :type="showKey ? 'text' : 'password'" class="field" placeholder="sk-..." autocomplete="off" />
            <button class="btn ghost" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
          </div>
        </div>
        <div style="margin-top:12px;">
          <label class="field-label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" v-model="cfg.includeSample" />
            附带聊天原文样本（约 40 条等距抽样，用于话题/风格分析；默认关闭以保护隐私）
          </label>
        </div>
        <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
          <button class="btn" @click="persist">保存配置</button>
          <button class="btn ghost" :disabled="testing || !cfg.baseUrl" @click="testConnection">{{ testing ? '测试中…' : '测试连通' }}</button>
          <button class="btn ghost" @click="forget">清除本机配置</button>
        </div>
        <div v-if="testResult" class="muted" style="margin-top:10px;">{{ testResult }}</div>
      </div>
    </div>

    <!-- 提示词 -->
    <div class="card no-print">
      <h3>分析提示词 <small>可自定义；空则用默认</small></h3>
      <textarea v-model="cfg.prompt" class="field" rows="6" :placeholder="DEFAULT_PROMPT" style="resize:vertical;" />
      <div style="display:flex; gap:10px; margin-top:10px;">
        <button class="btn ghost" @click="cfg.prompt = DEFAULT_PROMPT">恢复默认提示词</button>
      </div>
    </div>

    <!-- 生成 -->
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <h3 style="margin:0;">分析报告 {{ running ? `· 生成中 ${elapsed}s` : '' }}</h3>
        <div style="display:flex; gap:10px;" class="no-print">
          <template v-if="!running">
            <button class="btn" :disabled="!cfg.baseUrl || !cfg.model" @click="runAnalysis">开始 AI 分析</button>
          </template>
          <template v-else>
            <button class="btn ghost" @click="stop">停止</button>
          </template>
          <button v-if="output && !running" class="btn ghost" @click="copyOutput">复制全文</button>
        </div>
      </div>

      <div v-if="!cfg.baseUrl || !cfg.model" class="warn-box" style="margin-top:14px;">
        请先在上方「模型配置」中填写接口地址和模型名称（任何 OpenAI 兼容接口均可：DeepSeek / 通义 / 智谱 / Ollama 本地模型等）。
      </div>

      <div v-if="error" class="error-box" style="margin-top:14px;">{{ error }}</div>

      <div v-if="output" class="md-body" v-html="renderMd(output)" />
      <div v-else-if="!running && !error" class="muted" style="margin-top:14px;">
        点击「开始 AI 分析」后，将把总览/对比/时间/话题各页的聚合统计发送给你配置的模型，流式生成报告。
      </div>
      <div v-if="running && !output" class="muted" style="margin-top:14px;">等待模型返回…</div>
    </div>
  </div>
</template>

<style scoped>
.field-label { display:block; font-size:13px; color:var(--text-dim); margin-bottom:6px; }
.field {
  width:100%;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  padding: 9px 12px;
  outline: none;
}
.field:focus { border-color: var(--accent); }
textarea.field { line-height: 1.6; }
.md-body { margin-top: 16px; line-height: 1.8; }
.md-body :deep(h2) { font-size: 19px; margin: 20px 0 10px; }
.md-body :deep(h3) { font-size: 16px; margin: 18px 0 8px; color: var(--accent); }
.md-body :deep(h4) { font-size: 15px; margin: 14px 0 6px; }
.md-body :deep(p) { margin: 8px 0; }
.md-body :deep(ul) { padding-left: 22px; margin: 8px 0; }
.md-body :deep(li) { margin: 4px 0; }
</style>
