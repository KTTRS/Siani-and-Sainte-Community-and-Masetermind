# SAINTE Data Model & Lifecycle

This document is the operator-facing reference for how SAINTE data is laid
out, retained, deleted, and protected. It complements `shared/schema.ts`
(authoritative table definitions) and `supabase/policies/` (Row-Level
Security) — read those alongside this guide.

## Storage tiers

| Tier | System | What lives here |
|---|---|---|
| Hot | Supabase PostgreSQL | All transactional rows: users, conversations, messages, emotional_states, signals, goals, moves, vault confessions/reactions/spotlights, referrals, organization rows, gamification (CRED, streak freezes, recovery quests), Siani memories + nudges. |
| Warm | Supabase Storage (`sainte-data-lake` bucket, `analytics/` and `reports/` prefixes) | Daily retention snapshots, organization analytics exports, dashboard report exports. Date-partitioned `analytics/<category>/YYYY/MM/DD/<ts>.json` and `reports/<type>/<date>_<ts>.{json,csv}`. |
| Cold | n/a | SAINTE does not currently archive to a glacier-style tier. The data lake is the durable archive of last resort. |

## Foreign-key behavior (cascades)

The schema deliberately splits FKs into two policies:

- **`onDelete: "cascade"`** — applied to every row that is *owned* by a
  user (conversations, messages, emotional_states, signals, goals, moves,
  cred/xp transactions, badges, memories, nudges, locations, vault
  reactions, non-anonymous vault confessions, streak freezes, recovery
  quests, event check-ins, vault spotlights). Deleting the user (or the
  parent confession) reaps the dependent rows automatically.
- **`onDelete: "set null"`** — applied to assignment-style or annotation
  fields where the historical row should outlive the actor: `escalations.assigned_to`,
  `polls.author_id`, `organization_issues.resolved_by/reported_by`,
  `siani_memories.source_conversation_id`,
  `emotional_states.message_id`, `signals.message_id`. The retention
  worker depends on these to prune raw messages without breaking
  downstream analytics rows.

Anonymous vault confessions store `user_id = NULL` so deletion of the
author leaves the confession untouched — anonymity persists by design.

`server/db-init.ts → reconcileForeignKeyCascades()` re-applies these
policies on every boot using `ALTER TABLE … DROP CONSTRAINT … ADD
CONSTRAINT` so legacy databases that pre-date the cascade overhaul are
brought up to spec without a manual migration. Immediately after, the
boot path calls `assertSchemaIntegrity()` which queries `pg_constraint`
for every required FK and **throws** if any cascade behavior is missing
or wrong — so the server never accepts traffic against a
half-migrated schema.

### FK parity matrix (shared/schema.ts ↔ db-init.ts ↔ assertSchemaIntegrity)

| Table.Column | onDelete | Notes |
|---|---|---|
| goals.user_id | CASCADE | owned |
| moves.user_id | CASCADE | owned |
| moves.goal_id | CASCADE | reaped with parent goal |
| cred_transactions.user_id | CASCADE | owned |
| siani_memories.user_id | CASCADE | owned |
| siani_memories.source_conversation_id | SET NULL | conversation may be pruned |
| siani_nudges.user_id | CASCADE | owned |
| siani_nudges.related_goal_id | CASCADE | nudge dies with the goal it referenced |
| siani_nudges.related_memory_id | CASCADE | nudge dies with the memory it referenced |
| streak_freezes.user_id | CASCADE | owned |
| streak_recovery_quests.user_id | CASCADE | owned |
| event_checkins.event_id | CASCADE | reaped with parent event |
| event_checkins.user_id | CASCADE | owned |
| event_checkins.membership_key_id | SET NULL | key may be revoked |
| vault_reactions.confession_id | CASCADE | reaction dies with confession |
| vault_spotlights.confession_id | CASCADE | spotlight dies with confession |
| emotional_states.message_id | SET NULL | message retention may prune the parent |
| signals.message_id | SET NULL | message retention may prune the parent |

## GDPR / account deletion

- Endpoint: `DELETE /api/users/me` (auth required, JWT)
- Body must include `{ "confirmation": "DELETE MY ACCOUNT" }`; missing or
  wrong confirmation → `400`.
- Implementation: `storage.deleteUser(id)` runs `DELETE FROM users WHERE
  id = $1`. The cascade rules above do the rest.
- Anonymous vault confessions are preserved (already `user_id = NULL`).
- Returns `200 { success: true, deletedUserId }` on success; `404` if the
  caller's user row was already gone (e.g. a stale token after a previous
  delete). Clients should treat both as "account is gone".

## Retention worker (`server/retentionWorker.ts`)

A single in-process worker scheduled on `RETENTION_INTERVAL_HOURS` (default 6h)
performs four sweeps:

| Stream | Default window | Env override | Action |
|---|---|---|---|
| Vault expirations | unconditional | n/a | `DELETE FROM vault_confessions WHERE expires_at < NOW()` |
| Raw messages | 365 d | `MESSAGE_RETENTION_DAYS` | hard delete |
| Emotional states | 180 d | `EMOTIONAL_STATE_RETENTION_DAYS` | hard delete |
| Data-lake `analytics/` | 365 d | `ANALYTICS_RETENTION_DAYS` | object delete |
| Data-lake `reports/` | 730 d | `REPORTS_RETENTION_DAYS` | object delete |

Setting any window to `0` disables that stream (operator escape hatch).
Setting `RETENTION_WORKER_DISABLED=true` disables the worker entirely.

Before each pass the worker writes a snapshot of *candidate* counts to
`analytics/retention/…` so we always have an offline trail of what was
about to be deleted.

## Idempotent seeds

Both `server/seed-michigan.ts` and `server/seed-resources.ts` are safe to
run repeatedly. They first check for an existing row by `name`; the
fallback `INSERT` carries `ON CONFLICT ((LOWER(name))) DO NOTHING` against
the case-insensitive unique index `resources_name_lower_key` (created in
`db-init.ts`). Re-runs converge instead of duplicating.

## Row-Level Security (`supabase/policies/`)

RLS is enabled on every user-touched table (`00_enable_rls.sql`). The
generic owner policy in `10_user_owned.sql` covers every table whose
primary scope is `user_id`:

```
user_locations, conversations, emotional_states, signals,
goals, moves, check_ins, xp_transactions, cred_transactions,
streak_freezes, streak_recovery_quests, siani_memories,
siani_nudges, user_badges, notifications, referrals,
vault_reactions
```

Plus targeted policies:

- `messages` — joined through `conversations.user_id`.
- `vault_confessions` — readable by all authenticated members; writable
  only by the row owner (and only when not anonymous).
- `vault_spotlights` — read-only to clients; service role mutates.
- `resources`, `badges` — read-only to anon + authenticated.

Server traffic uses the **service-role** key (RLS bypass) by design.
End-user traffic must flow through Supabase Auth so `auth.uid()` resolves
to the correct row.

## IStorage discipline

`server/storage.ts` is the only module that talks to the database via
Drizzle. Route handlers receive the singleton `storage` and call typed
methods on it. The vault routes (`server/routes/vault.ts`) were the last
holdouts — they were refactored in Task #52 to use
`storage.getVaultFeedPublic`, `getVaultSpotlightsPublic`,
`createVaultConfessionForUser`, `applyVaultReaction`, `awardCred`, etc.
New routes MUST follow this pattern: no `import { db }` inside any file
under `server/routes/` or `server/services/`.

## Data lake admin access

`dataLake` (the singleton from `server/dataLake.ts`) exposes
`listFiles`, `getFile`, `getFileStream`, `deleteFiles`, and
`pruneOlderThan(prefix, days)`. The retention worker uses
`pruneOlderThan` for the warm-tier sweep. A future admin endpoint can
expose `listFiles` / `getFile` for forensic review (proposed as Task #62).
