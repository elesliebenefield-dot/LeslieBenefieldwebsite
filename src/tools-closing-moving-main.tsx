import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tools/tools.css'
import { ClosingMovingOrganizer } from './tools/real-estate/closing/ClosingMovingOrganizer'

createRoot(document.getElementById('tools-closing-moving-root')!).render(
  <StrictMode>
    <ClosingMovingOrganizer />
  </StrictMode>,
)
