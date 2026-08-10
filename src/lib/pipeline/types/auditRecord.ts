// Sub-patch 2a — AuditRecord: the Audit Record Builder's (sub-patch 2b)
// output type.
//
// `AuditFieldRefFor<Reg, K>` distributes twice: once over K (so a ref for
// check A can never carry check B's key/value pairing), and once more,
// internally, over that check's OWN audit-field keys (via the standard
// "mapped type over keys, then index by the keys union" trick —
// `{[Key in ...]: {key:Key; value:...}}[...]`) — so within one check, a
// specific key is always paired with THAT key's own value type, never
// another key's. `key`/`value` are never a path/`unknown` pair: `key` must
// be one of check K's own registered `CheckRegistry[K]['auditFields']`
// keys, and `value`'s type is exactly that key's registered minimized
// value type — never capable of holding the full NormalizedEvidence object
// (which is not itself a member of any check's auditFields type).
// Provenance fields (capturedAt/viewport/finalUrl) are not part of any
// check's auditFields either, so they are structurally ineligible unless a
// check explicitly registers one.
//
// For the 'empty' check, `auditFields` is `Record<never, never>`
// (checkSpecification.ts), so `AuditFieldRefFor<CheckRegistry, 'empty'>`
// resolves to `never` — no AuditFieldRef for 'empty' is constructible at
// all, matching its genuinely-empty contract.
//
// Corrected design (foundational 2a-shape correction, discovered during
// 2b's implementation, not a new scoring/product decision): a prior
// revision of this type had a top-level `reasoning: string` field
// alongside `classificationResult: ClassificationResultFor<Reg, K>` —
// which itself already carries its own `reasoning`. That was two
// authoritative copies of the same fact that could silently drift from
// each other. There is now exactly one: `classificationResult.reasoning`.
// No separate top-level `reasoning` field exists on `AuditRecord`.
//
// Sibling-independence rule: this file must NEVER import from findings.ts,
// and findings.ts must never import from this file.

import type { CheckId, CheckRegistry, CheckRegistryShape } from './checkSpecification.js'
import type { ClassificationResultFor } from './classification.js'

export type AuditFieldRefFor<Reg extends CheckRegistryShape<Reg>, K extends keyof Reg & string = keyof Reg & string> = K extends unknown
  ? {
      [Key in keyof Reg[K]['auditFields'] & string]: { key: Key; value: Reg[K]['auditFields'][Key] }
    }[keyof Reg[K]['auditFields'] & string]
  : never

/** Production convenience alias, bound to the real `CheckRegistry`. */
export type AuditFieldRef<K extends CheckId = CheckId> = AuditFieldRefFor<CheckRegistry, K>

export type AuditRecordFor<Reg extends CheckRegistryShape<Reg>, K extends keyof Reg & string = keyof Reg & string> = K extends unknown
  ? {
      checkId: K
      contractVersion: Reg[K]['contractVersion']
      auditFieldRefs: AuditFieldRefFor<Reg, K>[]
      classificationResult: ClassificationResultFor<Reg, K>
      rulesApplied: string[]
      requestId: string
    }
  : never

/** Production convenience alias, bound to the real `CheckRegistry`. */
export type AuditRecord<K extends CheckId = CheckId> = AuditRecordFor<CheckRegistry, K>
