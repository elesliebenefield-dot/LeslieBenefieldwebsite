import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import WebsiteChecklistPage from './pages/WebsiteChecklistPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebsiteChecklistPage />
  </StrictMode>
)
