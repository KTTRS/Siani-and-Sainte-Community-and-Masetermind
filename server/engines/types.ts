/**
 * SIANI Intelligence Engine Types
 * 
 * From "In Depth System Information" documentation:
 * - 10 Core Intelligence Engines
 * - Trait-Building Engines
 * - Voice-First Systems
 * - Specialized Systems
 */

// ============================================
// CORE STATE TYPES
// ============================================

export interface UserState {
  emotionalState: EmotionalState;
  cognitiveState: CognitiveState;
  behavioralState: BehavioralState;
  identityState: IdentityState;
  socialState: SocialState;
  safetyState: SafetyState;
}

export interface EmotionalState {
  dominantEmotion: string | null;
  overallSentiment: number; // -100 to 100
  arousalLevel: number; // 0 to 100
  emotionalMomentum: "rising" | "stable" | "falling" | "volatile";
  saturationLevel: number; // 0 to 100, when full user can't process more
  emotionalArc: "rise" | "peak" | "sustain" | "collapse" | "resolve";
  isDistressed: boolean;
  isShutdown: boolean;
  isDissociating: boolean;
}

export interface CognitiveState {
  clarity: number; // 0 to 100
  cognitiveLoad: "low" | "moderate" | "high" | "overwhelmed";
  activeDistortions: CognitiveDistortion[];
  decisionCapacity: number; // 0 to 100
  isFoggy: boolean;
}

export interface BehavioralState {
  survivalMode: boolean;
  agencyLevel: number; // 0 to 100
  avoidancePattern: AvoidancePattern | null;
  followThroughCapacity: number; // 0 to 100
  loopState: "offered" | "accepted" | "stalled" | "resolved" | "failed" | null;
}

export interface IdentityState {
  selfTrust: number; // 0 to 100
  identityCoherence: number; // 0 to 100
  activeIdentityTensions: string[];
  needsRepair: boolean;
  expansionReady: boolean;
}

export interface SocialState {
  powerDynamicsConcern: boolean;
  manipulationRisk: boolean;
  socialThreatLevel: number; // 0 to 100
  isolationLevel: number; // 0 to 100
  communicationStyle: "direct" | "indirect" | "guarded" | "open";
}

export interface SafetyState {
  tier: "T0_stable" | "T1_concern" | "T2_risk" | "T3_critical";
  distressLevel: number; // 0 to 100
  escalationRisk: boolean;
  needsGrounding: boolean;
  needsContainment: boolean;
  enterpriseRouteRequired: boolean;
}

// ============================================
// ENGINE DEFINITIONS
// ============================================

export type AttunementMode = 
  | "mirror"      // Reflects emotional truth, creates recognition
  | "stabilize"   // Reduces intensity, slows down, creates safety
  | "activate"    // Pushes gently, creates momentum, amplifies agency
  | "elevate"     // Identity reinforcement, pride + self-belief
  | "challenge"   // Calls out distortions, disrupts self-limiting loops
  | "contain";    // Holds emotional overflow, prevents panic escalation

export interface AttunementOutput {
  mode: AttunementMode;
  nextEngine: EngineType;
  toneModulation: ToneModulation;
  pacingModulation: PacingModulation;
  intensity: number; // 0 to 100
}

export type EngineType =
  // Core Engines (Sections 6-17)
  | "attunement"
  | "insight"
  | "pattern"
  | "identity"
  | "narrative"
  | "emotional"
  | "cognitive"
  | "behavioral"
  | "social"
  | "safety"
  | "truth"
  | "meta"
  // Trait-Building Engines (Sections 18-24)
  | "resilience"
  | "grit"
  | "adaptability"
  | "courage"
  | "endurance"
  | "future_pull"
  // Specialized Systems
  | "grounding"
  | "relief"
  | "shame_buffer"
  | "dopamine"
  | "rhythm"
  | "capacity";

export interface ToneModulation {
  warmth: number; // 0 to 100
  directness: number; // 0 to 100
  groundedness: number; // 0 to 100
  energy: number; // 0 to 100
  shouldBeGentle: boolean;
}

export interface PacingModulation {
  speed: "slow" | "measured" | "normal" | "energized";
  breathingCoded: boolean;
  silenceComfort: number; // 0 to 100
  sentenceLength: "short" | "medium" | "flowing";
}

// ============================================
// COGNITIVE DISTORTIONS
// ============================================

export type CognitiveDistortion =
  | "catastrophizing"        // Expecting the worst
  | "black_white_thinking"   // All-or-nothing
  | "mind_reading"           // Assuming others' thoughts
  | "fortune_telling"        // Predicting negative outcomes
  | "personalization"        // Taking everything personally
  | "emotional_reasoning"    // Feelings = facts
  | "should_statements"      // Rigid expectations
  | "labeling"              // Self as fixed identity
  | "discounting_positive"  // Ignoring good things
  | "magnification";        // Making things bigger

// ============================================
// AVOIDANCE PATTERNS
// ============================================

export type AvoidancePattern =
  | "deflection"       // Changing subject
  | "procrastination"  // Delaying action
  | "emotional_escape" // Numbing/avoiding feelings
  | "internalized_fear" // Frozen by fear
  | "cognitive_fog";   // Can't think clearly

// ============================================
// INSIGHT TYPES
// ============================================

export interface InsightPacket {
  type: InsightType;
  content: string;
  confidence: number;
  shouldSurface: boolean; // Whether to share with user
  timing: "immediate" | "when_ready" | "store_for_later";
}

export type InsightType =
  | "emotional"          // Understanding of feeling
  | "narrative"          // Story being told
  | "identity"           // Who they are/becoming
  | "behavioral"         // Pattern in actions
  | "motivational"       // What drives them
  | "cognitive_distortion" // Thinking pattern
  | "shame_origin"       // Where shame comes from
  | "survival_mode"      // Why they're protecting themselves
  | "pattern";           // Recurring theme

// ============================================
// SIGNAL TYPES (SAFETY DETECTION)
// ============================================

export interface Signal {
  type: SignalType;
  severity: 1 | 2 | 3 | 4 | 5; // 1 = low, 5 = critical
  confidence: number; // 0 to 100
  triggerText?: string;
  requiresEnterpriseRoute: boolean;
}

export type SignalType =
  | "crisis"         // Safety concerns, self-harm mentions
  | "distress"       // Elevated emotional pain
  | "isolation"      // Social disconnection
  | "hopelessness"   // Loss of motivation
  | "panic"          // Acute anxiety/panic
  | "shame_collapse" // Deep shame spiral
  | "fatigue"        // Emotional exhaustion
  | "dissociation"   // Disconnecting from reality
  | "overwhelm"      // Can't process anymore
  | "shutdown";      // Emotional/cognitive shutdown

// ============================================
// PROSODY ANALYSIS (FROM VOICE)
// ============================================

export interface ProsodyAnalysis {
  pace: "slow" | "normal" | "fast" | "rushed";
  pitch: "low" | "normal" | "high" | "variable";
  energy: "depleted" | "low" | "normal" | "high" | "manic";
  breathPattern: "shallow" | "normal" | "deep" | "irregular";
  hesitationLevel: number; // 0 to 100
  emotionalLeakage: string[]; // Emotions detected in voice
  stressMarkers: number; // 0 to 100
}

// ============================================
// RESPONSE GENERATION
// ============================================

export interface SianiResponseContext {
  userState: UserState;
  prosody?: ProsodyAnalysis;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  activeEngines: EngineType[];
  attunementMode: AttunementMode;
  toneModulation: ToneModulation;
  pacingModulation: PacingModulation;
  insights: InsightPacket[];
  signals: Signal[];
}

export interface ResponseStrategy {
  primaryEngine: EngineType;
  supportingEngines: EngineType[];
  attunementMode: AttunementMode;
  responseGoal: string;
  constraints: string[];
  forbidden: string[];
  voiceCharacteristics: VoiceCharacteristics;
}

export interface VoiceCharacteristics {
  voice: "nova" | "onyx" | "shimmer";
  speed: number; // 0.25 to 4.0
  emotionalTone: string;
}

// ============================================
// SHAME BUFFERING SYSTEM
// ============================================

export interface ShameBufferState {
  shameDetected: boolean;
  shameMarkers: string[];
  deactivationMoves: ShameDeactivationMove[];
}

export type ShameDeactivationMove =
  | "truth_reframing"      // Reframe the truth without blame
  | "normalization"        // "This is common"
  | "identity_reminder"    // "This isn't who you are"
  | "belonging_cue"        // "You're not alone in this"
  | "soft_directness"      // Direct but gentle
  | "validation";          // "You're not wrong for this"

// ============================================
// LOOP TRACKING
// ============================================

export interface LoopState {
  id: string;
  type: "goal" | "referral" | "task" | "emotional";
  status: "offered" | "accepted" | "stalled" | "resolved" | "failed";
  createdAt: Date;
  lastUpdated: Date;
  stallCount: number;
  resolution?: string;
}

// ============================================
// ENGINE OUTPUT
// ============================================

export interface EngineOutput {
  engine: EngineType;
  analysis: Record<string, unknown>;
  recommendations: string[];
  nextEngines: EngineType[];
  responseModifiers: {
    toneShift?: Partial<ToneModulation>;
    pacingShift?: Partial<PacingModulation>;
    contentFocus?: string[];
    forbidden?: string[];
  };
}
