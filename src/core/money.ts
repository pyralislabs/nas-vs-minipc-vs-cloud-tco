import type { DecimalString } from "./types.js";

import { Decimal } from "decimal.js";

const D = Decimal.clone({ precision: 28, rounding: 6 });

export { D };

export function parseMoney(value: DecimalString) {
  return new D(value);
}

export function serializeMoney(value: ReturnType<typeof parseMoney>): DecimalString {
  if (!value.isFinite()) {
    throw new RangeError("Cannot serialize non-finite Decimal value");
  }
  const str = value.toFixed();
  if (/e/i.test(str)) {
    throw new RangeError(`Serialization produced unexpected exponential form: ${str}`);
  }
  return str;
}

export function decimalFromNumber(n: number) {
  return new D(n);
}
