# First real-checker fixtures (overflow + readability)

Self-contained local HTML, no external resources. Both checks share fixtures where convenient (one page load produces measurements for both).

- **`clean.html`** — fits the 390px mobile viewport, comfortable text size. Positive for both checks.
- **`overflow-issue.html`** — a fixed 900px-wide element, clear horizontal overflow. Negative for overflow.
- **`overflow-boundary.html`** — ~12px wider than the viewport. Boundary for overflow.
- **`tiny-text.html`** — 9px paragraph text. Negative for readability.
- **`text-boundary.html`** — 12px paragraph text. Boundary for readability.
- **`no-visible-text.html`** — no text nodes at all (image only). Proves the honest "couldn't be checked" (`unverified`) outcome for readability, not a fabricated pass.

No accessibility score or WCAG-compliance claim is derived from any of these.
