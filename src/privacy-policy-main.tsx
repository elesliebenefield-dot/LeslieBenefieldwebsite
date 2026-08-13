import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivacyPolicyPage />
  </StrictMode>
)
