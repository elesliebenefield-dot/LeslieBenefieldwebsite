import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tools/tools.css'
import { BuyerPlanner } from './tools/real-estate/buyer/BuyerPlanner'

createRoot(document.getElementById('tools-buyer-root')!).render(
  <StrictMode>
    <BuyerPlanner />
  </StrictMode>,
)
