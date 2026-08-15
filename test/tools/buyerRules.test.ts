// Pure, browser-free unit tests for the Buyer Readiness Planner rule
// evaluation engine (src/tools/real-estate/buyer/buyerRules.ts +
// src/tools/core/evaluateRules.ts). No browser, no build step, no network.
//
// Run with: node --test test/tools/buyerRules.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { evaluateRules } from '../../src/tools/core/evaluateRules.ts'
import { BUYER_RULES, SECTION_ORDER, SECTION_TITLES } from '../../src/tools/real-estate/buyer/buyerRules.ts'
import { EMPTY_BUYER_ANSWERS, type BuyerAnswers } from '../../src/tools/real-estate/buyer/buyerTypes.ts'
import { buildBuyerSummaryText } from '../../src/tools/real-estate/buyer/buyerSummary.ts'
import { buildMailtoHref } from '../../src/tools/core/buildMailtoHref.ts'

const ROOT = path.resolve(import.meta.dirname, '../..')

function answers(overrides: Partial<BuyerAnswers> = {}): BuyerAnswers {
  return { ...EMPTY_BUYER_ANSWERS, ...overrides }
}

function evaluate(a: BuyerAnswers) {
  return evaluateRules(BUYER_RULES, a, [...SECTION_ORDER], SECTION_TITLES)
}

function sectionIds(a: BuyerAnswers): string[] {
  return evaluate(a).map(s => s.id)
}

function itemIds(a: BuyerAnswers, sectionId: string): string[] {
  return evaluate(a).find(s => s.id === sectionId)?.items.map(i => i.id) ?? []
}

// ── nextStep always fires ─────────────────────────────────────────────────────

test('nextStep section is always present regardless of answers', () => {
  assert.ok(sectionIds(answers()).includes('nextStep'))
  assert.ok(sectionIds(answers({ stage: 'ready' })).includes('nextStep'))
})

test('nextStep fires the justExploring item when stage is justExploring', () => {
  assert.ok(itemIds(answers({ stage: 'justExploring' }), 'nextStep').includes('next-exploring'))
})

test('nextStep fires the actively item when stage is actively', () => {
  assert.ok(itemIds(answers({ stage: 'actively' }), 'nextStep').includes('next-actively'))
})

test('nextStep fires the ready item when stage is ready', () => {
  assert.ok(itemIds(answers({ stage: 'ready' }), 'nextStep').includes('next-ready'))
})

test('nextStep fires the general item when stage is empty', () => {
  assert.ok(itemIds(answers({ stage: '' }), 'nextStep').includes('next-general'))
})

test('only one nextStep item fires for any given stage value', () => {
  for (const stage of ['justExploring', 'actively', 'ready', '']) {
    const items = itemIds(answers({ stage }), 'nextStep')
    assert.equal(items.length, 1, `expected exactly 1 nextStep item for stage="${stage}", got ${items.length}`)
  }
})

// ── searchPreferences ────────────────────────────────────────────────────────

test('pref-property-types fires when specific property types are selected', () => {
  assert.ok(itemIds(answers({ propertyTypes: ['singleFamily'] }), 'searchPreferences').includes('pref-property-types'))
  assert.ok(itemIds(answers({ propertyTypes: ['condo', 'townhome'] }), 'searchPreferences').includes('pref-property-types'))
})

test('pref-property-types does not fire when openToAll is selected', () => {
  assert.ok(!itemIds(answers({ propertyTypes: ['openToAll'] }), 'searchPreferences').includes('pref-property-types'))
})

test('pref-property-types does not fire when propertyTypes is empty', () => {
  assert.ok(!itemIds(answers({ propertyTypes: [] }), 'searchPreferences').includes('pref-property-types'))
})

test('pref-must-haves fires when mustHaves has selections', () => {
  assert.ok(itemIds(answers({ mustHaves: ['garage'] }), 'searchPreferences').includes('pref-must-haves'))
  assert.ok(!itemIds(answers({ mustHaves: [] }), 'searchPreferences').includes('pref-must-haves'))
})

test('pref-nice-to-haves fires when niceToHaves has selections', () => {
  assert.ok(itemIds(answers({ niceToHaves: ['yard'] }), 'searchPreferences').includes('pref-nice-to-haves'))
  assert.ok(!itemIds(answers({ niceToHaves: [] }), 'searchPreferences').includes('pref-nice-to-haves'))
})

// ── infoToOrganize ────────────────────────────────────────────────────────────

test('info-financing-not-started fires only for notSpoken', () => {
  assert.ok(itemIds(answers({ financingStatus: 'notSpoken' }), 'infoToOrganize').includes('info-financing-not-started'))
  assert.ok(!itemIds(answers({ financingStatus: 'begun' }), 'infoToOrganize').includes('info-financing-not-started'))
  assert.ok(!itemIds(answers({ financingStatus: 'preapproved' }), 'infoToOrganize').includes('info-financing-not-started'))
})

test('info-financing-unsure fires only for unsure', () => {
  assert.ok(itemIds(answers({ financingStatus: 'unsure' }), 'infoToOrganize').includes('info-financing-unsure'))
  assert.ok(!itemIds(answers({ financingStatus: 'notSpoken' }), 'infoToOrganize').includes('info-financing-unsure'))
})

test('info-must-sell-unsure fires only for mustSellFirst unsure', () => {
  assert.ok(itemIds(answers({ mustSellFirst: 'unsure' }), 'infoToOrganize').includes('info-must-sell-unsure'))
  assert.ok(!itemIds(answers({ mustSellFirst: 'yes' }), 'infoToOrganize').includes('info-must-sell-unsure'))
  assert.ok(!itemIds(answers({ mustSellFirst: 'no' }), 'infoToOrganize').includes('info-must-sell-unsure'))
})

test('info-investment fires only for investment purchaseType', () => {
  assert.ok(itemIds(answers({ purchaseType: 'investment' }), 'infoToOrganize').includes('info-investment'))
  assert.ok(!itemIds(answers({ purchaseType: 'firstHome' }), 'infoToOrganize').includes('info-investment'))
  assert.ok(!itemIds(answers({ purchaseType: 'land' }), 'infoToOrganize').includes('info-investment'))
})

test('info-land fires only for land purchaseType', () => {
  assert.ok(itemIds(answers({ purchaseType: 'land' }), 'infoToOrganize').includes('info-land'))
  assert.ok(!itemIds(answers({ purchaseType: 'investment' }), 'infoToOrganize').includes('info-land'))
  assert.ok(!itemIds(answers({ purchaseType: 'firstHome' }), 'infoToOrganize').includes('info-land'))
})

test('info-no-target-area fires only when hasTargetArea is no', () => {
  assert.ok(itemIds(answers({ hasTargetArea: 'no' }), 'infoToOrganize').includes('info-no-target-area'))
  assert.ok(!itemIds(answers({ hasTargetArea: 'yes' }), 'infoToOrganize').includes('info-no-target-area'))
  assert.ok(!itemIds(answers({ hasTargetArea: 'open' }), 'infoToOrganize').includes('info-no-target-area'))
})

test('info-decision-makers fires only when otherDecisionMakers is yes', () => {
  assert.ok(itemIds(answers({ otherDecisionMakers: 'yes' }), 'infoToOrganize').includes('info-decision-makers'))
  assert.ok(!itemIds(answers({ otherDecisionMakers: 'no' }), 'infoToOrganize').includes('info-decision-makers'))
})

test('info-move-date-unsure fires only when movingFlexibility is unsure', () => {
  assert.ok(itemIds(answers({ movingFlexibility: 'unsure' }), 'infoToOrganize').includes('info-move-date-unsure'))
  assert.ok(!itemIds(answers({ movingFlexibility: 'flexible' }), 'infoToOrganize').includes('info-move-date-unsure'))
  assert.ok(!itemIds(answers({ movingFlexibility: 'specific' }), 'infoToOrganize').includes('info-move-date-unsure'))
})

// ── timingTopics ─────────────────────────────────────────────────────────────

test('timing-lease-ending fires only for leaseSoon', () => {
  assert.ok(itemIds(answers({ housingTiming: 'leaseSoon' }), 'timingTopics').includes('timing-lease-ending'))
  assert.ok(!itemIds(answers({ housingTiming: 'flexible' }), 'timingTopics').includes('timing-lease-ending'))
})

test('timing-urgent fires only for urgent', () => {
  assert.ok(itemIds(answers({ housingTiming: 'urgent' }), 'timingTopics').includes('timing-urgent'))
  assert.ok(!itemIds(answers({ housingTiming: 'leaseSoon' }), 'timingTopics').includes('timing-urgent'))
})

test('timing-must-sell fires only for mustSellFirst yes', () => {
  assert.ok(itemIds(answers({ mustSellFirst: 'yes' }), 'timingTopics').includes('timing-must-sell'))
  assert.ok(!itemIds(answers({ mustSellFirst: 'no' }), 'timingTopics').includes('timing-must-sell'))
  assert.ok(!itemIds(answers({ mustSellFirst: 'unsure' }), 'timingTopics').includes('timing-must-sell'))
})

test('timing-showing-limited fires only for limited', () => {
  assert.ok(itemIds(answers({ showingAvailability: 'limited' }), 'timingTopics').includes('timing-showing-limited'))
  assert.ok(!itemIds(answers({ showingAvailability: 'flexible' }), 'timingTopics').includes('timing-showing-limited'))
  assert.ok(!itemIds(answers({ showingAvailability: 'weekendsOnly' }), 'timingTopics').includes('timing-showing-limited'))
})

test('timing-showing-weekends fires only for weekendsOnly', () => {
  assert.ok(itemIds(answers({ showingAvailability: 'weekendsOnly' }), 'timingTopics').includes('timing-showing-weekends'))
  assert.ok(!itemIds(answers({ showingAvailability: 'limited' }), 'timingTopics').includes('timing-showing-weekends'))
})

test('timing-specific-move fires only for movingFlexibility specific', () => {
  assert.ok(itemIds(answers({ movingFlexibility: 'specific' }), 'timingTopics').includes('timing-specific-move'))
  assert.ok(!itemIds(answers({ movingFlexibility: 'flexible' }), 'timingTopics').includes('timing-specific-move'))
  assert.ok(!itemIds(answers({ movingFlexibility: 'unsure' }), 'timingTopics').includes('timing-specific-move'))
})

// ── timeframe guidance ────────────────────────────────────────────────────────

const TIMEFRAME_ITEM_IDS = ['timing-near-term', 'timing-planning-window', 'info-timeline-6to12', 'info-timeline-long', 'agent-timeline-unsure']

test('"exploring" is not a recognized timeframe value and produces no timeframe result', () => {
  const a = answers({ timeframe: 'exploring' })
  const secs = evaluate(a)
  const matched = secs.flatMap(s => s.items.filter(i => TIMEFRAME_ITEM_IDS.includes(i.id)))
  assert.equal(matched.length, 0, '"exploring" must not produce a timeframe result')
})

test('timing-near-term fires only for within3 timeframe, in timingTopics', () => {
  assert.ok(itemIds(answers({ timeframe: 'within3' }), 'timingTopics').includes('timing-near-term'))
  assert.ok(!itemIds(answers({ timeframe: '3to6' }), 'timingTopics').includes('timing-near-term'))
  assert.ok(!itemIds(answers({ timeframe: '6to12' }), 'timingTopics').includes('timing-near-term'))
  assert.ok(!itemIds(answers({ timeframe: 'moreThan12' }), 'timingTopics').includes('timing-near-term'))
  assert.ok(!itemIds(answers({ timeframe: 'unsure' }), 'timingTopics').includes('timing-near-term'))
})

test('timing-planning-window fires only for 3to6 timeframe, in timingTopics', () => {
  assert.ok(itemIds(answers({ timeframe: '3to6' }), 'timingTopics').includes('timing-planning-window'))
  assert.ok(!itemIds(answers({ timeframe: 'within3' }), 'timingTopics').includes('timing-planning-window'))
  assert.ok(!itemIds(answers({ timeframe: '6to12' }), 'timingTopics').includes('timing-planning-window'))
  assert.ok(!itemIds(answers({ timeframe: 'moreThan12' }), 'timingTopics').includes('timing-planning-window'))
})

test('info-timeline-6to12 fires only for 6to12 timeframe, in infoToOrganize', () => {
  assert.ok(itemIds(answers({ timeframe: '6to12' }), 'infoToOrganize').includes('info-timeline-6to12'))
  assert.ok(!itemIds(answers({ timeframe: 'within3' }), 'infoToOrganize').includes('info-timeline-6to12'))
  assert.ok(!itemIds(answers({ timeframe: 'moreThan12' }), 'infoToOrganize').includes('info-timeline-6to12'))
  assert.ok(!itemIds(answers({ timeframe: 'unsure' }), 'infoToOrganize').includes('info-timeline-6to12'))
})

test('info-timeline-long fires only for moreThan12 timeframe, in infoToOrganize', () => {
  assert.ok(itemIds(answers({ timeframe: 'moreThan12' }), 'infoToOrganize').includes('info-timeline-long'))
  assert.ok(!itemIds(answers({ timeframe: '6to12' }), 'infoToOrganize').includes('info-timeline-long'))
  assert.ok(!itemIds(answers({ timeframe: 'within3' }), 'infoToOrganize').includes('info-timeline-long'))
  assert.ok(!itemIds(answers({ timeframe: 'unsure' }), 'infoToOrganize').includes('info-timeline-long'))
})

test('agent-timeline-unsure fires only for unsure timeframe, in agentTopics', () => {
  assert.ok(itemIds(answers({ timeframe: 'unsure' }), 'agentTopics').includes('agent-timeline-unsure'))
  assert.ok(!itemIds(answers({ timeframe: 'within3' }), 'agentTopics').includes('agent-timeline-unsure'))
  assert.ok(!itemIds(answers({ timeframe: '3to6' }), 'agentTopics').includes('agent-timeline-unsure'))
  assert.ok(!itemIds(answers({ timeframe: '6to12' }), 'agentTopics').includes('agent-timeline-unsure'))
  assert.ok(!itemIds(answers({ timeframe: 'moreThan12' }), 'agentTopics').includes('agent-timeline-unsure'))
})

test('exactly one timeframe result fires for each of the five valid timeframe values', () => {
  for (const tf of ['within3', '3to6', '6to12', 'moreThan12', 'unsure'] as const) {
    const a = answers({ timeframe: tf })
    const secs = evaluate(a)
    const matched = secs.flatMap(s => s.items.filter(i => TIMEFRAME_ITEM_IDS.includes(i.id)))
    assert.equal(matched.length, 1, `expected exactly 1 timeframe result for timeframe="${tf}", got ${matched.length}: ${matched.map(i => i.id).join(', ')}`)
  }
})

test('empty timeframe produces no timeframe guidance result', () => {
  const a = answers({ timeframe: '' })
  const secs = evaluate(a)
  const matched = secs.flatMap(s => s.items.filter(i => TIMEFRAME_ITEM_IDS.includes(i.id)))
  assert.equal(matched.length, 0, 'no timeframe result should fire for empty timeframe')
})

test('no duplicate timeframe guidance across sections for any timeframe value', () => {
  for (const tf of ['within3', '3to6', '6to12', 'moreThan12', 'unsure', '']) {
    const a = answers({ timeframe: tf })
    const secs = evaluate(a)
    const matched = secs.flatMap(s => s.items.filter(i => TIMEFRAME_ITEM_IDS.includes(i.id)))
    const unique = new Set(matched.map(i => i.id))
    assert.equal(unique.size, matched.length, `duplicate timeframe guidance found for timeframe="${tf}"`)
  }
})

// ── agentTopics ───────────────────────────────────────────────────────────────

test('agent-financing-begun fires only for begun', () => {
  assert.ok(itemIds(answers({ financingStatus: 'begun' }), 'agentTopics').includes('agent-financing-begun'))
  assert.ok(!itemIds(answers({ financingStatus: 'notSpoken' }), 'agentTopics').includes('agent-financing-begun'))
  assert.ok(!itemIds(answers({ financingStatus: 'preapproved' }), 'agentTopics').includes('agent-financing-begun'))
})

test('agent-financing-preapproved fires only for preapproved', () => {
  assert.ok(itemIds(answers({ financingStatus: 'preapproved' }), 'agentTopics').includes('agent-financing-preapproved'))
  assert.ok(!itemIds(answers({ financingStatus: 'begun' }), 'agentTopics').includes('agent-financing-preapproved'))
})

test('agent-cash-purchase fires only for noFinancing', () => {
  assert.ok(itemIds(answers({ financingStatus: 'noFinancing' }), 'agentTopics').includes('agent-cash-purchase'))
  assert.ok(!itemIds(answers({ financingStatus: 'begun' }), 'agentTopics').includes('agent-cash-purchase'))
})

test('agent-area-open fires only when hasTargetArea is open', () => {
  assert.ok(itemIds(answers({ hasTargetArea: 'open' }), 'agentTopics').includes('agent-area-open'))
  assert.ok(!itemIds(answers({ hasTargetArea: 'yes' }), 'agentTopics').includes('agent-area-open'))
  assert.ok(!itemIds(answers({ hasTargetArea: 'no' }), 'agentTopics').includes('agent-area-open'))
})

test('agent-condo-townhome fires for condo or townhome in propertyTypes', () => {
  assert.ok(itemIds(answers({ propertyTypes: ['condo'] }), 'agentTopics').includes('agent-condo-townhome'))
  assert.ok(itemIds(answers({ propertyTypes: ['townhome'] }), 'agentTopics').includes('agent-condo-townhome'))
  assert.ok(itemIds(answers({ propertyTypes: ['condo', 'townhome'] }), 'agentTopics').includes('agent-condo-townhome'))
  assert.ok(!itemIds(answers({ propertyTypes: ['singleFamily'] }), 'agentTopics').includes('agent-condo-townhome'))
})

test('agent-multi-unit fires only when multiUnit is in propertyTypes', () => {
  assert.ok(itemIds(answers({ propertyTypes: ['multiUnit'] }), 'agentTopics').includes('agent-multi-unit'))
  assert.ok(!itemIds(answers({ propertyTypes: ['singleFamily'] }), 'agentTopics').includes('agent-multi-unit'))
})

test('agent-priorities fires when priorities is non-empty', () => {
  assert.ok(itemIds(answers({ priorities: ['timing'] }), 'agentTopics').includes('agent-priorities'))
  assert.ok(!itemIds(answers({ priorities: [] }), 'agentTopics').includes('agent-priorities'))
})

test('agent-custom-questions fires when agentQuestions is non-empty', () => {
  assert.ok(itemIds(answers({ agentQuestions: 'What is the typical offer timeline?' }), 'agentTopics').includes('agent-custom-questions'))
  assert.ok(!itemIds(answers({ agentQuestions: '' }), 'agentTopics').includes('agent-custom-questions'))
  assert.ok(!itemIds(answers({ agentQuestions: '   ' }), 'agentTopics').includes('agent-custom-questions'))
})

// ── anti-duplication ──────────────────────────────────────────────────────────

test('mustSellFirst unsure only appears in infoToOrganize, never in timingTopics', () => {
  const a = answers({ mustSellFirst: 'unsure' })
  const secs = evaluate(a)
  const infoIds = secs.find(s => s.id === 'infoToOrganize')?.items.map(i => i.id) ?? []
  const timingIds = secs.find(s => s.id === 'timingTopics')?.items.map(i => i.id) ?? []
  assert.ok(infoIds.includes('info-must-sell-unsure'), 'info-must-sell-unsure must appear in infoToOrganize')
  assert.ok(!timingIds.includes('timing-must-sell'), 'timing-must-sell must not fire for unsure')
})

test('mustSellFirst yes only appears in timingTopics, never in infoToOrganize', () => {
  const a = answers({ mustSellFirst: 'yes' })
  const secs = evaluate(a)
  const infoIds = secs.find(s => s.id === 'infoToOrganize')?.items.map(i => i.id) ?? []
  const timingIds = secs.find(s => s.id === 'timingTopics')?.items.map(i => i.id) ?? []
  assert.ok(timingIds.includes('timing-must-sell'), 'timing-must-sell must appear in timingTopics')
  assert.ok(!infoIds.includes('info-must-sell-unsure'), 'info-must-sell-unsure must not fire for yes')
})

test('financingStatus notSpoken only appears in infoToOrganize, never in agentTopics', () => {
  const a = answers({ financingStatus: 'notSpoken' })
  const secs = evaluate(a)
  const infoIds = secs.find(s => s.id === 'infoToOrganize')?.items.map(i => i.id) ?? []
  const agentIds = secs.find(s => s.id === 'agentTopics')?.items.map(i => i.id) ?? []
  assert.ok(infoIds.includes('info-financing-not-started'), 'info-financing-not-started must appear in infoToOrganize')
  assert.ok(!agentIds.some(id => id.startsWith('agent-financing') || id === 'agent-cash-purchase'),
    'no financing agent item should fire for notSpoken')
})

test('financingStatus preapproved only appears in agentTopics, never in infoToOrganize', () => {
  const a = answers({ financingStatus: 'preapproved' })
  const secs = evaluate(a)
  const infoIds = secs.find(s => s.id === 'infoToOrganize')?.items.map(i => i.id) ?? []
  const agentIds = secs.find(s => s.id === 'agentTopics')?.items.map(i => i.id) ?? []
  assert.ok(agentIds.includes('agent-financing-preapproved'), 'agent-financing-preapproved must appear in agentTopics')
  assert.ok(!infoIds.some(id => id.startsWith('info-financing')), 'no info financing item should fire for preapproved')
})

test('hasTargetArea no only appears in infoToOrganize, not agentTopics', () => {
  const a = answers({ hasTargetArea: 'no' })
  const secs = evaluate(a)
  const infoIds = secs.find(s => s.id === 'infoToOrganize')?.items.map(i => i.id) ?? []
  const agentIds = secs.find(s => s.id === 'agentTopics')?.items.map(i => i.id) ?? []
  assert.ok(infoIds.includes('info-no-target-area'), 'info-no-target-area must appear in infoToOrganize')
  assert.ok(!agentIds.includes('agent-area-open'), 'agent-area-open must not fire for no')
})

test('hasTargetArea open only appears in agentTopics, not infoToOrganize', () => {
  const a = answers({ hasTargetArea: 'open' })
  const secs = evaluate(a)
  const infoIds = secs.find(s => s.id === 'infoToOrganize')?.items.map(i => i.id) ?? []
  const agentIds = secs.find(s => s.id === 'agentTopics')?.items.map(i => i.id) ?? []
  assert.ok(agentIds.includes('agent-area-open'), 'agent-area-open must appear in agentTopics')
  assert.ok(!infoIds.includes('info-no-target-area'), 'info-no-target-area must not fire for open')
})

// ── section ordering ──────────────────────────────────────────────────────────

test('sections appear in the declared order when multiple fire', () => {
  const a = answers({
    propertyTypes: ['singleFamily'],
    financingStatus: 'notSpoken',
    mustSellFirst: 'yes',
    stage: 'actively',
  })
  const ids = sectionIds(a)
  const searchIdx = ids.indexOf('searchPreferences')
  const infoIdx = ids.indexOf('infoToOrganize')
  const timingIdx = ids.indexOf('timingTopics')
  const nextIdx = ids.indexOf('nextStep')
  if (searchIdx !== -1 && infoIdx !== -1) assert.ok(searchIdx < infoIdx, 'searchPreferences before infoToOrganize')
  if (infoIdx !== -1) assert.ok(infoIdx < nextIdx, 'infoToOrganize before nextStep')
  if (timingIdx !== -1) assert.ok(timingIdx < nextIdx, 'timingTopics before nextStep')
})

// ── result item text never includes prohibited terms ──────────────────────────

test('no result item label or detail contains prohibited verdict or value language', () => {
  const problematic = /\b(score|valu|price|predict|approv|qualif|estimat|you are ready|you are not ready)\b/i
  for (const rule of BUYER_RULES) {
    assert.ok(!problematic.test(rule.item.label), `item label "${rule.item.label}" contains prohibited language`)
    if (rule.item.detail) {
      assert.ok(!problematic.test(rule.item.detail), `item "${rule.item.id}" detail contains prohibited language`)
    }
  }
})

test('no result item references financial figures, credit scores, or income', () => {
  const prohibited = /\b(credit score|income|debt.to.income|DTI|interest rate|mortgage rate|down payment amount)\b/i
  for (const rule of BUYER_RULES) {
    assert.ok(!prohibited.test(rule.item.label), `item label "${rule.item.label}" references prohibited content`)
    if (rule.item.detail) {
      assert.ok(!prohibited.test(rule.item.detail), `item "${rule.item.id}" detail references prohibited content`)
    }
  }
})

// ── evaluateRules is pure ─────────────────────────────────────────────────────

test('evaluateRules does not mutate the answers object', () => {
  const a = answers({ financingStatus: 'preapproved', stage: 'actively' })
  const frozen = Object.freeze({ ...a, propertyTypes: Object.freeze([...a.propertyTypes]), mustHaves: Object.freeze([...a.mustHaves]), niceToHaves: Object.freeze([...a.niceToHaves]), priorities: Object.freeze([...a.priorities]) })
  assert.doesNotThrow(() => evaluate(frozen as BuyerAnswers))
})

test('evaluateRules returns only nextStep when no other conditions match', () => {
  const a = answers({
    propertyTypes: ['openToAll'],
    mustHaves: [],
    niceToHaves: [],
    hasTargetArea: 'yes',
    financingStatus: 'preapproved',
    housingTiming: 'flexible',
    mustSellFirst: 'no',
    showingAvailability: 'flexible',
    otherDecisionMakers: 'no',
    movingFlexibility: 'flexible',
    priorities: [],
    agentQuestions: '',
    stage: 'actively',
    purchaseType: 'firstHome',
  })
  const sections = evaluate(a)
  assert.ok(Array.isArray(sections))
  const nonNext = sections.filter(s => s.id !== 'nextStep' && s.id !== 'agentTopics')
  assert.equal(nonNext.length, 0, 'only nextStep and agentTopics (financing preapproved) should appear')
})

// ── buildBuyerSummaryText ─────────────────────────────────────────────────────

test('buildBuyerSummaryText includes the standard header line', () => {
  const text = buildBuyerSummaryText([], '')
  assert.match(text, /BUYER READINESS PLANNER/)
})

test('buildBuyerSummaryText includes each section title and item label', () => {
  const sections = [
    {
      id: 'infoToOrganize',
      title: 'Information to Organize',
      items: [{ id: 'info-financing-not-started', label: 'Connect with a lender before beginning your search', detail: 'Helpful detail here.' }],
    },
  ]
  const text = buildBuyerSummaryText(sections, '')
  assert.match(text, /Information to Organize/)
  assert.match(text, /• Connect with a lender before beginning your search/)
  assert.match(text, /Helpful detail here\./)
})

test('buildBuyerSummaryText includes written questions when non-empty', () => {
  const text = buildBuyerSummaryText([], 'What is the offer timeline in this area?')
  assert.match(text, /Your Written Questions/)
  assert.match(text, /What is the offer timeline in this area\?/)
})

test('buildBuyerSummaryText omits written questions block when agentQuestions is blank', () => {
  const text = buildBuyerSummaryText([], '   ')
  assert.ok(!/Your Written Questions/.test(text), 'written questions block must be absent for blank input')
})

test('buildBuyerSummaryText includes the disclaimer footer', () => {
  const text = buildBuyerSummaryText([], '')
  assert.match(text, /informational and discussion purposes only/)
  assert.match(text, /does not constitute real estate/)
})

test('buildBuyerSummaryText items without detail do not include a blank indent line', () => {
  const sections = [
    {
      id: 'nextStep',
      title: 'Suggested Next Step',
      items: [{ id: 'next-general', label: 'Connect with a licensed real estate agent' }],
    },
  ]
  const text = buildBuyerSummaryText(sections, '')
  const lines = text.split('\n')
  const labelIdx = lines.findIndex(l => l === '• Connect with a licensed real estate agent')
  assert.ok(labelIdx !== -1, 'label line must exist')
  assert.ok(lines[labelIdx + 1] !== '  ', 'no blank indent line should follow a label with no detail')
})

// ── buildMailtoHref ───────────────────────────────────────────────────────────

test('buildMailtoHref produces a mailto: URI', () => {
  const href = buildMailtoHref('', 'Test Subject', 'Test body')
  assert.match(href, /^mailto:/, 'must start with mailto:')
})

test('buildMailtoHref with blank recipient produces mailto:? (no recipient)', () => {
  const href = buildMailtoHref('', 'Subject', 'Body')
  assert.ok(href.startsWith('mailto:?'), `expected mailto:? but got: ${href.slice(0, 30)}`)
})

test('buildMailtoHref with a recipient includes it before the ?', () => {
  const href = buildMailtoHref('agent@example.com', 'Subject', 'Body')
  assert.ok(href.startsWith('mailto:agent@example.com?'), 'recipient must appear before query string')
})

test('buildMailtoHref encodes the subject correctly', () => {
  const href = buildMailtoHref('', 'My Buyer Readiness Planning Summary', 'body')
  assert.match(href, /subject=My%20Buyer%20Readiness%20Planning%20Summary/)
})

test('buildMailtoHref encodes the body correctly', () => {
  const href = buildMailtoHref('', 'subject', 'Hello & goodbye')
  assert.match(href, /body=Hello%20%26%20goodbye/)
})

test('buildMailtoHref buyer mailto includes complete summary and disclaimer', () => {
  const sections = evaluate(answers({ stage: 'actively', financingStatus: 'preapproved' }))
  const summaryText = buildBuyerSummaryText(sections, '')
  const href = buildMailtoHref('', 'My Buyer Readiness Planning Summary', summaryText)
  const bodyEncoded = href.match(/[?&]body=(.*)$/)?.[1] ?? ''
  const body = decodeURIComponent(bodyEncoded)
  assert.match(body, /BUYER READINESS PLANNER/)
  assert.match(body, /informational and discussion purposes only/)
  assert.match(body, /does not constitute real estate/)
})

// ── test infrastructure ───────────────────────────────────────────────────────

test('npm test command is configured for single-file concurrency (--test-concurrency=1)', async () => {
  const raw = await readFile(path.join(ROOT, 'package.json'), 'utf-8')
  const pkg = JSON.parse(raw) as { scripts: Record<string, string> }
  assert.match(pkg.scripts.test, /--test-concurrency=1/, 'package.json test script must include --test-concurrency=1')
})
