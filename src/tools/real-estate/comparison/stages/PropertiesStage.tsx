import { useState } from 'react'
import { ConfirmDialog } from '../../../core/components/ConfirmDialog'
import type { Property, PropertyType, PeriodType } from '../comparisonTypes'
import { MAX_PROPERTIES, MIN_PROPERTIES, PROPERTY_TYPE_LABELS } from '../comparisonTypes'
import { makeEmptyProperty } from '../comparisonTypes'
import { makeId } from '../comparisonPriorities'

interface Props {
  properties: Property[]
  onChange: (properties: Property[]) => void
  showErrors: boolean
}

function PeriodSelect({ value, onChange, id }: { value: PeriodType; onChange: (v: PeriodType) => void; id: string }) {
  return (
    <select
      id={id}
      className="listing-field-select cmp-period-select"
      value={value}
      onChange={e => onChange(e.target.value as PeriodType)}
      aria-label="Period"
    >
      <option value="">—</option>
      <option value="monthly">Monthly</option>
      <option value="annual">Annual</option>
    </select>
  )
}

interface PropertyFormProps {
  prop: Property
  onUpdate: (updates: Partial<Property>) => void
  formId: string
}

function PropertyForm({ prop, onUpdate, formId }: PropertyFormProps) {
  const f = (field: keyof Property) => `${formId}-${field}`

  return (
    <div className="cmp-property-form">
      {/* Identity */}
      <fieldset className="cmp-form-section">
        <legend className="cmp-form-section-legend">Identity</legend>
        <div className="cmp-field-grid">
          <div className="cmp-field">
            <label htmlFor={f('address')} className="listing-field-label">Street address <span className="tool-question-optional-tag">(optional)</span></label>
            <input id={f('address')} type="text" className="tool-input" value={prop.address} onChange={e => onUpdate({ address: e.target.value })} maxLength={200} />
          </div>
          <div className="cmp-field">
            <label htmlFor={f('listingUrl')} className="listing-field-label">Listing URL <span className="tool-question-optional-tag">(optional — text only, not fetched)</span></label>
            <input id={f('listingUrl')} type="text" className="tool-input" value={prop.listingUrl} onChange={e => onUpdate({ listingUrl: e.target.value })} maxLength={500} placeholder="https://..." />
          </div>
          <div className="cmp-field">
            <label htmlFor={f('tourDate')} className="listing-field-label">Tour date <span className="tool-question-optional-tag">(optional)</span></label>
            <input id={f('tourDate')} type="date" className="tool-input" value={prop.tourDate} onChange={e => onUpdate({ tourDate: e.target.value })} />
          </div>
          <div className="cmp-field">
            <label htmlFor={f('askingPrice')} className="listing-field-label">Asking price <span className="tool-question-optional-tag">(optional — your entry, not verified)</span></label>
            <input id={f('askingPrice')} type="text" className="tool-input" value={prop.askingPrice} onChange={e => onUpdate({ askingPrice: e.target.value })} maxLength={50} placeholder="e.g. $450,000" />
          </div>
        </div>
      </fieldset>

      {/* Basic facts */}
      <fieldset className="cmp-form-section">
        <legend className="cmp-form-section-legend">Basic facts <span className="tool-question-optional-tag">(all optional)</span></legend>
        <div className="cmp-field-grid">
          <div className="cmp-field">
            <label htmlFor={f('propertyType')} className="listing-field-label">Property type</label>
            <select id={f('propertyType')} className="listing-field-select" value={prop.propertyType} onChange={e => onUpdate({ propertyType: e.target.value as PropertyType })}>
              <option value="">— Not specified —</option>
              {(Object.keys(PROPERTY_TYPE_LABELS) as Exclude<PropertyType, ''>[]).map(k => (
                <option key={k} value={k}>{PROPERTY_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="cmp-field">
            <label htmlFor={f('bedrooms')} className="listing-field-label">Bedrooms</label>
            <input id={f('bedrooms')} type="text" className="tool-input" value={prop.bedrooms} onChange={e => onUpdate({ bedrooms: e.target.value })} maxLength={10} placeholder="e.g. 3" />
          </div>
          <div className="cmp-field">
            <label htmlFor={f('bathrooms')} className="listing-field-label">Bathrooms</label>
            <input id={f('bathrooms')} type="text" className="tool-input" value={prop.bathrooms} onChange={e => onUpdate({ bathrooms: e.target.value })} maxLength={10} placeholder="e.g. 2.5" />
          </div>
          <div className="cmp-field">
            <label htmlFor={f('sqft')} className="listing-field-label">Approx. square footage</label>
            <input id={f('sqft')} type="text" className="tool-input" value={prop.sqft} onChange={e => onUpdate({ sqft: e.target.value })} maxLength={20} placeholder="e.g. 1,850" />
          </div>
          <div className="cmp-field">
            <label htmlFor={f('yearBuilt')} className="listing-field-label">Year built</label>
            <input id={f('yearBuilt')} type="text" className="tool-input" value={prop.yearBuilt} onChange={e => onUpdate({ yearBuilt: e.target.value })} maxLength={10} placeholder="e.g. 1998" />
          </div>
          <div className="cmp-field">
            <label htmlFor={f('parking')} className="listing-field-label">Parking</label>
            <input id={f('parking')} type="text" className="tool-input" value={prop.parking} onChange={e => onUpdate({ parking: e.target.value })} maxLength={100} placeholder="e.g. 2-car garage" />
          </div>
        </div>
      </fieldset>

      {/* User-entered expenses */}
      <fieldset className="cmp-form-section">
        <legend className="cmp-form-section-legend">
          User-entered expenses <span className="tool-question-optional-tag">(optional)</span>
        </legend>
        <p className="cmp-expense-note">
          Financial figures are entered by you for comparison only and have not been verified.
        </p>
        <div className="cmp-expense-grid">
          <div className="cmp-expense-row">
            <label htmlFor={f('propertyTaxes')} className="listing-field-label">Property taxes</label>
            <div className="cmp-expense-inputs">
              <input id={f('propertyTaxes')} type="text" className="tool-input cmp-amount-input" value={prop.propertyTaxes} onChange={e => onUpdate({ propertyTaxes: e.target.value })} maxLength={30} placeholder="Amount" />
              <PeriodSelect value={prop.propertyTaxesPeriod} onChange={v => onUpdate({ propertyTaxesPeriod: v })} id={f('propertyTaxesPeriod')} />
            </div>
          </div>
          <div className="cmp-expense-row">
            <label htmlFor={f('hoaFee')} className="listing-field-label">HOA / association fee</label>
            <div className="cmp-expense-inputs">
              <input id={f('hoaFee')} type="text" className="tool-input cmp-amount-input" value={prop.hoaFee} onChange={e => onUpdate({ hoaFee: e.target.value })} maxLength={30} placeholder="Amount" />
              <PeriodSelect value={prop.hoaFeePeriod} onChange={v => onUpdate({ hoaFeePeriod: v })} id={f('hoaFeePeriod')} />
            </div>
          </div>
          <div className="cmp-expense-row">
            <label htmlFor={f('insuranceEstimate')} className="listing-field-label">Homeowners-insurance estimate</label>
            <div className="cmp-expense-inputs">
              <input id={f('insuranceEstimate')} type="text" className="tool-input cmp-amount-input" value={prop.insuranceEstimate} onChange={e => onUpdate({ insuranceEstimate: e.target.value })} maxLength={30} placeholder="Amount" />
              <PeriodSelect value={prop.insurancePeriod} onChange={v => onUpdate({ insurancePeriod: v })} id={f('insurancePeriod')} />
            </div>
          </div>
          <div className="cmp-expense-row cmp-expense-row--other">
            <label htmlFor={f('otherExpenseLabel')} className="listing-field-label">Other expense label</label>
            <input id={f('otherExpenseLabel')} type="text" className="tool-input" value={prop.otherExpenseLabel} onChange={e => onUpdate({ otherExpenseLabel: e.target.value })} maxLength={60} placeholder="e.g. Special assessment" />
            <label htmlFor={f('otherExpense')} className="listing-field-label">Other expense amount</label>
            <div className="cmp-expense-inputs">
              <input id={f('otherExpense')} type="text" className="tool-input cmp-amount-input" value={prop.otherExpense} onChange={e => onUpdate({ otherExpense: e.target.value })} maxLength={30} placeholder="Amount" />
              <PeriodSelect value={prop.otherExpensePeriod} onChange={v => onUpdate({ otherExpensePeriod: v })} id={f('otherExpensePeriod')} />
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  )
}

export function PropertiesStage({ properties, onChange, showErrors }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(
    properties.length > 0 ? properties[0].id : null
  )
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const atMax = properties.length >= MAX_PROPERTIES
  const needsMore = showErrors && properties.filter(p => p.nickname.trim()).length < MIN_PROPERTIES

  function addProperty() {
    if (atMax) return
    const newProp = makeEmptyProperty(makeId())
    onChange([...properties, newProp])
    setExpandedId(newProp.id)
  }

  function updateProperty(id: string, updates: Partial<Property>) {
    onChange(properties.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  function confirmRemove(id: string) {
    setConfirmRemoveId(id)
  }

  function executeRemove() {
    if (!confirmRemoveId) return
    const next = properties.filter(p => p.id !== confirmRemoveId)
    onChange(next)
    if (expandedId === confirmRemoveId) {
      setExpandedId(next.length > 0 ? next[next.length - 1].id : null)
    }
    setConfirmRemoveId(null)
  }

  const propToRemove = properties.find(p => p.id === confirmRemoveId)

  return (
    <div>
      <p className="cmp-stage-intro">
        Add the properties you want to compare. Each property needs a nickname to tell it apart.
        Everything else is optional — add what helps you compare.
        You can add two to four properties.
      </p>

      {needsMore && (
        <div className="tool-error-banner" role="alert">
          Add at least {MIN_PROPERTIES} properties with nicknames to continue.
        </div>
      )}

      <div className="cmp-property-list" aria-label="Properties">
        {properties.map((prop, idx) => {
          const isExpanded = expandedId === prop.id
          const hasNickname = prop.nickname.trim().length > 0
          const missingNickname = showErrors && !hasNickname

          return (
            <div
              key={prop.id}
              className={`cmp-property-card${isExpanded ? ' cmp-property-card--expanded' : ''}`}
              data-property-id={prop.id}
            >
              <div className="cmp-property-card__header">
                <div className="cmp-property-card__identity">
                  <span className="cmp-property-num" aria-hidden="true">Property {idx + 1}</span>
                  {!isExpanded && (
                    <span className="cmp-property-nickname">
                      {hasNickname ? prop.nickname : <em className="cmp-property-unnamed">No nickname yet</em>}
                    </span>
                  )}
                </div>
                <div className="cmp-property-card__actions">
                  <button
                    type="button"
                    className="listing-task-card__edit-btn"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : prop.id)}
                  >
                    {isExpanded ? 'Collapse' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    className="listing-task-card__remove-btn"
                    aria-label={`Remove ${hasNickname ? prop.nickname : 'this property'}`}
                    onClick={() => confirmRemove(prop.id)}
                  >×</button>
                </div>
              </div>

              {isExpanded && (
                <div className="cmp-property-card__body">
                  <div className="cmp-field cmp-nickname-field">
                    <label htmlFor={`nickname-${prop.id}`} className="listing-field-label">
                      Property nickname <span className="cmp-required-mark" aria-hidden="true">*</span>
                    </label>
                    {missingNickname && (
                      <span className="tool-question-error" role="alert">A nickname is required to identify this property.</span>
                    )}
                    <input
                      id={`nickname-${prop.id}`}
                      type="text"
                      className={`tool-input${missingNickname ? ' tool-input--error' : ''}`}
                      placeholder='e.g. "Oak Street colonial" or "The corner condo"'
                      value={prop.nickname}
                      onChange={e => updateProperty(prop.id, { nickname: e.target.value })}
                      maxLength={80}
                      aria-required="true"
                      aria-invalid={missingNickname}
                    />
                  </div>
                  <PropertyForm
                    prop={prop}
                    onUpdate={updates => updateProperty(prop.id, updates)}
                    formId={prop.id}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!atMax && (
        <button
          type="button"
          className="cmp-add-property-btn"
          onClick={addProperty}
        >
          + Add property{properties.length === 0 ? '' : ` (${properties.length} of ${MAX_PROPERTIES})`}
        </button>
      )}

      {atMax && (
        <p className="cmp-limit-note">Maximum of {MAX_PROPERTIES} properties reached.</p>
      )}

      <ConfirmDialog
        open={confirmRemoveId !== null}
        title="Remove this property?"
        body={`Remove "${propToRemove?.nickname || 'this property'}" and all its observations?`}
        confirmLabel="Yes, Remove"
        cancelLabel="Cancel"
        onConfirm={executeRemove}
        onCancel={() => setConfirmRemoveId(null)}
      />
    </div>
  )
}
