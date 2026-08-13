import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ServicesPage from './pages/ServicesPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesPage />
  </StrictMode>
)
