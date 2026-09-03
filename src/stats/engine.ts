import type { ChatMessage, MessageType, Participant } from '../types/chat'

/** 默认会话切分间隔（毫秒）：相邻消息间隔超过 30 分钟即新会话 */
export const SESSION_GAP_MS = 30 * 60 * 1000

/** 全量统计结果 */
export interface Stats {
  /** 可解析消息总数（不含系统消息） */
  totalMessages: number
  /** 含系统消息的原始总数 */
  rawCount: number
  /** 有消息的自然日数 */
  chatDays: number
  /** 会话段数 */
  sessions: number
  /** 时间跨度（天） */
  spanDays: number
  firstTime: Date | null
  lastTime: Date | null
  /** 参与者列表（按消息数降序） */
  participants: Participant[]
  /** 双人模式（恰好两个主要参与者） */
  isTwoParty: boolean
  /** 消息类型分布 */
  typeCounts: Record<MessageType, number>
  /** 每日消息量（按天） */
  dailyCounts: { date: string; count: number }[]
  /** 每日消息量（按双方） */
  dailyBySender: { date: string; [sender: string]: number | string }[]
  /** 每月消息量（双方） */
  monthlyBySender: { month: string; [sender: string]: number | string }[]
  /** 24 小时分布（双方） */
  hourlyBySender: { hour: number; [sender: string]: number | string }[]
  /** 星期分布（双方） */
  weekdayBySender: { weekday: number; [sender: string]: number | string }[]
  /** 24x7 热力图 [星期(0-6)][小时(0-23)] */
  heatmap: number[][]
  /** 消息长度统计（按发送者） */
  lengthBySender: { sender: string; total: number; avg: number; max: number }[]
  /** 会话发起方统计 */
  sessionStarter: Record<string, number>
  /** 双方回复间隔（毫秒数组，按人） */
  replyTimes: Record<string, number[]>
  /** 表情包数量（按发送者） */
  stickerBySender: Record<string, number>
  /** 「最」记录 */
  records: Records
}

/** 「几个最」 */
export interface Records {
  /** 消息最多的一天 */
  busiestDay: { date: string; count: number } | null
  /** 最长的一条消息 */
  longestMessage: ChatMessage | null
  /** 最晚的一条消息（0-5 点算深夜） */
  latestNight: { msg: ChatMessage; hour: number } | null
  /** 最快的回复（秒） */
  fastestReply: { from: string; to: string; seconds: number; msg: ChatMessage } | null
  /** 最长的一段连续会话（消息数） */
  longestSession: { count: number; start: Date; end: Date; durationMin: number } | null
  /** 最长的沉默（无消息天数） */
  longestSilence: { days: number; from: Date; to: Date } | null
  /** 单日连发最多（同一天同一人） */
  spamKing: { sender: string; date: string; count: number } | null
  /** 最常使用的表情包日 / 拍一拍等其他扩展留给上层 */
}

/** 停用词表传入，返回高频词 */
export interface WordFreq {
  word: string
  count: number
}

export interface WordCloudData {
  overall: WordFreq[]
  bySender: Record<string, WordFreq[]>
}

/** 统计入口 */
export function computeStats(messages: ChatMessage[]): Stats {
  const sorted = [...messages].sort((a, b) => a.time.getTime() - b.time.getTime())
  const valid = sorted.filter((m) => m.type !== 'system')

  // --- 参与者 ---
  const countBySender = new Map<string, number>()
  for (const m of valid) countBySender.set(m.sender, (countBySender.get(m.sender) || 0) + 1)
  const participants: Participant[] = [...countBySender.entries()]
    .map(([name, messageCount]) => ({ name, messageCount }))
    .sort((a, b) => b.messageCount - a.messageCount)
  const isTwoParty = participants.length === 2

  // --- 基础量 ---
  const typeCounts = emptyTypeCounts()
  for (const m of sorted) typeCounts[m.type]++
  const daySet = new Set<string>()
  for (const m of valid) daySet.add(dateKey(m.time))

  const firstTime = sorted.length ? sorted[0].time : null
  const lastTime = sorted.length ? sorted[sorted.length - 1].time : null

  // --- 会话切分 ---
  const sessions: ChatMessage[][] = []
  let cur: ChatMessage[] = []
  for (const m of sorted) {
    if (cur.length && m.time.getTime() - cur[cur.length - 1].time.getTime() > SESSION_GAP_MS) {
      sessions.push(cur)
      cur = []
    }
    cur.push(m)
  }
  if (cur.length) sessions.push(cur)

  const sessionStarter: Record<string, number> = {}
  for (const s of sessions) {
    if (s.length) sessionStarter[s[0].sender] = (sessionStarter[s[0].sender] || 0) + 1
  }

  // --- 时间分布 ---
  const dailyMap = new Map<string, Map<string, number>>()
  const monthlyMap = new Map<string, Map<string, number>>()
  const hourlyMap = new Map<number, Map<string, number>>()
  const weekdayMap = new Map<number, Map<string, number>>()
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  const dayCountBySender = new Map<string, Map<string, number>>() // sender -> date -> count
  const stickerBySender: Record<string, number> = {}
  const lengthAgg = new Map<string, { total: number; max: number; n: number }>()

  for (const m of valid) {
    const dk = dateKey(m.time)
    const mk = dk.slice(0, 7)
    const h = m.time.getHours()
    const wd = m.time.getDay()

    incMap(dailyMap, dk, m.sender)
    incMap(monthlyMap, mk, m.sender)
    incMap(hourlyMap, h, m.sender)
    incMap(weekdayMap, wd, m.sender)
    heatmap[wd][h]++
    if (!dayCountBySender.has(m.sender)) dayCountBySender.set(m.sender, new Map())
    const dm = dayCountBySender.get(m.sender)!
    dm.set(dk, (dm.get(dk) || 0) + 1)

    if (m.type === 'sticker') stickerBySender[m.sender] = (stickerBySender[m.sender] || 0) + 1

    if (m.type === 'text') {
      const len = m.content.length
      if (!lengthAgg.has(m.sender)) lengthAgg.set(m.sender, { total: 0, max: 0, n: 0 })
      const agg = lengthAgg.get(m.sender)!
      agg.total += len
      agg.n++
      agg.max = Math.max(agg.max, len)
    }
  }

  const dailyBySender = [...dailyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, m]) => ({ date, ...Object.fromEntries(m) }))
  const monthlyBySender = [...monthlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, m]) => ({ month, ...Object.fromEntries(m) }))
  const hourlyBySender = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    ...Object.fromEntries(hourlyMap.get(hour) || new Map()),
  }))
  const weekdayBySender = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    ...Object.fromEntries(weekdayMap.get(weekday) || new Map()),
  }))

  const dailyCounts = dailyBySender.map((d) => ({
    date: d.date,
    count: participants.reduce((s, p) => s + (Number((d as Record<string, number | string>)[p.name]) || 0), 0),
  }))

  const lengthBySender = participants.map((p) => {
    const agg = lengthAgg.get(p.name)
    return {
      sender: p.name,
      total: agg?.total || 0,
      avg: agg && agg.n ? Math.round(agg.total / agg.n * 10) / 10 : 0,
      max: agg?.max || 0,
    }
  })

  // --- 回复间隔 ---
  const replyTimes: Record<string, number[]> = {}
  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1]
    const curMsg = valid[i]
    if (prev.sender === curMsg.sender) continue
    const gap = curMsg.time.getTime() - prev.time.getTime()
    if (gap > 0 && gap < 60 * 60 * 1000) {
      if (!replyTimes[curMsg.sender]) replyTimes[curMsg.sender] = []
      replyTimes[curMsg.sender].push(gap)
    }
  }

  // --- 「最」记录 ---
  let busiestDay: Stats['records']['busiestDay'] = null
  for (const d of dailyCounts) if (!busiestDay || d.count > busiestDay.count) busiestDay = d

  let longestMessage: ChatMessage | null = null
  for (const m of valid) {
    if (m.type !== 'text') continue
    if (!longestMessage || m.content.length > longestMessage.content.length) longestMessage = m
  }

  let latestNight: Stats['records']['latestNight'] = null
  for (const m of valid) {
    const h = m.time.getHours()
    if (h < 5 && (!latestNight || m.time.getTime() > latestNight.msg.time.getTime())) {
      latestNight = { msg: m, hour: h }
    }
  }

  let fastestReply: Stats['records']['fastestReply'] = null
  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1]
    const curMsg = valid[i]
    if (prev.sender === curMsg.sender) continue
    const gap = curMsg.time.getTime() - prev.time.getTime()
    if (gap <= 0 || gap >= 60 * 60 * 1000) continue
    if (!fastestReply || gap < fastestReply.seconds) {
      fastestReply = { from: curMsg.sender, to: prev.sender, seconds: gap, msg: curMsg }
    }
  }

  let longestSession: Stats['records']['longestSession'] = null
  for (const s of sessions) {
    if (!s.length) continue
    const durationMin = (s[s.length - 1].time.getTime() - s[0].time.getTime()) / 60000
    if (!longestSession || s.length > longestSession.count) {
      longestSession = { count: s.length, start: s[0].time, end: s[s.length - 1].time, durationMin }
    }
  }

  let longestSilence: Stats['records']['longestSilence'] = null
  for (let i = 1; i < valid.length; i++) {
    const gapMs = valid[i].time.getTime() - valid[i - 1].time.getTime()
    const days = Math.floor(gapMs / 86400000)
    if (days >= 1 && (!longestSilence || days > longestSilence.days)) {
      longestSilence = { days, from: valid[i - 1].time, to: valid[i].time }
    }
  }

  let spamKing: Stats['records']['spamKing'] = null
  for (const [sender, dm] of dayCountBySender) {
    for (const [date, count] of dm) {
      if (!spamKing || count > spamKing.count) spamKing = { sender, date, count }
    }
  }

  const spanDays = firstTime && lastTime
    ? Math.max(1, Math.ceil((lastTime.getTime() - firstTime.getTime()) / 86400000))
    : 0

  return {
    totalMessages: valid.length,
    rawCount: sorted.length,
    chatDays: daySet.size,
    sessions: sessions.length,
    spanDays,
    firstTime,
    lastTime,
    participants,
    isTwoParty,
    typeCounts,
    dailyCounts,
    dailyBySender,
    monthlyBySender,
    hourlyBySender,
    weekdayBySender,
    heatmap,
    lengthBySender,
    sessionStarter,
    replyTimes,
    stickerBySender,
    records: {
      busiestDay,
      longestMessage,
      latestNight,
      fastestReply,
      longestSession,
      longestSilence,
      spamKing,
    },
  }
}

/* ---------------- 高频词 ---------------- */

const SEGMENTER = typeof Intl !== 'undefined' && 'Segmenter' in Intl
  ? new (Intl as any).Segmenter('zh-CN', { granularity: 'word' })
  : null

export function extractWords(messages: ChatMessage[]): string[] {
  const words: string[] = []
  for (const m of messages) {
    if (m.type !== 'text') continue
    const s = m.content
    if (SEGMENTER) {
      for (const seg of SEGMENTER.segment(s)) {
        const w = (seg.segment || '').trim()
        if (w) words.push(w)
      }
    } else {
      // 退化：按非 CJK/字母数字切
      for (const w of s.split(/[^\p{Script=Han}a-zA-Z0-9]+/u)) if (w) words.push(w)
    }
  }
  return words
}

export function wordFreq(words: string[], stopwords: Set<string>, topN = 100): WordFreq[] {
  const counter = new Map<string, number>()
  for (const raw of words) {
    const w = raw.toLowerCase()
    if (w.length < 1) continue
    // 过滤：纯标点、纯数字（>2位）、停用词、单字符非中文
    if (stopwords.has(w)) continue
    if (!/[\p{Script=Han}a-zA-Z0-9]/u.test(w)) continue
    if (/^\d+$/.test(w) && w.length > 4) continue
    if (w.length === 1 && !/[\p{Script=Han}]/u.test(w)) continue
    counter.set(w, (counter.get(w) || 0) + 1)
  }
  return [...counter.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
}

export function computeWordCloud(
  messages: ChatMessage[],
  participants: Participant[],
  stopwords: Set<string>,
): WordCloudData {
  const valid = messages.filter((m) => m.type === 'text')
  const overall = wordFreq(extractWords(valid), stopwords, 120)
  const bySender: Record<string, WordFreq[]> = {}
  for (const p of participants.slice(0, 2)) {
    const msgs = valid.filter((m) => m.sender === p.name)
    bySender[p.name] = wordFreq(extractWords(msgs), stopwords, 60)
  }
  return { overall, bySender }
}

/* ---------------- 工具 ---------------- */

function emptyTypeCounts(): Record<MessageType, number> {
  return { text: 0, image: 0, voice: 0, video: 0, file: 0, sticker: 0, system: 0, other: 0 }
}

function incMap(map: Map<string | number, Map<string, number>>, key: string | number, sender: string) {
  if (!map.has(key)) map.set(key, new Map())
  const inner = map.get(key)!
  inner.set(sender, (inner.get(sender) || 0) + 1)
}

export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fmtDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dateKey(d)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} 秒`
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} 小时`
  return `${Math.round(seconds / 86400)} 天`
}
