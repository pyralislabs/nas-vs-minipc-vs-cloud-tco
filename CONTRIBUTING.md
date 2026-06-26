# Contributing

## Development Setup

```bash
pnpm install
pnpm check
```

## Validation Commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm pack
```

## Pull Request Process

1. Run all validation commands before opening a PR.
2. Add tests for new functionality or bug fixes.
3. Update documentation affected by the change.
4. Add a Changeset for public API, schema, formula, CLI, widget, or example-contract changes:
   ```bash
   pnpm changeset
   ```
5. Keep changes narrowly scoped.

## Project Structure

See `bootstrap.md` for the exact planned tree and `docs/ARCHITECTURE.md` for the dependency
direction.

## Code Standards

- Strict TypeScript and ESM only.
- Decimal arithmetic for all financial values (via `src/core/money.ts`).
- `src/core/` must not import Node, DOM, Ajv, Commander, or `decimal.js` outside `money.ts`.
- Widget must not use `innerHTML`, `outerHTML`, or `insertAdjacentHTML`.
- Recommendation language must remain guarded and cost-only.

## Release Process

Releases are automated through Changesets and GitHub Actions. The release workflow publishes to
npm with provenance. Only maintainers can trigger releases on protected branches.
