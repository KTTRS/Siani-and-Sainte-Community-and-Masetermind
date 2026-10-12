# Threat Model

## Project Overview

SAINTE is a public, production-deployed members platform with a React web client, Expo mobile app, and an Express/Node backend backed by Supabase Postgres and Supabase Auth. The highest-value production surface is the server API in `server/routes.ts`, which brokers highly sensitive member conversations with Siani, referral workflows, care-team messaging, invite/membership flows, public resource publishing, and organization analytics. Production scope for this scan excludes mockup/dev-only paths such as `artifacts/mockup-sandbox/**` and routes that explicitly self-disable when `NODE_ENV === "production"`.

## Assets

- **User accounts and session tokens** — Supabase bearer tokens and linked internal `users` rows. Compromise lets an attacker act as a member, care worker, or admin.
- **Member conversations and inferred mental-health/support data** — chat history, voice transcripts, emotional states, signals, memories, nudges, goals, referrals, care-team messages, and dossiers. This is the most sensitive data in the system.
- **Referral and verification records** — resource matches, referral state, verification evidence, trust/reliability scores, org contacts, and outcome notes. Unauthorized reads leak sensitive support history; unauthorized writes can falsify care workflows.
- **Membership and invite controls** — invite codes, membership keys, serial numbers, and tier assignments. These gate entry into the invite-only club and higher-tier experiences.
- **Institutional analytics data** — organization membership lists, user events, sentiment/risk scores, metric snapshots, and dashboard aggregates. Exposure harms member privacy and partner trust.
- **Application secrets and paid service credentials** — Supabase service role, OpenAI, ElevenLabs, Twilio, Expo Push, and optional 211/FindHelp keys. Misuse can expose data or drive cost.
- **Availability-sensitive compute paths** — GPT-5, Whisper, ElevenLabs, invite/SMS flows, and external resource sync calls. Abuse can create material cost or degrade service.

## Trust Boundaries

- **Public client to API** — browser/mobile requests are untrusted. Every server route must authenticate and authorize independently of client behavior.
- **Authenticated member to privileged data** — regular members must not access other members' data, care-team data, or organization analytics.
- **Member/chw/admin role boundary** — elevated roles must be enforced server-side for dashboard, care, invite, and admin actions.
- **Invite-only membership boundary** — public invite request and verification flows must not leak or mint valid membership credentials outside the intended approval process.
- **API to database** — the Express server can read and write all sensitive records. Route-level auth mistakes become direct database exposure or tampering.
- **API to external AI / messaging / partner APIs** — server calls OpenAI, ElevenLabs, Twilio, Expo Push, and optional referral APIs using secret credentials and billable operations.
- **Production vs dev-only code** — `server/**`, `client/**`, `mobile/**`, and shared auth/storage paths are production-relevant. `artifacts/mockup-sandbox/**` is dev-only unless explicitly proven reachable.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/routes/**/*.ts`, `server/sianiTurn.ts`, `server/middleware/auth.ts`, `server/middleware/ownership.ts`.
- **Highest-risk areas:** conversational endpoints (`/api/chat`, `/api/voice/*`), referral/verification flows, care-team messaging, institutional dashboard routes, invite/membership routes, public dossier sharing, resource publishing, and any route still trusting client-supplied `userId`.
- **Public surfaces:** invite request/verify flows, resource browsing/search, some org/resource read routes, public dossier-share routes, and any route missing `verifyToken`.
- **Authenticated surfaces:** most `/api/**` member actions; these still require per-resource ownership checks.
- **Privileged surfaces:** dashboard, escalations, org management, membership issuance/verification, and care-team actions.
- **Usually ignore unless proven reachable:** `artifacts/mockup-sandbox/**`, explicit `NODE_ENV !== "production"` helpers, local seeding endpoints.

## Threat Categories

### Spoofing

The app relies on Supabase bearer tokens, but many business actions also accept a client-supplied `userId`, serial number, or other identifier. The required guarantee is that once a request is authenticated, the acting user identity must come from `req.authUser`, not from request body/query parameters, except for narrowly authorized admin/care-team workflows.

### Tampering

Members can create referrals, notes, goals, messages, RSVPs, membership artifacts, and public resource entries that affect downstream support workflows. The required guarantee is that users may only mutate their own records unless a server-side role or ownership check explicitly authorizes cross-user action, and sensitive state changes must verify ownership of the target referral, note, conversation, membership record, or public catalog entry.

### Information Disclosure

The server stores highly sensitive conversation, referral, sentiment, risk, membership, and dossier data. The required guarantee is that API responses must be scoped to the authenticated user or authorized organization membership, and public routes must never expose referral notes, verification evidence, org contacts, membership details, or shareable member artifacts without deliberate opt-in and strong unguessable tokens.

### Denial of Service

Some routes trigger expensive operations: GPT-5/Whisper/ElevenLabs turns, SMS delivery, and optional external resource syncs. The required guarantee is that costly operations must be gated by authentication when appropriate, scoped to the caller, and protected against abuse so a low-privilege or anonymous user cannot force arbitrary spend or workload.

### Elevation of Privilege

SAINTE has clear privilege boundaries between members, care-team users, admins, and organization analysts. The required guarantee is that dashboard, org, escalation, invite, and membership capabilities must enforce organization membership and role checks server-side, and opaque IDs or serial formats must never be treated as sufficient authorization.