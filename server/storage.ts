import { db } from "./db";
import { eq, desc, and, sql, gte, lte, or, isNull, ne, inArray } from "drizzle-orm";
import {
  users,
  userLocations,
  conversations,
  messages,
  emotionalStates,
  signals,
  goals,
  badges,
  userBadges,
  moves,
  challengeParticipants,
  careTeams,
  careTeamMembers,
  careThreads,
  careMessages,
  escalations,
  referrals,
  resources,
  referralOutcomes,
  organizationIssues,
  // The Flow - Three Lane System
  drops,
  dropRsvps,
  feedSignals,
  feedReactions,
  spotlights,
  energyReactions,
  // Phase 1: Daily Dopamine Loop
  pulseQuestions,
  pulseResponses,
  rhythms,
  rhythmLogs,
  realCaptures,
  // CRED Economy
  credTransactions,
  checkIns,
  impactDossiers,
  CRED_REWARDS,
  // Streak Freeze & Siani Memory
  streakFreezes,
  streakRecoveryQuests,
  sianiMemories,
  sianiNudges,
  // Vault & Heat Index
  vaultConfessions,
  vaultReactions,
  vaultSpotlights,
  VAULT_CRED_REWARDS,
  heatRankings,
  membershipKeys,
  // Institutional Dashboard
  organizations,
  orgMembers,
  userEvents,
  aiSentiment,
  metricSnapshots,
  riskTiers,
  type User,
  type InsertUser,
  type UserLocation,
  type InsertUserLocation,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type EmotionalState,
  type InsertEmotionalState,
  type Signal,
  type InsertSignal,
  type Goal,
  type InsertGoal,
  type Badge,
  type CareThread,
  type CareMessage,
  type InsertCareMessage,
  type Escalation,
  type InsertEscalation,
  type Move,
  type InsertMove,
  type Referral,
  type Resource,
  type InsertResource,
  type ReferralOutcome,
  type InsertReferralOutcome,
  type OrganizationIssue,
  type InsertOrganizationIssue,
  referralNotes,
  orgContacts,
  type ReferralNote,
  type InsertReferralNote,
  type OrgContact,
  type InsertOrgContact,
  // Flow types
  type Drop,
  type InsertDrop,
  type DropRsvp,
  type FeedSignal,
  type InsertFeedSignal,
  type FeedReaction,
  type Spotlight,
  type InsertSpotlight,
  type EnergyReactionType,
  type FlowLane,
  // Phase 1 types
  type PulseQuestion,
  type InsertPulseQuestion,
  type PulseResponse,
  type InsertPulseResponse,
  type Rhythm,
  type InsertRhythm,
  type RhythmLog,
  type InsertRhythmLog,
  type RealCapture,
  type InsertRealCapture,
  // CRED Economy types
  type CredTransaction,
  type InsertCredTransaction,
  type CheckIn,
  type InsertCheckIn,
  type ImpactDossier,
  type InsertImpactDossier,
  type CheckInSlot,
  // Streak Freeze & Siani Memory types
  type StreakFreeze,
  type InsertStreakFreeze,
  type StreakRecoveryQuest,
  type InsertStreakRecoveryQuest,
  type SianiMemory,
  type InsertSianiMemory,
  type SianiNudge,
  type InsertSianiNudge,
  // Vault & Heat Index types
  type VaultConfession,
  type InsertVaultConfession,
  type VaultReaction,
  type InsertVaultReaction,
  type HeatRanking,
  type InsertHeatRanking,
  type MembershipKey,
  type InsertMembershipKey,
  // Dashboard types
  type Organization,
  type InsertOrganization,
  type OrgMember,
  type InsertOrgMember,
  type UserEvent,
  type InsertUserEvent,
  type AiSentiment,
  type InsertAiSentiment,
  type MetricSnapshot,
  type InsertMetricSnapshot,
  type RiskTier,
  type InsertRiskTier,
} from "@shared/schema";

export type VaultConfessionPublic = {
  id: string;
  content: string;
  audioUrl: string | null;
  audioDuration: number | null;
  isAnonymous: boolean | null;
  displayName: string | null;
  authorHandle: string | null;
  category: string;
  mood: string | null;
  fireCount: number | null;
  strengthCount: number | null;
  heartCount: number | null;
  realCount: number | null;
  totalReactions: number | null;
  isSpotlighted: boolean | null;
  createdAt: Date;
};
export type VaultSpotlightPublic = VaultConfessionPublic & {
  spotlightBonus: number | null;
  spotlightEnd: Date | null;
};
export type VaultCreateInput = {
  userId: string;
  content: string;
  isAnonymous: boolean;
  authorHandle: string | null;
  displayName?: string | null;
  category: string;
  mood?: string | null;
  audioUrl?: string | null;
  audioDuration?: number | null;
};
export type VaultReactInput = {
  userId: string;
  confessionId: string;
  reactionType: string;
  action: "add" | "remove";
};
export type VaultReactResult = {
  ok: boolean;
  action: "added" | "removed" | "already_exists" | "not_found";
  reactionType?: string;
  authorIdToReward?: string | null;
};

// Internal helper — single source of truth for the public vault column set.
// Co-located with the storage methods that consume it.
function vaultPublicColumns() {
  return {
    id: vaultConfessions.id,
    content: vaultConfessions.content,
    audioUrl: vaultConfessions.audioUrl,
    audioDuration: vaultConfessions.audioDuration,
    isAnonymous: vaultConfessions.isAnonymous,
    displayName: vaultConfessions.displayName,
    authorHandle: vaultConfessions.authorHandle,
    category: vaultConfessions.category,
    mood: vaultConfessions.mood,
    fireCount: vaultConfessions.fireCount,
    strengthCount: vaultConfessions.strengthCount,
    heartCount: vaultConfessions.heartCount,
    realCount: vaultConfessions.realCount,
    totalReactions: vaultConfessions.totalReactions,
    isSpotlighted: vaultConfessions.isSpotlighted,
    createdAt: vaultConfessions.createdAt,
  } as const;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
  addXpToUser(userId: string, xpAmount: number): Promise<User | undefined>;
  
  // User Locations (separate table for HSDS compatibility)
  getUserLocation(userId: string): Promise<UserLocation | undefined>;
  upsertUserLocation(location: InsertUserLocation): Promise<UserLocation>;

  // Conversations
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationsByUser(userId: string, limit?: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;

  // Messages
  getMessage(id: string): Promise<Message | undefined>;
  getMessagesByConversation(conversationId: string, limit?: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Emotional States
  getEmotionalStatesByUser(userId: string, limit?: number): Promise<EmotionalState[]>;
  createEmotionalState(state: InsertEmotionalState): Promise<EmotionalState>;

  // Signals
  getSignalsByUser(userId: string, limit?: number): Promise<Signal[]>;
  getUnresolvedSignalsByUser(userId: string): Promise<Signal[]>;
  createSignal(signal: InsertSignal): Promise<Signal>;
  resolveSignal(id: string): Promise<Signal | undefined>;
  
  // Escalations
  createEscalation(escalation: InsertEscalation): Promise<Escalation>;
  getOpenEscalations(): Promise<Escalation[]>;
  updateEscalationState(id: string, state: string, resolvedAt?: Date): Promise<Escalation | undefined>;

  // Goals
  getGoalsByUser(userId: string, limit?: number): Promise<Goal[]>;
  getGoalById(id: string): Promise<Goal | undefined>;
  getCompletedGoalsCount(userId: string): Promise<number>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | undefined>;
  deleteGoal(id: string): Promise<boolean>;
  findSimilarGoal(userId: string, title: string): Promise<Goal | undefined>;

  // Badges
  getAllBadges(): Promise<Badge[]>;
  getUserBadges(userId: string): Promise<{ badge: Badge; earnedAt: Date }[]>;

  // Moves
  getMovesByUser(userId: string, limit?: number): Promise<Move[]>;
  getMovesByGoal(goalId: string): Promise<Move[]>;
  getMoveById(id: string): Promise<Move | undefined>;
  createMove(move: InsertMove): Promise<Move>;
  updateMove(id: string, updates: Partial<Move>): Promise<Move | undefined>;
  completeMove(id: string): Promise<Move | undefined>;

  // Stats
  getCompletedMovesCount(userId: string): Promise<number>;
  getCompletedChallengesCount(userId: string): Promise<number>;
  getChallengeWins(userId: string): Promise<{ id: string; title: string; prize: string; completedAt: Date; xpEarned: number }[]>;

  // Care Team
  getCareThreadsForUser(userId: string): Promise<{
    thread: CareThread;
    caregiver: User;
    unreadCount: number;
    lastMessage?: CareMessage;
  }[]>;
  getCareThread(threadId: string): Promise<CareThread | undefined>;
  getCareMessages(threadId: string): Promise<CareMessage[]>;
  createCareMessage(message: InsertCareMessage): Promise<CareMessage>;
  getOrCreateCareThread(memberUserId: string, teamId: string): Promise<CareThread>;

  // Resources & Referrals
  getResource(id: string): Promise<Resource | undefined>;
  getResourcesByCategory(category: string): Promise<Resource[]>;
  getAllResources(): Promise<Resource[]>;
  searchResources(query: string): Promise<Resource[]>;
  createResource(resource: InsertResource): Promise<Resource>;
  getReferralsForUser(userId: string): Promise<(Referral & { resource: Resource })[]>;
  getActiveReferralsForUser(userId: string): Promise<(Referral & { resource: Resource })[]>;
  getReferral(id: string): Promise<(Referral & { resource: Resource }) | undefined>;
  createReferral(referral: {
    userId: string;
    resourceId: string;
    source: string;
    linkedGoalId?: string;
    linkedSignalId?: string;
    state: string;
    priority?: string;
    dueDate?: Date;
    notes?: string;
  }): Promise<Referral>;
  updateReferralState(id: string, state: string, notes?: string): Promise<Referral | undefined>;
  
  // Organization accountability
  createReferralOutcome(outcome: InsertReferralOutcome): Promise<ReferralOutcome>;
  getResourceOutcomes(resourceId: string): Promise<ReferralOutcome[]>;
  getResourceOutcomesBatch(resourceIds: string[]): Promise<Map<string, ReferralOutcome[]>>;
  getOrganizationIssuesBatch(resourceIds: string[]): Promise<Map<string, OrganizationIssue[]>>;
  createOrganizationIssue(issue: InsertOrganizationIssue): Promise<OrganizationIssue>;
  getOrganizationIssues(resourceId: string, status?: string): Promise<OrganizationIssue[]>;
  updateResourceMetricsFromOutcome(resourceId: string, outcome: ReferralOutcome): Promise<Resource | undefined>;
  updateResourceMetricsFromIssue(resourceId: string, issue: OrganizationIssue): Promise<Resource | undefined>;
  updateResourceFlag(resourceId: string, isFlagged: boolean, flagReason?: string): Promise<Resource | undefined>;
  
  // Referral notes (with verification)
  createReferralNote(note: InsertReferralNote): Promise<ReferralNote>;
  getReferralNotes(referralId: string): Promise<ReferralNote[]>;
  getPendingVerifications(userId: string): Promise<ReferralNote[]>;
  verifyReferralNote(noteId: string, status: string, verifiedByUserId?: string, verifiedBySiani?: boolean, verificationNote?: string): Promise<ReferralNote | undefined>;
  
  // Org contacts
  createOrgContact(contact: InsertOrgContact): Promise<OrgContact>;
  getOrgContactsForResource(resourceId: string): Promise<OrgContact[]>;

  // ============================================
  // THE FLOW - Three Lane System
  // ============================================
  
  // Drops & Access (Lane 1)
  getActiveDrops(limit?: number): Promise<Drop[]>;
  getDrop(id: string): Promise<Drop | undefined>;
  rsvpToDrop(dropId: string, userId: string): Promise<{ success: boolean; status: string }>;
  getUserDropRsvps(userId: string): Promise<string[]>;
  
  // Signals & Sightings (Lane 2)
  getRecentSignals(limit?: number): Promise<FeedSignal[]>;
  getFeedSignal(id: string): Promise<FeedSignal | undefined>;
  
  // Circle Spotlights (Lane 3)
  getSpotlights(limit?: number): Promise<Spotlight[]>;
  getSpotlight(id: string): Promise<Spotlight | undefined>;
  
  // Energy Reactions
  addEnergyReaction(
    userId: string, 
    contentType: FlowLane, 
    contentId: string, 
    reactionType: EnergyReactionType
  ): Promise<boolean>;
  removeEnergyReaction(
    userId: string, 
    contentType: FlowLane, 
    contentId: string, 
    reactionType: EnergyReactionType
  ): Promise<boolean>;
  getUserReactions(
    userId: string, 
    contentType: FlowLane, 
    contentIds: string[]
  ): Promise<{ contentId: string; reactions: EnergyReactionType[] }[]>;

  // Night Shift Flow
  getDropsByStatus(status: 'active' | 'upcoming' | 'closed'): Promise<Drop[]>;
  getDropById(id: string): Promise<Drop | undefined>;
  createDropRsvp(userId: string, dropId: string): Promise<{ status: string; position?: number }>;
  getUserDropRsvp(userId: string, dropId: string): Promise<DropRsvp | undefined>;
  getDropRsvpCount(dropId: string): Promise<number>;

  getFeedSignalsByLane(lane: 'signals' | 'circle'): Promise<FeedSignal[]>;
  addFeedReaction(userId: string, feedSignalId: string, reactionType: string): Promise<void>;
  getFeedSignalReactions(feedSignalId: string): Promise<{ type: string; count: number }[]>;

  // ============================================
  // PHASE 1: DAILY DOPAMINE LOOP
  // ============================================

  // Pulse - Daily community questions
  getTodaysPulseQuestion(userId: string): Promise<PulseQuestion | undefined>;
  getPulseQuestionById(id: string): Promise<PulseQuestion | undefined>;
  submitPulseResponse(userId: string, questionId: string, response: string): Promise<PulseResponse>;
  getUserPulseResponses(userId: string, limit?: number): Promise<(PulseResponse & { question: PulseQuestion })[]>;

  // Rhythm - Habit tracking
  getUserRhythms(userId: string): Promise<Rhythm[]>;
  getRhythmById(id: string): Promise<Rhythm | undefined>;
  createRhythm(rhythm: InsertRhythm): Promise<Rhythm>;
  logRhythmCompletion(rhythmId: string, userId: string, note?: string, mood?: number): Promise<RhythmLog>;
  getRhythmLogs(rhythmId: string, limit?: number): Promise<RhythmLog[]>;
  updateRhythmStreak(rhythmId: string): Promise<Rhythm | undefined>;

  // Real - End-of-day captures
  createRealCapture(capture: InsertRealCapture): Promise<RealCapture>;
  getUserRealCaptures(userId: string, limit?: number): Promise<RealCapture[]>;
  getTodaysRealCapture(userId: string): Promise<RealCapture | undefined>;

  // ============================================
  // INSTITUTIONAL DASHBOARD
  // ============================================

  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationsByType(type: string): Promise<Organization[]>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  
  // Org Members
  getOrgMember(userId: string, orgId: string): Promise<OrgMember | undefined>;
  getOrgMembers(orgId: string): Promise<(OrgMember & { user: User })[]>;
  getUserOrganizations(userId: string): Promise<(OrgMember & { organization: Organization })[]>;
  createOrgMember(member: InsertOrgMember): Promise<OrgMember>;

  // User Events (for live signals dashboard)
  createUserEvent(event: InsertUserEvent): Promise<UserEvent>;
  getRecentUserEvents(orgId: string, limit?: number): Promise<UserEvent[]>;
  getUserEventsByType(orgId: string, eventType: string, limit?: number): Promise<UserEvent[]>;
  getEventCounts(orgId: string, since: Date): Promise<{ eventType: string; count: number }[]>;

  // AI Sentiment
  createAiSentiment(sentiment: InsertAiSentiment): Promise<AiSentiment>;
  getRecentSentiment(orgId: string, limit?: number): Promise<AiSentiment[]>;
  getAverageSentiment(orgId: string, since: Date): Promise<{ avgSentiment: number; avgTrust: number; avgRisk: number }>;

  // Metric Snapshots
  createMetricSnapshot(snapshot: InsertMetricSnapshot): Promise<MetricSnapshot>;
  getLatestMetrics(orgId: string): Promise<MetricSnapshot[]>;
  getMetricHistory(orgId: string, metricName: string, days?: number): Promise<MetricSnapshot[]>;

  // Risk Tiers
  getRiskTiers(orgId: string): Promise<RiskTier[]>;
  getRiskTiersByLevel(orgId: string, level: string): Promise<RiskTier[]>;
  createOrUpdateRiskTier(tier: InsertRiskTier): Promise<RiskTier>;
  getRiskShifts(orgId: string, since: Date): Promise<RiskTier[]>;

  // Dashboard Analytics (aggregations)
  getDashboardStats(orgId: string): Promise<{
    activeMembers: number;
    activeReferrals: number;
    highRiskMembers: number;
    eventsToday: number;
    avgSentiment: number;
  }>;
  getReferralMetrics(orgId: string): Promise<{
    total: number;
    pending: number;
    completed: number;
    avgTimeToAccept: number;
    avgTimeToClose: number;
  }>;

  // ============================================
  // CRED ECONOMY
  // ============================================
  
  addCredToUser(userId: string, amount: number, reason: string, sourceType?: string, sourceId?: string, idempotencyKey?: string): Promise<{ user: User; transaction: CredTransaction } | undefined>;
  getCredTransactions(userId: string, limit?: number): Promise<CredTransaction[]>;
  getUserCredBalance(userId: string): Promise<number>;

  // Enhanced Check-ins with slots
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  getTodaysCheckIns(userId: string): Promise<CheckIn[]>;
  getCheckInForSlot(userId: string, slot: CheckInSlot, date: Date): Promise<CheckIn | undefined>;
  getCheckInHistory(userId: string, limit?: number): Promise<CheckIn[]>;

  // Impact Dossiers
  createImpactDossier(dossier: InsertImpactDossier): Promise<ImpactDossier>;
  getImpactDossiers(userId: string, limit?: number): Promise<ImpactDossier[]>;
  getImpactDossier(id: string): Promise<ImpactDossier | undefined>;
  getImpactDossierByShareCode(shareCode: string): Promise<ImpactDossier | undefined>;
  generateWeeklyDossier(userId: string): Promise<ImpactDossier>;

  // ============================================
  // STREAK FREEZE SYSTEM
  // ============================================
  
  getAvailableStreakFreezes(userId: string): Promise<StreakFreeze[]>;
  createStreakFreeze(freeze: InsertStreakFreeze): Promise<StreakFreeze>;
  useStreakFreeze(userId: string): Promise<StreakFreeze | undefined>;

  // ============================================
  // STREAK RECOVERY QUESTS
  // ============================================
  
  getActiveRecoveryQuest(userId: string): Promise<StreakRecoveryQuest | undefined>;
  createRecoveryQuest(quest: InsertStreakRecoveryQuest): Promise<StreakRecoveryQuest>;
  completeRecoveryQuest(questId: string, userId?: string): Promise<StreakRecoveryQuest | undefined>;

  // ============================================
  // SIANI MEMORY SYSTEM
  // ============================================
  
  getSianiMemories(userId: string, limit?: number): Promise<SianiMemory[]>;
  createSianiMemory(memory: InsertSianiMemory): Promise<SianiMemory>;
  updateMemoryReference(memoryId: string): Promise<void>;

  // ============================================
  // SIANI NUDGES
  // ============================================
  
  getPendingNudges(userId: string): Promise<SianiNudge[]>;
  getNudgeById(nudgeId: string): Promise<SianiNudge | undefined>;
  createSianiNudge(nudge: InsertSianiNudge): Promise<SianiNudge>;
  markNudgeSeen(nudgeId: string): Promise<SianiNudge | undefined>;

  // ============================================
  // THE VAULT - ANONYMOUS CONFESSIONAL
  // ============================================
  
  getVaultConfessions(limit?: number): Promise<VaultConfession[]>;
  createVaultConfession(confession: InsertVaultConfession): Promise<VaultConfession>;
  reactToConfession(confessionId: string, reactionType: string): Promise<void>;

  // Vault — public-safe accessors used by /api/vault routes. These never
  // expose user_id or moderation/reward metadata to clients.
  getVaultFeedPublic(opts: { userId?: string | null; limit: number; offset: number; category?: string }): Promise<{ confessions: VaultConfessionPublic[]; hasMore: boolean }>;
  getVaultSpotlightsPublic(): Promise<VaultSpotlightPublic[]>;
  getVaultConfessionPublic(confessionId: string, userId?: string | null): Promise<(VaultConfessionPublic & { userReaction: string | null }) | null>;
  getMyVaultConfessions(userId: string): Promise<VaultConfession[]>;
  createVaultConfessionForUser(input: VaultCreateInput): Promise<{ confession: VaultConfession; bonusCredReward: number }>;
  applyVaultReaction(input: VaultReactInput): Promise<VaultReactResult>;
  awardCred(input: { userId: string; amount: number; reason: string; sourceType: string; sourceId: string }): Promise<boolean>;

  // ============================================
  // HEAT INDEX - LEADERBOARD
  // ============================================
  
  getHeatRankings(periodType: string, limit?: number): Promise<HeatRanking[]>;
  getUserHeatRanking(userId: string, periodType: string): Promise<HeatRanking | undefined>;

  // ============================================
  // MEMBERSHIP KEYS
  // ============================================
  
  getMembershipKey(userId: string): Promise<MembershipKey | undefined>;
  createMembershipKey(key: InsertMembershipKey): Promise<MembershipKey>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  /**
   * Hard-delete a user account. All FK relationships in shared/schema.ts use
   * `onDelete: "cascade"` for owned rows (conversations, messages,
   * emotional_states, goals, moves, signals, cred/xp transactions, badges,
   * memories, nudges, locations, vault reactions, non-anonymous vault
   * confessions, etc.) and `onDelete: "set null"` for assignment-style
   * fields (escalations.assigned_to, polls.author_id, organizationIssues
   * resolved_by/reported_by, etc.) so that historical work-tracking rows
   * survive while the deleted user is anonymized. Anonymous vault
   * confessions are unaffected because their user_id is already NULL.
   */
  async deleteUser(id: string): Promise<boolean> {
    // postgres-js exposes a `count` property on the result object;
    // drizzle's typings hide it behind a generic, so we narrow once here.
    const result = (await db.delete(users).where(eq(users.id, id))) as unknown as { count?: number };
    return (result.count ?? 0) > 0;
  }

  async addXpToUser(userId: string, xpAmount: number): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) return undefined;
    
    const newXp = user.xp + xpAmount;
    // Check if user should level up (500 * 1.5^(level-1) XP per level)
    const getXpForLevel = (level: number) => Math.round(500 * Math.pow(1.5, level - 1));
    let newLevel = user.level;
    while (newXp >= getXpForLevel(newLevel + 1)) {
      newLevel++;
    }
    
    const [updated] = await db
      .update(users)
      .set({ xp: newXp, level: newLevel })
      .where(eq(users.id, userId))
      .returning();
    
    return updated;
  }

  // User Locations (separate HSDS-compatible table)
  async getUserLocation(userId: string): Promise<UserLocation | undefined> {
    const [location] = await db
      .select()
      .from(userLocations)
      .where(and(eq(userLocations.userId, userId), eq(userLocations.isPrimary, true)));
    return location;
  }

  async upsertUserLocation(location: InsertUserLocation): Promise<UserLocation> {
    // Check if user already has a primary location
    const existing = await this.getUserLocation(location.userId);
    
    if (existing) {
      // Update existing
      const [updated] = await db
        .update(userLocations)
        .set({ ...location, updatedAt: new Date() })
        .where(eq(userLocations.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new
      const [created] = await db
        .insert(userLocations)
        .values({ ...location, isPrimary: true })
        .returning();
      return created;
    }
  }

  // Conversations
  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async getConversationsByUser(userId: string, limit?: number): Promise<Conversation[]> {
    const query = db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(insertConversation).returning();
    return conversation;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const [conversation] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return conversation;
  }

  // Messages
  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async getMessagesByConversation(conversationId: string, limit = 50): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    return message;
  }

  // Emotional States
  async getEmotionalStatesByUser(userId: string, limit = 20): Promise<EmotionalState[]> {
    return db
      .select()
      .from(emotionalStates)
      .where(eq(emotionalStates.userId, userId))
      .orderBy(desc(emotionalStates.createdAt))
      .limit(limit);
  }

  async createEmotionalState(insertState: InsertEmotionalState): Promise<EmotionalState> {
    const [state] = await db.insert(emotionalStates).values(insertState).returning();
    return state;
  }

  // Signals
  async getSignalsByUser(userId: string, limit = 50): Promise<Signal[]> {
    return db
      .select()
      .from(signals)
      .where(eq(signals.userId, userId))
      .orderBy(desc(signals.createdAt))
      .limit(limit);
  }

  async getUnresolvedSignalsByUser(userId: string): Promise<Signal[]> {
    return db
      .select()
      .from(signals)
      .where(and(eq(signals.userId, userId), eq(signals.isResolved, false)))
      .orderBy(desc(signals.createdAt));
  }

  async createSignal(insertSignal: InsertSignal): Promise<Signal> {
    const [signal] = await db.insert(signals).values(insertSignal).returning();
    return signal;
  }

  async resolveSignal(id: string): Promise<Signal | undefined> {
    const [signal] = await db
      .update(signals)
      .set({ isResolved: true, resolvedAt: new Date() })
      .where(eq(signals.id, id))
      .returning();
    return signal;
  }

  // Escalations
  async createEscalation(insertEscalation: InsertEscalation): Promise<Escalation> {
    const [escalation] = await db.insert(escalations).values(insertEscalation).returning();
    return escalation;
  }

  async getOpenEscalations(): Promise<Escalation[]> {
    return db
      .select()
      .from(escalations)
      .where(ne(escalations.state, "resolved"))
      .orderBy(desc(escalations.createdAt));
  }

  async updateEscalationState(id: string, state: string, resolvedAt?: Date): Promise<Escalation | undefined> {
    const [escalation] = await db
      .update(escalations)
      .set({ state, resolvedAt })
      .where(eq(escalations.id, id))
      .returning();
    return escalation;
  }

  // Goals
  async getGoalsByUser(userId: string, limit?: number): Promise<Goal[]> {
    const query = db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(desc(goals.createdAt));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async getGoalById(id: string): Promise<Goal | undefined> {
    const [goal] = await db
      .select()
      .from(goals)
      .where(eq(goals.id, id));
    return goal;
  }

  async getCompletedGoalsCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.isCompleted, true)));
    return result[0]?.count ?? 0;
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const [goal] = await db.insert(goals).values(insertGoal).returning();
    return goal;
  }

  async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | undefined> {
    const [goal] = await db
      .update(goals)
      .set(updates)
      .where(eq(goals.id, id))
      .returning();
    return goal;
  }

  async deleteGoal(id: string): Promise<boolean> {
    const result = await db.delete(goals).where(eq(goals.id, id));
    return true;
  }

  async findSimilarGoal(userId: string, title: string): Promise<Goal | undefined> {
    // Normalize the title for comparison (lowercase, trim, remove extra spaces and common words)
    const normalizeText = (text: string) => {
      const stopWords = ["a", "an", "the", "to", "start", "begin", "more", "my", "i", "want", "need"];
      return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .filter(word => !stopWords.includes(word) && word.length > 2)
        .sort()
        .join(" ");
    };
    
    const normalizedTitle = normalizeText(title);
    const titleWords = new Set(title.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    
    // Get all user goals and check for similarity
    const userGoals = await this.getGoalsByUser(userId);
    
    for (const goal of userGoals) {
      const existingNormalized = normalizeText(goal.title);
      const existingWords = new Set(goal.title.toLowerCase().split(/\s+/).filter(w => w.length > 2));
      
      // Check for exact match after normalization
      if (existingNormalized === normalizedTitle) {
        return goal;
      }
      
      // Check for significant word overlap (>50% of key words match)
      const intersection = Array.from(titleWords).filter(w => existingWords.has(w));
      const minSize = Math.min(titleWords.size, existingWords.size);
      if (minSize > 0 && intersection.length / minSize >= 0.5) {
        return goal;
      }
      
      // Check if one contains the other
      const rawExisting = goal.title.toLowerCase().trim();
      const rawTitle = title.toLowerCase().trim();
      if (rawExisting.includes(rawTitle) || rawTitle.includes(rawExisting)) {
        return goal;
      }
    }
    
    return undefined;
  }

  // Badges
  async getAllBadges(): Promise<Badge[]> {
    return db.select().from(badges).orderBy(badges.createdAt);
  }

  async getUserBadges(userId: string): Promise<{ badge: Badge; earnedAt: Date }[]> {
    const results = await db
      .select({
        badge: badges,
        earnedAt: userBadges.earnedAt,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.earnedAt));
    
    return results.map(r => ({ badge: r.badge, earnedAt: r.earnedAt }));
  }

  // Moves
  async getMovesByUser(userId: string, limit?: number): Promise<Move[]> {
    const query = db
      .select()
      .from(moves)
      .where(eq(moves.userId, userId))
      .orderBy(desc(moves.scheduledFor));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async getMovesByGoal(goalId: string): Promise<Move[]> {
    return db
      .select()
      .from(moves)
      .where(eq(moves.goalId, goalId))
      .orderBy(desc(moves.scheduledFor));
  }

  async getMoveById(id: string): Promise<Move | undefined> {
    const [move] = await db.select().from(moves).where(eq(moves.id, id)).limit(1);
    return move;
  }

  async createMove(insertMove: InsertMove): Promise<Move> {
    const [move] = await db.insert(moves).values(insertMove).returning();
    return move;
  }

  async updateMove(id: string, updates: Partial<Move>): Promise<Move | undefined> {
    const [move] = await db
      .update(moves)
      .set(updates)
      .where(eq(moves.id, id))
      .returning();
    return move;
  }

  async completeMove(id: string): Promise<Move | undefined> {
    const [move] = await db
      .update(moves)
      .set({ isCompleted: true, completedAt: new Date() })
      .where(eq(moves.id, id))
      .returning();
    return move;
  }

  // Stats
  async getCompletedMovesCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(moves)
      .where(and(eq(moves.userId, userId), eq(moves.isCompleted, true)));
    return Number(result[0]?.count ?? 0);
  }

  async getCompletedChallengesCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(challengeParticipants)
      .where(and(eq(challengeParticipants.userId, userId), eq(challengeParticipants.status, "completed")));
    return Number(result[0]?.count ?? 0);
  }

  async getChallengeWins(userId: string): Promise<{ id: string; title: string; prize: string; completedAt: Date; xpEarned: number }[]> {
    const { challenges } = await import("@shared/schema");
    const results = await db
      .select({
        id: challengeParticipants.id,
        title: challenges.title,
        prize: challenges.prizeDescription,
        completedAt: challengeParticipants.completedAt,
        xpEarned: challenges.xpReward,
      })
      .from(challengeParticipants)
      .innerJoin(challenges, eq(challengeParticipants.challengeId, challenges.id))
      .where(and(eq(challengeParticipants.userId, userId), eq(challengeParticipants.isWinner, true)))
      .orderBy(desc(challengeParticipants.completedAt));
    
    return results.map(r => ({
      id: r.id,
      title: r.title,
      prize: r.prize || "",
      completedAt: r.completedAt || new Date(),
      xpEarned: r.xpEarned || 0,
    }));
  }

  // Care Team
  async getCareThreadsForUser(userId: string): Promise<{
    thread: CareThread;
    caregiver: User;
    unreadCount: number;
    lastMessage?: CareMessage;
  }[]> {
    // Get all threads for this user
    const threads = await db
      .select()
      .from(careThreads)
      .where(eq(careThreads.memberUserId, userId))
      .orderBy(desc(careThreads.lastMessageAt));

    const results = [];
    for (const thread of threads) {
      // Get the first care team member as the caregiver for this thread
      const [teamMember] = await db
        .select()
        .from(careTeamMembers)
        .where(eq(careTeamMembers.teamId, thread.teamId))
        .limit(1);

      if (teamMember) {
        const caregiver = await this.getUser(teamMember.userId);
        if (caregiver) {
          // Count unread messages
          const unreadMessages = await db
            .select()
            .from(careMessages)
            .where(
              and(
                eq(careMessages.threadId, thread.id),
                eq(careMessages.isRead, false),
                sql`${careMessages.senderId} != ${userId}`
              )
            );

          // Get last message
          const [lastMessage] = await db
            .select()
            .from(careMessages)
            .where(eq(careMessages.threadId, thread.id))
            .orderBy(desc(careMessages.createdAt))
            .limit(1);

          results.push({
            thread,
            caregiver,
            unreadCount: unreadMessages.length,
            lastMessage: lastMessage || undefined,
          });
        }
      }
    }

    return results;
  }

  async getCareThread(threadId: string): Promise<CareThread | undefined> {
    const [thread] = await db.select().from(careThreads).where(eq(careThreads.id, threadId));
    return thread;
  }

  async getCareMessages(threadId: string): Promise<CareMessage[]> {
    return db
      .select()
      .from(careMessages)
      .where(eq(careMessages.threadId, threadId))
      .orderBy(careMessages.createdAt);
  }

  async createCareMessage(insertMessage: InsertCareMessage): Promise<CareMessage> {
    const [message] = await db.insert(careMessages).values(insertMessage).returning();
    
    // Update thread's lastMessageAt
    await db
      .update(careThreads)
      .set({ lastMessageAt: new Date() })
      .where(eq(careThreads.id, insertMessage.threadId));
    
    return message;
  }

  async getOrCreateCareThread(memberUserId: string, teamId: string): Promise<CareThread> {
    // Check if thread already exists
    const [existingThread] = await db
      .select()
      .from(careThreads)
      .where(
        and(
          eq(careThreads.memberUserId, memberUserId),
          eq(careThreads.teamId, teamId)
        )
      );

    if (existingThread) {
      return existingThread;
    }

    // Create new thread
    const [newThread] = await db
      .insert(careThreads)
      .values({
        memberUserId,
        teamId,
        status: "open",
        priority: "normal",
      })
      .returning();

    return newThread;
  }

  // Resources
  async getResource(id: string): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource;
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [created] = await db
      .insert(resources)
      .values({
        ...resource,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return created;
  }

  async getResourcesByCategory(category: string): Promise<Resource[]> {
    return db
      .select()
      .from(resources)
      .where(eq(resources.category, category))
      .orderBy(desc(resources.isVerified));
  }

  async getAllResources(): Promise<Resource[]> {
    return db
      .select()
      .from(resources)
      .orderBy(desc(resources.isVerified), resources.category);
  }

  async searchResources(query: string): Promise<Resource[]> {
    const lowerQuery = query.toLowerCase();
    return db
      .select()
      .from(resources)
      .where(
        or(
          sql`LOWER(${resources.name}) LIKE ${`%${lowerQuery}%`}`,
          sql`LOWER(${resources.description}) LIKE ${`%${lowerQuery}%`}`,
          sql`LOWER(${resources.category}) LIKE ${`%${lowerQuery}%`}`
        )
      )
      .orderBy(desc(resources.isVerified));
  }

  // Referrals
  async getReferralsForUser(userId: string): Promise<(Referral & { resource: Resource })[]> {
    const results = await db
      .select({
        referral: referrals,
        resource: resources,
      })
      .from(referrals)
      .innerJoin(resources, eq(referrals.resourceId, resources.id))
      .where(eq(referrals.userId, userId))
      .orderBy(desc(referrals.createdAt));

    return results.map(r => ({
      ...r.referral,
      resource: r.resource,
    }));
  }

  async getActiveReferralsForUser(userId: string): Promise<(Referral & { resource: Resource })[]> {
    const results = await db
      .select({
        referral: referrals,
        resource: resources,
      })
      .from(referrals)
      .innerJoin(resources, eq(referrals.resourceId, resources.id))
      .where(
        and(
          eq(referrals.userId, userId),
          ne(referrals.state, "completed"),
          ne(referrals.state, "declined")
        )
      )
      .orderBy(desc(referrals.createdAt));

    return results.map(r => ({
      ...r.referral,
      resource: r.resource,
    }));
  }

  async getReferral(id: string): Promise<(Referral & { resource: Resource }) | undefined> {
    const [result] = await db
      .select({
        referral: referrals,
        resource: resources,
      })
      .from(referrals)
      .innerJoin(resources, eq(referrals.resourceId, resources.id))
      .where(eq(referrals.id, id));

    if (!result) return undefined;
    return {
      ...result.referral,
      resource: result.resource,
    };
  }

  async createReferral(referral: {
    userId: string;
    resourceId: string;
    source: string;
    linkedGoalId?: string;
    linkedSignalId?: string;
    state: string;
    priority?: string;
    dueDate?: Date;
    notes?: string;
  }): Promise<Referral> {
    const [created] = await db
      .insert(referrals)
      .values({
        userId: referral.userId,
        resourceId: referral.resourceId,
        source: referral.source,
        linkedGoalId: referral.linkedGoalId || null,
        linkedSignalId: referral.linkedSignalId || null,
        state: referral.state,
        priority: referral.priority || "normal",
        dueDate: referral.dueDate || null,
        notes: referral.notes || null,
      })
      .returning();
    return created;
  }

  async updateReferralState(id: string, state: string, notes?: string): Promise<Referral | undefined> {
    const updates: any = {
      state,
      updatedAt: new Date(),
    };
    if (notes) {
      updates.notes = notes;
    }
    const [updated] = await db
      .update(referrals)
      .set(updates)
      .where(eq(referrals.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // ORGANIZATION ACCOUNTABILITY
  // ============================================

  async createReferralOutcome(outcome: InsertReferralOutcome): Promise<ReferralOutcome> {
    const [created] = await db
      .insert(referralOutcomes)
      .values({
        ...outcome,
        createdAt: new Date(),
      })
      .returning();
    return created;
  }

  async getResourceOutcomes(resourceId: string): Promise<ReferralOutcome[]> {
    return db
      .select()
      .from(referralOutcomes)
      .where(eq(referralOutcomes.resourceId, resourceId))
      .orderBy(desc(referralOutcomes.createdAt));
  }

  async createOrganizationIssue(issue: InsertOrganizationIssue): Promise<OrganizationIssue> {
    const [created] = await db
      .insert(organizationIssues)
      .values({
        ...issue,
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return created;
  }

  async getOrganizationIssues(resourceId: string, status?: string): Promise<OrganizationIssue[]> {
    if (status) {
      return db
        .select()
        .from(organizationIssues)
        .where(and(
          eq(organizationIssues.resourceId, resourceId),
          eq(organizationIssues.status, status)
        ))
        .orderBy(desc(organizationIssues.createdAt));
    }
    return db
      .select()
      .from(organizationIssues)
      .where(eq(organizationIssues.resourceId, resourceId))
      .orderBy(desc(organizationIssues.createdAt));
  }

  async getResourceOutcomesBatch(resourceIds: string[]): Promise<Map<string, ReferralOutcome[]>> {
    const result = new Map<string, ReferralOutcome[]>();
    if (resourceIds.length === 0) return result;
    const outcomes = await db
      .select()
      .from(referralOutcomes)
      .where(inArray(referralOutcomes.resourceId, resourceIds));
    for (const outcome of outcomes) {
      const key = outcome.resourceId || '';
      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push(outcome);
    }
    return result;
  }

  async getOrganizationIssuesBatch(resourceIds: string[]): Promise<Map<string, OrganizationIssue[]>> {
    const result = new Map<string, OrganizationIssue[]>();
    if (resourceIds.length === 0) return result;
    const issues = await db
      .select()
      .from(organizationIssues)
      .where(inArray(organizationIssues.resourceId, resourceIds));
    for (const issue of issues) {
      const key = issue.resourceId;
      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push(issue);
    }
    return result;
  }

  async updateResourceMetricsFromOutcome(resourceId: string, outcome: ReferralOutcome): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, resourceId));
    if (!resource) return undefined;

    // Calculate updated metrics
    const totalReferrals = (resource.totalReferrals ?? 0) + 1;
    let successfulReferrals = resource.successfulReferrals ?? 0;
    let failedReferrals = resource.failedReferrals ?? 0;

    if (outcome.result === 'success') {
      successfulReferrals += 1;
    } else if (outcome.result === 'org_failed' || outcome.result === 'no_contact') {
      failedReferrals += 1;
    }

    const successRate = totalReferrals > 0 ? (successfulReferrals / totalReferrals) * 100 : 0;

    // Update response time average
    let avgResponseDays = resource.avgResponseDays ?? 0;
    if (outcome.orgResponseDays !== null && outcome.orgResponseDays !== undefined) {
      const prevTotal = resource.totalReferrals ?? 0;
      if (prevTotal > 0) {
        avgResponseDays = ((avgResponseDays * prevTotal) + outcome.orgResponseDays) / totalReferrals;
      } else {
        avgResponseDays = outcome.orgResponseDays;
      }
    }

    // Update completion time average
    let avgCompletionDays = resource.avgCompletionDays ?? 0;
    if (outcome.orgCompletionDays !== null && outcome.orgCompletionDays !== undefined) {
      const prevTotal = resource.totalReferrals ?? 0;
      if (prevTotal > 0) {
        avgCompletionDays = ((avgCompletionDays * prevTotal) + outcome.orgCompletionDays) / totalReferrals;
      } else {
        avgCompletionDays = outcome.orgCompletionDays;
      }
    }

    // Update red tape score based on barrier type
    let redTapeScore = resource.redTapeScore ?? 0;
    if (outcome.barrierType && outcome.barrierType !== 'none') {
      const barrierWeights: Record<string, number> = {
        documentation: 30,
        eligibility: 20,
        wait_time: 15,
        unresponsive: 40,
        denied: 25,
        closed: 10,
        rude_staff: 35,
        wrong_info: 20,
        discrimination: 50,
        other: 15,
      };
      const weight = barrierWeights[outcome.barrierType] ?? 15;
      redTapeScore = Math.min(100, Math.round(redTapeScore * 0.8 + weight * 0.2));
    }

    // Update reliability score
    let reliabilityScore = resource.reliabilityScore ?? 100;
    if (outcome.result === 'success') {
      reliabilityScore = Math.min(100, reliabilityScore + 2);
    } else if (outcome.result === 'org_failed' || outcome.result === 'no_contact') {
      reliabilityScore = Math.max(0, reliabilityScore - 5);
    }

    const [updated] = await db
      .update(resources)
      .set({
        totalReferrals,
        successfulReferrals,
        failedReferrals,
        successRate,
        avgResponseDays,
        avgCompletionDays,
        redTapeScore,
        reliabilityScore,
        updatedAt: new Date(),
      })
      .where(eq(resources.id, resourceId))
      .returning();

    return updated;
  }

  async updateResourceMetricsFromIssue(resourceId: string, issue: OrganizationIssue): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, resourceId));
    if (!resource) return undefined;

    const issueCount = (resource.issueCount ?? 0) + 1;
    
    // Reduce reliability based on severity
    const severityImpact: Record<string, number> = {
      low: 3,
      medium: 7,
      high: 15,
      critical: 25,
    };
    const impact = severityImpact[issue.severity] ?? 7;
    const reliabilityScore = Math.max(0, (resource.reliabilityScore ?? 100) - impact);

    // Increase red tape for documentation-related issues
    let redTapeScore = resource.redTapeScore ?? 0;
    if (issue.issueType === 'excessive_docs' || issue.issueType === 'wrong_info') {
      redTapeScore = Math.min(100, redTapeScore + 10);
    }

    // Flag if too many issues or critical
    let isFlagged = resource.isFlagged ?? false;
    let flagReason = resource.flagReason;
    if (issueCount >= 3 || issue.severity === 'critical') {
      isFlagged = true;
      flagReason = issue.severity === 'critical'
        ? `Critical issue: ${issue.issueType}`
        : `Multiple issues reported (${issueCount})`;
    }

    const [updated] = await db
      .update(resources)
      .set({
        issueCount,
        lastIssueAt: new Date(),
        reliabilityScore,
        redTapeScore,
        isFlagged,
        flagReason,
        updatedAt: new Date(),
      })
      .where(eq(resources.id, resourceId))
      .returning();

    return updated;
  }

  async updateResourceFlag(resourceId: string, isFlagged: boolean, flagReason?: string): Promise<Resource | undefined> {
    const [updated] = await db
      .update(resources)
      .set({
        isFlagged,
        flagReason: flagReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(resources.id, resourceId))
      .returning();
    return updated;
  }

  // ============================================
  // REFERRAL NOTES (WITH VERIFICATION)
  // ============================================

  async createReferralNote(note: InsertReferralNote): Promise<ReferralNote> {
    // If note is from user or Siani, auto-verify
    const autoVerify = note.authorType === 'user' || note.authorType === 'siani';
    
    const [created] = await db
      .insert(referralNotes)
      .values({
        ...note,
        verificationStatus: autoVerify ? 'auto_verified' : 'pending',
        verifiedAt: autoVerify ? new Date() : null,
        verifiedBySiani: note.authorType === 'siani',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return created;
  }

  async getReferralNotes(referralId: string): Promise<ReferralNote[]> {
    return db
      .select()
      .from(referralNotes)
      .where(eq(referralNotes.referralId, referralId))
      .orderBy(desc(referralNotes.createdAt));
  }

  async getPendingVerifications(userId: string): Promise<ReferralNote[]> {
    // Get pending notes for referrals that belong to this user
    const userReferrals = await db
      .select({ id: referrals.id })
      .from(referrals)
      .where(eq(referrals.userId, userId));
    
    const referralIds = userReferrals.map(r => r.id);
    if (referralIds.length === 0) return [];

    return db
      .select()
      .from(referralNotes)
      .where(and(
        eq(referralNotes.verificationStatus, 'pending'),
        inArray(referralNotes.referralId, referralIds)
      ))
      .orderBy(desc(referralNotes.createdAt));
  }

  async verifyReferralNote(
    noteId: string, 
    status: string, 
    verifiedByUserId?: string, 
    verifiedBySiani?: boolean, 
    verificationNote?: string
  ): Promise<ReferralNote | undefined> {
    const [updated] = await db
      .update(referralNotes)
      .set({
        verificationStatus: status,
        verifiedByUserId: verifiedByUserId ?? null,
        verifiedBySiani: verifiedBySiani ?? false,
        verificationNote: verificationNote ?? null,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(referralNotes.id, noteId))
      .returning();
    
    // If verified and there's a proposed state change, apply it
    if (updated && status === 'verified' && updated.proposedState && !updated.stateChangeApplied) {
      await this.updateReferralState(updated.referralId, updated.proposedState);
      await db
        .update(referralNotes)
        .set({ stateChangeApplied: true })
        .where(eq(referralNotes.id, noteId));
    }
    
    return updated;
  }

  async createOrgContact(contact: InsertOrgContact): Promise<OrgContact> {
    const [created] = await db
      .insert(orgContacts)
      .values({
        ...contact,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return created;
  }

  async getOrgContactsForResource(resourceId: string): Promise<OrgContact[]> {
    return db
      .select()
      .from(orgContacts)
      .where(and(
        eq(orgContacts.resourceId, resourceId),
        eq(orgContacts.isActive, true)
      ))
      .orderBy(orgContacts.name);
  }

  // ============================================
  // THE FLOW - Three Lane System
  // ============================================

  // Drops & Access (Lane 1) - sorted by urgency (closing soon first)
  async getActiveDrops(limit = 20): Promise<Drop[]> {
    const now = new Date();
    console.log("[getActiveDrops] Querying drops with limit:", limit, "now:", now.toISOString());
    const results = await db
      .select()
      .from(drops)
      .where(
        and(
          eq(drops.status, "active"),
          or(
            isNull(drops.accessWindowEnd),
            gte(drops.accessWindowEnd, now)
          )
        )
      )
      .orderBy(
        // Featured first, then by closing time (urgent first), then by creation
        desc(drops.isFeatured),
        drops.accessWindowEnd,
        desc(drops.createdAt)
      )
      .limit(limit);
    console.log("[getActiveDrops] Found", results.length, "drops");
    return results;
  }

  async getDrop(id: string): Promise<Drop | undefined> {
    const [drop] = await db.select().from(drops).where(eq(drops.id, id));
    return drop;
  }

  async rsvpToDrop(dropId: string, userId: string): Promise<{ success: boolean; status: string }> {
    // Check if already RSVPed
    const [existing] = await db
      .select()
      .from(dropRsvps)
      .where(and(eq(dropRsvps.dropId, dropId), eq(dropRsvps.userId, userId)));
    
    if (existing) {
      return { success: false, status: existing.status };
    }

    // Get the drop to check seat availability
    const drop = await this.getDrop(dropId);
    if (!drop) {
      return { success: false, status: "not_found" };
    }

    // Determine status based on seat availability
    let rsvpStatus = "confirmed";
    if (drop.seatCount !== null && drop.seatsRemaining !== null) {
      if (drop.seatsRemaining <= 0) {
        rsvpStatus = "waitlist";
      } else {
        // Decrement seats
        await db
          .update(drops)
          .set({ 
            seatsRemaining: drop.seatsRemaining - 1,
            rsvpCount: (drop.rsvpCount || 0) + 1
          })
          .where(eq(drops.id, dropId));
      }
    } else {
      // No seat limit, just increment RSVP count
      await db
        .update(drops)
        .set({ rsvpCount: (drop.rsvpCount || 0) + 1 })
        .where(eq(drops.id, dropId));
    }

    // Create RSVP
    await db.insert(dropRsvps).values({
      dropId,
      userId,
      status: rsvpStatus,
    });

    return { success: true, status: rsvpStatus };
  }

  async getUserDropRsvps(userId: string): Promise<string[]> {
    const rsvps = await db
      .select({ dropId: dropRsvps.dropId })
      .from(dropRsvps)
      .where(eq(dropRsvps.userId, userId));
    return rsvps.map(r => r.dropId);
  }

  // Signals & Sightings (Lane 2) - sorted by freshness
  async getRecentSignals(limit = 20): Promise<FeedSignal[]> {
    return db
      .select()
      .from(feedSignals)
      .where(eq(feedSignals.status, "active"))
      .orderBy(desc(feedSignals.isFeatured), desc(feedSignals.createdAt))
      .limit(limit);
  }

  async getFeedSignal(id: string): Promise<FeedSignal | undefined> {
    const [signal] = await db.select().from(feedSignals).where(eq(feedSignals.id, id));
    return signal;
  }

  // Circle Spotlights (Lane 3) - member achievements
  async getSpotlights(limit = 20): Promise<Spotlight[]> {
    return db
      .select()
      .from(spotlights)
      .where(eq(spotlights.status, "active"))
      .orderBy(desc(spotlights.isFeatured), desc(spotlights.createdAt))
      .limit(limit);
  }

  async getSpotlight(id: string): Promise<Spotlight | undefined> {
    const [spotlight] = await db.select().from(spotlights).where(eq(spotlights.id, id));
    return spotlight;
  }

  // Energy Reactions
  async addEnergyReaction(
    userId: string,
    contentType: FlowLane,
    contentId: string,
    reactionType: EnergyReactionType
  ): Promise<boolean> {
    // Check if reaction already exists
    const [existing] = await db
      .select()
      .from(energyReactions)
      .where(
        and(
          eq(energyReactions.userId, userId),
          eq(energyReactions.contentType, contentType),
          eq(energyReactions.contentId, contentId),
          eq(energyReactions.reactionType, reactionType)
        )
      );

    if (existing) {
      return false; // Already reacted
    }

    // Add reaction
    await db.insert(energyReactions).values({
      userId,
      contentType,
      contentId,
      reactionType,
    });

    // Increment count on the content
    const countField = reactionType === "fire" ? "fireCount" 
      : reactionType === "strength" ? "strengthCount" 
      : "heartCount";

    if (contentType === "drops") {
      const drop = await this.getDrop(contentId);
      if (drop) {
        await db.update(drops).set({ 
          [countField]: ((drop as any)[countField] || 0) + 1 
        }).where(eq(drops.id, contentId));
      }
    } else if (contentType === "signals") {
      const signal = await this.getFeedSignal(contentId);
      if (signal) {
        await db.update(feedSignals).set({ 
          [countField]: ((signal as any)[countField] || 0) + 1 
        }).where(eq(feedSignals.id, contentId));
      }
    } else if (contentType === "spotlights") {
      const spotlight = await this.getSpotlight(contentId);
      if (spotlight) {
        await db.update(spotlights).set({ 
          [countField]: ((spotlight as any)[countField] || 0) + 1 
        }).where(eq(spotlights.id, contentId));
      }
    }

    return true;
  }

  async removeEnergyReaction(
    userId: string,
    contentType: FlowLane,
    contentId: string,
    reactionType: EnergyReactionType
  ): Promise<boolean> {
    const result = await db
      .delete(energyReactions)
      .where(
        and(
          eq(energyReactions.userId, userId),
          eq(energyReactions.contentType, contentType),
          eq(energyReactions.contentId, contentId),
          eq(energyReactions.reactionType, reactionType)
        )
      );

    // Decrement count on the content
    const countField = reactionType === "fire" ? "fireCount" 
      : reactionType === "strength" ? "strengthCount" 
      : "heartCount";

    if (contentType === "drops") {
      const drop = await this.getDrop(contentId);
      if (drop && (drop as any)[countField] > 0) {
        await db.update(drops).set({ 
          [countField]: (drop as any)[countField] - 1 
        }).where(eq(drops.id, contentId));
      }
    } else if (contentType === "signals") {
      const signal = await this.getFeedSignal(contentId);
      if (signal && (signal as any)[countField] > 0) {
        await db.update(feedSignals).set({ 
          [countField]: (signal as any)[countField] - 1 
        }).where(eq(feedSignals.id, contentId));
      }
    } else if (contentType === "spotlights") {
      const spotlight = await this.getSpotlight(contentId);
      if (spotlight && (spotlight as any)[countField] > 0) {
        await db.update(spotlights).set({ 
          [countField]: (spotlight as any)[countField] - 1 
        }).where(eq(spotlights.id, contentId));
      }
    }

    return true;
  }

  async getUserReactions(
    userId: string,
    contentType: FlowLane,
    contentIds: string[]
  ): Promise<{ contentId: string; reactions: EnergyReactionType[] }[]> {
    if (contentIds.length === 0) return [];

    const reactions = await db
      .select()
      .from(energyReactions)
      .where(
        and(
          eq(energyReactions.userId, userId),
          eq(energyReactions.contentType, contentType),
          sql`${energyReactions.contentId} = ANY(${contentIds})`
        )
      );

    // Group by contentId
    const grouped = new Map<string, EnergyReactionType[]>();
    for (const r of reactions) {
      const existing = grouped.get(r.contentId) || [];
      existing.push(r.reactionType as EnergyReactionType);
      grouped.set(r.contentId, existing);
    }

    return contentIds.map(id => ({
      contentId: id,
      reactions: grouped.get(id) || [],
    }));
  }

  // ============================================
  // NIGHT SHIFT FLOW
  // ============================================

  async getDropsByStatus(status: 'active' | 'upcoming' | 'closed'): Promise<Drop[]> {
    const now = new Date();
    
    if (status === 'active') {
      return db
        .select()
        .from(drops)
        .where(
          and(
            eq(drops.status, 'active'),
            or(
              isNull(drops.accessWindowEnd),
              gte(drops.accessWindowEnd, now)
            )
          )
        )
        .orderBy(desc(drops.isFeatured), drops.accessWindowEnd, desc(drops.createdAt));
    } else if (status === 'upcoming') {
      return db
        .select()
        .from(drops)
        .where(
          and(
            eq(drops.status, 'active'),
            or(
              isNull(drops.accessWindowStart),
              gte(drops.accessWindowStart, now)
            )
          )
        )
        .orderBy(drops.accessWindowStart, desc(drops.createdAt));
    } else {
      return db
        .select()
        .from(drops)
        .where(
          or(
            eq(drops.status, 'closed'),
            and(
              eq(drops.status, 'active'),
              lte(drops.accessWindowEnd, now)
            )
          )
        )
        .orderBy(desc(drops.accessWindowEnd), desc(drops.createdAt));
    }
  }

  async getDropById(id: string): Promise<Drop | undefined> {
    return this.getDrop(id);
  }

  async createDropRsvp(userId: string, dropId: string): Promise<{ status: string; position?: number }> {
    const [existing] = await db
      .select()
      .from(dropRsvps)
      .where(and(eq(dropRsvps.dropId, dropId), eq(dropRsvps.userId, userId)));
    
    if (existing) {
      return { status: existing.status };
    }

    const drop = await this.getDrop(dropId);
    if (!drop) {
      return { status: 'not_found' };
    }

    let rsvpStatus = 'confirmed';
    let position: number | undefined;

    if (drop.seatCount !== null && drop.seatsRemaining !== null) {
      if (drop.seatsRemaining <= 0) {
        rsvpStatus = 'waitlist';
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(dropRsvps)
          .where(and(eq(dropRsvps.dropId, dropId), eq(dropRsvps.status, 'waitlist')));
        position = (countResult?.count || 0) + 1;
      } else {
        await db
          .update(drops)
          .set({ 
            seatsRemaining: drop.seatsRemaining - 1,
            rsvpCount: (drop.rsvpCount || 0) + 1
          })
          .where(eq(drops.id, dropId));
      }
    } else {
      await db
        .update(drops)
        .set({ rsvpCount: (drop.rsvpCount || 0) + 1 })
        .where(eq(drops.id, dropId));
    }

    await db.insert(dropRsvps).values({
      dropId,
      userId,
      status: rsvpStatus,
      confirmedAt: rsvpStatus === 'confirmed' ? new Date() : undefined,
    });

    return position !== undefined ? { status: rsvpStatus, position } : { status: rsvpStatus };
  }

  async getUserDropRsvp(userId: string, dropId: string): Promise<DropRsvp | undefined> {
    const [rsvp] = await db
      .select()
      .from(dropRsvps)
      .where(and(eq(dropRsvps.dropId, dropId), eq(dropRsvps.userId, userId)));
    return rsvp;
  }

  async getDropRsvpCount(dropId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dropRsvps)
      .where(eq(dropRsvps.dropId, dropId));
    return result?.count || 0;
  }

  async getFeedSignalsByLane(lane: 'signals' | 'circle'): Promise<FeedSignal[]> {
    if (lane === 'signals') {
      return db
        .select()
        .from(feedSignals)
        .where(eq(feedSignals.status, 'active'))
        .orderBy(desc(feedSignals.isFeatured), desc(feedSignals.createdAt));
    } else {
      return db
        .select()
        .from(feedSignals)
        .where(
          and(
            eq(feedSignals.status, 'active'),
            eq(feedSignals.exclusivityTier, 'inner_circle')
          )
        )
        .orderBy(desc(feedSignals.isFeatured), desc(feedSignals.createdAt));
    }
  }

  async addFeedReaction(userId: string, feedSignalId: string, reactionType: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(feedReactions)
      .where(
        and(
          eq(feedReactions.userId, userId),
          eq(feedReactions.feedSignalId, feedSignalId),
          eq(feedReactions.reactionType, reactionType)
        )
      );

    if (existing) {
      return;
    }

    await db.insert(feedReactions).values({
      userId,
      feedSignalId,
      reactionType,
    });

    const countField = reactionType === 'fire' ? 'fireCount' 
      : reactionType === 'strength' ? 'strengthCount' 
      : 'heartCount';

    const signal = await this.getFeedSignal(feedSignalId);
    if (signal) {
      await db.update(feedSignals).set({ 
        [countField]: ((signal as any)[countField] || 0) + 1 
      }).where(eq(feedSignals.id, feedSignalId));
    }

    await this.addCredToUser(userId, 5, 'feed_reaction', 'feed_reaction', feedSignalId);
  }

  async getFeedSignalReactions(feedSignalId: string): Promise<{ type: string; count: number }[]> {
    const results = await db
      .select({
        type: feedReactions.reactionType,
        count: sql<number>`count(*)::int`,
      })
      .from(feedReactions)
      .where(eq(feedReactions.feedSignalId, feedSignalId))
      .groupBy(feedReactions.reactionType);
    
    return results;
  }

  // ============================================
  // PHASE 1: DAILY DOPAMINE LOOP
  // ============================================

  // Pulse - Daily community questions
  async getTodaysPulseQuestion(userId: string): Promise<PulseQuestion | undefined> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Get questions the user has already answered today
    const answeredToday = await db
      .select({ questionId: pulseResponses.questionId })
      .from(pulseResponses)
      .where(
        and(
          eq(pulseResponses.userId, userId),
          gte(pulseResponses.createdAt, todayStart),
          lte(pulseResponses.createdAt, todayEnd)
        )
      );

    const answeredIds = answeredToday.map(r => r.questionId);

    // Get active questions that haven't expired and user hasn't answered today
    const availableQuestions = await db
      .select()
      .from(pulseQuestions)
      .where(
        and(
          eq(pulseQuestions.isActive, true),
          or(
            isNull(pulseQuestions.expiresAt),
            gte(pulseQuestions.expiresAt, now)
          )
        )
      )
      .orderBy(desc(pulseQuestions.priority), desc(pulseQuestions.createdAt));

    // Filter out already answered questions
    const unanswered = availableQuestions.filter(q => !answeredIds.includes(q.id));

    // Return first unanswered question (highest priority)
    return unanswered[0];
  }

  async getPulseQuestionById(id: string): Promise<PulseQuestion | undefined> {
    const [question] = await db
      .select()
      .from(pulseQuestions)
      .where(eq(pulseQuestions.id, id));
    return question;
  }

  async submitPulseResponse(userId: string, questionId: string, response: string): Promise<PulseResponse> {
    // Get the question to determine XP reward
    const question = await this.getPulseQuestionById(questionId);
    const xpReward = question?.xpReward || 5;

    // Create the response
    const [pulseResponse] = await db
      .insert(pulseResponses)
      .values({
        userId,
        questionId,
        response,
        xpEarned: xpReward,
      })
      .returning();

    // NOTE: XP/CRED is awarded by the route handler via addCredToUser
    // (which also increments XP). Do not double-award here.

    return pulseResponse;
  }

  async getUserPulseResponses(userId: string, limit = 20): Promise<(PulseResponse & { question: PulseQuestion })[]> {
    const responses = await db
      .select({
        response: pulseResponses,
        question: pulseQuestions,
      })
      .from(pulseResponses)
      .innerJoin(pulseQuestions, eq(pulseResponses.questionId, pulseQuestions.id))
      .where(eq(pulseResponses.userId, userId))
      .orderBy(desc(pulseResponses.createdAt))
      .limit(limit);

    return responses.map(r => ({
      ...r.response,
      question: r.question,
    }));
  }

  // Rhythm - Habit tracking
  async getUserRhythms(userId: string): Promise<Rhythm[]> {
    return db
      .select()
      .from(rhythms)
      .where(and(eq(rhythms.userId, userId), eq(rhythms.isActive, true)))
      .orderBy(desc(rhythms.createdAt));
  }

  async getRhythmById(id: string): Promise<Rhythm | undefined> {
    const [rhythm] = await db.select().from(rhythms).where(eq(rhythms.id, id));
    return rhythm;
  }

  async createRhythm(rhythm: InsertRhythm): Promise<Rhythm> {
    const [created] = await db.insert(rhythms).values(rhythm).returning();
    return created;
  }

  async logRhythmCompletion(rhythmId: string, userId: string, note?: string, mood?: number): Promise<RhythmLog> {
    const xpReward = 10;

    // Create the log
    const [log] = await db
      .insert(rhythmLogs)
      .values({
        rhythmId,
        userId,
        note,
        mood,
        xpEarned: xpReward,
      })
      .returning();

    // Update rhythm streak and completions
    await this.updateRhythmStreak(rhythmId);

    // NOTE: XP/CRED is awarded by the route handler via addCredToUser
    // (which also increments XP). Do not double-award here.

    return log;
  }

  async getRhythmLogs(rhythmId: string, limit = 30): Promise<RhythmLog[]> {
    return db
      .select()
      .from(rhythmLogs)
      .where(eq(rhythmLogs.rhythmId, rhythmId))
      .orderBy(desc(rhythmLogs.completedAt))
      .limit(limit);
  }

  async updateRhythmStreak(rhythmId: string): Promise<Rhythm | undefined> {
    const rhythm = await this.getRhythmById(rhythmId);
    if (!rhythm) return undefined;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    // Get the last completion date
    const lastCompletion = rhythm.lastCompletedAt ? new Date(rhythm.lastCompletedAt) : null;

    let newStreak = 1;
    if (lastCompletion) {
      const lastCompletionDate = new Date(lastCompletion.getFullYear(), lastCompletion.getMonth(), lastCompletion.getDate());
      
      // If last completion was yesterday (or earlier today), increment streak
      if (lastCompletionDate >= yesterdayStart && lastCompletionDate < todayStart) {
        newStreak = rhythm.currentStreak + 1;
      } else if (lastCompletionDate >= todayStart) {
        // Already completed today, keep current streak
        newStreak = rhythm.currentStreak;
      }
      // Otherwise reset to 1 (gap in completion)
    }

    const newLongestStreak = Math.max(rhythm.longestStreak, newStreak);
    const newTotalCompletions = rhythm.totalCompletions + 1;

    const [updated] = await db
      .update(rhythms)
      .set({
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        totalCompletions: newTotalCompletions,
        lastCompletedAt: now,
      })
      .where(eq(rhythms.id, rhythmId))
      .returning();

    return updated;
  }

  // Real - End-of-day captures
  async createRealCapture(capture: InsertRealCapture): Promise<RealCapture> {
    const xpReward = capture.xpEarned || 25;

    const [created] = await db
      .insert(realCaptures)
      .values({
        ...capture,
        xpEarned: xpReward,
      })
      .returning();

    // Add XP to user
    await this.addXpToUser(capture.userId, xpReward);

    return created;
  }

  async getUserRealCaptures(userId: string, limit = 30): Promise<RealCapture[]> {
    return db
      .select()
      .from(realCaptures)
      .where(eq(realCaptures.userId, userId))
      .orderBy(desc(realCaptures.createdAt))
      .limit(limit);
  }

  async getTodaysRealCapture(userId: string): Promise<RealCapture | undefined> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [capture] = await db
      .select()
      .from(realCaptures)
      .where(
        and(
          eq(realCaptures.userId, userId),
          gte(realCaptures.createdAt, todayStart),
          lte(realCaptures.createdAt, todayEnd)
        )
      )
      .orderBy(desc(realCaptures.createdAt))
      .limit(1);

    return capture;
  }

  // ============================================
  // INSTITUTIONAL DASHBOARD Implementation
  // ============================================

  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizationsByType(type: string): Promise<Organization[]> {
    return db.select().from(organizations).where(eq(organizations.type, type));
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    return created;
  }

  // Org Members
  async getOrgMember(userId: string, orgId: string): Promise<OrgMember | undefined> {
    const [member] = await db.select().from(orgMembers)
      .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)));
    return member;
  }

  async getOrgMembers(orgId: string): Promise<(OrgMember & { user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'userType' | 'isVerified' | 'lastActiveAt'> })[]> {
    const results = await db.select({
      member: orgMembers,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userType: users.userType,
        isVerified: users.isVerified,
        lastActiveAt: users.lastActiveAt,
      },
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId));
    
    return results.map(r => ({ ...r.member, user: r.user }));
  }

  async getUserOrganizations(userId: string): Promise<(OrgMember & { organization: Organization })[]> {
    const results = await db.select({
      member: orgMembers,
      organization: organizations,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, userId));
    
    return results.map(r => ({ ...r.member, organization: r.organization }));
  }

  async createOrgMember(member: InsertOrgMember): Promise<OrgMember> {
    const [created] = await db.insert(orgMembers).values(member).returning();
    return created;
  }

  // User Events
  async createUserEvent(event: InsertUserEvent): Promise<UserEvent> {
    const [created] = await db.insert(userEvents).values(event).returning();
    return created;
  }

  async getRecentUserEvents(orgId: string, limit = 50): Promise<UserEvent[]> {
    return db.select().from(userEvents)
      .where(eq(userEvents.orgId, orgId))
      .orderBy(desc(userEvents.createdAt))
      .limit(limit);
  }

  async getUserEventsByType(orgId: string, eventType: string, limit = 50): Promise<UserEvent[]> {
    return db.select().from(userEvents)
      .where(and(eq(userEvents.orgId, orgId), eq(userEvents.eventType, eventType)))
      .orderBy(desc(userEvents.createdAt))
      .limit(limit);
  }

  async getEventCounts(orgId: string, since: Date): Promise<{ eventType: string; count: number }[]> {
    const results = await db.select({
      eventType: userEvents.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(userEvents)
    .where(and(eq(userEvents.orgId, orgId), gte(userEvents.createdAt, since)))
    .groupBy(userEvents.eventType);
    
    return results;
  }

  // AI Sentiment
  async createAiSentiment(sentiment: InsertAiSentiment): Promise<AiSentiment> {
    const [created] = await db.insert(aiSentiment).values(sentiment).returning();
    return created;
  }

  async getRecentSentiment(orgId: string, limit = 100): Promise<AiSentiment[]> {
    return db.select().from(aiSentiment)
      .where(eq(aiSentiment.orgId, orgId))
      .orderBy(desc(aiSentiment.createdAt))
      .limit(limit);
  }

  async getAverageSentiment(orgId: string, since: Date): Promise<{ avgSentiment: number; avgTrust: number; avgRisk: number }> {
    const [result] = await db.select({
      avgSentiment: sql<number>`coalesce(avg(${aiSentiment.sentimentScore}), 0)::float`,
      avgTrust: sql<number>`coalesce(avg(${aiSentiment.trustScore}), 0)::float`,
      avgRisk: sql<number>`coalesce(avg(${aiSentiment.riskScore}), 0)::float`,
    })
    .from(aiSentiment)
    .where(and(eq(aiSentiment.orgId, orgId), gte(aiSentiment.createdAt, since)));
    
    return result || { avgSentiment: 0, avgTrust: 0, avgRisk: 0 };
  }

  // Metric Snapshots
  async createMetricSnapshot(snapshot: InsertMetricSnapshot): Promise<MetricSnapshot> {
    const [created] = await db.insert(metricSnapshots).values(snapshot).returning();
    return created;
  }

  async getLatestMetrics(orgId: string): Promise<MetricSnapshot[]> {
    const subquery = db.select({
      metricName: metricSnapshots.metricName,
      maxDate: sql<Date>`max(${metricSnapshots.periodEnd})`.as('max_date'),
    })
    .from(metricSnapshots)
    .where(eq(metricSnapshots.orgId, orgId))
    .groupBy(metricSnapshots.metricName)
    .as('latest');

    return db.select()
      .from(metricSnapshots)
      .where(eq(metricSnapshots.orgId, orgId))
      .orderBy(desc(metricSnapshots.periodEnd));
  }

  async getMetricHistory(orgId: string, metricName: string, days = 30): Promise<MetricSnapshot[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    return db.select().from(metricSnapshots)
      .where(and(
        eq(metricSnapshots.orgId, orgId),
        eq(metricSnapshots.metricName, metricName),
        gte(metricSnapshots.periodStart, since)
      ))
      .orderBy(metricSnapshots.periodStart);
  }

  // Risk Tiers
  async getRiskTiers(orgId: string): Promise<RiskTier[]> {
    return db.select().from(riskTiers)
      .where(eq(riskTiers.orgId, orgId))
      .orderBy(desc(riskTiers.tierScore));
  }

  async getRiskTiersByLevel(orgId: string, level: string): Promise<RiskTier[]> {
    return db.select().from(riskTiers)
      .where(and(eq(riskTiers.orgId, orgId), eq(riskTiers.currentTier, level)))
      .orderBy(desc(riskTiers.tierScore));
  }

  async createOrUpdateRiskTier(tier: InsertRiskTier): Promise<RiskTier> {
    const existing = await db.select().from(riskTiers)
      .where(and(eq(riskTiers.userId, tier.userId), eq(riskTiers.orgId, tier.orgId || '')));
    
    if (existing.length > 0) {
      const [updated] = await db.update(riskTiers)
        .set({
          previousTier: existing[0].currentTier,
          currentTier: tier.currentTier,
          tierScore: tier.tierScore,
          reasonCodes: tier.reasonCodes,
          lastAssessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(riskTiers.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(riskTiers).values(tier).returning();
    return created;
  }

  async getRiskShifts(orgId: string, since: Date): Promise<RiskTier[]> {
    return db.select().from(riskTiers)
      .where(and(
        eq(riskTiers.orgId, orgId),
        gte(riskTiers.updatedAt, since),
        sql`${riskTiers.previousTier} IS NOT NULL AND ${riskTiers.previousTier} != ${riskTiers.currentTier}`
      ))
      .orderBy(desc(riskTiers.updatedAt));
  }

  // Dashboard Analytics
  async getDashboardStats(orgId: string): Promise<{
    activeMembers: number;
    activeReferrals: number;
    highRiskMembers: number;
    eventsToday: number;
    avgSentiment: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [memberCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.isActive, true)));

    const [referralCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(and(
        inArray(referrals.state, ['proposed', 'offered', 'accepted', 'in_progress'])
      ));

    const [highRisk] = await db.select({ count: sql<number>`count(*)::int` })
      .from(riskTiers)
      .where(and(eq(riskTiers.orgId, orgId), inArray(riskTiers.currentTier, ['high', 'critical'])));

    const [eventsCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(userEvents)
      .where(and(eq(userEvents.orgId, orgId), gte(userEvents.createdAt, todayStart)));

    const sentiment = await this.getAverageSentiment(orgId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    return {
      activeMembers: memberCount?.count || 0,
      activeReferrals: referralCount?.count || 0,
      highRiskMembers: highRisk?.count || 0,
      eventsToday: eventsCount?.count || 0,
      avgSentiment: sentiment.avgSentiment,
    };
  }

  async getReferralMetrics(orgId: string): Promise<{
    total: number;
    pending: number;
    completed: number;
    avgTimeToAccept: number;
    avgTimeToClose: number;
  }> {
    const [total] = await db.select({ count: sql<number>`count(*)::int` })
      .from(referrals);

    const [pending] = await db.select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(inArray(referrals.state, ['proposed', 'offered']));

    const [completed] = await db.select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(eq(referrals.state, 'completed'));

    return {
      total: total?.count || 0,
      pending: pending?.count || 0,
      completed: completed?.count || 0,
      avgTimeToAccept: 2.5,
      avgTimeToClose: 14.3,
    };
  }

  // ============================================
  // CRED ECONOMY IMPLEMENTATION
  // ============================================

  async addCredToUser(
    userId: string, 
    amount: number, 
    reason: string, 
    sourceType?: string, 
    sourceId?: string,
    idempotencyKey?: string
  ): Promise<{ user: User; transaction: CredTransaction } | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return undefined;

    // Check for duplicate transaction if idempotency key provided
    if (idempotencyKey) {
      const [existing] = await db.select().from(credTransactions)
        .where(eq(credTransactions.idempotencyKey, idempotencyKey));
      if (existing) {
        return { user, transaction: existing };
      }
    }

    // Create the transaction
    const [transaction] = await db.insert(credTransactions).values({
      userId,
      amount,
      reason,
      sourceType,
      sourceId,
      idempotencyKey,
    }).returning();

    // Update user's CRED balance
    const newBalance = (user.credBalance || 0) + amount;
    const [updatedUser] = await db.update(users)
      .set({ 
        credBalance: newBalance,
        lastCredEarnedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    // Also update XP for backward compatibility (1 CRED = 1 XP)
    await this.addXpToUser(userId, amount);

    return { user: updatedUser, transaction };
  }

  async getCredTransactions(userId: string, limit = 50): Promise<CredTransaction[]> {
    return db.select().from(credTransactions)
      .where(eq(credTransactions.userId, userId))
      .orderBy(desc(credTransactions.createdAt))
      .limit(limit);
  }

  async getUserCredBalance(userId: string): Promise<number> {
    const [user] = await db.select({ credBalance: users.credBalance })
      .from(users)
      .where(eq(users.id, userId));
    return user?.credBalance || 0;
  }

  // Enhanced Check-ins with slots
  async createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn> {
    const credReward = CRED_REWARDS[
      checkIn.slot === 'morning' ? 'MORNING_CHECKIN' : 
      checkIn.slot === 'midday' ? 'MIDDAY_CHECKIN' : 'EVENING_CHECKIN'
    ];

    const [created] = await db.insert(checkIns).values({
      ...checkIn,
      credEarned: credReward,
      xpEarned: credReward,
    }).returning();

    // Award CRED
    const idempotencyKey = `checkin-${checkIn.userId}-${checkIn.slot}-${new Date().toISOString().split('T')[0]}`;
    await this.addCredToUser(
      checkIn.userId, 
      credReward, 
      `${checkIn.slot}_checkin`, 
      'checkin', 
      created.id,
      idempotencyKey
    );

    return created;
  }

  async getTodaysCheckIns(userId: string): Promise<CheckIn[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    return db.select().from(checkIns)
      .where(and(
        eq(checkIns.userId, userId),
        gte(checkIns.createdAt, todayStart)
      ))
      .orderBy(checkIns.createdAt);
  }

  async getCheckInForSlot(userId: string, slot: CheckInSlot, date: Date): Promise<CheckIn | undefined> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const [checkIn] = await db.select().from(checkIns)
      .where(and(
        eq(checkIns.userId, userId),
        eq(checkIns.slot, slot),
        gte(checkIns.createdAt, dayStart),
        lte(checkIns.createdAt, dayEnd)
      ));
    
    return checkIn;
  }

  async getCheckInHistory(userId: string, limit = 30): Promise<CheckIn[]> {
    return db.select().from(checkIns)
      .where(eq(checkIns.userId, userId))
      .orderBy(desc(checkIns.createdAt))
      .limit(limit);
  }

  // Impact Dossiers
  async createImpactDossier(dossier: InsertImpactDossier): Promise<ImpactDossier> {
    const [created] = await db.insert(impactDossiers).values(dossier).returning();
    return created;
  }

  async getImpactDossiers(userId: string, limit = 10): Promise<ImpactDossier[]> {
    return db.select().from(impactDossiers)
      .where(eq(impactDossiers.userId, userId))
      .orderBy(desc(impactDossiers.periodEnd))
      .limit(limit);
  }

  async getImpactDossier(id: string): Promise<ImpactDossier | undefined> {
    const [dossier] = await db.select().from(impactDossiers)
      .where(eq(impactDossiers.id, id));
    return dossier;
  }

  async getImpactDossierByShareCode(shareCode: string): Promise<ImpactDossier | undefined> {
    const [dossier] = await db.select().from(impactDossiers)
      .where(eq(impactDossiers.shareCode, shareCode));
    return dossier;
  }

  async generateWeeklyDossier(userId: string): Promise<ImpactDossier> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get check-ins for the week
    const weekCheckIns = await db.select().from(checkIns)
      .where(and(
        eq(checkIns.userId, userId),
        gte(checkIns.createdAt, weekAgo)
      ));

    // Get CRED transactions for the week
    const weekCred = await db.select().from(credTransactions)
      .where(and(
        eq(credTransactions.userId, userId),
        gte(credTransactions.createdAt, weekAgo)
      ));

    // Get completed referrals
    const completedReferrals = await db.select().from(referrals)
      .where(and(
        eq(referrals.userId, userId),
        eq(referrals.state, 'completed'),
        gte(referrals.updatedAt, weekAgo)
      ));

    // Get completed moves/actions
    const completedMoves = await db.select().from(moves)
      .where(and(
        eq(moves.userId, userId),
        eq(moves.isCompleted, true),
        gte(moves.completedAt, weekAgo)
      ));

    // Calculate mood delta
    const moodValues = weekCheckIns
      .filter(c => c.mood !== null)
      .map(c => c.mood as number);
    const avgMood = moodValues.length > 0 
      ? Math.round(moodValues.reduce((a, b) => a + b, 0) / moodValues.length)
      : null;

    // Total CRED earned
    const totalCred = weekCred.reduce((sum, t) => sum + t.amount, 0);

    // Generate a cryptographically random share code (128 bits of entropy)
    const { randomBytes } = await import('crypto');
    const shareCode = `SD-${randomBytes(16).toString('hex').toUpperCase()}`;

    const dossier: InsertImpactDossier = {
      userId,
      periodStart: weekAgo,
      periodEnd: now,
      periodType: 'weekly',
      credEarned: totalCred,
      actionsCompleted: completedMoves.length,
      referralsClosed: completedReferrals.length,
      checkInsCompleted: weekCheckIns.length,
      goalsAchieved: 0, // TODO: Calculate from goals table
      moodEnd: avgMood,
      highlights: completedMoves.slice(0, 5).map(m => ({ title: m.title, completedAt: m.completedAt })),
      isShareable: false,
      shareCode,
    };

    return this.createImpactDossier(dossier);
  }

  // ============================================
  // STREAK FREEZE SYSTEM
  // ============================================

  async getAvailableStreakFreezes(userId: string): Promise<StreakFreeze[]> {
    return db.select().from(streakFreezes)
      .where(and(
        eq(streakFreezes.userId, userId),
        eq(streakFreezes.isUsed, false),
        or(
          isNull(streakFreezes.expiresAt),
          gte(streakFreezes.expiresAt, new Date())
        )
      ))
      .orderBy(desc(streakFreezes.earnedAt));
  }

  async createStreakFreeze(freeze: InsertStreakFreeze): Promise<StreakFreeze> {
    const [created] = await db.insert(streakFreezes).values(freeze).returning();
    return created;
  }

  async useStreakFreeze(userId: string): Promise<StreakFreeze | undefined> {
    // Atomic conditional update — picks one un-used freeze for this user and
    // marks it used in a single statement so concurrent calls cannot
    // double-consume the same row.
    const available = await this.getAvailableStreakFreezes(userId);
    if (available.length === 0) return undefined;
    const candidate = available[0];
    const [updated] = await db.update(streakFreezes)
      .set({ isUsed: true, usedAt: new Date() })
      .where(and(
        eq(streakFreezes.id, candidate.id),
        eq(streakFreezes.userId, userId),
        eq(streakFreezes.isUsed, false),
      ))
      .returning();
    return updated;
  }

  // ============================================
  // STREAK RECOVERY QUESTS
  // ============================================

  async getActiveRecoveryQuest(userId: string): Promise<StreakRecoveryQuest | undefined> {
    const [quest] = await db.select().from(streakRecoveryQuests)
      .where(and(
        eq(streakRecoveryQuests.userId, userId),
        eq(streakRecoveryQuests.isCompleted, false),
        gte(streakRecoveryQuests.expiresAt, new Date())
      ))
      .orderBy(desc(streakRecoveryQuests.createdAt))
      .limit(1);
    return quest;
  }

  async createRecoveryQuest(quest: InsertStreakRecoveryQuest): Promise<StreakRecoveryQuest> {
    const [created] = await db.insert(streakRecoveryQuests).values(quest).returning();
    return created;
  }

  async completeRecoveryQuest(questId: string, userId?: string): Promise<StreakRecoveryQuest | undefined> {
    // Idempotent + ownership-enforced completion. Only completes if the
    // quest belongs to this user and has not already been completed.
    const conditions = [
      eq(streakRecoveryQuests.id, questId),
      eq(streakRecoveryQuests.isCompleted, false),
    ];
    if (userId) conditions.push(eq(streakRecoveryQuests.userId, userId));
    const [updated] = await db.update(streakRecoveryQuests)
      .set({ isCompleted: true, completedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return updated;
  }

  // ============================================
  // SIANI MEMORY SYSTEM
  // ============================================

  async getSianiMemories(userId: string, limit = 50): Promise<SianiMemory[]> {
    return db.select().from(sianiMemories)
      .where(and(
        eq(sianiMemories.userId, userId),
        eq(sianiMemories.isActive, true)
      ))
      .orderBy(desc(sianiMemories.importance), desc(sianiMemories.lastReferencedAt))
      .limit(limit);
  }

  async createSianiMemory(memory: InsertSianiMemory): Promise<SianiMemory> {
    const [created] = await db.insert(sianiMemories).values(memory).returning();
    return created;
  }

  async updateMemoryReference(memoryId: string): Promise<void> {
    await db.update(sianiMemories)
      .set({
        lastReferencedAt: new Date(),
        referenceCount: sql`${sianiMemories.referenceCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(sianiMemories.id, memoryId));
  }

  // ============================================
  // SIANI NUDGES
  // ============================================

  async getPendingNudges(userId: string): Promise<SianiNudge[]> {
    return db.select().from(sianiNudges)
      .where(and(
        eq(sianiNudges.userId, userId),
        eq(sianiNudges.status, 'pending'),
        or(
          isNull(sianiNudges.scheduledFor),
          lte(sianiNudges.scheduledFor, new Date())
        )
      ))
      .orderBy(desc(sianiNudges.createdAt));
  }

  async getNudgeById(nudgeId: string): Promise<SianiNudge | undefined> {
    const [n] = await db.select().from(sianiNudges).where(eq(sianiNudges.id, nudgeId)).limit(1);
    return n;
  }

  async createSianiNudge(nudge: InsertSianiNudge): Promise<SianiNudge> {
    const [created] = await db.insert(sianiNudges).values(nudge).returning();
    return created;
  }

  async markNudgeSeen(nudgeId: string): Promise<SianiNudge | undefined> {
    const [updated] = await db.update(sianiNudges)
      .set({ seenAt: new Date(), status: 'seen' })
      .where(eq(sianiNudges.id, nudgeId))
      .returning();
    return updated;
  }

  // ============================================
  // THE VAULT - ANONYMOUS CONFESSIONAL
  // ============================================

  async getVaultConfessions(limit = 50): Promise<VaultConfession[]> {
    return db.select().from(vaultConfessions)
      .where(eq(vaultConfessions.status, 'active'))
      .orderBy(desc(vaultConfessions.createdAt))
      .limit(limit);
  }

  async createVaultConfession(confession: InsertVaultConfession): Promise<VaultConfession> {
    const [created] = await db.insert(vaultConfessions).values(confession).returning();
    return created;
  }

  async reactToConfession(confessionId: string, reactionType: string): Promise<void> {
    const columnMap: Record<string, keyof typeof vaultConfessions> = {
      fire: 'fireCount',
      strength: 'strengthCount',
      heart: 'heartCount',
      real: 'realCount',
    };

    const column = columnMap[reactionType];
    if (!column) return;

    await db.update(vaultConfessions)
      .set({
        [column]: sql`${vaultConfessions[column]} + 1`,
        totalReactions: sql`${vaultConfessions.totalReactions} + 1`,
      })
      .where(eq(vaultConfessions.id, confessionId));
  }

  // ============================================
  // HEAT INDEX - LEADERBOARD
  // ============================================

  async getHeatRankings(periodType: string, limit = 50): Promise<HeatRanking[]> {
    return db.select().from(heatRankings)
      .where(and(
        eq(heatRankings.periodType, periodType),
        eq(heatRankings.isActive, true)
      ))
      .orderBy(heatRankings.rank)
      .limit(limit);
  }

  async getUserHeatRanking(userId: string, periodType: string): Promise<HeatRanking | undefined> {
    const [ranking] = await db.select().from(heatRankings)
      .where(and(
        eq(heatRankings.userId, userId),
        eq(heatRankings.periodType, periodType),
        eq(heatRankings.isActive, true)
      ))
      .limit(1);
    return ranking;
  }

  // ============================================
  // MEMBERSHIP KEYS
  // ============================================

  async getMembershipKey(userId: string): Promise<MembershipKey | undefined> {
    const [key] = await db.select().from(membershipKeys)
      .where(eq(membershipKeys.userId, userId));
    return key;
  }

  async createMembershipKey(key: InsertMembershipKey): Promise<MembershipKey> {
    const [created] = await db.insert(membershipKeys).values(key).returning();
    return created;
  }

  // ============================================
  // VAULT — public-safe accessors (Task #52)
  // ============================================

  async getVaultFeedPublic(opts: { userId?: string | null; limit: number; offset: number; category?: string }) {
    const filters = [eq(vaultConfessions.status, "active")];
    if (opts.category) filters.push(eq(vaultConfessions.category, opts.category));
    const rows = await db
      .select(vaultPublicColumns())
      .from(vaultConfessions)
      .where(filters.length === 1 ? filters[0] : and(...filters))
      .orderBy(desc(vaultConfessions.isSpotlighted), desc(vaultConfessions.createdAt))
      .limit(opts.limit)
      .offset(opts.offset);

    let userReactionMap = new Map<string, string>();
    if (opts.userId) {
      const reactions = await db
        .select({ confessionId: vaultReactions.confessionId, reactionType: vaultReactions.reactionType })
        .from(vaultReactions)
        .where(eq(vaultReactions.userId, opts.userId));
      userReactionMap = new Map(reactions.map((r) => [r.confessionId, r.reactionType]));
    }
    const confessions = rows.map((c) => ({ ...c, userReaction: userReactionMap.get(c.id) ?? null }));
    return { confessions, hasMore: rows.length === opts.limit };
  }

  async getVaultSpotlightsPublic(): Promise<VaultSpotlightPublic[]> {
    const now = new Date();
    return db
      .select({
        ...vaultPublicColumns(),
        spotlightBonus: vaultSpotlights.credBonus,
        spotlightEnd: vaultSpotlights.spotlightEnd,
      })
      .from(vaultSpotlights)
      .innerJoin(vaultConfessions, eq(vaultSpotlights.confessionId, vaultConfessions.id))
      .where(and(gte(vaultSpotlights.spotlightEnd, now), eq(vaultConfessions.status, "active")))
      .orderBy(desc(vaultSpotlights.spotlightStart))
      .limit(5);
  }

  async getVaultConfessionPublic(confessionId: string, userId?: string | null) {
    const [row] = await db
      .select({ ...vaultPublicColumns(), status: vaultConfessions.status })
      .from(vaultConfessions)
      .where(eq(vaultConfessions.id, confessionId));
    if (!row || row.status !== "active") return null;
    let userReaction: string | null = null;
    if (userId) {
      const [reaction] = await db
        .select({ reactionType: vaultReactions.reactionType })
        .from(vaultReactions)
        .where(and(eq(vaultReactions.confessionId, confessionId), eq(vaultReactions.userId, userId)));
      userReaction = reaction?.reactionType ?? null;
    }
    const { status: _status, ...publicFields } = row;
    return { ...publicFields, userReaction };
  }

  async getMyVaultConfessions(userId: string): Promise<VaultConfession[]> {
    // Anonymous rows have user_id=NULL by design, so they don't appear here.
    return db
      .select()
      .from(vaultConfessions)
      .where(eq(vaultConfessions.userId, userId))
      .orderBy(desc(vaultConfessions.createdAt));
  }

  async createVaultConfessionForUser(input: VaultCreateInput) {
    const bonusCredReward =
      Math.random() < 0.2
        ? Math.floor(
            Math.random() *
              (VAULT_CRED_REWARDS.RANDOM_BONUS_MAX - VAULT_CRED_REWARDS.RANDOM_BONUS_MIN + 1),
          ) + VAULT_CRED_REWARDS.RANDOM_BONUS_MIN
        : 0;

    const [confession] = await db
      .insert(vaultConfessions)
      .values({
        // Genuine anonymity: user_id is NULL, opaque per-row handle stays
        // with the row so the UI can attribute reactions without exposing
        // identity at the DB layer.
        userId: input.isAnonymous ? null : input.userId,
        authorHandle: input.isAnonymous ? input.authorHandle : null,
        content: input.content,
        isAnonymous: input.isAnonymous,
        displayName: input.isAnonymous ? null : input.displayName ?? null,
        category: input.category,
        mood: input.mood ?? null,
        audioUrl: input.audioUrl ?? null,
        audioDuration: input.audioDuration ?? null,
        baseCredReward: VAULT_CRED_REWARDS.POST_CONFESSION,
        bonusCredReward,
      })
      .returning();
    return { confession, bonusCredReward };
  }

  async applyVaultReaction(input: VaultReactInput): Promise<VaultReactResult> {
    const [confession] = await db
      .select({ id: vaultConfessions.id, userId: vaultConfessions.userId })
      .from(vaultConfessions)
      .where(eq(vaultConfessions.id, input.confessionId));
    if (!confession) return { ok: false, action: "not_found" };

    const existing = await db
      .select()
      .from(vaultReactions)
      .where(
        and(
          eq(vaultReactions.confessionId, input.confessionId),
          eq(vaultReactions.userId, input.userId),
        ),
      );

    if (input.action === "remove") {
      if (existing.length === 0) return { ok: true, action: "already_exists" };
      const oldType = existing[0].reactionType;
      await db.delete(vaultReactions).where(eq(vaultReactions.id, existing[0].id));
      const oldCol = `${oldType}Count` as keyof typeof vaultConfessions;
      await db
        .update(vaultConfessions)
        .set({
          [oldCol]: sql`GREATEST(${vaultConfessions[oldCol]} - 1, 0)`,
          totalReactions: sql`GREATEST(${vaultConfessions.totalReactions} - 1, 0)`,
        })
        .where(eq(vaultConfessions.id, input.confessionId));
      return { ok: true, action: "removed" };
    }

    // action === 'add'
    if (existing.length > 0) {
      if (existing[0].reactionType === input.reactionType) {
        return { ok: true, action: "already_exists", reactionType: input.reactionType };
      }
      const oldCol = `${existing[0].reactionType}Count` as keyof typeof vaultConfessions;
      await db
        .update(vaultConfessions)
        .set({ [oldCol]: sql`GREATEST(${vaultConfessions[oldCol]} - 1, 0)` })
        .where(eq(vaultConfessions.id, input.confessionId));
      await db.delete(vaultReactions).where(eq(vaultReactions.id, existing[0].id));
    }

    await db
      .insert(vaultReactions)
      .values({ confessionId: input.confessionId, userId: input.userId, reactionType: input.reactionType });

    const newCol = `${input.reactionType}Count` as keyof typeof vaultConfessions;
    const totalUpdate =
      existing.length > 0
        ? vaultConfessions.totalReactions
        : sql`${vaultConfessions.totalReactions} + 1`;
    await db
      .update(vaultConfessions)
      .set({
        [newCol]: sql`${vaultConfessions[newCol]} + 1`,
        totalReactions: totalUpdate,
      })
      .where(eq(vaultConfessions.id, input.confessionId));

    // Only attribute CRED on non-anonymous confessions and never to the
    // reactor themselves. Anonymous rows have user_id=NULL — no reward path.
    const authorIdToReward =
      confession.userId && confession.userId !== input.userId ? confession.userId : null;

    return { ok: true, action: "added", reactionType: input.reactionType, authorIdToReward };
  }

  async awardCred(input: { userId: string; amount: number; reason: string; sourceType: string; sourceId: string }): Promise<boolean> {
    const idempotencyKey = `${input.userId}-${input.sourceType}-${input.sourceId}-${input.reason}`;
    try {
      await db.insert(credTransactions).values({
        userId: input.userId,
        amount: input.amount,
        reason: input.reason,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        idempotencyKey,
      });
      await db
        .update(users)
        .set({
          credBalance: sql`${users.credBalance} + ${input.amount}`,
          lastCredEarnedAt: new Date(),
        })
        .where(eq(users.id, input.userId));
      return true;
    } catch (err) {
      // 23505 = unique_violation on idempotency_key — already credited.
      if ((err as { code?: string } | null)?.code === "23505") return false;
      throw err;
    }
  }
}

// ============================================
// MEM STORAGE - Simple array implementations for testing
// ============================================

export class MemStorage implements Partial<IStorage> {
  private drops: Drop[] = [];
  private dropRsvps: DropRsvp[] = [];
  private feedSignalsData: FeedSignal[] = [];
  private feedReactionsData: FeedReaction[] = [];
  
  // New feature Maps
  private streakFreezesMap: Map<string, StreakFreeze> = new Map();
  private recoveryQuestsMap: Map<string, StreakRecoveryQuest> = new Map();
  private sianiMemoriesMap: Map<string, SianiMemory> = new Map();
  private sianiNudgesMap: Map<string, SianiNudge> = new Map();
  private vaultConfessionsMap: Map<string, VaultConfession> = new Map();
  private heatRankingsMap: Map<string, HeatRanking> = new Map();
  private membershipKeysMap: Map<string, MembershipKey> = new Map();

  // Night Shift Flow - Drops
  async getDropsByStatus(status: 'active' | 'upcoming' | 'closed'): Promise<Drop[]> {
    const now = new Date();
    if (status === 'active') {
      return this.drops.filter(d => d.status === 'active' && (!d.accessWindowEnd || new Date(d.accessWindowEnd) >= now));
    } else if (status === 'upcoming') {
      return this.drops.filter(d => d.status === 'active' && d.accessWindowStart && new Date(d.accessWindowStart) > now);
    } else {
      return this.drops.filter(d => d.status === 'closed' || (d.accessWindowEnd && new Date(d.accessWindowEnd) < now));
    }
  }

  async getDropById(id: string): Promise<Drop | undefined> {
    return this.drops.find(d => d.id === id);
  }

  async createDropRsvp(userId: string, dropId: string): Promise<{ status: string; position?: number }> {
    const existing = this.dropRsvps.find(r => r.userId === userId && r.dropId === dropId);
    if (existing) {
      return { status: existing.status };
    }

    const drop = this.drops.find(d => d.id === dropId);
    if (!drop) {
      return { status: 'not_found' };
    }

    let rsvpStatus = 'confirmed';
    let position: number | undefined;

    if (drop.seatCount !== null && drop.seatsRemaining !== null) {
      if (drop.seatsRemaining <= 0) {
        rsvpStatus = 'waitlist';
        position = this.dropRsvps.filter(r => r.dropId === dropId && r.status === 'waitlist').length + 1;
      } else {
        drop.seatsRemaining = drop.seatsRemaining - 1;
        drop.rsvpCount = (drop.rsvpCount || 0) + 1;
      }
    } else {
      drop.rsvpCount = (drop.rsvpCount || 0) + 1;
    }

    const rsvp: DropRsvp = {
      id: `rsvp-${Date.now()}`,
      dropId,
      userId,
      status: rsvpStatus,
      rsvpedAt: new Date(),
      confirmedAt: rsvpStatus === 'confirmed' ? new Date() : null,
    };
    this.dropRsvps.push(rsvp);

    return position !== undefined ? { status: rsvpStatus, position } : { status: rsvpStatus };
  }

  async getUserDropRsvp(userId: string, dropId: string): Promise<DropRsvp | undefined> {
    return this.dropRsvps.find(r => r.userId === userId && r.dropId === dropId);
  }

  async getDropRsvpCount(dropId: string): Promise<number> {
    return this.dropRsvps.filter(r => r.dropId === dropId).length;
  }

  // Night Shift Flow - Feed Signals
  async getFeedSignalsByLane(lane: 'signals' | 'circle'): Promise<FeedSignal[]> {
    if (lane === 'signals') {
      return this.feedSignalsData.filter(s => s.status === 'active');
    } else {
      return this.feedSignalsData.filter(s => s.status === 'active' && s.exclusivityTier === 'inner_circle');
    }
  }

  async addFeedReaction(userId: string, feedSignalId: string, reactionType: string): Promise<void> {
    const existing = this.feedReactionsData.find(
      r => r.userId === userId && r.feedSignalId === feedSignalId && r.reactionType === reactionType
    );
    if (existing) {
      return;
    }

    const reaction: FeedReaction = {
      id: `reaction-${Date.now()}`,
      userId,
      feedSignalId,
      reactionType,
      createdAt: new Date(),
    };
    this.feedReactionsData.push(reaction);

    const signal = this.feedSignalsData.find(s => s.id === feedSignalId);
    if (signal) {
      if (reactionType === 'fire') {
        signal.fireCount = (signal.fireCount || 0) + 1;
      } else if (reactionType === 'strength') {
        signal.strengthCount = (signal.strengthCount || 0) + 1;
      } else {
        signal.heartCount = (signal.heartCount || 0) + 1;
      }
    }
  }

  async getFeedSignalReactions(feedSignalId: string): Promise<{ type: string; count: number }[]> {
    const reactions = this.feedReactionsData.filter(r => r.feedSignalId === feedSignalId);
    const counts = new Map<string, number>();
    for (const r of reactions) {
      counts.set(r.reactionType, (counts.get(r.reactionType) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
  }

  // ============================================
  // STREAK FREEZE SYSTEM
  // ============================================

  async getAvailableStreakFreezes(userId: string): Promise<StreakFreeze[]> {
    const now = new Date();
    return Array.from(this.streakFreezesMap.values()).filter(
      f => f.userId === userId && 
           !f.isUsed && 
           (!f.expiresAt || new Date(f.expiresAt) > now)
    );
  }

  async createStreakFreeze(freeze: InsertStreakFreeze): Promise<StreakFreeze> {
    const id = `freeze-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newFreeze: StreakFreeze = {
      id,
      userId: freeze.userId,
      earnedAt: freeze.earnedAt || new Date(),
      usedAt: null,
      expiresAt: freeze.expiresAt || null,
      source: freeze.source || 'purchase',
      isUsed: freeze.isUsed ?? false,
      credCost: freeze.credCost ?? 50,
      createdAt: new Date(),
    };
    this.streakFreezesMap.set(id, newFreeze);
    return newFreeze;
  }

  async useStreakFreeze(userId: string): Promise<StreakFreeze | undefined> {
    const available = await this.getAvailableStreakFreezes(userId);
    if (available.length === 0) return undefined;
    
    const freeze = available[0];
    freeze.isUsed = true;
    freeze.usedAt = new Date();
    this.streakFreezesMap.set(freeze.id, freeze);
    return freeze;
  }

  // ============================================
  // STREAK RECOVERY QUESTS
  // ============================================

  async getActiveRecoveryQuest(userId: string): Promise<StreakRecoveryQuest | undefined> {
    const now = new Date();
    return Array.from(this.recoveryQuestsMap.values()).find(
      q => q.userId === userId && 
           !q.isCompleted && 
           new Date(q.expiresAt) > now
    );
  }

  async createRecoveryQuest(quest: InsertStreakRecoveryQuest): Promise<StreakRecoveryQuest> {
    const id = `quest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newQuest: StreakRecoveryQuest = {
      id,
      userId: quest.userId,
      brokenStreak: quest.brokenStreak,
      questType: quest.questType,
      questDescription: quest.questDescription,
      isCompleted: quest.isCompleted ?? false,
      completedAt: null,
      expiresAt: quest.expiresAt,
      createdAt: new Date(),
    };
    this.recoveryQuestsMap.set(id, newQuest);
    return newQuest;
  }

  async completeRecoveryQuest(questId: string, userId?: string): Promise<StreakRecoveryQuest | undefined> {
    const quest = this.recoveryQuestsMap.get(questId);
    if (!quest) return undefined;
    if (quest.isCompleted) return undefined;
    if (userId && quest.userId !== userId) return undefined;
    quest.isCompleted = true;
    quest.completedAt = new Date();
    this.recoveryQuestsMap.set(questId, quest);
    return quest;
  }

  // ============================================
  // SIANI MEMORY SYSTEM
  // ============================================

  async getSianiMemories(userId: string, limit?: number): Promise<SianiMemory[]> {
    const memories = Array.from(this.sianiMemoriesMap.values())
      .filter(m => m.userId === userId && m.isActive)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return limit ? memories.slice(0, limit) : memories;
  }

  async createSianiMemory(memory: InsertSianiMemory): Promise<SianiMemory> {
    const id = `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMemory: SianiMemory = {
      id,
      userId: memory.userId,
      memoryType: memory.memoryType,
      category: memory.category || null,
      content: memory.content,
      importance: memory.importance ?? 5,
      emotionalWeight: memory.emotionalWeight ?? 5,
      sourceConversationId: memory.sourceConversationId || null,
      lastReferencedAt: memory.lastReferencedAt || null,
      referenceCount: memory.referenceCount ?? 0,
      isActive: memory.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sianiMemoriesMap.set(id, newMemory);
    return newMemory;
  }

  async updateMemoryReference(memoryId: string): Promise<void> {
    const memory = this.sianiMemoriesMap.get(memoryId);
    if (!memory) return;
    
    memory.referenceCount = (memory.referenceCount || 0) + 1;
    memory.lastReferencedAt = new Date();
    memory.updatedAt = new Date();
    this.sianiMemoriesMap.set(memoryId, memory);
  }

  // ============================================
  // SIANI NUDGES
  // ============================================

  async getPendingNudges(userId: string): Promise<SianiNudge[]> {
    return Array.from(this.sianiNudgesMap.values())
      .filter(n => n.userId === userId && n.status === 'pending')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createSianiNudge(nudge: InsertSianiNudge): Promise<SianiNudge> {
    const id = `nudge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNudge: SianiNudge = {
      id,
      userId: nudge.userId,
      nudgeType: nudge.nudgeType,
      message: nudge.message,
      triggerReason: nudge.triggerReason || null,
      relatedGoalId: nudge.relatedGoalId || null,
      relatedMemoryId: nudge.relatedMemoryId || null,
      scheduledFor: nudge.scheduledFor || null,
      sentAt: null,
      seenAt: null,
      dismissedAt: null,
      actionTaken: nudge.actionTaken || null,
      status: nudge.status || 'pending',
      createdAt: new Date(),
    };
    this.sianiNudgesMap.set(id, newNudge);
    return newNudge;
  }

  async markNudgeSeen(nudgeId: string): Promise<SianiNudge | undefined> {
    const nudge = this.sianiNudgesMap.get(nudgeId);
    if (!nudge) return undefined;
    
    nudge.seenAt = new Date();
    nudge.status = 'seen';
    this.sianiNudgesMap.set(nudgeId, nudge);
    return nudge;
  }

  // ============================================
  // THE VAULT - ANONYMOUS CONFESSIONAL
  // ============================================

  async getVaultConfessions(limit?: number): Promise<VaultConfession[]> {
    const confessions = Array.from(this.vaultConfessionsMap.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return limit ? confessions.slice(0, limit) : confessions;
  }

  async createVaultConfession(confession: InsertVaultConfession): Promise<VaultConfession> {
    const id = `confession-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newConfession: VaultConfession = {
      id,
      userId: confession.userId ?? null,
      authorHandle: confession.authorHandle ?? null,
      content: confession.content,
      audioUrl: confession.audioUrl || null,
      audioDuration: confession.audioDuration || null,
      isAnonymous: confession.isAnonymous ?? true,
      displayName: confession.displayName || null,
      category: confession.category || 'truth',
      mood: confession.mood || null,
      fireCount: 0,
      strengthCount: 0,
      heartCount: 0,
      realCount: 0,
      totalReactions: 0,
      isSpotlighted: false,
      spotlightedAt: null,
      spotlightBonus: 0,
      baseCredReward: confession.baseCredReward ?? 5,
      bonusCredReward: 0,
      status: confession.status || 'active',
      flagCount: 0,
      createdAt: new Date(),
      expiresAt: confession.expiresAt || null,
    };
    this.vaultConfessionsMap.set(id, newConfession);
    return newConfession;
  }

  async reactToConfession(confessionId: string, reactionType: string): Promise<void> {
    const confession = this.vaultConfessionsMap.get(confessionId);
    if (!confession) return;
    
    if (reactionType === 'fire') {
      confession.fireCount = (confession.fireCount || 0) + 1;
    } else if (reactionType === 'heart') {
      confession.heartCount = (confession.heartCount || 0) + 1;
    } else if (reactionType === 'strength') {
      confession.strengthCount = (confession.strengthCount || 0) + 1;
    }
    this.vaultConfessionsMap.set(confessionId, confession);
  }

  // ============================================
  // HEAT INDEX - LEADERBOARD
  // ============================================

  async getHeatRankings(periodType: string, limit?: number): Promise<HeatRanking[]> {
    const rankings = Array.from(this.heatRankingsMap.values())
      .filter(r => r.periodType === periodType)
      .sort((a, b) => (a.rank || 0) - (b.rank || 0));
    
    return limit ? rankings.slice(0, limit) : rankings;
  }

  async getUserHeatRanking(userId: string, periodType: string): Promise<HeatRanking | undefined> {
    return Array.from(this.heatRankingsMap.values()).find(
      r => r.userId === userId && r.periodType === periodType
    );
  }

  // ============================================
  // MEMBERSHIP KEYS
  // ============================================

  async getMembershipKey(userId: string): Promise<MembershipKey | undefined> {
    return Array.from(this.membershipKeysMap.values()).find(k => k.userId === userId);
  }

  async createMembershipKey(key: InsertMembershipKey): Promise<MembershipKey> {
    const id = `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newKey: MembershipKey = {
      id,
      userId: key.userId,
      serialNumber: key.serialNumber,
      memberSince: key.memberSince || new Date(),
      accessToken: key.accessToken,
      tokenExpiresAt: key.tokenExpiresAt,
      tier: key.tier || 'member',
      cardDesign: key.cardDesign || 'obsidian',
      lastUsedAt: key.lastUsedAt || null,
      totalCheckins: key.totalCheckins ?? 0,
      isActive: key.isActive ?? true,
      suspendedReason: key.suspendedReason || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.membershipKeysMap.set(id, newKey);
    return newKey;
  }

  // Test helpers
  addDrop(drop: Drop): void {
    this.drops.push(drop);
  }

  addFeedSignal(signal: FeedSignal): void {
    this.feedSignalsData.push(signal);
  }

  clear(): void {
    this.drops = [];
    this.dropRsvps = [];
    this.feedSignalsData = [];
    this.feedReactionsData = [];
    this.streakFreezesMap.clear();
    this.recoveryQuestsMap.clear();
    this.sianiMemoriesMap.clear();
    this.sianiNudgesMap.clear();
    this.vaultConfessionsMap.clear();
    this.heatRankingsMap.clear();
    this.membershipKeysMap.clear();
  }
}

export const storage = new DatabaseStorage();
