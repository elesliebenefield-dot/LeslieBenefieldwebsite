import type { ReactNode } from 'react'

interface Props {
  // A single decorative emoji/symbol. Always aria-hidden — the message text
  // is what a screen reader announces, never the icon alone.
  icon: string
  children: ReactNode
  // 'alert' is used only when the empty state is itself blocking progress
  // (e.g. Step 1 cannot advance with zero ingredients) — matches the site's
  // existing role="alert" convention for that case.
  tone?: 'neutral' | 'alert'
}

// A warm, reusable "nothing here yet" presentation — built once so M4's
// saved-recipes and ingredient-library empty states can reuse the same
// small-icon-plus-friendly-copy shape instead of a bare paragraph.
export function EmptyState({ icon, children, tone = 'neutral' }: Props) {
  return (
    <div className={`bp-empty-state${tone === 'alert' ? ' bp-empty-state-error' : ''}`} role={tone === 'alert' ? 'alert' : undefined}>
      <span className="bp-empty-state-icon" aria-hidden="true">{icon}</span>
      <p>{children}</p>
    </div>
  )
}
