import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// CORE USER & ENGAGEMENT SYSTEM
// ============================================

// Users table with engagement/gamification
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authUserId: varchar("auth_user_id").unique(), // Links to Supabase auth.users.id
  email: text("email").unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  // Engagement metrics (legacy XP)
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastActiveAt: timestamp("last_active_at"),
  // One-time streak rescue per streak-life. Set true when updateStreak()
  // auto-saves a 7+ day streak from breaking; reset to false when the
  // streak naturally resets to 1.
  streakSaveUsed: boolean("streak_save_used").default(false).notNull(),
  streakSavedAt: timestamp("streak_saved_at"),
  // CRED Economy (new - replaces XP conceptually)
  credBalance: integer("cred_balance").default(0).notNull(),
  lastCredEarnedAt: timestamp("last_cred_earned_at"),
  // User type
  userType: text("user_type").default("member").notNull(), // member, icon, chw, admin
  isVerified: boolean("is_verified").default(false),
  onboardingComplete: boolean("onboarding_complete").default(false),
  // Data-sharing consent (set during signup, editable in Profile → Privacy)
  consent: jsonb("consent").$type<{
    shareConversations: boolean;
    shareLocation: boolean;
    allowNotifications: boolean;
    allowLeaderboard: boolean;
  }>().default({
    shareConversations: false,
    shareLocation: false,
    allowNotifications: true,
    allowLeaderboard: true,
  }),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  displayName: true,
  bio: true,
  userType: true,
});

export const userConsentSchema = z.object({
  shareConversations: z.boolean(),
  shareLocation: z.boolean(),
  allowNotifications: z.boolean(),
  allowLeaderboard: z.boolean(),
});
export type UserConsent = z.infer<typeof userConsentSchema>;
export const DEFAULT_USER_CONSENT: UserConsent = {
  shareConversations: false,
  shareLocation: false,
  allowNotifications: true,
  allowLeaderboard: true,
};

// User location stored separately (for HSDS matching)
export const userLocations = pgTable("user_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  zipCode: text("zip_code"),
  city: text("city"),
  state: text("state"), // 2-letter state code
  county: text("county"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  source: text("source").default("self_reported"), // self_reported, detected, verified
  isPrimary: boolean("is_primary").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserLocationSchema = createInsertSchema(userLocations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserLocation = z.infer<typeof insertUserLocationSchema>;
export type UserLocation = typeof userLocations.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Badges - unlockable achievements
export const badges = pgTable("badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  category: text("category").notNull(), // streak, milestone, community, care, growth
  xpReward: integer("xp_reward").default(50),
  requirement: jsonb("requirement"), // { type: 'streak', value: 7 }
  isSecret: boolean("is_secret").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBadgeSchema = createInsertSchema(badges).omit({ id: true, createdAt: true });
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type Badge = typeof badges.$inferSelect;

// User badges (earned)
export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeId: varchar("badge_id").notNull().references(() => badges.id),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
});

// Daily check-ins with time slots (morning/midday/evening/night)
export const checkIns = pgTable("check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Time slot for the check-in
  slot: text("slot").default("morning").notNull(), // morning, midday, evening, night
  // Mood and energy tracking
  mood: integer("mood"), // 1-5 scale
  energyLevel: integer("energy_level"), // 1-5 scale
  // Content based on slot
  gratitude: text("gratitude"), // Morning: what you're grateful for
  intentForDay: text("intent_for_day"), // Morning: top priority
  progressNote: text("progress_note"), // Midday: how it's going
  barriers: text("barriers"), // Midday: what's blocking you
  wins: text("wins"), // Evening: what went well
  reflection: text("reflection"), // Evening: end of day thoughts
  note: text("note"), // General note (legacy)
  // Rewards
  xpEarned: integer("xp_earned").default(10),
  credEarned: integer("cred_earned").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCheckInSchema = createInsertSchema(checkIns).omit({ id: true, createdAt: true });
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type CheckIn = typeof checkIns.$inferSelect;

// Check-in slots - covers full day including late-night reflection
export const CHECKIN_SLOTS = ['morning', 'midday', 'evening', 'night'] as const;
export type CheckInSlot = typeof CHECKIN_SLOTS[number];

// XP transactions (legacy - for history)
export const xpTransactions = pgTable("xp_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(), // checkin, streak, badge, post, referral, etc
  sourceType: text("source_type"), // post, referral, badge, checkin
  sourceId: varchar("source_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// CRED transactions (new economy)
export const credTransactions = pgTable("cred_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(), // action_complete, loop_closed, circle_help, checkin, referral, badge
  sourceType: text("source_type"), // action, referral, badge, checkin, circle
  sourceId: varchar("source_id"),
  idempotencyKey: varchar("idempotency_key").unique(), // Prevent duplicate awards
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCredTransactionSchema = createInsertSchema(credTransactions).omit({ id: true, createdAt: true });
export type InsertCredTransaction = z.infer<typeof insertCredTransactionSchema>;
export type CredTransaction = typeof credTransactions.$inferSelect;

// CRED reward amounts
export const CRED_REWARDS = {
  DAILY_ACTION: 10,
  LOOP_CLOSED: 50,
  CIRCLE_HELP: 25,
  DAILY_CHECKIN: 5,
  REFERRAL_ACCEPTED: 25,
  BADGE_EARNED: 15,
  MORNING_CHECKIN: 5,
  MIDDAY_CHECKIN: 3,
  EVENING_CHECKIN: 5,
  STREAK_FREEZE_COST: 50,
} as const;

// ============================================
// STREAK FREEZE SYSTEM - Loss Aversion Mechanic
// ============================================

// Streak freeze tokens - protect streaks from breaking
export const streakFreezes = pgTable("streak_freezes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
  source: text("source").default("purchase").notNull(), // purchase, reward, gift, streak_milestone
  isUsed: boolean("is_used").default(false).notNull(),
  credCost: integer("cred_cost").default(50),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStreakFreezeSchema = createInsertSchema(streakFreezes).omit({ id: true, createdAt: true, usedAt: true });
export type InsertStreakFreeze = z.infer<typeof insertStreakFreezeSchema>;
export type StreakFreeze = typeof streakFreezes.$inferSelect;

// Streak recovery quests - earn back broken streaks
export const streakRecoveryQuests = pgTable("streak_recovery_quests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  brokenStreak: integer("broken_streak").notNull(),
  questType: text("quest_type").notNull(), // double_checkin, complete_move, vault_confession
  questDescription: text("quest_description").notNull(),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStreakRecoveryQuestSchema = createInsertSchema(streakRecoveryQuests).omit({ id: true, createdAt: true, completedAt: true });
export type InsertStreakRecoveryQuest = z.infer<typeof insertStreakRecoveryQuestSchema>;
export type StreakRecoveryQuest = typeof streakRecoveryQuests.$inferSelect;

// ============================================
// SIANI MEMORY SYSTEM - Personalization
// ============================================

// Siani memories - store key facts Siani learns about user
export const sianiMemories = pgTable("siani_memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  memoryType: text("memory_type").notNull(), // fact, preference, struggle, goal, relationship, trigger, strength
  category: text("category"), // family, work, health, housing, money, relationships
  content: text("content").notNull(),
  importance: integer("importance").default(5), // 1-10 scale
  emotionalWeight: integer("emotional_weight").default(5), // 1-10 how emotionally charged
  sourceConversationId: varchar("source_conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  lastReferencedAt: timestamp("last_referenced_at"),
  referenceCount: integer("reference_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSianiMemorySchema = createInsertSchema(sianiMemories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSianiMemory = z.infer<typeof insertSianiMemorySchema>;
export type SianiMemory = typeof sianiMemories.$inferSelect;

// Siani nudges - proactive outreach based on patterns
export const sianiNudges = pgTable("siani_nudges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nudgeType: text("nudge_type").notNull(), // morning_checkin, goal_reminder, streak_warning, celebration, support
  message: text("message").notNull(),
  triggerReason: text("trigger_reason"), // goal_stalled, streak_at_risk, mood_pattern, time_based
  relatedGoalId: varchar("related_goal_id").references(() => goals.id, { onDelete: "cascade" }),
  relatedMemoryId: varchar("related_memory_id").references(() => sianiMemories.id, { onDelete: "cascade" }),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  seenAt: timestamp("seen_at"),
  dismissedAt: timestamp("dismissed_at"),
  actionTaken: text("action_taken"), // opened_bag, started_chat, dismissed, ignored
  status: text("status").default("pending").notNull(), // pending, sent, seen, actioned, expired
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSianiNudgeSchema = createInsertSchema(sianiNudges).omit({ id: true, createdAt: true, sentAt: true, seenAt: true, dismissedAt: true });
export type InsertSianiNudge = z.infer<typeof insertSianiNudgeSchema>;
export type SianiNudge = typeof sianiNudges.$inferSelect;

// Memory types
export const SIANI_MEMORY_TYPES = ['fact', 'preference', 'struggle', 'goal', 'relationship', 'trigger', 'strength'] as const;
export type SianiMemoryType = typeof SIANI_MEMORY_TYPES[number];

// Nudge types
export const SIANI_NUDGE_TYPES = ['morning_checkin', 'goal_reminder', 'streak_warning', 'celebration', 'support', 'evening_recap'] as const;
export type SianiNudgeType = typeof SIANI_NUDGE_TYPES[number];

// ============================================
// SIANI CONVERSATIONS & SIGNALS
// ============================================

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").default("New Conversation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  userId: true,
  title: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  audioUrl: text("audio_url"),
  emotionalState: jsonb("emotional_state"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
  audioUrl: true,
  emotionalState: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const emotionalStates = pgTable("emotional_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "set null" }),
  joy: integer("joy").default(0),
  sadness: integer("sadness").default(0),
  anger: integer("anger").default(0),
  fear: integer("fear").default(0),
  trust: integer("trust").default(0),
  anticipation: integer("anticipation").default(0),
  surprise: integer("surprise").default(0),
  disgust: integer("disgust").default(0),
  overallSentiment: integer("overall_sentiment").default(0),
  arousalLevel: integer("arousal_level").default(50),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmotionalStateSchema = createInsertSchema(emotionalStates).omit({
  id: true,
  createdAt: true,
});

export type InsertEmotionalState = z.infer<typeof insertEmotionalStateSchema>;
export type EmotionalState = typeof emotionalStates.$inferSelect;

export const signals = pgTable("signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "set null" }),
  signalType: text("signal_type").notNull(),
  severity: integer("severity").notNull().default(1),
  confidence: integer("confidence").default(80),
  triggerText: text("trigger_text"),
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSignalSchema = createInsertSchema(signals).omit({
  id: true,
  createdAt: true,
});

export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signals.$inferSelect;

// ============================================
// GOALS & MOVES (BAG)
// ============================================

export const goals = pgTable("goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  targetDate: timestamp("target_date"),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  xpReward: integer("xp_reward").default(25),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGoalSchema = createInsertSchema(goals).pick({
  userId: true,
  title: true,
  description: true,
  category: true,
  targetDate: true,
});

export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goals.$inferSelect;

// Daily moves (1-3 actions)
export const moves = pgTable("moves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  goalId: varchar("goal_id").references(() => goals.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  xpReward: integer("xp_reward").default(15),
  scheduledFor: timestamp("scheduled_for").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMoveSchema = createInsertSchema(moves).pick({
  userId: true,
  goalId: true,
  title: true,
  scheduledFor: true,
});

export type InsertMove = z.infer<typeof insertMoveSchema>;
export type Move = typeof moves.$inferSelect;

// ============================================
// CARE TEAM MESSAGING
// ============================================

// Care teams (organizations)
export const careTeams = pgTable("care_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  orgId: varchar("org_id"),
  type: text("type").default("community"), // community, clinical, hybrid
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Care team members
export const careTeamMembers = pgTable("care_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => careTeams.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // chw, rn, coach, coordinator, supervisor
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Care threads (conversations between member and care team)
export const careThreads = pgTable("care_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberUserId: varchar("member_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  teamId: varchar("team_id").notNull().references(() => careTeams.id),
  subject: text("subject"),
  status: text("status").default("open").notNull(), // open, snoozed, closed
  priority: text("priority").default("normal"), // low, normal, high, urgent
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Care messages
export const careMessages = pgTable("care_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => careThreads.id),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").default("voice").notNull(), // voice, text, attachment, system
  content: text("content"),
  audioUrl: text("audio_url"),
  duration: integer("duration"), // duration in seconds for voice messages
  transcript: text("transcript"),
  emotion: jsonb("emotion"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCareTeamSchema = createInsertSchema(careTeams).omit({ id: true, createdAt: true });
export type InsertCareTeam = z.infer<typeof insertCareTeamSchema>;
export type CareTeam = typeof careTeams.$inferSelect;

export const insertCareTeamMemberSchema = createInsertSchema(careTeamMembers).omit({ id: true, createdAt: true });
export type InsertCareTeamMember = z.infer<typeof insertCareTeamMemberSchema>;
export type CareTeamMember = typeof careTeamMembers.$inferSelect;

export const insertCareThreadSchema = createInsertSchema(careThreads).omit({ id: true, createdAt: true });
export type InsertCareThread = z.infer<typeof insertCareThreadSchema>;
export type CareThread = typeof careThreads.$inferSelect;

export const insertCareMessageSchema = createInsertSchema(careMessages).omit({ id: true, createdAt: true });
export type InsertCareMessage = z.infer<typeof insertCareMessageSchema>;
export type CareMessage = typeof careMessages.$inferSelect;

// Escalations (when signals trigger care team attention)
export const escalations = pgTable("escalations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signalId: varchar("signal_id").references(() => signals.id),
  threadId: varchar("thread_id").references(() => careThreads.id),
  level: text("level").default("info").notNull(), // info, priority, urgent
  state: text("state").default("open").notNull(), // open, acknowledged, resolved
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertEscalationSchema = createInsertSchema(escalations).omit({ id: true, createdAt: true, resolvedAt: true });
export type InsertEscalation = z.infer<typeof insertEscalationSchema>;
export type Escalation = typeof escalations.$inferSelect;

// ============================================
// FOR YOU FEED
// ============================================

// Posts (from icons and members)
export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authorType: text("author_type").notNull(), // icon, member
  category: text("category").notNull(), // motivation, inspiration, truths, real_talk, opportunities, good_news, resources, unlocks, seeking
  title: text("title"),
  body: text("body").notNull(),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"), // image, video, audio
  tags: text("tags").array(),
  visibility: text("visibility").default("members").notNull(), // members, public
  isFeatured: boolean("is_featured").default(false),
  isPinned: boolean("is_pinned").default(false),
  status: text("status").default("published").notNull(), // draft, published, review, removed
  likesCount: integer("likes_count").default(0),
  savesCount: integer("saves_count").default(0),
  commentsCount: integer("comments_count").default(0),
  xpReward: integer("xp_reward").default(20),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPostSchema = createInsertSchema(posts).pick({
  authorId: true,
  authorType: true,
  category: true,
  title: true,
  body: true,
  mediaUrl: true,
  mediaType: true,
  tags: true,
});

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

// Post reactions
export const postReactions = pgTable("post_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => posts.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // support, save, fire, real, felt_that
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Post comments
export const postComments = pgTable("post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => posts.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// CLOSED-LOOP REFERRALS
// ============================================

// Resources directory
export const resources = pgTable("resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // housing, food, transportation, mental_health, employment, education, legal, financial
  contact: jsonb("contact"), // { phone, email, website, address }
  // Enhanced service area fields for geographic matching
  serviceArea: text("service_area"), // Legacy: human-readable description
  serviceAreaType: text("service_area_type").default("local"), // zip, city, county, state, national
  serviceZipCodes: text("service_zip_codes").array(), // Array of zip codes served
  serviceCities: text("service_cities").array(), // Array of city names served
  serviceCounties: text("service_counties").array(), // Array of county names served
  serviceStates: text("service_states").array(), // Array of state codes served (e.g., ['NY', 'NJ'])
  isNationwide: boolean("is_nationwide").default(false), // Serves all locations
  eligibility: text("eligibility"),
  isVerified: boolean("is_verified").default(false),
  // Organization connection status
  connectionType: text("connection_type").default("external").notNull(), // sainte_connected, external
  hasSainteAccess: boolean("has_sainte_access").default(false), // Does org have SAINTE portal access?
  // Organization performance tracking
  totalReferrals: integer("total_referrals").default(0),
  successfulReferrals: integer("successful_referrals").default(0),
  failedReferrals: integer("failed_referrals").default(0),
  avgResponseDays: real("avg_response_days"), // Average time to first contact
  avgCompletionDays: real("avg_completion_days"), // Average time from accepted to completed
  successRate: real("success_rate"), // Calculated: successful / total * 100
  // Accountability flags
  redTapeScore: integer("red_tape_score").default(0), // Higher = more barriers (0-100)
  reliabilityScore: integer("reliability_score").default(100), // Higher = more reliable (0-100)
  issueCount: integer("issue_count").default(0), // Total reported issues
  isFlagged: boolean("is_flagged").default(false), // Flagged for review
  flagReason: text("flag_reason"),
  lastIssueAt: timestamp("last_issue_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertResourceSchema = createInsertSchema(resources).omit({ 
  id: true, createdAt: true, updatedAt: true,
  totalReferrals: true, successfulReferrals: true, failedReferrals: true,
  avgResponseDays: true, avgCompletionDays: true, successRate: true,
  redTapeScore: true, reliabilityScore: true, issueCount: true,
  isFlagged: true, flagReason: true, lastIssueAt: true
});
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resources.$inferSelect;

// Referrals
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  resourceId: varchar("resource_id").notNull().references(() => resources.id),
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  source: text("source").default("self").notNull(), // siani, care, self, community
  linkedGoalId: varchar("linked_goal_id").references(() => goals.id),
  linkedSignalId: varchar("linked_signal_id").references(() => signals.id),
  state: text("state").default("proposed").notNull(), // proposed, offered, accepted, scheduled, in_progress, completed, could_not_complete, declined
  priority: text("priority").default("normal"), // low, normal, high
  dueDate: timestamp("due_date"),
  notes: text("notes"),
  xpReward: integer("xp_reward").default(50),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

// Referral steps (milestones within a referral)
export const referralSteps = pgTable("referral_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralId: varchar("referral_id").notNull().references(() => referrals.id),
  name: text("name").notNull(),
  status: text("status").default("pending").notNull(), // pending, done, blocked, skipped
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Referral outcomes (closed loop tracking with organization accountability)
export const referralOutcomes = pgTable("referral_outcomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralId: varchar("referral_id").notNull().references(() => referrals.id),
  resourceId: varchar("resource_id").references(() => resources.id),
  result: text("result").notNull(), // success, partial, no_contact, waitlist, not_eligible, org_failed, user_declined, other
  
  // Organization accountability tracking
  orgResponded: boolean("org_responded").default(false),
  orgResponseDays: integer("org_response_days"), // Days until org first responded
  orgCompletionDays: integer("org_completion_days"), // Days from accepted to outcome
  
  // Barrier tracking (what went wrong on org side)
  barrierType: text("barrier_type"), // none, documentation, eligibility, wait_time, unresponsive, denied, closed, rude_staff, other
  barrierDetails: text("barrier_details"),
  
  // User feedback on organization
  userRating: integer("user_rating"), // 1-5 stars
  userFeedback: text("user_feedback"),
  wouldRecommend: boolean("would_recommend"),
  
  notes: text("notes"),
  followUpNeeded: boolean("follow_up_needed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReferralOutcomeSchema = createInsertSchema(referralOutcomes).omit({ id: true, createdAt: true });
export type InsertReferralOutcome = z.infer<typeof insertReferralOutcomeSchema>;
export type ReferralOutcome = typeof referralOutcomes.$inferSelect;

// Organization issues (accountability reports)
export const organizationIssues = pgTable("organization_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceId: varchar("resource_id").notNull().references(() => resources.id),
  reportedByUserId: varchar("reported_by_user_id").references(() => users.id, { onDelete: "set null" }),
  referralId: varchar("referral_id").references(() => referrals.id),
  
  // Issue classification
  issueType: text("issue_type").notNull(), // unresponsive, excessive_docs, denied_unfairly, rude_staff, closed_unexpectedly, wrong_info, long_wait, discrimination, other
  severity: text("severity").default("medium").notNull(), // low, medium, high, critical
  
  // Issue details
  title: text("title").notNull(),
  description: text("description").notNull(),
  
  // Resolution tracking
  status: text("status").default("open").notNull(), // open, investigating, resolved, dismissed
  resolution: text("resolution"),
  resolvedByUserId: varchar("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  
  // Impact tracking
  affectedUsers: integer("affected_users").default(1),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganizationIssueSchema = createInsertSchema(organizationIssues).omit({ 
  id: true, createdAt: true, updatedAt: true, 
  status: true, resolution: true, resolvedByUserId: true, resolvedAt: true 
});
export type InsertOrganizationIssue = z.infer<typeof insertOrganizationIssueSchema>;
export type OrganizationIssue = typeof organizationIssues.$inferSelect;

// Referral notes (updates from org contacts that need verification)
export const referralNotes = pgTable("referral_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralId: varchar("referral_id").notNull().references(() => referrals.id),
  resourceId: varchar("resource_id").notNull().references(() => resources.id),
  
  // Who created this note
  authorType: text("author_type").notNull(), // org_contact, user, siani, care_team
  authorId: varchar("author_id"), // user ID or org contact ID
  authorName: text("author_name"), // Display name
  authorRole: text("author_role"), // "Case Manager", "Intake Coordinator", etc.
  
  // Note content
  noteType: text("note_type").notNull(), // status_update, appointment, document_request, milestone, general, follow_up
  title: text("title").notNull(),
  content: text("content").notNull(),
  
  // Verification (org notes need user/Siani confirmation)
  verificationStatus: text("verification_status").default("pending").notNull(), // pending, verified, rejected, auto_verified
  verifiedByUserId: varchar("verified_by_user_id").references(() => users.id, { onDelete: "set null" }),
  verifiedBySiani: boolean("verified_by_siani").default(false),
  verificationNote: text("verification_note"), // User's response or Siani's verification reason
  verifiedAt: timestamp("verified_at"),
  
  // For status updates - proposed new state
  proposedState: text("proposed_state"), // If note proposes a state change
  stateChangeApplied: boolean("state_change_applied").default(false),
  
  // Visibility
  isVisibleToUser: boolean("is_visible_to_user").default(true),
  isVisibleToOrg: boolean("is_visible_to_org").default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReferralNoteSchema = createInsertSchema(referralNotes).omit({ 
  id: true, createdAt: true, updatedAt: true,
  verificationStatus: true, verifiedByUserId: true, verifiedBySiani: true, 
  verificationNote: true, verifiedAt: true, stateChangeApplied: true
});
export type InsertReferralNote = z.infer<typeof insertReferralNoteSchema>;
export type ReferralNote = typeof referralNotes.$inferSelect;

// Organization contacts (people at organizations who can update referrals)
export const orgContacts = pgTable("org_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceId: varchar("resource_id").notNull().references(() => resources.id),
  
  // Contact info
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role"), // "Case Manager", "Intake Coordinator", "Director"
  
  // Access control
  isActive: boolean("is_active").default(true),
  canUpdateReferrals: boolean("can_update_referrals").default(true),
  
  // Auth (if they have portal access)
  hasPortalAccess: boolean("has_portal_access").default(false),
  portalUserId: varchar("portal_user_id"), // Link to their user account if they have one
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrgContactSchema = createInsertSchema(orgContacts).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertOrgContact = z.infer<typeof insertOrgContactSchema>;
export type OrgContact = typeof orgContacts.$inferSelect;

// ============================================
// MULTI-TIER VERIFICATION SYSTEM
// ============================================
// For external resources without SAINTE connection, we need alternative
// verification methods to close the referral loop

// Verification tiers - NO CHW involvement, all handled by Siani + user
export const VERIFICATION_TIERS = ['self_report', 'evidence', 'siani_validated'] as const;
export type VerificationTier = typeof VERIFICATION_TIERS[number];

export const EVIDENCE_TYPES = [
  'conversation',       // Siani follow-up conversation with validation questions
  'voice_confirmation', // User voice message confirmation
  'photo',              // Photo of appointment card, receipt, etc
  'document',           // Document upload (PDF, etc)
  'location',           // Automatic - user was near resource location
  'calendar',           // Calendar integration (appointment sync)
  'siani_validation',   // Siani validated through detailed questioning
  'time_based',         // Auto-confirmed after expected timeframe passed
] as const;
export type EvidenceType = typeof EVIDENCE_TYPES[number];

// Trust weights for different evidence types (higher = more trustworthy)
// All verification handled by Siani + user - NO CHW involvement
export const EVIDENCE_TRUST_WEIGHTS: Record<EvidenceType, number> = {
  conversation: 40,        // Basic - user self-report in conversation
  voice_confirmation: 55,  // Better - explicit voice confirmation from user
  photo: 75,               // Good - visual evidence (appointment card, receipt)
  document: 80,            // Good - official documentation uploaded
  location: 65,            // Moderate - automatic location verification
  calendar: 60,            // Moderate - appointment in calendar
  siani_validation: 70,    // Good - Siani asked detailed follow-up questions
  time_based: 45,          // Lower - just time passed, no active confirmation
};

// Referral verifications - tracks all verification attempts and evidence
export const referralVerifications = pgTable("referral_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralId: varchar("referral_id").notNull().references(() => referrals.id),
  resourceId: varchar("resource_id").notNull().references(() => resources.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Verification tier and type
  tier: text("tier").notNull(), // self_report, evidence, third_party
  evidenceType: text("evidence_type").notNull(), // conversation, photo, document, etc
  
  // Confidence scoring
  confidenceScore: integer("confidence_score").default(0).notNull(), // 0-100
  trustWeight: integer("trust_weight").default(0).notNull(), // Based on evidence type
  
  // Source of verification (NO CHW - all handled by Siani/user/system)
  verifiedByType: text("verified_by_type").notNull(), // user, siani, system
  verifiedByUserId: varchar("verified_by_user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Evidence details
  evidenceDescription: text("evidence_description"),
  evidenceUrl: text("evidence_url"), // S3/storage URL for photos/documents
  evidenceMetadata: jsonb("evidence_metadata"), // Additional data (location coords, etc)
  
  // Verification outcome
  outcome: text("outcome").notNull(), // confirmed, denied, partial, inconclusive
  outcomeNote: text("outcome_note"),
  
  // State change proposal (if verification proposes a referral state change)
  proposedState: text("proposed_state"),
  stateChangeApplied: boolean("state_change_applied").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
});

export const insertReferralVerificationSchema = createInsertSchema(referralVerifications).omit({
  id: true, createdAt: true, stateChangeApplied: true
});
export type InsertReferralVerification = z.infer<typeof insertReferralVerificationSchema>;
export type ReferralVerification = typeof referralVerifications.$inferSelect;

// User verification reliability - tracks how reliable each user's self-reports are
export const userVerificationReliability = pgTable("user_verification_reliability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Reliability metrics
  totalVerifications: integer("total_verifications").default(0),
  confirmedVerifications: integer("confirmed_verifications").default(0), // Later validated as true
  contradictedVerifications: integer("contradicted_verifications").default(0), // Found to be false
  
  // Trust score (0-100) - based on verification history
  trustScore: integer("trust_score").default(70).notNull(), // Start at 70 for new users
  
  // Self-report specifics
  selfReportAccuracy: real("self_report_accuracy"), // % of self-reports that were accurate
  
  // Timestamps
  lastVerificationAt: timestamp("last_verification_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Verification reminders - schedule follow-up prompts for unverified referrals
export const verificationReminders = pgTable("verification_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralId: varchar("referral_id").notNull().references(() => referrals.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Reminder details
  reminderType: text("reminder_type").notNull(), // siani_followup, evidence_request, chw_escalation
  message: text("message"),
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").default("pending").notNull(), // pending, sent, completed, cancelled
  
  // Tracking
  attemptNumber: integer("attempt_number").default(1),
  maxAttempts: integer("max_attempts").default(3),
  
  sentAt: timestamp("sent_at"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVerificationReminderSchema = createInsertSchema(verificationReminders).omit({
  id: true, createdAt: true, sentAt: true, respondedAt: true
});
export type InsertVerificationReminder = z.infer<typeof insertVerificationReminderSchema>;
export type VerificationReminder = typeof verificationReminders.$inferSelect;

// ============================================
// NOTIFICATIONS & DROPS
// ============================================

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // badge_earned, streak, xp_milestone, new_drop, care_message, referral_update, mention
  title: text("title").notNull(),
  body: text("body"),
  data: jsonb("data"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// CHALLENGES & PRIZES (HYPE ENGAGEMENT)
// ============================================

// Challenges - dope opportunities with prizes
export const challenges = pgTable("challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // daily, weekly, community, sponsored
  category: text("category").notNull(), // fitness, creativity, mindset, social, career, lifestyle
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url"),
  sponsorName: text("sponsor_name"),
  sponsorLogo: text("sponsor_logo"),
  xpReward: integer("xp_reward").default(100),
  prizeDescription: text("prize_description"), // "2 VIP tickets to SXSW"
  prizeValue: integer("prize_value"), // dollar value
  prizeImageUrl: text("prize_image_url"),
  participantLimit: integer("participant_limit"),
  participantCount: integer("participant_count").default(0),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  status: text("status").default("upcoming").notNull(), // upcoming, active, ended, cancelled
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({ id: true, createdAt: true });
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;

// Challenge participation
export const challengeParticipants = pgTable("challenge_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").notNull().references(() => challenges.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").default("joined").notNull(), // joined, in_progress, completed, winner
  submissionUrl: text("submission_url"),
  submissionNote: text("submission_note"),
  isWinner: boolean("is_winner").default(false),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// ============================================
// POLLS & COMMUNITY VOTING
// ============================================

export const polls = pgTable("polls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").references(() => users.id, { onDelete: "set null" }),
  question: text("question").notNull(),
  category: text("category").default("vibes"), // vibes, money, lifestyle, culture, hot_takes
  options: jsonb("options").notNull(), // [{ id: "a", text: "Hot take", votes: 0 }, ...]
  totalVotes: integer("total_votes").default(0),
  xpReward: integer("xp_reward").default(5),
  isActive: boolean("is_active").default(true),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPollSchema = createInsertSchema(polls).omit({ id: true, createdAt: true });
export type InsertPoll = z.infer<typeof insertPollSchema>;
export type Poll = typeof polls.$inferSelect;

// Poll votes
export const pollVotes = pgTable("poll_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pollId: varchar("poll_id").notNull().references(() => polls.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  optionId: text("option_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// PULSE SCORE & DAILY ENGAGEMENT
// ============================================

export const pulseScores = pgTable("pulse_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  score: integer("score").default(0).notNull(),
  voiceCheckIns: integer("voice_check_ins").default(0),
  challengesJoined: integer("challenges_joined").default(0),
  pollsAnswered: integer("polls_answered").default(0),
  postsEngaged: integer("posts_engaged").default(0),
  streakDays: integer("streak_days").default(0),
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow().notNull(),
});

// Daily hype prompts
export const dailyPrompts = pgTable("daily_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promptText: text("prompt_text").notNull(),
  category: text("category").default("hype"), // hype, gratitude, wins, goals, vibes
  isActive: boolean("is_active").default(true),
  activeDate: timestamp("active_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User prompt responses
export const promptResponses = pgTable("prompt_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promptId: varchar("prompt_id").notNull().references(() => dailyPrompts.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  audioUrl: text("audio_url"),
  transcript: text("transcript"),
  xpEarned: integer("xp_earned").default(15),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// GATED CONTENT & UNLOCKS
// ============================================

export const gatedContent = pgTable("gated_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentType: text("content_type").notNull(), // post, challenge, prize, feature
  contentId: varchar("content_id"),
  unlockRequirement: text("unlock_requirement").notNull(), // voice_answer, streak_3, level_5, poll_vote
  unlockValue: integer("unlock_value"), // e.g., 3 for streak_3
  teaseText: text("tease_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User unlocks
export const userUnlocks = pgTable("user_unlocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gatedContentId: varchar("gated_content_id").notNull().references(() => gatedContent.id),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

// ============================================
// INFLUENCER MEDIA (VIDEO-FIRST FOR YOU FEED)
// ============================================

export const influencerMedia = pgTable("influencer_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  influencerId: varchar("influencer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  caption: text("caption"),
  videoUrl: text("video_url").notNull(),
  posterUrl: text("poster_url"), // thumbnail/poster frame
  duration: integer("duration"), // seconds
  category: text("category").notNull(), // hype, wins, tips, motivation, lifestyle, behind_scenes
  tags: text("tags").array(),
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  shareCount: integer("share_count").default(0),
  linkedChallengeId: varchar("linked_challenge_id").references(() => challenges.id),
  isFeatured: boolean("is_featured").default(false),
  status: text("status").default("published").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInfluencerMediaSchema = createInsertSchema(influencerMedia).omit({ id: true, createdAt: true });
export type InsertInfluencerMedia = z.infer<typeof insertInfluencerMediaSchema>;
export type InfluencerMedia = typeof influencerMedia.$inferSelect;

// Media interactions
export const mediaInteractions = pgTable("media_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mediaId: varchar("media_id").notNull().references(() => influencerMedia.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // view, like, share, save
  watchDuration: integer("watch_duration"), // seconds watched
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// THE FLOW - THREE-LANE EXCLUSIVE FEED
// ============================================

// LANE 1: DROPS & ACCESS - Time-gated invites, RSVP, limited seats
export const drops = pgTable("drops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  headline: text("headline").notNull(), // "SXSW Mentorship Program"
  subhead: text("subhead"), // "4 days with industry legends"
  description: text("description"),
  // Media
  mediaUrl: text("media_url"), // Cover image or video
  mediaType: text("media_type").default("image"), // image, video
  // Exclusivity & Scarcity
  exclusivityTier: text("exclusivity_tier").default("members").notNull(), // members, icons, inner_circle
  seatCount: integer("seat_count"), // Total seats (null = unlimited)
  seatsRemaining: integer("seats_remaining"), // Current remaining seats
  // Time-gating
  accessWindowStart: timestamp("access_window_start"),
  accessWindowEnd: timestamp("access_window_end"), // Also used for RSVP close time
  windowState: text("window_state").default("upcoming").notNull(), // upcoming, live, closing, closed
  // Prize/Value
  prizeDescription: text("prize_description"), // "Free flights. Free passes."
  prizeValue: integer("prize_value"), // dollar value
  // Engagement
  fireCount: integer("fire_count").default(0),
  strengthCount: integer("strength_count").default(0),
  heartCount: integer("heart_count").default(0),
  rsvpCount: integer("rsvp_count").default(0),
  // Meta
  isFeatured: boolean("is_featured").default(false),
  status: text("status").default("active").notNull(), // draft, active, closed, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDropSchema = createInsertSchema(drops).omit({ id: true, createdAt: true });
export type InsertDrop = z.infer<typeof insertDropSchema>;
export type Drop = typeof drops.$inferSelect;

// Drop RSVPs - Night Shift RSVP tracking
export const dropRsvps = pgTable("drop_rsvps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dropId: varchar("drop_id").notNull().references(() => drops.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, confirmed, waitlist, declined
  rsvpedAt: timestamp("rsvped_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

export const insertDropRsvpSchema = createInsertSchema(dropRsvps).omit({ id: true, rsvpedAt: true });
export type InsertDropRsvp = z.infer<typeof insertDropRsvpSchema>;
export type DropRsvp = typeof dropRsvps.$inferSelect;

// Drop RSVP status types
export const DROP_RSVP_STATUSES = ['pending', 'confirmed', 'waitlist', 'declined'] as const;
export type DropRsvpStatus = typeof DROP_RSVP_STATUSES[number];

// LANE 2: SIGNALS & SIGHTINGS - Cinematic reportage from elite spaces
export const feedSignals = pgTable("feed_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Content
  narrative: text("narrative").notNull(), // The story/insight
  locationContext: text("location_context"), // "Backstage at Rolling Loud"
  storyteller: text("storyteller"), // Who's sharing this signal
  storytellerRole: text("storyteller_role"), // "Grammy-winning Producer"
  // Media - cinematic visuals
  mediaUrl: text("media_url"),
  mediaType: text("media_type").default("image"), // image, video
  cinematicTags: text("cinematic_tags").array(), // ["backstage", "studio", "fashion_week"]
  proofAssets: text("proof_assets").array(), // Additional credibility images
  // Engagement
  fireCount: integer("fire_count").default(0),
  strengthCount: integer("strength_count").default(0),
  heartCount: integer("heart_count").default(0),
  // Meta
  exclusivityTier: text("exclusivity_tier").default("members").notNull(),
  isFeatured: boolean("is_featured").default(false),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFeedSignalSchema = createInsertSchema(feedSignals).omit({ id: true, createdAt: true });
export type InsertFeedSignal = z.infer<typeof insertFeedSignalSchema>;
export type FeedSignal = typeof feedSignals.$inferSelect;

// Feed Reactions - Night Shift signal/story engagement
export const feedReactions = pgTable("feed_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  feedSignalId: varchar("feed_signal_id").notNull().references(() => feedSignals.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reactionType: varchar("reaction_type", { length: 20 }).notNull(), // fire, respect, inspired
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFeedReactionSchema = createInsertSchema(feedReactions).omit({ id: true, createdAt: true });
export type InsertFeedReaction = z.infer<typeof insertFeedReactionSchema>;
export type FeedReaction = typeof feedReactions.$inferSelect;

// Feed reaction types
export const FEED_REACTION_TYPES = ['fire', 'respect', 'inspired'] as const;
export type FeedReactionType = typeof FEED_REACTION_TYPES[number];

// LANE 3: CIRCLE SPOTLIGHTS - Member achievements with high-status markers
export const spotlights = pgTable("spotlights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Member
  memberId: varchar("member_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  memberDisplayName: text("member_display_name"),
  memberAvatarUrl: text("member_avatar_url"),
  // Achievement
  achievementType: text("achievement_type").notNull(), // job, custody, housing, business, education, milestone
  spotlightCopy: text("spotlight_copy").notNull(), // "Just closed my first six-figure deal"
  contextCopy: text("context_copy"), // "A year ago I was sleeping on my cousin's couch"
  // Proof & Credentials
  credentialProof: text("credential_proof"), // Optional verification
  proofMediaUrl: text("proof_media_url"),
  // Reward hook for dopamine
  rewardHook: text("reward_hook"), // "Vault ping incoming" - anticipation cue
  // Engagement
  fireCount: integer("fire_count").default(0),
  strengthCount: integer("strength_count").default(0),
  heartCount: integer("heart_count").default(0),
  // Status markers (NOT vanity metrics)
  momentumLabel: text("momentum_label"), // "Energy Surging", "Circle Verified"
  // Meta
  isVerified: boolean("is_verified").default(false),
  isFeatured: boolean("is_featured").default(false),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSpotlightSchema = createInsertSchema(spotlights).omit({ id: true, createdAt: true });
export type InsertSpotlight = z.infer<typeof insertSpotlightSchema>;
export type Spotlight = typeof spotlights.$inferSelect;

// Energy Reactions - Universal for all Flow content (🔥 💪 ❤️)
export const energyReactions = pgTable("energy_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(), // drop, signal, spotlight
  contentId: varchar("content_id").notNull(),
  reactionType: text("reaction_type").notNull(), // fire, strength, heart
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Flow content types enum
export const FLOW_LANES = ['drops', 'signals', 'spotlights'] as const;
export type FlowLane = typeof FLOW_LANES[number];

export const ENERGY_REACTION_TYPES = ['fire', 'strength', 'heart'] as const;
export type EnergyReactionType = typeof ENERGY_REACTION_TYPES[number];

export const ACHIEVEMENT_TYPES = [
  'job', 'custody', 'housing', 'business', 'education', 
  'milestone', 'health', 'financial', 'creative'
] as const;
export type AchievementType = typeof ACHIEVEMENT_TYPES[number];

export const EXCLUSIVITY_TIERS = ['members', 'icons', 'inner_circle'] as const;
export type ExclusivityTier = typeof EXCLUSIVITY_TIERS[number];

// ============================================
// ENUMS & CONSTANTS
// ============================================

export const SIGNAL_TYPES = [
  'crisis', 'distress', 'isolation', 'hopelessness',
  'anxiety', 'grief', 'frustration', 'fatigue',
] as const;

export type SignalType = typeof SIGNAL_TYPES[number];

export const GOAL_CATEGORIES = [
  'money', 'housing', 'health', 'relationships', 'career', 'peace',
] as const;

export type GoalCategory = typeof GOAL_CATEGORIES[number];

export const POST_CATEGORIES = [
  'motivation', 'inspiration', 'truths', 'real_talk', 'opportunities',
  'good_news', 'resources', 'unlocks', 'seeking',
] as const;

export type PostCategory = typeof POST_CATEGORIES[number];

export const RESOURCE_CATEGORIES = [
  'housing', 'food', 'healthcare', 'mental_health', 'employment',
  'education', 'legal', 'financial', 'childcare', 'transportation',
] as const;

export type ResourceCategory = typeof RESOURCE_CATEGORIES[number];

export const REACTION_TYPES = [
  'support', 'save', 'fire', 'real', 'felt_that',
] as const;

export type ReactionType = typeof REACTION_TYPES[number];

// Level thresholds
export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 18000, 25000
] as const;

export function getLevelFromXp(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getXpForNextLevel(currentLevel: number): number {
  if (currentLevel >= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return LEVEL_THRESHOLDS[currentLevel];
}

// ============================================
// IMPACT DOSSIERS (Auto-generated progress reports)
// ============================================

export const impactDossiers = pgTable("impact_dossiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Period covered
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  periodType: text("period_type").default("weekly").notNull(), // weekly, monthly, quarterly
  // Summary metrics
  credEarned: integer("cred_earned").default(0),
  actionsCompleted: integer("actions_completed").default(0),
  referralsClosed: integer("referrals_closed").default(0),
  checkInsCompleted: integer("check_ins_completed").default(0),
  goalsAchieved: integer("goals_achieved").default(0),
  // Mood trajectory
  moodStart: integer("mood_start"), // Average mood at period start
  moodEnd: integer("mood_end"), // Average mood at period end
  moodDelta: integer("mood_delta"), // Change in mood
  // Narrative content
  summary: text("summary"), // Siani-generated narrative summary
  highlights: jsonb("highlights"), // Array of key achievements
  challenges: jsonb("challenges"), // Array of barriers faced
  // CHW endorsements
  chwEndorsements: jsonb("chw_endorsements"), // Array of CHW notes/validations
  // Sharing
  isShareable: boolean("is_shareable").default(false),
  shareCode: varchar("share_code").unique(), // For sharing with external parties
  sharedWith: text("shared_with").array(), // List of recipients
  // Generation
  generatedByUserId: varchar("generated_by_user_id").references(() => users.id, { onDelete: "cascade" }),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertImpactDossierSchema = createInsertSchema(impactDossiers).omit({ id: true, createdAt: true, generatedAt: true });
export type InsertImpactDossier = z.infer<typeof insertImpactDossierSchema>;
export type ImpactDossier = typeof impactDossiers.$inferSelect;

// Dossier period types
export const DOSSIER_PERIODS = ['weekly', 'monthly', 'quarterly'] as const;
export type DossierPeriod = typeof DOSSIER_PERIODS[number];

// ============================================
// PHASE 1: DAILY DOPAMINE LOOP
// ============================================

// PULSE - Community Quick Questions
// Quick, engaging questions that create connection and collect insights
export const pulseQuestions = pgTable("pulse_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: text("question").notNull(),
  category: text("category").notNull(), // mood, wisdom, community, real_talk, future
  questionType: text("question_type").default("multiple_choice").notNull(), // multiple_choice, slider, open
  options: jsonb("options"), // For multiple choice: [{ value: 'a', label: 'Option A' }]
  sliderConfig: jsonb("slider_config"), // For slider: { min: 1, max: 10, labels: ['Low', 'High'] }
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0), // Higher = shown first
  xpReward: integer("xp_reward").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // Optional expiration for time-sensitive questions
});

export const insertPulseQuestionSchema = createInsertSchema(pulseQuestions).omit({ id: true, createdAt: true });
export type InsertPulseQuestion = z.infer<typeof insertPulseQuestionSchema>;
export type PulseQuestion = typeof pulseQuestions.$inferSelect;

export const pulseResponses = pgTable("pulse_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: varchar("question_id").notNull().references(() => pulseQuestions.id),
  response: text("response").notNull(), // Selected option value, slider number, or open text
  xpEarned: integer("xp_earned").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPulseResponseSchema = createInsertSchema(pulseResponses).omit({ id: true, createdAt: true });
export type InsertPulseResponse = z.infer<typeof insertPulseResponseSchema>;
export type PulseResponse = typeof pulseResponses.$inferSelect;

// RHYTHM - Patterns You're Building
// Tracks consistent behaviors without the shame of "broken streaks"
export const rhythms = pgTable("rhythms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // User's own words: "Taking my meds", "Not texting my ex"
  category: text("category").default("personal").notNull(), // health, relationships, work, growth, self_care
  frequency: text("frequency").default("daily").notNull(), // daily, weekdays, weekly
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  totalCompletions: integer("total_completions").default(0).notNull(),
  lastCompletedAt: timestamp("last_completed_at"),
  isActive: boolean("is_active").default(true),
  sianiCreated: boolean("siani_created").default(false), // Did Siani notice this pattern?
  sianiInsight: text("siani_insight"), // "You usually miss this when X is happening"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRhythmSchema = createInsertSchema(rhythms).omit({ id: true, createdAt: true });
export type InsertRhythm = z.infer<typeof insertRhythmSchema>;
export type Rhythm = typeof rhythms.$inferSelect;

export const rhythmLogs = pgTable("rhythm_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rhythmId: varchar("rhythm_id").notNull().references(() => rhythms.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  note: text("note"), // Optional reflection
  mood: integer("mood"), // 1-5 how they felt
  xpEarned: integer("xp_earned").default(10),
});

export const insertRhythmLogSchema = createInsertSchema(rhythmLogs).omit({ id: true, completedAt: true });
export type InsertRhythmLog = z.infer<typeof insertRhythmLogSchema>;
export type RhythmLog = typeof rhythmLogs.$inferSelect;

// THE REAL - End-of-Day Truth Capture
// Nightly ritual for honest reflection, triggered by Siani
export const realCaptures = pgTable("real_captures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // The capture itself
  captureType: text("capture_type").default("voice").notNull(), // voice, text
  transcription: text("transcription"), // Voice transcription or text input
  audioUrl: text("audio_url"), // S3 URL if voice
  duration: integer("duration"), // Seconds if voice
  // Siani's analysis (populated after capture)
  sianiSummary: text("siani_summary"), // Siani's one-line summary
  emotionalTone: jsonb("emotional_tone"), // Detected emotions
  keyThemes: text("key_themes").array(), // Main topics discussed
  // Scoring (not shown to user, used for patterns)
  energyScore: integer("energy_score"), // 1-10 energy level detected
  clarityScore: integer("clarity_score"), // 1-10 how clear their thinking is
  hopeScore: integer("hope_score"), // 1-10 hope/optimism detected
  // User's self-rating
  dayRating: integer("day_rating"), // 1-5 how they'd rate the day
  gratitude: text("gratitude"), // One thing they're grateful for
  tomorrow: text("tomorrow"), // One thing for tomorrow
  // Meta
  xpEarned: integer("xp_earned").default(25),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRealCaptureSchema = createInsertSchema(realCaptures).omit({ id: true, createdAt: true });
export type InsertRealCapture = z.infer<typeof insertRealCaptureSchema>;
export type RealCapture = typeof realCaptures.$inferSelect;

// Pulse question categories
export const PULSE_CATEGORIES = [
  'mood', 'wisdom', 'community', 'real_talk', 'future', 'gratitude', 'dreams'
] as const;
export type PulseCategory = typeof PULSE_CATEGORIES[number];

// Rhythm categories
export const RHYTHM_CATEGORIES = [
  'health', 'relationships', 'work', 'growth', 'self_care', 'financial', 'creative'
] as const;
export type RhythmCategory = typeof RHYTHM_CATEGORIES[number];

// Rhythm frequencies
export const RHYTHM_FREQUENCIES = [
  'daily', 'weekdays', 'weekly', 'twice_weekly'
] as const;
export type RhythmFrequency = typeof RHYTHM_FREQUENCIES[number];

// ============================================
// INSTITUTIONAL DASHBOARD - Analytics Platform
// ============================================

// Organizations (MCOs, CBOs, Employers)
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // mco, cbo, employer, health_system
  description: text("description"),
  logoUrl: text("logo_url"),
  settings: jsonb("settings"), // org-specific configuration
  timezone: text("timezone").default("America/New_York"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// Organization types
export const ORG_TYPES = ['mco', 'cbo', 'employer', 'health_system'] as const;
export type OrgType = typeof ORG_TYPES[number];

// Organization members - links users to organizations with roles
export const orgMembers = pgTable("org_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // admin, analyst, chw, case_manager, supervisor
  permissions: text("permissions").array(), // granular permissions
  isActive: boolean("is_active").default(true),
  invitedAt: timestamp("invited_at"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const insertOrgMemberSchema = createInsertSchema(orgMembers).omit({ id: true, joinedAt: true });
export type InsertOrgMember = z.infer<typeof insertOrgMemberSchema>;
export type OrgMember = typeof orgMembers.$inferSelect;

// Organization roles
export const ORG_ROLES = ['admin', 'analyst', 'chw', 'case_manager', 'supervisor', 'viewer'] as const;
export type OrgRole = typeof ORG_ROLES[number];

// User events - comprehensive event tracking for analytics
export const userEvents = pgTable("user_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").references(() => organizations.id),
  eventType: text("event_type").notNull(), // need_identified, prevention_triggered, referral_action, conversation_tag, risk_shift
  eventSubtype: text("event_subtype"), // housing, food, transport, medication, income, safety, etc.
  payload: jsonb("payload"), // event-specific data
  severity: integer("severity"), // 1-5 for prioritization
  isProcessed: boolean("is_processed").default(false),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserEventSchema = createInsertSchema(userEvents).omit({ id: true, createdAt: true });
export type InsertUserEvent = z.infer<typeof insertUserEventSchema>;
export type UserEvent = typeof userEvents.$inferSelect;

// Event types for dashboard
export const USER_EVENT_TYPES = [
  'need_identified', 'prevention_triggered', 'referral_action', 
  'conversation_tag', 'risk_shift', 'barrier_resolved', 'task_automated',
  'member_engagement', 'crisis_averted', 'goal_progress'
] as const;
export type UserEventType = typeof USER_EVENT_TYPES[number];

// AI Sentiment - aggregated sentiment analysis
export const aiSentiment = pgTable("ai_sentiment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").references(() => organizations.id),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  sentimentScore: real("sentiment_score").notNull(), // -1 to 1
  trustScore: real("trust_score"), // 0 to 1
  engagementScore: real("engagement_score"), // 0 to 1
  riskScore: real("risk_score"), // 0 to 1
  keywords: text("keywords").array(), // extracted topics/themes
  emotionalTags: text("emotional_tags").array(), // housing_stress, medication_concern, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiSentimentSchema = createInsertSchema(aiSentiment).omit({ id: true, createdAt: true });
export type InsertAiSentiment = z.infer<typeof insertAiSentimentSchema>;
export type AiSentiment = typeof aiSentiment.$inferSelect;

// Metric snapshots - daily/hourly aggregations for dashboards
export const metricSnapshots = pgTable("metric_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id),
  metricName: text("metric_name").notNull(), // activation_index, trust_velocity, referral_success_rate, etc.
  metricValue: real("metric_value").notNull(),
  previousValue: real("previous_value"), // for trend calculation
  changePercent: real("change_percent"),
  sampleSize: integer("sample_size"), // number of data points
  dimension: text("dimension"), // optional grouping: by_zip, by_need_type, by_cbo
  dimensionValue: text("dimension_value"), // the value: "48201", "housing", "org_xyz"
  periodType: text("period_type").default("daily").notNull(), // hourly, daily, weekly, monthly
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMetricSnapshotSchema = createInsertSchema(metricSnapshots).omit({ id: true, createdAt: true });
export type InsertMetricSnapshot = z.infer<typeof insertMetricSnapshotSchema>;
export type MetricSnapshot = typeof metricSnapshots.$inferSelect;

// Dashboard metrics
export const DASHBOARD_METRICS = [
  'activation_index', 'trust_velocity', 'belief_behavior_ratio',
  'referral_success_rate', 'time_to_accept', 'time_to_close',
  'prevention_rate', 'adherence_rate', 'cost_avoidance',
  'chw_load_reduction', 'automated_tasks', 'crisis_averted',
  'active_referrals', 'pending_referrals', 'member_engagement'
] as const;
export type DashboardMetric = typeof DASHBOARD_METRICS[number];

// Risk tiers for member categorization
export const riskTiers = pgTable("risk_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").references(() => organizations.id),
  currentTier: text("current_tier").notNull(), // low, moderate, high, critical
  previousTier: text("previous_tier"),
  tierScore: real("tier_score"), // numeric score for ranking
  reasonCodes: text("reason_codes").array(), // housing_instability, medication_gap, etc.
  lastAssessedAt: timestamp("last_assessed_at").defaultNow().notNull(),
  nextReviewAt: timestamp("next_review_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRiskTierSchema = createInsertSchema(riskTiers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRiskTier = z.infer<typeof insertRiskTierSchema>;
export type RiskTier = typeof riskTiers.$inferSelect;

export const RISK_TIER_LEVELS = ['low', 'moderate', 'high', 'critical'] as const;
export type RiskTierLevel = typeof RISK_TIER_LEVELS[number];

// Dashboard access logs for audit
export const dashboardAccessLogs = pgTable("dashboard_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").references(() => organizations.id),
  dashboardType: text("dashboard_type").notNull(), // payer, provider
  action: text("action").notNull(), // view, export, filter
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DashboardAccessLog = typeof dashboardAccessLogs.$inferSelect;

// ============================================
// THE VAULT - ANONYMOUS CONFESSIONAL SYSTEM
// ============================================

// Vault Confessions - Anonymous drops to the community
export const vaultConfessions = pgTable("vault_confessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Author linkage. NULL when isAnonymous=true so the row is genuinely
  // unattributable. When isAnonymous=false this references the author and
  // cascades on account deletion.
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  // Stable per-confession opaque handle (random salt). Used to render an
  // anonymous-but-consistent author label without exposing user identity.
  authorHandle: text("author_handle"),
  // Content
  content: text("content").notNull(), // The confession text
  audioUrl: text("audio_url"), // Optional voice confession
  audioDuration: integer("audio_duration"), // Duration in seconds
  // Anonymity
  isAnonymous: boolean("is_anonymous").default(true).notNull(), // Default anonymous
  displayName: text("display_name"), // Optional reveal name (if not anonymous)
  // Category/Mood
  category: text("category").default("truth").notNull(), // truth, struggle, win, question, confession
  mood: text("mood"), // raw, hopeful, heavy, relieved, uncertain
  // Engagement
  fireCount: integer("fire_count").default(0).notNull(),
  strengthCount: integer("strength_count").default(0).notNull(),
  heartCount: integer("heart_count").default(0).notNull(),
  realCount: integer("real_count").default(0).notNull(), // "REAL" reaction for authenticity
  totalReactions: integer("total_reactions").default(0).notNull(),
  // Spotlight potential
  isSpotlighted: boolean("is_spotlighted").default(false),
  spotlightedAt: timestamp("spotlighted_at"),
  spotlightBonus: integer("spotlight_bonus").default(0), // Bonus CRED for spotlight
  // Variable rewards (dopamine mechanic)
  baseCredReward: integer("base_cred_reward").default(5).notNull(),
  bonusCredReward: integer("bonus_cred_reward").default(0), // Random bonus
  // Moderation
  status: text("status").default("active").notNull(), // pending, active, flagged, hidden
  flagCount: integer("flag_count").default(0),
  // Meta
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // Optional expiration for timed confessions
});

export const insertVaultConfessionSchema = createInsertSchema(vaultConfessions).omit({ 
  id: true, createdAt: true, spotlightedAt: true,
  fireCount: true, strengthCount: true, heartCount: true, realCount: true, totalReactions: true,
  isSpotlighted: true, spotlightBonus: true, bonusCredReward: true, flagCount: true,
});
export type InsertVaultConfession = z.infer<typeof insertVaultConfessionSchema>;
export type VaultConfession = typeof vaultConfessions.$inferSelect;

// Vault Reactions - Energy reactions on confessions
export const vaultReactions = pgTable("vault_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  confessionId: varchar("confession_id").notNull().references(() => vaultConfessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reactionType: text("reaction_type").notNull(), // fire, strength, heart, real
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVaultReactionSchema = createInsertSchema(vaultReactions).omit({ id: true, createdAt: true });
export type InsertVaultReaction = z.infer<typeof insertVaultReactionSchema>;
export type VaultReaction = typeof vaultReactions.$inferSelect;

// Vault Spotlights - Track spotlight selections
export const vaultSpotlights = pgTable("vault_spotlights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  confessionId: varchar("confession_id").notNull().references(() => vaultConfessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // Author of confession
  // Selection details
  selectionReason: text("selection_reason"), // why_spotlighted: random, high_engagement, editor_pick
  credBonus: integer("cred_bonus").default(25).notNull(), // Bonus CRED for being spotlighted
  // Display period
  spotlightStart: timestamp("spotlight_start").defaultNow().notNull(),
  spotlightEnd: timestamp("spotlight_end"), // When spotlight expires
  // Engagement during spotlight
  viewCount: integer("view_count").default(0),
  reactionsDuringSpotlight: integer("reactions_during_spotlight").default(0),
  // Meta
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVaultSpotlightSchema = createInsertSchema(vaultSpotlights).omit({ 
  id: true, createdAt: true, viewCount: true, reactionsDuringSpotlight: true 
});
export type InsertVaultSpotlight = z.infer<typeof insertVaultSpotlightSchema>;
export type VaultSpotlight = typeof vaultSpotlights.$inferSelect;

// Vault constants
export const VAULT_CATEGORIES = ['truth', 'struggle', 'win', 'question', 'confession'] as const;
export type VaultCategory = typeof VAULT_CATEGORIES[number];

export const VAULT_MOODS = ['raw', 'hopeful', 'heavy', 'relieved', 'uncertain', 'grateful'] as const;
export type VaultMood = typeof VAULT_MOODS[number];

export const VAULT_REACTION_TYPES = ['fire', 'strength', 'heart', 'real'] as const;
export type VaultReactionType = typeof VAULT_REACTION_TYPES[number];

export const VAULT_CRED_REWARDS = {
  POST_CONFESSION: 5,
  RECEIVE_REACTION: 1,
  GET_SPOTLIGHTED: 25,
  SPOTLIGHT_ENGAGEMENT_BONUS: 10,
  RANDOM_BONUS_MIN: 5,
  RANDOM_BONUS_MAX: 25,
} as const;

// ============================================
// HEAT INDEX - LEADERBOARD & STATUS SYSTEM
// ============================================

// Heat Index Rankings - Weekly/Daily leaderboard snapshots
export const heatRankings = pgTable("heat_rankings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Ranking data
  rank: integer("rank").notNull(),
  previousRank: integer("previous_rank"),
  movement: integer("movement").default(0), // positive = rising, negative = falling
  percentile: integer("percentile"), // top X%
  // CRED metrics
  totalCred: integer("total_cred").notNull(),
  weeklyCredEarned: integer("weekly_cred_earned").default(0),
  dailyCredEarned: integer("daily_cred_earned").default(0),
  // Streak data
  currentStreak: integer("current_streak").default(0),
  // Period
  periodType: text("period_type").default("weekly").notNull(), // daily, weekly, monthly, all_time
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  // Status
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHeatRankingSchema = createInsertSchema(heatRankings).omit({ id: true, createdAt: true });
export type InsertHeatRanking = z.infer<typeof insertHeatRankingSchema>;
export type HeatRanking = typeof heatRankings.$inferSelect;

// Profile Watchers - "Who's watching you" feature
export const profileWatchers = pgTable("profile_watchers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  watchedUserId: varchar("watched_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  watcherUserId: varchar("watcher_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Watch type
  watchType: text("watch_type").default("view").notNull(), // view, follow, interested
  // Meta
  lastViewedAt: timestamp("last_viewed_at").defaultNow().notNull(),
  viewCount: integer("view_count").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProfileWatcherSchema = createInsertSchema(profileWatchers).omit({ id: true, createdAt: true });
export type InsertProfileWatcher = z.infer<typeof insertProfileWatcherSchema>;
export type ProfileWatcher = typeof profileWatchers.$inferSelect;

// Heat Index constants
export const HEAT_PERIOD_TYPES = ['daily', 'weekly', 'monthly', 'all_time'] as const;
export type HeatPeriodType = typeof HEAT_PERIOD_TYPES[number];

export const HEAT_MOVEMENT_LABELS = {
  RISING_FAST: 'rising_fast', // +10 or more
  RISING: 'rising', // +1 to +9
  STEADY: 'steady', // 0
  COOLING: 'cooling', // -1 to -9
  DROPPING: 'dropping', // -10 or more
} as const;

// ============================================
// PUSH NOTIFICATIONS
// ============================================

// Push notification tokens
export const pushTokens = pgTable("push_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(), // Expo push token
  platform: text("platform").default("ios").notNull(), // ios, android, web
  deviceId: text("device_id"), // Optional device identifier
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPushTokenSchema = createInsertSchema(pushTokens).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokens.$inferSelect;

// Notification preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  // Notification types
  newDrops: boolean("new_drops").default(true), // New resource drops
  carePings: boolean("care_pings").default(true), // Care team messages
  streakWarnings: boolean("streak_warnings").default(true), // Streak about to expire
  spotlightAlerts: boolean("spotlight_alerts").default(true), // Your content was spotlighted
  vaultReactions: boolean("vault_reactions").default(true), // Reactions on your confessions
  checkInReminders: boolean("check_in_reminders").default(true), // Daily check-in reminders
  credMilestones: boolean("cred_milestones").default(true), // CRED milestone achievements
  // Quiet hours
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false),
  quietHoursStart: text("quiet_hours_start").default("22:00"), // HH:MM format
  quietHoursEnd: text("quiet_hours_end").default("08:00"), // HH:MM format
  // Meta
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;

// Notification log - Track sent notifications
export const notificationLog = pgTable("notification_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Notification content
  title: text("title").notNull(),
  body: text("body").notNull(),
  notificationType: text("notification_type").notNull(), // drop, care_ping, streak, spotlight, reaction, checkin, cred
  // Delivery status
  status: text("status").default("pending").notNull(), // pending, sent, delivered, failed, read
  expoReceiptId: text("expo_receipt_id"), // For tracking delivery
  // Associated content
  contentType: text("content_type"), // drop, confession, referral, etc.
  contentId: varchar("content_id"),
  // Meta
  sentAt: timestamp("sent_at"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationLogSchema = createInsertSchema(notificationLog).omit({ id: true, createdAt: true });
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLog.$inferSelect;

// Notification types
export const NOTIFICATION_TYPES = [
  'drop', 'care_ping', 'streak_warning', 'spotlight', 
  'vault_reaction', 'checkin_reminder', 'cred_milestone'
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

// ============================================
// INVITE SYSTEM & MEMBERSHIP CARDS
// ============================================

// Invite requests - People requesting access to SAINTE
export const inviteRequests = pgTable("invite_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Contact info
  phone: text("phone"), // Primary - for SMS delivery
  email: text("email"), // Secondary
  name: text("name"),
  // Source tracking
  source: text("source").default("organic"), // organic, event, referral, qr_scan
  sourceEventId: varchar("source_event_id"), // If from an event
  referredBy: varchar("referred_by"), // User ID if referred
  // Request state
  status: text("status").default("pending").notNull(), // pending, approved, code_sent, claimed, rejected
  priority: integer("priority").default(0), // Higher = faster approval
  // Analytics
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  // Meta
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const insertInviteRequestSchema = createInsertSchema(inviteRequests).omit({ 
  id: true, createdAt: true, processedAt: true 
});
export type InsertInviteRequest = z.infer<typeof insertInviteRequestSchema>;
export type InviteRequest = typeof inviteRequests.$inferSelect;

// Invite codes - Time-limited codes sent via SMS/email
export const inviteCodes = pgTable("invite_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").references(() => inviteRequests.id),
  // The code itself (hashed for security)
  code: varchar("code", { length: 8 }).notNull().unique(), // Display code: "SAINTE-XXXX"
  codeHash: text("code_hash").notNull(), // SHA-256 hash for verification
  // Delivery
  deliveryMethod: text("delivery_method").default("sms").notNull(), // sms, email, both
  deliveredAt: timestamp("delivered_at"),
  // Usage limits
  expiresAt: timestamp("expires_at").notNull(),
  maxAttempts: integer("max_attempts").default(3),
  attemptCount: integer("attempt_count").default(0),
  // State
  status: text("status").default("active").notNull(), // active, claimed, expired, revoked
  claimedAt: timestamp("claimed_at"),
  claimedByUserId: varchar("claimed_by_user_id").references(() => users.id, { onDelete: "cascade" }),
  // Meta
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInviteCodeSchema = createInsertSchema(inviteCodes).omit({ 
  id: true, createdAt: true, claimedAt: true 
});
export type InsertInviteCode = z.infer<typeof insertInviteCodeSchema>;
export type InviteCode = typeof inviteCodes.$inferSelect;

// Membership keys - The actual "membership card" data
export const membershipKeys = pgTable("membership_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  // Visual display
  serialNumber: varchar("serial_number", { length: 16 }).notNull().unique(), // "STE-2024-XXXXX"
  memberSince: timestamp("member_since").defaultNow().notNull(),
  // Security token for QR codes (rotates periodically)
  accessToken: text("access_token").notNull(), // JWT or signed token
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  // Card tier/status (for visual styling)
  tier: text("tier").default("member").notNull(), // member, vip, icon, founder
  cardDesign: text("card_design").default("obsidian"), // obsidian, chrome, crimson, gold
  // Usage tracking
  lastUsedAt: timestamp("last_used_at"),
  totalCheckins: integer("total_checkins").default(0),
  // State
  isActive: boolean("is_active").default(true),
  suspendedReason: text("suspended_reason"),
  // Meta
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMembershipKeySchema = createInsertSchema(membershipKeys).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertMembershipKey = z.infer<typeof insertMembershipKeySchema>;
export type MembershipKey = typeof membershipKeys.$inferSelect;

// Membership tiers and card designs
export const MEMBERSHIP_TIERS = ['member', 'vip', 'icon', 'founder'] as const;
export type MembershipTier = typeof MEMBERSHIP_TIERS[number];
export const CARD_DESIGNS = ['obsidian', 'chrome', 'crimson', 'gold'] as const;
export type CardDesign = typeof CARD_DESIGNS[number];

// Events - SAINTE-hosted events that require membership check-in
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Basic info
  title: text("title").notNull(),
  description: text("description"),
  venue: text("venue"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  // Timing
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  doorsOpenAt: timestamp("doors_open_at"),
  // Capacity
  maxCapacity: integer("max_capacity"),
  rsvpCount: integer("rsvp_count").default(0),
  checkinCount: integer("checkin_count").default(0),
  // Access control
  requiresMembership: boolean("requires_membership").default(true),
  minimumTier: text("minimum_tier").default("member"), // member, vip, icon, founder
  minimumCred: integer("minimum_cred").default(0),
  // Visuals
  coverImageUrl: text("cover_image_url"),
  // Status
  status: text("status").default("upcoming").notNull(), // draft, upcoming, active, completed, cancelled
  // CRED rewards for attendance
  checkinCredReward: integer("checkin_cred_reward").default(50),
  // Meta
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEventSchema = createInsertSchema(events).omit({ 
  id: true, createdAt: true, updatedAt: true, rsvpCount: true, checkinCount: true 
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Event RSVPs
export const eventRsvps = pgTable("event_rsvps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // RSVP status
  status: text("status").default("confirmed").notNull(), // confirmed, waitlist, cancelled
  // Plus ones
  guestCount: integer("guest_count").default(0),
  guestNames: text("guest_names"), // Comma-separated or JSON
  // Meta
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEventRsvpSchema = createInsertSchema(eventRsvps).omit({ id: true, createdAt: true });
export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;
export type EventRsvp = typeof eventRsvps.$inferSelect;

// Event check-ins - Records of who checked in at events
export const eventCheckins = pgTable("event_checkins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  membershipKeyId: varchar("membership_key_id").references(() => membershipKeys.id, { onDelete: "set null" }),
  // Check-in details
  checkedInAt: timestamp("checked_in_at").defaultNow().notNull(),
  checkedInBy: varchar("checked_in_by").references(() => users.id, { onDelete: "cascade" }), // Staff who scanned
  // Method
  method: text("method").default("qr_scan").notNull(), // qr_scan, manual, nfc
  // Location data (for fraud prevention)
  latitude: real("latitude"),
  longitude: real("longitude"),
  // CRED awarded
  credAwarded: integer("cred_awarded"),
  // Guests
  guestCount: integer("guest_count").default(0),
  // Notes
  notes: text("notes"),
});

export const insertEventCheckinSchema = createInsertSchema(eventCheckins).omit({ 
  id: true, checkedInAt: true 
});
export type InsertEventCheckin = z.infer<typeof insertEventCheckinSchema>;
export type EventCheckin = typeof eventCheckins.$inferSelect;

// ============================================
// MASTERMIND NETWORK HUB
// ============================================

export const MASTERMIND_ROLES = [
  "builder",
  "connector",
  "strategist",
  "operator",
  "mentor",
  "opportunity_spotter",
  "creative_thinker",
  "pattern_breaker",
  "closer",
] as const;
export type MastermindRole = typeof MASTERMIND_ROLES[number];

export const MASTERMIND_PATHWAYS = [
  "tech",
  "entrepreneurship",
  "trades",
  "small_business",
  "creative",
  "career_growth",
  "education",
  "financial",
  "community",
  "career_change",
] as const;
export type MastermindPathway = typeof MASTERMIND_PATHWAYS[number];

export const MASTERMIND_POST_KINDS = ["signal", "exchange", "activate"] as const;
export type MastermindPostKind = typeof MASTERMIND_POST_KINDS[number];

export const MASTERMIND_RESPONSE_KINDS = [
  "intro",
  "insight",
  "resource",
  "encourage",
  "volunteer",
] as const;
export type MastermindResponseKind = typeof MASTERMIND_RESPONSE_KINDS[number];

export const MASTERMIND_POST_POINTS: Record<MastermindPostKind, number> = {
  signal: 5,
  exchange: 15,
  activate: 8,
};

export const MASTERMIND_RESPONSE_POINTS: Record<MastermindResponseKind, number> = {
  intro: 20,
  insight: 10,
  resource: 10,
  encourage: 3,
  volunteer: 15,
};

// One circle per user (the user is the owner / center of the orbit).
export const mastermindCircles = pgTable("mastermind_circles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  trajectory: text("trajectory"), // 12-month direction
  constraintNow: text("constraint_now"), // current constraint
  successDef: text("success_def"), // what success looks like
  pathway: text("pathway").default("entrepreneurship").notNull(),
  momentumScore: integer("momentum_score").default(0).notNull(),
  chemistry: text("chemistry").default("forming").notNull(), // forming, steady, strong, electric
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMastermindCircleSchema = createInsertSchema(mastermindCircles).omit({
  id: true, createdAt: true, updatedAt: true, momentumScore: true, chemistry: true,
});
export type InsertMastermindCircle = z.infer<typeof insertMastermindCircleSchema>;
export type MastermindCircle = typeof mastermindCircles.$inferSelect;

// Each seat is one role bubble in the orbit. memberUserId NULL = empty seat.
export const mastermindSeats = pgTable("mastermind_seats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  circleId: varchar("circle_id").notNull().references(() => mastermindCircles.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // MastermindRole
  memberUserId: varchar("member_user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"), // why they are in your circle
  strength: text("strength"), // strength they contribute
  positionIndex: integer("position_index").default(0).notNull(),
  contributionScore: integer("contribution_score").default(0).notNull(),
  gravity: text("gravity").default("quiet").notNull(), // quiet, rising, high
  lastInteractionAt: timestamp("last_interaction_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMastermindSeatSchema = createInsertSchema(mastermindSeats).omit({
  id: true, createdAt: true, contributionScore: true, gravity: true, lastInteractionAt: true,
});
export type InsertMastermindSeat = z.infer<typeof insertMastermindSeatSchema>;
export type MastermindSeat = typeof mastermindSeats.$inferSelect;

// Signal / Exchange / Activate posts in the circle feed.
export const mastermindPosts = pgTable("mastermind_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  circleId: varchar("circle_id").notNull().references(() => mastermindCircles.id, { onDelete: "cascade" }),
  authorUserId: varchar("author_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // MastermindPostKind
  body: text("body").notNull(),
  targetUserId: varchar("target_user_id").references(() => users.id, { onDelete: "set null" }),
  points: integer("points").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMastermindPostSchema = createInsertSchema(mastermindPosts).omit({
  id: true, createdAt: true, points: true,
});
export type InsertMastermindPost = z.infer<typeof insertMastermindPostSchema>;
export type MastermindPost = typeof mastermindPosts.$inferSelect;

// Structured responses on posts.
export const mastermindResponses = pgTable("mastermind_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => mastermindPosts.id, { onDelete: "cascade" }),
  responderUserId: varchar("responder_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // MastermindResponseKind
  body: text("body"),
  points: integer("points").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMastermindResponseSchema = createInsertSchema(mastermindResponses).omit({
  id: true, createdAt: true, points: true,
});
export type InsertMastermindResponse = z.infer<typeof insertMastermindResponseSchema>;
export type MastermindResponse = typeof mastermindResponses.$inferSelect;
