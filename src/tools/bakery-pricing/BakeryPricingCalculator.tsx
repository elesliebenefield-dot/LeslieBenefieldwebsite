// M2 placeholder: proves the route is wired and the relocated calc engine
// works end-to-end inside this repository. This is deliberately NOT the
// real guided UI — that's Milestone M3, out of scope here.
import './bakeryPricing.css'
import { computeCostBreakdown, computeSuggestedPricing } from './calc-engine/formulas.ts'

// Same worked example verified in the M1 calc-engine tests and the
// visual-design-review prototype: a 24-cookie chocolate chip batch.
const breakdown = computeCostBreakdown({
  ingredientSubtotal: '6.570247356321839080',
  wastePercent: '3',
  laborHourlyRate: '18',
  laborMinutes: '40',
  packagingBatchCost: '1.50',
  packagingPerItemCost: '0.15',
  overheadFlatCost: '3.00',
  yield_: 24,
})

const pricing =
  breakdown.valid &&
  computeSuggestedPricing(breakdown.value.totalProductionCost, 24, '35', '0.25')

export function BakeryPricingCalculator() {
  return (
    <div className="bakery-pricing-calculator">
      <h1>Free Home Bakery Pricing Calculator</h1>
      <p className="bakery-pricing-placeholder-note">
        The guided calculator UI is coming soon. In the meantime, here's proof the relocated
        calculation engine is wired up and working: a 24-cookie batch example.
      </p>
      {breakdown.valid && pricing && pricing.valid ? (
        <ul>
          <li>Total production cost: ${breakdown.value.totalProductionCost}</li>
          <li>Cost per cookie: ${breakdown.value.costPerUnit}</li>
          <li>Suggested whole-batch price: ${pricing.value.suggestedWholeBatchPrice}</li>
          <li>Suggested per-cookie price: ${pricing.value.suggestedPerItemPrice}</li>
        </ul>
      ) : (
        <p role="alert">Calculation engine error — see console.</p>
      )}
    </div>
  )
}
