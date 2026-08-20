import type { ActionCategory } from './openHouseTypes'

export interface StarterActionDef {
  key: string
  label: string
  category: ActionCategory
}

export const STARTER_ACTIONS: StarterActionDef[] = [
  // Property & event wrap-up
  { key: 'secure_property',    label: 'Secure the property and confirm access items returned',         category: 'wrap_up' },
  { key: 'remove_signs',       label: 'Remove or account for signs and marketing materials',           category: 'wrap_up' },
  { key: 'prepare_recap',      label: 'Prepare an event recap summary',                                category: 'wrap_up' },
  { key: 'organize_feedback',  label: 'Organize property-feedback themes from the event',              category: 'wrap_up' },
  { key: 'record_unresolved',  label: 'Record unresolved questions for later follow-up',              category: 'wrap_up' },

  // Seller / client communication
  { key: 'seller_summary',     label: 'Share an appropriate event summary with the seller or client', category: 'seller_comm' },
  { key: 'seller_feedback',    label: 'Relay relevant property-feedback themes to the seller or client', category: 'seller_comm' },
  { key: 'seller_checkin',     label: 'Schedule a check-in call or meeting with the seller or client', category: 'seller_comm' },

  // Visitor follow-up
  { key: 'answer_questions',   label: 'Answer requested property questions for visitors with confirmed permission', category: 'visitor_fu' },
  { key: 'no_visitor_fu',      label: 'Confirm no visitor follow-up is needed for this event',        category: 'visitor_fu' },
  { key: 'confirm_permission', label: 'Clarify follow-up permission before any outreach — check brokerage requirements', category: 'visitor_fu' },

  // Agent & professional questions
  { key: 'route_inspection',   label: 'Route inspection or repair questions to appropriate professional', category: 'agent_questions' },
  { key: 'route_title',        label: 'Route title or legal questions to appropriate professional',    category: 'agent_questions' },
  { key: 'route_financing',    label: 'Route financing or lending questions to appropriate professional', category: 'agent_questions' },
  { key: 'broker_review',      label: 'Flag items requiring broker or agent review',                   category: 'agent_questions' },

  // Marketing & administrative
  { key: 'update_marketing',   label: 'Update marketing notes based on event observations',            category: 'marketing_admin' },
  { key: 'signage_notes',      label: 'Note signage or wayfinding improvements for next event',        category: 'marketing_admin' },
  { key: 'schedule_followup',  label: 'Schedule a later check-in if no immediate action is needed',   category: 'marketing_admin' },
]
