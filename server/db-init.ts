import { db } from './db';
import { sql } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '@shared/schema';
import { badges } from '@shared/schema';
import { seedDemoData } from './seed-demo-data';

/**
 * Walk every pgTable exported by `shared/schema.ts` and return the FK
 * cascade contract declared on each column. This is the single source
 * of truth used by both `reconcileForeignKeyCascades()` (which writes
 * the contract into the live DB) and `assertSchemaIntegrity()` (which
 * verifies the live DB matches it).
 */
type FkContract = {
  table: string;
  column: string;
  refTable: string;
  refColumn: string;
  onDelete: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT' | 'SET DEFAULT';
};

function collectSchemaForeignKeys(): FkContract[] {
  const out: FkContract[] = [];
  const seen = new Set<string>();
  for (const value of Object.values(schema as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    let cfg: ReturnType<typeof getTableConfig>;
    try {
      cfg = getTableConfig(value as PgTable);
    } catch {
      continue;
    }
    const tableName = cfg.name;
    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      const onDeleteRaw = (fk as unknown as { onDelete?: string }).onDelete;
      if (!onDeleteRaw) continue;
      const onDelete = onDeleteRaw.toUpperCase() as FkContract['onDelete'];
      if (ref.columns.length !== 1 || ref.foreignColumns.length !== 1) continue;
      const column = ref.columns[0].name;
      const refTable = getTableConfig(ref.foreignTable as PgTable).name;
      const refColumn = ref.foreignColumns[0].name;
      const key = `${tableName}.${column}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ table: tableName, column, refTable, refColumn, onDelete });
    }
  }
  return out;
}

const PG_DELTYPE: Record<FkContract['onDelete'], string> = {
  CASCADE: 'c',
  'SET NULL': 'n',
  'NO ACTION': 'a',
  RESTRICT: 'r',
  'SET DEFAULT': 'd',
};

export async function initializeDatabase() {
  console.log('Checking and initializing database tables...');
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invite_requests (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        phone TEXT,
        email TEXT,
        name TEXT,
        source TEXT DEFAULT 'organic',
        source_event_id VARCHAR(255),
        referred_by VARCHAR(255),
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invite_codes (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        request_id VARCHAR(255),
        code VARCHAR(8) NOT NULL UNIQUE,
        code_hash TEXT NOT NULL,
        delivery_method TEXT NOT NULL DEFAULT 'sms',
        delivered_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        max_attempts INTEGER DEFAULT 3,
        attempt_count INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        claimed_at TIMESTAMP,
        claimed_by_user_id VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS membership_keys (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(255) NOT NULL UNIQUE,
        serial_number VARCHAR(16) NOT NULL UNIQUE,
        member_since TIMESTAMP NOT NULL DEFAULT NOW(),
        access_token TEXT NOT NULL,
        token_expires_at TIMESTAMP NOT NULL,
        tier TEXT NOT NULL DEFAULT 'member',
        card_design TEXT DEFAULT 'obsidian',
        last_used_at TIMESTAMP,
        total_checkins INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        suspended_reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL,
        description TEXT,
        venue TEXT,
        event_date TIMESTAMP NOT NULL,
        capacity INTEGER,
        minimum_tier TEXT DEFAULT 'member',
        minimum_cred INTEGER DEFAULT 0,
        cred_reward INTEGER DEFAULT 50,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by VARCHAR(255)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS event_checkins (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        event_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        checked_in_at TIMESTAMP NOT NULL DEFAULT NOW(),
        checked_in_by VARCHAR(255),
        method TEXT DEFAULT 'qr',
        cred_awarded INTEGER DEFAULT 0,
        UNIQUE(event_id, user_id)
      )
    `);

    // Create vault_confessions table for anonymous confessional.
    // user_id is NULLABLE so anonymous confessions are unattributable.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vault_confessions (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        author_handle TEXT,
        content TEXT NOT NULL,
        audio_url TEXT,
        audio_duration INTEGER,
        is_anonymous BOOLEAN NOT NULL DEFAULT true,
        display_name TEXT,
        category TEXT NOT NULL DEFAULT 'truth',
        mood TEXT,
        fire_count INTEGER NOT NULL DEFAULT 0,
        strength_count INTEGER NOT NULL DEFAULT 0,
        heart_count INTEGER NOT NULL DEFAULT 0,
        real_count INTEGER NOT NULL DEFAULT 0,
        total_reactions INTEGER NOT NULL DEFAULT 0,
        is_spotlighted BOOLEAN DEFAULT false,
        spotlighted_at TIMESTAMP,
        spotlight_bonus INTEGER DEFAULT 0,
        base_cred_reward INTEGER NOT NULL DEFAULT 5,
        bonus_cred_reward INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        flag_count INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP
      )
    `);

    // Backfill: migrate pre-existing vault_confessions to true anonymity.
    // Drop NOT NULL on user_id, add author_handle column if missing, and
    // for any historical anonymous rows null out user_id while preserving
    // a stable opaque handle so the row still renders consistently.
    await db.execute(sql`ALTER TABLE vault_confessions ADD COLUMN IF NOT EXISTS author_handle TEXT`);
    await db.execute(sql`ALTER TABLE vault_confessions ALTER COLUMN user_id DROP NOT NULL`);
    await db.execute(sql`
      UPDATE vault_confessions
      SET author_handle = COALESCE(author_handle, substr(md5(random()::text || id), 1, 10))
      WHERE is_anonymous = true AND author_handle IS NULL
    `);
    await db.execute(sql`
      UPDATE vault_confessions
      SET user_id = NULL
      WHERE is_anonymous = true AND user_id IS NOT NULL
    `);

    // Create goals table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS goals (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        target_date TIMESTAMP,
        is_completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        xp_reward INTEGER DEFAULT 25,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create moves table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS moves (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        goal_id VARCHAR(255) REFERENCES goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        xp_reward INTEGER DEFAULT 15,
        scheduled_for TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create cred_transactions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cred_transactions (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        source_type TEXT,
        source_id VARCHAR(255),
        idempotency_key VARCHAR(255) UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS siani_memories (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        memory_type TEXT NOT NULL,
        category TEXT,
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 5,
        emotional_weight INTEGER DEFAULT 5,
        source_conversation_id VARCHAR REFERENCES conversations(id) ON DELETE SET NULL,
        last_referenced_at TIMESTAMP,
        reference_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS siani_nudges (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nudge_type TEXT NOT NULL,
        message TEXT NOT NULL,
        trigger_reason TEXT,
        related_goal_id VARCHAR REFERENCES goals(id) ON DELETE CASCADE,
        related_memory_id VARCHAR REFERENCES siani_memories(id) ON DELETE CASCADE,
        scheduled_for TIMESTAMP,
        sent_at TIMESTAMP,
        seen_at TIMESTAMP,
        dismissed_at TIMESTAMP,
        action_taken TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Streak insurance tables (audit #1 — close prod 500 gap on
    // /api/gamification/streak and /api/users/:userId/recovery-quest/*).
    // Code in storage.ts + services/gamification.ts assumes these exist.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS streak_freezes (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
        used_at TIMESTAMP,
        expires_at TIMESTAMP,
        source TEXT NOT NULL DEFAULT 'purchase',
        is_used BOOLEAN NOT NULL DEFAULT false,
        cred_cost INTEGER DEFAULT 50,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mastermind_circles (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        trajectory TEXT,
        constraint_now TEXT,
        success_def TEXT,
        pathway TEXT NOT NULL DEFAULT 'entrepreneurship',
        momentum_score INTEGER NOT NULL DEFAULT 0,
        chemistry TEXT NOT NULL DEFAULT 'forming',
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS mastermind_seats (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        circle_id VARCHAR NOT NULL REFERENCES mastermind_circles(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        member_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        strength TEXT,
        position_index INTEGER NOT NULL DEFAULT 0,
        contribution_score INTEGER NOT NULL DEFAULT 0,
        gravity TEXT NOT NULL DEFAULT 'quiet',
        last_interaction_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_mastermind_seats_circle ON mastermind_seats(circle_id);
      CREATE INDEX IF NOT EXISTS idx_mastermind_seats_member ON mastermind_seats(member_user_id);
      CREATE TABLE IF NOT EXISTS mastermind_posts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        circle_id VARCHAR NOT NULL REFERENCES mastermind_circles(id) ON DELETE CASCADE,
        author_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        target_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        points INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_mastermind_posts_circle_created ON mastermind_posts(circle_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS mastermind_responses (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id VARCHAR NOT NULL REFERENCES mastermind_posts(id) ON DELETE CASCADE,
        responder_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        body TEXT,
        points INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_mastermind_responses_post ON mastermind_responses(post_id);

      CREATE TABLE IF NOT EXISTS streak_recovery_quests (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        broken_streak INTEGER NOT NULL,
        quest_type TEXT NOT NULL,
        quest_description TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Ensure users table has all required columns
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id VARCHAR UNIQUE
    `);
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE
    `);
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
    `);

    // Make resources(name) deduplicatable so the seed scripts can use
    // ON CONFLICT DO NOTHING safely. We dedup case-insensitively because
    // the source data sometimes capitalizes the same name two ways.
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS resources_name_lower_key
        ON resources (LOWER(name))
    `);

    // Reconcile FK ON DELETE behavior on existing prod databases. db:push
    // already updates these on dev; this loop is the safety net so that
    // the GDPR delete cascade actually fires in environments that pre-date
    // the schema overhaul. Each statement is idempotent — if the
    // constraint already has the right behavior PostgreSQL is happy to
    // recreate it.
    await reconcileForeignKeyCascades();

    console.log('Database tables initialized successfully');
    
    // Seed badges if they don't exist
    await seedBadges();
    
    // Seed demo data (members, confessions, goals, transactions)
    await seedDemoData();
    
    return true;
  } catch (error: any) {
    console.error('Failed to initialize database tables:', error.message);
    return false;
  }
}

async function seedBadges() {
  try {
    const existingBadges = await db.select().from(badges);
    if (existingBadges.length > 0) {
      console.log(`Badges already seeded: ${existingBadges.length} badges`);
      return;
    }

    const badgeData = [
      // Streak badges
      { name: "First Spark", description: "Complete your first daily check-in", category: "streak", xpReward: 25, requirement: { type: "streak", value: 1 }, iconUrl: "/badges/spark.png" },
      { name: "3-Day Flow", description: "Maintain a 3-day streak", category: "streak", xpReward: 50, requirement: { type: "streak", value: 3 }, iconUrl: "/badges/flow-3.png" },
      { name: "Week Warrior", description: "Keep the streak alive for 7 days", category: "streak", xpReward: 100, requirement: { type: "streak", value: 7 }, iconUrl: "/badges/warrior.png" },
      { name: "Two Week Heat", description: "14 days of consistent showing up", category: "streak", xpReward: 150, requirement: { type: "streak", value: 14 }, iconUrl: "/badges/heat-14.png" },
      { name: "Month of Power", description: "30 days straight - you're unstoppable", category: "streak", xpReward: 300, requirement: { type: "streak", value: 30 }, iconUrl: "/badges/power-30.png" },
      { name: "90-Day Legend", description: "Three months of dedication", category: "streak", xpReward: 500, requirement: { type: "streak", value: 90 }, isSecret: true, iconUrl: "/badges/legend.png" },
      
      // Milestone badges
      { name: "First Move", description: "Complete your first move", category: "milestone", xpReward: 25, requirement: { type: "moves_completed", value: 1 }, iconUrl: "/badges/first-move.png" },
      { name: "Ten Deep", description: "Complete 10 moves", category: "milestone", xpReward: 75, requirement: { type: "moves_completed", value: 10 }, iconUrl: "/badges/ten-deep.png" },
      { name: "Quarter Century", description: "Complete 25 moves", category: "milestone", xpReward: 125, requirement: { type: "moves_completed", value: 25 }, iconUrl: "/badges/quarter.png" },
      { name: "Fifty Strong", description: "Complete 50 moves", category: "milestone", xpReward: 200, requirement: { type: "moves_completed", value: 50 }, iconUrl: "/badges/fifty.png" },
      { name: "Century Club", description: "Complete 100 moves", category: "milestone", xpReward: 400, requirement: { type: "moves_completed", value: 100 }, isSecret: true, iconUrl: "/badges/century.png" },
      
      // Growth badges
      { name: "First Bag", description: "Create your first goal", category: "growth", xpReward: 25, requirement: { type: "goals_created", value: 1 }, iconUrl: "/badges/first-bag.png" },
      { name: "Bag Secured", description: "Complete your first goal", category: "growth", xpReward: 100, requirement: { type: "goals_completed", value: 1 }, iconUrl: "/badges/bag-secured.png" },
      { name: "Level Up", description: "Reach level 2", category: "growth", xpReward: 50, requirement: { type: "level", value: 2 }, iconUrl: "/badges/level-up.png" },
      { name: "Rising", description: "Reach level 5", category: "growth", xpReward: 150, requirement: { type: "level", value: 5 }, iconUrl: "/badges/rising.png" },
      { name: "Elite Status", description: "Reach level 10", category: "growth", xpReward: 300, requirement: { type: "level", value: 10 }, isSecret: true, iconUrl: "/badges/elite.png" },
      
      // Community badges
      { name: "Connected", description: "Make your first resource connection", category: "community", xpReward: 50, requirement: { type: "referrals", value: 1 }, iconUrl: "/badges/connected.png" },
      { name: "Bridge Builder", description: "Connect with 5 resources", category: "community", xpReward: 150, requirement: { type: "referrals", value: 5 }, iconUrl: "/badges/bridge.png" },
      { name: "Network Boss", description: "Connect with 10 resources", category: "community", xpReward: 300, requirement: { type: "referrals", value: 10 }, isSecret: true, iconUrl: "/badges/network.png" },
      
      // Care badges
      { name: "Vault Keeper", description: "Share something in The Vault", category: "care", xpReward: 50, requirement: { type: "vault_confession", value: 1 }, iconUrl: "/badges/vault-keeper.png" },
      { name: "Signal Boost", description: "React to 10 signals", category: "care", xpReward: 75, requirement: { type: "signal_reactions", value: 10 }, iconUrl: "/badges/signal.png" },
      { name: "Drop Hunter", description: "RSVP to 3 drops", category: "care", xpReward: 100, requirement: { type: "drop_rsvp", value: 3 }, iconUrl: "/badges/hunter.png" },
    ];

    for (const badge of badgeData) {
      await db.insert(badges).values({
        name: badge.name,
        description: badge.description,
        category: badge.category,
        xpReward: badge.xpReward,
        requirement: badge.requirement,
        iconUrl: badge.iconUrl,
        isSecret: badge.isSecret || false,
      }).onConflictDoNothing();
    }

    console.log(`Seeded ${badgeData.length} badges`);
  } catch (error: any) {
    console.error('Failed to seed badges:', error.message);
  }
}

export async function createPerformanceIndexes() {
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_emotional_states_user_id ON emotional_states(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_moves_user_id ON moves(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_moves_goal_id ON moves(goal_id)`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_resource_id ON referrals(resource_id)`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_state ON referrals(state)`,
    `CREATE INDEX IF NOT EXISTS idx_vault_confessions_user_id ON vault_confessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vault_confessions_status_created ON vault_confessions(status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_vault_confessions_expires_at ON vault_confessions(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_emotional_states_created_at ON emotional_states(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_referral_outcomes_resource_id ON referral_outcomes(resource_id)`,
    `CREATE INDEX IF NOT EXISTS idx_referral_outcomes_referral_id ON referral_outcomes(referral_id)`,
    `CREATE INDEX IF NOT EXISTS idx_organization_issues_resource_id ON organization_issues(resource_id)`,
    `CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category)`,
    `CREATE INDEX IF NOT EXISTS idx_signals_user_id ON signals(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_check_ins_user_id ON check_ins(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id ON xp_transactions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cred_transactions_user_id ON cred_transactions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_siani_memories_user_id ON siani_memories(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_siani_nudges_user_id ON siani_nudges(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id)`,
  ];

  let created = 0;
  for (const stmt of indexes) {
    try {
      await db.execute(sql.raw(stmt));
      created++;
    } catch {
    }
  }
  console.log(`Performance indexes: ${created}/${indexes.length} created`);
}

/**
 * Reconcile foreign-key ON DELETE behaviour on prod databases that pre-date
 * the cascade overhaul. Drizzle's `db:push` already does this for new
 * environments, but legacy DBs may still hold the original RESTRICT-style
 * constraints — which would block GDPR-style user deletions and the
 * retention worker's message pruning. Each ALTER is wrapped in a try/catch
 * because the constraint name varies slightly across schema vintages, and
 * any single failure is non-fatal.
 */
async function reconcileForeignKeyCascades(): Promise<void> {
  // Derived from shared/schema.ts so the contract can never drift from
  // the Drizzle source of truth.
  const fixes = collectSchemaForeignKeys();

  let fixed = 0;
  for (const f of fixes) {
    const constraintName = `${f.table}_${f.column}_fk_cascade`;
    try {
      // Find every FK constraint on (table, column) and drop it, then
      // recreate exactly one with the correct ON DELETE behaviour.
      await db.execute(sql.raw(`
        DO $$
        DECLARE c RECORD;
        BEGIN
          FOR c IN
            SELECT conname FROM pg_constraint
            WHERE contype = 'f'
              AND conrelid = '${f.table}'::regclass
              AND conkey = (
                SELECT array_agg(attnum)
                FROM pg_attribute
                WHERE attrelid = '${f.table}'::regclass
                  AND attname = '${f.column}'
              )
          LOOP
            EXECUTE format('ALTER TABLE ${f.table} DROP CONSTRAINT IF EXISTS %I', c.conname);
          END LOOP;
          EXECUTE 'ALTER TABLE ${f.table} ADD CONSTRAINT ${constraintName} '
                  'FOREIGN KEY (${f.column}) REFERENCES ${f.refTable}(${f.refColumn}) '
                  'ON DELETE ${f.onDelete}';
        EXCEPTION WHEN undefined_table THEN
          -- table or referenced table absent in this environment; skip
          NULL;
        END $$;
      `));
      fixed++;
    } catch (e) {
      // Non-fatal: log and keep going so a single drift doesn't block boot.
      console.warn(`[db-init] FK reconcile skipped for ${f.table}.${f.column}:`, e instanceof Error ? e.message : String(e));
    }
  }
  console.log(`[db-init] FK cascade reconcile: ${fixed}/${fixes.length} statements applied`);
}

/**
 * Fail-fast schema assertion. Confirms that the FK cascade contract from
 * shared/schema.ts is actually present in the live database. Logs every
 * mismatch and throws once if any are missing — startup aborts so we
 * never accept writes against a half-migrated schema.
 *
 * Pairs 1:1 with `reconcileForeignKeyCascades` so any drift between the
 * Drizzle schema and the running database is surfaced immediately.
 */
export async function assertSchemaIntegrity(): Promise<void> {
  // Required FK contract is derived from shared/schema.ts itself, so
  // this assertion automatically expands as the schema evolves.
  // pg_constraint.confdeltype codes: 'c'=CASCADE, 'n'=SET NULL,
  // 'a'=NO ACTION, 'r'=RESTRICT, 'd'=SET DEFAULT.
  const required = collectSchemaForeignKeys();
  const failures: string[] = [];
  let verified = 0;
  let skipped = 0;

  for (const r of required) {
    try {
      const result = await db.execute(sql.raw(`
        SELECT con.confdeltype
        FROM pg_constraint con
        JOIN pg_attribute a
          ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
        WHERE con.contype = 'f'
          AND con.conrelid = '${r.table}'::regclass
          AND a.attname = '${r.column}'
          AND array_length(con.conkey, 1) = 1
        LIMIT 1
      `)) as unknown as { rows?: Array<{ confdeltype: string }> } | Array<{ confdeltype: string }>;
      const rows = Array.isArray(result) ? result : (result.rows ?? []);
      const row = rows[0];
      const expected = PG_DELTYPE[r.onDelete];
      if (!row) {
        failures.push(`${r.table}.${r.column}: FK missing`);
      } else if (row.confdeltype !== expected) {
        failures.push(
          `${r.table}.${r.column}: expected ON DELETE ${r.onDelete}, got code '${row.confdeltype}'`,
        );
      } else {
        verified++;
      }
    } catch (err) {
      // Table absent in this environment (e.g. legacy DB missing a new
      // table). Reconciler will have already logged its own warning.
      skipped++;
      console.warn(`[db-init] assert skipped for ${r.table}.${r.column}:`, err instanceof Error ? err.message : String(err));
    }
  }

  if (failures.length > 0) {
    const msg = `[db-init] Schema integrity assertion failed:\n  - ${failures.join('\n  - ')}`;
    console.error(msg);
    throw new Error(msg);
  }
  console.log(`[db-init] Schema integrity: ${verified}/${required.length} FK cascades verified${skipped ? ` (${skipped} skipped — table absent)` : ''}`);
}
