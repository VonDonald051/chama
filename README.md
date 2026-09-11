# Chama Platform

A security-first Kenyan Chama management system foundation. This repository contains no bundled user identities, pre-populated balances, simulated endpoints or public self-registration. The account-access page follows the supplied light/blue split-card visual direction, while the implementation retains financial-platform security boundaries.

> **Current delivery status:** architecture, threat model, RBAC/API/WebSocket contracts, relational model, Convex authentication with custom session management, financial rule tests, security-worker boundary, local infrastructure and the responsive sign-in/invited-account activation UI. It is **not** a claim that the complete platform or external production services are production-ready. Complete the documented migrations, modules, provider adapters, operations and test gates before a production decision.

## First implementation scope

- `/` — responsive sign in / invited account setup. No public account creation is permitted; the Sign up panel activates a one-time authorized invitation.
- Convex mutations `auth.signup`, `auth.login`, `auth.logout`, `auth.me` — custom session-based authentication with SHA-256 password hashing, token sessions, and member record creation.
- Convex queries/mutations `members.current`, `members.acceptInvitation` — member lifecycle and invitation acceptance.
- Convex queries `finance.ownSavings`, `portal.getConfiguration` — group-scoped savings reads and system configuration.
- Prisma PostgreSQL schema with isolated financial categories, append-only ledger/audit model and security/session entities.

## Documentation (written before application implementation)

1. [Foundation architecture and operational design](docs/01-foundation-architecture.md)
2. [Threat model, RBAC matrix, REST/WebSocket specification](docs/02-threat-model-rbac-api.md)
3. [ER model, constraints and security testing plan](docs/03-data-model-and-test-plan.md)

## Local setup — development only

### 1. Prerequisites

Node 20+, PostgreSQL 16+, Redis and private S3-compatible storage. Copy `.env.example` to an untracked `.env` and replace every placeholder with development-only values. Do **not** re-use development secrets in any other environment.

```bash
cp .env.example .env
npm install
npm run db:validate
npm run db:generate
```

### Convex development deployment

Convex is configured as an additional backend integration for authentication and reactive queries. The existing Prisma/PostgreSQL database remains the system of record for the financial model.

```bash
npm run convex:dev
```

This pushes the functions in `convex/` to the selected Convex development deployment and watches for changes. To push once (for example in a setup or CI step), run:

```bash
npm run convex:push
```

Authentication is handled via custom Convex auth functions (`convex/auth.ts`) with no external identity provider required. The `convex/auth.config.ts` file is not used.

### Vercel web environment

Deploy `apps/web` as the Vercel project root. Configure these variables in the Vercel project for each applicable environment; `.env.local` is only for local Next.js builds and is intentionally ignored by Git.

```bash
# Public Convex endpoints for the matching Convex deployment.
NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<deployment>.convex.site
```

Never add `DATABASE_URL`, session secrets, encryption keys, object-storage credentials, or provider keys to the Vercel web project. Those belong only to the backend runtime. The browser calls relative `/api/*` paths and Next.js rewrites them server-side to `API_INTERNAL_URL`.

### 2. Apply reviewed migrations

The first migration must be generated/reviewed and committed from the Prisma schema; see [`packages/database/prisma/migrations/README.md`](packages/database/prisma/migrations/README.md). Never use `prisma db push` in staging/production. Apply deploy migrations with a dedicated migration database user.

```bash
npm run db:migrate:deploy
```

### 3. Controlled Owner bootstrap

Only after migrations and through a protected operator terminal, create one activation invitation. This utility prints a one-time token but never creates or prints a password.

```bash
npx tsx apps/api/scripts/create-owner-invitation.ts owner@example.com "Your Configured System Name"
```

Deliver the token only via an approved secure channel. The Owner activates it at the Sign up screen, then completes normal login. The bootstrap exits if an Owner already exists.

### 4. Run services

```bash
npm run dev:api
npm run dev:web
```

The browser always requests relative `/api/*` routes. Set `API_INTERNAL_URL` to a private API service for Next.js server-side rewrites; browser code never targets localhost for a separate service.

## Security properties and operating requirements

- No production secret is included. `AUDIT_HASH_KEY` and `FIELD_ENCRYPTION_KEY` must come from an approved secrets manager/KMS, separated by environment.
- PostgreSQL, Redis and object storage must remain private; document storage must never use predictable public URLs.
- Production requires TLS, a trusted proxy configuration, a strict origin allowlist, database TLS, backup/PITR configuration, restoration testing, monitoring and a WORM-capable audit destination.
- All financial changes must be transactional, idempotent where retried and represented by separate immutable ledger categories. Corrections are reversals, not edits.
- Test data, if later required, is isolated to dedicated test infrastructure and cannot be deployed to production.

## Next delivery modules

1. Permission administration, Owner step-up flows and invitation workflows for the exact privileged-account cardinality.
2. Group lifecycle/capacity transaction and member management, profile photo processing/private storage.
3. Savings posting and cash-loan verification/clearance transaction with row locks/idempotency.
4. Fine worker, weekly jobs/notifications and items/item loans.
5. Authorized reports, agreements and immutable document signing workflow.
6. WebSocket conversations, security centre, RLS, comprehensive integration/authorization/concurrency test suite.

Read the documentation before extending a route: all ownership and group scope must be enforced by the API/service/database layer, not inferred from a UI route or client-supplied ID.
