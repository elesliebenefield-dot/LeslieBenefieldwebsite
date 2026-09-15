import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tools/tools.css'
import { BakeryPricingCalculator } from './tools/bakery-pricing/BakeryPricingCalculator'

createRoot(document.getElementById('tools-bakery-pricing-root')!).render(
  <StrictMode>
    <BakeryPricingCalculator />
  </StrictMode>,
)
