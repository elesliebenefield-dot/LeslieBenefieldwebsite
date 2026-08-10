# axe-core fixtures — sub-patch 2e

Self-contained HTML strings for `src/lib/offline/oracle/axeAdapter.ts`. No external resources (no real URLs, no CDN scripts) — `axeAdapter.ts` blocks every network request outright regardless, so these would fail closed even if they tried.

- **`positive-accessible.html`** — genuinely clean: `lang`, a `<main>` landmark, alt text, a labeled input. axe-core reports zero violations and zero inconclusive checks against it.
- **`negative-missing-basics.html`** — deliberately broken: no `lang`, no alt text, no label, no landmark. Produces multiple real violations.
- **`boundary-contrast-background-image.html`** — text over a CSS background image, which axe-core cannot automatically resolve for contrast. Produces a genuine `color-contrast` **inconclusive** result, not a fabricated one — proving the adapter preserves "couldn't determine" as its own outcome rather than defaulting to pass or fail.

No accessibility score or WCAG-compliance claim is derived from any of these — the adapter (and its tests) treat axe-core's output as evidence only.
