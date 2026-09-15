// Unit dropdown options for the guided UI, derived directly from the
// calc-engine's own conversion registries — never a separately maintained
// literal list — so the UI can never drift from the engine's authoritative
// unit set.
import { COUNT_TO_EACH, VOLUME_TO_ML, WEIGHT_TO_GRAMS } from './calc-engine/units.ts'
import type { MeasurementType, Unit } from './calc-engine/types.ts'

export const MEASUREMENT_TYPE_OPTIONS: { value: MeasurementType; label: string }[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'volume', label: 'Volume' },
  { value: 'count', label: 'Count' },
]

export const UNIT_OPTIONS_BY_MEASUREMENT_TYPE: Record<MeasurementType, Unit[]> = {
  weight: Object.keys(WEIGHT_TO_GRAMS) as Unit[],
  volume: Object.keys(VOLUME_TO_ML) as Unit[],
  count: Object.keys(COUNT_TO_EACH) as Unit[],
}

export function defaultUnitFor(type: MeasurementType): Unit {
  return UNIT_OPTIONS_BY_MEASUREMENT_TYPE[type][0]
}
