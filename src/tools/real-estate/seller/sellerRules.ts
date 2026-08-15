import type { Rule } from '../../core/types'
import type { SellerAnswers } from './sellerTypes'

export const SECTION_ORDER = ['infoToGather', 'prepTopics', 'timing', 'agentTopics', 'nextStep'] as const

export const SECTION_TITLES: Record<string, string> = {
  infoToGather: 'Information to Gather',
  prepTopics: 'Property Preparation Topics',
  timing: 'Timing Considerations',
  agentTopics: 'Topics to Discuss with Your Agent',
  nextStep: 'Suggested Next Step',
}

export const SELLER_RULES: Rule<SellerAnswers>[] = [

  // ── infoToGather ──────────────────────────────────────────────────────────

  {
    condition: a => a.hoaInvolvement === 'yes',
    sectionId: 'infoToGather',
    item: {
      id: 'hoa-docs',
      label: 'HOA information',
      detail: 'Gather the HOA contact information, current dues and fees, and any governing documents, rules, or restrictions that may affect the listing or showings.',
    },
  },
  {
    condition: a => a.hoaInvolvement === 'notSure',
    sectionId: 'infoToGather',
    item: {
      id: 'hoa-confirm',
      label: 'Confirm HOA status',
      detail: "You're unsure whether your property has an HOA. Your deed, mortgage statement, or county property records can help confirm this before listing.",
    },
  },
  {
    condition: a => a.documentsAvailable.includes('surveys'),
    sectionId: 'infoToGather',
    item: {
      id: 'doc-surveys',
      label: 'Survey documents',
      detail: 'You have survey documents. Locating and organizing these now will save time once the listing is active.',
    },
  },
  {
    condition: a => a.documentsAvailable.includes('permits'),
    sectionId: 'infoToGather',
    item: {
      id: 'doc-permits',
      label: 'Permit records',
      detail: 'You have permit records for renovations or additions. Having these organized helps address buyer questions about the scope of work.',
    },
  },
  {
    condition: a => a.documentsAvailable.includes('warranties'),
    sectionId: 'infoToGather',
    item: {
      id: 'doc-warranties',
      label: 'Appliance and system warranties',
      detail: 'You have warranties on file. These are often valued by buyers and straightforward to transfer.',
    },
  },
  {
    condition: a => a.documentsAvailable.includes('hoa'),
    sectionId: 'infoToGather',
    item: {
      id: 'doc-hoa',
      label: 'HOA documents',
      detail: 'You have HOA documents including CC&Rs or meeting minutes. Organizing these now prepares you for standard buyer document requests.',
    },
  },
  {
    condition: a => a.documentsAvailable.includes('taxRecords'),
    sectionId: 'infoToGather',
    item: {
      id: 'doc-tax-records',
      label: 'Property tax records',
      detail: 'Recent property tax records are a standard part of a listing file and are straightforward to gather.',
    },
  },
  {
    condition: a => a.multipleOwners === 'yes' || a.multipleOwners === 'possibly',
    sectionId: 'infoToGather',
    item: {
      id: 'owner-alignment',
      label: 'Owner alignment',
      detail: 'You noted multiple owners. Confirming that all owners are aligned on timing, expectations, and decision-making before listing will keep the process moving smoothly.',
    },
  },
  {
    condition: a => a.recentImprovements === 'yesMajor',
    sectionId: 'infoToGather',
    item: {
      id: 'improvement-docs',
      label: 'Improvement documentation',
      detail: 'You made major improvements. Gathering permits, receipts, or contractor information helps you speak confidently to buyers about the scope and quality of work.',
    },
  },

  // ── prepTopics ────────────────────────────────────────────────────────────

  {
    condition: a => a.knownRepairs === 'yesList',
    sectionId: 'prepTopics',
    item: {
      id: 'repairs-known',
      label: 'Known repairs',
      detail: 'You have a list of known repairs. Your agent can help you think through whether to address them before listing or handle them through disclosure and pricing.',
    },
  },
  {
    condition: a => a.knownRepairs === 'maybeFew',
    sectionId: 'prepTopics',
    item: {
      id: 'repairs-maybe',
      label: 'Potential repair items',
      detail: 'You mentioned a few potential repairs. A walkthrough with your agent before listing is a practical way to decide which items, if any, to address.',
    },
  },
  {
    condition: a => a.declutterStatus === 'planned',
    sectionId: 'prepTopics',
    item: {
      id: 'declutter-planned',
      label: 'Decluttering — planned',
      detail: 'Decluttering is one of the highest-impact preparation steps. Starting early gives you more scheduling flexibility before photos and showings begin.',
    },
  },
  {
    condition: a => a.declutterStatus === 'inProgress',
    sectionId: 'prepTopics',
    item: {
      id: 'declutter-in-progress',
      label: 'Decluttering — in progress',
      detail: "You're actively decluttering. Completing this process before listing photos will help the home present well.",
    },
  },
  {
    condition: a => a.declutterStatus === 'notSure',
    sectionId: 'prepTopics',
    item: {
      id: 'declutter-unsure',
      label: 'Decluttering — plan to finalize',
      detail: "You haven't settled on a declutter plan yet. Your agent can walk through the property and give you a sense of what buyers typically notice.",
    },
  },
  {
    condition: a => a.accessArrangement === 'needsCoordination',
    sectionId: 'prepTopics',
    item: {
      id: 'access-coordination',
      label: 'Showing access coordination',
      detail: 'You noted that access for showings will require coordination. Discussing your preferences with your agent early helps set clear expectations for buyers and their agents.',
    },
  },
  {
    condition: a => a.prepQuestions === 'yes',
    sectionId: 'prepTopics',
    item: {
      id: 'prep-questions',
      label: 'Preparation questions',
      detail: 'You have preparation questions. Writing these down before your agent consultation ensures they are all addressed.',
    },
  },
  {
    condition: a => a.occupancy === 'tenantOccupied',
    sectionId: 'prepTopics',
    item: {
      id: 'tenant-prep',
      label: 'Tenant-occupied coordination',
      detail: 'Tenant-occupied properties involve additional logistics for showings and access. Reviewing your lease terms and discussing tenant communication with your agent early will help.',
    },
  },

  // ── timing ────────────────────────────────────────────────────────────────

  {
    condition: a => a.timeframe === 'asap',
    sectionId: 'timing',
    item: {
      id: 'timing-asap',
      label: 'Expedited timeline',
      detail: 'Your goal is to list as soon as possible. Focus on completing preparation steps efficiently and establish your agent relationship early so the listing can move quickly.',
    },
  },
  {
    condition: a => a.coordination === 'buyFirst',
    sectionId: 'timing',
    item: {
      id: 'timing-buy-first',
      label: 'Purchasing before selling',
      detail: "You're considering purchasing before selling. Discussing sequencing and contingency options with your agent early is worthwhile.",
    },
  },
  {
    condition: a => a.coordination === 'simultaneously',
    sectionId: 'timing',
    item: {
      id: 'timing-simultaneous',
      label: 'Simultaneous purchase and sale',
      detail: 'Coordinating a purchase and sale at the same time requires careful timing. Your agent can help you think through how to structure and sequence both transactions.',
    },
  },
  {
    condition: a => a.coordination === 'sellFirst',
    sectionId: 'timing',
    item: {
      id: 'timing-sell-first',
      label: 'Selling before purchasing',
      detail: 'You plan to sell before purchasing your next home. Timing of proceeds and temporary housing arrangements are practical topics to discuss with your agent.',
    },
  },
  {
    condition: a => a.timingComplications === 'yes',
    sectionId: 'timing',
    item: {
      id: 'timing-complications',
      label: 'Timing complications',
      detail: 'You noted timing complications. Sharing these specifics with your agent early will help in planning the listing timeline around your situation.',
    },
  },
  {
    condition: a => a.occupancy === 'vacant',
    sectionId: 'timing',
    item: {
      id: 'timing-vacant',
      label: 'Vacant property',
      detail: 'A vacant property can often move to listing faster, but security, utilities, and staging logistics are worth discussing with your agent.',
    },
  },
  {
    condition: a => a.occupancy === 'tenantOccupied',
    sectionId: 'timing',
    item: {
      id: 'timing-tenant',
      label: 'Tenant occupancy and listing timeline',
      detail: 'Tenant occupancy adds a timing consideration. Discussing showing rights, lease terms, and the path to vacant possession with your agent early helps avoid delays.',
    },
  },

  // ── agentTopics ───────────────────────────────────────────────────────────

  {
    condition: a => a.knownRepairs === 'notSure',
    sectionId: 'agentTopics',
    item: {
      id: 'agent-repairs-unsure',
      label: 'Assessing property condition',
      detail: "You're unsure about known repairs. A walkthrough with your agent — or exploring pre-listing inspection options — can help you get a clearer picture before listing.",
    },
  },
  {
    condition: a => a.hoaInvolvement === 'notSure',
    sectionId: 'agentTopics',
    item: {
      id: 'agent-hoa-confirm',
      label: 'HOA status',
      detail: "You're unsure whether there's an HOA. Your agent may be able to help you identify the right resources to confirm this.",
    },
  },
  {
    condition: a => a.accessArrangement === 'haveQuestions',
    sectionId: 'agentTopics',
    item: {
      id: 'agent-access-questions',
      label: 'Showing access arrangements',
      detail: 'You have questions about access for showings. These are very common and easy to address once you discuss your specific situation with an agent.',
    },
  },
  {
    condition: a => a.prepQuestions === 'yes',
    sectionId: 'agentTopics',
    item: {
      id: 'agent-prep-list',
      label: 'Preparation questions for your agent',
      detail: 'Bring your specific preparation questions to your listing consultation so they can be answered in the context of your property.',
    },
  },
  {
    condition: a => a.propertyType === 'condoTownhome',
    sectionId: 'agentTopics',
    item: {
      id: 'agent-condo',
      label: 'Condo and townhome listing specifics',
      detail: 'Condo and townhome listings often involve additional steps around HOA approvals, documentation, and buyer questionnaires. Your agent can walk you through what to expect.',
    },
  },
  {
    condition: a => a.propertyType === 'multiUnit',
    sectionId: 'agentTopics',
    item: {
      id: 'agent-multi-unit',
      label: 'Multi-unit property considerations',
      detail: 'Multi-unit properties often have distinct listing and showing considerations compared to single-family homes. Your agent can walk you through what to expect.',
    },
  },
  {
    condition: a => a.agentQuestions.trim().length > 0,
    sectionId: 'agentTopics',
    item: {
      id: 'agent-custom-questions',
      label: 'Your specific questions',
      detail: 'You noted specific questions to discuss. Bring these directly to your listing consultation so they can be addressed in the context of your situation.',
    },
  },

  // ── nextStep ──────────────────────────────────────────────────────────────

  {
    condition: a => a.stage === 'exploring',
    sectionId: 'nextStep',
    item: {
      id: 'next-exploring',
      label: 'Connect with an agent to explore your options',
      detail: "You're in the early exploration phase. The next step is to connect with a licensed real estate agent to learn about the process and discuss your goals — no commitment required at this stage.",
    },
  },
  {
    condition: a => a.stage === 'preparing',
    sectionId: 'nextStep',
    item: {
      id: 'next-preparing',
      label: 'Schedule a listing consultation',
      detail: "You're actively preparing to sell. Scheduling a listing consultation with an agent will help you establish a timeline and work through your remaining preparation steps.",
    },
  },
  {
    condition: a => a.stage === 'ready',
    sectionId: 'nextStep',
    item: {
      id: 'next-ready',
      label: 'Begin the listing process',
      detail: "You've noted you're ready to list. Connecting with a licensed real estate agent to begin the listing process is the natural next step.",
    },
  },
  {
    condition: a => a.stage === '',
    sectionId: 'nextStep',
    item: {
      id: 'next-general',
      label: 'Connect with a licensed real estate agent',
      detail: 'The natural next step is to connect with a licensed real estate agent who can guide you through the specifics of your situation.',
    },
  },
]
