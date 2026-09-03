import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { port: 10600, strictPort: true },
  preview: { port: 10600, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts', 'echarts-wordcloud'],
          vue: ['vue', 'vue-router'],
        },
      },
    },
  },
})
