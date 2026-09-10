# Reviewed migration sequence

- `0001_init/migration.sql` is the committed baseline generated from `../schema.prisma` with `prisma migrate diff`.
- `0002_financial_and_access_invariants/migration.sql` adds reviewed PostgreSQL triggers/checks for financial immutability, member-capacity concurrency, operational threshold and privileged-role cardinality.

Run migrations only using the dedicated migration credential:

```bash
npm run db:generate
npm run db:migrate:deploy
```

Never use `prisma db push` in staging or production. Before a destructive/future migration: take a backup, rehearse on production-like staging, use a forward-only/reversible plan, and verify restoration. PostgreSQL role grants and RLS policies are provisioned by IaC after the application’s authorization test suite is in place.
