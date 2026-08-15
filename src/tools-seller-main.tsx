import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tools/tools.css'
import { SellerPlanner } from './tools/real-estate/seller/SellerPlanner'

createRoot(document.getElementById('tools-seller-root')!).render(
  <StrictMode>
    <SellerPlanner />
  </StrictMode>,
)
