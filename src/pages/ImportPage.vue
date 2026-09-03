<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat'
import type { ChatMessage } from '../types/chat'

const router = useRouter()
const store = useChatStore()

const dragover = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const { state, loadFile, recompute } = store

const accepted = '.txt,.csv,.json,.html,.htm,.log,.md'

function onDrop(e: DragEvent) {
  dragover.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) handle(f)
}
function onPick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) handle(f)
}
async function handle(f: File) {
  await loadFile(f)
  if (store.state.stats) router.push('/overview')
}

/* ---------- 示例数据 ---------- */
const demoNames = ['小鹿', '阿北']
const demoVocab = [
  ['今天', '好累', '想吃火锅', '下班了吗', '哈哈哈', '周末去爬山', '看到了一个视频', '笑死', '真的假的', '吃饭了吗', '早点睡', '在忙', '等会儿说', '好的', '明天见', '天气不错', 'emo了', '冲', '打卡', '晚安'],
  ['刚开会', '项目进度', '晚上吃什么', '笑死我了', '真的吗', '我在路上', '马上到', '看这个', '绝了', '好耶', '去哪吃', '随便', '都行', '听你的', '收到', '搞定', 'OK', '冲冲冲', '摸鱼', '困'],
]
const stickerTexts = ['[动画表情]', '[图片]', '[语音]', '[图片]']

function genDemo() {
  const msgs: ChatMessage[] = []
  const start = new Date(2025, 0, 1)
  const now = new Date()
  // 模拟约 300 天、每天 1-4 段会话的聊天
  for (let day = 0; day < 300; day++) {
    const d = new Date(start.getTime() + day * 86400000)
    if (Math.random() < 0.12) continue // 12% 天数沉默
    const sessions = 1 + Math.floor(Math.random() * 4)
    for (let s = 0; s < sessions; s++) {
      let cur = new Date(d)
      cur.setHours(8 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60), 0)
      const n = 5 + Math.floor(Math.random() * 40)
      let speaker = Math.random() < 0.5 ? 0 : 1
      for (let i = 0; i < n; i++) {
        const vocab = demoVocab[speaker]
        let content: string
        const r = Math.random()
        if (r < 0.12) content = stickerTexts[Math.floor(Math.random() * stickerTexts.length)]
        else {
          content = vocab[Math.floor(Math.random() * vocab.length)]
          if (Math.random() < 0.2) content += '，' + vocab[Math.floor(Math.random() * vocab.length)]
        }
        msgs.push({ sender: demoNames[speaker], time: new Date(cur), content, type: content.startsWith('[') ? (content.includes('语音') ? 'voice' : content.includes('图片') ? 'image' : 'sticker') : 'text' })
        cur = new Date(cur.getTime() + (5 + Math.random() * 600) * 1000)
        speaker = 1 - speaker
      }
    }
  }
  return msgs.filter((m) => m.time.getTime() < now.getTime() + 86400000)
}

function loadDemo() {
  const msgs = genDemo()
  state.messages = msgs
  state.sourceFormat = '示例数据'
  state.fileName = 'demo'
  recompute()
  router.push('/overview')
}

const fmtCount = computed(() => state.messages.length)
</script>

<template>
  <div>
    <div class="page-title">导入聊天记录</div>
    <div class="page-sub">
      全程本地解析，数据不离开浏览器。支持微信/QQ 等工具导出的
      <span class="tag">JSON</span><span class="tag">CSV</span><span class="tag">TXT</span><span class="tag">HTML</span> 文件
    </div>

    <div
      class="drop-zone"
      :class="{ dragover }"
      @dragover.prevent="dragover = true"
      @dragleave="dragover = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <div class="icon">🗂️</div>
      <div>拖拽文件到这里，或点击选择文件</div>
      <div class="hint">
        支持格式：
        QQChatExporter 的 JSON · MemoTrace 导出的 CSV · 手机/电脑复制的文本（[2024-01-01 10:00] 昵称： 内容）·
        通用网页导出（自动识别，成功率视结构而定）
      </div>
      <input ref="fileInput" type="file" :accept="accepted" style="display:none" @change="onPick" />
    </div>

    <div style="text-align:center; margin-top:20px;">
      <button class="btn ghost" @click="loadDemo">没有文件？先用示例数据体验 →</button>
    </div>

    <div v-if="state.error" class="error-box" style="margin-top:20px;">
      {{ state.error }}
    </div>

    <div v-if="state.parseWarnings.length && fmtCount" class="warn-box" style="margin-top:20px;">
      <div v-for="(w, i) in state.parseWarnings" :key="i">· {{ w }}</div>
      <div v-if="state.skipped">· 跳过了 {{ state.skipped }} 行无法识别的内容</div>
    </div>

    <div class="card" style="margin-top:32px;">
      <h3>如何导出聊天记录</h3>
      <table class="simple">
        <thead>
          <tr><th>来源</th><th>方式</th><th>推荐格式</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>QQ</td>
            <td>QQ 内置「消息管理器」可导出；或使用开源工具 QQChatExporter 导出</td>
            <td>JSON / TXT</td>
          </tr>
          <tr>
            <td>微信</td>
            <td>手机端：聊天页长按消息多选 → 合并转发到邮箱/收藏另存；或使用 MemoTrace（留痕）等工具从本地导出</td>
            <td>CSV / TXT</td>
          </tr>
          <tr>
            <td>Telegram / Discord</td>
            <td>客户端自带「导出聊天记录」功能（Desktop 版）</td>
            <td>JSON / HTML</td>
          </tr>
          <tr>
            <td>任意平台</td>
            <td>复制粘贴成文本，每行形如「2024-01-01 10:00 昵称： 内容」即可</td>
            <td>TXT</td>
          </tr>
        </tbody>
      </table>
      <p class="muted" style="margin-top:12px;">
        本工具只解析你已导出的文件，不读取、不解密任何聊天软件的本地数据库。
      </p>
    </div>
  </div>
</template>
