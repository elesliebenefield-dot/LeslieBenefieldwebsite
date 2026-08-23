import { OptionCard } from '../../core/components/OptionCard'
import type { FoodTruckAnswers, EventType, EventDateStatus, PublicPrivate, AttendanceRange, ServiceWindow, SettingType } from '../foodTruckTypes'
import {
  EVENT_TYPE_LABELS,
  EVENT_DATE_STATUS_LABELS,
  PUBLIC_PRIVATE_LABELS,
  ATTENDANCE_LABELS,
  SERVICE_WINDOW_LABELS,
  SETTING_TYPE_LABELS,
} from '../foodTruckTypes'

interface Props {
  answers: FoodTruckAnswers
  onChange: (partial: Partial<FoodTruckAnswers>) => void
  showErrors: boolean
}

type EventTypeKey = Exclude<EventType, ''>
type EventDateStatusKey = Exclude<EventDateStatus, ''>
type PublicPrivateKey = Exclude<PublicPrivate, ''>
type AttendanceKey = Exclude<AttendanceRange, ''>
type ServiceWindowKey = Exclude<ServiceWindow, ''>
type SettingTypeKey = Exclude<SettingType, ''>

export function EventBasicsStage({ answers, onChange, showErrors }: Props) {
  const eventTypeError   = showErrors && !answers.eventType
  const dateStatusError  = showErrors && !answers.eventDateStatus
  const eventDateError   = showErrors && answers.eventDateStatus === 'confirmed' && !answers.eventDate.trim()
  const dateNotesError   = showErrors && answers.eventDateStatus === 'tbd' && !answers.dateNotes.trim()
  const venueError       = showErrors && !answers.venueName.trim()
  const publicError      = showErrors && !answers.isPublic
  const attendanceError  = showErrors && !answers.attendance
  const windowError      = showErrors && !answers.serviceWindow

  return (
    <div>
      {/* Q1 — Event type */}
      <div className="tool-question">
        <fieldset>
          <legend className={`tool-question-legend${eventTypeError ? ' has-error' : ''}`}>
            What type of event is this?
            <span className="tool-question-required" aria-hidden="true"> *</span>
          </legend>
          {eventTypeError && (
            <span className="tool-question-error" role="alert">Please select an event type.</span>
          )}
          <div className="option-cards">
            {(Object.keys(EVENT_TYPE_LABELS) as EventTypeKey[]).map(key => (
              <OptionCard
                key={key}
                id={`eventType-${key}`}
                name="eventType"
                value={key}
                label={EVENT_TYPE_LABELS[key]}
                checked={answers.eventType === key}
                type="radio"
                onChange={val => onChange({ eventType: val as EventType })}
                hasError={eventTypeError}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q2 — Date status */}
      <div className="tool-question">
        <fieldset>
          <legend className={`tool-question-legend${dateStatusError ? ' has-error' : ''}`}>
            Do you have a confirmed event date?
            <span className="tool-question-required" aria-hidden="true"> *</span>
          </legend>
          {dateStatusError && (
            <span className="tool-question-error" role="alert">Please select a date option.</span>
          )}
          <div className="option-cards option-cards--compact">
            {(Object.keys(EVENT_DATE_STATUS_LABELS) as EventDateStatusKey[]).map(key => (
              <OptionCard
                key={key}
                id={`eventDateStatus-${key}`}
                name="eventDateStatus"
                value={key}
                label={EVENT_DATE_STATUS_LABELS[key]}
                checked={answers.eventDateStatus === key}
                type="radio"
                onChange={val => {
                  const status = val as EventDateStatus
                  onChange({ eventDateStatus: status, eventDate: status === 'tbd' ? '' : answers.eventDate })
                }}
                hasError={dateStatusError}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q2a — Date input (conditional: only when confirmed) */}
      {answers.eventDateStatus === 'confirmed' && (
        <div className="tool-question">
          <label htmlFor="eventDate" className={`tool-question-legend${eventDateError ? ' has-error' : ''}`}>
            Event date
            <span className="tool-question-required" aria-hidden="true"> *</span>
          </label>
          {eventDateError && (
            <span className="tool-question-error" role="alert">Please enter the event date.</span>
          )}
          <input
            id="eventDate"
            type="date"
            className={`tool-input tool-input--date${eventDateError ? ' tool-input--error' : ''}`}
            value={answers.eventDate}
            onChange={e => onChange({ eventDate: e.target.value })}
            style={{ maxWidth: '14rem' }}
          />
        </div>
      )}

      {/* Q2b — Date notes */}
      <div className="tool-question">
        <label
          htmlFor="dateNotes"
          className={`tool-question-legend${dateNotesError ? ' has-error' : ''}`}
        >
          Date or timing notes
          {answers.eventDateStatus === 'tbd'
            ? <span className="tool-question-required" aria-hidden="true"> *</span>
            : <span className="tool-question-optional"> (optional)</span>
          }
        </label>
        {dateNotesError && (
          <span className="tool-question-error" role="alert">
            Please describe your target date or timeframe since the date isn't confirmed yet.
          </span>
        )}
        <input
          id="dateNotes"
          type="text"
          className={`tool-input${dateNotesError ? ' tool-input--error' : ''}`}
          placeholder={
            answers.eventDateStatus === 'tbd'
              ? "e.g., 'Targeting late September' or 'Any Saturday in October works'"
              : "e.g., 'Date is tentative — confirming by September'"
          }
          value={answers.dateNotes}
          onChange={e => onChange({ dateNotes: e.target.value })}
        />
      </div>

      {/* Q3 — Venue name */}
      <div className="tool-question">
        <label htmlFor="venueName" className={`tool-question-legend${venueError ? ' has-error' : ''}`}>
          Location or venue name
          <span className="tool-question-required" aria-hidden="true"> *</span>
        </label>
        {venueError && (
          <span className="tool-question-error" role="alert">Please enter a location or venue name.</span>
        )}
        <input
          id="venueName"
          type="text"
          className={`tool-input${venueError ? ' tool-input--error' : ''}`}
          placeholder="e.g., Riverside Park Pavilion, Austin TX — or — Our office parking lot, downtown Houston"
          value={answers.venueName}
          onChange={e => onChange({ venueName: e.target.value })}
        />
        <p className="tool-question-hint">A name and city is enough. You don't need to provide a full address.</p>
      </div>

      {/* Q4 — Public or private */}
      <div className="tool-question">
        <fieldset>
          <legend className={`tool-question-legend${publicError ? ' has-error' : ''}`}>
            Is this a public or private event?
            <span className="tool-question-required" aria-hidden="true"> *</span>
          </legend>
          {publicError && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
          <div className="option-cards option-cards--compact">
            {(Object.keys(PUBLIC_PRIVATE_LABELS) as PublicPrivateKey[]).map(key => (
              <OptionCard
                key={key}
                id={`isPublic-${key}`}
                name="isPublic"
                value={key}
                label={PUBLIC_PRIVATE_LABELS[key]}
                checked={answers.isPublic === key}
                type="radio"
                onChange={val => onChange({ isPublic: val as PublicPrivate })}
                hasError={publicError}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q5 — Attendance */}
      <div className="tool-question">
        <fieldset>
          <legend className={`tool-question-legend${attendanceError ? ' has-error' : ''}`}>
            Approximately how many people are you expecting?
            <span className="tool-question-required" aria-hidden="true"> *</span>
          </legend>
          {attendanceError && (
            <span className="tool-question-error" role="alert">Please select an attendance range.</span>
          )}
          <div className="option-cards">
            {(Object.keys(ATTENDANCE_LABELS) as AttendanceKey[]).map(key => (
              <OptionCard
                key={key}
                id={`attendance-${key}`}
                name="attendance"
                value={key}
                label={ATTENDANCE_LABELS[key]}
                checked={answers.attendance === key}
                type="radio"
                onChange={val => onChange({ attendance: val as AttendanceRange })}
                hasError={attendanceError}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q6 — Service window */}
      <div className="tool-question">
        <fieldset>
          <legend className={`tool-question-legend${windowError ? ' has-error' : ''}`}>
            When would you like food service?
            <span className="tool-question-required" aria-hidden="true"> *</span>
          </legend>
          {windowError && (
            <span className="tool-question-error" role="alert">Please select a service window.</span>
          )}
          <div className="option-cards">
            {(Object.keys(SERVICE_WINDOW_LABELS) as ServiceWindowKey[]).map(key => (
              <OptionCard
                key={key}
                id={`serviceWindow-${key}`}
                name="serviceWindow"
                value={key}
                label={SERVICE_WINDOW_LABELS[key]}
                checked={answers.serviceWindow === key}
                type="radio"
                onChange={val => onChange({ serviceWindow: val as ServiceWindow })}
                hasError={windowError}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q6b — Specific hours */}
      <div className="tool-question">
        <label htmlFor="specificHours" className="tool-question-legend">
          Specific service hours <span className="tool-question-optional">(optional)</span>
        </label>
        <input
          id="specificHours"
          type="text"
          className="tool-input"
          placeholder="e.g., '11:30am–2:00pm' or 'cocktail hour 5:30–7pm, then dinner service 7–9pm'"
          value={answers.specificHours}
          onChange={e => onChange({ specificHours: e.target.value })}
        />
      </div>

      {/* Q7 — Indoor / outdoor */}
      <div className="tool-question">
        <fieldset>
          <legend className="tool-question-legend">
            Will service be indoors or outdoors? <span className="tool-question-optional">(optional)</span>
          </legend>
          <div className="option-cards">
            {(Object.keys(SETTING_TYPE_LABELS) as SettingTypeKey[]).map(key => (
              <OptionCard
                key={key}
                id={`settingType-${key}`}
                name="settingType"
                value={key}
                label={SETTING_TYPE_LABELS[key]}
                checked={answers.settingType === key}
                type="radio"
                onChange={val => onChange({ settingType: val as SettingType })}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
