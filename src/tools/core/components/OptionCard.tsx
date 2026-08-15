interface OptionCardProps {
  id: string
  name: string
  value: string
  label: string
  checked: boolean
  type: 'radio' | 'checkbox'
  onChange: (value: string, checked: boolean) => void
  hasError?: boolean
}

export function OptionCard({ id, name, value, label, checked, type, onChange, hasError }: OptionCardProps) {
  return (
    <label
      htmlFor={id}
      className={`option-card${checked ? ' selected' : ''}${hasError ? ' error' : ''}`}
    >
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        checked={checked}
        onChange={e => onChange(value, e.target.checked)}
        className="option-card-input"
      />
      <span className={`option-card-indicator${type === 'checkbox' ? ' checkbox' : ''}`} aria-hidden="true">
        {type === 'radio' ? (
          <span className="option-card-dot" />
        ) : (
          <span className="option-card-check">✓</span>
        )}
      </span>
      <span className="option-card-label">{label}</span>
    </label>
  )
}
