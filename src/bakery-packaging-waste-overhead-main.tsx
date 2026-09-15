import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PackagingWasteOverheadArticle from './pages/bakery-pricing-content/PackagingWasteOverheadArticle'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PackagingWasteOverheadArticle />
  </StrictMode>
)
