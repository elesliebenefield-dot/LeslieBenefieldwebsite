import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tools/tools.css'
import { ListingPlanner } from './tools/real-estate/listing/ListingPlanner'

createRoot(document.getElementById('tools-listing-root')!).render(
  <StrictMode>
    <ListingPlanner />
  </StrictMode>,
)
