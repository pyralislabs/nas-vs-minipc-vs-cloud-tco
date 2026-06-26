import { SUPPORTED_LOCALES } from "../schema/locales.js";
import { InputValidationError } from "../core/errors.js";

/**
 * Presentation-only money formatter.
 *
 * Uses Intl.NumberFormat with locale from src/schema/locales.ts.
 * Never feeds displayed values back into calculations.
 */
export function formatMoney(value: string, currency: string, locale?: string): string {
  const resolvedLocale = locale ?? "en-US";

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  if (!SUPPORTED_LOCALES.includes(resolvedLocale as (typeof SUPPORTED_LOCALES)[number])) {
    throw new InputValidationError([
      {
        code: "locale:unsupported",
        path: "/locale",
        message: `Unsupported locale "${resolvedLocale}". Supported: ${SUPPORTED_LOCALES.join(", ")}`,
      },
    ]);
  }

  const numericValue = Number(value);
  if (!isFinite(numericValue)) {
    throw new RangeError(`Cannot format non-finite value: "${value}"`);
  }

  try {
    const formatter = new Intl.NumberFormat(resolvedLocale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(numericValue);
  } catch {
    throw new RangeError(
      `Cannot format value "${value}" with currency "${currency}" and locale "${resolvedLocale}"`,
    );
  }
}
