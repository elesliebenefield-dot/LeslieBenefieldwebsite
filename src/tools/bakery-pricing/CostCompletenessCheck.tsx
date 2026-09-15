interface CompletenessItem {
  key: string
  label: string
  included: boolean
}

interface Props {
  laborIncluded: boolean
  overheadIncluded: boolean
  wasteIncluded: boolean
  suppliesIncluded: boolean
}

function joinLabels(labels: string[]): string {
  if (labels.length === 1) return labels[0]!
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

// A calm, non-alarming summary of which cost categories fed into the
// suggested price above. Zero and "not entered" are treated identically
// (both read as "not included") — this deliberately never implies a
// category set to zero means the business genuinely has none of that
// cost, only that it wasn't factored into this particular calculation.
export function CostCompletenessCheck({ laborIncluded, overheadIncluded, wasteIncluded, suppliesIncluded }: Props) {
  const items: CompletenessItem[] = [
    { key: 'labor', label: 'Labor', included: laborIncluded },
    { key: 'overhead', label: 'Overhead', included: overheadIncluded },
    { key: 'waste', label: 'Waste', included: wasteIncluded },
    { key: 'supplies', label: 'Supplies & Packaging', included: suppliesIncluded },
  ]
  const missing = items.filter(item => !item.included)

  return (
    <div className="bp-completeness-check" role="status">
      <p className="bp-helper"><strong>Cost completeness check</strong></p>
      <ul className="bp-completeness-list">
        {items.map(item => (
          <li key={item.key} className={`bp-completeness-item${item.included ? '' : ' bp-completeness-item-missing'}`}>
            <span className="bp-completeness-icon" aria-hidden="true">{item.included ? '✓' : '—'}</span>
            <span>{item.label} {item.included ? 'included' : 'not included'}</span>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <p className="bp-completeness-note">
          Your suggested price may be lower than your true cost, since {joinLabels(missing.map(m => m.label))}{' '}
          {missing.length === 1 ? "wasn't" : "weren't"} included. You can always go back and add{' '}
          {missing.length === 1 ? 'it' : 'them'} in Additional Costs.
        </p>
      )}
    </div>
  )
}
