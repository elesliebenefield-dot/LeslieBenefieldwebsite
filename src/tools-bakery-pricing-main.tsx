import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tools/tools.css'
import { BakeryPricingApp } from './tools/bakery-pricing/BakeryPricingApp'

createRoot(document.getElementById('tools-bakery-pricing-root')!).render(
  <StrictMode>
    <BakeryPricingApp />
  </StrictMode>,
)
