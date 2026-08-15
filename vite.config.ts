import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        check: fileURLToPath(new URL('./check.html', import.meta.url)),
        services: fileURLToPath(new URL('./services.html', import.meta.url)),
        faq: fileURLToPath(new URL('./faq.html', import.meta.url)),
        websiteChecklist: fileURLToPath(new URL('./website-checklist.html', import.meta.url)),
        privacyPolicy: fileURLToPath(new URL('./privacy-policy.html', import.meta.url)),
        toolsSeller: fileURLToPath(new URL('./tools-seller.html', import.meta.url)),
        toolsBuyer: fileURLToPath(new URL('./tools-buyer.html', import.meta.url)),
      },
    },
  },
})
