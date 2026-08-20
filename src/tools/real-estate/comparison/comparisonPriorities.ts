import type { Priority } from './comparisonTypes'

let _nextId = 0
export function makeId(): string {
  return `cmp-${++_nextId}`
}

export interface StarterPriorityDef {
  key: string
  label: string
}

export const STARTER_PRIORITY_DEFS: StarterPriorityDef[] = [
  { key: 'layout',       label: 'Layout and flow' },
  { key: 'bedsBaths',    label: 'Bedroom and bathroom needs' },
  { key: 'condition',    label: 'Overall condition' },
  { key: 'light',        label: 'Natural light' },
  { key: 'kitchen',      label: 'Kitchen functionality' },
  { key: 'storage',      label: 'Storage' },
  { key: 'parking',      label: 'Parking' },
  { key: 'outdoor',      label: 'Outdoor space' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'wfh',          label: 'Work-from-home space' },
  { key: 'commute',      label: 'Commute or travel considerations' },
  { key: 'expenses',     label: 'Monthly property expenses' },
  { key: 'noise',        label: 'Noise observed during the visit' },
  { key: 'pets',         label: 'Pet-related needs' },
]

export function makeStarterPriority(def: StarterPriorityDef): Priority {
  return { id: makeId(), label: def.label, isCustom: false }
}

export function makeCustomPriority(label: string): Priority {
  return { id: makeId(), label: label.trim(), isCustom: true }
}
