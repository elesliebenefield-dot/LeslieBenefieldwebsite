interface Props {
  // A single decorative emoji marking a major section (Ingredients, Labor,
  // Supplies & Packaging, Cost Breakdown, Suggested Pricing). Always
  // aria-hidden — the adjacent heading text already carries the meaning.
  symbol: string
  tone?: 'raspberry' | 'gold'
}

// Small round accent medallion behind a section's emoji — one restrained,
// reusable visual motif rather than a different treatment per heading.
export function SectionIcon({ symbol, tone = 'gold' }: Props) {
  return (
    <span className={`bp-section-icon bp-section-icon-${tone}`} aria-hidden="true">
      {symbol}
    </span>
  )
}
