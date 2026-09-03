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
      icon: '🔥',
      title: '消息最多的一天',
      value: `${rc.busiestDay.count} 条`,
      detail: rc.busiestDay.date,
    })
  }
  if (rc.spamKing) {
    out.push({
      icon: '🚀',
      title: '单日连发之王',
      value: rc.spamKing.count + ' 条',
      detail: `${rc.spamKing.sender} · ${rc.spamKing.date}`,
    })
  }
  if (rc.longestMessage) {
    out.push({
      icon: '📜',
      title: '最长的一条消息',
      value: `${rc.longestMessage.content.length} 字`,
      detail: `${rc.longestMessage.sender} · ${fmtDateTime(rc.longestMessage.time)}`,
      quote: rc.longestMessage.content.slice(0, 200) + (rc.longestMessage.content.length > 200 ? '…' : ''),
    })
  }
  if (rc.latestNight) {
    out.push({
      icon: '🦉',
      title: '最晚的一条消息',
      value: `${String(rc.latestNight.hour).padStart(2, '0')}:${String(rc.latestNight.msg.time.getMinutes()).padStart(2, '0')}`,
      detail: `${rc.latestNight.msg.sender} · ${fmtDateTime(rc.latestNight.msg.time)}`,
      quote: rc.latestNight.msg.content.slice(0, 100),
    })
  }
  if (rc.fastestReply) {
    out.push({
      icon: '⚡',
      title: '最快回复',
      value: rc.fastestReply.seconds < 1000 ? '瞬间' : fmtDuration(rc.fastestReply.seconds / 1000),
      detail: `${rc.fastestReply.from} 回复 ${rc.fastestReply.to}`,
      quote: rc.fastestReply.msg.content.slice(0, 100),
    })
  }
  if (rc.longestSession) {
    out.push({
      icon: '🌪️',
      title: '最长的一段会话',
      value: `${rc.longestSession.count} 条`,
      detail: `${fmtDateTime(rc.longestSession.start)} — ${fmtDateTime(rc.longestSession.end)}（约 ${Math.round(rc.longestSession.durationMin)} 分钟）`,
    })
  }
  if (rc.longestSilence) {
    out.push({
      icon: '🌙',
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
        <div class="rc-icon">{{ c.icon }}</div>
        <div class="rc-title">{{ c.title }}</div>
        <div class="rc-value">{{ c.value }}</div>
        <div class="rc-detail">{{ c.detail }}</div>
        <div v-if="c.quote" class="quote">「{{ c.quote }}」</div>
      </div>
    </div>

    <div v-if="!cards.length" class="warn-box">数据不足以生成「最」记录，请确认导入的聊天记录条数充足。</div>
  </div>
</template>
