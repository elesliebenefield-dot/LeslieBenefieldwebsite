import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import type { Connect } from 'vite'

// Mirrors the vercel.json rewrites so clean URLs resolve correctly during
// local `vite preview` (and `vite dev`). Production routing is handled by
// Vercel — this only affects the local dev/preview server.
const VERCEL_REWRITES: Record<string, string> = {
  '/check':                                  '/check.html',
  '/services':                               '/services.html',
  '/faq':                                    '/faq.html',
  '/website-checklist':                      '/website-checklist.html',
  '/privacy-policy':                         '/privacy-policy.html',
  '/tools/real-estate/seller':               '/tools-seller.html',
  '/tools/real-estate/buyer':                '/tools-buyer.html',
  '/tools/real-estate/listing-preparation':  '/tools-listing-preparation.html',
  '/tools/real-estate/property-comparison':  '/tools-property-comparison.html',
  '/tools/real-estate/open-house-follow-up': '/tools-open-house-follow-up.html',
  '/tools/real-estate/closing-moving':       '/tools-closing-moving.html',
  '/real-estate-tools':                      '/tools-real-estate-showcase.html',
}

function rewriteMiddleware(): Connect.NextHandleFunction {
  return (req, _res, next) => {
    const cleanPath = req.url?.split('?')[0] ?? '/'
    const target = VERCEL_REWRITES[cleanPath]
    if (target) {
      const qs = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
      req.url = target + qs
    }
    next()
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-rewrites',
      configureServer(server) {
        server.middlewares.use(rewriteMiddleware())
      },
      configurePreviewServer(server) {
        server.middlewares.use(rewriteMiddleware())
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main:                    fileURLToPath(new URL('./index.html',                       import.meta.url)),
        check:                   fileURLToPath(new URL('./check.html',                       import.meta.url)),
        services:                fileURLToPath(new URL('./services.html',                    import.meta.url)),
        faq:                     fileURLToPath(new URL('./faq.html',                         import.meta.url)),
        websiteChecklist:        fileURLToPath(new URL('./website-checklist.html',           import.meta.url)),
        privacyPolicy:           fileURLToPath(new URL('./privacy-policy.html',              import.meta.url)),
        toolsSeller:             fileURLToPath(new URL('./tools-seller.html',                import.meta.url)),
        toolsBuyer:              fileURLToPath(new URL('./tools-buyer.html',                 import.meta.url)),
        toolsListingPrep:        fileURLToPath(new URL('./tools-listing-preparation.html',   import.meta.url)),
        toolsPropertyComparison: fileURLToPath(new URL('./tools-property-comparison.html',   import.meta.url)),
        toolsOpenHouseFollowUp:  fileURLToPath(new URL('./tools-open-house-follow-up.html',  import.meta.url)),
        toolsClosingMoving:      fileURLToPath(new URL('./tools-closing-moving.html',        import.meta.url)),
        toolsRealEstateShowcase: fileURLToPath(new URL('./tools-real-estate-showcase.html',  import.meta.url)),
      },
    },
  },
})
