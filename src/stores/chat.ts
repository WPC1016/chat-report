import { reactive, computed } from 'vue'
import type { ChatMessage, ParseResult, SenderPreset } from '../types/chat'
import { parseChatFile } from '../parsers'
import { computeStats, computeWordCloud, type Stats, type WordCloudData } from '../stats/engine'
import { STOPWORDS } from '../stats/stopwords'

/**
 * 全局数据状态：导入 -> 解析 -> 统计。
 * 数据仅存内存，刷新即清空（隐私优先）。
 */
const state = reactive({
  messages: [] as ChatMessage[],
  sourceFormat: '',
  parseWarnings: [] as string[],
  skipped: 0,
  fileName: '',
  /** 双人模式预设昵称（CSV is_sender 用） */
  preset: null as SenderPreset | null,
  stats: null as Stats | null,
  wordCloud: null as WordCloudData | null,
  loaded: false,
  error: '',
})

async function loadFile(file: File) {
  reset()
  state.fileName = file.name
  const raw = await file.text()
  const result: ParseResult = parseChatFile(raw, file.name)
  state.messages = result.messages
  state.sourceFormat = result.sourceFormat
  state.parseWarnings = result.warnings
  state.skipped = result.skipped
  if (!result.messages.length) {
    state.error = result.warnings[0] || '未能解析出任何消息'
    return
  }
  recompute()
}

/** 手动指定双人昵称后重算（用于 is_sender 型 CSV 修正显示名） */
function applyPreset(preset: SenderPreset) {
  state.preset = preset
  recompute()
}

function recompute() {
  if (!state.messages.length) return
  // 若设置了预设昵称，则覆盖发送者名（按出现顺序：机主/对方）
  let messages = state.messages
  if (state.preset) {
    const senders = [...new Set(state.messages.map((m) => m.sender))]
    const mapping = new Map<string, string>()
    if (senders.length === 2) {
      mapping.set(senders[0], state.preset.self)
      mapping.set(senders[1], state.preset.peer)
    }
    if (mapping.size) {
      messages = state.messages.map((m) => ({ ...m, sender: mapping.get(m.sender) || m.sender }))
    }
  }
  state.stats = computeStats(messages)
  state.wordCloud = computeWordCloud(messages, state.stats.participants, STOPWORDS)
  state.loaded = true
  state.error = ''
}

function reset() {
  state.messages = []
  state.stats = null
  state.wordCloud = null
  state.loaded = false
  state.error = ''
  state.parseWarnings = []
  state.skipped = 0
  state.fileName = ''
  state.preset = null
}

const hasData = computed(() => state.messages.length > 0)

export function useChatStore() {
  return { state, hasData, loadFile, applyPreset, recompute, reset }
}
