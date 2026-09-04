<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '../stores/chat'
import { fmtDateTime, fmtDuration } from '../stats/engine'

const store = useChatStore()
const { state } = store
const stats = computed(() => state.stats!)
const r = computed(() => stats.value.records)

const cards = computed(() => {
  const rc = r.value
  const out: { icon: string; title: string; value: string; detail: string; quote?: string }[] = []

  if (rc.busiestDay) {
    out.push({
      icon: 'M12 22c4.4 0 8-3.6 8-8 0-3.5-2.5-6.4-4-8-.5 2-1.5 3-3 3.5.5-2.5-.5-5.5-3-7.5.2 3-1 4.5-2.5 6C6 9.5 4 11.5 4 14c0 4.4 3.6 8 8 8zM12 22c1.7 0 3-1.6 3-3.5S13.7 15 12 13c-1.7 2-3 3.6-3 5.5S10.3 22 12 22z',
      title: '消息最多的一天',
      value: `${rc.busiestDay.count} 条`,
      detail: rc.busiestDay.date,
    })
  }
  if (rc.spamKing) {
    out.push({
      icon: 'M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8-.8-.7-2.2-.7-3 .8zM12 15l-3-3a22 22 0 0 1 2-3.9A12.7 12.7 0 0 1 21.5 2c0 2.7-.8 7.5-6 10.5a22.4 22.4 0 0 1-3.5 2.5zM9 12H4s.5-3 2-4 4 0 4 0M12 15v5s3-.5 4-2-1-4-1-4',
      title: '单日连发之王',
      value: rc.spamKing.count + ' 条',
      detail: `${rc.spamKing.sender} · ${rc.spamKing.date}`,
    })
  }
  if (rc.longestMessage) {
    out.push({
      icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8m8 4H8m2-8H8',
      title: '最长的一条消息',
      value: `${rc.longestMessage.content.length} 字`,
      detail: `${rc.longestMessage.sender} · ${fmtDateTime(rc.longestMessage.time)}`,
      quote: rc.longestMessage.content.slice(0, 200) + (rc.longestMessage.content.length > 200 ? '…' : ''),
    })
  }
  if (rc.latestNight) {
    out.push({
      icon: 'M12 2a7 7 0 0 1 7 7v6a7 7 0 0 1-14 0V9a7 7 0 0 1 7-7zM9 9h.01M15 9h.01M2 9l3 1m17-1-3 1M8 20l-2 3m12-3 2 3',
      title: '最晚的一条消息',
      value: `${String(rc.latestNight.hour).padStart(2, '0')}:${String(rc.latestNight.msg.time.getMinutes()).padStart(2, '0')}`,
      detail: `${rc.latestNight.msg.sender} · ${fmtDateTime(rc.latestNight.msg.time)}`,
      quote: rc.latestNight.msg.content.slice(0, 100),
    })
  }
  if (rc.fastestReply) {
    out.push({
      icon: 'M13 2 3 14h7l-1 8 10-12h-7z',
      title: '最快回复',
      value: rc.fastestReply.seconds < 1000 ? '瞬间' : fmtDuration(rc.fastestReply.seconds / 1000),
      detail: `${rc.fastestReply.from} 回复 ${rc.fastestReply.to}`,
      quote: rc.fastestReply.msg.content.slice(0, 100),
    })
  }
  if (rc.longestSession) {
    out.push({
      icon: 'M9 3h9a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4h-1a2 2 0 0 0 0 4H7a2 2 0 0 1 0-4h1a2 2 0 0 0 0-4H5a2 2 0 0 1 0-4h4a2 2 0 0 0 0-4z',
      title: '最长的一段会话',
      value: `${rc.longestSession.count} 条`,
      detail: `${fmtDateTime(rc.longestSession.start)} — ${fmtDateTime(rc.longestSession.end)}（约 ${Math.round(rc.longestSession.durationMin)} 分钟）`,
    })
  }
  if (rc.longestSilence) {
    out.push({
      icon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
      title: '最长的一次沉默',
      value: `${rc.longestSilence.days} 天`,
      detail: `${fmtDateTime(rc.longestSilence.from)} 之后 — ${fmtDateTime(rc.longestSilence.to)} 重新联系`,
    })
  }
  return out
})
</script>

<template>
  <div>
    <div class="page-title">那些「最」</div>
    <div class="page-sub">这段聊天记录里最值得记住的瞬间</div>

    <div class="grid-3" style="margin-top: 8px;">
      <div v-for="c in cards" :key="c.title" class="record-card">
        <svg class="rc-icon" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="c.icon" /></svg>
        <div class="rc-title">{{ c.title }}</div>
        <div class="rc-value">{{ c.value }}</div>
        <div class="rc-detail">{{ c.detail }}</div>
        <div v-if="c.quote" class="quote">「{{ c.quote }}」</div>
      </div>
    </div>

    <div v-if="!cards.length" class="warn-box">数据不足以生成「最」记录，请确认导入的聊天记录条数充足。</div>
  </div>
</template>
