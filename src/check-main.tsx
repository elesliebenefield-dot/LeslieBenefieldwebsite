import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CheckPage from './pages/CheckPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CheckPage />
  </StrictMode>
)
