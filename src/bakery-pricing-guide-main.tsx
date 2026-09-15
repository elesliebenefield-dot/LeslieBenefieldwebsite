import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import BakeryPricingLandingPage from './pages/bakery-pricing-content/BakeryPricingLandingPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BakeryPricingLandingPage />
  </StrictMode>
)
