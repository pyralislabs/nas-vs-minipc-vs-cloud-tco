# Code Standards

## Baseline

- Node.js 22+ and ESM only.
- TypeScript enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, and `useUnknownInCatchVariables`.
- Source is ASCII unless user-facing fixtures require otherwise.
- Prettier owns formatting; ESLint owns correctness and maintainability.
- Public APIs, formulas, and non-obvious timing rules require concise TSDoc.

## Module Boundaries

- `src/core/` is pure domain code and may depend only on a private `decimal.js` clone
  created in `src/core/money.ts`. A lint rule (`no-restricted-imports`) blocks
  `src/core/**` from importing Node, DOM, Ajv, Commander, `Intl`, or presentation
  formatters. A `no-restricted-syntax` rule forbids `new Decimal(` outside
  `src/core/money.ts`. The core-boundary grep guard in CI fails the build on
  `src/core/**` containing any of `watt`, `TDP`, `PSU`, `idle`, `utilization`,
  `load profile`, or `duty cycle` (case-insensitive, whole-word).
- `src/schema/` validates unknown input and cannot contain calculation formulas.
- `src/format/` owns presentation formatting (`formatMoney`) and may use `Intl`. It
  depends on core types only and never participates in calculation. The core never
  imports from `src/format/`.
- `src/cli/` owns I/O and presentation, not domain rules.
- `src/widget/` owns browser interaction and presentation, not domain rules. The widget must
  not use `innerHTML`, `outerHTML`, or `insertAdjacentHTML`; a lint rule
  (`no-restricted-syntax`) enforces this. Widget styles must use `adoptedStyleSheets`
  (constructed stylesheets) on the Shadow root, never `<style>` element injection. Untrusted
  text is rendered through text APIs only.
- `src/index.ts` is the only public TypeScript export surface.
- `src/schema/currencies.ts` is the only file that may edit the supported-currency allowlist.
  `src/schema/locales.ts` is the only file that may edit the supported-locale allowlist.
  `src/schema/limits.ts` is the only file that may edit the size caps.

Do not introduce an abstraction unless it enforces one of these boundaries or removes meaningful
duplication.

## Money, Rates, and Units

- External financial/rate inputs are validated decimal strings.
- Construct Decimal values only through the canonical money helper in `src/core/money.ts`. The
  helper creates a private `Decimal.clone()` with pinned precision (28) and rounding
  (`ROUND_HALF_EVEN`) so the core is immune to host-process `decimal.js` global configuration.
  No other module may call `new Decimal(...)` directly; the lint rule `no-restricted-syntax`
  enforces this.
- Never use JavaScript `number` arithmetic for cost, energy, rates, escalation, percentages, or
  threshold comparisons.
- Never coerce omission to zero. Explicit zero remains valid.
- Use unit-bearing names: `annualEnergyKwh`, `electricityRatePerKwh`, `monthlyEgressGb`,
  `egressRatePerGb`, `horizonMonths`.
- The canonical decimal serializer (`src/core/money.ts`) is the only producer of `DecimalString`
  outputs. It must round-trip: serializing then parsing yields an equal `Decimal.toFixed()`.
- Round only in presentation formatters. Core results serialize full canonical decimal strings.
- Keep one currency per comparison; do not convert currencies. The supported-currency allowlist
  lives in `src/schema/currencies.ts`. The supported-locale allowlist lives in
  `src/schema/locales.ts`; locales are never queried from `Intl.NumberFormat.supportedValuesOf`
  at runtime.

## Calculation Rules

- Implement only formulas and timing rules in `bootstrap.md`.
- Keep gross cash TCO, net cash TCO, depreciation, and book value distinct.
- Exclude salvage and depreciation from break-even.
- Preserve line-item and scenario order.
- Tie-break using input order.
- No current-time or locale-dependent core behavior.
- Do not infer prices, inflation, discounts, energy, workload equivalence, or missing costs.

## Types and Validation

- External input begins as `unknown`.
- Narrow through schema and semantic validation before calculation.
- Avoid `any`; justified exceptions need a narrow lint suppression and comment.
- Use discriminated unions for owned/cloud scenarios, errors, and recommendation codes.
- Exhaustively handle unions with a shared `assertNever(x: never): never` helper exported from
  `src/core/assert.ts`. Every switch on a discriminated union must end with `assertNever` or
  have an explicit `// istanbul ignore next` with justification.
- `src/schema/validate.ts` is the only producer of `InputValidationError` issues. Every issue
  carries a stable code, a JSON Pointer path, and a human-readable message. Ajv errors are
  mapped into the same envelope.
- Reject unknown fields, oversized collections/strings, scientific notation, non-finite values,
  non-allowlisted currencies, and unsupported schema versions. Size caps (1 MiB CLI input,
  256 KiB widget advanced-JSON import) are enforced before JSON parsing.

## Errors

- Expected failures use typed project errors with stable codes and JSON Pointer paths.
- Wrap Ajv, Commander, JSON, and filesystem errors; do not expose unstable dependency messages as
  the primary contract.
- Never call `process.exit()` outside the CLI entry point.
- Never log from library code.
- Unexpected errors map to a stable internal-error envelope without ordinary stack/path leakage.

## CLI and Widget

- Generated CLI output goes to stdout; diagnostics go to stderr.
- JSON output is one stable versioned document with LF and one trailing newline.
- Enforce input-size limits before reading/parsing complete input.
- Never fetch or execute user-supplied references.
- Widget output uses safe text APIs, native controls, and accessible result/error regions.
  Styles use `adoptedStyleSheets` (constructed stylesheets) on the Shadow root, never
  `<style>` element injection.
- No `innerHTML`, remote assets, persistence, telemetry, cookies, or network calls. The
  widget dispatches a `tco-compare:error` `CustomEvent` on validation/size-limit errors so
  host pages can detect failures.
- Recommendation disclaimer must remain visible in human/widget output.

## Dependencies

Approved runtime dependencies:

- `decimal.js`
- `ajv`
- `commander`

Vite, TypeScript, ESLint, Prettier, Vitest, fast-check, Testing Library, axe-core, and Changesets are
development-only. New runtime dependencies require a documented need, maintenance/license/security
review, package-size review, and boundary tests.

Pin the package-manager version and commit `pnpm-lock.yaml`.

## Testing and Reviews

- Every bug fix includes a reproducing test.
- Every formula/timing rule has reviewed examples and boundary tests. Formula TSDoc in
  `src/core/**` quotes the formula and links to the corresponding `bootstrap.md` section so
  the spec remains the source of truth and the code points back to it.
- Public text/JSON output changes require reviewed golden diffs and a versioning decision.
  Goldens are regenerable byte-identically from the shipped examples; a regression test
  enforces this.
- Recommendation changes require adversarial sensitivity tests. The phrase guard runs in CI
  and fails the build on `you should buy`, `you should rent`, `best`, `guaranteed savings`,
  `always buy`, or `always rent` in human CLI output, widget rendered DOM, and golden human
  output (case-insensitive). No exception clause is needed; the approved disclaimer does not
  contain any forbidden phrase. If a future disclaimer must quote a forbidden phrase, an
  explicit spec amendment is required at that time.
- Widget changes require accessibility (axe rule tags `wcag2a`, `wcag2aa`, `wcag21a`,
  `wcag21aa`, `wcag22aa`; fail on `serious` or `critical` impact), a recorded manual
  accessibility review sign-off (keyboard, 200% zoom, reduced motion, high contrast, focus
  order), and bundle-budget checks (Widget JavaScript < 100 KiB gzip; total first load
  < 200 KiB gzip; the bundle-size gate fails the build on regression). The widget uses a
  precompiled standalone validator; the full Ajv runtime is never bundled.
- Schema/public API/formula/canonical-serializer/CSP/OIDC-subject changes require a Changeset.

Review checklist:

- Does this remain a financial comparator rather than a power calculator or product recommender?
- Are all assumptions explicit?
- Are depreciation and salvage handled in their approved roles?
- Is output deterministic and exact (including `--locale` independence of JSON output)?
- Is guarded recommendation language preserved?
- Are untrusted input and output handled safely (size caps, text-only rendering, JSON Pointer
  paths on every validation issue)?
- Are public-contract and SemVer impacts documented?

## Git, CI, npm, and Cloudflare

- Keep commits focused; conventional prefixes are preferred.
- Never commit generated build, Cloudflare deployment output, coverage, tarball, secret,
  local-path, or editor output.
- CI runs frozen install, formatting, lint, typecheck, coverage, build, pack, package smoke,
  accessibility, bundle budget, dependency review, and audit gates.
- Pin Actions to immutable SHAs and grant minimum permissions.
- npm publishes through trusted publishing/provenance from protected tagged releases.
- Cloudflare Workers deploys static widget artifacts from successful tagged builds only,
  via `wrangler deploy --env production`. The Worker injects CSP and cache headers.
