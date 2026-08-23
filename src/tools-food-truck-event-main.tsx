import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tools/tools.css'
import { FoodTruckEventPlanner } from './tools/foodtruck/FoodTruckEventPlanner'

createRoot(document.getElementById('tools-food-truck-event-root')!).render(
  <StrictMode>
    <FoodTruckEventPlanner />
  </StrictMode>,
)
