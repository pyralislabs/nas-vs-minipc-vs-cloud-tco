# Roadmap

The acceptance criteria in `bootstrap.md` control completion. This roadmap defines implementation
order and keeps power calculation, live pricing, and product recommendations out of scope.

## Phase 0: Foundation

- Create the exact planned tree and package metadata.
- Add strict TypeScript, Decimal (with `Decimal.clone()` isolation), Ajv, Commander, ESLint,
  Prettier, Vitest, fast-check, Vite, axe, Testing Library, Changesets, and `wrangler`.
- Add schema placeholders (`currencies.ts`, `locales.ts`, `limits.ts`), fictional example
  skeletons, security/contribution policies, issue templates, CI, release, and Cloudflare
  deploy workflows, `Makefile`, `wrangler.toml`, `worker/index.ts`, and `public/_headers`.
- Establish build, check, pack, and artifact allowlists.
- Pin the supported-currency placeholder in `src/schema/currencies.ts`, the locale allowlist
  in `src/schema/locales.ts` (`en-US`, `de-DE`, `ja-JP`), and the size caps in
  `src/schema/limits.ts`. The CI lint rules (`no-restricted-imports` for `src/core/**`,
  `no-restricted-syntax` for `innerHTML`/`outerHTML`/`insertAdjacentHTML` in `src/widget/`,
  `no-restricted-syntax` for `new Decimal(` outside `src/core/money.ts`, the core-boundary
  grep guard, and the phrase guard) are in place and **active from M0** with negative tests
  that assert rejection of planted violations.
- The `public/_headers` file and `worker/index.ts` (CSP and cache header injection) land in
  this phase. The trusted-publishing OIDC configuration stub lands in the release workflow;
  the actual OIDC trust against the production npm org is created in Phase 5.
- A minimal widget bundle spike (precompiled schema validator + `decimal.js` clone + trivial
  form) confirms the 100 kB gzip widget budget is achievable before Phase 1 commits to the
  architecture.

Acceptance:

- A clean checkout passes frozen install, formatting, lint, typecheck, tests, build, and pack dry
  run.
- No financial behavior beyond scaffolding exists.
- No product code exists outside the exact planned tree.
- All guards (core-boundary, innerHTML, `new Decimal(`, phrase) are active with negative tests.
- The widget bundle spike confirms the 100 kB gzip budget is achievable.

## Phase 1: Validation and Core Cash Flows

- Implement Decimal-string parsing and canonical serialization using a private `Decimal.clone()`
  with pinned precision and rounding.
- Implement structural and semantic validation. Wire locale validation against
  `src/schema/locales.ts`.
- Implement owned/cloud monthly ledgers, escalation, scheduled costs, egress, gross/net TCO,
  salvage, and `MonthlyCashFlow.capitalCost` (initial capex at month 0, `0` for months > 0;
  scheduled costs go into `scheduledCost`).
- Implement separate straight-line depreciation reporting.
- Add independently reconciled golden and property tests.

Acceptance:

- M1 criteria in `bootstrap.md` pass.
- Every formula/timing rule has boundary tests.
- Depreciation cannot affect cash TCO.
- Annual energy is accepted only as input; no power-load estimation exists.

## Phase 2: Break-even, Recommendation, and Sensitivity

- Implement crossover discovery and first durable break-even.
- Implement materiality-based guarded recommendation classifications.
- Implement explicit named sensitivity cases and classification stability.
- Add adversarial replacement/salvage/depreciation/sensitivity fixtures.

Acceptance:

- M2 criteria pass.
- Early non-durable crossovers are not mislabeled break-even.
- Recommendation language always includes the approved disclaimer.
- No hidden sensitivity ranges or inferred assumptions exist.

## Phase 3: CLI and npm Package

- Implement `validate`, `compare`, and `sensitivity`.
- Add stable human output, JSON envelopes, streams, exit codes (including `2` for file I/O
  errors with `cli:input` code), stdin streaming with byte-counted size enforcement, and
  input limits.
- Validate `--locale` against `src/schema/locales.ts`; invalid locale exits `2` with
  `locale:` code.
- Build the public API, schema/example exports, `formatMoney` (from `src/format/`), and
  `tco-compare` binary.
- Add packed-artifact smoke and cross-platform verification.

Acceptance:

- M3 criteria pass through the packed artifact.
- npm package contents match explicit allowlists.
- JSON output is byte-stable and locale-independent.

## Phase 4: Static Widget and Cloudflare Workers

- Implement guided one-owned-vs-one-cloud form and advanced JSON import.
- Show assumptions, category totals, cash-flow chart/table, break-even, depreciation, sensitivity,
  guarded recommendation, and exclusions.
- Build iframe and Shadow DOM script embeds. Styles use `adoptedStyleSheets` (constructed
  stylesheets), never `<style>` element injection.
- Precompile `scenario.schema.json` into a standalone validator via
  `scripts/precompile-schema.mjs`; the widget imports the precompiled validator and
  semantic rules from `src/schema/validate.ts`. The full Ajv runtime is not bundled.
- Enforce the 256 KiB advanced-JSON import cap from `src/schema/limits.ts`.
- Script embed dispatches `tco-compare:error` `CustomEvent` on validation/size-limit errors.
- Complete accessibility (automated axe + manual review sign-off), privacy, security,
  host-isolation, cross-origin embed E2E, and bundle-budget tests.
- The widget integration test asserts the deployed HTML's CSP header matches the spec
  (via `wrangler dev` or `vite preview` snapshot).
- Configure Cloudflare Workers staging deployment via `wrangler deploy --env staging`.

Acceptance:

- M4 criteria pass.
- Widget makes no runtime network/storage/telemetry calls.
- Every chart has an accessible table and every recommendation has its disclaimer.
- Cloudflare Workers staging deployment serves the widget with correct CSP and cache headers.

## Phase 5: Public Release and Distribution

- Configure protected Changesets/npm trusted-publishing release. The OIDC trust subject is
  `repo:<owner>/<repo>:ref:refs/tags/v*` and the audience is `npm:<package-name>`. `id-token:
write` is granted only to the release workflow on protected branches; PRs from forks never
  receive it.
- Configure tagged Cloudflare Workers production deployment and rollback. The rollback
  workflow is exercised against a known-good tag before the first production deploy.
  `wrangler deploy --env production` serves the widget from `tco.minipclab.com`.
- Run the cross-platform verification log: packed CLI on Linux, Windows, and macOS against
  both shipped examples; attach the log to the release tag.
- Verify README examples against the released package and hosted widget.
- Publish transparent MiniPCLab and Local AI Rigs backlinks and contribution guidance.

Acceptance:

- M5 and the full definition of done pass.
- Release artifacts contain no secrets, live-price claims, or unreviewed generated files.
- Hosted and npm surfaces use the same versioned calculation contract.

## Post-v1 Candidates Requiring Explicit Approval

- Discounted cash flow/NPV
- Financing, tax, labor, downtime, support-risk, or carbon models
- Provider-specific templates maintained as versioned data
- Additional currencies/locales without conversion
- Import adapters from the sibling power calculator

These must preserve explicit assumptions and must not delay v1.

## Permanently Separate Unless Strategy Changes

- Idle/load/utilization/schedule-to-energy calculation and hardware wattage datasets
- Component TDP, PSU sizing, transient load, and efficiency curves
- Live electricity/cloud pricing, invoice scraping, or automatic provider recommendations
- Affiliate checkout flows or claims that cost alone determines the correct architecture
