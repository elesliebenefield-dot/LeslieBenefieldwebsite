import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tools/tools.css'
import { OpenHouseFollowUpPlanner } from './tools/real-estate/open-house/OpenHouseFollowUpPlanner'

createRoot(document.getElementById('tools-open-house-follow-up-root')!).render(
  <StrictMode>
    <OpenHouseFollowUpPlanner />
  </StrictMode>,
)
