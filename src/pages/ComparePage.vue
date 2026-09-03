<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '../stores/chat'
import ChartBox from '../components/ChartBox.vue'
import { fmtDuration } from '../stats/engine'
import type * as echarts from 'echarts'

const store = useChatStore()
const { state } = store
const stats = computed(() => state.stats!)

const COLORS = ['#4f8cff', '#f778ba', '#3fb950', '#d29922']

const two = computed(() => stats.value.participants.slice(0, 2))

/** 双方对比柱状图（归一化显示：总量/字数/平均字数/表情包） */
const compareBarOption = computed<echarts.EChartsOption>(() => {
  const ls = stats.value.lengthBySender
  const names = two.value.map((p) => p.name)
  const getL = (n: string) => ls.find((x) => x.sender === n)
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { color: '#8b98ad' } },
    xAxis: {
      type: 'category',
      data: ['消息数', '总字数', '平均字数/条', '表情包数'],
      axisLabel: { color: '#8b98ad' },
      axisLine: { lineStyle: { color: '#2a3446' } },
    },
    yAxis: { type: 'value', axisLabel: { color: '#8b98ad' }, splitLine: { lineStyle: { color: '#1c2433' } } },
    series: names.map((n, i) => ({
      name: n,
      type: 'bar' as const,
      data: [
        stats.value.participants.find((p) => p.name === n)?.messageCount || 0,
        getL(n)?.total || 0,
        getL(n)?.avg || 0,
        stats.value.stickerBySender[n] || 0,
      ],
      itemStyle: { color: COLORS[i], borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 28,
    })),
    grid: { left: 48, right: 16, top: 40, bottom: 28 },
  }
})

/** 消息占比饼图（双人并排玫瑰图） */
const sharePieOption = computed<echarts.EChartsOption>(() => ({
  backgroundColor: 'transparent',
  tooltip: { trigger: 'item', formatter: '{b}: {c} 条（{d}%）' },
  series: [{
    type: 'pie',
    roseType: 'radius',
    radius: ['30%', '70%'],
    center: ['50%', '50%'],
    label: { color: '#e6edf3', formatter: '{b}\n{d}%' },
    data: two.value.map((p) => ({ name: p.name, value: p.messageCount })),
    color: COLORS,
  }],
}))

/** 平均回复速度对比 */
const replyBarOption = computed<echarts.EChartsOption>(() => {
  const rt = stats.value.replyTimes
  const names = two.value.map((p) => p.name)
  const med = (arr: number[] = []) => {
    if (!arr.length) return 0
    const s = [...arr].sort((a, b) => a - b)
    return Math.round(s[Math.floor(s.length / 2)] / 1000)
  }
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', valueFormatter: (v) => fmtDuration(Number(v)) },
    xAxis: {
      type: 'category',
      data: ['中位回复速度', '最快回复'],
      axisLabel: { color: '#8b98ad' },
      axisLine: { lineStyle: { color: '#2a3446' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8b98ad', formatter: (v: number) => v >= 60 ? `${Math.round(v / 60)}分` : `${v}秒` },
      splitLine: { lineStyle: { color: '#1c2433' } },
    },
    series: names.map((n, i) => {
      const arr = rt[n] || []
      const s = [...arr].sort((a, b) => a - b)
      return {
        name: n,
        type: 'bar' as const,
        data: [med(arr), s.length ? Math.round(s[0] / 1000) : 0],
        itemStyle: { color: COLORS[i], borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 32,
      }
    }),
    grid: { left: 48, right: 16, top: 40, bottom: 28 },
  }
})

/** 会话发起占比 */
const starterOption = computed<echarts.EChartsOption>(() => {
  const ss = stats.value.sessionStarter
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#8b98ad' } },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '44%'],
      label: { color: '#8b98ad', formatter: '{b}: {d}%' },
      data: Object.entries(ss).map(([name, value]) => ({ name, value })),
      color: COLORS,
    }],
  }
})

/** 对比明细表数据 */
const tableRows = computed(() => {
  const ls = stats.value.lengthBySender
  const rt = stats.value.replyTimes
  return two.value.map((p) => {
    const l = ls.find((x) => x.sender === p.name)
    const arr = rt[p.name] || []
    const sorted = [...arr].sort((a, b) => a - b)
    return {
      name: p.name,
      count: p.messageCount,
      share: ((p.messageCount / stats.value.totalMessages) * 100).toFixed(1) + '%',
      chars: l?.total || 0,
      avg: l?.avg || 0,
      max: l?.max || 0,
      stickers: stats.value.stickerBySender[p.name] || 0,
      started: stats.value.sessionStarter[p.name] || 0,
      medianReply: sorted.length ? fmtDuration(sorted[Math.floor(sorted.length / 2)] / 1000) : '—',
    }
  })
})
</script>

<template>
  <div>
    <div class="page-title">双方对比</div>
    <div class="page-sub">两位主要参与者的全方位对比</div>

    <div class="card">
      <h3>核心指标对比</h3>
      <ChartBox :option="compareBarOption" />
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>消息量占比</h3>
        <ChartBox :option="sharePieOption" />
      </div>
      <div class="card">
        <h3>回复速度对比 <small>越短越秒回</small></h3>
        <ChartBox :option="replyBarOption" />
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>谁更常开启话题 <small>会话第一句是谁发的</small></h3>
        <ChartBox :option="starterOption" />
      </div>
      <div class="card">
        <h3>对比明细</h3>
        <table class="simple">
          <thead>
            <tr><th>指标</th><th v-for="r in tableRows" :key="r.name">{{ r.name }}</th></tr>
          </thead>
          <tbody>
            <tr><td>消息数</td><td class="num" v-for="r in tableRows" :key="r.name">{{ r.count }}</td></tr>
            <tr><td>占比</td><td class="num" v-for="r in tableRows" :key="r.name">{{ r.share }}</td></tr>
            <tr><td>总字数</td><td class="num" v-for="r in tableRows" :key="r.name">{{ r.chars.toLocaleString() }}</td></tr>
            <tr><td>平均字数/条</td><td class="num" v-for="r in tableRows" :key="r.name">{{ r.avg }}</td></tr>
            <tr><td>最长一条（字）</td><td class="num" v-for="r in tableRows" :key="r.name">{{ r.max }}</td></tr>
            <tr><td>表情包</td><td class="num" v-for="r in tableRows" :key="r.name">{{ r.stickers }}</td></tr>
            <tr><td>发起会话次数</td><td class="num" v-for="r in tableRows" :key="r.name">{{ r.started }}</td></tr>
            <tr><td>中位回复速度</td><td class="num" v-for="r in tableRows" :key="r.name">{{ r.medianReply }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
