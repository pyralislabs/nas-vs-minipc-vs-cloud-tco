/**
 * Supported BCP 47 locale codes for display formatting.
 *
 * This is the single source of truth for the locale allowlist.
 * Adding or removing a locale requires a Changeset.
 * The list is pinned at validation time and never queried from
 * Intl.NumberFormat.supportedValuesOf at runtime.
 */
export const SUPPORTED_LOCALES: readonly string[] = ["en-US", "de-DE", "ja-JP"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
