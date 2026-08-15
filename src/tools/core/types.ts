export interface ResultItem {
  id: string
  label: string
  detail?: string
}

export interface ResultSection {
  id: string
  title: string
  items: ResultItem[]
}

export interface ValidationError {
  field: string
  message: string
}

export interface Rule<TAnswers> {
  condition: (answers: TAnswers) => boolean
  sectionId: string
  item: ResultItem
}
