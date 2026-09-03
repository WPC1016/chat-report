<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from './stores/chat'

const route = useRoute()
const store = useChatStore()

const navs = [
  { to: '/', label: '导入数据', icon: '📥' },
  { to: '/overview', label: '总览', icon: '📊' },
  { to: '/compare', label: '双方对比', icon: '⚖️' },
  { to: '/timeline', label: '时间规律', icon: '🕐' },
  { to: '/topics', label: '话题与词云', icon: '💬' },
  { to: '/records', label: '那些「最」', icon: '🏆' },
]

const hasData = computed(() => store.hasData.value)

function exportPdf() {
  window.print()
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar no-print">
      <div class="brand">聊天<span>报告</span></div>
      <nav class="nav">
        <router-link v-for="n in navs" :key="n.to" :to="n.to" :class="{ disabled: n.to !== '/' && !hasData }">
          <span class="nav-icon">{{ n.icon }}</span><span>{{ n.label }}</span>
        </router-link>
      </nav>
      <div v-if="hasData" class="no-print" style="padding: 8px 10px;">
        <button class="btn ghost" style="width:100%; justify-content:center;" @click="exportPdf">导出 PDF</button>
      </div>
    </aside>
    <main class="main">
      <router-view v-if="route.name === 'import' || hasData" />
      <router-view v-else name="empty" />
    </main>
  </div>
</template>
