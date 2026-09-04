<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '../stores/chat'
import ChartBox from '../components/ChartBox.vue'
import type * as echarts from 'echarts'

const store = useChatStore()
const { state } = store
const wc = computed(() => state.wordCloud!)

const COLORS = ['#5b93ff', '#f778ba', '#3fb950', '#e0a63f', '#93c5fd', '#f0a35e', '#8ad2ce']

function cloudOption(data: { word: string; count: number }[], title?: string): echarts.EChartsOption {
  return {
    backgroundColor: 'transparent',
    title: title ? { text: title, left: 'center', top: 0, textStyle: { color: '#9aa8bd', fontSize: 13, fontWeight: 500 } } : undefined,
    tooltip: { formatter: (p: any) => `${p.name}：${p.value} 次` },
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      width: '95%',
      height: '90%',
      sizeRange: [12, 52],
      rotationRange: [0, 0],
      gridSize: 6,
      textStyle: {
        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
        color: () => COLORS[Math.floor(Math.random() * COLORS.length)],
      },
      data: data.map((d) => ({ name: d.word, value: d.count })),
    } as any],
  }
}

const overallOption = computed(() => cloudOption(wc.value.overall))

const bySenderOptions = computed(() => {
  const entries = Object.entries(wc.value.bySender)
  return entries.map(([name, data]) => ({ name, option: cloudOption(data) }))
})

/** Top20 高频词柱状图 */
const topWordsOption = computed<echarts.EChartsOption>(() => {
  const top = wc.value.overall.slice(0, 20)
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#9aa8bd' },
      splitLine: { lineStyle: { color: '#1c2433' } },
    },
    yAxis: {
      type: 'category',
      data: top.map((d) => d.word).reverse(),
      axisLabel: { color: '#e6edf3' },
      axisLine: { lineStyle: { color: '#2a3446' } },
    },
    series: [{
      type: 'bar',
      data: top.map((d) => d.count).reverse(),
      itemStyle: { color: '#5b93ff', borderRadius: [0, 4, 4, 0] },
      barMaxWidth: 14,
      label: { show: true, position: 'right', color: '#9aa8bd', fontSize: 11 },
    }],
    grid: { left: 70, right: 48, top: 12, bottom: 28 },
  }
})
</script>

<template>
  <div>
    <div class="page-title">话题与词云</div>
    <div class="page-sub">你们最常聊什么？双方的高频词对比</div>

    <div class="card">
      <h3>整体高频词云</h3>
      <ChartBox :option="overallOption" height="380px" />
    </div>

    <div class="grid-2" v-if="bySenderOptions.length">
      <div v-for="s in bySenderOptions" :key="s.name" class="card">
        <h3>{{ s.name }} 的词云</h3>
        <ChartBox :option="s.option" height="320px" />
      </div>
    </div>

    <div class="card">
      <h3>Top 20 高频词</h3>
      <ChartBox :option="topWordsOption" height="520px" />
    </div>
  </div>
</template>
