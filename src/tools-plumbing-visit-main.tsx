import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tools/tools.css'
import { PlumbingVisitPlanner } from './tools/plumbing/PlumbingVisitPlanner'

createRoot(document.getElementById('tools-plumbing-visit-root')!).render(
  <StrictMode>
    <PlumbingVisitPlanner />
  </StrictMode>,
)
