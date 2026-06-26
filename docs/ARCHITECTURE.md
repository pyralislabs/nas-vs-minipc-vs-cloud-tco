# Architecture

## System Shape

The project is one TypeScript package with a pure financial core and three adapters:

```text
JSON / TypeScript input
  -> schema and semantic validation
  -> pure Decimal cash-flow core
  -> comparison / break-even / sensitivity / recommendation results
  -> library API, CLI formatter, or static widget
```

The core library is the single source of calculation truth. CLI and widget code must not duplicate
formulas or recommendation rules.

## Dependency Direction

```text
src/core       depends on a private decimal.js clone only
src/schema     depends on core types and Ajv
src/format     depends on core types and Intl (presentation only)
src/cli        depends on core, schema, and format
src/widget     depends on core, schema, and format
src/index.ts   exposes the approved public core API plus formatMoney
worker/        depends on dist/widget (serves static assets via Cloudflare Workers)
```

Nothing imports from `src/cli` or `src/widget`. Core code cannot import Node, DOM, Ajv,
Commander, `Intl`, or presentation formatters. `src/format/` is the only module that may
use `Intl` and it is barred from calculation; the core never imports from `src/format/`.

## Components

### Core cash-flow engine

`src/core/calculate.ts` converts validated owned/cloud scenarios into monthly cash-flow ledgers and
gross/net TCO. It owns escalation timing and line-item aggregation. Every result is deterministic,
order-preserving, and represented by canonical decimal strings.

### Money

`src/core/money.ts` is the only Decimal construction/serialization boundary. It rejects invalid
decimal strings, provides exact arithmetic helpers, and owns the canonical decimal serializer
that every public result uses. The serializer uses `Decimal.toFixed()` at the precision needed
to represent every significant digit, then trims trailing zeros after the decimal point while
preserving at least one digit (`"1.0000"` → `"1"`, `"1.5000"` → `"1.5"`). It rejects `NaN`,
`Infinity`, and exponential output. Round-tripping a serialized value through the parser must
yield a `Decimal` whose `toFixed()` output equals the input.

`decimal.js` configuration is **isolated per module** to prevent host-process contamination.
`src/core/money.ts` creates a private Decimal clone via
`const D = Decimal.clone(); D.set({ precision: 28, rounding: D.ROUND_HALF_EVEN });`
and uses `D` for all core arithmetic. This gives the core its own config independent of any
host that may have configured the global `Decimal` differently. CLI and widget entry points
import from `money.ts` and never call `Decimal.set` on the global. Test setup resets the
clone's config in `beforeEach` to prevent leakage between tests.

Production precision is pinned to 28 significant digits; the rounding mode is
`ROUND_HALF_EVEN`.

### Format

`src/format/money.ts` is the presentation-only formatting module. It owns `formatMoney` and
uses `Intl.NumberFormat` with locales from `src/schema/locales.ts`. It never participates in
calculation; the core never imports from `src/format/`. Presentation rounding lives here and
in the CLI/widget formatters. `--locale` only affects presentation; JSON output and
calculation are byte-identical across locales. The locale allowlist is pinned at validation
time in `src/schema/locales.ts`; it is never queried from
`Intl.NumberFormat.supportedValuesOf` at runtime, because Node ICU support varies by build
and version.

### Break-even

`src/core/break-even.ts` compares cumulative gross cash ledgers, reports all crossovers, and selects
the first durable owned-vs-cloud break-even month. It excludes depreciation and salvage.

### Depreciation

`src/core/depreciation.ts` reports straight-line depreciation and end book value for explicitly
selected capital items. Its output is non-cash metadata and cannot flow into TCO or recommendation
functions.

### Sensitivity and recommendation

`src/core/sensitivity.ts` evaluates explicit named comparison cases in input order.
`src/core/recommendation.ts` applies materiality and sensitivity-stability rules to the lowest-cost
owned and cloud scenarios. It emits only approved codes, explanations, and disclaimer text.

### Validation

`src/schema/scenario.schema.json` owns structural validation. `src/schema/validate.ts` owns semantic
rules that JSON Schema cannot express cleanly: currency consistency, constant-price escalation,
capital-ID references, salvage limits, and sensitivity override invariants.

`src/schema/validate.ts` is the only producer of `InputValidationError` issues. Every issue
carries a stable code from the taxonomy in `bootstrap.md` §7, an RFC 6901 JSON Pointer path
relative to the validated input root, and a human-readable message. Errors that cannot be
localized to a single input position (e.g., duplicate IDs detected across siblings) report the
location of the _second_ occurrence. Ajv errors are mapped into the same envelope so library
consumers see a single error shape.

The supported-currency allowlist is maintained in `src/schema/currencies.ts` and is the only
file that may edit the list. The supported-locale allowlist is maintained in
`src/schema/locales.ts` and is the only file that may edit that list. The size limits
(1 MiB CLI input, 256 KiB widget advanced-JSON import) are pinned in `src/schema/limits.ts`.
Changing any of these files is a Changeset event.

### CLI

The CLI loads size-limited JSON from a file or stdin (1 MiB cap from `src/schema/limits.ts`),
validates it, calls the public library, and formats output. It owns argument parsing, streams,
exit codes, and JSON envelopes. It never prompts, fetches data, or changes input assumptions.

`analyzeSensitivity` runs the base comparison first; the `sensitivity` subcommand exit code is
the highest-severity outcome among the base and per-case results (`0` all OK, `2` base
invalid, `3` base schema version unsupported, `4` at least one case failed validation, `1`
unexpected internal error). Per-case failures never replace the base; they appear in the
`cases` array as `{ id, label, error }`.

### Static widget

The widget is a client-only adapter. Guided mode creates an explicit comparison object; advanced
mode imports JSON. Both call the same validator and core. Validation in the widget uses a
precompiled standalone validator (generated from `scenario.schema.json` by
`scripts/precompile-schema.mjs` using Ajv standalone mode); the full Ajv runtime is never
bundled into the widget. Semantic validation rules from `src/schema/validate.ts` are pure
functions imported directly. Iframe and Shadow DOM embeds share the same UI implementation and
make no network requests. Widget styles use `adoptedStyleSheets` (constructed stylesheets) on
the Shadow root, never `<style>` element injection.

## Trust Boundaries

- CLI files/stdin, scenario labels/notes, widget fields, imported JSON, locale, and embed attributes
  are untrusted.
- Input is size-limited before JSON parsing.
- Runtime validation occurs even for TypeScript callers.
- Widget text is inserted through text APIs, never HTML interpolation.
- The widget has no runtime network, persistence, analytics, or secret boundary.
- Examples are fictional fixtures, not trusted current prices.

## Determinism

Determinism requires:

- Decimal arithmetic for financial values;
- fixed month timing and annual escalation steps;
- input-order preservation and input-order tie-breaking;
- no current-time, timezone, random, locale, network, or environment-dependent calculation;
- canonical decimal-string serialization and stable JSON key construction.

`baseDate` is documentary metadata; calculation uses month indices, not system dates. Both
`constant` and `nominal` price-basis calculations are byte-identical when only `baseDate`
changes (the formula never references `baseDate`; this is locked by a property test).

## Package and Build Artifacts

Planned exports:

```json
{
  ".": "./dist/index.js",
  "./schema": "./dist/schema/scenario.schema.json",
  "./examples/*": "./dist/examples/*"
}
```

The npm package exposes the `tco-compare` binary. Package exports and `files` are explicit
allowlists. The widget is a separate static build deployed to Cloudflare Workers from a
tagged artifact via `wrangler`. The Worker (`worker/index.ts`) serves `dist/widget/` and
injects CSP and cache headers. `wrangler` is a dev dependency only.

## Versioning

- Public TypeScript API, JSON Schema, CLI JSON envelope, widget contract (DOM structure, embed
  attributes, bundle budget, CSP), formulas, and recommendation rules follow SemVer.
- `SchemaVersion` is a shared type alias (`export type SchemaVersion = 1;`) referenced by
  `ComparisonInput`, `ComparisonResult`, `SensitivityResult`, and the CLI envelope. JSON
  input/output starts with `schemaVersion: 1`. The `SchemaVersion` literal moves together
  across all surfaces; bumping it is a major-version event and requires a coordinated schema,
  library, CLI, and widget change.
- Adding a backward-compatible example is patch-level.
- Changing a formula, timing rule, schema requirement, public field, recommendation rule,
  widget contract, supported-currency list (removal), supported-locale list (removal),
  canonical decimal serializer format, CSP, or trusted-publishing OIDC subject is a breaking
  change unless compatibility is preserved.

## Decisions Requiring Approval

- Adding NPV/discount rates, taxes, financing, labor, downtime, carbon, live prices, or currency
  conversion
- Adding a backend, persistence, telemetry, dynamic pricing, or provider integrations
- Adding power-estimation formulas, wattage datasets, or component/PSU logic
- Changing price-basis, break-even, depreciation, sensitivity, or recommendation policy
- Changing the exact public contracts or planned tree in `bootstrap.md`
