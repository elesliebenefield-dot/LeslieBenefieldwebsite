// Unit dropdown options for the guided UI, derived directly from the
// calc-engine's own conversion registries — never a separately maintained
// literal list — so the UI can never drift from the engine's authoritative
// unit set.
import { COUNT_TO_EACH, VOLUME_TO_ML, WEIGHT_TO_GRAMS } from './calc-engine/units.ts'
import type { MeasurementType, Unit, VolumeUnit, WeightUnit } from './calc-engine/types.ts'

export const UNIT_OPTIONS_BY_MEASUREMENT_TYPE: Record<MeasurementType, Unit[]> = {
  weight: Object.keys(WEIGHT_TO_GRAMS) as Unit[],
  volume: Object.keys(VOLUME_TO_ML) as Unit[],
  count: Object.keys(COUNT_TO_EACH) as Unit[],
}

// Package and recipe-usage units are chosen independently (see
// bakeryPricingDraftTypes.ts) — each unit <select> offers every unit from
// every measurement type at once, grouped under a labeled <optgroup> so a
// baker can still find "grams" under Weight and "cups" under Volume.
export const UNIT_GROUPS: { type: MeasurementType; label: string; units: Unit[] }[] = [
  { type: 'weight', label: 'Weight', units: UNIT_OPTIONS_BY_MEASUREMENT_TYPE.weight },
  { type: 'volume', label: 'Volume', units: UNIT_OPTIONS_BY_MEASUREMENT_TYPE.volume },
  { type: 'count', label: 'Individual items', units: UNIT_OPTIONS_BY_MEASUREMENT_TYPE.count },
]

export const WEIGHT_UNITS = UNIT_OPTIONS_BY_MEASUREMENT_TYPE.weight as WeightUnit[]
export const VOLUME_UNITS = UNIT_OPTIONS_BY_MEASUREMENT_TYPE.volume as VolumeUnit[]

export function defaultUnitFor(type: MeasurementType): Unit {
  return UNIT_OPTIONS_BY_MEASUREMENT_TYPE[type][0]
}
