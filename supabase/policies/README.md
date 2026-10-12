# Supabase Row-Level Security policies

These SQL files declare RLS policies for the SAINTE Postgres schema. They
are idempotent (every policy uses `DROP POLICY IF EXISTS` followed by
`CREATE POLICY`) and can be replayed safely against any Supabase project.

## Apply

```sh
psql "$SUPABASE_DATABASE_URL" -f supabase/policies/00_enable_rls.sql
psql "$SUPABASE_DATABASE_URL" -f supabase/policies/10_user_owned.sql
psql "$SUPABASE_DATABASE_URL" -f supabase/policies/20_vault.sql
psql "$SUPABASE_DATABASE_URL" -f supabase/policies/30_referrals.sql
```

## Model

Application traffic that needs to bypass RLS uses the **service role** key
(server-side only — see `server/db.ts` and `server/dataLake.ts`). The
service role bypasses RLS by design.

End-user traffic flowing through Supabase Auth uses the **anon** key with a
JWT bound to `auth.uid()`. The policies below restrict every user-owned
table to rows where `users.auth_user_id = auth.uid()`.

Vault confessions are deliberately readable by all authenticated members
but writable only by the row owner (when not anonymous). Anonymous rows
have `user_id IS NULL` and are immutable from client traffic.
