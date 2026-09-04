import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './styles/main.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'import', component: () => import('./pages/ImportPage.vue'), meta: { title: '导入数据' } },
    { path: '/overview', name: 'overview', component: () => import('./pages/OverviewPage.vue'), meta: { title: '总览' } },
    { path: '/compare', name: 'compare', component: () => import('./pages/ComparePage.vue'), meta: { title: '双方对比' } },
    { path: '/timeline', name: 'timeline', component: () => import('./pages/TimelinePage.vue'), meta: { title: '时间规律' } },
    { path: '/topics', name: 'topics', component: () => import('./pages/TopicPage.vue'), meta: { title: '话题与词云' } },
    { path: '/records', name: 'records', component: () => import('./pages/RecordsPage.vue'), meta: { title: '那些「最」' } },
    { path: '/ai', name: 'ai', component: () => import('./pages/AiPage.vue'), meta: { title: 'AI 洞察' } },
  ],
})

createApp(App).use(router).mount('#app')
