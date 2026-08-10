// Sub-patch 2a — VisitorFinding: the Findings Presenter's output type.
//
// Sibling-independence rule (architecture-dependency-map.md, Rule #9): this
// file must NEVER import from auditRecord.ts, and auditRecord.ts must never
// import from this file. Findings and Audit Records are two independent
// consumers of the same ClassificationResult — neither depends on the
// other. See test/pipeline.siblingOutputs.test.ts and
// test/pipeline.importBoundaries.test.ts.

import type { CheckId } from './checkSpecification.js'
import type { ClassificationOutcome } from './classification.js'

export interface VisitorFinding<K extends CheckId = CheckId> {
  checkId: K
  label: string
  bucket: ClassificationOutcome
  standardsLabel: string
  detail: string
  viewportNote?: string
}
