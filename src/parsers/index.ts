import type { ChatMessage, MessageType, ParseResult } from '../types/chat'

/**
 * 统一解析入口：根据内容嗅探格式，分发给对应解析器。
 * 支持：JSON（QQChatExporter / 通用格式）、CSV（MemoTrace 等）、TXT（[时间] 昵称: 内容）、HTML（导出网页）
 */
export function parseChatFile(raw: string, filename: string): ParseResult {
  const trimmed = raw.trim()
  const ext = filename.toLowerCase().split('.').pop() || ''

  if (ext === 'json' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJson(trimmed)
  }
  if (ext === 'csv' || (!trimmed.includes('[') && trimmed.includes(',') && trimmed.split('\n')[0].includes(','))) {
    return parseCsv(trimmed)
  }
  if (ext === 'html' || ext === 'htm' || /<html|<div|<table|<body/i.test(trimmed.slice(0, 2000))) {
    return parseHtml(raw)
  }
  return parseTxt(trimmed)
}

/* ---------------- JSON ---------------- */

export function parseJson(raw: string): ParseResult {
  const warnings: string[] = []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { messages: [], sourceFormat: 'JSON', skipped: 0, warnings: ['JSON 解析失败：文件不是合法的 JSON'] }
  }

  const messages: ChatMessage[] = []
  let skipped = 0

  const rows: any[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.messages)
      ? (data as any).messages
      : Array.isArray((data as any)?.data)
        ? (data as any).data
        : []

  if (!rows.length) {
    return { messages: [], sourceFormat: 'JSON', skipped: 0, warnings: ['未在 JSON 中找到消息数组（尝试了 messages / data / 顶层数组）'] }
  }

  for (const row of rows) {
    const sender = str(row.sender ?? row.senderName ?? row.sender_name ?? row.talker ?? row.nickname ?? row.user ?? row.senderId ?? row.sender_id ?? '')
    const time = toDate(row.time ?? row.timestamp ?? row.sendTime ?? row.send_time ?? row.created_at ?? row.date ?? row.msgTime)
    const content = str(row.content ?? row.message ?? row.text ?? row.msg ?? row.msgContent ?? row.message_content ?? '')
    if (!sender || !time || (!content && content !== '')) { skipped++; continue }

    const type = inferType(content, row)
    messages.push({ sender, time, content: type === 'text' ? content : content || typeLabel(type), type })
  }

  if (!messages.length) warnings.push('消息数组存在但没有任何一行能解析出 发送者+时间')
  return { messages, sourceFormat: 'JSON', skipped, warnings }
}

/* ---------------- CSV ---------------- */

export function parseCsv(raw: string): ParseResult {
  const warnings: string[] = []
  const lines = raw.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { messages: [], sourceFormat: 'CSV', skipped: 0, warnings: ['CSV 内容过少或无数据行'] }

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.findIndex((h) => h === n || h.includes(n))
      if (i >= 0) return i
    }
    return -1
  }

  const iSender = idx('sender', '发送者', 'talker', '昵称', 'nickname', 'is_sender', 'from')
  const iTime = idx('time', '时间', 'date', 'timestamp', 'createtime', 'strtime')
  const iContent = idx('content', '内容', 'message', 'msg', 'text')
  const iType = idx('type', '类型', 'msg_type', 'messagetype')

  if (iTime < 0 || (iSender < 0 && iContent < 0)) {
    return { messages: [], sourceFormat: 'CSV', skipped: 0, warnings: [`CSV 表头无法识别：${header.join(', ')}`] }
  }
  if (iSender < 0) warnings.push('CSV 未找到发送者列，全部消息将标记为「未知」')

  // MemoTrace 用 is_sender(0/1) 区分双方，配合局部变量在解析后补全昵称
  const isSenderIdx = header.findIndex((h) => h === 'is_sender')
  const messages: ChatMessage[] = []
  let skipped = 0
  let selfName = '我'
  let peerName = '对方'

  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li])
    const senderRaw = iSender >= 0 ? (cols[iSender] ?? '').trim() : ''
    const time = toDate(cols[iTime])
    const content = iContent >= 0 ? (cols[iContent] ?? '').trim() : ''
    if (!time) { skipped++; continue }

    let sender: string
    if (isSenderIdx >= 0) {
      const flag = (cols[isSenderIdx] ?? '').trim()
      sender = flag === '1' ? selfName : flag === '0' ? peerName : senderRaw
    } else {
      sender = senderRaw || '未知'
    }

    let type: MessageType = 'text'
    if (iType >= 0) type = csvTypeToType(cols[iType])
    else type = inferType(content)

    messages.push({ sender, time, content: type === 'text' ? content : content || typeLabel(type), type })
  }

  if (!messages.length) warnings.push('CSV 没有任何数据行解析成功')
  return { messages, sourceFormat: 'CSV', skipped, warnings }
}

/** 双引号感知的 CSV 行拆分 */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = false
      } else cur += ch
    } else if (ch === '"') inQuote = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

function csvTypeToType(v: string): MessageType {
  const n = Number(v)
  // MemoTrace/微信 msg_type：1文本 3图片 34语音 43视频 47表情包 10000系统
  if (!Number.isNaN(n)) {
    if (n === 1) return 'text'
    if (n === 3) return 'image'
    if (n === 34) return 'voice'
    if (n === 43) return 'video'
    if (n === 47) return 'sticker'
    if (n >= 10000) return 'system'
  }
  const s = v.toLowerCase()
  if (s.includes('image') || s.includes('图')) return 'image'
  if (s.includes('voice') || s.includes('语音')) return 'voice'
  if (s.includes('video') || s.includes('视频')) return 'video'
  if (s.includes('sticker') || s.includes('表情')) return 'sticker'
  if (s.includes('system') || s.includes('系统')) return 'system'
  return 'text'
}

/* ---------------- TXT ---------------- */

/**
 * 通用 TXT 格式：
 *   [2024-01-01 10:00] 用户A: 你好
 *   2024-01-01 10:00:32 - 用户A: 你好
 *   2024/01/01 10:00 用户A：你好
 *   2024-01-01 10:00:32 用户A: 你好
 * 兼容 QQ「消息管理器」导出与手机复制粘贴的大部分形态；也兼容无日期行（前面出现过大标题行日期）。
 */
const TXT_LINE_RE =
  /^\s*[\[【(（]?\s*(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})[日]?\s*\)?]?\s+[\[【]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[\]】]?\s*[-–—:：]?\s*(.+?)\s*[-–—:：]\s*([\s\S]*)$/

export function parseTxt(raw: string): ParseResult {
  const warnings: string[] = []
  const lines = raw.split(/\r?\n/)
  const messages: ChatMessage[] = []
  let skipped = 0

  let lastDate: string | null = null
  // 无时间戳的简易格式：`昵称: 内容`（复制粘贴常见，时间为空则用 lastDate 或记为 1970）
  const SIMPLE_LINE_RE = /^\s*([^\s:：]{1,32})\s*[-–—:：]\s*([\s\S]*)$/

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 独立的日期行（QQ 消息管理器导出常见：2024年1月1日）
    const dateOnly = trimmed.match(/^(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})[日]?$/)
    if (dateOnly) {
      lastDate = `${dateOnly[1]}-${dateOnly[2].padStart(2, '0')}-${dateOnly[3].padStart(2, '0')}`
      continue
    }

    const m = trimmed.match(TXT_LINE_RE)
    if (m) {
      const [, y, mo, d, h, mi, s, sender, content] = m
      const time = new Date(+y, +mo - 1, +d, +h, +mi, s ? +s : 0)
      const msg = classifyTxtMessage(sender, content, time)
      if (msg) messages.push(msg)
      else skipped++
      lastDate = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
      continue
    }

    // 无时间戳格式：只有在已经见过日期行时才启用，避免把普通文本误判
    if (lastDate) {
      const sm = trimmed.match(SIMPLE_LINE_RE)
      if (sm && sm[2].trim()) {
        const [ , sender, content ] = sm
        const base = lastDate ? new Date(lastDate + 'T00:00:00') : new Date(0)
        const msg = classifyTxtMessage(sender, content, base)
        if (msg) { messages.push(msg); continue }
      }
    }
    skipped++
  }

  if (!messages.length) {
    warnings.push('TXT 没有解析出任何消息。请确保每行形如「[2024-01-01 10:00] 昵称: 内容」或「2024-01-01 10:00:32 昵称: 内容」')
  }
  if (skipped > messages.length && messages.length > 0) {
    warnings.push(`有 ${skipped} 行未能解析（多为图片/[图片] 标记以外的非标准行），已跳过`)
  }
  return { messages, sourceFormat: 'TXT', skipped, warnings }
}

function classifyTxtMessage(sender: string, content: string, time: Date): ChatMessage | null {
  sender = sender.trim()
  content = content.trim()
  if (!sender || !content) return null
  const type = inferType(content)
  return { sender, time, content: type === 'text' ? content : content || typeLabel(type), type }
}

/* ---------------- HTML ---------------- */

export function parseHtml(raw: string): ParseResult {
  const warnings: string[] = []
  const doc = new DOMParser().parseFromString(raw, 'text/html')
  const messages: ChatMessage[] = []
  let skipped = 0

  // 常见结构1：每条消息一个块，class 含 message/item/chat 等
  const blocks = doc.querySelectorAll('[class*="message"], [class*="chat-item"], [class*="msg"], li, tr')
  const seen = new Set<Element>()

  for (const block of blocks) {
    if (seen.has(block)) continue
    // 跳过嵌套容器：只处理最内层含时间的块
    const text = (block.textContent || '').trim()
    if (!text || text.length < 3) continue

    // 在块内找时间
    const timeMatch = text.match(/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})[日]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    if (!timeMatch) continue

    // 发送者：通常在 .sender/.name/.author 或第一个子元素
    const senderEl =
      block.querySelector('.sender, .name, .author, [class*="sender"], [class*="name"], [class*="user"], [class*="avatar"]') ||
      block.firstElementChild
    let sender = (senderEl?.textContent || '').trim().slice(0, 32)

    // 内容：去掉时间与发送者后的剩余文本
    let content = text
      .replace(timeMatch[0], '')
      .replace(sender, '')
      .trim()

    // 有些结构 sender 就在块内第一个文本节点，剥离常见前后缀
    sender = sender.replace(/^[:：\s]+|[:：\s]+$/g, '')
    if (!sender || !content) { skipped++; continue }

    seen.add(block)
    const type = inferType(content)
    messages.push({
      sender,
      time: new Date(+timeMatch[1], +timeMatch[2] - 1, +timeMatch[3], +timeMatch[4], +timeMatch[5], timeMatch[6] ? +timeMatch[6] : 0),
      content: type === 'text' ? content : content || typeLabel(type),
      type,
    })
  }

  if (!messages.length) {
    warnings.push('HTML 未能自动识别消息结构。建议改用 TXT/CSV/JSON 导出格式，或联系适配')
  }
  return { messages, sourceFormat: 'HTML', skipped, warnings }
}

/* ---------------- 工具函数 ---------------- */

function str(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v.trim()
  return ''
}

function toDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') {
    // 秒级 / 毫秒级时间戳
    const ms = v < 1e12 ? v * 1000 : v
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof v === 'string') {
    // 纯数字字符串视为时间戳
    if (/^\d{10,13}$/.test(v.trim())) {
      const n = Number(v.trim())
      const ms = n < 1e12 ? n * 1000 : n
      const d = new Date(ms)
      return Number.isNaN(d.getTime()) ? null : d
    }
    // "2024-01-01 10:00:32" / "2024/1/1 10:00" / ISO
    const m = v.match(/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})[日]?\s*(\d{1,2})?[:时]?(\d{2})?[:分]?(\d{2})?/)
    if (m) {
      return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0)
    }
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (v instanceof Date) return v
  return null
}

const IMAGE_PAT = /\[(图片|照片|图像|image)\]|<img|(\ufffd)/i
const VOICE_PAT = /\[(语音|voice)\]|语音/i
const VIDEO_PAT = /\[(视频|video)\]|\[视频号\]/i
const STICKER_PAT = /\[(表情|动画表情|sticker|emoji)\]|\[转圈\]|\[捂脸\]|\[微笑\]/i
const FILE_PAT = /\[(文件|file)\]|\.\w{1,6}\s*\(\d+\.?\d*[KMGT]?B?\)/i
const SYSTEM_PAT = /^(系统消息|系统提示)|撤回了一条消息|你已添加了|以上是打招呼|拍一拍|加入了群聊|退出了群聊|收到了一个红包/

export function inferType(content: string, row?: any): MessageType {
  const s = (content || '').trim()
  if (!s) return 'other'
  if (SYSTEM_PAT.test(s)) return 'system'
  if (row) {
    const t = row.type ?? row.msg_type ?? row.messageType
    if (t != null) {
      const mapped = csvTypeToType(String(t))
      if (mapped !== 'text') return mapped
    }
  }
  if (STICKER_PAT.test(s)) return 'sticker'
  if (IMAGE_PAT.test(s)) return 'image'
  if (VOICE_PAT.test(s) && s.length < 20) return 'voice'
  if (VIDEO_PAT.test(s)) return 'video'
  if (FILE_PAT.test(s) && s.length < 80) return 'file'
  return 'text'
}

export function typeLabel(t: MessageType): string {
  return {
    text: '文本',
    image: '[图片]',
    voice: '[语音]',
    video: '[视频]',
    file: '[文件]',
    sticker: '[表情包]',
    system: '[系统消息]',
    other: '[其他]',
  }[t]
}
