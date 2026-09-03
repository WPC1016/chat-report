import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './styles/main.css'

import ImportPage from './pages/ImportPage.vue'
import OverviewPage from './pages/OverviewPage.vue'
import ComparePage from './pages/ComparePage.vue'
import TimelinePage from './pages/TimelinePage.vue'
import TopicPage from './pages/TopicPage.vue'
import RecordsPage from './pages/RecordsPage.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'import', component: ImportPage, meta: { title: '导入数据' } },
    { path: '/overview', name: 'overview', component: OverviewPage, meta: { title: '总览' } },
    { path: '/compare', name: 'compare', component: ComparePage, meta: { title: '双方对比' } },
    { path: '/timeline', name: 'timeline', component: TimelinePage, meta: { title: '时间规律' } },
    { path: '/topics', name: 'topics', component: TopicPage, meta: { title: '话题与词云' } },
    { path: '/records', name: 'records', component: RecordsPage, meta: { title: '那些「最」' } },
  ],
})

createApp(App).use(router).mount('#app')
