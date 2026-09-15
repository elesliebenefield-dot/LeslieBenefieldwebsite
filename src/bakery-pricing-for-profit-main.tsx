import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PricingForProfitArticle from './pages/bakery-pricing-content/PricingForProfitArticle'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PricingForProfitArticle />
  </StrictMode>
)
