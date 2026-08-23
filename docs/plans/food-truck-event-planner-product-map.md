# Food Truck Event Planner — Product Map
*Approved and implemented. Decisions in §22 approved 2026-08-23. Implementation complete, tests passing, local preview running.*

---

## 1. Problems the tool solves

**For the event organizer:**
- Reaching out to a food truck vendor with a vague message ("We'd love to have a food truck at our party — are you available?") gives the vendor almost nothing to work with and leads to a long back-and-forth before anyone knows whether the event is a good fit.
- Organizers often don't know what information a food vendor needs — they over-share irrelevant details or under-share critical ones like attendance, hours, and setup constraints.
- Inquiries sent without logistics details (vehicle access, electricity, water, surface type) get a slow response because the vendor has to ask for each item individually before assessing feasibility.
- Organizers who send the same vague message to multiple vendors can't compare responses fairly because every vendor is answering different follow-up questions.
- The planning process feels intimidating — organizers fear asking naive questions or not knowing the "right" vocabulary for mobile food service.

**For the mobile food vendor:**
- Vague or incomplete inquiries waste significant time — the vendor has to send 3–5 follow-up emails before learning the event isn't a fit (wrong date, inaccessible venue, budget mismatch).
- Event inquiries often arrive missing the one critical detail that determines feasibility: access, electricity, surface type, or whether the host has permits arranged.
- First contact often involves the vendor or their assistant manually constructing a response to half-answered questions.
- A well-structured inquiry brief helps the vendor quote quickly and confidently, which benefits both sides.

---

## 2. What this tool does NOT replace

| Category | Examples | Why excluded |
|---|---|---|
| Booking and availability platforms | Roaming Hunger, The Food Truck Booking Agency, Square Appointments | Live calendar, confirmed booking, contract management |
| Vendor marketplace listings | Roaming Hunger, GigSalad | Search, discovery, reviews |
| Payment and deposit processing | Square, Stripe, PayPal | Financial transactions of any kind |
| Permit and licensing guidance | Local health departments, city permitting portals | Regulatory compliance, legal requirements |
| Route planning and logistics | Waze, Google Maps | Navigation, routing, scheduling software |
| Catering management software | HoneyBook, Caterease | Contracts, invoicing, staffing |
| Customer relationship management | HubSpot, HoneyBook | Lead management, follow-up automation |

---

## 3. Proposed signature experience

**Name:** Food Truck Event Planner
**Public demo brand:** Your Mobile Food Business ›
**One-sentence description:** A guided, three-stage form that helps an event organizer prepare a clear service inquiry before reaching out to a mobile food or beverage vendor.

**The signature:** The form walks an organizer through three short stages — the event, the food and service, and the venue logistics. It asks questions in plain language, offers "I'm not sure" wherever a technical answer isn't required, and produces a clean, plain-text **Event Service Inquiry Brief** the organizer can email, copy, or print with one click. The brief is explicitly labeled as a planning summary — not a booking, availability confirmation, or contract of any kind.

**The feel:** Friendly and low-pressure. An organizer planning their first food truck event should feel like someone is helping them think it through — not interrogating them. Options-based questions reduce typing. Optional fields are clearly marked. The result is something the organizer feels good about sending.

**Scope:** Generic and resellable. Every question, label, and option is written to work for coffee trailers, meal trucks, dessert vendors, ice cream trucks, mobile cafés, and specialty food vendors. Individual client versions can customize the business name, email recipient, service type labels, and disclaimer wording without restructuring the tool.

---

## 4. Recommended stage structure

| Stage | Working title | Core purpose |
|---|---|---|
| 1 | Event basics | Event type, date, location, audience size, and service window |
| 2 | Food and service | Offering type, payment arrangement, dietary notes, and budget |
| 3 | Venue and logistics | Setup space, access, utilities, restrictions, and timing |

**Results screen:** Event Service Inquiry Brief with Copy, Print, Share, and Email controls. Optional organizer name for personalization. Websites by Leslie sales CTA.

**Stage navigation:** Back/Next pattern with confirmation dialog on Start Over. Edit Answers returns to Stage 1. All answers preserved on back navigation and Edit Answers. Start Over clears all.

---

## 5. Exact questions and answer options by stage

### Stage 1 — Event basics

**Q1. What type of event is this?** (required, single-select OptionCard, 8 options)
- Birthday or personal celebration
- Corporate or workplace event
- Wedding or reception
- Festival, fair, or outdoor market
- School or nonprofit event
- Private gathering or party
- Community or neighborhood event
- Other or I'm not sure

---

**Q2. What date is the event?** (required, date input — `type="date"`)
- Label: "Event date"
- Displayed as formatted date in the brief (e.g., "Saturday, September 12, 2026")
- Required; no future-date enforcement in the front end (vendor handles feasibility)

**Q2b. Date or timing notes** (optional, text input)
- Label: "Date or timing notes (optional)"
- Placeholder: "e.g., 'Date is not yet confirmed — targeting late September' or 'Any Saturday in October works'"
- Shown unconditionally below the date input

---

**Q3. Where will the event take place?** (required, text input)
- Label: "Location or venue name"
- Placeholder: "e.g., Riverside Park Pavilion, Austin TX — or — Our office parking lot, downtown Houston"
- Helper text: "A name and city is enough. You don't need to provide a full address."

---

**Q4. Is this a public or private event?** (required, single-select OptionCard, 3 options)
- Public — open to the general public
- Private — invitation-only or closed event
- I'm not sure

---

**Q5. Approximately how many people are you expecting?** (required, single-select OptionCard, 6 options)
- Fewer than 25 guests
- 25–75 guests
- 75–150 guests
- 150–300 guests
- More than 300 guests
- I'm not sure

---

**Q6. When would you like food service?** (required, single-select OptionCard, 6 options)
- Morning service (before noon)
- Lunch or midday service
- Afternoon service
- Evening service (after 5pm)
- Multiple periods or all day
- I'm not sure

**Q6b. Specific service hours** (optional, text input)
- Label: "Specific hours (optional)"
- Placeholder: "e.g., '11:30am–2:00pm' or 'cocktail hour 5:30–7pm, then dinner service 7–9pm'"
- Shown unconditionally below the service window question

---

**Q7. Will service be indoors or outdoors?** (optional, single-select OptionCard, 4 options)
- Outdoors — open air
- Indoors or under cover
- Covered or tent area
- I'm not sure

---

### Stage 2 — Food and service

**Q8. What type of service are you looking for?** (required, single-select OptionCard, 9 options)
- Full meals or entrées
- Light meals or sandwiches
- Snacks or small bites
- Baked goods or pastries
- Desserts or sweets
- Coffee, espresso, or hot drinks
- Nonalcoholic beverages
- Frozen treats or ice cream
- Other or I'm not sure

**Q8b. Additional offerings or specific menu interests** (optional, textarea)
- Label: "Additional menu interests (optional)"
- Placeholder: "e.g., 'Also interested in desserts if available' or 'Hoping for a vegetarian-friendly main option'"
- Shown unconditionally below the service type question

---

**Q9. How will guests pay for food and drink?** (required, single-select OptionCard, 4 options)
- The event host covers everything (host-paid)
- Guests pay individually at the truck
- A mix — some items covered, some purchased by guests
- I'm not sure yet

---

**Q10. Do you have a budget in mind for food service?** (optional, single-select OptionCard, 5 options)
- Under $500
- $500–$1,500
- $1,500–$3,000
- $3,000 or more
- Prefer not to say

*"Prefer not to say" is always available. Budget is omitted from the brief when "Prefer not to say" is selected.*

---

**Q11. Are there dietary or allergy considerations relevant to this event?** (optional, textarea)
- Label: "Dietary or allergy information (optional)"
- Placeholder: "e.g., 'Several guests are vegetarian' or 'Nut allergy awareness is needed for this group'"
- Inline caution below the field (`role="note"`): "Dietary and allergy information must be confirmed directly with the vendor. This inquiry does not guarantee any dietary accommodation."

---

**Q12. Roughly how many people do you expect to be served?** (optional, text input)
- Label: "Estimated guests to be served (optional)"
- Placeholder: "e.g., '150 of 300 guests are in the meal package' or 'All 75 guests'"
- Helper: "Only fill this in if it differs significantly from your total attendance."

---

**Q13. Are you looking for a one-time event or an ongoing arrangement?** (optional, single-select OptionCard, 3 options)
- One-time event service
- Ongoing or regular arrangement (e.g., weekly office lunch stop)
- I'm not sure yet

---

### Stage 3 — Venue and logistics

**Q14. Is there space for a food truck or trailer to set up?** (required, single-select OptionCard, 4 options)
- Yes — there is a dedicated setup area
- I believe so, but I'm not certain
- Space may be limited or shared with other vendors
- I'm not sure

---

**Q15. Is the location easily accessible for a large vehicle?** (optional, single-select OptionCard, 4 options)
- Yes — easy street or parking lot access
- Access may be tight (narrow entrance, low clearance, or rough terrain)
- Depends on vehicle size — I can share more details
- I'm not sure

---

**Q16. What type of surface will the vehicle be parked on?** (optional, single-select OptionCard, 4 options)
- Paved — asphalt or concrete
- Gravel or packed dirt
- Grass or turf
- I'm not sure

---

**Q17. Is electricity available at the setup location?** (optional, single-select OptionCard, 3 options)
- Yes
- No
- I'm not sure

---

**Q18. Is water access available at the setup location?** (optional, single-select OptionCard, 3 options)
- Yes
- No
- I'm not sure

---

**Q19. Venue restrictions, permits, or instructions we should know about** (optional, textarea)
- Label: "Venue restrictions or instructions (optional)"
- Placeholder: "e.g., 'Venue requires proof of liability insurance,' 'Vendor parking is behind the main building,' 'No amplified sound after 9pm'"
- Note below field: "Only share what the venue has communicated to you. The vendor is responsible for verifying their own permit, license, and compliance requirements."

---

**Q20. Day-of contact information** (optional, text input)
- Label: "On-site contact name and how to reach them (optional)"
- Placeholder: "e.g., 'Sarah M., event coordinator — she'll be at the main entrance'"
- Caution below field: "Don't include financial account numbers, passwords, or other sensitive information."

---

**Q21. How much time is needed for setup and breakdown?** (optional, single-select OptionCard, 5 options)
- About 30 minutes or less
- Up to 1 hour
- Up to 2 hours
- More than 2 hours needed
- I'm not sure

---

**Q22. Questions for the vendor** (optional, textarea)
- Placeholder: "Anything you'd like to ask or confirm before reaching out"

---

### Results screen — Organizer name

**Organizer name** (optional, text input)
- Label: "Your name (optional)"
- Placeholder: "e.g., Maria"
- Helper: "Used only to personalize the email greeting — not stored or sent by this tool."

---

## 6. Required versus optional fields

| # | Question | Stage | Type | Required |
|---|---|---|---|---|
| 1 | Event type | 1 | OptionCard (8) | ✅ |
| 2 | Event date | 1 | Date input | ✅ |
| 2b | Date notes | 1 | Text input | — |
| 3 | Location / venue name | 1 | Text input | ✅ |
| 4 | Public or private | 1 | OptionCard (3) | ✅ |
| 5 | Estimated attendance | 1 | OptionCard (6) | ✅ |
| 6 | Service window | 1 | OptionCard (6) | ✅ |
| 6b | Specific service hours | 1 | Text input | — |
| 7 | Indoor / outdoor | 1 | OptionCard (4) | — |
| 8 | Primary service type | 2 | OptionCard (9) | ✅ |
| 8b | Additional menu interests | 2 | Textarea | — |
| 9 | Payment arrangement | 2 | OptionCard (4) | ✅ |
| 10 | Budget | 2 | OptionCard (5) | — |
| 11 | Dietary / allergy notes | 2 | Textarea | — |
| 12 | Estimated guests served | 2 | Text input | — |
| 13 | Service frequency | 2 | OptionCard (3) | — |
| 14 | Setup space | 3 | OptionCard (4) | ✅ |
| 15 | Vehicle access | 3 | OptionCard (4) | — |
| 16 | Surface type | 3 | OptionCard (4) | — |
| 17 | Electricity | 3 | OptionCard (3) | — |
| 18 | Water access | 3 | OptionCard (3) | — |
| 19 | Venue restrictions | 3 | Textarea | — |
| 20 | Day-of contact | 3 | Text input | — |
| 21 | Setup & breakdown time | 3 | OptionCard (5) | — |
| 22 | Questions for the vendor | 3 | Textarea | — |
| — | Organizer name | Results | Text input | — |

**Nine required, 16 optional.** The minimum required path — 9 answers — produces a fully useful brief. Every required question offers a non-technical fallback ("Other or I'm not sure," "I'm not sure," etc.) so no organizer is blocked by a question they can't answer confidently.

---

## 7. Validation behavior by stage

### Stage 1 validation — advance blocked unless all 6 pass:
1. `answers.eventType !== ''` (OptionCard — truthy check)
2. `answers.eventDate.trim() !== ''` (text/date input — trim + non-empty check)
3. `answers.venueName.trim() !== ''` (text input — trim + non-empty check)
4. `answers.isPublic !== ''` (OptionCard — truthy check)
5. `answers.attendance !== ''` (OptionCard — truthy check)
6. `answers.serviceWindow !== ''` (OptionCard — truthy check)

### Stage 2 validation — advance blocked unless both pass:
1. `answers.serviceType !== ''` (OptionCard — truthy check)
2. `answers.paymentArrangement !== ''` (OptionCard — truthy check)

### Stage 3 validation — advance blocked unless:
1. `answers.setupSpace !== ''` (OptionCard — truthy check)

**On validation failure:**
- Error banner appears at the top of the stage with `role="alert"`.
- Page scrolls to top.
- `showErrors` flag activates field-level error indicators.
- Error clears as soon as the missing field is filled.

**Text input validation:** `trim()` before checking non-empty. Empty string after trim = invalid for required fields.

**No future-date enforcement on the event date.** The vendor assesses scheduling feasibility; the tool only captures what the organizer enters.

---

## 8. Conditional fields and branching

There are no hard-conditional fields that appear or disappear based on a previous OptionCard selection (no equivalent of the plumbing planner's `recentWorkDetail` that appears only when `recentWork === 'yes'`).

**Q2b** (date notes), **Q6b** (specific hours), and **Q8b** (additional menu interests) are **companion optional fields** — always visible below their parent questions, not toggled by any answer. This keeps the stage flow predictable and the implementation simple.

**Dietary caution** (Q11) and **venue restriction note** (Q19) are static informational `role="note"` elements — always visible, not conditional.

**Brief section suppression** (conditional in the results layer, not the form):
- "Venue & Logistics" section is always present (Q14 is always answered).
- "Questions for the Vendor" section is omitted entirely when Q22 is blank.
- Budget row is suppressed when Q10 = "Prefer not to say" or blank.
- Every other optional row is suppressed when blank.

---

## 9. Back navigation and Start Over behavior

| Action | Behavior |
|---|---|
| **Back button** | Moves to previous stage; `showErrors` clears; all answers preserved |
| **Back on Stage 1** | Back button disabled (no prior stage) |
| **Edit Answers** | Sets stage to 'event' (Stage 1); all answers preserved; `showErrors` clears |
| **Start Over (click)** | Opens ConfirmDialog |
| **ConfirmDialog → cancel** | Dialog closes; stays on current screen; all answers preserved |
| **ConfirmDialog → confirm** | Clears all answers to `EMPTY_FOOD_TRUCK_ANSWERS`; returns to Stage 1; `showErrors` clears |

---

## 10. Stage orchestrator structure

```typescript
type AppStage = 'event' | 'food' | 'venue' | 'results'

const STAGE_ORDER: AppStage[] = ['event', 'food', 'venue', 'results']

const STAGE_LABELS: Record<AppStage, string> = {
  event:   'Event basics',
  food:    'Food and service',
  venue:   'Venue and logistics',
  results: 'Your event service inquiry brief',
}

function validateStage(stage: AppStage, answers: FoodTruckAnswers): boolean {
  if (stage === 'event') {
    return !!(
      answers.eventType &&
      answers.eventDate.trim() &&
      answers.venueName.trim() &&
      answers.isPublic &&
      answers.attendance &&
      answers.serviceWindow
    )
  }
  if (stage === 'food') {
    return !!(answers.serviceType && answers.paymentArrangement)
  }
  if (stage === 'venue') {
    return !!answers.setupSpace
  }
  return true
}
```

**Header:** brand = "Your Mobile Food Business", sep = "›", title = "Food Truck Event Planner"

**Progress bar:** `step={stageIndex + 1}`, `totalSteps={3}`, `stepLabel={STAGE_LABELS[stage]}` — hidden on results screen.

**Final stage button label:** "Build My Event Brief →"

---

## 11. Complete results brief structure

```
FOOD TRUCK EVENT INQUIRY BRIEF
Prepared for: Your Mobile Food Business
Prepared by:  [organizer name, if provided]
Date:         [today's date, e.g., August 23, 2026]

THE EVENT
Event type:        [label]
Event date:        [formatted — e.g., Saturday, September 12, 2026]
Date notes:        [if provided]
Location or venue: [text]
Event status:      [Public / Private / I'm not sure]
Attendance:        [range label]
Service window:    [label]
Service hours:     [specific hours, if provided]
Setting:           [indoor/outdoor answer, if provided]

SERVICE REQUESTED
Service type:         [primary type label]
Additional interests: [if provided]
Payment arrangement:  [label]
Guests to be served:  [text, if provided]
Budget:               [label — omitted for "Prefer not to say" or blank]
Dietary notes:        [text, if provided]
Service arrangement:  [one-time/ongoing label, if provided]

VENUE & LOGISTICS
Setup space:        [label]
Vehicle access:     [label, if provided]
Surface type:       [label, if provided]
Electricity:        [label, if provided]
Water access:       [label, if provided]
Venue restrictions: [text, if provided]
Day-of contact:     [text, if provided]
Setup & breakdown:  [label, if provided]

QUESTIONS FOR THE VENDOR   [section omitted if Q22 blank]
[questions text]

—
This brief summarizes information prepared by the event organizer. It does
not confirm availability or reserve the date, guarantee menu items or
service capacity, establish pricing, confirm venue suitability, or confirm
permits, licenses, utilities, or other event requirements.
```

**Empty optional rows are suppressed.** A row is included only when the organizer provided an answer or typed text. No blank `dt`/`dd` pairs appear.

**"THE EVENT," "SERVICE REQUESTED," and "VENUE & LOGISTICS" are always present** (each contains at least one required field).

**"QUESTIONS FOR THE VENDOR" is omitted** when Q22 is blank.

---

## 12. Realistic example of a completed brief

```
FOOD TRUCK EVENT INQUIRY BRIEF
Prepared for: Your Mobile Food Business
Prepared by:  Jordan
Date:         August 23, 2026

THE EVENT
Event type:        Corporate or workplace event
Event date:        Friday, October 10, 2026
Location or venue: TechCo headquarters, North Austin campus
Event status:      Private — invitation-only or closed event
Attendance:        150–300 guests
Service window:    Lunch or midday service
Service hours:     11:30am–1:30pm
Setting:           Outdoors — open air

SERVICE REQUESTED
Service type:         Full meals or entrées
Additional interests: Would love a vegetarian main option if available
Payment arrangement:  The event host covers everything (host-paid)
Guests to be served:  Approximately 200 employees
Budget:               $1,500–$3,000
Dietary notes:        Several attendees keep vegetarian diets.
                      One confirmed nut allergy — please flag if nuts
                      are used in preparation.
Service arrangement:  One-time event service

VENUE & LOGISTICS
Setup space:        Yes — there is a dedicated setup area
Vehicle access:     Yes — easy street or parking lot access
Surface type:       Paved — asphalt or concrete
Electricity:        Yes
Water access:       I'm not sure
Venue restrictions: Vendor must sign a one-day venue agreement with
                    facilities. I'll send the form once you confirm
                    interest.
Day-of contact:     Marcus T., facilities lead — he'll be on-site
                    from 9am
Setup & breakdown:  Up to 1 hour

QUESTIONS FOR THE VENDOR
Can you accommodate a vegetarian main option, or do you have
suggestions for what would work well for a lunchtime corporate crowd?
Do you require a minimum spend for an event this size?

—
This brief summarizes information prepared by the event organizer. It does
not confirm availability or reserve the date, guarantee menu items or
service capacity, establish pricing, confirm venue suitability, or confirm
permits, licenses, utilities, or other event requirements.
```

---

## 13. Email subject and body rules

**Subject formula:** `Food Truck Event Inquiry – [event type label] · [formatted date]`

**Examples:**
- `Food Truck Event Inquiry – Corporate or workplace event · Friday, October 10, 2026`
- `Food Truck Event Inquiry – Birthday or personal celebration · Saturday, June 7, 2026`
- `Food Truck Event Inquiry – Other or I'm not sure · Sunday, November 2, 2026`

**Body:** URL-encoded full brief text, including all non-blank rows, the "QUESTIONS FOR THE VENDOR" section if present, and the disclaimer.

**Recipient:** Blank (`to = ''`) in the public demo. In client builds, the vendor's inquiry email address is the `to` parameter in `buildMailtoHref`.

**Button label on results screen:** "Email the Vendor →"

**mailto link caution on results screen:** "Opens your email app with your inquiry brief pre-filled."

---

## 14. Privacy and disclaimer wording

### Stage 1 privacy note (always shown on Stage 1, role="note")
> Your answers stay in your browser during this session — nothing is stored or transmitted.

### Dietary caution (Q11, always shown when field is visible, role="note")
> Dietary and allergy information must be confirmed directly with the vendor. This inquiry does not guarantee any dietary accommodation.

### Venue restriction note (Q19, always shown when field is visible)
> Only share what the venue has communicated to you. The vendor is responsible for verifying their own permit, license, and compliance requirements.

### Day-of contact caution (Q20)
> Don't include financial account numbers, passwords, or other sensitive information.

### Results-screen disclaimer (always present, role="note")

> This brief summarizes information prepared by the event organizer. It does not confirm availability or reserve the date, guarantee menu items or service capacity, establish pricing, confirm venue suitability, or confirm permits, licenses, utilities, or other event requirements. Contact [vendor name] directly to discuss the details of your event.

**The tool never:**
- Tells the organizer whether the venue is suitable for a food truck
- Instructs the organizer on permit requirements
- States what electrical or water specifications are needed
- Provides food safety guidance
- Implies the vendor can accommodate dietary restrictions
- Declares any arrangement confirmed or agreed upon
- Provides pricing guidance or estimates

---

## 15. Mobile and accessibility requirements

Identical to the existing plumbing planner standard:

- All OptionCard groups: `<fieldset>` + `<legend>` wrapping the radio group
- All text inputs and textareas: `<label>` with `for` attribute
- Validation errors: `role="alert"` on error banner; scroll to top on validation failure
- Privacy note, cautions, and disclaimer: `role="note"`
- Copy status live region: `role="status"`, `aria-live="polite"`, `aria-atomic="true"`
- Progress bar: `role="status"`
- All interactive controls: minimum 44×44px hit target
- No horizontal overflow at 320px, 375px, 390px, 768px, 1280px, or 1440px (all stages and results)
- `noindex, nofollow` meta tag on the HTML entry point
- `prefers-reduced-motion` respected via existing shared CSS

---

## 16. Services-page demo card concept

**Tag:** Live Demo
**Title:** Food Truck Event Planner
**Description:** A guided form that helps an event organizer prepare a clear service inquiry before reaching out to a mobile food or beverage vendor — covering the event, the food, and the venue logistics.
**Button:** Try the Demo →
**Link:** `/tools-food-truck-event`

**Layout note:** Adding a fourth card changes the demo grid from a natural three-column layout to a four-card grid. Options to handle this cleanly:

1. **Adjust `minmax`** — reduce from `minmax(240px, 1fr)` to `minmax(220px, 1fr)` so four cards fit in one row at ~980px+ content width. Works at desktop; cards stack to 2×2 at tablet width.
2. **Fixed 2-column grid at medium widths** — use `repeat(2, 1fr)` at the 580px breakpoint and `repeat(4, 1fr)` at a new 1100px breakpoint. Results in 2×2 on tablet and 4-column at wide desktop.
3. **Separate the suite card** — move Real Estate Client Tools to a distinct "Featured Suite" visual below the three demo cards. The three demo cards (bakery, plumbing, food truck) remain in a three-column row; the suite has its own wider presentation.
4. **Swap the order** — keep 3 demo cards visible; move one of the existing cards to a "Also available" line or supporting text.

**Recommended approach for Leslie's approval:** Option 3 — three demo-tool cards on one row + a distinct suite presentation below. This makes the Services page more scannable, keeps the three individual-tool demos visually equal, and gives the Real Estate suite a more prominent position that fits its larger scope. This requires minor TSX and CSS changes to the Services page (not part of this tool's implementation).

---

## 17. Clean URL and routing requirements

**Clean URL:** `/tools-food-truck-event`

**HTML entry point:** `tools-food-truck-event.html`

**Vercel rewrite (one new line in `vercel.json`):**
```json
{ "source": "/tools-food-truck-event", "destination": "/tools-food-truck-event.html" }
```

**Vite entry (one new line in `vite.config.ts`):**
```typescript
toolsFoodTruckEvent: fileURLToPath(new URL('./tools-food-truck-event.html', import.meta.url)),
```

**Routing test (one new entry in `test/routing.test.ts` REWRITES map):**
```typescript
'/tools-food-truck-event': '/tools-food-truck-event.html',
```
Plus one test asserting the clean URL loads the Food Truck Event Planner, brand = 'Your Mobile Food Business', progress = '1 of 3', no homepage hero.

---

## 18. Reusable patterns — no changes needed

| Pattern | Notes |
|---|---|
| `PlannerProgress` | `totalSteps={3}`; no changes |
| `OptionCard` | No changes |
| `ConfirmDialog` | No changes |
| `buildMailtoHref(to, subject, body)` | Blank `to` in public demo |
| `src/tools/tools.css` design tokens | No changes |
| Tool header, privacy note, error banner | Same patterns |
| `result-actions` action bar | Same controls and order (Copy · Share · Print · Edit Answers · Start Over) |
| `result-copy-status` live region | No changes |
| `tool-sales-cta` | Same structure |
| `tool-disclaimer` with `role="note"` | Same structure |
| `.no-print` | Same print suppression |
| `BriefSection` internal component pattern | Same pattern (filters empty rows, returns null if all rows empty) |
| Puppeteer test scaffolding | Same `before()` build + server + browser pattern |
| `noindex, nofollow` meta tag | Same pattern in HTML entry point |

---

## 19. New files and patterns needed

| New element | Description |
|---|---|
| `tools-food-truck-event.html` | HTML entry point; `noindex/nofollow`; root div `tools-food-truck-event-root`; title "Food Truck Event Planner" |
| `src/tools-food-truck-event-main.tsx` | React entry point; `createRoot` mounting `FoodTruckEventPlanner` |
| `src/tools/foodtruck/foodTruckTypes.ts` | All TypeScript union types, label maps, `FoodTruckAnswers` interface, `EMPTY_FOOD_TRUCK_ANSWERS` |
| `src/tools/foodtruck/foodTruckSummary.ts` | `buildInquiryBriefText(answers)`, `buildMailtoSubject(answers)` |
| `src/tools/foodtruck/stages/EventBasicsStage.tsx` | Stage 1: Q1–Q7 (event type, date, date notes, venue, public/private, attendance, service window, specific hours, indoor/outdoor) |
| `src/tools/foodtruck/stages/FoodAndServiceStage.tsx` | Stage 2: Q8–Q13 (service type, additional interests, payment, budget, dietary, guests served, frequency) |
| `src/tools/foodtruck/stages/VenueAndLogisticsStage.tsx` | Stage 3: Q14–Q22 (setup space, access, surface, electricity, water, restrictions, day-of contact, timing, questions) |
| `src/tools/foodtruck/FoodTruckResults.tsx` | Results screen: organizer name, email CTA, four brief sections, action bar, disclaimer, sales CTA |
| `src/tools/foodtruck/FoodTruckEventPlanner.tsx` | Orchestrator; `AppStage = 'event' \| 'food' \| 'venue' \| 'results'` |
| `test/tools/foodTruckEventPlanner.test.ts` | Focused test suite (estimate: ~130–150 tests) |
| **New CSS section in `src/tools/tools.css`** | `.food-truck-name-row`, `.food-truck-name-label`, `.food-truck-name-note`, `.food-truck-email-cta`, `.food-truck-email-btn`, `.food-truck-dietary-caution`, print rules |

**No new shared components needed.** All component patterns are reused from the existing plumbing and bakery planners.

**Date input note:** The existing bakery planner already uses `type="date"` for `neededByDate`. The same `tool-input--date` class and pattern can be reused. The `formatDate` utility in `bakerySummary.ts` should be extracted to a shared utility (or duplicated in `foodTruckSummary.ts`) since both tools need it.

---

## 20. Configurable elements for client deployments

| Item | How configured |
|---|---|
| Business / vendor name | Header brand, subject, disclaimer |
| Vendor inquiry email | `to` in `buildMailtoHref` |
| Event type list | `EVENT_TYPE_OPTIONS` array in `foodTruckTypes.ts` |
| Service type labels | `SERVICE_TYPE_LABELS` — e.g., a beverage-only trailer removes "Full meals" |
| Budget ranges | `BUDGET_LABELS` — adjust for client's typical event scale |
| Attendance ranges | `ATTENDANCE_LABELS` — adjust for client's typical event size |
| Dietary caution wording | Reviewed per client; any specific allergy policies noted by the business |
| Venue restriction note | Reviewed per client |
| Disclaimer wording | Reviewed per client; the five clauses in §14 are the baseline |
| Websites by Leslie CTA | Replaced or removed in client builds |

---

## 21. Testing and acceptance criteria

### Stage flow and validation
- [ ] Stage 1 does not advance without: event type, event date (non-empty), venue name (non-empty), public/private, attendance, service window
- [ ] Stage 2 does not advance without: primary service type, payment arrangement
- [ ] Stage 3 does not advance without: setup space
- [ ] All optional fields are genuinely optional — form advances without them
- [ ] Back navigation preserves all answers across all stages
- [ ] Start Over: dialog → cancel preserves all answers → confirm clears and returns to Stage 1
- [ ] Edit Answers returns to Stage 1 with all answers preserved

### Results brief
- [ ] Brief contains all provided answers
- [ ] Empty optional fields produce no blank rows (no blank `dt` or `dd` elements)
- [ ] "QUESTIONS FOR THE VENDOR" section absent when Q22 is blank
- [ ] Budget row absent when "Prefer not to say" selected
- [ ] Budget row absent when budget field is blank
- [ ] Dietary disclaimer absent from brief when Q11 is blank
- [ ] Brief disclaimer present; contains all five clauses from §14
- [ ] Brief contains no language implying confirmed availability, pricing, or compliance

### Email and actions
- [ ] mailto blank recipient in public demo (`to = ''`)
- [ ] Subject follows formula: "Food Truck Event Inquiry – [event type] · [formatted date]"
- [ ] Subject includes event type label
- [ ] Subject includes formatted date
- [ ] Body is full plain-text brief
- [ ] Copy writes to clipboard; live region announces success with `role="status"`, `aria-live="polite"`, `aria-atomic="true"`
- [ ] Share absent without `navigator.share`; functional and passes full brief when available
- [ ] Print triggers `window.print()`; action bar, email CTA, name row, and sales CTA have `.no-print`
- [ ] "Email the Vendor →" button is present on results screen
- [ ] mailto href contains blank `to` in public demo

### Technical and accessibility
- [ ] Page title: "Food Truck Event Planner"
- [ ] `noindex, nofollow` present in HTML entry point
- [ ] Privacy note on Stage 1 with `role="note"`
- [ ] Dietary caution has `role="note"`
- [ ] Every required question has at least one non-technical fallback answer ("I'm not sure," "Other or I'm not sure")
- [ ] `tsc --noEmit` clean
- [ ] `npm run build` clean
- [ ] No horizontal overflow at 320px, 375px, 390px, 768px, 1280px, 1440px on all stages and results
- [ ] All interactive elements ≥ 44px hit target
- [ ] All OptionCard groups have `<fieldset>` + `<legend>`
- [ ] Validation errors have `role="alert"`
- [ ] No localStorage or sessionStorage at any point
- [ ] No form elements with `action` attributes
- [ ] No network requests beyond page assets

### Routing and integration
- [ ] Clean URL `/tools-food-truck-event` resolves correctly
- [ ] `vercel.json` rewrite maps clean URL to HTML entry point
- [ ] Routing test passes: `/tools-food-truck-event` loads planner, brand = 'Your Mobile Food Business', progress = '1 of 3', no homepage hero
- [ ] Services page: food truck demo card present with link to `/tools-food-truck-event`
- [ ] All existing tools and routes remain unaffected
- [ ] Full regression suite passes

### Services page integration
- [ ] Food truck demo card is present with correct title and link
- [ ] No overflow on the Services page at any tested viewport
- [ ] All three existing demo cards (bakery, plumbing, real estate suite) still present and working

---

## 22. Decisions requiring Leslie's approval before implementation

| # | Decision | Options / recommendation |
|---|---|---|
| 1 | **Budget ranges** | Proposed: Under $500 / $500–$1,500 / $1,500–$3,000 / $3,000+ / Prefer not to say. Adjust if these don't match typical food truck event pricing. |
| 2 | **Event type list** | 8 options proposed — see §5 Q1. Any types to add, remove, or reword? |
| 3 | **Attendance ranges** | Proposed: <25 / 25–75 / 75–150 / 150–300 / 300+ / I'm not sure. Adjust for typical client audience sizes. |
| 4 | **Service window labels** | Proposed: Morning / Lunch or midday / Afternoon / Evening / Multiple or all day / I'm not sure. Adjust if client use cases require different granularity. |
| 5 | **Primary service type — single-select vs. multi-select** | Proposed: single-select OptionCard for primary type + optional textarea for additional interests. Multi-select checkboxes would be more accurate when an organizer wants both coffee and desserts, but requires a new component pattern. Which approach? |
| 6 | **Service frequency question (Q13)** | Proposed: include as optional (one-time / ongoing / not sure). Remove entirely if it feels out of place for an event-inquiry tool. |
| 7 | **Day-of contact field (Q20)** | Included as optional. This collects personal contact information about a third party (the on-site coordinator). Is this appropriate for a public demo? |
| 8 | **Companion text inputs for date (Q2b) and service hours (Q6b)** | Proposed: always-visible optional text companion below the parent question. Alternative: remove companions and rely on the textarea in Stage 2 for detail. |
| 9 | **Services page layout with 4 demo cards** | Three layout options described in §16. Recommendation: Option 3 (3 equal demo cards + separate suite presentation). Approve layout approach before implementation begins. |
| 10 | **Demo card description wording** | Proposed in §16 — approve or revise before implementation. |
| 11 | **Clean URL** | Proposed: `/tools-food-truck-event`. Alternatives: `/tools-food-truck-planner`, `/event-inquiry-planner`. |
| 12 | **Public demo brand name** | Proposed: "Your Mobile Food Business ›". Alternatives: "Your Food Truck ›", "Your Food Vendor ›". The chosen name should work generically across truck types without implying a specific business. |
| 13 | **Disclaimer wording** | Five clauses proposed in §14. Review and approve exact wording before implementation — treated as a contract, same as the plumbing planner's urgency notice. |
| 14 | **Sales CTA wording** | Following the bakery and plumbing CTA pattern: "Want an event inquiry planner like this for your business?" — confirm heading, body, and button text before implementation. |
| 15 | **`formatDate` utility** | Should this be extracted from `bakerySummary.ts` into a shared `src/tools/core/formatDate.ts` utility, or duplicated in `foodTruckSummary.ts` as the plumbing planner did with its own date formatting? Extracting is cleaner but changes a file outside this tool's scope. |

---

## Recommended final stage structure (summary)

```
Stage 1: Event basics
  ├── Event type              (required, OptionCard, 8 options)
  ├── Event date              (required, date input)
  ├── Date notes              (optional, text input)
  ├── Location / venue name   (required, text input)
  ├── Public or private       (required, OptionCard, 3 options)
  ├── Estimated attendance    (required, OptionCard, 6 options)
  ├── Service window          (required, OptionCard, 6 options)
  ├── Specific hours          (optional, text input)
  └── Indoor / outdoor        (optional, OptionCard, 4 options)

Stage 2: Food and service
  ├── Primary service type    (required, OptionCard, 9 options)
  ├── Additional interests    (optional, textarea)
  ├── Payment arrangement     (required, OptionCard, 4 options)
  ├── Budget                  (optional, OptionCard, 5 options)
  ├── Dietary / allergy notes (optional, textarea + caution note)
  ├── Estimated guests served (optional, text input)
  └── Service frequency       (optional, OptionCard, 3 options)

Stage 3: Venue and logistics
  ├── Setup space             (required, OptionCard, 4 options)
  ├── Vehicle access          (optional, OptionCard, 4 options)
  ├── Surface type            (optional, OptionCard, 4 options)
  ├── Electricity             (optional, OptionCard, 3 options)
  ├── Water access            (optional, OptionCard, 3 options)
  ├── Venue restrictions      (optional, textarea + venue note)
  ├── Day-of contact          (optional, text input + caution)
  ├── Setup & breakdown time  (optional, OptionCard, 5 options)
  └── Questions for vendor    (optional, textarea)

Results: Event Service Inquiry Brief
  ├── Organizer name          (optional, text input — brief/email only, not stored)
  ├── Email the Vendor →      (primary CTA, .no-print)
  ├── THE EVENT               (always present)
  ├── SERVICE REQUESTED       (always present)
  ├── VENUE & LOGISTICS       (always present)
  ├── QUESTIONS FOR THE VENDOR (conditional — omitted if blank)
  └── Action bar: Copy · Share · Print · Edit Answers · Start Over
```

---

## Proposed TypeScript interface (reference)

```typescript
interface FoodTruckAnswers {
  // Stage 1
  eventType:         EventType        // required
  eventDate:         string           // required, date string
  dateNotes:         string           // optional text
  venueName:         string           // required text
  isPublic:          PublicPrivate    // required
  attendance:        AttendanceRange  // required
  serviceWindow:     ServiceWindow    // required
  specificHours:     string           // optional text
  settingType:       SettingType      // optional
  // Stage 2
  serviceType:       ServiceType      // required
  additionalInterests: string         // optional text
  paymentArrangement: PaymentType     // required
  budget:            BudgetRange      // optional
  dietaryNotes:      string           // optional text
  guestsServed:      string           // optional text
  serviceFrequency:  FrequencyType    // optional
  // Stage 3
  setupSpace:        SetupSpaceType   // required
  vehicleAccess:     VehicleAccess    // optional
  surfaceType:       SurfaceType      // optional
  electricity:       UtilityAnswer    // optional
  waterAccess:       UtilityAnswer    // optional
  venueRestrictions: string           // optional text
  dayOfContact:      string           // optional text
  setupBreakdown:    SetupTime        // optional
  questions:         string           // optional text
  // Results
  organizerName:     string           // optional text
}
```

---

*This product map is complete and ready for Leslie's review. No files have been created, no code has been written, and no commits have been made. Implementation begins only after the decisions in §22 are approved.*
