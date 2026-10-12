/**
 * Conversation Memory Service
 * 
 * Provides cross-session memory persistence for Siani's relational intelligence.
 * Stores and retrieves:
 * - User patterns and preferences
 * - Important life events mentioned
 * - Goals and moves mentioned
 * - Emotional trends over time
 * - Key relationships and names mentioned
 */

import { storage } from "../storage";

type MemoryType =
  | "safety"
  | "identity"
  | "goal"
  | "person"
  | "event"
  | "preference"
  | "pattern"
  | "insight";

interface MemoryEntry {
  type: MemoryType;
  content: string;
  confidence: number;
  timestamp: Date;
  source: "conversation" | "extracted" | "observed";
  /** 0-100. Computed from type + confidence. Used for eviction priority. */
  importance: number;
}

/**
 * Importance hierarchy from the playbook:
 *   safety   — crisis indicators, self-harm hints, safe-housing status
 *   identity — names they call themselves, recovery identity, "I am" statements
 *   goal     — what they're working on (Bag items, moves)
 *   person   — relationships ("my mom", "my caseworker Marie")
 *   event    — life events ("got the job", "lost the apartment")
 *   preference — comms preferences, what calms them, what triggers them
 *   pattern  — recurring behavioral / emotional loops
 *   insight  — observed truths Siani noticed across turns
 *
 * When the cap is reached we evict LOWEST importance first (then oldest of
 * a tie). This used to be pure FIFO — which dropped safety + identity
 * memories the moment chitchat filled the buffer.
 */
const TYPE_IMPORTANCE: Record<MemoryType, number> = {
  safety: 100,
  identity: 90,
  goal: 75,
  person: 60,
  event: 55,
  preference: 45,
  pattern: 35,
  insight: 30,
};

/** Cap kept high enough to cover ~50 turns of useful detail. */
/**
 * Maximum number of memory items retained per user before importance-based
 * eviction kicks in. Configurable via `SIANI_MEMORY_CAP` so the cap can be
 * raised in research/replay environments and tightened in low-resource
 * deployments without a code change. Defaults to 80, the value the engines
 * were tuned against.
 */
const MEMORY_CAP = (() => {
  const raw = process.env.SIANI_MEMORY_CAP;
  if (!raw) return 80;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 10) {
    console.warn(
      `[conversationMemory] ignoring invalid SIANI_MEMORY_CAP="${raw}" — using default 80`
    );
    return 80;
  }
  return parsed;
})();

function scoreImportance(
  type: MemoryType,
  confidence: number
): number {
  // Weighted blend: type ceiling dominates, confidence nudges within band.
  const base = TYPE_IMPORTANCE[type] ?? 30;
  const conf = Math.max(0, Math.min(100, confidence));
  return Math.round(base * 0.7 + conf * 0.3);
}

function attachImportance(entry: Omit<MemoryEntry, "importance">): MemoryEntry {
  return { ...entry, importance: scoreImportance(entry.type, entry.confidence) };
}

interface ConversationContext {
  userId: string;
  conversationId?: string;
  memories: MemoryEntry[];
  recentTopics: string[];
  emotionalTrend: "improving" | "stable" | "declining" | "volatile";
  lastInteraction: Date;
  totalInteractions: number;
}

// In-memory cache for quick access
const memoryCache = new Map<string, ConversationContext>();

export async function getConversationContext(userId: string): Promise<ConversationContext> {
  // Check cache first
  if (memoryCache.has(userId)) {
    return memoryCache.get(userId)!;
  }

  // Load from database
  try {
    const conversations = await storage.getConversationsByUser(userId, 10);
    const memories: MemoryEntry[] = [];
    const recentTopics: string[] = [];
    
    // Extract memories from recent conversations
    for (const conv of conversations) {
      const messages = await storage.getMessagesByConversation(conv.id, 50);
      
      // Extract goals mentioned
      for (const msg of messages) {
        if (msg.role === "user") {
          // Safety signals first — these must survive eviction.
          const safetyMatches = extractSafetyMentions(msg.content);
          safetyMatches.forEach((s) => {
            memories.push(
              attachImportance({
                type: "safety",
                content: s,
                confidence: 90,
                timestamp: new Date(msg.createdAt),
                source: "extracted",
              })
            );
          });

          // Identity statements ("I'm a recovering / I'm a mom / I'm trying to be…")
          const identityMatches = extractIdentityMentions(msg.content);
          identityMatches.forEach((i) => {
            memories.push(
              attachImportance({
                type: "identity",
                content: i,
                confidence: 80,
                timestamp: new Date(msg.createdAt),
                source: "extracted",
              })
            );
          });

          const goalMatches = extractGoalMentions(msg.content);
          goalMatches.forEach(goal => {
            memories.push(
              attachImportance({
                type: "goal",
                content: goal,
                confidence: 70,
                timestamp: new Date(msg.createdAt),
                source: "extracted",
              })
            );
          });

          // Extract people mentioned
          const personMatches = extractPersonMentions(msg.content);
          personMatches.forEach(person => {
            memories.push(
              attachImportance({
                type: "person",
                content: person,
                confidence: 60,
                timestamp: new Date(msg.createdAt),
                source: "extracted",
              })
            );
          });
          
          // Extract recent topics
          const topicMatches = extractTopics(msg.content);
          topicMatches.forEach(topic => {
            if (!recentTopics.includes(topic)) {
              recentTopics.push(topic);
            }
          });
        }
      }
    }
    
    // Get user's goals from storage
    const goals = await storage.getGoalsByUser(userId, 20);
    goals.forEach(goal => {
      memories.push(
        attachImportance({
          type: "goal",
          content: goal.title,
          confidence: 100,
          timestamp: new Date(goal.createdAt),
          source: "observed",
        })
      );
    });
    
    const context: ConversationContext = {
      userId,
      memories: deduplicateMemories(memories),
      recentTopics: recentTopics.slice(0, 10),
      emotionalTrend: "stable",
      lastInteraction: new Date(),
      totalInteractions: conversations.length,
    };
    
    memoryCache.set(userId, context);
    return context;
  } catch (error) {
    console.error("Error loading conversation context:", error);
    return {
      userId,
      memories: [],
      recentTopics: [],
      emotionalTrend: "stable",
      lastInteraction: new Date(),
      totalInteractions: 0,
    };
  }
}

export async function updateConversationContext(
  userId: string,
  newMessage: string,
  detectedGoals?: string[],
  emotionalState?: { sentiment: number; arousal: number }
): Promise<void> {
  const context = await getConversationContext(userId);
  
  // Update last interaction
  context.lastInteraction = new Date();
  context.totalInteractions++;
  
  // Add new goal memories
  if (detectedGoals) {
    detectedGoals.forEach(goal => {
      context.memories.push(
        attachImportance({
          type: "goal",
          content: goal,
          confidence: 85,
          timestamp: new Date(),
          source: "extracted",
        })
      );
    });
  }

  // Pull safety + identity from THIS message — same extractors as cold-load.
  extractSafetyMentions(newMessage).forEach((s) => {
    context.memories.push(
      attachImportance({
        type: "safety",
        content: s,
        confidence: 90,
        timestamp: new Date(),
        source: "extracted",
      })
    );
  });
  extractIdentityMentions(newMessage).forEach((i) => {
    context.memories.push(
      attachImportance({
        type: "identity",
        content: i,
        confidence: 80,
        timestamp: new Date(),
        source: "extracted",
      })
    );
  });
  
  // Extract and add new topics
  const topics = extractTopics(newMessage);
  topics.forEach(topic => {
    if (!context.recentTopics.includes(topic)) {
      context.recentTopics.unshift(topic);
      if (context.recentTopics.length > 10) {
        context.recentTopics.pop();
      }
    }
  });
  
  // Update emotional trend based on recent states
  if (emotionalState) {
    updateEmotionalTrend(context, emotionalState.sentiment);
  }
  
  // Deduplicate memories
  context.memories = deduplicateMemories(context.memories);

  // Importance-aware eviction (was FIFO).
  //
  // Sort by importance DESC, then timestamp DESC. Trim to MEMORY_CAP. This
  // means a stack of low-value chitchat ("recent topics: work, work, work")
  // will never push out a single safety or identity memory.
  if (context.memories.length > MEMORY_CAP) {
    context.memories = context.memories
      .sort((a, b) => {
        if (b.importance !== a.importance) return b.importance - a.importance;
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
      .slice(0, MEMORY_CAP);
  }
  
  memoryCache.set(userId, context);
}

export function buildContextPrompt(context: ConversationContext): string {
  if (context.memories.length === 0 && context.recentTopics.length === 0) {
    return "";
  }
  
  let prompt = "\n## What You Remember About Them\n";

  // Safety + identity FIRST so the model sees them even if the rest gets
  // truncated downstream.
  const safety = context.memories.filter((m) => m.type === "safety");
  if (safety.length > 0) {
    prompt += `**Safety context (treat carefully)**: ${safety
      .slice(0, 3)
      .map((s) => s.content)
      .join("; ")}\n`;
  }
  const identity = context.memories.filter((m) => m.type === "identity");
  if (identity.length > 0) {
    prompt += `**How they identify**: ${identity
      .slice(0, 3)
      .map((i) => i.content)
      .join("; ")}\n`;
  }

  // Goals they're working on
  const goals = context.memories.filter(m => m.type === "goal");
  if (goals.length > 0) {
    prompt += `**Their current moves/goals**: ${goals.slice(0, 5).map(g => g.content).join(", ")}\n`;
  }
  
  // People they've mentioned
  const people = context.memories.filter(m => m.type === "person");
  if (people.length > 0) {
    prompt += `**People in their life**: ${people.slice(0, 5).map(p => p.content).join(", ")}\n`;
  }
  
  // Recent topics
  if (context.recentTopics.length > 0) {
    prompt += `**Recent topics**: ${context.recentTopics.slice(0, 5).join(", ")}\n`;
  }
  
  // Emotional trend
  if (context.emotionalTrend !== "stable") {
    prompt += `**Emotional trend**: Their mood has been ${context.emotionalTrend} recently\n`;
  }
  
  // Relationship context
  if (context.totalInteractions > 5) {
    prompt += `**History**: You've had ${context.totalInteractions} conversations - you know them well\n`;
  }
  
  return prompt;
}

// Helper functions
/**
 * Crisis / safety markers — anything we can't afford to forget. Conservative
 * regex on purpose; false positives go to a separate signal flow, not here.
 */
export function extractSafetyMentions(text: string): string[] {
  const hits: string[] = [];
  const patterns: { pattern: RegExp; label: string }[] = [
    { pattern: /\b(suicid|kill myself|end (it|my life)|want to die|don'?t want to be here)\b/i, label: "self-harm signal mentioned" },
    { pattern: /\b(abus|hit me|hurt me|threaten)\b/i, label: "harm-from-other mentioned" },
    { pattern: /\b(homeless|nowhere to (sleep|stay)|sleeping in (my )?car|on the streets?)\b/i, label: "unstable housing" },
    { pattern: /\b(haven'?t eaten|no food|hungry for days)\b/i, label: "food insecurity" },
    { pattern: /\b(relapse[sd]?|using again|picked up again)\b/i, label: "substance relapse mentioned" },
  ];
  patterns.forEach(({ pattern, label }) => {
    if (pattern.test(text)) hits.push(label);
  });
  return hits;
}

/**
 * Identity statements — "I am / I'm a / I'm trying to be" — the way someone
 * names themselves is foundational to attunement, so it's never evicted.
 */
export function extractIdentityMentions(text: string): string[] {
  const hits: string[] = [];
  const re = /\bi['']?m (?:a |an |the )?(recovering|sober|clean|trying|a (?:mom|mother|dad|father|veteran|survivor|christian|muslim|atheist)|(?:in recovery|in school|in treatment|in transition))\b[^.!?]{0,40}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const phrase = m[0].trim();
    if (phrase.length >= 6 && phrase.length <= 80) hits.push(phrase);
  }
  return hits;
}

function extractGoalMentions(text: string): string[] {
  const goals: string[] = [];
  const patterns = [
    /i want to ([^.!?]+)/gi,
    /i wanna ([^.!?]+)/gi,
    /i need to ([^.!?]+)/gi,
    /i'm trying to ([^.!?]+)/gi,
    /i'm gonna ([^.!?]+)/gi,
    /my goal is ([^.!?]+)/gi,
    /working on ([^.!?]+)/gi,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const goal = match[1].trim();
      if (goal.length > 5 && goal.length < 100) {
        goals.push(goal);
      }
    }
  });
  
  return goals;
}

function extractPersonMentions(text: string): string[] {
  const people: string[] = [];
  const patterns = [
    /my (?:mom|mother|dad|father|sister|brother|friend|partner|boyfriend|girlfriend|husband|wife|boss|coworker)/gi,
    /(?:mom|mother|dad|father|sister|brother|friend|partner|boyfriend|girlfriend|husband|wife|boss|coworker) (\w+)/gi,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      people.push(match[0].trim());
    }
  });
  
  return people;
}

function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const topicPatterns = [
    { pattern: /\b(job|work|career|boss|office|interview)\b/i, topic: "work" },
    { pattern: /\b(relationship|dating|partner|love|breakup)\b/i, topic: "relationships" },
    { pattern: /\b(money|bills|rent|debt|savings|broke)\b/i, topic: "finances" },
    { pattern: /\b(health|doctor|medication|sick|anxiety|depression)\b/i, topic: "health" },
    { pattern: /\b(family|mom|dad|parents|kids|children)\b/i, topic: "family" },
    { pattern: /\b(school|class|studying|exam|degree)\b/i, topic: "education" },
    { pattern: /\b(moving|apartment|housing|homeless|rent)\b/i, topic: "housing" },
  ];
  
  topicPatterns.forEach(({ pattern, topic }) => {
    if (pattern.test(text)) {
      topics.push(topic);
    }
  });
  
  return topics;
}

function deduplicateMemories(memories: MemoryEntry[]): MemoryEntry[] {
  const seen = new Map<string, MemoryEntry>();

  memories.forEach(memory => {
    // Self-heal: legacy entries loaded before importance existed (e.g. older
    // cache entries) get scored on the way through.
    const m: MemoryEntry =
      typeof memory.importance === "number"
        ? memory
        : { ...memory, importance: scoreImportance(memory.type, memory.confidence) };
    const key = `${m.type}:${m.content.toLowerCase()}`;
    const existing = seen.get(key);
    // Keep the entry with higher importance, or higher confidence on a tie.
    if (
      !existing ||
      m.importance > existing.importance ||
      (m.importance === existing.importance && m.confidence > existing.confidence)
    ) {
      seen.set(key, m);
    }
  });

  return Array.from(seen.values());
}

function updateEmotionalTrend(context: ConversationContext, sentiment: number): void {
  // Simple trend calculation - could be made more sophisticated
  // Positive sentiment > 30 = improving
  // Negative sentiment < -30 = declining
  // High variance = volatile
  if (sentiment > 30) {
    context.emotionalTrend = "improving";
  } else if (sentiment < -30) {
    context.emotionalTrend = "declining";
  } else {
    context.emotionalTrend = "stable";
  }
}

export function clearCache(userId?: string): void {
  if (userId) {
    memoryCache.delete(userId);
  } else {
    memoryCache.clear();
  }
}
