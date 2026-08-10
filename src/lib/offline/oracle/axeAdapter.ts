// Sub-patch 2e (simplified accessibility cross-check, per the practical
// scope reset — patch.md's "Scope Reset — Practical Release Plan": a
// 1-2 hour cap, axe-core against controlled local fixtures only, as
// independent evidence, no scoring). Deliberately NOT the larger
// oracle-comparison-mapping system 2a's types.ts/architecture-
// dependency-map.md originally sketched for a full "sub-patch 2e" (live-
// site comparison, disagreement resolution, resolutionNote) — that is
// out of scope for this simplified pass and is not attempted here.
//
// Runs the real axe-core engine against a CONTROLLED, LOCAL HTML string
// only (page.setContent — never a network-loaded document). Every
// network request the page attempts is aborted outright, so a fixture
// that mistakenly references an external resource fails closed instead
// of silently reaching the real network — deliberately narrower than
// 2d's connection-binding proxy (which exists for arbitrary,
// user-submitted URLs); fixtures here are trusted, self-authored
// content, so that heavier machinery isn't needed or reused.
//
// This module produces EVIDENCE, not a verdict: no accessibility score,
// no "WCAG compliant" claim, no pass/fail gate. axe-core's own
// "incomplete" results (checks it could not automatically resolve) are
// preserved as inconclusive findings, never silently dropped or folded
// into either a pass or a violation.
//
// Import boundary (architecture-dependency-map.md): src/lib/offline/*
// may import only src/lib/pipeline/types/ from the pipeline tree — this
// file imports nothing from pipeline/normalize|classify|present|audit,
// and is never imported by api/check-visual.ts.

import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const require = createRequire(import.meta.url)
const LOCAL_CHROME_PATH_MACOS = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DEFAULT_TIMEOUT_MS = 10000

export type AxeImpact = 'minor' | 'moderate' | 'serious' | 'critical' | null

export interface AxeFinding {
  ruleId: string
  impact: AxeImpact
  description: string
  helpUrl: string
  /** CSS selector path(s) of the affected node(s), as axe-core reports
   *  them — stringified rather than typed against axe's full recursive
   *  cross-frame selector shape, which this adapter has no need to
   *  reconstruct. */
  targets: string[]
}

export interface AxeInconclusiveFinding extends AxeFinding {
  /** Why axe-core could not automatically resolve this check (e.g. "the
   *  color-contrast check could not determine the background color") —
   *  never invented; taken from axe's own result data when present. */
  reason: string
}

export type AxeFixtureResult =
  | { status: 'ok'; violations: AxeFinding[]; inconclusive: AxeInconclusiveFinding[] }
  | { status: 'unavailable'; reason: string }

export interface AxeAdapterOptions {
  /** Injectable for tests/CI environments with Chrome at a different
   *  path — defaults to this machine's standard local install, never
   *  @sparticuz/chromium's Lambda-only binary (matches 2d's own
   *  local-Chrome-only precedent for non-production code paths). */
  executablePath?: string
  timeoutMs?: number
}

/** Dev-machine Chrome path resolution (macOS default install location),
 *  matching browserLifecycle.ts's own `resolveLocalChromePath` — kept as
 *  a separate function here (rather than importing that one) since
 *  pipeline/capture/ and offline/oracle/ are independent trees and
 *  neither should depend on the other's implementation module. */
export function resolveDefaultChromePathForAxe(): string {
  return LOCAL_CHROME_PATH_MACOS
}

function describeThrown(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 500)
  return `non-Error thrown value of type ${typeof e}`
}

interface RawAxeNode {
  target: unknown
}
interface RawAxeResult {
  id: string
  impact?: string | null
  description: string
  helpUrl: string
  nodes: RawAxeNode[]
}
interface RawAxeIncompleteResult extends RawAxeResult {
  nodes: (RawAxeNode & { any?: { message?: string }[]; none?: { message?: string }[] })[]
}
interface RawAxeResults {
  violations: RawAxeResult[]
  incomplete: RawAxeIncompleteResult[]
}

function toTargets(nodes: RawAxeNode[]): string[] {
  return nodes.map((n) => JSON.stringify(n.target))
}

function toFinding(result: RawAxeResult): AxeFinding {
  const impact = (result.impact ?? null) as AxeImpact
  return { ruleId: result.id, impact, description: result.description, helpUrl: result.helpUrl, targets: toTargets(result.nodes) }
}

function toInconclusiveFinding(result: RawAxeIncompleteResult): AxeInconclusiveFinding {
  const firstMessage = result.nodes.flatMap((n) => [...(n.any ?? []), ...(n.none ?? [])]).find((c) => c.message)?.message
  return { ...toFinding(result), reason: firstMessage ?? 'axe-core could not automatically resolve this check' }
}

/**
 * Runs axe-core against a self-contained HTML string. Never throws for
 * an expected failure (missing browser, injection failure, timeout,
 * axe-core crash) — always a typed result, `unavailable` with a bounded
 * reason rather than a fabricated "clean" outcome.
 */
export async function runAxeAgainstFixture(html: string, options: AxeAdapterOptions = {}): Promise<AxeFixtureResult> {
  const executablePath = options.executablePath ?? LOCAL_CHROME_PATH_MACOS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (!existsSync(executablePath)) {
    return { status: 'unavailable', reason: `no Chrome executable found at ${executablePath}` }
  }

  let axeSource: string
  try {
    const axeScriptPath = require.resolve('axe-core/axe.min.js')
    axeSource = await readFile(axeScriptPath, 'utf8')
  } catch (e) {
    return { status: 'unavailable', reason: `axe-core script could not be loaded: ${describeThrown(e)}` }
  }

  let browser
  try {
    browser = await puppeteer.launch({ executablePath, headless: true })
  } catch (e) {
    return { status: 'unavailable', reason: `failed to launch browser: ${describeThrown(e)}` }
  }

  try {
    const page = await browser.newPage()

    // Controlled local fixtures only: abort every network request the
    // page attempts. setContent() itself performs no network request
    // for the document; this only matters if a fixture mistakenly
    // references an external resource, which then fails closed.
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      req.abort().catch(() => {})
    })

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    await page.addScriptTag({ content: axeSource })

    const results = await Promise.race([
      page.evaluate(() => (window as unknown as { axe: { run: () => Promise<RawAxeResults> } }).axe.run()),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('axe.run() timed out')), timeoutMs)),
    ])

    return {
      status: 'ok',
      violations: results.violations.map(toFinding),
      inconclusive: results.incomplete.map(toInconclusiveFinding),
    }
  } catch (e) {
    return { status: 'unavailable', reason: `axe-core run failed: ${describeThrown(e)}` }
  } finally {
    await browser.close().catch(() => {})
  }
}
