# AGENTS.md

These instructions apply to the entire `nas-vs-minipc-vs-cloud-tco` project.

## Start Here

Read, in order:

1. `bootstrap.md`
2. `README.md`
3. `docs/ARCHITECTURE.md`
4. `docs/CODE_STANDARDS.md`
5. `docs/TESTING.md`
6. `docs/ROADMAP.md`

`bootstrap.md` is the implementation source of truth. Do not silently change its formulas, price
basis, public contracts, planned tree, scope boundaries, recommendation policy, or acceptance
criteria.

## Scope

This project owns multi-year financial comparison of owned hardware and cloud rental:

- capex and scheduled costs;
- annual-energy-derived power cost;
- maintenance;
- cloud recurring and egress cost;
- non-cash depreciation reporting;
- cash break-even;
- explicit sensitivity cases; and
- guarded cost-only classifications.

It does not own electrical-load estimation. Never add idle/load wattage formulas, utilization
models, hardware wattage datasets, CPU TDP logic, PSU sizing, or component power calculations.
Consume `annualEnergyKwh` supplied by the user or `mini-pc-power-calculator`.

## Implementation Rules

- Use strict TypeScript, ESM, and Decimal arithmetic for all financial values.
- Keep `src/core/` pure and independent of Node, DOM, network, locale globals, and mutable state.
- Keep depreciation separate from cash TCO and break-even.
- Exclude salvage from break-even; show both gross and net TCO.
- Never guess prices, inflation, rates, energy use, discounts, taxes, workload equivalence, or
  currency conversion.
- Return canonical decimal strings from public calculation results; round only for presentation.
- Preserve input order and deterministic output.
- Validate every external input at its boundary and reject unknown fields.
- Keep recommendation language limited to the approved cost-only classifications and disclaimer.
- Add a Changeset for public API, schema, formula, CLI, widget, or example-contract changes.

## Verification

Before declaring implementation work complete, run:

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm pack
```

Also run the CLI smoke test and widget accessibility/bundle checks. Report commands that
could not run.

## Change Discipline

- Keep changes narrowly scoped and update docs/tests with behavior.
- Do not add product behavior outside the exact planned tree without approval.
- Do not commit generated build, Cloudflare deployment output, coverage, or packed archive output.
- Do not add a backend, telemetry, cookies, local storage, remote scripts, live pricing, or secrets.
- Do not copy formulas or data from sibling power calculators.
- Do not remove guarded language or backlinks without an explicit product decision.
