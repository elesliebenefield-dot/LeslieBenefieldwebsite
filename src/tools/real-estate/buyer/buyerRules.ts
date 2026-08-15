import type { Rule } from '../../core/types'
import type { BuyerAnswers } from './buyerTypes'

export const SECTION_ORDER = ['searchPreferences', 'infoToOrganize', 'timingTopics', 'agentTopics', 'nextStep'] as const

export const SECTION_TITLES: Record<string, string> = {
  searchPreferences: 'Preferences You\'ve Identified',
  infoToOrganize: 'Information to Organize',
  timingTopics: 'Timing and Coordination Topics',
  agentTopics: 'Topics to Discuss with Your Agent',
  nextStep: 'Suggested Next Step',
}

export const BUYER_RULES: Rule<BuyerAnswers>[] = [

  // ── searchPreferences ─────────────────────────────────────────────────────

  {
    condition: a => a.propertyTypes.length > 0 && !a.propertyTypes.includes('openToAll'),
    sectionId: 'searchPreferences',
    item: {
      id: 'pref-property-types',
      label: 'Property type preferences',
      detail: 'You identified specific property types you are interested in. Sharing these with your agent early helps focus the search and filter for relevant listings.',
    },
  },
  {
    condition: a => a.mustHaves.length > 0,
    sectionId: 'searchPreferences',
    item: {
      id: 'pref-must-haves',
      label: 'Features on your must-have list',
      detail: 'You noted features that are important to you. Bringing a clear list of must-haves to your agent consultation helps narrow the search to homes that genuinely fit your needs.',
    },
  },
  {
    condition: a => a.niceToHaves.length > 0,
    sectionId: 'searchPreferences',
    item: {
      id: 'pref-nice-to-haves',
      label: 'Nice-to-have features to watch for',
      detail: 'You identified features that would be a bonus. Sharing these helps your agent flag listings that offer more of what you want without limiting the core search.',
    },
  },

  // ── infoToOrganize ────────────────────────────────────────────────────────
  // Note: financingStatus notSpoken/unsure goes here only (not agentTopics).
  // mustSellFirst unsure goes here only (not timingTopics).
  // purchaseType investment/land goes here only.
  // hasTargetArea no goes here only (not agentTopics).
  // otherDecisionMakers yes goes here only.

  {
    condition: a => a.financingStatus === 'notSpoken',
    sectionId: 'infoToOrganize',
    item: {
      id: 'info-financing-not-started',
      label: 'Connect with a lender before beginning your search',
      detail: 'You have not yet spoken with a lender. Connecting with a lender early helps you understand the range of loan types available and what documentation you will need to gather — before you are deep into searching.',
    },
  },
  {
    condition: a => a.financingStatus === 'unsure',
    sectionId: 'infoToOrganize',
    item: {
      id: 'info-financing-unsure',
      label: 'Clarify your financing approach',
      detail: 'You noted uncertainty about your financing situation. Sorting out whether you will use a loan, cash, or another approach is a practical first step before beginning an active search.',
    },
  },
  {
    condition: a => a.mustSellFirst === 'unsure',
    sectionId: 'infoToOrganize',
    item: {
      id: 'info-must-sell-unsure',
      label: 'Clarify whether a home sale is required first',
      detail: "You're unsure whether you need to sell a home before purchasing. Sorting this out will help you and your agent understand what type of offer structure makes sense for your situation.",
    },
  },
  {
    condition: a => a.purchaseType === 'investment',
    sectionId: 'infoToOrganize',
    item: {
      id: 'info-investment',
      label: 'Investment purchase considerations to research',
      detail: 'Investment property purchases often involve different loan structures, property management considerations, and due diligence steps than primary home purchases. Gathering your goals and questions in advance will help you get the most out of your agent and lender conversations.',
    },
  },
  {
    condition: a => a.purchaseType === 'land',
    sectionId: 'infoToOrganize',
    item: {
      id: 'info-land',
      label: 'Land purchase specifics to research',
      detail: 'Land purchases often involve unique considerations around utilities, zoning, access, and financing that differ from improved property purchases. Researching these topics and preparing questions in advance will make your agent consultation more productive.',
    },
  },
  {
    condition: a => a.hasTargetArea === 'no',
    sectionId: 'infoToOrganize',
    item: {
      id: 'info-no-target-area',
      label: 'Consider defining your search area',
      detail: 'You noted you do not yet have a target area in mind. Thinking through what matters to you in a location — commute, community, schools, or other factors — before your agent consultation can help you get clearer on where to focus.',
    },
  },
  {
    condition: a => a.otherDecisionMakers === 'yes',
    sectionId: 'infoToOrganize',
    item: {
      id: 'info-decision-makers',
      label: 'Alignment with other decision-makers',
      detail: 'You noted that other people will be involved in the purchase decision. Getting aligned on priorities, timeline, and must-haves with all decision-makers before starting an active search will keep the process running smoothly.',
    },
  },
  {
    condition: a => a.movingFlexibility === 'unsure',
    sectionId: 'infoToOrganize',
    item: {
      id: 'info-move-date-unsure',
      label: 'Clarify your move-in date flexibility',
      detail: "You're unsure how flexible your move-in date is. Sorting this out will help your agent understand what closing timelines work for you and how to structure offers accordingly.",
    },
  },

  // ── timingTopics ──────────────────────────────────────────────────────────
  // Note: mustSellFirst yes goes here only (not infoToOrganize).

  {
    condition: a => a.housingTiming === 'leaseSoon',
    sectionId: 'timingTopics',
    item: {
      id: 'timing-lease-ending',
      label: 'Lease ending soon',
      detail: 'Your lease is ending soon. Discussing the expected timeline with your agent early — including what a realistic closing timeline looks like — helps you plan for the transition and reduces pressure.',
    },
  },
  {
    condition: a => a.housingTiming === 'urgent',
    sectionId: 'timingTopics',
    item: {
      id: 'timing-urgent',
      label: 'Urgent timeline',
      detail: 'You noted an urgent timeline. Sharing the specifics of your situation with your agent early will help them prioritize and advise on realistic options given the timeline.',
    },
  },
  {
    condition: a => a.mustSellFirst === 'yes',
    sectionId: 'timingTopics',
    item: {
      id: 'timing-must-sell',
      label: 'Coordinating a home sale with your purchase',
      detail: 'You need to sell your current home before purchasing. Coordinating timing between a sale and a purchase adds complexity. Discussing sequencing, contingency options, and temporary housing with your agent early will help you prepare.',
    },
  },
  {
    condition: a => a.showingAvailability === 'limited',
    sectionId: 'timingTopics',
    item: {
      id: 'timing-showing-limited',
      label: 'Limited showing availability',
      detail: 'You noted limited availability for showings. Sharing this with your agent helps them prioritize the most relevant listings and schedule efficiently.',
    },
  },
  {
    condition: a => a.showingAvailability === 'weekendsOnly',
    sectionId: 'timingTopics',
    item: {
      id: 'timing-showing-weekends',
      label: 'Weekend-only availability for showings',
      detail: 'You are available for showings on weekends only. Letting your agent know upfront helps them coordinate scheduling and ensures you see the listings that matter most within your available windows.',
    },
  },
  {
    condition: a => a.movingFlexibility === 'specific',
    sectionId: 'timingTopics',
    item: {
      id: 'timing-specific-move',
      label: 'Specific move-in date to coordinate',
      detail: 'You have a specific date you need to move in. Sharing this target with your agent helps them filter for properties where the timeline is a realistic fit and structure offers with closing dates that work for you.',
    },
  },

  // ── agentTopics ───────────────────────────────────────────────────────────
  // Note: financingStatus begun/preapproved/noFinancing goes here only.
  // hasTargetArea open goes here only (not infoToOrganize).

  {
    condition: a => a.financingStatus === 'begun',
    sectionId: 'agentTopics',
    item: {
      id: 'agent-financing-begun',
      label: 'Financing in progress',
      detail: 'You have begun conversations with a lender. Letting your agent know where you are in the process — and sharing any documentation status — helps them advise on timing and offer strategy.',
    },
  },
  {
    condition: a => a.financingStatus === 'preapproved',
    sectionId: 'agentTopics',
    item: {
      id: 'agent-financing-preapproved',
      label: 'Pre-approval in place',
      detail: 'You have a pre-approval. Sharing the details with your agent — including expiration date and any conditions — helps them tailor offer strategy and advise on timeline.',
    },
  },
  {
    condition: a => a.financingStatus === 'noFinancing',
    sectionId: 'agentTopics',
    item: {
      id: 'agent-cash-purchase',
      label: 'Cash purchase',
      detail: 'You plan to purchase without a loan. Your agent can walk you through how cash offers are typically structured and what documentation is commonly requested in your market.',
    },
  },
  {
    condition: a => a.hasTargetArea === 'open',
    sectionId: 'agentTopics',
    item: {
      id: 'agent-area-open',
      label: 'Defining your search area',
      detail: 'You are open on where to search. Your agent can help you think through location considerations in the context of your priorities and the current market.',
    },
  },
  {
    condition: a => a.propertyTypes.includes('condo') || a.propertyTypes.includes('townhome'),
    sectionId: 'agentTopics',
    item: {
      id: 'agent-condo-townhome',
      label: 'Condo and townhome specifics',
      detail: 'You are interested in condos or townhomes. These purchases often involve HOA documents, resale restrictions, and buyer questionnaires that your agent can walk you through.',
    },
  },
  {
    condition: a => a.propertyTypes.includes('multiUnit'),
    sectionId: 'agentTopics',
    item: {
      id: 'agent-multi-unit',
      label: 'Multi-unit property considerations',
      detail: 'Multi-unit purchases often have distinct due diligence steps around existing leases, rental history, and property management. Your agent can walk you through what to expect in the search and offer process.',
    },
  },
  {
    condition: a => a.priorities.length > 0,
    sectionId: 'agentTopics',
    item: {
      id: 'agent-priorities',
      label: 'Your stated priorities',
      detail: 'You identified priorities for your home search. Sharing these with your agent at the start of your consultation helps them tailor their approach to what matters most to you.',
    },
  },
  {
    condition: a => a.agentQuestions.trim().length > 0,
    sectionId: 'agentTopics',
    item: {
      id: 'agent-custom-questions',
      label: 'Your specific questions',
      detail: 'You noted specific questions to discuss. Bring these to your agent consultation so they can be addressed in the context of your situation and the current market.',
    },
  },

  // ── nextStep ──────────────────────────────────────────────────────────────

  {
    condition: a => a.stage === 'justExploring',
    sectionId: 'nextStep',
    item: {
      id: 'next-exploring',
      label: 'Connect with an agent to learn about the buying process',
      detail: "You're in the early exploration phase. The next step is to connect with a licensed real estate agent to learn about how the process works and ask any initial questions — no commitment required.",
    },
  },
  {
    condition: a => a.stage === 'actively',
    sectionId: 'nextStep',
    item: {
      id: 'next-actively',
      label: 'Schedule a buyer consultation',
      detail: "You're actively searching. Scheduling a buyer consultation with an agent will help you align on search criteria, understand offer strategy, and make sure your financing is in order.",
    },
  },
  {
    condition: a => a.stage === 'ready',
    sectionId: 'nextStep',
    item: {
      id: 'next-ready',
      label: 'Connect with an agent to begin your search',
      detail: "You've noted you're ready to start. Connecting with a licensed real estate agent to formalize your search criteria and begin touring homes is the natural next step.",
    },
  },
  {
    condition: a => a.stage === '',
    sectionId: 'nextStep',
    item: {
      id: 'next-general',
      label: 'Connect with a licensed real estate agent',
      detail: 'The natural next step is to connect with a licensed real estate agent who can guide you through the specifics of your situation and the current market.',
    },
  },
]
