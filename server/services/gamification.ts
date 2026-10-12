import { db } from "../db";
import { 
  users, badges, userBadges, credTransactions, 
  streakFreezes, streakRecoveryQuests,
  CRED_REWARDS, LEVEL_THRESHOLDS, getLevelFromXp 
} from "@shared/schema";
import { eq, sql, and, gte, isNull, or, desc } from "drizzle-orm";

// Streak insurance system tunables.
// Cap on un-used freezes a member can hold at any time. Keeps the mechanic
// scarce so each rescue still feels meaningful.
const MAX_STREAK_FREEZES = 2;
// Streak lengths that earn a freeze when first crossed. Aligned with the
// existing celebration milestones in client/src/hooks/useGamification.ts.
const FREEZE_MILESTONES = new Set<number>([7, 14, 21, 30, 60, 90, 180, 365]);

// Award a freeze token when the user first crosses a milestone — but only
// if they're under the cap. Source is tracked so we can audit later.
async function maybeAwardStreakFreeze(
  userId: string,
  newStreak: number,
  prevStreak: number
): Promise<boolean> {
  if (newStreak <= prevStreak) return false;
  if (!FREEZE_MILESTONES.has(newStreak)) return false;

  const owned = await db.select({ id: streakFreezes.id }).from(streakFreezes)
    .where(and(
      eq(streakFreezes.userId, userId),
      eq(streakFreezes.isUsed, false),
      or(isNull(streakFreezes.expiresAt), gte(streakFreezes.expiresAt, new Date())),
    ));
  if (owned.length >= MAX_STREAK_FREEZES) return false;

  await db.insert(streakFreezes).values({
    userId,
    source: "streak_milestone",
    isUsed: false,
    credCost: 0,
  });
  return true;
}

// Atomic single-token consume. Returns true if a freeze was used.
async function consumeOneStreakFreeze(userId: string): Promise<boolean> {
  const [candidate] = await db.select({ id: streakFreezes.id }).from(streakFreezes)
    .where(and(
      eq(streakFreezes.userId, userId),
      eq(streakFreezes.isUsed, false),
      or(isNull(streakFreezes.expiresAt), gte(streakFreezes.expiresAt, new Date())),
    ))
    .orderBy(desc(streakFreezes.earnedAt))
    .limit(1);
  if (!candidate) return false;
  const [updated] = await db.update(streakFreezes)
    .set({ isUsed: true, usedAt: new Date() })
    .where(and(
      eq(streakFreezes.id, candidate.id),
      eq(streakFreezes.isUsed, false),
    ))
    .returning({ id: streakFreezes.id });
  return !!updated;
}

// Open a 24h recovery quest if the user has no active one. The completion
// endpoint restores the broken streak.
async function ensureRecoveryQuest(userId: string, brokenStreak: number): Promise<void> {
  const now = new Date();
  const [existing] = await db.select({ id: streakRecoveryQuests.id }).from(streakRecoveryQuests)
    .where(and(
      eq(streakRecoveryQuests.userId, userId),
      eq(streakRecoveryQuests.isCompleted, false),
      gte(streakRecoveryQuests.expiresAt, now),
    ))
    .limit(1);
  if (existing) return;

  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await db.insert(streakRecoveryQuests).values({
    userId,
    brokenStreak,
    questType: "complete_move",
    questDescription: "Complete one move from your bag in the next 24 hours to recover your streak.",
    expiresAt,
  });
}

export interface BadgeAward {
  badge: typeof badges.$inferSelect;
  isNew: boolean;
}

export interface LevelUpResult {
  previousLevel: number;
  newLevel: number;
  totalXp: number;
  nextLevelXp: number;
}

export interface GamificationResult {
  credAwarded: number;
  xpAwarded: number;
  badgesAwarded: BadgeAward[];
  levelUp?: LevelUpResult;
  streakUpdated: boolean;
  newStreak: number;
}

const BADGE_DEFINITIONS = [
  { id: "first-step", name: "First Step", description: "Complete your first move", category: "milestone", requirement: { type: "moves_completed", value: 1 }, xpReward: 25 },
  { id: "streak-3", name: "Three Day Run", description: "Maintain a 3-day streak", category: "streak", requirement: { type: "streak", value: 3 }, xpReward: 50 },
  { id: "streak-7", name: "Week Warrior", description: "Maintain a 7-day streak", category: "streak", requirement: { type: "streak", value: 7 }, xpReward: 100 },
  { id: "streak-30", name: "Monthly Momentum", description: "Maintain a 30-day streak", category: "streak", requirement: { type: "streak", value: 30 }, xpReward: 250 },
  { id: "first-drop", name: "Drop Claimed", description: "RSVP to your first exclusive drop", category: "community", requirement: { type: "drops_claimed", value: 1 }, xpReward: 50 },
  { id: "circle-contributor", name: "Circle Contributor", description: "Help someone in The Circle", category: "community", requirement: { type: "circle_helps", value: 1 }, xpReward: 75 },
  { id: "loop-closer", name: "Loop Closer", description: "Complete a referral loop", category: "care", requirement: { type: "referrals_completed", value: 1 }, xpReward: 100 },
  { id: "cred-100", name: "Rising Star", description: "Earn 100 CRED", category: "milestone", requirement: { type: "cred_total", value: 100 }, xpReward: 50 },
  { id: "cred-500", name: "Building Momentum", description: "Earn 500 CRED", category: "milestone", requirement: { type: "cred_total", value: 500 }, xpReward: 100 },
  { id: "cred-1000", name: "Established", description: "Earn 1000 CRED", category: "milestone", requirement: { type: "cred_total", value: 1000 }, xpReward: 200 },
  { id: "first-signal", name: "Signal Sent", description: "Post your first signal to The Flow", category: "community", requirement: { type: "signals_posted", value: 1 }, xpReward: 50 },
  { id: "vault-confession", name: "Vault Opened", description: "Share a confession in The Vault", category: "growth", requirement: { type: "vault_confessions", value: 1 }, xpReward: 75, isSecret: true },
  { id: "night-owl", name: "Night Owl", description: "Complete an action during Night Shift hours", category: "growth", requirement: { type: "night_actions", value: 1 }, xpReward: 25 },
];

export async function ensureBadgesExist() {
  for (const badge of BADGE_DEFINITIONS) {
    const existing = await db.select().from(badges).where(eq(badges.id, badge.id)).limit(1);
    if (!existing.length) {
      await db.insert(badges).values({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        requirement: badge.requirement,
        xpReward: badge.xpReward,
        isSecret: badge.isSecret || false,
      }).onConflictDoNothing();
    }
  }
}

export async function checkAndAwardBadges(
  userId: string,
  context: {
    movesCompleted?: number;
    currentStreak?: number;
    dropsClaimedCount?: number;
    circleHelpsCount?: number;
    referralsCompleted?: number;
    credTotal?: number;
    signalsPosted?: number;
    vaultConfessions?: number;
    nightActionsCount?: number;
  }
): Promise<BadgeAward[]> {
  const awardedBadges: BadgeAward[] = [];
  
  const userBadgeRecords = await db.select().from(userBadges).where(eq(userBadges.userId, userId));
  const earnedBadgeIds = new Set(userBadgeRecords.map(ub => ub.badgeId));
  
  const allBadges = await db.select().from(badges);
  
  for (const badge of allBadges) {
    if (earnedBadgeIds.has(badge.id)) {
      continue;
    }
    
    const req = badge.requirement as { type: string; value: number } | null;
    if (!req) continue;
    
    let shouldAward = false;
    
    switch (req.type) {
      case "moves_completed":
        shouldAward = (context.movesCompleted || 0) >= req.value;
        break;
      case "streak":
        shouldAward = (context.currentStreak || 0) >= req.value;
        break;
      case "drops_claimed":
        shouldAward = (context.dropsClaimedCount || 0) >= req.value;
        break;
      case "circle_helps":
        shouldAward = (context.circleHelpsCount || 0) >= req.value;
        break;
      case "referrals_completed":
        shouldAward = (context.referralsCompleted || 0) >= req.value;
        break;
      case "cred_total":
        shouldAward = (context.credTotal || 0) >= req.value;
        break;
      case "signals_posted":
        shouldAward = (context.signalsPosted || 0) >= req.value;
        break;
      case "vault_confessions":
        shouldAward = (context.vaultConfessions || 0) >= req.value;
        break;
      case "night_actions":
        shouldAward = (context.nightActionsCount || 0) >= req.value;
        break;
    }
    
    if (shouldAward) {
      await db.insert(userBadges).values({
        userId,
        badgeId: badge.id,
      }).onConflictDoNothing();
      
      awardedBadges.push({ badge, isNew: true });
    }
  }
  
  return awardedBadges;
}

export async function updateStreak(userId: string): Promise<{ streak: number; isNewDay: boolean; streakBroken: boolean; streakSaved: boolean }> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return { streak: 0, isNewDay: false, streakBroken: false, streakSaved: false };
  
  const now = new Date();
  const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastActiveDay = lastActive 
    ? new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate()) 
    : null;
  
  const prevStreak = user.currentStreak;
  let newStreak = prevStreak;
  let isNewDay = false;
  let streakBroken = false;
  let streakSaved = false;
  let nextStreakSavedAt: Date | null = user.streakSavedAt ?? null;
  
  if (!lastActiveDay) {
    newStreak = 1;
    isNewDay = true;
    nextStreakSavedAt = null;
  } else {
    const daysDiff = Math.floor((today.getTime() - lastActiveDay.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      isNewDay = false;
    } else if (daysDiff === 1) {
      newStreak = prevStreak + 1;
      isNewDay = true;
    } else if (daysDiff === 2 && prevStreak >= 1) {
      // Single missed day with a meaningful streak. Try to consume a freeze
      // token from the streak_freezes table — token-based, not legacy flag.
      // If we have one, the streak is preserved and the client paints a
      // single cyan "saved" pulse on the flame (distinct from the warning
      // amber state). If no token, the streak breaks and we open a 24h
      // recovery quest so the member has a path back.
      const usedFreeze = await consumeOneStreakFreeze(userId);
      if (usedFreeze) {
        newStreak = prevStreak + 1;
        isNewDay = true;
        streakSaved = true;
        nextStreakSavedAt = now;
      } else {
        newStreak = 1;
        isNewDay = true;
        streakBroken = prevStreak > 0;
        nextStreakSavedAt = null;
        if (streakBroken) {
          await ensureRecoveryQuest(userId, prevStreak);
        }
      }
    } else {
      // 3+ day gap — too far for a single freeze to bridge. Reset and offer
      // recovery quest if there's something worth recovering.
      newStreak = 1;
      isNewDay = true;
      streakBroken = prevStreak > 0;
      nextStreakSavedAt = null;
      if (streakBroken) {
        await ensureRecoveryQuest(userId, prevStreak);
      }
    }
  }
  
  const newLongest = Math.max(user.longestStreak, newStreak);
  
  await db.update(users)
    .set({ 
      currentStreak: newStreak, 
      longestStreak: newLongest,
      lastActiveAt: now,
      streakSavedAt: nextStreakSavedAt,
    })
    .where(eq(users.id, userId));
  
  // Earn a freeze for crossing a streak milestone (capped). Done after the
  // user row update so the new streak value is the authoritative trigger.
  if (isNewDay && newStreak > prevStreak) {
    await maybeAwardStreakFreeze(userId, newStreak, prevStreak).catch(err =>
      console.error("Award streak freeze error:", err)
    );
  }
  
  return { streak: newStreak, isNewDay, streakBroken, streakSaved };
}

export async function awardCred(
  userId: string,
  amount: number,
  reason: string,
  sourceType?: string,
  sourceId?: string,
  idempotencyKey?: string
): Promise<{ newBalance: number; transaction: typeof credTransactions.$inferSelect | null }> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return { newBalance: 0, transaction: null };
  
  if (idempotencyKey) {
    const [existing] = await db.select().from(credTransactions)
      .where(eq(credTransactions.idempotencyKey, idempotencyKey));
    if (existing) {
      return { newBalance: user.credBalance, transaction: existing };
    }
  }
  
  const [transaction] = await db.insert(credTransactions).values({
    userId,
    amount,
    reason,
    sourceType,
    sourceId,
    idempotencyKey,
  }).returning();
  
  const newBalance = user.credBalance + amount;
  await db.update(users)
    .set({ credBalance: newBalance, lastCredEarnedAt: new Date() })
    .where(eq(users.id, userId));
  
  return { newBalance, transaction };
}

export async function addXpAndCheckLevelUp(
  userId: string,
  xpAmount: number
): Promise<LevelUpResult | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  
  const previousLevel = user.level;
  const newXp = user.xp + xpAmount;
  const newLevel = getLevelFromXp(newXp);
  
  await db.update(users)
    .set({ xp: newXp, level: newLevel })
    .where(eq(users.id, userId));
  
  if (newLevel > previousLevel) {
    const nextLevelXp = newLevel < LEVEL_THRESHOLDS.length 
      ? LEVEL_THRESHOLDS[newLevel] 
      : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    
    return {
      previousLevel,
      newLevel,
      totalXp: newXp,
      nextLevelXp,
    };
  }
  
  return null;
}

export async function processAction(
  userId: string,
  actionType: 
    | "move_completed" 
    | "checkin" 
    | "drop_rsvp" 
    | "signal_posted" 
    | "circle_help" 
    | "referral_completed" 
    | "vault_confession"
    | "daily_action",
  sourceId?: string
): Promise<GamificationResult> {
  const result: GamificationResult = {
    credAwarded: 0,
    xpAwarded: 0,
    badgesAwarded: [],
    streakUpdated: false,
    newStreak: 0,
  };
  
  let credAmount = 0;
  let reason = actionType;
  
  switch (actionType) {
    case "move_completed":
      credAmount = CRED_REWARDS.DAILY_ACTION;
      break;
    case "checkin":
      credAmount = CRED_REWARDS.DAILY_CHECKIN;
      break;
    case "drop_rsvp":
      credAmount = 20;
      break;
    case "signal_posted":
      credAmount = 15;
      break;
    case "circle_help":
      credAmount = CRED_REWARDS.CIRCLE_HELP;
      break;
    case "referral_completed":
      credAmount = CRED_REWARDS.LOOP_CLOSED;
      break;
    case "vault_confession":
      credAmount = 10;
      break;
    case "daily_action":
      credAmount = CRED_REWARDS.DAILY_ACTION;
      break;
  }
  
  const idempotencyKey = sourceId ? `${actionType}-${sourceId}` : undefined;
  const { newBalance, transaction } = await awardCred(userId, credAmount, reason, actionType, sourceId, idempotencyKey);
  
  if (transaction) {
    result.credAwarded = credAmount;
    result.xpAwarded = credAmount;
    
    const levelUp = await addXpAndCheckLevelUp(userId, credAmount);
    if (levelUp) {
      result.levelUp = levelUp;
    }
  }
  
  const streakResult = await updateStreak(userId);
  result.streakUpdated = streakResult.isNewDay;
  result.newStreak = streakResult.streak;
  
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (user) {
    const context = {
      currentStreak: streakResult.streak,
      credTotal: user.credBalance + (result.credAwarded || 0),
    };
    
    const badgeAwards = await checkAndAwardBadges(userId, context);
    result.badgesAwarded = badgeAwards;
    
    for (const award of badgeAwards) {
      if (award.badge.xpReward) {
        await addXpAndCheckLevelUp(userId, award.badge.xpReward);
        result.xpAwarded += award.badge.xpReward;
      }
    }
  }
  
  return result;
}

export async function getUserGamificationStats(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  
  const earnedBadges = await db.select({
    badge: badges,
    earnedAt: userBadges.earnedAt,
  })
    .from(userBadges)
    .innerJoin(badges, eq(userBadges.badgeId, badges.id))
    .where(eq(userBadges.userId, userId));
  
  const currentLevel = user.level;
  const currentXp = user.xp;
  const currentLevelXp = currentLevel > 1 ? LEVEL_THRESHOLDS[currentLevel - 1] : 0;
  const nextLevelXp = currentLevel < LEVEL_THRESHOLDS.length 
    ? LEVEL_THRESHOLDS[currentLevel] 
    : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  
  const xpProgress = nextLevelXp > currentLevelXp 
    ? ((currentXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100 
    : 100;
  
  return {
    level: currentLevel,
    xp: currentXp,
    xpProgress: Math.min(100, Math.max(0, xpProgress)),
    nextLevelXp,
    credBalance: user.credBalance,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    streakSaveUsed: user.streakSaveUsed ?? false,
    streakSavedAt: user.streakSavedAt ?? null,
    badges: earnedBadges.map(eb => ({
      ...eb.badge,
      earnedAt: eb.earnedAt,
    })),
    badgeCount: earnedBadges.length,
  };
}
