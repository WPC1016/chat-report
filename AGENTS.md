# chat-report

聊天记录可视化报告（纯前端）。

- **端口**：Web 入口 10600（工作区分配段 10600-10699）
- **架构**：Vue3 + TS + Vite + ECharts SPA；无后端、无数据库、无容器
- **数据**：浏览器本地解析用户导入的 JSON/CSV/TXT/HTML，不入库、不上传
- **分词**：Intl.Segmenter + 内置停用词表（src/stats/stopwords.ts）
- **核心目录**：
  - `src/parsers/` 四种格式解析器（统一入口 `parseChatFile`）
  - `src/stats/engine.ts` 统计引擎（纯函数：会话切分、对比、热力图、词频、「最」记录）
  - `src/pages/` 六个页面（导入/总览/对比/时间/话题/最）
- 导出 PDF 用 `window.print()`（main.css 里有 @media print 样式）
