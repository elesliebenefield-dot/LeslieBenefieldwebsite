import { useState } from 'react'
import { ConfirmDialog } from '../../../core/components/ConfirmDialog'
import type {
  EventOutcomes,
  VisitorRecord,
  AttendanceOutcome,
  VisitorContext,
  FollowUpPermission,
  ContactMethod,
} from '../openHouseTypes'
import {
  ATTENDANCE_LABELS,
  VISITOR_CONTEXT_LABELS,
  PERMISSION_LABELS,
  CONTACT_METHOD_LABELS,
  MAX_VISITORS,
  makeEmptyVisitor,
  makeOhId,
} from '../openHouseTypes'

interface Props {
  outcomes: EventOutcomes
  onChange: (o: EventOutcomes) => void
  onNext: () => void
  onBack: () => void
}

interface VisitorCardProps {
  visitor: VisitorRecord
  index: number
  onUpdate: (v: VisitorRecord) => void
  onRemove: () => void
}

function VisitorCard({ visitor, index, onUpdate, onRemove }: VisitorCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState(false)

  function field<K extends keyof VisitorRecord>(key: K, val: VisitorRecord[K]) {
    onUpdate({ ...visitor, [key]: val })
  }

  const cardId = `oh-visitor-${visitor.id}`
  const isDeclined = visitor.permission === 'declined'

  return (
    <div className="oh-visitor-card" data-visitor-id={visitor.id}>
      <div className="oh-visitor-card-header">
        <span className="oh-visitor-card-title">
          Record {index + 1}{visitor.label ? `: ${visitor.label}` : ''}
        </span>
        <div className="oh-visitor-card-controls">
          <button
            type="button"
            className="listing-task-card__edit-btn"
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            aria-controls={cardId}
          >
            {expanded ? 'Collapse' : 'Edit'}
          </button>
          <button
            type="button"
            className="listing-task-card__remove-btn"
            onClick={() => setConfirmRemove(true)}
            aria-label={`Remove visitor record ${index + 1}`}
          >
            Remove
          </button>
        </div>
      </div>

      {isDeclined && (
        <div className="oh-declined-notice" role="note">
          Permission is recorded as Declined. No outreach should be planned for this record.
        </div>
      )}

      {expanded && (
        <div id={cardId} className="oh-visitor-card-body">
          {/* Label */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-visitor-label-${visitor.id}`}>
              Name, initials, or neutral label
            </label>
            <p className="oh-field-hint oh-privacy-caution">
              Do not enter protected-class, financial, highly sensitive, or unnecessary personal information.
            </p>
            <input
              id={`oh-visitor-label-${visitor.id}`}
              type="text"
              className="tool-input"
              value={visitor.label}
              onChange={e => field('label', e.target.value)}
              placeholder="e.g. A. Johnson, or Visitor 3"
            />
          </div>

          {/* Context */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-visitor-context-${visitor.id}`}>Visitor context</label>
            <select
              id={`oh-visitor-context-${visitor.id}`}
              className="tool-input oh-select"
              value={visitor.context}
              onChange={e => field('context', e.target.value as VisitorContext)}
            >
              <option value="">Not recorded</option>
              {(Object.entries(VISITOR_CONTEXT_LABELS) as [VisitorContext, string][])
                .filter(([k]) => k !== '')
                .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Follow-up permission */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-visitor-permission-${visitor.id}`}>Follow-up permission</label>
            <select
              id={`oh-visitor-permission-${visitor.id}`}
              className="tool-input oh-select"
              value={visitor.permission}
              onChange={e => field('permission', e.target.value as FollowUpPermission)}
            >
              <option value="">Not recorded</option>
              {(Object.entries(PERMISSION_LABELS) as [FollowUpPermission, string][])
                .filter(([k]) => k !== '')
                .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {visitor.permission === 'unknown' && (
              <p className="oh-permission-note" role="note">
                Permission is unknown. Confirm applicable requirements and brokerage policies before any outreach.
              </p>
            )}
            {visitor.permission === 'declined' && (
              <p className="oh-permission-note oh-permission-note--declined" role="note">
                This record is marked Declined. No visitor outreach should be planned through this tool.
              </p>
            )}
          </div>

          {/* Contact method */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-visitor-contact-${visitor.id}`}>Preferred contact method</label>
            <select
              id={`oh-visitor-contact-${visitor.id}`}
              className="tool-input oh-select"
              value={visitor.contactMethod}
              onChange={e => field('contactMethod', e.target.value as ContactMethod)}
            >
              <option value="">Not recorded</option>
              {(Object.entries(CONTACT_METHOD_LABELS) as [ContactMethod, string][])
                .filter(([k]) => k !== '')
                .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* What they requested */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-visitor-requested-${visitor.id}`}>
              What they requested <span className="oh-optional">(optional)</span>
            </label>
            <textarea
              id={`oh-visitor-requested-${visitor.id}`}
              className="tool-input oh-textarea oh-textarea--sm"
              value={visitor.requested}
              onChange={e => field('requested', e.target.value)}
              placeholder="Information, documents, or follow-up they asked for"
              rows={2}
            />
          </div>

          {/* Questions */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-visitor-questions-${visitor.id}`}>
              Questions to answer <span className="oh-optional">(optional)</span>
            </label>
            <textarea
              id={`oh-visitor-questions-${visitor.id}`}
              className="tool-input oh-textarea oh-textarea--sm"
              value={visitor.questions}
              onChange={e => field('questions', e.target.value)}
              placeholder="Questions that need a response"
              rows={2}
            />
          </div>

          {/* Property feedback */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-visitor-feedback-${visitor.id}`}>
              Property feedback <span className="oh-optional">(optional)</span>
            </label>
            <textarea
              id={`oh-visitor-feedback-${visitor.id}`}
              className="tool-input oh-textarea oh-textarea--sm"
              value={visitor.feedback}
              onChange={e => field('feedback', e.target.value)}
              placeholder="Their observations or reactions to the property"
              rows={2}
            />
          </div>

          {/* Notes */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-visitor-notes-${visitor.id}`}>
              Notes <span className="oh-optional">(optional)</span>
            </label>
            <textarea
              id={`oh-visitor-notes-${visitor.id}`}
              className="tool-input oh-textarea oh-textarea--sm"
              value={visitor.notes}
              onChange={e => field('notes', e.target.value)}
              placeholder="Any other planning notes for this record"
              rows={2}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Remove this visitor record?"
        body="This record will be removed and cannot be recovered."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={onRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  )
}

export function EventOutcomesStage({ outcomes, onChange, onNext, onBack }: Props) {
  function field<K extends keyof EventOutcomes>(key: K, val: EventOutcomes[K]) {
    onChange({ ...outcomes, [key]: val })
  }

  function addVisitor() {
    if (outcomes.visitors.length >= MAX_VISITORS) return
    const id = makeOhId()
    field('visitors', [...outcomes.visitors, makeEmptyVisitor(id)])
  }

  function updateVisitor(id: string, v: VisitorRecord) {
    field('visitors', outcomes.visitors.map(vis => vis.id === id ? v : vis))
  }

  function removeVisitor(id: string) {
    field('visitors', outcomes.visitors.filter(vis => vis.id !== id))
  }

  const noVisitors = outcomes.attendanceOutcome === 'no_visitors'
  const atMax = outcomes.visitors.length >= MAX_VISITORS

  return (
    <div className="oh-stage">
      <p className="oh-stage-intro">
        Summarize what happened at the open house and create visitor records as needed.
        Visitor records are optional — a no-visitor event is a complete and valid workflow.
      </p>

      {/* ── Event Summary ─────────────────────────────────────── */}
      <section className="oh-section">
        <h2 className="oh-section-heading">Event summary</h2>

        {/* Attendance outcome */}
        <fieldset className="oh-fieldset">
          <legend className="oh-label">Attendance outcome</legend>
          <div className="oh-radio-group oh-radio-group--wrap">
            {(Object.entries(ATTENDANCE_LABELS) as [AttendanceOutcome, string][])
              .filter(([k]) => k !== '')
              .map(([k, v]) => (
                <label key={k} className="oh-radio-label">
                  <input
                    type="radio"
                    name="oh-attendance-outcome"
                    value={k}
                    checked={outcomes.attendanceOutcome === k}
                    onChange={() => field('attendanceOutcome', k)}
                  />
                  {v}
                </label>
              ))}
          </div>
        </fieldset>

        {/* Property feedback themes */}
        <div className="oh-field-group">
          <label className="oh-label" htmlFor="oh-feedback-themes">
            General property-feedback themes <span className="oh-optional">(optional)</span>
          </label>
          <textarea
            id="oh-feedback-themes"
            className="tool-input oh-textarea"
            value={outcomes.feedbackThemes}
            onChange={e => field('feedbackThemes', e.target.value)}
            placeholder="Common reactions, layout comments, price observations, etc."
            rows={3}
          />
        </div>

        {/* Common questions */}
        <div className="oh-field-group">
          <label className="oh-label" htmlFor="oh-common-questions">
            Common questions <span className="oh-optional">(optional)</span>
          </label>
          <textarea
            id="oh-common-questions"
            className="tool-input oh-textarea"
            value={outcomes.commonQuestions}
            onChange={e => field('commonQuestions', e.target.value)}
            placeholder="Questions that came up frequently during the event"
            rows={2}
          />
        </div>

        {/* Concerns for professional review */}
        <div className="oh-field-group">
          <label className="oh-label" htmlFor="oh-concerns">
            Property concerns or items needing professional review <span className="oh-optional">(optional)</span>
          </label>
          <textarea
            id="oh-concerns"
            className="tool-input oh-textarea"
            value={outcomes.concernsForReview}
            onChange={e => field('concernsForReview', e.target.value)}
            placeholder="Structural, mechanical, or other concerns raised"
            rows={2}
          />
        </div>

        {/* Marketing observations */}
        <div className="oh-field-group">
          <label className="oh-label" htmlFor="oh-marketing">
            Marketing or signage observations <span className="oh-optional">(optional)</span>
          </label>
          <textarea
            id="oh-marketing"
            className="tool-input oh-textarea"
            value={outcomes.marketingObservations}
            onChange={e => field('marketingObservations', e.target.value)}
            placeholder="Notes about signage, wayfinding, or how visitors found the event"
            rows={2}
          />
        </div>

        {/* Private planning notes */}
        <div className="oh-field-group">
          <label className="oh-label" htmlFor="oh-planning-notes">
            Private planning notes <span className="oh-optional">(optional)</span>
          </label>
          <p className="oh-field-hint">
            For your planning use only. These notes appear in your copy/print output but are not sent anywhere.
          </p>
          <textarea
            id="oh-planning-notes"
            className="tool-input oh-textarea"
            value={outcomes.planningNotes}
            onChange={e => field('planningNotes', e.target.value)}
            placeholder="Internal notes, reminders, or next steps you want to capture"
            rows={2}
          />
        </div>
      </section>

      {/* ── Visitor Records ───────────────────────────────────── */}
      <section className="oh-section">
        <div className="oh-section-header-row">
          <h2 className="oh-section-heading">Visitor follow-up records</h2>
          <span className="oh-visitor-count">
            {outcomes.visitors.length} / {MAX_VISITORS}
          </span>
        </div>

        {noVisitors && (
          <div className="oh-no-visitors-notice" role="note">
            You recorded this as a no-visitor event. You may still add records if needed,
            or continue to the follow-up plan.
          </div>
        )}

        <div className="oh-privacy-caution-banner" role="note">
          <strong>Privacy reminder:</strong> Use neutral labels. Do not enter protected-class,
          financial, or sensitive personal information in visitor records.
        </div>

        {outcomes.visitors.length === 0 && (
          <p className="oh-empty-visitors">
            No visitor records added. A no-visitor event continues normally — skip to the next step.
          </p>
        )}

        <div className="oh-visitor-list">
          {outcomes.visitors.map((vis, i) => (
            <VisitorCard
              key={vis.id}
              visitor={vis}
              index={i}
              onUpdate={v => updateVisitor(vis.id, v)}
              onRemove={() => removeVisitor(vis.id)}
            />
          ))}
        </div>

        {!atMax && (
          <button
            type="button"
            className="oh-add-visitor-btn"
            onClick={addVisitor}
            disabled={atMax}
          >
            + Add visitor record
          </button>
        )}
        {atMax && (
          <p className="oh-max-notice">Maximum of {MAX_VISITORS} visitor records reached.</p>
        )}
      </section>

      <div className="oh-stage-actions oh-stage-actions--split">
        <button type="button" className="listing-planner-btn listing-planner-btn--secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="listing-planner-btn listing-planner-btn--primary" onClick={onNext}>
          Next: Build Follow-Up Plan
        </button>
      </div>
    </div>
  )
}
