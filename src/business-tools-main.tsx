import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import BusinessToolsHubPage from './pages/BusinessToolsHubPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BusinessToolsHubPage />
  </StrictMode>
)
