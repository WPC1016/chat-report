<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from './stores/chat'

const route = useRoute()
const store = useChatStore()

/** Lucide 风格 SVG 图标（替代 emoji，统一 stroke 1.8 / currentColor） */
const ICONS: Record<string, string> = {
  import: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  overview: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  compare: 'M12 3v18M5 7l-3 5h6zM5 12v9M19 7l3-5h-6zM19 2v19',
  timeline: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 3',
  topics: 'M21 12a8 8 0 0 1-8 8H4l2.2-2.6A8 8 0 1 1 21 12z',
  records: 'M8 21h8m-4-4v4M7 4h10v4a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3',
  ai: 'M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z',
}

const navs = [
  { to: '/', label: '导入数据', icon: 'import' },
  { to: '/overview', label: '总览', icon: 'overview' },
  { to: '/compare', label: '双方对比', icon: 'compare' },
  { to: '/timeline', label: '时间规律', icon: 'timeline' },
  { to: '/topics', label: '话题与词云', icon: 'topics' },
  { to: '/records', label: '那些「最」', icon: 'records' },
  { to: '/ai', label: 'AI 洞察', icon: 'ai' },
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
      <nav class="nav" aria-label="主导航">
        <router-link
          v-for="n in navs"
          :key="n.to"
          :to="n.to"
          :class="{ disabled: n.to !== '/' && !hasData }"
          :aria-disabled="n.to !== '/' && !hasData ? 'true' : undefined"
          :tabindex="n.to !== '/' && !hasData ? -1 : undefined"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="ICONS[n.icon]" />
          </svg>
          <span>{{ n.label }}</span>
        </router-link>
      </nav>
      <div v-if="hasData" class="no-print" style="padding: 8px 10px;">
        <button class="btn ghost" style="width:100%; justify-content:center;" @click="exportPdf">导出 PDF</button>
      </div>
    </aside>
    <main class="main">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" v-if="route.name === 'import' || hasData" :key="String(route.name)" />
        </transition>
      </router-view>
    </main>
  </div>
</template>
