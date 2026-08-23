# Plumbing Service Visit Planner — Product Map
*Approved 2026-08-23. Decisions recorded below supersede the original draft.*

---

## 1. Customer problems it solves

**For the homeowner:**
- Calling a plumber with no idea what to say — "there's something wrong with my pipes" leads to a long back-and-forth before a plumber can even determine whether to schedule a visit.
- Forgetting important details during a stressful phone call (when it started, which bathroom, whether it's happened before).
- Having to repeat themselves to a dispatcher, then again to the plumber, then again if another tech shows up.
- Not knowing what information a plumber actually needs — so they either over-share irrelevant details or under-share critical ones.
- Sending a vague email and waiting a long time for a response because the plumber can't give even a rough estimate of what's needed without more information.

**For the plumbing business:**
- Vague, low-information inquiry emails that require one or two follow-ups before a visit can even be considered.
- Customers who call describing symptoms with guessed causes ("I think there's a crack in the pipe") that steer the conversation in the wrong direction.
- Dispatchers who have to extract structured information in real time under call pressure.
- Service visits where the technician arrives without full context on the situation or access constraints.

---

## 2. What existing plumbing and field-service software already handles

The tool explicitly does not replace or compete with:

| Category | Examples | Why excluded |
|---|---|---|
| Dispatch and scheduling software | Jobber, ServiceTitan, Housecall Pro | Real-time booking, technician routing, calendar management |
| CRM / customer records | ServiceTitan, Fieldware | Customer history, account management, recurring service |
| Estimating and quoting | ResponsiBid, Jobber estimates | Pricing, scope approval, labor/material calculation |
| Field service management | ServiceTitan, mHelpDesk | Work orders, time tracking, invoicing |
| Emergency dispatch | 911, utility emergency lines | Life-safety response, gas/water shutoff coordination |
| Online booking widgets | Acuity, Calendly, Jobber booking | Appointment confirmation and availability |

---

## 3. Proposed signature experience

**Name:** Plumbing Service Visit Planner
**Public demo brand:** Your Plumbing Company ›
**One-sentence description:** A quick, guided form that helps you organize what you've observed so your plumber can arrive prepared.

**The signature:** A three-stage guided experience with plain-language, observational questions — not a diagnostic questionnaire. It asks what you *see, hear, and notice*, not what you think is wrong. It produces a clean, plain-text **Service Visit Brief** the homeowner can copy, print, share, or email to the plumber with one click. The brief is labeled explicitly as a description of observations, not a diagnosis, quote, or service confirmation.

**The feel:** Calm, clear, and fast. Modeled after the bakery planner's visual and interaction language — the same type family, design tokens, OptionCard components, progress bar, and result-screen pattern. Short enough for someone dealing with a stressful situation to finish in under four minutes.

---

## 4. Recommended customer journey and stages

**Recommendation: Three stages.** The homeowner may be stressed, dealing with an active drip, or already frustrated. Four stages is one too many. Three stages maps cleanly to the three things the plumber needs: *what is happening*, *where and when*, *what the visit looks like*.

| Stage | Title | Core purpose |
|---|---|---|
| 1 | What's happening? | Type of concern, observable symptoms, active-water status |
| 2 | Where and when? | Location, fixtures, timeline, change over time, history, water elsewhere |
| 3 | About your home and the visit | Property type, access, recent work, timing preference, questions |

**Results screen:** Service Visit Brief with Copy, Print, Share, and Email controls. Optional name field for email personalization. Websites by Leslie sales CTA.

**Safety notice:** Inline contextual banner — not a separate stage, not a blocking screen. Appears on Stage 1 when the customer selects "water is actively flowing or spreading." Non-blocking, `role="note"`. Does not classify severity or provide shutoff instructions.

---

## 5. Exact information collected at each stage

### Stage 1 — What's happening?

**1. Type of concern** (required, single-select OptionCard, 9 options)
- No hot water or inconsistent water temperature
- Low or no water pressure
- Slow or blocked drain
- Water backing up or overflowing
- Leak, drip, or unexplained damp spot
- Running or constantly refilling toilet
- Unusual smell or change in water color
- Water heater leak, noise, or other concern
- Something else or I'm not sure

**2. What are you observing?** (optional, textarea)
- Label: "What can you see, hear, or smell? (optional)"
- Placeholder: "Describe what you're noticing in your own words — you don't need to identify the cause."
- Helper: "For example: 'There's a dripping sound under the kitchen sink' or 'The water coming out looks slightly orange.'"

**3. Is water currently running, dripping, or collecting somewhere it shouldn't be?** (required, single-select OptionCard, 4 options)
- Yes — water is actively flowing or spreading
- Yes — a slow or controlled drip
- No — no active water visible right now
- I'm not sure

→ If "actively flowing or spreading" is selected: inline urgency notice appears (see §9).

---

### Stage 2 — Where and when?

**4. Where in your home is the issue?** (required, single-select OptionCard, 8 options)
- Kitchen
- Main bathroom
- Second or additional bathroom
- Laundry room or utility area
- Basement or crawl space
- Outdoors or yard area
- Throughout the home / multiple areas
- I'm not sure

**5. Any specific fixture or area you can point to?** (optional, text input)
- Placeholder: "e.g., kitchen sink, upstairs shower, water heater, outdoor spigot"

**6. When did you first notice this?** (required, single-select OptionCard, 5 options)
- Today
- Within the last few days
- About a week or two ago
- More than two weeks ago
- I'm not sure

**7. Has the situation changed since you first noticed it?** (required, single-select OptionCard, 5 options)
- It seems to be getting worse
- About the same
- It comes and goes
- It may be settling on its own
- I'm not sure

**8. Has something like this happened before?** (required, single-select OptionCard, 4 options)
- Yes — the same issue has come back
- Something similar, but this seems different
- No — this is the first time
- I'm not sure

**9. Can you use water normally in other areas of your home?** (required, single-select OptionCard, 4 options)
- Yes — everything else seems normal
- Partially — some other areas are also affected
- No — water seems unavailable or off throughout
- I haven't checked yet

---

### Stage 3 — About your home and the visit

**10. What type of property is it?** (required, single-select OptionCard, 5 options)
- Single-family home
- Condo or apartment
- Townhouse or duplex
- Mobile or manufactured home
- Other / I'm not sure

**11. Is the affected area easy to access?** (optional, single-select OptionCard, 4 options)
- Yes, easy to reach
- I may need to move some things first
- Access could be tricky (e.g., crawl space, tight area)
- I'm not sure

**12. Anything the plumber should know about access?** (optional, textarea, compact)
- Label: "Access notes (optional)"
- Placeholder: "e.g., 'Friendly dog in yard,' 'I'll need to notify building management,' 'Narrow driveway'"
- Caution: "For your privacy, don't include gate codes, alarm codes, account numbers, or other private access information."

**13. Any plumbing work done in the past year?** (required, single-select OptionCard, 3 options)
- Yes → conditional optional text input: "Please briefly describe what was done, if you know. Don't include account, invoice, or payment information."
- No
- I'm not sure

**14. Preferred timing for the visit** (optional, single-select OptionCard, 4 options)
- As soon as possible
- Within the next few days
- I'm flexible
- I'm only gathering information right now

Note: labeled as a preference, not an appointment request.

**15. Questions or anything else for the plumber?** (optional, textarea)
- Placeholder: "Anything you'd like to ask or flag ahead of the visit"

---

## 6. Required versus optional questions

| # | Question | Required |
|---|---|---|
| 1 | Type of concern | ✅ |
| 2 | What are you observing? | Optional |
| 3 | Active water status | ✅ |
| 4 | Where in your home | ✅ |
| 5 | Specific fixture or area | Optional |
| 6 | When first noticed | ✅ |
| 7 | How it has changed | ✅ |
| 8 | Has this happened before | ✅ |
| 9 | Water available elsewhere | ✅ |
| 10 | Property type | ✅ |
| 11 | Ease of access | Optional |
| 12 | Access notes | Optional |
| 13 | Recent plumbing work | ✅ |
| 14 | Preferred timing | Optional |
| 15 | Questions for the plumber | Optional |

**Nine required, six optional.** The minimum path produces a fully useful brief.

Every required question provides a truthful non-technical option for customers who cannot confidently answer it ("I'm not sure," "I haven't checked yet," "Something else or I'm not sure," or "Other / I'm not sure").

---

## 7. Functions combined into the experience

- **Symptom capture:** What the customer sees, hears, and smells — without asking them to interpret it.
- **Triage context:** Active-water status helps the plumber prioritize before calling back.
- **Location mapping:** Room and fixture detail without requiring plumbing knowledge.
- **Timeline capture:** When it started, how it's changed — establishes urgency pattern.
- **Recurrence flag:** Identifies recurring issues from new ones.
- **Property and access briefing:** Reduces job-site surprises.
- **Service history note:** Recent prior work is relevant context for the plumber.
- **Visit preference capture:** Not a booking — just information the scheduler finds useful.
- **Customer questions:** Surfaces questions before the visit rather than during it.
- **Brief generation:** Turns answers into a plain-text summary the plumber can read at a glance.
- **Inquiry channel:** Email CTA sends the brief directly to the plumber (or in the demo, blank recipient).

---

## 8. Explicit out-of-scope list

- Diagnosing the cause of the plumbing issue
- Telling the customer what is wrong, likely wrong, or probably wrong
- Instructing the customer to turn off the water main, shut off a valve, or take any physical action
- Declaring any situation safe, low-risk, or not urgent
- Estimating repair cost, time, or scope
- Promising arrival times or availability windows
- Confirming, scheduling, or booking a service appointment
- Accepting payments or payment information
- Generating work orders or service tickets
- Requesting account numbers, utility numbers, access codes, or sensitive credentials
- Uploading photos, videos, or documents
- Creating customer accounts or stored sessions
- Providing DIY repair guidance of any kind
- Replacing dispatch, CRM, or field-service software
- Storing or transmitting customer answers beyond the current browser session

---

## 9. Safety and urgency wording strategy

**The principle:** The tool may surface a calm, factual notice when answers suggest a potentially urgent situation. It must not classify severity, give shutoff instructions, or declare anything safe or unsafe.

**Trigger condition:** The urgency notice appears on Stage 1 when the customer selects "Yes — water is actively flowing or spreading" for question 3.

**Approved urgency notice wording (exact — do not alter without Leslie's approval):**

> If water is actively flowing or spreading, contact a licensed plumber or emergency plumbing service directly. You do not need to finish this planner first. If anyone may be in immediate danger, contact local emergency services.

**Design:** Distinct styling — amber border and translucent amber background, `role="note"` (informational, not a form error), inline below the active-water question. Does not prevent advancing. Does not auto-redirect.

**In the brief:** If "actively flowing or spreading" was selected, the brief includes: "⚠ Active water noted: Water was actively flowing or spreading at the time this brief was prepared." This is factual — it describes what the customer selected, not a severity assessment.

**Results disclaimer (always present):**

> This brief summarizes what you've observed. It is not a plumbing diagnosis, repair estimate, or confirmed service request. Contact [business name] directly to discuss availability, scheduling, and next steps.

**The tool never says:**
- "This is not an emergency"
- "This is an emergency"
- "You can wait"
- "Turn off your water main"
- "Shut off the valve under the sink"
- "This is safe" or "This is dangerous"
- "You need a [specific type of repair]"

---

## 10. Structure of the final Service Visit Brief

```
PLUMBING SERVICE VISIT BRIEF
Prepared for: [Business Name]
Prepared by: [Customer Name, if provided]
Date: [generated date]

THE CONCERN
Type of concern:       [selected type]
What I observed:       [description, if provided]
Active water present:  [selected answer]
⚠ Active water noted: Water was actively flowing or spreading at the time
                       this brief was prepared. [conditional — flowing/spreading only]

LOCATION & HISTORY
Area of home:          [selected]
Fixture or area:       [if provided]
First noticed:         [when answer]
Change since then:     [change answer]
Previous occurrence:   [history answer]
Water available elsewhere: [elsewhere answer]

PROPERTY & ACCESS
Property type:         [type]
Access:                [ease-of-access answer, if provided]
Access notes:          [notes, if provided]
Recent plumbing work:  [yes/no/not sure + detail if provided]

THE VISIT
Preferred timing:      [if provided]
Questions for the plumber:
  [questions text, if provided]

—
This brief summarizes what I've observed. It is not a diagnosis,
estimate, or confirmed service request.
```

Empty optional rows are suppressed. "THE VISIT" section is omitted when no timing preference or questions are provided.

---

## 11. Realistic example of a completed brief

```
PLUMBING SERVICE VISIT BRIEF
Prepared for: Riverside Plumbing
Prepared by: Karen
Date: August 23, 2026

THE CONCERN
Type of concern:       Slow or blocked drain
What I observed:       The water drains very slowly in the upstairs bathroom
                       sink — it pools for a few minutes before going down.
                       There's also a faint smell sometimes.
Active water present:  No — no active water visible right now

LOCATION & HISTORY
Area of home:          Second or additional bathroom
Fixture or area:       Upstairs hall bathroom sink
First noticed:         About a week or two ago
Change since then:     It seems to be getting worse
Previous occurrence:   No — this is the first time
Water available elsewhere: Yes — everything else seems normal

PROPERTY & ACCESS
Property type:         Single-family home
Access:                Yes, easy to reach
Recent plumbing work:  No

THE VISIT
Preferred timing:      Within the next few days
Questions for the plumber:
  Could this be connected to the vent on the roof? We had a bird issue
  up there last fall and I wondered if it's related.

—
This brief summarizes what I've observed. It is not a diagnosis,
estimate, or confirmed service request.
```

---

## 12. Copy, Print, Share, and Email behavior

| Action | Behavior |
|---|---|
| **Copy Brief** | `navigator.clipboard.writeText()`. Live region announces "Brief copied to clipboard." |
| **Print Brief** | `window.print()`. Action bar, email CTA, name row, and sales CTA carry `.no-print`. |
| **Share Brief** | Conditional — only when `navigator.share` is available. Passes plain-text brief. |
| **Email the Plumber** | `<a href="mailto:?subject=...&body=...">` with blank recipient in public demo. Subject: "Plumbing Service Visit Brief – [concern type]". Body: URL-encoded full brief. |

Optional customer name field on results screen — used only in "Prepared by:" line and email. Not stored.

---

## 13. Privacy model

- All state in React `useState` — browser session only.
- No localStorage, no sessionStorage.
- No network requests beyond page assets.
- No form submissions with server destinations.
- Public demo: blank mailto recipient (`mailto:?`).
- Privacy notice on Stage 1: `role="note"`.
- Access notes carry a privacy caution (see §5, question 12).

---

## 14. Accessibility and mobile requirements

- All radio groups: `<fieldset>` + `<legend>`.
- Validation errors: `role="alert"`.
- Privacy note and disclaimer: `role="note"`.
- Urgency notice: `role="note"`.
- Copy status live region: `role="status"`, `aria-live="polite"`, `aria-atomic="true"`.
- Progress bar: `role="status"`.
- All interactive elements minimum 44×44px.
- No horizontal overflow at 320px, 375px, 390px, 768px, 1440px.
- `noindex, nofollow` meta tag.
- `prefers-reduced-motion` via existing shared CSS.

---

## 15. Where the tool belongs on a plumber's website

**Primary:** Dedicated page linked from "Contact" / "Request Service." Label: "Prepare for Your Visit" or "Service Visit Planner."

**Secondary:** "Before You Call" button on contact page; inline CTA on service-type pages; auto-response email link after a contact form submission.

**Not suitable for:** Homepage hero; footer link alone.

---

## 16. How it leads naturally to a service inquiry

Results screen primary CTA: email link. In client deployments, the plumber's address is the `to` parameter in `buildMailtoHref`. The brief becomes the pre-filled email body. Copy, Print, and Share provide alternate inquiry channels.

Websites by Leslie sales CTA follows the same pattern as the bakery planner.

---

## 17. Existing foundations that can be reused without changes

| Component / pattern | Notes |
|---|---|
| `PlannerProgress` | Stage count 3; no other change |
| `OptionCard` | No changes |
| `ConfirmDialog` | No changes |
| `buildMailtoHref(to, subject, body)` | Blank `to` in demo |
| `src/tools/tools.css` design tokens | No changes |
| Tool header, privacy note, error banner, result layout | Same patterns |
| `result-actions` action bar | Same controls and order |
| `result-copy-status` live region | No changes |
| `tool-sales-cta` | Same structure |
| `tool-disclaimer` | Same structure |
| `.no-print` | Same print suppression |
| Vite multi-entry build | One new entry |
| `vercel.json` rewrite pattern | One new line |
| `test/routing.test.ts` | One new REWRITES entry + one test |
| Puppeteer test pattern | Same as bakery test file |

---

## 18. New plumbing-specific components or logic needed

| New element | Description |
|---|---|
| `.plumbing-urgency-notice` | Inline conditional banner; amber border/background; `role="note"`; non-blocking. New CSS in `tools.css`. |
| `plumbingTypes.ts` | All union types, label maps, `PlumbingAnswers` interface, `EMPTY_PLUMBING_ANSWERS`. |
| `plumbingSummary.ts` | `buildVisitBriefText()`, `buildMailtoSubject()`, conditional urgency line, section suppression. |
| Stage components (3) | `WhatIsHappeningStage.tsx`, `WhereAndWhenStage.tsx`, `AboutYourHomeStage.tsx`. |
| `PlumbingResults.tsx` | Name field, email CTA, four result sections, urgency flag, disclaimer, sales CTA. |
| `PlumbingVisitPlanner.tsx` | Orchestrator; `AppStage = 'what' \| 'where' \| 'home' \| 'results'`. |
| Conditional recent-work text input | Appears when "Yes" selected for question 13; reverse of bakery's inscription toggle. |

---

## 19. What should be configurable for each plumbing business

| Configurable item | How configured |
|---|---|
| Business name | Header brand, subject, disclaimer, CTA |
| Plumber's email address | `to` in `buildMailtoHref` |
| Concern type list | `CONCERN_TYPE_OPTIONS` array |
| Urgency notice wording | Approved per client; reviewed for local regulations |
| Urgency contact number | Optional addition for clients with an emergency line |
| Disclaimer wording | Reviewed per client |
| Visit timing options | Can trim for businesses without flexible scheduling |
| Websites by Leslie CTA | Replaced or removed in client builds |

---

## 20. Focused MVP

All 15 questions, inline urgency notice, full results screen, Copy/Print/Share/Email, optional customer name, Websites by Leslie CTA, noindex, privacy notice, clean-URL route.

**Not in MVP:** Photo uploads, multi-location multi-select, scheduling calendar, saved sessions.

---

## 21. MVP acceptance criteria

**Stage flow and validation:**
- [ ] Stage 1 does not advance without concern type and active water status
- [ ] Stage 2 does not advance without home area, first-noticed, change, history, water-elsewhere
- [ ] Stage 3 does not advance without property type and recent-work
- [ ] All optional fields are genuinely optional
- [ ] Back navigation preserves all answers
- [ ] Start Over: dialog → cancel preserves results → confirm clears and returns to Stage 1
- [ ] Edit Answers returns to Stage 1 with all answers preserved

**Safety notice:**
- [ ] Urgency notice appears for "actively flowing or spreading" only
- [ ] Urgency notice does not appear for any other active-water answer
- [ ] Urgency notice does not block form advancement
- [ ] Urgency notice has `role="note"`
- [ ] Urgency notice uses approved wording verbatim
- [ ] Urgency notice contains no shutoff instructions or severity classification
- [ ] "⚠ Active water noted" line in brief when flowing/spreading selected; absent otherwise

**Results brief:**
- [ ] Brief contains all provided answers
- [ ] Empty optional fields produce no blank rows
- [ ] "THE VISIT" section absent when no timing or questions provided
- [ ] "What I observed," "Fixture or area," "Access," "Access notes" rows absent when blank
- [ ] Brief explicitly labeled as not a diagnosis, estimate, or service confirmation
- [ ] Brief contains no language implying what the plumber will bring or find

**Email and actions:**
- [ ] mailto blank recipient in public demo
- [ ] Subject contains "Plumbing Service Visit Brief" and concern type
- [ ] Body is full plain-text brief
- [ ] Copy writes to clipboard; live region announces success
- [ ] Share absent without `navigator.share`; functional with it
- [ ] Print triggers `window.print()`; action controls and CTA have `.no-print`

**Technical and accessibility:**
- [ ] Page title: "Plumbing Service Visit Planner"
- [ ] `noindex, nofollow` present
- [ ] Privacy note on Stage 1, `role="note"`
- [ ] Every required question provides a non-technical fallback answer
- [ ] `tsc --noEmit` clean
- [ ] `npm run build` clean
- [ ] No overflow at 320px–1440px on all stages and results
- [ ] All interactive elements ≥44px
- [ ] All radio groups have `<fieldset>` + `<legend>`
- [ ] Validation errors have `role="alert"`
- [ ] No localStorage or sessionStorage
- [ ] No form elements with `action` attributes
- [ ] Clean URL `/tools-plumbing-visit` resolves; vercel.json + routing test pass
- [ ] Services page: two-card layout shows both planners with working links
- [ ] Full regression suite passes

---

## 22. Risks, ambiguous areas, and ways to prevent scope creep

| Risk | Prevention |
|---|---|
| Diagnosis creep in wording | Every label and brief line describes an observation, not an interpretation |
| Safety instruction creep | No shutoff or action instructions; tool points to professionals only |
| Scheduling creep | Timing preference is explicitly non-binding; booking is a separate system |
| Photo upload requests | Out of scope in every version |
| Quote/estimate requests | No pricing, no estimation; brief says so explicitly |
| Multi-tool fragmentation | Single tool covers all concern types |
| Urgency notice tone drift | Wording is locked; treat as a contract, not improvised copy |
| Brief becomes a report | Brief sections describe only what the customer selected or typed |

---

## 23. Recommended customer-facing name and one-sentence description

**Name:** Plumbing Service Visit Planner

**One-sentence description:** Answer a few quick questions about what you're seeing, and we'll prepare a clear summary you can share with your plumber before the visit.

---

## 24. Approved decisions summary

| # | Decision | Approved value |
|---|---|---|
| 1 | Urgency notice wording | See §9 — verbatim, do not alter |
| 2 | Clean URL | `/tools-plumbing-visit` |
| 3 | Public demo brand | Your Plumbing Company › |
| 4 | "I'm not sure" policy | Every required question has a non-technical fallback; not mechanically required on all |
| 5 | Concern type list | Nine options — see §5 |
| 6 | Recent-work detail | Keep; use approved caution text (see §5, Q13) |
| 7 | Access-note caution | "For your privacy, don't include gate codes, alarm codes, account numbers, or other private access information." |
| 8 | Timing options | Four options; no evenings/weekends; labeled as preference not appointment |
| 9 | Services page | Responsive two-card layout; room for third card; bakery + plumbing |
| 10 | Websites by Leslie CTA | "Want a service visit planner like this for your business?" — see §16 |

---

## Recommended final stage structure

```
Stage 1: What's happening?
  ├── Type of concern          (required, OptionCard, 9 options)
  ├── What are you observing?  (optional, textarea)
  └── Active water status      (required, OptionCard, 4 options)
        └── Urgency notice     (conditional, inline, role="note")

Stage 2: Where and when?
  ├── Area of home             (required, OptionCard, 8 options)
  ├── Specific fixture/area    (optional, text input)
  ├── When first noticed       (required, OptionCard, 5 options)
  ├── Change since then        (required, OptionCard, 5 options)
  ├── Has this happened before (required, OptionCard, 4 options)
  └── Water available elsewhere(required, OptionCard, 4 options)

Stage 3: About your home and the visit
  ├── Property type            (required, OptionCard, 5 options)
  ├── Ease of access           (optional, OptionCard, 4 options)
  ├── Access notes             (optional, textarea, small)
  ├── Recent plumbing work     (required, OptionCard, 3 options)
  │     └── Work detail        (conditional optional, text input when Yes)
  ├── Preferred timing         (optional, OptionCard, 4 options)
  └── Questions for plumber    (optional, textarea)

Results: Service Visit Brief
  ├── Customer name            (optional, text input — brief/email only, not stored)
  ├── Email the Plumber →      (primary CTA, .no-print)
  ├── THE CONCERN              (always present)
  ├── LOCATION & HISTORY       (always present)
  ├── PROPERTY & ACCESS        (always present)
  ├── THE VISIT                (conditional — omitted if no timing or questions)
  └── Action bar: Copy · Print · Share · Edit Answers · Start Over
```

---

## Proposed fields (summary reference)

| Field | Stage | Type | Required |
|---|---|---|---|
| Type of concern | 1 | OptionCard (9) | ✅ |
| What are you observing? | 1 | Textarea | — |
| Active water status | 1 | OptionCard (4) | ✅ |
| Area of home | 2 | OptionCard (8) | ✅ |
| Specific fixture or area | 2 | Text input | — |
| When first noticed | 2 | OptionCard (5) | ✅ |
| Change since then | 2 | OptionCard (5) | ✅ |
| Has this happened before | 2 | OptionCard (4) | ✅ |
| Water available elsewhere | 2 | OptionCard (4) | ✅ |
| Property type | 3 | OptionCard (5) | ✅ |
| Ease of access | 3 | OptionCard (4) | — |
| Access notes | 3 | Textarea (compact) | — |
| Recent plumbing work | 3 | OptionCard (3) | ✅ |
| Recent work detail | 3 | Text input (conditional) | — |
| Preferred timing | 3 | OptionCard (4) | — |
| Questions for plumber | 3 | Textarea | — |
| Customer name (results) | Results | Text input | — |

---

## Proposed results sections

| Section | Condition |
|---|---|
| **THE CONCERN** — type, observation, active water, urgency flag | Always present |
| **LOCATION & HISTORY** — area, fixture, timeline, change, history, elsewhere | Always present |
| **PROPERTY & ACCESS** — type, access, notes, recent work | Always present |
| **THE VISIT** — timing, questions | Only if timing or questions provided |

---

## Concise acceptance-criteria checklist

- [ ] 3-stage flow; progress shows "1 of 3," "2 of 3," "3 of 3"
- [ ] 9 required questions enforced; all others genuinely optional
- [ ] Every required question has a non-technical fallback answer
- [ ] Urgency notice: appears for flowing/spreading only; approved wording verbatim; `role="note"`; non-blocking; no shutoff instructions
- [ ] Urgency flag in brief when flowing/spreading selected; absent otherwise
- [ ] Back nav preserves all answers; Start Over clears all
- [ ] Brief: all provided answers present; no blank rows; "THE VISIT" suppressed when empty
- [ ] Brief disclaimer present; no diagnostic, severity, or equipment-guarantee language
- [ ] mailto blank recipient; subject includes concern type; body is full brief
- [ ] Copy/Print/Share/Email all functional per existing pattern
- [ ] noindex + privacy note; no storage or network requests
- [ ] No overflow at 320px–1440px on all stages and results
- [ ] Touch targets ≥44px; radio groups fieldset+legend
- [ ] TypeScript clean; production build clean
- [ ] Clean URL `/tools-plumbing-visit` resolves; vercel.json + routing test pass
- [ ] Services page: responsive two-card layout, both links work
- [ ] Full regression suite passes

---

## Decisions requiring approval before any future revision

All items in §24. Urgency notice wording in §9 is locked — do not alter without Leslie's explicit approval.
