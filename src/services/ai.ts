import type { Stats, WordCloudData } from '../stats/engine'
import { fmtDateTime } from '../stats/engine'
import type { ChatMessage } from '../types/chat'

/** AI 服务配置（OpenAI 兼容 /chat/completions） */
export interface AiConfig {
  /** 如 https://api.deepseek.com/v1 或 http://127.0.0.1:11434/v1 */
  baseUrl: string
  apiKey: string
  model: string
}

export interface AiOptions {
  /** 自定义提示词（用户可改） */
  prompt: string
  /** 是否附带原文样本（默认关闭，隐私优先） */
  includeSample: boolean
}

const LS_KEY = 'chat-report:ai-config'

export function loadAiConfig(): AiConfig & AiOptions {
  const fallback: AiConfig & AiOptions = {
    baseUrl: '',
    apiKey: '',
    model: '',
    prompt: DEFAULT_PROMPT,
    includeSample: false,
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

export function saveAiConfig(cfg: AiConfig & AiOptions) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg))
}

export function clearAiConfig() {
  localStorage.removeItem(LS_KEY)
}

export const DEFAULT_PROMPT = `你是一位聊天记录分析师。请根据我提供的【聚合统计数据】写一份中文分析报告，要求：

1. 报告分四个部分，用 markdown 小标题：关系概览 / 聊天习惯 / 话题与兴趣 / 有趣的发现
2. 全文 600-900 字，语气轻松但专业，像一份给两个人的年度报告
3. 只基于给出的统计数据进行推断，不要编造数据中不存在的细节
4. 结尾给出 1-2 条让聊天更愉快的轻松建议
5. 数据中人数可能不止 2 人，请按实际情况分析主要参与者`

/** 将统计结果压缩为紧凑 JSON 文本（避免发原文，控制 token） */
export function buildAnalysisPayload(
  stats: Stats,
  wc: WordCloudData,
  messages: ChatMessage[],
  opts: AiOptions,
): string {
  const topWords = wc.overall.slice(0, 30).map((w) => `${w.word}(${w.count})`)
  const senderWords = Object.entries(wc.bySender).map(([name, ws]) => ({
    sender: name,
    topWords: ws.slice(0, 10).map((w) => `${w.word}(${w.count})`),
  }))

  // 热力图摘要：找出最活跃的时段和星期
  const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  let peak = { wd: 0, h: 0, v: 0 }
  const hourTotals = new Array(24).fill(0)
  for (let wd = 0; wd < 7; wd++) {
    for (let h = 0; h < 24; h++) {
      const v = stats.heatmap[wd][h]
      hourTotals[h] += v
      if (v > peak.v) peak = { wd, h, v }
    }
  }
  const nightCount = hourTotals.slice(0, 6).reduce((a, b) => a + b, 0)
  const nightShare = ((nightCount / Math.max(1, stats.totalMessages)) * 100).toFixed(1)

  const payload: Record<string, unknown> = {
    时间范围: `${fmtDateTime(stats.firstTime!)} 至 ${fmtDateTime(stats.lastTime!)}，跨度 ${stats.spanDays} 天`,
    基础数据: {
      可解析消息: stats.totalMessages,
      聊天日: stats.chatDays,
      会话段: stats.sessions,
      参与人数: stats.participants.length,
    },
    参与者: stats.participants.slice(0, 6).map((p) => ({ 昵称: p.name, 消息数: p.messageCount })),
    消息类型分布: stats.typeCounts,
    月度趋势: stats.monthlyBySender,
    每小时分布: stats.hourlyBySender.map((h) => ({ 小时: h.hour, 数量: Object.entries(h).filter(([k]) => k !== 'hour').map(([k, v]) => `${k}:${v}`).join(' ') })),
    星期分布: stats.weekdayBySender.map((w) => ({ 星期: WD[w.weekday], 数量: Object.entries(w).filter(([k]) => k !== 'weekday').map(([k, v]) => `${k}:${v}`).join(' ') })),
    最活跃时段: `${WD[peak.wd]} ${peak.h}:00（${peak.v} 条）`,
    深夜消息占比: `${nightShare}%（0-6 点）`,
    双方字数: stats.lengthBySender.slice(0, 4),
    会话发起: stats.sessionStarter,
    表情包: stats.stickerBySender,
    全局高频词: topWords.join('、'),
    各自高频词: senderWords,
    记录: {
      消息最多的一天: stats.records.busiestDay,
      单日连发之王: stats.records.spamKing,
      最快回复秒: stats.records.fastestReply ? Math.round(stats.records.fastestReply.seconds / 1000) : null,
      最长会话条数: stats.records.longestSession?.count,
      最长沉默天数: stats.records.longestSilence?.days,
    },
  }

  if (opts.includeSample && messages.length) {
    const texts = messages.filter((m) => m.type === 'text')
    const sample: string[] = []
    const step = Math.max(1, Math.floor(texts.length / 40))
    for (let i = 0; i < texts.length && sample.length < 40; i += step) {
      const m = texts[i]
      sample.push(`[${fmtDateTime(m.time)}] ${m.sender}: ${m.content.slice(0, 80)}`)
    }
    payload.原文样本说明 = '以下为全时段等距抽样的原文片段（已截断），供风格与话题分析'
    payload.原文样本 = sample
  }

  return '【聚合统计数据】\n' + JSON.stringify(payload, null, 1)
}

/** 流式调用 OpenAI 兼容接口；onDelta 逐段回调，返回完整文本 */
export async function streamChat(
  cfg: AiConfig,
  systemPrompt: string,
  userContent: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const base = cfg.baseUrl.replace(/\/+$/, '')
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
    signal,
  })

  if (!res.ok) {
    let detail = ''
    try { detail = (await res.text()).slice(0, 300) } catch { /* ignore */ }
    throw new Error(`接口返回 ${res.status}：${detail || res.statusText}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const data = t.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          full += delta
          onDelta(delta)
        }
      } catch { /* 忽略非 JSON 行（如注释） */ }
    }
  }

  if (!full) throw new Error('接口没有返回任何内容，请检查模型名称是否正确')
  return full
}
