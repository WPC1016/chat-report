<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '../stores/chat'
import ChartBox from '../components/ChartBox.vue'
import type * as echarts from 'echarts'

const store = useChatStore()
const { state } = store
const stats = computed(() => state.stats!)

const COLORS = ['#5b93ff', '#f778ba', '#3fb950', '#d29922']
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const two = computed(() => stats.value.participants.slice(0, 2))

/** 24 小时分布 */
const hourlyOption = computed<echarts.EChartsOption>(() => {
  const h = stats.value.hourlyBySender
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { color: '#9aa8bd' } },
    xAxis: {
      type: 'category',
      data: h.map((d) => `${d.hour}时`),
      axisLabel: { color: '#9aa8bd' },
      axisLine: { lineStyle: { color: '#2a3446' } },
    },
    yAxis: { type: 'value', axisLabel: { color: '#9aa8bd' }, splitLine: { lineStyle: { color: '#1c2433' } } },
    series: two.value.map((p, i) => ({
      name: p.name,
      type: 'line' as const,
      smooth: true,
      areaStyle: { opacity: 0.15 },
      data: h.map((d) => (d as any)[p.name] || 0),
      lineStyle: { color: COLORS[i], width: 2 },
      itemStyle: { color: COLORS[i] },
    })),
    grid: { left: 40, right: 16, top: 40, bottom: 28 },
  }
})

/** 星期分布 */
const weekdayOption = computed<echarts.EChartsOption>(() => {
  const w = stats.value.weekdayBySender
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { color: '#9aa8bd' } },
    xAxis: {
      type: 'category',
      data: w.map((d) => WEEKDAYS[d.weekday]),
      axisLabel: { color: '#9aa8bd' },
      axisLine: { lineStyle: { color: '#2a3446' } },
    },
    yAxis: { type: 'value', axisLabel: { color: '#9aa8bd' }, splitLine: { lineStyle: { color: '#1c2433' } } },
    series: two.value.map((p, i) => ({
      name: p.name,
      type: 'bar' as const,
      data: w.map((d) => (d as any)[p.name] || 0),
      itemStyle: { color: COLORS[i], borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 24,
    })),
    grid: { left: 40, right: 16, top: 40, bottom: 28 },
  }
})

/** 7×24 热力图 */
const heatOption = computed<echarts.EChartsOption>(() => {
  const hm = stats.value.heatmap
  const data: [number, number, number][] = []
  let max = 0
  for (let wd = 0; wd < 7; wd++) {
    for (let h = 0; h < 24; h++) {
      const v = hm[wd][h]
      data.push([h, wd, v])
      if (v > max) max = v
    }
  }
  return {
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      formatter: (p: any) => `${WEEKDAYS[p.value[1]]} ${p.value[0]}:00<br/>${p.value[2]} 条消息`,
    },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}`),
      axisLabel: { color: '#9aa8bd' },
      axisLine: { show: false },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category',
      data: WEEKDAYS,
      axisLabel: { color: '#9aa8bd' },
      axisLine: { show: false },
    },
    visualMap: {
      min: 0,
      max: max || 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      textStyle: { color: '#9aa8bd' },
      // 冷→热渐变（蓝→橙→品红），高值更醒目
      inRange: { color: ['#161b27', '#1d4ed8', '#5b93ff', '#93c5fd', '#f0a35e', '#f778ba'] },
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: false },
      itemStyle: { borderColor: '#0d1117', borderWidth: 2, borderRadius: 3 },
    }],
    grid: { left: 56, right: 16, top: 16, bottom: 64 },
  }
})
</script>

<template>
  <div>
    <div class="page-title">时间规律</div>
    <div class="page-sub">什么时候聊得最多？谁更爱熬夜？</div>

    <div class="card">
      <h3>7 × 24 消息热力图 <small>一眼看出你们的作息</small></h3>
      <ChartBox :option="heatOption" height="380px" />
    </div>

    <div class="card">
      <h3>一天 24 小时活跃分布</h3>
      <ChartBox :option="hourlyOption" />
    </div>

    <div class="card">
      <h3>星期分布</h3>
      <ChartBox :option="weekdayOption" />
    </div>
  </div>
</template>
