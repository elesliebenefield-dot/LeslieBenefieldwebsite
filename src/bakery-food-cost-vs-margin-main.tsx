import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import FoodCostVsMarginArticle from './pages/bakery-pricing-content/FoodCostVsMarginArticle'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FoodCostVsMarginArticle />
  </StrictMode>
)
