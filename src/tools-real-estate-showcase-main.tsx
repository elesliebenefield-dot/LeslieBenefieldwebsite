import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RealEstateToolsShowcasePage from './pages/RealEstateToolsShowcasePage'

createRoot(document.getElementById('tools-real-estate-showcase-root')!).render(
  <StrictMode>
    <RealEstateToolsShowcasePage />
  </StrictMode>
)
