<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '../stores/chat'
import { fmtDateTime } from '../stats/engine'
import ChartBox from '../components/ChartBox.vue'
import type * as echarts from 'echarts'

const store = useChatStore()
const { state } = store

const stats = computed(() => state.stats!)

const COLORS = ['#4f8cff', '#f778ba', '#3fb950', '#d29922']

const typePieOption = computed<echarts.EChartsOption>(() => {
  const tc = stats.value.typeCounts
  const labels: Record<string, string> = {
    text: '文本', image: '图片', voice: '语音', video: '视频',
    file: '文件', sticker: '表情包', system: '系统', other: '其他',
  }
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#8b98ad' } },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '44%'],
      label: { color: '#8b98ad' },
      data: Object.entries(tc)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: labels[k] || k, value: v })),
      color: COLORS,
    }],
  }
})

const dailyOption = computed<echarts.EChartsOption>(() => {
  const daily = stats.value.dailyCounts
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: daily.map((d) => d.date),
      axisLabel: { color: '#8b98ad', formatter: (v: string) => v.slice(5) },
      axisLine: { lineStyle: { color: '#2a3446' } },
    },
    yAxis: { type: 'value', axisLabel: { color: '#8b98ad' }, splitLine: { lineStyle: { color: '#1c2433' } } },
    series: [{
      type: 'bar',
      data: daily.map((d) => d.count),
      itemStyle: { color: '#4f8cff', borderRadius: [2, 2, 0, 0] },
      barMaxWidth: 8,
    }],
    grid: { left: 40, right: 16, top: 20, bottom: 28 },
  }
})

const monthlyOption = computed<echarts.EChartsOption>(() => {
  const m = stats.value.monthlyBySender
  const senders = stats.value.participants.slice(0, 4).map((p) => p.name)
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { color: '#8b98ad' } },
    xAxis: {
      type: 'category',
      data: m.map((d) => d.month),
      axisLabel: { color: '#8b98ad' },
      axisLine: { lineStyle: { color: '#2a3446' } },
    },
    yAxis: { type: 'value', axisLabel: { color: '#8b98ad' }, splitLine: { lineStyle: { color: '#1c2433' } } },
    series: senders.map((s, i) => ({
      name: s,
      type: 'line' as const,
      smooth: true,
      symbolSize: 4,
      data: m.map((d) => (d as any)[s] || 0),
      lineStyle: { color: COLORS[i], width: 2 },
      itemStyle: { color: COLORS[i] },
    })),
    grid: { left: 40, right: 16, top: 36, bottom: 28 },
  }
})
</script>

<template>
  <div>
    <div class="topbar-note no-print">
      <span class="muted">来源：{{ state.fileName }}（{{ state.sourceFormat }}）</span>
      <button class="btn ghost" style="margin-left:12px;" @click="store.reset(); $router.push('/')">重新导入</button>
    </div>

    <div class="page-title">总览</div>
    <div class="page-sub">
      {{ stats.firstTime ? fmtDateTime(stats.firstTime) : '' }} —
      {{ stats.lastTime ? fmtDateTime(stats.lastTime) : '' }}
      · 跨度 {{ stats.spanDays }} 天
    </div>

    <div class="big-num-row">
      <div class="stat-card">
        <div class="num c1">{{ stats.totalMessages.toLocaleString() }}</div>
        <div class="label">可解析消息</div>
      </div>
      <div class="stat-card">
        <div class="num c2">{{ stats.chatDays.toLocaleString() }}</div>
        <div class="label">聊天日</div>
      </div>
      <div class="stat-card">
        <div class="num c3">{{ stats.sessions.toLocaleString() }}</div>
        <div class="label">会话段（间隔 &gt; 30 分钟）</div>
      </div>
      <div class="stat-card">
        <div class="num c4">{{ stats.participants.length }}</div>
        <div class="label">参与人数</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>每日消息量</h3>
        <ChartBox :option="dailyOption" />
      </div>
      <div class="card">
        <h3>消息类型占比</h3>
        <ChartBox :option="typePieOption" />
      </div>
    </div>

    <div class="card">
      <h3>月度趋势 <small>每人一条线</small></h3>
      <ChartBox :option="monthlyOption" />
    </div>

    <div class="card">
      <h3>参与排行</h3>
      <table class="simple">
        <thead><tr><th>#</th><th>昵称</th><th>消息数</th><th>占比</th></tr></thead>
        <tbody>
          <tr v-for="(p, i) in stats.participants.slice(0, 10)" :key="p.name">
            <td>{{ i + 1 }}</td>
            <td>{{ p.name }}</td>
            <td class="num">{{ p.messageCount.toLocaleString() }}</td>
            <td class="num">{{ ((p.messageCount / stats.totalMessages) * 100).toFixed(1) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
