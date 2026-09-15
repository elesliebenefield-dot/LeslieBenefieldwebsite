import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LaborCostArticle from './pages/bakery-pricing-content/LaborCostArticle'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LaborCostArticle />
  </StrictMode>
)
