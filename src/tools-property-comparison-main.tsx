import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tools/tools.css'
import { PropertyComparisonPlanner } from './tools/real-estate/comparison/PropertyComparisonPlanner'

createRoot(document.getElementById('tools-property-comparison-root')!).render(
  <StrictMode>
    <PropertyComparisonPlanner />
  </StrictMode>,
)
