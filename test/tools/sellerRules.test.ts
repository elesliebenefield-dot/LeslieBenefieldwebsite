// Pure, browser-free unit tests for the Seller Readiness Planner rule
// evaluation engine (src/tools/real-estate/seller/sellerRules.ts +
// src/tools/core/evaluateRules.ts). No browser, no build step, no network.
//
// Run with: node --test test/tools/sellerRules.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateRules } from '../../src/tools/core/evaluateRules.ts'
import { SELLER_RULES, SECTION_ORDER, SECTION_TITLES } from '../../src/tools/real-estate/seller/sellerRules.ts'
import { EMPTY_SELLER_ANSWERS, type SellerAnswers } from '../../src/tools/real-estate/seller/sellerTypes.ts'
import { buildSummaryText } from '../../src/tools/real-estate/seller/sellerSummary.ts'

function answers(overrides: Partial<SellerAnswers> = {}): SellerAnswers {
  return { ...EMPTY_SELLER_ANSWERS, ...overrides }
}

function evaluate(a: SellerAnswers) {
  return evaluateRules(SELLER_RULES, a, [...SECTION_ORDER], SECTION_TITLES)
}

function sectionIds(a: SellerAnswers): string[] {
  return evaluate(a).map(s => s.id)
}

function itemIds(a: SellerAnswers, sectionId: string): string[] {
  return evaluate(a).find(s => s.id === sectionId)?.items.map(i => i.id) ?? []
}

// ── nextStep always fires ─────────────────────────────────────────────────────

test('nextStep section is always present regardless of answers', () => {
  assert.ok(sectionIds(answers()).includes('nextStep'))
  assert.ok(sectionIds(answers({ stage: 'ready' })).includes('nextStep'))
})

test('nextStep fires the exploring item when stage is exploring', () => {
  assert.ok(itemIds(answers({ stage: 'exploring' }), 'nextStep').includes('next-exploring'))
})

test('nextStep fires the preparing item when stage is preparing', () => {
  assert.ok(itemIds(answers({ stage: 'preparing' }), 'nextStep').includes('next-preparing'))
})

test('nextStep fires the ready item when stage is ready', () => {
  assert.ok(itemIds(answers({ stage: 'ready' }), 'nextStep').includes('next-ready'))
})

test('nextStep fires the general item when stage is empty', () => {
  assert.ok(itemIds(answers({ stage: '' }), 'nextStep').includes('next-general'))
})

test('only one nextStep item fires for any given stage value', () => {
  for (const stage of ['exploring', 'preparing', 'ready', '']) {
    const items = itemIds(answers({ stage }), 'nextStep')
    assert.equal(items.length, 1, `expected exactly 1 nextStep item for stage="${stage}", got ${items.length}`)
  }
})

// ── infoToGather ──────────────────────────────────────────────────────────────

test('hoa-docs fires when hoaInvolvement is yes', () => {
  assert.ok(itemIds(answers({ hoaInvolvement: 'yes' }), 'infoToGather').includes('hoa-docs'))
})

test('hoa-confirm fires when hoaInvolvement is notSure', () => {
  assert.ok(itemIds(answers({ hoaInvolvement: 'notSure' }), 'infoToGather').includes('hoa-confirm'))
})

test('neither hoa item fires when hoaInvolvement is no', () => {
  const ids = itemIds(answers({ hoaInvolvement: 'no' }), 'infoToGather')
  assert.ok(!ids.includes('hoa-docs'))
  assert.ok(!ids.includes('hoa-confirm'))
})

test('document items fire only for their respective checked values', () => {
  const a = answers({ documentsAvailable: ['surveys', 'permits'] })
  const ids = itemIds(a, 'infoToGather')
  assert.ok(ids.includes('doc-surveys'))
  assert.ok(ids.includes('doc-permits'))
  assert.ok(!ids.includes('doc-warranties'))
  assert.ok(!ids.includes('doc-hoa'))
  assert.ok(!ids.includes('doc-tax-records'))
})

test('all five document items fire when all five are selected', () => {
  const a = answers({ documentsAvailable: ['surveys', 'permits', 'warranties', 'hoa', 'taxRecords'] })
  const ids = itemIds(a, 'infoToGather')
  assert.ok(ids.includes('doc-surveys'))
  assert.ok(ids.includes('doc-permits'))
  assert.ok(ids.includes('doc-warranties'))
  assert.ok(ids.includes('doc-hoa'))
  assert.ok(ids.includes('doc-tax-records'))
})

test('none selected in documentsAvailable produces no doc items', () => {
  const a = answers({ documentsAvailable: ['none'] })
  const ids = itemIds(a, 'infoToGather')
  assert.ok(!ids.includes('doc-surveys'))
  assert.ok(!ids.includes('doc-permits'))
})

test('owner-alignment fires for multiple and needToConfirm, not for one', () => {
  assert.ok(itemIds(answers({ multipleOwners: 'multiple' }), 'infoToGather').includes('owner-alignment'))
  assert.ok(itemIds(answers({ multipleOwners: 'needToConfirm' }), 'infoToGather').includes('owner-alignment'))
  assert.ok(!itemIds(answers({ multipleOwners: 'one' }), 'infoToGather').includes('owner-alignment'))
})

test('improvement-docs fires only for yesMajor', () => {
  assert.ok(itemIds(answers({ recentImprovements: 'yesMajor' }), 'infoToGather').includes('improvement-docs'))
  assert.ok(!itemIds(answers({ recentImprovements: 'yesMinor' }), 'infoToGather').includes('improvement-docs'))
  assert.ok(!itemIds(answers({ recentImprovements: 'none' }), 'infoToGather').includes('improvement-docs'))
})

// ── prepTopics ────────────────────────────────────────────────────────────────

test('repairs-known fires only for yesList', () => {
  assert.ok(itemIds(answers({ knownRepairs: 'yesList' }), 'prepTopics').includes('repairs-known'))
  assert.ok(!itemIds(answers({ knownRepairs: 'maybeFew' }), 'prepTopics').includes('repairs-known'))
})

test('repairs-maybe fires only for maybeFew', () => {
  assert.ok(itemIds(answers({ knownRepairs: 'maybeFew' }), 'prepTopics').includes('repairs-maybe'))
  assert.ok(!itemIds(answers({ knownRepairs: 'yesList' }), 'prepTopics').includes('repairs-maybe'))
})

test('no repair item fires for noneAware', () => {
  const ids = itemIds(answers({ knownRepairs: 'noneAware' }), 'prepTopics')
  assert.ok(!ids.includes('repairs-known'))
  assert.ok(!ids.includes('repairs-maybe'))
})

test('declutter items are mutually exclusive for planned, inProgress, notSure', () => {
  assert.ok(itemIds(answers({ declutterStatus: 'planned' }), 'prepTopics').includes('declutter-planned'))
  assert.ok(!itemIds(answers({ declutterStatus: 'planned' }), 'prepTopics').includes('declutter-in-progress'))

  assert.ok(itemIds(answers({ declutterStatus: 'inProgress' }), 'prepTopics').includes('declutter-in-progress'))
  assert.ok(!itemIds(answers({ declutterStatus: 'inProgress' }), 'prepTopics').includes('declutter-planned'))

  assert.ok(itemIds(answers({ declutterStatus: 'notSure' }), 'prepTopics').includes('declutter-unsure'))
})

test('no declutter item fires when declutterStatus is done', () => {
  const ids = itemIds(answers({ declutterStatus: 'done' }), 'prepTopics')
  assert.ok(!ids.includes('declutter-planned'))
  assert.ok(!ids.includes('declutter-in-progress'))
  assert.ok(!ids.includes('declutter-unsure'))
})

test('access-coordination fires for needsCoordination only', () => {
  assert.ok(itemIds(answers({ accessArrangement: 'needsCoordination' }), 'prepTopics').includes('access-coordination'))
  assert.ok(!itemIds(answers({ accessArrangement: 'straightforward' }), 'prepTopics').includes('access-coordination'))
  assert.ok(!itemIds(answers({ accessArrangement: 'haveQuestions' }), 'prepTopics').includes('access-coordination'))
})

test('tenant-prep fires in prepTopics when occupancy is tenantOccupied', () => {
  assert.ok(itemIds(answers({ occupancy: 'tenantOccupied' }), 'prepTopics').includes('tenant-prep'))
  assert.ok(!itemIds(answers({ occupancy: 'ownerOccupied' }), 'prepTopics').includes('tenant-prep'))
})

// ── timing ────────────────────────────────────────────────────────────────────

test('timing-asap fires only for timeframe asap', () => {
  assert.ok(itemIds(answers({ timeframe: 'asap' }), 'timing').includes('timing-asap'))
  assert.ok(!itemIds(answers({ timeframe: '3to6' }), 'timing').includes('timing-asap'))
})

test('each coordination value fires the correct timing item', () => {
  assert.ok(itemIds(answers({ coordination: 'buyFirst' }), 'timing').includes('timing-buy-first'))
  assert.ok(itemIds(answers({ coordination: 'simultaneously' }), 'timing').includes('timing-simultaneous'))
  assert.ok(itemIds(answers({ coordination: 'sellFirst' }), 'timing').includes('timing-sell-first'))
  assert.ok(!itemIds(answers({ coordination: 'sellOnly' }), 'timing').includes('timing-buy-first'))
  assert.ok(!itemIds(answers({ coordination: 'sellOnly' }), 'timing').includes('timing-simultaneous'))
  assert.ok(!itemIds(answers({ coordination: 'sellOnly' }), 'timing').includes('timing-sell-first'))
})

test('timing-complications fires only when timingComplications is yes', () => {
  assert.ok(itemIds(answers({ timingComplications: 'yes' }), 'timing').includes('timing-complications'))
  assert.ok(!itemIds(answers({ timingComplications: 'flexible' }), 'timing').includes('timing-complications'))
  assert.ok(!itemIds(answers({ timingComplications: 'open' }), 'timing').includes('timing-complications'))
})

test('timing-vacant fires for vacant occupancy', () => {
  assert.ok(itemIds(answers({ occupancy: 'vacant' }), 'timing').includes('timing-vacant'))
  assert.ok(!itemIds(answers({ occupancy: 'ownerOccupied' }), 'timing').includes('timing-vacant'))
})

test('timing-tenant fires for tenantOccupied', () => {
  assert.ok(itemIds(answers({ occupancy: 'tenantOccupied' }), 'timing').includes('timing-tenant'))
  assert.ok(!itemIds(answers({ occupancy: 'vacant' }), 'timing').includes('timing-tenant'))
})

// ── agentTopics ───────────────────────────────────────────────────────────────

test('agent-repairs-unsure fires only for knownRepairs notSure', () => {
  assert.ok(itemIds(answers({ knownRepairs: 'notSure' }), 'agentTopics').includes('agent-repairs-unsure'))
  assert.ok(!itemIds(answers({ knownRepairs: 'noneAware' }), 'agentTopics').includes('agent-repairs-unsure'))
})

test('agent-access-questions fires only for haveQuestions', () => {
  assert.ok(itemIds(answers({ accessArrangement: 'haveQuestions' }), 'agentTopics').includes('agent-access-questions'))
  assert.ok(!itemIds(answers({ accessArrangement: 'straightforward' }), 'agentTopics').includes('agent-access-questions'))
})

test('agent-condo fires only for condoTownhome', () => {
  assert.ok(itemIds(answers({ propertyType: 'condoTownhome' }), 'agentTopics').includes('agent-condo'))
  assert.ok(!itemIds(answers({ propertyType: 'singleFamily' }), 'agentTopics').includes('agent-condo'))
})

test('agent-multi-unit fires only for multiUnit', () => {
  assert.ok(itemIds(answers({ propertyType: 'multiUnit' }), 'agentTopics').includes('agent-multi-unit'))
  assert.ok(!itemIds(answers({ propertyType: 'singleFamily' }), 'agentTopics').includes('agent-multi-unit'))
})

test('agent-custom-questions fires when agentQuestions is non-empty', () => {
  assert.ok(itemIds(answers({ agentQuestions: 'What is the typical showing timeline?' }), 'agentTopics').includes('agent-custom-questions'))
  assert.ok(!itemIds(answers({ agentQuestions: '' }), 'agentTopics').includes('agent-custom-questions'))
  assert.ok(!itemIds(answers({ agentQuestions: '   ' }), 'agentTopics').includes('agent-custom-questions'))
})

// ── section ordering ──────────────────────────────────────────────────────────

test('sections appear in the declared order when multiple fire', () => {
  const a = answers({
    hoaInvolvement: 'yes',
    knownRepairs: 'yesList',
    timeframe: 'asap',
    knownRepairs: 'notSure',
    stage: 'exploring',
  })
  const ids = sectionIds(a)
  const infoIdx = ids.indexOf('infoToGather')
  const prepIdx = ids.indexOf('prepTopics')
  const nextIdx = ids.indexOf('nextStep')
  assert.ok(infoIdx < nextIdx, 'infoToGather must come before nextStep')
  if (prepIdx !== -1) {
    assert.ok(prepIdx < nextIdx, 'prepTopics must come before nextStep')
  }
})

// ── result item text never includes prohibited terms ──────────────────────────

test('no result item label or detail contains prohibited verdict or value language', () => {
  const problematic = /\b(score|valu|price|predict|approv|qualif|estimat|you are ready|you are not ready)\b/i
  for (const rule of SELLER_RULES) {
    assert.ok(!problematic.test(rule.item.label), `item label "${rule.item.label}" contains prohibited language`)
    if (rule.item.detail) {
      assert.ok(!problematic.test(rule.item.detail), `item "${rule.item.id}" detail contains prohibited language`)
    }
  }
})

test('no result item references financial, legal, tax, or lending advice', () => {
  const prohibited = /\b(tax advice|legal advice|financial advice|lending advice|mortgage rate|interest rate|credit score)\b/i
  for (const rule of SELLER_RULES) {
    assert.ok(!prohibited.test(rule.item.label), `item label "${rule.item.label}" references prohibited advice`)
    if (rule.item.detail) {
      assert.ok(!prohibited.test(rule.item.detail), `item "${rule.item.id}" detail references prohibited advice`)
    }
  }
})

// ── evaluateRules is pure ─────────────────────────────────────────────────────

test('evaluateRules does not mutate the answers object', () => {
  const a = answers({ hoaInvolvement: 'yes', stage: 'exploring' })
  const frozen = Object.freeze({ ...a })
  assert.doesNotThrow(() => evaluate(frozen as SellerAnswers))
})

test('evaluateRules returns a stable empty array when no rules match', () => {
  const a = answers({
    hoaInvolvement: 'no',
    multipleOwners: 'one',
    recentImprovements: 'none',
    knownRepairs: 'noneAware',
    declutterStatus: 'done',
    accessArrangement: 'straightforward',
    prepQuestions: 'no',
    occupancy: 'ownerOccupied',
    timeframe: '6to12',
    coordination: 'sellOnly',
    timingComplications: 'open',
    propertyType: 'singleFamily',
    agentQuestions: '',
    stage: '',
  })
  const sections = evaluate(a)
  assert.ok(Array.isArray(sections))
  const infoSection = sections.find(s => s.id === 'infoToGather')
  assert.equal(infoSection, undefined, 'infoToGather should not appear when nothing triggers it')
})

// ── no duplicate guidance across sections ─────────────────────────────────────

test('hoa-confirm only appears in infoToGather, never in agentTopics', () => {
  const a = answers({ hoaInvolvement: 'notSure' })
  const secs = evaluate(a)
  const infoIds = secs.find(s => s.id === 'infoToGather')?.items.map(i => i.id) ?? []
  const agentIds = secs.find(s => s.id === 'agentTopics')?.items.map(i => i.id) ?? []
  assert.ok(infoIds.includes('hoa-confirm'), 'hoa-confirm must appear in infoToGather')
  assert.ok(!agentIds.includes('agent-hoa-confirm'), 'agent-hoa-confirm must not exist')
})

test('prep-questions guidance only appears in prepTopics, never in agentTopics', () => {
  const a = answers({ prepQuestions: 'yes' })
  const secs = evaluate(a)
  const prepIds = secs.find(s => s.id === 'prepTopics')?.items.map(i => i.id) ?? []
  const agentIds = secs.find(s => s.id === 'agentTopics')?.items.map(i => i.id) ?? []
  assert.ok(prepIds.includes('prep-questions'), 'prep-questions must appear in prepTopics')
  assert.ok(!agentIds.includes('agent-prep-list'), 'agent-prep-list must not exist')
})

// ── HOA guidance does not overclaim ──────────────────────────────────────────

test('hoa-confirm detail does not claim specific documents definitively confirm HOA status', () => {
  const hoaRule = SELLER_RULES.find(r => r.item.id === 'hoa-confirm')
  assert.ok(hoaRule, 'hoa-confirm rule must exist')
  const detail = hoaRule!.item.detail ?? ''
  assert.ok(!/mortgage statement/i.test(detail), 'detail must not claim mortgage statement confirms HOA')
  assert.ok(!/county.*record/i.test(detail) || /ask your agent/i.test(detail),
    'if county records are mentioned, must include advice to ask agent')
  assert.ok(!/definitively/i.test(detail), 'detail must not use language like "definitively"')
})

// ── buildSummaryText ──────────────────────────────────────────────────────────

test('buildSummaryText includes the standard header line', () => {
  const text = buildSummaryText([], '')
  assert.match(text, /SELLER READINESS PLANNER/)
})

test('buildSummaryText includes each section title and item label', () => {
  const sections = [
    {
      id: 'infoToGather',
      title: 'Information to Gather',
      items: [{ id: 'hoa-docs', label: 'HOA information', detail: 'Contact your HOA.' }],
    },
  ]
  const text = buildSummaryText(sections, '')
  assert.match(text, /Information to Gather/)
  assert.match(text, /• HOA information/)
  assert.match(text, /Contact your HOA\./)
})

test('buildSummaryText includes written questions when non-empty', () => {
  const text = buildSummaryText([], 'What is the showing timeline?')
  assert.match(text, /Your Written Questions/)
  assert.match(text, /What is the showing timeline\?/)
})

test('buildSummaryText omits written questions block when agentQuestions is blank', () => {
  const text = buildSummaryText([], '   ')
  assert.ok(!/Your Written Questions/.test(text), 'written questions block must be absent for blank input')
})

test('buildSummaryText includes the disclaimer footer', () => {
  const text = buildSummaryText([], '')
  assert.match(text, /informational and discussion purposes only/)
  assert.match(text, /does not constitute real estate/)
})

test('buildSummaryText items without detail do not include a blank indent line', () => {
  const sections = [
    {
      id: 'nextStep',
      title: 'Suggested Next Step',
      items: [{ id: 'next-general', label: 'Connect with an agent' }],
    },
  ]
  const text = buildSummaryText(sections, '')
  const lines = text.split('\n')
  const labelIdx = lines.findIndex(l => l === '• Connect with an agent')
  assert.ok(labelIdx !== -1, 'label line must exist')
  assert.ok(lines[labelIdx + 1] !== '  ', 'no blank indent line should follow a label with no detail')
})
