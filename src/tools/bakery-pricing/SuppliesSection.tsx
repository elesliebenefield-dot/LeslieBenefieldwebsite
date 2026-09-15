import { useState } from 'react'
import { computeSuppliesSubtotal, computeSupplyDirectCost, computeSupplyItemCost } from './calc-engine/formulas.ts'
import { safeCompute } from './bakeryPricingValidationDisplay.ts'
import { formatMoney } from './bakeryPricingFormat.ts'
import { EmptyState } from './EmptyState.tsx'
import type { DraftSupplyItem } from './bakeryPricingDraftTypes.ts'

interface Props {
  items: DraftSupplyItem[]
  onAddItem: (item: DraftSupplyItem) => void
  onUpdateItem: (item: DraftSupplyItem) => void
  onRemoveItem: (id: string) => void
}

type Mode = 'package' | 'direct'

interface DraftForm {
  name: string
  mode: Mode
  packagePrice: string
  packageQuantity: string
  amountUsed: string
  directCost: string
}

function initialForm(): DraftForm {
  return { name: '', mode: 'package', packagePrice: '', packageQuantity: '', amountUsed: '', directCost: '' }
}

function formFromItem(item: DraftSupplyItem): DraftForm {
  if (item.mode === 'package') {
    return {
      name: item.name, mode: 'package',
      packagePrice: item.packagePrice, packageQuantity: item.packageQuantity, amountUsed: item.amountUsed,
      directCost: '',
    }
  }
  return { name: item.name, mode: 'direct', packagePrice: '', packageQuantity: '', amountUsed: '', directCost: item.directCost }
}

export function SuppliesSection({ items, onAddItem, onUpdateItem, onRemoveItem }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DraftForm>(initialForm())
  const [error, setError] = useState<string | null>(null)

  const previewResult =
    form.mode === 'package' && form.packagePrice.trim() !== '' && form.packageQuantity.trim() !== '' && form.amountUsed.trim() !== ''
      ? safeCompute(() => computeSupplyItemCost({ packagePrice: form.packagePrice, packageQuantity: form.packageQuantity, amountUsed: form.amountUsed }))
      : form.mode === 'direct' && form.directCost.trim() !== ''
        ? safeCompute(() => computeSupplyDirectCost(form.directCost))
        : null

  function startAdd() {
    setForm(initialForm())
    setEditingId(null)
    setError(null)
    setIsOpen(true)
  }

  function startEdit(item: DraftSupplyItem) {
    setForm(formFromItem(item))
    setEditingId(item.id)
    setError(null)
    setIsOpen(true)
  }

  function cancel() {
    setIsOpen(false)
    setEditingId(null)
    setForm(initialForm())
    setError(null)
  }

  function handleSave() {
    if (form.name.trim() === '') {
      setError('Enter a name for this item.')
      return
    }
    const result =
      form.mode === 'package'
        ? safeCompute(() => computeSupplyItemCost({ packagePrice: form.packagePrice, packageQuantity: form.packageQuantity, amountUsed: form.amountUsed }))
        : safeCompute(() => computeSupplyDirectCost(form.directCost))
    if (!result.valid) {
      setError(result.reason)
      return
    }
    const item: DraftSupplyItem =
      form.mode === 'package'
        ? { id: editingId ?? crypto.randomUUID(), name: form.name.trim(), mode: 'package', packagePrice: form.packagePrice, packageQuantity: form.packageQuantity, amountUsed: form.amountUsed, cost: result.value }
        : { id: editingId ?? crypto.randomUUID(), name: form.name.trim(), mode: 'direct', directCost: form.directCost, cost: result.value }

    if (editingId) onUpdateItem(item)
    else onAddItem(item)
    cancel()
  }

  return (
    <div className="bp-supplies-section">
      <p className="bp-helper">
        Include anything that is used up or leaves with the order — boxes, cake boards, supports, sticks,
        liners, bags, labels, ribbon, and similar items.
      </p>
      <p className="bp-helper bp-supplies-equipment-note">
        Reusable equipment — mixers, pans, decorating tools, and similar items you use again and again — doesn't
        belong here. Those costs belong in Overhead instead, not charged fresh to every recipe.
      </p>

      {items.length === 0 && (
        <EmptyState icon="📦">
          Nothing added yet. Boxes, liners, and ribbon all belong here.
        </EmptyState>
      )}

      {items.length > 0 && (
        <ul className="bp-ingredient-list">
          {items.map(item => (
            <li key={item.id} className="bp-ingredient-row">
              <span>
                {item.name}{' '}
                <span className="bp-ingredient-amount">
                  {item.mode === 'package' ? `(${item.amountUsed} used of ${item.packageQuantity})` : '(direct cost)'}
                </span>
              </span>
              <span className="bp-ingredient-cost">{formatMoney(item.cost)}</span>
              <span className="bp-row-actions">
                <button type="button" className="bp-remove-btn" onClick={() => startEdit(item)} aria-label={`Edit ${item.name}`}>
                  ✎
                </button>
                <button type="button" className="bp-remove-btn" onClick={() => onRemoveItem(item.id)} aria-label={`Remove ${item.name}`}>
                  ✕
                </button>
              </span>
            </li>
          ))}
          <li className="bp-ingredient-row bp-ingredient-subtotal">
            <strong>Supplies &amp; Packaging Subtotal</strong>
            <strong>{formatMoney(computeSuppliesSubtotal(items.map(i => i.cost)))}</strong>
          </li>
        </ul>
      )}

      {!isOpen ? (
        <button type="button" className="bp-btn bp-btn-ghost" onClick={startAdd}>
          + Add a supply or packaging item
        </button>
      ) : (
        <div className="bp-card bp-add-ingredient-form">
          <div className="bp-field">
            <label htmlFor="bp-supply-name">Item name</label>
            <input
              id="bp-supply-name"
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Cake-Pop Sticks"
            />
          </div>

          <fieldset className="bp-field">
            <legend className="bp-group-label">How do you want to figure this item's cost?</legend>
            <div className="bp-mode-toggle" role="radiogroup" aria-label="Cost entry method">
              <label className="bp-mode-option">
                <input type="radio" name="bp-supply-mode" checked={form.mode === 'package'} onChange={() => setForm(f => ({ ...f, mode: 'package' }))} />
                It came in a package
              </label>
              <label className="bp-mode-option">
                <input type="radio" name="bp-supply-mode" checked={form.mode === 'direct'} onChange={() => setForm(f => ({ ...f, mode: 'direct' }))} />
                I know the exact cost
              </label>
            </div>
          </fieldset>

          {form.mode === 'package' ? (
            <>
              <div className="bp-field">
                <label htmlFor="bp-supply-price">What did the package cost?</label>
                <input
                  id="bp-supply-price"
                  type="text"
                  inputMode="decimal"
                  value={form.packagePrice}
                  onChange={e => setForm(f => ({ ...f, packagePrice: e.target.value }))}
                  placeholder="e.g., 5.00"
                />
              </div>
              <div className="bp-amount-compare">
                <div className="bp-amount-compare-grid">
                  <div className="bp-amount-block">
                    <span className="bp-amount-block-title">Package</span>
                    <label htmlFor="bp-supply-pkg-qty">How many came in the package?</label>
                    <input
                      id="bp-supply-pkg-qty"
                      type="text"
                      inputMode="decimal"
                      value={form.packageQuantity}
                      onChange={e => setForm(f => ({ ...f, packageQuantity: e.target.value }))}
                      placeholder="e.g., 100"
                    />
                  </div>
                  <div className="bp-amount-compare-arrow" aria-hidden="true">→</div>
                  <div className="bp-amount-block">
                    <span className="bp-amount-block-title">This order</span>
                    <label htmlFor="bp-supply-used">How many does this recipe or order use?</label>
                    <input
                      id="bp-supply-used"
                      type="text"
                      inputMode="decimal"
                      value={form.amountUsed}
                      onChange={e => setForm(f => ({ ...f, amountUsed: e.target.value }))}
                      placeholder="e.g., 24"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bp-field">
              <label htmlFor="bp-supply-direct">What does this item cost for this recipe or order?</label>
              <input
                id="bp-supply-direct"
                type="text"
                inputMode="decimal"
                value={form.directCost}
                onChange={e => setForm(f => ({ ...f, directCost: e.target.value }))}
                placeholder="e.g., 6.50"
              />
              <p className="bp-helper">Useful for a single cake box, cake board, or custom topper when you already know the exact cost.</p>
            </div>
          )}

          {error ? (
            <p className="bp-error" role="alert">{error}</p>
          ) : previewResult && previewResult.valid ? (
            <p className="bp-helper">This item costs about <strong>{formatMoney(previewResult.value)}</strong>.</p>
          ) : null}

          <div className="bp-inline-fields">
            <button type="button" className="bp-btn bp-btn-secondary" onClick={cancel}>Cancel</button>
            <button type="button" className="bp-btn bp-btn-primary" onClick={handleSave}>
              {editingId ? 'Save changes' : 'Add item'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
