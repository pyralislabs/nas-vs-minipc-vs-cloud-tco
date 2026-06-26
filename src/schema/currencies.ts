/**
 * Supported ISO 4217 currency codes.
 *
 * This is the single source of truth for the currency allowlist.
 * Adding or removing a currency requires a Changeset.
 */
export const SUPPORTED_CURRENCIES: readonly string[] = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "CNY",
  "SEK",
  "NOK",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
