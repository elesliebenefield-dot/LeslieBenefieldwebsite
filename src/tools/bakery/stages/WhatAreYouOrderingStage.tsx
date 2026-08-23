import { OptionCard } from '../../core/components/OptionCard'
import type { BakeryAnswers } from '../bakeryTypes'

interface Props {
  answers: BakeryAnswers
  onChange: (partial: Partial<BakeryAnswers>) => void
  showErrors: boolean
}

const PRODUCT_OPTIONS = [
  { value: 'cake',      label: 'Cake' },
  { value: 'cupcakes',  label: 'Cupcakes' },
  { value: 'cookies',   label: 'Cookies' },
  { value: 'cake_pops', label: 'Cake pops' },
  { value: 'other',     label: 'Other baked goods' },
]

const OCCASION_OPTIONS = [
  { value: 'birthday',    label: 'Birthday' },
  { value: 'wedding',     label: 'Wedding' },
  { value: 'baby_shower', label: 'Baby shower' },
  { value: 'graduation',  label: 'Graduation' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'corporate',   label: 'Corporate or business event' },
  { value: 'holiday',     label: 'Holiday' },
  { value: 'just_because',label: 'Just because' },
  { value: 'other',       label: 'Other occasion' },
]

const RECIPIENT_OPTIONS = [
  { value: 'myself',     label: 'For myself' },
  { value: 'gift_one',   label: 'As a gift for one person' },
  { value: 'group_bulk', label: 'For a group or bulk order' },
]

export function WhatAreYouOrderingStage({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.productType ? ' has-error' : ''}`}>
            What are you ordering?
          </legend>
          <div className="option-cards">
            {PRODUCT_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`productType-${opt.value}`}
                name="productType"
                value={opt.value}
                label={opt.label}
                checked={answers.productType === opt.value}
                type="radio"
                onChange={val => onChange({ productType: val as BakeryAnswers['productType'] })}
                hasError={showErrors && !answers.productType}
              />
            ))}
          </div>
          {showErrors && !answers.productType && (
            <span className="tool-question-error" role="alert">Please select a product type.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.occasion ? ' has-error' : ''}`}>
            What is this for?
          </legend>
          <div className="option-cards">
            {OCCASION_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`occasion-${opt.value}`}
                name="occasion"
                value={opt.value}
                label={opt.label}
                checked={answers.occasion === opt.value}
                type="radio"
                onChange={val => onChange({ occasion: val as BakeryAnswers['occasion'] })}
                hasError={showErrors && !answers.occasion}
              />
            ))}
          </div>
          {showErrors && !answers.occasion && (
            <span className="tool-question-error" role="alert">Please select an occasion.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.recipient ? ' has-error' : ''}`}>
            Who is this order for?
          </legend>
          <div className="option-cards">
            {RECIPIENT_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`recipient-${opt.value}`}
                name="recipient"
                value={opt.value}
                label={opt.label}
                checked={answers.recipient === opt.value}
                type="radio"
                onChange={val => onChange({ recipient: val as BakeryAnswers['recipient'] })}
                hasError={showErrors && !answers.recipient}
              />
            ))}
          </div>
          {showErrors && !answers.recipient && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>
    </div>
  )
}
