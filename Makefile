.PHONY: all install format-check lint typecheck test test-coverage build pack check clean
.PHONY: cf-deploy-staging cf-deploy-production cf-destroy-staging cf-destroy-production
.PHONY: changeset

all: check

install:
	pnpm install --frozen-lockfile

format-check:
	pnpm format:check

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test

test-coverage:
	pnpm test:coverage

build:
	pnpm build

pack:
	pnpm pack --dry-run

check:
	pnpm check

clean:
	rm -rf dist/ node_modules/

changeset:
	pnpm changeset

# Cloudflare deployment targets load .env and call the corresponding pnpm scripts.
cf-deploy-staging:
	test -f .env && . .env; \
	pnpm deploy:staging

cf-deploy-production:
	test -f .env && . .env; \
	pnpm deploy:production

cf-destroy-staging:
	test -f .env && . .env; \
	pnpm destroy:staging

cf-destroy-production:
	test -f .env && . .env; \
	pnpm destroy:production
