import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ReviewPage from './pages/ReviewPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReviewPage />
  </StrictMode>
)
