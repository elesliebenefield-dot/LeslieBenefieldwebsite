import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tools/tools.css'
import { BakeryOrderPlanner } from './tools/bakery/BakeryOrderPlanner'

createRoot(document.getElementById('tools-custom-bakery-order-root')!).render(
  <StrictMode>
    <BakeryOrderPlanner />
  </StrictMode>,
)
