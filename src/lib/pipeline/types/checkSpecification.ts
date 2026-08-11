// Sub-patch 2a — the single central registry associating a check ID with
// every version/payload/audit-key it owns, PLUS the shared generic
// machinery every correlated production type is built from.
//
// Corrected design (second correction pass): the first design used plain
// generic interfaces like `RawCapture<K>` whose fields independently
// indexed `CheckRegistry[K]`. When `K` is the default/all-check union,
// TypeScript's indexed-access distributes each FIELD across the union
// independently — producing one object type whose `checkId` is a union
// AND whose `payload` is a separate, uncorrelated union — so a value
// mixing check A's ID with check B's payload satisfied it. `RawCaptureFor`
// etc. below fix this with a DISTRIBUTIVE CONDITIONAL TYPE
// (`K extends unknown ? {...} : never`): instantiated with a union, the
// conditional distributes over each member of K *first*, building a
// complete, internally-consistent object for that one K, and only THEN
// takes the union of those complete objects. The result is a union of
// whole per-check shapes, not one shape with independently-unioned
// fields — a value must match one member's checkId/version/payload
// combination in full, not mix and match across members.
//
// This machinery is exported generically over ANY conforming registry
// (`Reg extends CheckRegistryShape`), not hardcoded to the production
// `CheckRegistry` — so the compile-time proofs (__compileTimeChecks.ts)
// can instantiate the EXACT SAME type constructors against a separate,
// two-entry, test-only registry, rather than hand-reimplementing parallel
// synthetic shapes that could drift from what production actually does.

export interface CheckRegistryEntry {
  captureSchemaVersion: string
  capturePayload: unknown
  evidenceSchemaVersion: string
  evidence: unknown
  contractVersion: string
  /**
   * The exact, minimized set of evidence-derived fields this check's
   * results are permitted to reference in an AuditRecord, and the exact
   * value type each one carries — see auditRecord.ts. Never the whole
   * evidence object; never a provenance field. A check with nothing to
   * audit yet (Milestone 2's trivial `empty` entry) registers
   * `Record<never, never>` — genuinely no keys, not an invented one.
   */
  auditFields: Record<string, unknown>
}

/**
 * Any check registry — production or test-only — must conform to this
 * shape: every one of ITS OWN keys must map to a `CheckRegistryEntry`.
 *
 * Deliberately NOT `Record<string, CheckRegistryEntry>`: a plain interface
 * with only specific literal keys (no index signature) does not satisfy a
 * `Record<string, X>` constraint in TypeScript, and forcing it to via
 * `interface CheckRegistry extends Record<string, X>` backfires — it
 * grants the interface an inherited string index signature, which widens
 * `keyof CheckRegistry` from the specific registered keys (e.g. `'empty'`)
 * to plain `string`, silently defeating every "unregistered ID is
 * rejected" guarantee in this file. This self-referential (F-bounded) form
 * instead constrains each registry to conform to itself — `Reg extends
 * CheckRegistryShape<Reg>` — which TypeScript accepts for a plain literal-
 * keyed interface, and preserves its exact literal key set.
 */
export type CheckRegistryShape<Reg> = { [K in keyof Reg]: CheckRegistryEntry }

export interface EmptyCapturePayload {
  readonly __brand: 'EmptyCapturePayload'
}
/**
 * Corrected (foundational 2a-shape correction, discovered during 2b):
 * TypeScript's `readonly` modifier on `__brand` is a compile-time-only
 * guarantee — it does nothing at runtime. This constant is a SHARED
 * singleton returned by every normalization call (evidenceNormalizer.ts);
 * without `Object.freeze`, one caller mutating it (e.g. via an `as any`
 * bypass) would corrupt every other result, past and future, that shares
 * the same reference. Frozen so that can't happen.
 */
export const EMPTY_CAPTURE_PAYLOAD: EmptyCapturePayload = Object.freeze({ __brand: 'EmptyCapturePayload' })

/** Milestone 2's only registered check. Not a real visual check — no
 *  scoring, no claim, nothing to migrate later. Exists purely to prove the
 *  architecture's type relationships end-to-end. */
export interface EmptyCheckEvidence {
  readonly __brand: 'EmptyCheckEvidence'
}
/** Frozen for the same reason as `EMPTY_CAPTURE_PAYLOAD` above — shared
 *  singleton, `readonly` alone does not stop runtime mutation. */
export const EMPTY_CHECK_EVIDENCE: EmptyCheckEvidence = Object.freeze({ __brand: 'EmptyCheckEvidence' })

/**
 * Raw, unprocessed measurements the browser captured for the overflow
 * check — window.innerWidth and document.documentElement.scrollWidth at
 * the mobile viewport. Deriving `overflowPx` from these is the Evidence
 * Normalizer's job (evidenceNormalizer.ts), not this capture stage's.
 */
export interface OverflowCapturePayload {
  readonly __brand: 'OverflowCapturePayload'
  readonly viewportWidthPx: number
  readonly documentScrollWidthPx: number
}

export interface OverflowCheckEvidence {
  readonly __brand: 'OverflowCheckEvidence'
  readonly viewportWidthPx: number
  readonly documentScrollWidthPx: number
  /** max(0, documentScrollWidthPx - viewportWidthPx) — never negative. */
  readonly overflowPx: number
}

/**
 * The smallest font size found among visible, non-empty text nodes at
 * the mobile viewport — `null` if no visible text could be measured at
 * all (an honest "couldn't determine" case, not coerced to 0 or
 * silently dropped; the classifier maps this to `unverified`).
 */
export interface ReadabilityCapturePayload {
  readonly __brand: 'ReadabilityCapturePayload'
  readonly minVisibleFontSizePx: number | null
  /** Smallest font size among text identified as footer/utility content
   *  (copyright, legal, payment, attribution, and similar) — `null` if
   *  none was found. Context only; never drives the readability outcome
   *  on its own. See captureService.ts's extractRawMeasurements. */
  readonly footerMinVisibleFontSizePx: number | null
}

export interface ReadabilityCheckEvidence {
  readonly __brand: 'ReadabilityCheckEvidence'
  readonly minVisibleFontSizePx: number | null
  readonly footerMinVisibleFontSizePx: number | null
}

/**
 * Milestone 2 registered exactly one trivial entry; this first real
 * release adds two genuine checks (overflow, readability) — the first
 * real use of the registry's extension point.
 *
 * Both new checks register `auditFields: Record<never, never>`: the
 * audit-trail layer (AuditRecord/auditRecordBuilder) is deliberately not
 * wired up for this release (out of the fast-lane scope — findings are
 * shown to the visitor and that's the whole product surface right now),
 * so there is genuinely nothing auditable registered yet — not a
 * placeholder standing in for a real audit design.
 */
export interface CheckRegistry {
  empty: {
    captureSchemaVersion: '1.0.0'
    capturePayload: EmptyCapturePayload
    evidenceSchemaVersion: '1.0.0'
    evidence: EmptyCheckEvidence
    contractVersion: '1.0.0'
    auditFields: Record<never, never>
  }
  overflow: {
    captureSchemaVersion: '1.0.0'
    capturePayload: OverflowCapturePayload
    evidenceSchemaVersion: '1.0.0'
    evidence: OverflowCheckEvidence
    contractVersion: '1.0.0'
    auditFields: Record<never, never>
  }
  readability: {
    captureSchemaVersion: '1.0.0'
    capturePayload: ReadabilityCapturePayload
    evidenceSchemaVersion: '1.0.0'
    evidence: ReadabilityCheckEvidence
    contractVersion: '1.0.0'
    auditFields: Record<never, never>
  }
}

export type CheckId = keyof CheckRegistry & string

/** The set of audit-field keys check `K` (in registry `Reg`) is allowed to
 *  reference — `never` for a check whose `auditFields` is `Record<never,
 *  never>`, so nothing can ever populate it. Shared by classification.ts
 *  and auditRecord.ts so both index the same computed key set. */
export type AuditFieldKeyFor<Reg extends CheckRegistryShape<Reg>, K extends keyof Reg & string> = keyof Reg[K]['auditFields'] & string
