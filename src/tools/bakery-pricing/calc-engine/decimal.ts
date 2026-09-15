// Carried forward from the archived M0 spike's decimalRoundTrip.ts.
// Isolates the decimal-string <-> Decimal-instance boundary: every value
// entering or leaving the calc engine is a DecimalString; Decimal instances
// exist only transiently, inside a calculation.

import Decimal from "decimal.js";
import type { DecimalString } from "./types.js";

export function toStorageString(value: Decimal): DecimalString {
  return value.toFixed();
}

export function fromStorageString(value: DecimalString): Decimal {
  return new Decimal(value);
}
