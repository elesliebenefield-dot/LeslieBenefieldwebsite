// A monotonic ISO-timestamp clock. `Date.now()` alone has millisecond
// resolution, so two writes issued in the same tick (routine on a fast
// machine, or in tests) can produce identical createdAt/updatedAt values —
// which makes "this write happened after that one" unprovable from the
// timestamp alone. This clock guarantees every call returns a value
// strictly later than every previous call in this process, with no sleep
// and no reliance on wall-clock speed: it only ever advances ahead of
// Date.now() by the minimum needed, and lets real time catch back up.
let lastMs = 0

export function nowIso(): string {
  const ms = Math.max(Date.now(), lastMs + 1)
  lastMs = ms
  return new Date(ms).toISOString()
}
