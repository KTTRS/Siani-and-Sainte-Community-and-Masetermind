# SAINTE — Security Policy

This document describes the threat model, hardening posture, and reporting
process for the SAINTE platform (web + React Native, Node/Express + Supabase
Postgres). It supersedes any prior security notes in `replit.md`.

## 1. Threat model

SAINTE handles sensitive Medicaid-adjacent member data (emotional state,
referrals, location, voice transcripts). The primary threats we defend against:

| # | Threat | Mitigation |
|---|---|---|
| T1 | **IDOR** — one member reading or mutating another's data via guessable IDs or `?userId=` query string | `verifyToken` + `requireOwnership(loader)` on every user-owned resource; `scopeToAuthUser()` rewrites client-supplied `userId` to `req.authUser.id` for non-privileged callers |
| T2 | **Privilege escalation** to care-team / admin endpoints (escalations, signals, organization metadata, resource-engine config) | `requireRole('admin' \| 'chw')` on every care-side route and admin mutation |
| T3 | **Credential / brute-force attacks** on auth + invite flows | `authRateLimiter` (10 req / 15 min per IP+user) on `/api/auth/sync`, `/api/auth/profile` (GET+PATCH), `/api/auth/onboarding/complete`, and the entire `/api/invites/*` router |
| T4 | **Cost / abuse** on AI endpoints | `chatRateLimiter` (10/min), `voiceRateLimiter` (60/10min), `apiRateLimiter` (100/min), `readRateLimiter` (200/min) |
| T5 | **Token / PII leakage via logs** | HTTP access logger no longer captures response bodies; only `method path status durationMs requestId` is emitted. Each request is tagged with `X-Request-Id` for incident correlation. |
| T6 | **XSS, click-jacking, mixed content** | `helmet()` with strict production CSP (`default-src 'self'`, no inline scripts, `frame-ancestors 'none'`, `object-src 'none'`, allowed `connect-src`: Supabase REST + Realtime, OpenAI, ElevenLabs, Expo push). CSP relaxed only in dev to allow Vite HMR. |
| T7 | **Mass-assignment / oversized payloads** | Zod schemas on every mutation (`insertGoalSchema`, `insertMoveSchema`, plus inline strict schemas for moves/memories/nudges). JSON body limit `2mb`, urlencoded `1mb`. |
| T8 | **Unauthenticated dev endpoints leaking into prod** | `/api/dev/*` returns `403` when `NODE_ENV === 'production'`. |
| T9 | **Supply chain** | `npm audit` gated to fail on `high`+`critical`. Residual moderate/low advisories tracked in `replit.md` "Dependency Audit Status". |

## 2. Authentication & authorization

- **Identity:** Supabase Auth issues JWTs; `server/middleware/auth.ts#verifyToken`
  validates them on every protected route and resolves the user's engagement
  profile from the `users` table into `req.authUser`.
- **Roles:** `member` (default), `icon`, `chw` (community health worker),
  `admin`. Use `requireRole(...allowed)` to gate care-side and admin endpoints.
- **Ownership:** For any resource keyed by member ID (goals, moves, referrals,
  memories, nudges, RSVPs, reactions, care threads), use one of:
  - `requireOwnership(loader)` — fetches the resource and returns `403` unless
    `resource.userId === req.authUser.id`. Admins/CHWs bypass.
  - `scopeToAuthUser()` — for list endpoints; rewrites `req.query.userId` and
    `req.body.userId` to the authenticated user's ID for non-privileged callers,
    making `?userId=other` IDOR attempts a no-op.
- **Public surfaces (intentional):** `/api/resources*` (read-only catalog),
  `/api/voice/health`, `/api/flow/drops|signals|spotlights` (public feeds),
  `/api/invites/{request,verify,claim}` (waitlist signup — rate limited),
  `/api/membership/verify` (door check-in QR).

## 3. Rate limiting profile

In-memory sliding window keyed by `ip:userId` (`server/middleware/rateLimit.ts`):

| Profile | Window | Max | Applied to |
|---|---|---|---|
| `auth` | 15 min | 10 | `/api/auth/*`, all `/api/invites/*` |
| `chat` | 1 min | 10 | text chat `/api/chat` |
| `voice` | 10 min | 60 | `/api/voice/chat`, `/api/voice/transcribe`, TTS |
| `api` | 1 min | 100 | mutating user routes |
| `read` | 1 min | 200 | catalog reads, public feeds |

Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset`, and `Retry-After` on `429`.

## 4. Logging & observability

- `server/middleware/requestId.ts` generates (or honors a sanitized incoming)
  `X-Request-Id` for every request and echoes it on the response.
- The HTTP access logger writes one redacted line per `/api/*` request:
  `METHOD PATH STATUS in DURATIONms rid=<uuid>`. **Response bodies, request
  bodies, query strings, and auth headers are never logged.**
- 5xx errors log `[status] message` plus the stack via the global error
  handler in `server/index.ts` — these end up in the platform deploy logs and
  can be correlated with the client `X-Request-Id`.

## 5. Transport, headers, and content security

`helmet()` is installed before all routes:

- `Content-Security-Policy` (production only): `default-src 'self'`,
  `script-src 'self' 'wasm-unsafe-eval'`, `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`, `connect-src 'self' https://*.supabase.co
  wss://*.supabase.co https://api.openai.com https://api.elevenlabs.io
  wss://api.elevenlabs.io https://exp.host https://*.expo.dev https://*.expo.io`,
  `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
  `upgrade-insecure-requests`.
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-DNS-Prefetch-Control` etc. are emitted by `helmet` (Referrer-Policy is
  explicitly configured; the rest come from helmet defaults).
- `crossOriginResourcePolicy: cross-origin` permits the React Native app and
  PWA service worker to fetch hashed static assets.

## 6. Secrets management

- All credentials live in environment variables (Supabase URL + service role
  key, OpenAI / ElevenLabs / Twilio keys, `SESSION_SECRET`).
- No hardcoded fallbacks for Supabase URLs (verified in `server/db.ts` and
  `mobile/src/lib/supabase.ts`).
- `SESSION_SECRET` is required for membership-card JWT signing; if missing the
  server falls back to a development constant — set it in production.

## 7. Reporting a vulnerability

Email **security@sainte.app** with:

1. A description of the issue and impact.
2. A minimal reproduction (curl or HAR is ideal — please omit any real member
   data).
3. The `X-Request-Id` from any sample requests if available.

We aim to acknowledge within 48 hours and ship a fix or mitigation for
high/critical findings within 7 days. Please give us coordinated-disclosure
time before public write-up.

## 8. Out-of-scope / accepted risks

See `replit.md` → "Security — Dependency Audit Status" for the current list of
deferred npm advisories (all moderate or lower, all dev-only or upstream-blocked).
The audit gate fails CI on `high` and `critical` only.
