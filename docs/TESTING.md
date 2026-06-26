# Testing Strategy

## Goals

Tests prove that the tool produces exact, deterministic, explainable financial comparisons without
inventing assumptions or crossing into electrical-load estimation.

## Test Layers

| Layer                    | Purpose                                                                           |
| ------------------------ | --------------------------------------------------------------------------------- |
| Unit                     | Decimal helpers, escalation, cash flows, depreciation, break-even, recommendation |
| Schema/semantic fixtures | Accepted and rejected input contracts                                             |
| Golden reconciliation    | Independently reviewed monthly ledgers and human/JSON output                      |
| Property                 | Arithmetic, ordering, determinism, and recommendation invariants                  |
| CLI integration          | Commands, stdin/files, streams, envelopes, exit codes                             |
| Widget                   | Guided/advanced flows, accessibility, host isolation, privacy                     |
| Package/Pages smoke      | Public exports, packed binary, static artifact, CSP assumptions                   |

## Deterministic Golden Scenarios

At minimum, commit independently calculated golden fixtures for:

1. Owned hardware with capex, power, maintenance, no inflation, and no salvage.
2. Owned hardware with nominal escalation, scheduled replacement, salvage, and depreciation.
3. Cloud rental with multiple recurring lines and egress.
4. Homelab NAS vs cloud with a durable break-even.
5. Local-AI box vs cloud with no break-even in the horizon.
6. Multiple crossovers where a scheduled replacement invalidates an early crossover.
7. Equal-cost and below-materiality-threshold comparisons.
8. Sensitivity cases that change the favored category.

Every golden comparison reconciles:

- each month-by-month recurring and scheduled cost;
- cumulative gross cost;
- gross and net TCO;
- salvage credit;
- depreciation/book value, separately;
- all crossover months and durable break-even;
- TCO delta and recommendation code/explanation.

Golden JSON is byte-stable. Golden updates require an explicit environment flag, reviewed diff, and
SemVer/Changeset decision when public output changes.

## Formula Unit Cases

Required focused cases:

- initial capex occurs at month 0 and appears in `MonthlyCashFlow.capitalCost`;
  `recurringCost` and `scheduledCost` are `0` at month 0;
- recurring cost starts at month 1;
- annual escalation changes exactly at months 13, 25, and so on;
- constant-price input rejects non-zero escalation;
- maintenance divides evenly across 12 months without early rounding;
- egress equals explicit monthly GB times rate/GB;
- scheduled costs land only in their declared month and appear in `scheduledCost`, not
  `capitalCost`; `capitalCost` is `0` for months > 0;
- salvage reduces net TCO only at the horizon;
- depreciation stops at residual value and never affects TCO;
- break-even excludes salvage/depreciation and requires durability;
- ties preserve input order;
- negative escalation above the allowed floor works deterministically;
- canonical decimals never serialize in scientific notation;
- `month=0` ledger entries are never multiplied by `(1+r)^-1`; the escalation exponent is
  `floor((0-1)/12) = -1` and the cash-flow code must guard against it;
- the canonical serializer (`src/core/money.ts`) round-trips through the parser and emits
  trimmed trailing zeros without scientific notation.

## Property Tests

Use fast-check with bounded decimal-string and scenario generators.

Required properties:

1. Recalculating identical input is byte-identical.
2. Gross cash TCO equals the exact sum of the monthly ledger:
   `Σ(capitalCost + recurringCost + scheduledCost)` across all months equals `grossCashTco`.
3. Net owned TCO equals gross TCO minus salvage; cloud gross equals cloud net.
4. Adding a non-negative cost line cannot lower gross TCO.
5. Increasing annual energy or electricity rate cannot lower owned gross TCO.
6. Increasing egress volume or rate cannot lower cloud gross TCO.
7. Depreciation changes cannot change cash TCO, break-even, or recommendation.
8. Salvage changes cannot change break-even.
9. A returned durable break-even remains valid through the horizon.
10. All reported crossover months correspond to a sign change or equality in cumulative deltas.
11. Scenario and sensitivity result order matches input order. Reversing the input order
    reverses the result order and is otherwise byte-identical.
12. Constant-price calculations are invariant to `baseDate`. **Nominal-price** calculations
    are also invariant to `baseDate` (the formula never references `baseDate`).
13. Serialization followed by validation/calculation preserves results.
14. Recommendation never emits text outside approved code/template/disclaimer combinations.
15. `analyzeSensitivity` always returns a non-null `base` comparison, even when every case
    fails validation. Failed cases appear in `cases` as `{ id, label, error }` and never
    replace the base.
16. Materiality rule at the boundary: `[0, 0]`, `[0, x]`, `[x, 0]`, `[x, x]`,
    `[x, x+materiality]`, `[x, x+materiality+1]` all produce the expected classification.
17. Size-limit boundary: scenario count at `1`, `2`, `5`, `6`; cost-line array at `0`, `1`,
    `50`, `51`; line-label length at `99`, `100`, `101`; note count and length at the limit
    and one past; all assert accept/reject with stable error codes.

## Validation Fixtures

Cover:

- unsupported schema version;
- duplicate comparison/scenario/line IDs;
- fewer than two or more than five scenarios;
- missing owned or cloud category;
- mixed/invalid currency;
- non-allowlisted currency (not in `src/schema/currencies.ts`);
- invalid horizon and scheduled month (including scheduled month `0` and `> horizonMonths`);
- negative/oversized/scientific-notation decimal;
- invalid escalation and constant-price non-zero escalation;
- unknown properties;
- invalid salvage cap;
- depreciation referencing unknown/non-owned capital IDs;
- invalid residual/useful life;
- sensitivity changing IDs, currency, kind, or schema shape;
- oversized input, strings, arrays, and notes;
- the 1 MiB CLI cap and the 256 KiB widget advanced-JSON cap (size fixture exactly at the cap
  is accepted, one byte over is rejected with a `limits:` code and a JSON Pointer path).

Expected invalid fixtures assert stable error codes (from the `src/schema/validate.ts` taxonomy)
and JSON Pointer paths.

### Validation coverage matrix

Every stable code prefix in the §7 taxonomy must have at least one fixture that triggers it.
The matrix below is the minimum required mapping:

| Code prefix    | Required fixture(s)                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id:`          | duplicate comparison ID; duplicate scenario ID; duplicate line ID; non-kebab-case ID                                                                 |
| `scope:`       | 1 scenario; 6 scenarios; missing owned; missing cloud                                                                                                |
| `time:`        | horizon 11; horizon 121; scheduled month 0; scheduled month > horizon                                                                                |
| `money:`       | negative decimal; scientific notation; 9 fractional digits; currency mismatch; non-allowlisted currency                                              |
| `pricebasis:`  | constant with non-zero escalation; nominal with mixed category rates                                                                                 |
| `capital:`     | unknown capital ID; non-owned capital ID; depreciable basis not positive; residual > basis; residual < 0                                             |
| `salvage:`     | salvage exceeds capex + scheduled capital                                                                                                            |
| `materiality:` | threshold < 0; threshold > 100                                                                                                                       |
| `sensitivity:` | case changes ID; case changes currency; case changes kind; case changes schema shape                                                                 |
| `locale:`      | `--locale` not in `src/schema/locales.ts`                                                                                                            |
| `limits:`      | CLI input at 1 MiB + 1 byte; widget import at 256 KiB + 1 byte; label at 101 chars; notes at 21 entries; note at 501 chars; cost array at 51 entries |

## Recommendation and Sensitivity Tests

- Exact materiality boundary and values just below/above it.
- Both-zero and one-zero TCO materiality behavior.
- Owned favored, cloud favored, and too-close classifications.
- A case that flips owned to cloud.
- A case that flips cloud to owned.
- A case that becomes too close.
- Multiple cases with stable classification.
- Case order preservation.
- Required disclaimer in all human/widget recommendation presentations.
- Forbidden phrases such as "you should buy," "best," and "guaranteed savings" absent from output.

## CLI Integration

Run the built CLI in temporary directories and assert:

- `compare`, `sensitivity`, and `validate` success/failure;
- file and `-` stdin input;
- human stdout and versioned JSON stdout;
- diagnostics isolated to stderr;
- documented exit codes (including `2` for file I/O errors with `cli:input` code, and `4`
  for partial sensitivity failure on `sensitivity`);
- file-not-found and permission-denied exit `2` with `cli:input` code (no absolute path
  leakage in JSON output);
- stdin streaming: input at exactly 1 MiB is accepted, input at 1 MiB + 1 byte is rejected
  with a `limits:` code; stdin is never buffered unbounded into memory;
- stable locale-independent JSON; `--locale` produces byte-identical JSON across `en-US`,
  `de-DE`, and `ja-JP` runs;
- malformed/oversized JSON rejection (1 MiB CLI cap);
- `--locale` validation: invalid locale exits `2` with `locale:` code; valid locales
  `en-US`, `de-DE`, `ja-JP` are accepted;
- no prompts, network calls, environment-dependent assumptions, or path leakage;
- help/version output;
- packed binary execution;
- the phrase guard: a regex scan of human stdout asserts absence of `you should buy`,
  `you should rent`, `best`, `guaranteed savings`, `always buy`, and `always rent`
  (case-insensitive). No exception clause is needed; the approved disclaimer does not
  contain any forbidden phrase.

## Widget, Security, and Accessibility Tests

- Guided flow builds a visible explicit comparison; advanced JSON import validates safely and
  enforces the 256 KiB cap. Validation uses the precompiled standalone validator; the full
  Ajv runtime is not bundled.
- Script embed supports multiple instances, isolates styles with Shadow DOM, and dispatches
  `tco-compare:error` `CustomEvent` on validation/size-limit errors.
- Cross-origin embed E2E: a minimal host HTML page on a different origin loads both the
  script embed and iframe embed. The test asserts the script embed renders and computes,
  the iframe is blocked per `frame-ancestors` for non-allowlisted origins, and no network
  requests fire from the widget.
- Widget styles use `adoptedStyleSheets` (constructed stylesheets) on the Shadow root. A CI
  test verifies no `<style>` elements are inserted into the Shadow DOM under the specified
  CSP (`style-src 'self'`).
- No runtime network, storage, cookie, or telemetry APIs are called.
- Untrusted labels/notes render as text, not markup; injecting `<script>` strings into labels
  and notes yields text nodes only.
- Field errors are associated and summarized.
- Results and recommendation are announced appropriately.
- Full keyboard flow, focus behavior, 200% zoom layout, reduced motion, high contrast, and
  axe checks pass. Axe rule tags are pinned to `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`,
  and `wcag22aa`; any violation at `serious` or `critical` impact fails the build. Axe is
  necessary but not sufficient for WCAG 2.2 AA.
- Manual accessibility review sign-off (recorded as a release artifact): keyboard-only flow
  (no mouse trap), focus order, 200% zoom layout, reduced motion, high contrast, and
  color-not-sole information are verified by a reviewer. The sign-off checklist is attached
  to the release.
- Charts have equivalent accessible tables and do not rely on color alone.
- Disclaimer and assumptions remain visible; the phrase guard runs against rendered widget
  DOM text.
- Widget and total first-load gzip budgets pass; the bundle-size gate fails the build on
  regression.
- The widget integration test fetches the deployed HTML (or a `wrangler dev` / `vite preview`
  snapshot during CI) and asserts the CSP header matches `bootstrap.md` §11 byte-for-byte.

## Coverage and CI

Initial thresholds:

```text
statements: 95%
branches:   90%
functions:  95%
lines:      95%
```

Core calculation, validation, break-even, depreciation, recommendation, and sensitivity modules
require 100% branch coverage. Coverage is a floor; independent reconciliation and property tests
remain mandatory.

`pnpm test:coverage` runs Vitest with coverage enabled and emits both `text-summary` and
`json-summary` reports. The text summary is printed; the JSON summary is uploaded as a CI
artifact and is used to gate the threshold. The threshold miss fails the build.

Pull requests run:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm pack
```

CI also runs packed-package smoke, widget accessibility/bundle checks (CSP header, axe rule
tags, manual a11y sign-off artifact, bundle-size gate), dependency review, high/critical audit
gates, the core-boundary grep guard, the `new Decimal(` boundary guard, and the phrase guard.
The release checklist additionally runs the CLI on Windows and macOS and attaches the
verification log to the release tag. Cloudflare Workers staging deployment is verified in CI
before production deploy.

## Acceptance Test

v1 testing is accepted when a clean checkout can:

1. validate and calculate both shipped example scenarios;
2. reproduce all reviewed monthly ledgers and totals exactly, with goldens regenerable
   byte-identically from the examples;
3. prove depreciation/salvage separation and durable break-even behavior;
4. show recommendation stability or sensitivity dependence correctly, including
   `analyzeSensitivity` returning a valid base comparison when every case fails;
5. run the packed CLI and static widget without network or persistence, and the widget
   integration test asserts the deployed HTML's CSP header matches `bootstrap.md` §11
   (via `wrangler dev` or `vite preview` snapshot);
6. pass deterministic, property, security, accessibility, package, and CI gates;
7. show byte-identical JSON output across `--locale en-US`, `--locale de-DE`, and
   `--locale ja-JP`;
8. show the phrase guard passes for human CLI output, widget rendered DOM, and golden
   human output.
