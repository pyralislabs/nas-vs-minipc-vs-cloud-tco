# NAS vs Mini PC vs Cloud TCO

Compare the multi-year cash cost of owning a NAS or mini PC with renting a cloud equivalent.

**MIT-licensed TypeScript library, scriptable CLI, and embeddable static widget.** Models capex,
power cost from supplied annual energy, maintenance, cloud recurring cost, egress, depreciation
reporting, break-even, and sensitivity. The widget is hosted on Cloudflare Workers.

## Status

**Implementation complete.** All core functionality from the
[bootstrap specification](bootstrap.md) is implemented and verified.

## Usage

### CLI

```bash
npx nas-vs-minipc-vs-cloud-tco compare --input comparison.json
npx nas-vs-minipc-vs-cloud-tco compare --input comparison.json --json
npx nas-vs-minipc-vs-cloud-tco sensitivity \
  --input comparison.json \
  --cases sensitivity.json \
  --json
npx nas-vs-minipc-vs-cloud-tco validate --input comparison.json
```

### Library

```ts
import { calculateComparison } from "nas-vs-minipc-vs-cloud-tco";

const result = calculateComparison(comparison);
```

### Widget (Script Embed)

```html
<div data-tco-compare></div>
<script type="module" src="https://tco.minipclab.com/embed.js"></script>
```

## Example

```bash
tco-compare compare --input examples/homelab-nas-vs-cloud.json
```

## Core Assumptions

- Users supply prices, annual energy, rates, horizon, and escalation assumptions.
- All scenarios use one currency and either constant or nominal price basis.
- Depreciation is non-cash reporting and never added to cash TCO.
- Break-even compares cumulative gross cash cost and excludes uncertain salvage.
- Sensitivity ranges are explicit inputs, not predictions.
- Recommendations are guarded cost-only classifications, not buying advice.

## Product Boundary

This tool owns financial comparison. It accepts `annualEnergyKwh` but does not estimate it from
wattage, utilization, schedules, components, or TDP. Use the sibling mini-PC power calculator for
whole-system energy estimation, then bring the annual result here.

It also does not fetch live cloud prices, convert currencies, size hardware, compare performance, or
claim workload equivalence.

## Verification

```bash
pnpm format:check   # Prettier formatting
pnpm typecheck      # TypeScript type checking
pnpm test           # Vitest unit/integration tests
pnpm build          # Full build (package + widget)
pnpm pack           # Verify packed artifact
```

## Documentation

- [Bootstrap specification](bootstrap.md) — Implementation source of truth
- [Architecture](docs/ARCHITECTURE.md)
- [Code standards](docs/CODE_STANDARDS.md)
- [Testing strategy](docs/TESTING.md)
- [Roadmap](docs/ROADMAP.md)

## Strategic Home

- [MiniPCLab](https://minipclab.com/) — Mini PC and homelab buying guides
- [Local AI Rigs](https://localairigs.com/) — Local AI hardware and cloud comparisons

This open-source project supplies transparent, reusable calculation logic.

## License

MIT
