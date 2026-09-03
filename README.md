# chat-report 聊天记录可视化报告

把微信 / QQ / Telegram 等聊天工具**导出的记录文件**变成一份多页可视化报告：总览、双方对比、时间规律、话题词云、那些「最」，以及可选的 AI 分析报告。

**纯前端应用**：所有解析和统计都在你的浏览器本地完成，数据不上传任何服务器；Docker 里只有一个 nginx 静态站。

## 功能

- **多格式解析**：JSON（QQChatExporter 等）/ CSV（MemoTrace 等）/ TXT（`[2024-01-01 10:00] 昵称: 内容`）/ HTML，自动嗅探
- **总览**：可解析消息数、聊天日、会话段、日/月趋势、消息类型占比
- **双方对比**：消息数 / 字数 / 表情包 / 回复速度 / 会话发起，柱状图 + 饼图 + 明细表
- **时间规律**：7×24 消息热力图、24 小时分布、星期分布
- **话题与词云**：整体词云 + 双方各自词云 + Top20 高频词（浏览器内置 Intl.Segmenter 中文分词）
- **那些「最」**：消息最多的一天、单日连发之王、最长消息、最晚消息、最快回复、最长会话、最长沉默
- **AI 洞察（可选）**：配置任意 OpenAI 兼容接口（DeepSeek / 通义 / 智谱 / Ollama 等），基于聚合统计生成分析报告；提示词可自定义

## 快速开始

### Docker（推荐）

```bash
git clone https://github.com/WPC1016/chat-report.git
cd chat-report
docker-compose up -d --build
# 打开 http://localhost:10600（端口可在 .env 中配置，默认 10600）
```

### 本地开发

```bash
npm install
npm run dev        # http://localhost:10600
npm run build      # 产物在 dist/
```

## 数据与隐私

- 导入的文件只在浏览器内存中解析，**刷新页面即清空**，不落盘、不上传
- AI 分析默认只发送**聚合统计数据**（消息量、时段分布、高频词等）；聊天原文需在设置中显式开启「附带样本」才会发送约 40 条截断片段
- AI 服务的地址 / 模型 / API Key 保存在你浏览器的 localStorage，不会出现在任何服务器日志
- 本工具**不读取、不解密**任何聊天软件的本地数据库，只处理你主动导出的文件

## 支持的输入格式

| 来源 | 推荐导出方式 | 格式 |
|---|---|---|
| QQ | QQChatExporter 等开源工具，或消息管理器复制 | JSON / TXT |
| 微信 | MemoTrace（留痕）等工具导出，或手机端复制 | CSV / TXT |
| Telegram / Discord | 客户端自带导出功能 | JSON / HTML |
| 任意平台 | 复制粘贴为 `2024-01-01 10:00 昵称: 内容` 每行一条 | TXT |

没有文件？导入页内置「示例数据」，一键体验全部图表。

## 技术栈

Vue 3 + TypeScript + Vite + ECharts（含 echarts-wordcloud），无后端、无数据库；中文分词使用浏览器原生 `Intl.Segmenter`，零额外依赖。

## License

MIT
