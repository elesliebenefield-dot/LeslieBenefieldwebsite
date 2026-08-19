import type { PlanningPeriod, PlanTask, Responsibility } from './listingTypes.ts'

export interface StarterTaskDef {
  key: string
  title: string
  defaultNeedsAgentInput?: boolean
  defaultResponsibility?: Responsibility
  defaultPlanningPeriod?: PlanningPeriod
}

export interface CategoryDef {
  key: string
  title: string
  tasks: StarterTaskDef[]
}

export const TASK_LIBRARY: CategoryDef[] = [
  {
    key: 'decluttering',
    title: 'Decluttering and Packing',
    tasks: [
      { key: 'declutter-excess', title: 'Remove excess belongings', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'declutter-closets', title: 'Organize closets and storage areas', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'declutter-collections', title: 'Pack personal collections or décor', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'declutter-storage', title: 'Arrange off-site storage', defaultPlanningPeriod: 'beforeListing', defaultResponsibility: 'homeowner' },
      { key: 'declutter-counters', title: 'Remove items from countertops', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'declutter-donation', title: 'Prepare donation or disposal items', defaultPlanningPeriod: 'beforeListing', defaultResponsibility: 'homeowner' },
    ],
  },
  {
    key: 'cleaning',
    title: 'Cleaning',
    tasks: [
      { key: 'clean-deep', title: 'General deep cleaning', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'vendor' },
      { key: 'clean-kitchen', title: 'Kitchen cleaning', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'clean-bath', title: 'Bathroom cleaning', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'clean-floors', title: 'Flooring or carpet cleaning', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'vendor' },
      { key: 'clean-windows', title: 'Windows and glass', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'clean-odors', title: 'Address noticeable odors', defaultPlanningPeriod: 'beforeListing', defaultResponsibility: 'homeowner' },
      { key: 'clean-final', title: 'Final cleaning before photography', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
    ],
  },
  {
    key: 'repairs',
    title: 'Repairs and Maintenance',
    tasks: [
      { key: 'repair-list', title: 'Make a list of known concerns', defaultPlanningPeriod: 'beforeSpending', defaultResponsibility: 'homeowner', defaultNeedsAgentInput: true },
      { key: 'repair-discuss', title: 'Discuss repair priorities with the agent', defaultPlanningPeriod: 'beforeSpending', defaultResponsibility: 'agent', defaultNeedsAgentInput: true },
      { key: 'repair-guidance', title: 'Obtain appropriate professional guidance', defaultPlanningPeriod: 'beforeSpending', defaultResponsibility: 'homeowner', defaultNeedsAgentInput: true },
      { key: 'repair-complete', title: 'Complete agreed minor repairs', defaultPlanningPeriod: 'beforeListing', defaultResponsibility: 'vendor' },
      { key: 'repair-receipts', title: 'Confirm completed work and receipts', defaultPlanningPeriod: 'beforeListing', defaultResponsibility: 'homeowner' },
      { key: 'repair-no-projects', title: 'Avoid beginning unapproved cosmetic projects', defaultPlanningPeriod: 'beforeSpending', defaultResponsibility: 'homeowner', defaultNeedsAgentInput: true },
    ],
  },
  {
    key: 'paint',
    title: 'Paint and Cosmetic Preparation',
    tasks: [
      { key: 'paint-discuss', title: 'Discuss paint priorities with the agent', defaultPlanningPeriod: 'beforeSpending', defaultResponsibility: 'agent', defaultNeedsAgentInput: true },
      { key: 'paint-touchup', title: 'Touch up agreed areas', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'vendor' },
      { key: 'paint-personal', title: 'Remove highly personal wall items', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'paint-cosmetic', title: 'Address visible cosmetic concerns', defaultPlanningPeriod: 'beforeListing', defaultResponsibility: 'homeowner' },
      { key: 'paint-confirm', title: 'Confirm colors or projects before spending money', defaultPlanningPeriod: 'beforeSpending', defaultNeedsAgentInput: true },
    ],
  },
  {
    key: 'exterior',
    title: 'Exterior and Curb Presentation',
    tasks: [
      { key: 'ext-yard', title: 'Yard cleanup', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'ext-landscaping', title: 'Landscaping touch-ups', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'vendor' },
      { key: 'ext-entry', title: 'Entryway preparation', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'ext-clean', title: 'Exterior cleaning', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'vendor' },
      { key: 'ext-clutter', title: 'Remove exterior clutter', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'ext-lighting', title: 'Check exterior lighting', defaultPlanningPeriod: 'beforeListing', defaultResponsibility: 'homeowner' },
    ],
  },
  {
    key: 'staging',
    title: 'Furniture and Staging',
    tasks: [
      { key: 'stage-furniture', title: 'Review furniture placement', defaultPlanningPeriod: 'beforePhotography', defaultNeedsAgentInput: true },
      { key: 'stage-excess', title: 'Remove or rearrange excess furniture', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'stage-discuss', title: 'Discuss staging with the agent', defaultPlanningPeriod: 'beforeSpending', defaultResponsibility: 'agent', defaultNeedsAgentInput: true },
      { key: 'stage-rooms', title: 'Prepare bedrooms and living spaces', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'stage-surfaces', title: 'Prepare surfaces for photography', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'stage-rented', title: 'Confirm rented or borrowed staging items', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'agent' },
    ],
  },
  {
    key: 'safety',
    title: 'Safety, Privacy, and Valuables',
    tasks: [
      { key: 'safe-meds', title: 'Secure medications', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner' },
      { key: 'safe-jewelry', title: 'Secure jewelry and small valuables', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner' },
      { key: 'safe-docs', title: 'Remove financial and personal documents', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner' },
      { key: 'safe-firearms', title: 'Remove or secure firearms appropriately', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner' },
      { key: 'safe-passwords', title: 'Protect passwords, calendars, family information, and mail', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner' },
      { key: 'safe-security', title: 'Confirm plans for security systems and access codes', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner', defaultNeedsAgentInput: true },
    ],
  },
  {
    key: 'logistics',
    title: 'Pets and Household Logistics',
    tasks: [
      { key: 'logist-pet-photo', title: 'Create a pet plan for photography', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'logist-pet-show', title: 'Create a pet plan for showings', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner' },
      { key: 'logist-household', title: 'Coordinate children, caregiving, or work-from-home needs', defaultPlanningPeriod: 'beforeListing', defaultResponsibility: 'homeowner' },
      { key: 'logist-notify', title: 'Notify involved household members', defaultPlanningPeriod: 'beforeListing', defaultResponsibility: 'homeowner' },
      { key: 'logist-tenant', title: 'Coordinate with tenants or a property manager', defaultPlanningPeriod: 'beforeListing', defaultResponsibility: 'tenantManager' },
      { key: 'logist-access', title: 'Plan temporary access restrictions', defaultPlanningPeriod: 'beforeShowing', defaultNeedsAgentInput: true },
    ],
  },
  {
    key: 'photography',
    title: 'Photography Preparation',
    tasks: [
      { key: 'photo-confirm-date', title: 'Confirm photography date', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'agent' },
      { key: 'photo-instructions', title: "Confirm agent's photography instructions", defaultPlanningPeriod: 'beforePhotography', defaultNeedsAgentInput: true },
      { key: 'photo-cleaning', title: 'Complete selected cleaning tasks', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'photo-staging', title: 'Complete selected staging tasks', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'photo-lighting', title: 'Prepare lighting and window coverings', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'photo-vehicles', title: 'Remove vehicles or exterior distractions if requested', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
      { key: 'photo-walkthrough', title: 'Perform a final room-by-room walkthrough', defaultPlanningPeriod: 'beforePhotography', defaultResponsibility: 'homeowner' },
    ],
  },
  {
    key: 'showing',
    title: 'Showing and Open-House Preparation',
    tasks: [
      { key: 'show-access', title: 'Confirm showing access procedure', defaultPlanningPeriod: 'beforeShowing', defaultNeedsAgentInput: true },
      { key: 'show-keys', title: 'Prepare keys, locks, and approved access instructions', defaultPlanningPeriod: 'beforeShowing', defaultNeedsAgentInput: true },
      { key: 'show-lights', title: 'Set a plan for lights and window coverings', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner' },
      { key: 'show-tidy', title: 'Remove food, trash, and household clutter', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner' },
      { key: 'show-valuables', title: 'Secure valuables and sensitive items', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner' },
      { key: 'show-departure', title: 'Prepare a departure plan for occupants and pets', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner' },
      { key: 'show-reset', title: 'Create a reset checklist after showings', defaultPlanningPeriod: 'beforeShowing', defaultResponsibility: 'homeowner' },
      { key: 'show-contact', title: 'Confirm agent contact information', defaultPlanningPeriod: 'beforeShowing', defaultNeedsAgentInput: true },
    ],
  },
]

let _taskCounter = 0

export function makePlanTask(def: StarterTaskDef, category: CategoryDef): PlanTask {
  return {
    id: `task-${Date.now()}-${++_taskCounter}`,
    title: def.title,
    category: category.title,
    categoryKey: category.key,
    status: 'notStarted',
    responsibility: def.defaultResponsibility ?? 'unassigned',
    planningPeriod: def.defaultPlanningPeriod ?? 'beforeListing',
    targetDate: '',
    notes: '',
    needsAgentInput: def.defaultNeedsAgentInput ?? false,
    isCustom: false,
    starterKey: def.key,
  }
}

export function makeCustomTask(title: string, categoryKey: string, categoryTitle: string): PlanTask {
  return {
    id: `task-${Date.now()}-${++_taskCounter}`,
    title,
    category: categoryTitle,
    categoryKey,
    status: 'notStarted',
    responsibility: 'unassigned',
    planningPeriod: 'beforeListing',
    targetDate: '',
    notes: '',
    needsAgentInput: false,
    isCustom: true,
    starterKey: '',
  }
}

export function getCategoryByKey(key: string): CategoryDef | undefined {
  return TASK_LIBRARY.find(c => c.key === key)
}
