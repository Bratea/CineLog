import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    watch: {
      ignored: ['**/*.apk', '**/android/build/**', '**/android/app/build/**', '**/dist/**'],
    },
  },
})
