import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: { host: 'localhost', port: 3000 },
  resolve: {
    alias: {
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@views': fileURLToPath(new URL('./src/views', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@composables': fileURLToPath(new URL('./src/composables', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
      '@router': fileURLToPath(new URL('./src/router', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 将Vue相关库分离到单独的chunk
          'vue-vendor': ['vue', 'vue-router'],
          // 将Chart.js相关库分离到单独的chunk
          'chart-vendor': ['chart.js', 'chartjs-plugin-datalabels'],
        },
      },
    },
    // 提高chunk大小警告阈值到1000kB（如果仍需要）
    chunkSizeWarningLimit: 1000,
  },
})
