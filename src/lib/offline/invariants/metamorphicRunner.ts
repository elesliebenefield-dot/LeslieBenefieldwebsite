// Sub-patch 2c — a small, pure metamorphic-transformation runner.
//
// Generic over the input/output types and the system-under-test function:
// this module never imports a pipeline implementation module itself (the
// caller — a test file — supplies the real `normalizeEmptyEvidence`/
// `classifyEmpty` as the `systemUnderTest` parameter). That keeps this
// file's only pipeline dependency at zero, trivially satisfying
// architecture-dependency-map.md's "src/lib/offline/* may import
// src/lib/pipeline/types/ only" rule — there is nothing here to import
// even a type from.
//
// No logging, no persistence, no timers, no randomness, no environment
// dependence, no browser/network access — pure computation only.

export interface MetamorphicTransformation<TInput> {
  id: string
  apply: (input: TInput) => TInput
}

export type MetamorphicRelationResult = { holds: true } | { holds: false; detail: string }
export type MetamorphicRelation<TOutput> = (sourceOutput: TOutput, transformedOutput: TOutput) => MetamorphicRelationResult

export type MetamorphicOutcome =
  | { status: 'pass'; transformationId: string }
  | { status: 'fail'; transformationId: string; reason: string }
  | { status: 'error'; transformationId: string; phase: 'transformation' | 'system-under-test' | 'assertion'; reason: string }

export type MetamorphicSuiteResult =
  | { status: 'invalid-transformations'; reason: string }
  | { status: 'baseline-error'; reason: string }
  | { status: 'completed'; outcomes: MetamorphicOutcome[] }

function describeThrown(e: unknown): string {
  // Deliberately does not include arbitrary thrown-value content beyond a
  // short, bounded description — the input a transformation/system-under-
  // test operates on is synthetic-only in 2c, but this runner is generic,
  // so it never assumes that and never echoes unrestricted content into
  // failure reasons.
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 500)
  return `non-Error thrown value of type ${typeof e}`
}

function validateTransformationIds<TInput>(transformations: readonly MetamorphicTransformation<TInput>[]): string | null {
  const seen = new Set<string>()
  for (const t of transformations) {
    if (typeof t.id !== 'string' || t.id.trim().length === 0) return 'a transformation has a blank id'
    if (seen.has(t.id)) return `duplicate transformation id: ${JSON.stringify(t.id)}`
    seen.add(t.id)
  }
  return null
}

/** Plain lexicographic (UTF-16 code-unit) comparison — deliberately not
 *  `String.prototype.localeCompare`, whose collation behavior can vary by
 *  ICU/locale data across environments, which would undermine the
 *  determinism this ordering exists to guarantee. */
function compareTransformationIds<TInput>(a: MetamorphicTransformation<TInput>, b: MetamorphicTransformation<TInput>): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function isValidRelationResult(x: unknown): x is MetamorphicRelationResult {
  if (typeof x !== 'object' || x === null) return false
  const obj = x as Record<string, unknown>
  if (obj.holds === true) return Object.keys(obj).length === 1
  if (obj.holds === false) return typeof obj.detail === 'string' && Object.keys(obj).length === 2
  return false
}

/**
 * Runs `systemUnderTest` once against a cloned copy of `sourceInput` (the
 * baseline), then once per transformation against a cloned-then-
 * transformed copy — `sourceInput` itself is never passed directly to
 * anything that could mutate it. Evaluates the caller-supplied `relation`
 * between the baseline output and each transformed output; never assumes
 * byte-for-byte equality is the intended relation.
 *
 * `relation` is a caller-supplied function and cannot be trusted not to
 * mutate its arguments. `sourceOutput` in particular is computed ONCE and
 * shared across every transformation's relation call — without isolation,
 * a relation that mutates its first argument would corrupt the shared
 * baseline and silently influence every later transformation's outcome.
 * Both arguments are therefore `structuredClone`d fresh immediately before
 * each individual relation call, so no relation invocation can observe or
 * affect any other's view of the baseline or transformed output.
 *
 * Outcomes are reported in the transformations' own sorted-by-id order
 * (`compareTransformationIds`), not the order `transformations` was
 * supplied in — so two equivalent transformation sets, supplied in
 * different orders, produce identical result ordering. Validation
 * (blank/duplicate id rejection) still runs against the original,
 * caller-supplied order first, since sorting is irrelevant to detecting
 * those.
 *
 * Fails closed with a typed result rather than throwing for expected
 * malformed-input cases (blank/duplicate transformation ids). Genuinely
 * thrown errors from a transformation, the system-under-test, or the
 * relation itself are caught and converted into a distinguishable
 * structured failure — never swallowed, never left to crash the suite.
 */
export function runMetamorphicSuite<TInput, TOutput>(
  sourceInput: TInput,
  transformations: readonly MetamorphicTransformation<TInput>[],
  systemUnderTest: (input: TInput) => TOutput,
  relation: MetamorphicRelation<TOutput>
): MetamorphicSuiteResult {
  const idError = validateTransformationIds(transformations)
  if (idError) return { status: 'invalid-transformations', reason: idError }

  let sourceOutput: TOutput
  try {
    sourceOutput = systemUnderTest(structuredClone(sourceInput))
  } catch (e) {
    return { status: 'baseline-error', reason: describeThrown(e) }
  }

  const sortedTransformations = [...transformations].sort(compareTransformationIds)

  const outcomes: MetamorphicOutcome[] = []
  for (const t of sortedTransformations) {
    let transformedInput: TInput
    try {
      transformedInput = t.apply(structuredClone(sourceInput))
    } catch (e) {
      outcomes.push({ status: 'error', transformationId: t.id, phase: 'transformation', reason: describeThrown(e) })
      continue
    }

    let transformedOutput: TOutput
    try {
      transformedOutput = systemUnderTest(transformedInput)
    } catch (e) {
      outcomes.push({ status: 'error', transformationId: t.id, phase: 'system-under-test', reason: describeThrown(e) })
      continue
    }

    let relationResult: MetamorphicRelationResult
    try {
      const raw: unknown = relation(structuredClone(sourceOutput), structuredClone(transformedOutput))
      if (!isValidRelationResult(raw)) {
        outcomes.push({ status: 'error', transformationId: t.id, phase: 'assertion', reason: `relation returned a malformed result: ${JSON.stringify(raw)}` })
        continue
      }
      relationResult = raw
    } catch (e) {
      outcomes.push({ status: 'error', transformationId: t.id, phase: 'assertion', reason: describeThrown(e) })
      continue
    }

    outcomes.push(relationResult.holds ? { status: 'pass', transformationId: t.id } : { status: 'fail', transformationId: t.id, reason: relationResult.detail })
  }

  return { status: 'completed', outcomes }
}
