# SAINTE — Exclusive Members Club

## Overview

SAINTE is an exclusive, luxury lifestyle members-only platform presented as a voice-first AI companion, **Siani**. Its purpose is to democratize access to vital resources for Medicaid populations through an engaging, non-clinical platform with an aspirational, streetwear-inspired aesthetic. Engagement is dopamine-driven and framed as an exclusive social club — never as a wellness or clinical app.

## User Preferences

Preferred communication style: simple, everyday language.

## Design Philosophy — Organic Futurism (locked, supersedes all prior directions)

**Vibe.** Cult-coded forest interface. Material vocabulary: resin · glass · fog · silicone · moss · gel. Hypermodern physical-digital, near-3D surfaces with gravity, low light + rare heat bursts. Always luxury ritual object / sacred interface / charged surface. **Never** corporate, clinical, pastel, bubbly, tech-corporate, fluorescent, or childish.

**Palette.**
- *Everglade greens (resin matte):* `#0C1712` everglade-950 (void/shadow) · `#12221A` everglade-900 (primary bg) · `#193024` everglade-800 (cards) · `#1F3E2D` everglade-700 (component bases) · `#28513A` everglade-600 (active).
- *Lime accent (single charged accent):* `#C7FF3E` lime-core · `#E2FF9B` lime-soft · `rgba(199,255,62,0.32)` lime-glow halo. Used only on everglade-900/950 surfaces, **never** on body text.
- *Mint gel:* `#E6FFE8` mint-200 · `#D9FBD9` mint-300 · `#A7E9BC` mint-500.
- *Fog neutrals:* `#F6F8F7` fog-100 (text) · `#E9EEEC` fog-200 · `rgba(255,255,255,0.20)` fog-500 (frosted blur).
- *Obsidian shadow stack:* `rgba(0,0,0, .12 / .22 / .40 / .64)`.
- *Emotional semantics:* calm `#4C8064` · warmth `#F6EFD9` · pressure `#2D1E18` · arc-down `#C26D5A`.
- Accessibility: 4.5:1 minimum contrast. Mint + lime never used for body text.

**Surface depth (4-tier physical model).**
- *Tier 0 — The Void:* everglade-950, no texture, 1–3% atmospheric noise.
- *Tier 1 — Floating Surfaces:* cards, radius 16–24px, downward shadow blur 8–14 @ 20–30% opacity, 1–2px top-left inner highlight, matte + whisper sheen.
- *Tier 2 — Charged Objects:* orb, gel buttons, capsules, vault — luminous, hot, alive, magnetized.
- *Tier 3 — The Orb:* multi-layer water-glass + silicone, fog-100 → mint-200 inner, everglade-900 outer rim, lime-glow halo, breathes + rotates subtly.

**Glow rules.** Reserved for the orb / vault / arc-unlocks / rare moments. **Never** on buttons, text, headers, badges, or tabs.

**Type.** Logo only (SIANI / SAINTE display) = **Wealth**. Everything else = **Neue Haas Grotesk** (weights 400/500/600/700) — *Inter* is the open substitute when Wealth/Neue Haas isn't licensed. Display "3D material letters" treatments (TYPE-GLASS / MOSS / SILICONE / FOAM / GEL) layer over Neue Haas. Italic + serif **forbidden**. UPPERCASE for display + labels; sentence case body only. Numerals tabular.

**Motion.** Slow, cinematic, weighted, hypnotic, ritual. Never cute, bouncy, or elastic. Micro (<400ms): card press, move complete, orb breathing, capsule crack. Macro (400–1200ms): arc transitions, vault unlock, drop reveal. Buttons press down like physical buttons (no bounce, no glow increase). Reduced-motion ⇒ instant. Orb is the only object that breathes.

**Haptics + sound.** Mil-spec sound layer in `client/src/lib/useSound.ts` (mono synthesized cues, no samples, no music): `playTap/Soft/Click/Commit/SignalIn/Drop/Success/Warn/Rise/SianiListen`. Paired haptic patterns in `client/src/lib/haptics.ts` (`tap / soft / click / success / warn / rise` via `navigator.vibrate`). Card dip 1–2px + tighten shadow + edge-light + quick haptic. Bag: create medium / progress light / completion medium-success. Vault: crack tick+pop / claim full-success. Siani: orb tap subtle / important line light heartbeat. All honor `prefers-reduced-motion`.

**Iconography.** Primary set = premium 3D PNGs synced from Object Storage `to use for app/` (142 assets, mint-gel resin look) into `client/public/icons3d/` + `mobile/assets/icons3d/`. Web registry: `PNG_REGISTRY` in `client/src/lib/icons3d.tsx` (consumed via `<Icon3DImage icon=... />` or `<MilspecIcon />`); mobile mirror: `Icon3DSources` + `<Icon3D />` in `mobile/src/lib/icons3d.ts`. Both must be updated together. PWA manifest + Expo launcher art (`icon`, `adaptiveIcon`, `splash`, expo-notifications) all point at the premium crown asset; notification accent + adaptive bg = `#12221A` everglade-900 (legacy `#0A0A0A` + `#DC143C` removed). The custom 32×32 mint-gel SVG glyph set is the automatic fallback for any key without a PNG override. Lucide is reserved for shadcn chrome (close X, menu carets, form input adornments) only. Locked Milspec glyphs: orb, signal, drop, card, qr, vault, heat, cred, streak, member, enc, escalate.

**Forbidden.** Italic. Serif. Neon. Pastel. Bubbly geometry. Glow on buttons/text/headers/badges/tabs. Tech-corporate or clinical chrome. Cute / bouncy / elastic motion. Colored shadows. Fluorescent accents.

### Token foundation

- `client/src/index.css` is the single source of truth. Exposes `--everglade-{950..600}`, `--lime-{core,soft,glow}`, `--mint-{200,300,500}`, `--fog-{100,200,500}`, `--obsidian-{300..900}`, plus semantic tokens `--bg / --surface / --surface-2 / --rim / --signal / --ok / --hi / --mid / --lo`. Legacy `--crimson*` tokens alias to `--lime-core` so any unswept screen auto-renders in the new accent.
- `tailwind.config.ts` mirrors with `everglade.{950..600}`, `mint.{200..500}`, `fog.{100,200}`, `lime.{core,soft,bright,muted,dark}`.
- `client/src/styles/organic-futurism.css` holds the Login / hero surface system (`.of-screen`, `.of-eyebrow`, `.of-hero-siani`, `.of-orb`, `.of-btn.gel/.ghost`, `.of-foot`, `.of-foot-powered`).
- `client/src/styles/direction-d.css` is preserved as a file path for back-compat — its contents have been fully rewritten in the Organic Futurism vocabulary so the legacy `.dir-d-root / .d-screen / .d-display / .d-btn / .d-sheet / .d-input / .d-foot` classes resolve to forest-matte surfaces, mint-gel pills, and fog-toned typography.

### Mobile parity

`mobile/src/theme/colors.ts` re-exports the same vocabulary as JS constants (`colors`, `fonts`, `radius`, `spacing`, `sizing`, `motion`, `sound`, `depth`). Legacy keys (`crimson`, `crimsonDark`, `crimsonMatte`, `surfaceElevated`, etc.) alias to the new lime / everglade values so React Native screens render identically without a migration sweep. `mobile/src/lib/haptics.ts` exposes the same paced rhythm vocabulary (tap / soft / click / success / warn / rise) with `prefers-reduced-motion` gating via `AccessibilityInfo`.

## System Architecture

### Frontend

- **Framework:** React + TypeScript (Vite).
- **Routing:** Wouter.
- **UI:** Radix UI primitives + shadcn/ui, Tailwind CSS, Framer Motion.
- **State:** TanStack Query for server state, local React state for UI.
- **PWA:** Manifest + service worker (production-only registration to avoid Vite HMR conflicts), offline support, push notifications.
- **Mobile:** Optimized for iOS Safari / Android Chrome, plus a dedicated React Native app (`/mobile`) on Expo SDK 54 for native voice + the gamified Night Shift experience.
- **Night Shift experience:** Scarcity / surprise / status / FOMO via `SignalDropScreen` (timed intel), `TheDropScreen` (exclusive opportunities), `HeatIndexScreen` (leaderboard), `TheVaultScreen` (confessional).
- **Gamification:** "CRED" (not XP), streaks, badges, levels, celebration overlays.
- **Core experiences:** Onboarding ritual, digital membership cards with QR codes, goal completion rituals (coin drop animation, haptic feedback, Siani nudges).

### Backend

- **Server:** Express.js on Node.js (HTTP + WebSocket).
- **Siani's brain:** OpenAI **GPT-5** is the sole LLM for all conversation + reasoning. Anthropic/Claude has been fully removed.
  - **GPT-5 quirks:** (1) only the default temperature is supported — passing `temperature` returns 400. (2) It's a reasoning model — hidden reasoning tokens count against `max_completion_tokens`. Always pass `reasoning_effort: "minimal"` for chat-style turns or the model burns the entire budget on reasoning and returns empty content (`finish_reason: "length"`, `reasoning_tokens === max_completion_tokens`).
- **Voice pipeline:** OpenAI Whisper (STT) + ElevenLabs `eleven_flash_v2_5` (TTS, premium). OpenAI TTS is the automatic fallback if ElevenLabs auth fails.
- **Engine architecture:** LLM-orchestrated, comprising 12 core engines (e.g. Trauma-Aware, Emotional Attunement), 6 trait-building engines, and specialized systems (Joy Induction, Dopamine/Motivational).
- **Shared Siani turn pipeline:** `server/sianiTurn.ts` exports `runSianiTurn({ user, message, conversationId, prosody, modality })` — the **single** source of truth for any conversational turn. Both `/api/chat` (text) and `/api/voice/chat` (voice) call it, so voice + text get identical engines, memory, resources, referrals, signals, escalations, and goal extraction. The voice route adds STT before and TTS after; text returns JSON. `voiceService` exposes `transcribeAudio()` and `sanitizeForSpeech()`.
- **Closed-loop referral system:** Inside `runSianiTurn` Siani detects needs across 8 categories, calls `smartMatcher.match()`, and injects real Michigan resource names/contact into the system prompt via `userContext.availableResources` so she names actual places (e.g. "Gleaners Community Food Bank") instead of speaking generically. Active referrals load into `userContext.activeReferrals` so `buildReferralFollowUpContext()` fires. Short acceptance ("yes", "hook me up", etc.) plus a named known resource auto-creates a referral with `source: "siani"`. Response includes `matchedResources`, `detectedNeeds`, `shouldEscalate`, `referralCreated`. Verified completions reward CRED.
- **Membership:** Multi-step invite request flow, SMS-based invite codes, digital membership cards, JWT-based access, tier system.
- **Push notifications:** Server-side token management + triggered notifications via Expo Push API.
- **Auth:** Supabase Auth (full flow), JWT verification, user sync, profile lookup, role-based access (member, icon, chw, admin).

### Data storage

- **Database:** Supabase PostgreSQL with Drizzle ORM.
- **Realtime:** Supabase Realtime for event broadcasting.
- **Object storage:** Supabase Storage data lake (`sainte-data-lake` bucket, auto-created) implemented in `server/dataLake.ts` as `SupabaseStorageDataLake`. Project is fully AWS-free.
- **Schema highlights:** Users, Conversations, Messages, Emotional States, Gamification (Badges, Goals, `streak_freezes`, `streak_recovery_quests`), "The Flow" (drops, feedSignals, spotlights), Night Shift (`vault_confessions`, `heat_rankings`), Membership (`invite_requests`, `events`, `membership_keys`), Siani's memories + nudges, User Locations (geo-matching).

### Resource system

- **Seed data:** 148 verified Michigan resources loaded on startup from `server/seed-michigan.ts` (101 covering Detroit, Flint, Lansing, Jackson, Ann Arbor, Traverse City, UP) + 63 inline in `server/routes.ts` `seedResourcesIfEmpty()`. Deduped by name.
- **Free public APIs (no key):** `server/services/free-resource-apis.ts` pulls HUD ArcGIS feature services on startup — Public Housing Authorities (~126 MI), HUD Housing Counseling Agencies (~203 MI), Single-Family Housing Counseling Agencies (~62 MI). Auto-syncs to Supabase via `autoSyncExternalResources()`. Live total ~438 Michigan resources at zero API cost.
- **SmartMatcher:** HSDS-compliant index covering all 10 categories (food, housing, mental_health, financial, employment, transportation, legal, education, healthcare, crisis). Re-initialized after each sync so newly imported resources are immediately searchable.
- **Paid APIs (optional):** 211 National Data Platform + FindHelp wrappers in `server/services/resource-apis.ts`; auto-sync when `API_211_KEY` or `FINDHELP_API_KEY` + `FINDHELP_BASE_URL` are configured.
- **Vault confessions data mapping:** API returns flat fields (`fireCount`, `heartCount`, `strengthCount`); frontend maps to `reactions: { fire, heart, strength }` in `VaultConfessions.tsx`.

### Security & performance

- **Auth middleware:** All mutation routes and user-data routes are protected with `verifyToken` (Supabase JWT). Public read-only routes (badges list, resources list, voice health) remain open.
- **DB indexes:** 21 performance indexes created on startup via `createPerformanceIndexes()` in `server/db-init.ts` covering all major foreign-key columns.
- **OpenAI client:** Centralized in `server/integrations/openai.ts` — single shared client used by `siani.ts`, `voice.ts`, `whisperProvider.ts`, `openaiTTSProvider.ts`. Two variants: direct (`getOpenAIClient()`) and proxy-aware (`getOpenAIClientWithProxy()`).
- **ElevenLabs resilience:** Provider auto-disables on 401/403 to prevent repeated failed requests; falls back to OpenAI TTS automatically.
- **Supabase config:** No hardcoded fallback URLs — all connections require env vars (`SUPABASE_URL`, `VITE_SUPABASE_URL`, mobile `EXPO_PUBLIC_SUPABASE_URL`).
- **DB bootstrap:** `initializeDatabase()` in `server/db-init.ts` creates all required tables (incl. `siani_memories`, `siani_nudges`) via `CREATE TABLE IF NOT EXISTS` for reproducible fresh deployments.
- **Dashboards:** Payer (`/dashboard/payer`) and Provider (`/dashboard/provider`) fetch from real `/api/dashboard/*` endpoints. With no organization data they show a "DEMO" badge and fall back to built-in presentation data.
- **Graceful shutdown:** Centralized in `server/index.ts` — handles SIGTERM/SIGINT for autoscale deployments, closes HTTP server + DB connections, 10s forced-exit timeout. `uncaughtException` triggers graceful shutdown; `unhandledRejection` logs only.

## External Dependencies

- **AI services:** OpenAI (GPT-5 LLM, Whisper STT, OpenAI TTS as fallback), ElevenLabs (TTS + conversational agents).
- **Database & storage:** Supabase PostgreSQL, Supabase Realtime, Supabase Storage, Neon Serverless PostgreSQL.
- **UI libraries:** Radix UI, Lucide React, Framer Motion, date-fns, react-day-picker.
- **Dev tools:** TypeScript, ESLint, Prettier, Vite.
- **APIs:** Twilio (SMS), 211 National Data Platform, FindHelp, Expo Push.

## Security — Dependency Audit Status

**Last audited:** May 2026 (Tasks #72, #73, #80). All 5 vulnerabilities flagged by the most recent scan are resolved (0 high, 0 critical, 0 moderate from direct/transitive prod deps). Resolutions:

- **ws** upgraded `8.18.3 → 8.20.1` (GHSA-58qx-3vcg-4xpx).
- **uuid** forced to `11.1.1` via top-level `overrides` (GHSA-w5hq-g745-h8pq). All transitive consumers via `@replit/object-storage → @google-cloud/storage → gaxios/teeny-request` confirmed overridden.
- **vite** upgraded `5.4.21 → 6.4.2` (GHSA-4w7w-66w2-5vf9). Vite 6.4.2 bundles `esbuild@^0.25.0` (patched), replacing the vulnerable `0.21.5`. Config files unchanged — APIs stable across v5/v6.
- **esbuild@0.18.20** (nested inside `@esbuild-kit/core-utils`, dragged in by `drizzle-kit → @esbuild-kit/esm-loader`) forced to `0.25.9` via nested `overrides` in `package.json`:
  ```json
  "@esbuild-kit/core-utils": { "esbuild": "0.25.9" },
  "@esbuild-kit/esm-loader": { "@esbuild-kit/core-utils": { "esbuild": "0.25.9" } }
  ```
  Verified by `npm ls esbuild --all` — every esbuild in the tree is now `≥0.25.9` (drizzle-kit: 0.25.9 + 0.25.12, vite: 0.25.12, tsx: 0.27.7).
- **brace-expansion@5.0.5** — not present in the tree (only v2.x), so no action required.
- **postcss@8.4.49** — already at `8.5.14`, no action required.

### Accepted residual risks

None from direct or transitive production dependencies. `npm audit` may still surface low-severity `@tootallnate/once` findings via `@replit/object-storage`; those are marked "no fix available" upstream and are accepted until the Replit-managed package ships a fix.

**Audit gating recommendation:** CI should fail on `high` and `critical` severity.
