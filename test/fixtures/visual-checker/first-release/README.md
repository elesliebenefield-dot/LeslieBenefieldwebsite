# First real-checker fixtures (overflow + readability)

Self-contained local HTML, no external resources. Both checks share fixtures where convenient (one page load produces measurements for both).

- **`clean.html`** — fits the 390px mobile viewport, comfortable text size. Positive for both checks.
- **`overflow-issue.html`** — a fixed 900px-wide element, clear horizontal overflow. Negative for overflow.
- **`overflow-boundary.html`** — ~12px wider than the viewport. Boundary for overflow.
- **`tiny-text.html`** — 9px paragraph text. Negative for readability.
- **`text-boundary.html`** — 12px paragraph text. Boundary for readability.
- **`no-visible-text.html`** — no text nodes at all (image only). Proves the honest "couldn't be checked" (`unverified`) outcome for readability, not a fabricated pass.
- **`small-footer-text.html`** — comfortable 16px `<main>` content, 9px semantic `<footer>` text. Positive for readability: the footer's small text must not drive the outcome, but is mentioned as context.
- **`no-main-small-footer.html`** — no `<main>` element; comfortable 16px content and `<nav>` text, small (9px) semantic `<footer>` text. Proves footer exclusion doesn't depend on `<main>` existing, and that `<nav>` is measured as meaningful (not swept in with the footer).
- **`div-based-footer-small-text.html`** — comfortable 16px `<main>` content, 9px text inside a `<div class="site-footer">` (no semantic `<footer>` tag). Proves the generic, conservative div-based footer detection (class/id mentioning "footer", positioned near the bottom of the page) — not a site-specific selector.
- **`small-nav-text.html`** — 9px `<nav>` text outside any footer, comfortable 16px `<main>` content. Negative for readability: small navigation text must still be measured as meaningful, never dismissed as footer/utility.

No accessibility score or WCAG-compliance claim is derived from any of these.
