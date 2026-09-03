/** 统一消息模型：所有格式解析后的归一化结果 */
export interface ChatMessage {
  /** 发送者标识（昵称/QQ号/wxid） */
  sender: string
  /** 发送时间（本地时间） */
  time: Date
  /** 文本内容（非文本消息为类型描述） */
  content: string
  /** 消息类型 */
  type: MessageType
}

export type MessageType =
  | 'text'      // 文本
  | 'image'     // 图片/表情
  | 'voice'     // 语音
  | 'video'     // 视频
  | 'file'      // 文件
  | 'sticker'   // 表情包/动画表情
  | 'system'    // 系统消息
  | 'other'     // 其他（链接、转账等）

/** 解析结果 */
export interface ParseResult {
  messages: ChatMessage[]
  /** 数据来源格式 */
  sourceFormat: string
  /** 无法解析而被跳过的行数 */
  skipped: number
  /** 解析过程中的提示信息 */
  warnings: string[]
}

/** 参与者信息 */
export interface Participant {
  name: string
  messageCount: number
}

/** 预设发送者（双人模式） */
export interface SenderPreset {
  /** 主体（机主）昵称 */
  self: string
  /** 对方昵称 */
  peer: string
}
