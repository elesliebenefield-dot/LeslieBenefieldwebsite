export type EstimateMode = 'direct' | 'estimate'

interface Props {
  name: string
  mode: EstimateMode
  onChange: (mode: EstimateMode) => void
  estimateLabel?: string
}

// Shared "Enter it directly" / "Help me estimate this" switch, reused by
// Labor, Overhead, and Waste — the same radiogroup look already
// established for Supplies & Packaging's package/direct cost-entry choice
// (.bp-mode-toggle/.bp-mode-option), so a beginner-guidance path never
// introduces a new visual pattern to learn.
export function EstimateModeToggle({ name, mode, onChange, estimateLabel = 'Help me estimate this' }: Props) {
  return (
    <fieldset className="bp-field bp-estimate-mode-toggle">
      <legend className="bp-visually-hidden">How would you like to fill this in?</legend>
      <div className="bp-mode-toggle" role="radiogroup" aria-label="How would you like to fill this in?">
        <label className="bp-mode-option">
          <input type="radio" name={name} checked={mode === 'direct'} onChange={() => onChange('direct')} />
          Enter it directly
        </label>
        <label className="bp-mode-option">
          <input type="radio" name={name} checked={mode === 'estimate'} onChange={() => onChange('estimate')} />
          {estimateLabel}
        </label>
      </div>
    </fieldset>
  )
}
