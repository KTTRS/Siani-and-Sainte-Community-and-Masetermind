/**
 * SIANI Core Intelligence Engines
 * 
 * Implements all core engines from "In Depth System Information" PDF:
 * - Attunement Engine (Section 6)
 * - Insight Engine (Section 7)
 * - Pattern Engine (Section 8)
 * - Identity Engine (Section 9)
 * - Narrative Engine (Section 10)
 * - Emotional Engine (Section 11)
 * - Cognitive Engine (Section 12)
 * - Behavioral Engine (Section 13)
 * - Social Intelligence Engine (Section 14)
 * - Safety + Stability Engine (Section 15)
 * - Truth + Consistency Engine (Section 16)
 * - Meta-Intelligence Engine (Section 17)
 */

import type {
  UserState,
  EmotionalState,
  CognitiveState,
  BehavioralState,
  IdentityState,
  SocialState,
  SafetyState,
  AttunementMode,
  AttunementOutput,
  EngineType,
  ToneModulation,
  PacingModulation,
  CognitiveDistortion,
  AvoidancePattern,
  InsightPacket,
  Signal,
  SignalType,
  ProsodyAnalysis,
  ShameBufferState,
  ShameDeactivationMove,
  EngineOutput,
} from "./types";

// ============================================
// ATTUNEMENT ENGINE (Section 6)
// The foundation of SIANI's relational intelligence
// ============================================

export function runAttunementEngine(
  userState: UserState,
  prosody?: ProsodyAnalysis
): AttunementOutput {
  // Determine attunement mode based on user state
  let mode: AttunementMode = "mirror";
  let nextEngine: EngineType = "emotional";
  let intensity = 50;

  // Safety first - if distressed, contain
  if (userState.safetyState.tier === "T3_critical") {
    mode = "contain";
    nextEngine = "safety";
    intensity = 30; // Low intensity, maximum safety
  } else if (userState.safetyState.tier === "T2_risk") {
    mode = "stabilize";
    nextEngine = "safety";
    intensity = 40;
  } else if (userState.safetyState.needsGrounding) {
    mode = "stabilize";
    nextEngine = "grounding";
    intensity = 35;
  }
  // Emotional saturation - need relief
  else if (userState.emotionalState.saturationLevel > 80) {
    mode = "contain";
    nextEngine = "relief";
    intensity = 30;
  }
  // Survival mode - stabilize first
  else if (userState.behavioralState.survivalMode) {
    mode = "stabilize";
    nextEngine = "behavioral";
    intensity = 40;
  }
  // Shame detected - buffer it
  else if (userState.emotionalState.isDistressed && userState.identityState.selfTrust < 30) {
    mode = "stabilize";
    nextEngine = "shame_buffer";
    intensity = 35;
  }
  // Low agency but stable - activate
  else if (userState.behavioralState.agencyLevel < 40 && !userState.emotionalState.isDistressed) {
    mode = "activate";
    nextEngine = "behavioral";
    intensity = 55;
  }
  // Identity repair needed
  else if (userState.identityState.needsRepair) {
    mode = "mirror";
    nextEngine = "identity";
    intensity = 50;
  }
  // Ready for growth
  else if (userState.identityState.expansionReady && userState.emotionalState.emotionalMomentum === "rising") {
    mode = "elevate";
    nextEngine = "identity";
    intensity = 65;
  }
  // Cognitive distortions active
  else if (userState.cognitiveState.activeDistortions.length > 0 && userState.emotionalState.arousalLevel < 60) {
    mode = "challenge";
    nextEngine = "cognitive";
    intensity = 55;
  }
  // Default: mirror and understand
  else {
    mode = "mirror";
    nextEngine = "emotional";
    intensity = 50;
  }

  // Calculate tone modulation based on mode
  const toneModulation = calculateToneModulation(mode, userState, prosody);
  const pacingModulation = calculatePacingModulation(mode, userState, prosody);

  return {
    mode,
    nextEngine,
    toneModulation,
    pacingModulation,
    intensity,
  };
}

function calculateToneModulation(
  mode: AttunementMode,
  userState: UserState,
  prosody?: ProsodyAnalysis
): ToneModulation {
  const base: ToneModulation = {
    warmth: 70,
    directness: 50,
    groundedness: 60,
    energy: 50,
    shouldBeGentle: false,
  };

  switch (mode) {
    case "contain":
      return { ...base, warmth: 85, directness: 30, groundedness: 90, energy: 25, shouldBeGentle: true };
    case "stabilize":
      return { ...base, warmth: 80, directness: 40, groundedness: 85, energy: 35, shouldBeGentle: true };
    case "mirror":
      return { ...base, warmth: 75, directness: 45, groundedness: 70, energy: 45, shouldBeGentle: false };
    case "activate":
      return { ...base, warmth: 65, directness: 60, groundedness: 65, energy: 65, shouldBeGentle: false };
    case "elevate":
      return { ...base, warmth: 70, directness: 55, groundedness: 60, energy: 70, shouldBeGentle: false };
    case "challenge":
      return { ...base, warmth: 60, directness: 70, groundedness: 75, energy: 55, shouldBeGentle: false };
  }
}

function calculatePacingModulation(
  mode: AttunementMode,
  userState: UserState,
  prosody?: ProsodyAnalysis
): PacingModulation {
  const base: PacingModulation = {
    speed: "normal",
    breathingCoded: false,
    silenceComfort: 50,
    sentenceLength: "medium",
  };

  switch (mode) {
    case "contain":
      return { speed: "slow", breathingCoded: true, silenceComfort: 80, sentenceLength: "short" };
    case "stabilize":
      return { speed: "slow", breathingCoded: true, silenceComfort: 70, sentenceLength: "short" };
    case "mirror":
      return { speed: "measured", breathingCoded: false, silenceComfort: 60, sentenceLength: "medium" };
    case "activate":
      return { speed: "normal", breathingCoded: false, silenceComfort: 40, sentenceLength: "medium" };
    case "elevate":
      return { speed: "energized", breathingCoded: false, silenceComfort: 35, sentenceLength: "flowing" };
    case "challenge":
      return { speed: "measured", breathingCoded: false, silenceComfort: 50, sentenceLength: "short" };
  }
}

// ============================================
// EMOTIONAL ENGINE (Section 11)
// ============================================

export function runEmotionalEngine(
  message: string,
  prosody?: ProsodyAnalysis
): EmotionalState {
  const lowerMessage = message.toLowerCase();

  // Emotion detection patterns
  const emotions = detectEmotions(lowerMessage);
  const arousal = calculateArousal(lowerMessage, prosody);
  const sentiment = calculateSentiment(lowerMessage);
  const saturation = calculateSaturation(lowerMessage, prosody);
  
  // Emotional arc detection
  const arc = detectEmotionalArc(lowerMessage, arousal);
  
  // Momentum detection
  const momentum = detectMomentum(lowerMessage, sentiment, arousal);

  // State flags
  const isDistressed = detectDistress(lowerMessage, arousal, sentiment);
  const isShutdown = detectShutdown(lowerMessage, prosody);
  const isDissociating = detectDissociation(lowerMessage, prosody);

  return {
    dominantEmotion: emotions[0] || null,
    overallSentiment: sentiment,
    arousalLevel: arousal,
    emotionalMomentum: momentum,
    saturationLevel: saturation,
    emotionalArc: arc,
    isDistressed,
    isShutdown,
    isDissociating,
  };
}

function detectEmotions(text: string): string[] {
  const emotions: string[] = [];
  
  // Anger cluster
  if (/\b(angry|furious|pissed|frustrated|annoyed|irritated|mad|enraged)\b/i.test(text)) {
    emotions.push("anger");
  }
  // Sadness cluster
  if (/\b(sad|depressed|down|low|blue|heartbroken|devastated|crying|tears)\b/i.test(text)) {
    emotions.push("sadness");
  }
  // Fear cluster
  if (/\b(scared|afraid|terrified|anxious|worried|nervous|panicking|freaking)\b/i.test(text)) {
    emotions.push("fear");
  }
  // Joy cluster
  if (/\b(happy|excited|thrilled|pumped|amazing|great|wonderful|blessed)\b/i.test(text)) {
    emotions.push("joy");
  }
  // Shame cluster
  if (/\b(ashamed|embarrassed|humiliated|stupid|worthless|failure|pathetic)\b/i.test(text)) {
    emotions.push("shame");
  }
  // Overwhelm cluster
  if (/\b(overwhelmed|too much|can't handle|drowning|buried|crushed)\b/i.test(text)) {
    emotions.push("overwhelm");
  }
  // Hopelessness cluster
  if (/\b(hopeless|pointless|nothing matters|give up|why bother|what's the point)\b/i.test(text)) {
    emotions.push("hopelessness");
  }
  // Exhaustion cluster
  if (/\b(tired|exhausted|drained|burnt out|running on empty|no energy)\b/i.test(text)) {
    emotions.push("exhaustion");
  }
  // Relief cluster
  if (/\b(relieved|finally|thank god|weight off|better now)\b/i.test(text)) {
    emotions.push("relief");
  }
  // Pride cluster
  if (/\b(proud|accomplished|did it|nailed it|killed it|crushed it)\b/i.test(text)) {
    emotions.push("pride");
  }

  return emotions;
}

function calculateArousal(text: string, prosody?: ProsodyAnalysis): number {
  let arousal = 50;

  // High arousal indicators
  const highArousal = /!{2,}|\?!|omg|oh my god|can't believe|freaking|what the|holy/gi;
  const highMatches = (text.match(highArousal) || []).length;
  arousal += highMatches * 10;

  // Low arousal indicators
  const lowArousal = /\b(tired|exhausted|numb|empty|flat|whatever|i guess|meh)\b/gi;
  const lowMatches = (text.match(lowArousal) || []).length;
  arousal -= lowMatches * 12;

  // Prosody adjustments
  if (prosody) {
    if (prosody.energy === "depleted") arousal -= 25;
    else if (prosody.energy === "low") arousal -= 15;
    else if (prosody.energy === "high") arousal += 15;
    else if (prosody.energy === "manic") arousal += 25;
  }

  return Math.max(0, Math.min(100, arousal));
}

function calculateSentiment(text: string): number {
  const positive = /\b(good|great|happy|love|amazing|wonderful|better|grateful|blessed|proud|excited)\b/gi;
  const negative = /\b(bad|hate|sad|angry|frustrated|worried|scared|anxious|hurt|terrible|awful|horrible)\b/gi;
  
  const posCount = (text.match(positive) || []).length;
  const negCount = (text.match(negative) || []).length;
  
  const total = posCount + negCount;
  if (total === 0) return 0;
  
  return Math.round(((posCount - negCount) / total) * 100);
}

function calculateSaturation(text: string, prosody?: ProsodyAnalysis): number {
  let saturation = 30;

  // Saturation indicators
  if (/\b(too much|can't handle|overwhelmed|drowning|can't process|head spinning)\b/i.test(text)) {
    saturation += 40;
  }
  if (/\b(need a break|step back|can't think|brain fog)\b/i.test(text)) {
    saturation += 25;
  }

  // Prosody adjustments
  if (prosody?.stressMarkers && prosody.stressMarkers > 70) {
    saturation += 20;
  }

  return Math.min(100, saturation);
}

function detectEmotionalArc(text: string, arousal: number): "rise" | "peak" | "sustain" | "collapse" | "resolve" {
  if (/\b(finally|at last|over now|done with|resolved|figured out)\b/i.test(text)) {
    return "resolve";
  }
  if (/\b(falling apart|breaking down|can't anymore|giving up|collapse)\b/i.test(text)) {
    return "collapse";
  }
  if (arousal > 80) {
    return "peak";
  }
  if (/\b(getting worse|building up|more and more|increasingly)\b/i.test(text)) {
    return "rise";
  }
  return "sustain";
}

function detectMomentum(text: string, sentiment: number, arousal: number): "rising" | "stable" | "falling" | "volatile" {
  if (/\b(up and down|all over|one minute|back and forth)\b/i.test(text)) {
    return "volatile";
  }
  if (sentiment > 30 && arousal > 50) {
    return "rising";
  }
  if (sentiment < -30 || arousal < 30) {
    return "falling";
  }
  return "stable";
}

function detectDistress(text: string, arousal: number, sentiment: number): boolean {
  const distressPatterns = /\b(overwhelmed|can't handle|too much|breaking down|falling apart|panicking|freaking out|scared|terrified)\b/i;
  return distressPatterns.test(text) || (arousal > 75 && sentiment < -40);
}

function detectShutdown(text: string, prosody?: ProsodyAnalysis): boolean {
  const shutdownPatterns = /\b(don't care|whatever|nothing matters|numb|empty|dead inside|checked out|done)\b/i;
  const isTextShutdown = shutdownPatterns.test(text);
  const isProsodyShutdown = prosody?.energy === "depleted" && prosody?.pace === "slow";
  return isTextShutdown || isProsodyShutdown === true;
}

function detectDissociation(text: string, prosody?: ProsodyAnalysis): boolean {
  const patterns = /\b(not real|floating|watching myself|out of body|disconnected|not here|fog)\b/i;
  return patterns.test(text);
}

// ============================================
// COGNITIVE ENGINE (Section 12)
// ============================================

export function runCognitiveEngine(message: string): CognitiveState {
  const lowerMessage = message.toLowerCase();

  const distortions = detectCognitiveDistortions(lowerMessage);
  const load = detectCognitiveLoad(lowerMessage);
  const clarity = calculateClarity(lowerMessage, load);
  const decisionCapacity = calculateDecisionCapacity(lowerMessage, clarity, load);
  const isFoggy = load === "overwhelmed" || clarity < 30;

  return {
    clarity,
    cognitiveLoad: load,
    activeDistortions: distortions,
    decisionCapacity,
    isFoggy,
  };
}

function detectCognitiveDistortions(text: string): CognitiveDistortion[] {
  const distortions: CognitiveDistortion[] = [];

  // Catastrophizing
  if (/\b(worst|disaster|catastrophe|ruined|end of|destroyed|never recover)\b/i.test(text)) {
    distortions.push("catastrophizing");
  }
  // Black and white thinking
  if (/\b(always|never|everyone|no one|completely|totally|nothing|everything)\b/i.test(text)) {
    distortions.push("black_white_thinking");
  }
  // Mind reading
  if (/\b(they think|he thinks|she thinks|probably thinks|must think|judging me)\b/i.test(text)) {
    distortions.push("mind_reading");
  }
  // Fortune telling
  if (/\b(will fail|won't work|going to|it's going to be|definitely will)\b/i.test(text)) {
    distortions.push("fortune_telling");
  }
  // Personalization
  if (/\b(my fault|because of me|i made|i caused|blame myself)\b/i.test(text)) {
    distortions.push("personalization");
  }
  // Emotional reasoning
  if (/\b(i feel like|feels like|must be true because|if i feel)\b/i.test(text)) {
    distortions.push("emotional_reasoning");
  }
  // Should statements
  if (/\b(should|shouldn't|must|have to|need to|supposed to|ought to)\b/i.test(text)) {
    distortions.push("should_statements");
  }
  // Labeling
  if (/\b(i am a|i'm just a|i'm such a|total|complete|loser|failure|idiot|stupid)\b/i.test(text)) {
    distortions.push("labeling");
  }

  return distortions;
}

function detectCognitiveLoad(text: string): "low" | "moderate" | "high" | "overwhelmed" {
  const overwhelmPatterns = /\b(can't think|brain fog|too much|head spinning|confused|don't know what|lost|stuck)\b/i;
  const highPatterns = /\b(lot going on|many things|complicated|complex|figuring out|thinking about)\b/i;
  
  if (overwhelmPatterns.test(text)) return "overwhelmed";
  if (highPatterns.test(text)) return "high";
  if (text.length > 500) return "moderate";
  return "low";
}

function calculateClarity(text: string, load: string): number {
  let clarity = 70;
  
  if (load === "overwhelmed") clarity -= 40;
  else if (load === "high") clarity -= 20;
  
  // Clarity indicators
  if (/\b(i understand|i see|makes sense|clear|figured out|realized)\b/i.test(text)) {
    clarity += 20;
  }
  // Confusion indicators
  if (/\b(confused|don't understand|not sure|unclear|lost|don't know)\b/i.test(text)) {
    clarity -= 25;
  }

  return Math.max(0, Math.min(100, clarity));
}

function calculateDecisionCapacity(text: string, clarity: number, load: string): number {
  let capacity = clarity;
  
  if (load === "overwhelmed") capacity -= 30;
  if (/\b(can't decide|don't know what to|stuck|paralyzed|frozen)\b/i.test(text)) {
    capacity -= 25;
  }
  
  return Math.max(0, Math.min(100, capacity));
}

// ============================================
// BEHAVIORAL ENGINE (Section 13)
// ============================================

export function runBehavioralEngine(
  message: string,
  emotionalState: EmotionalState,
  cognitiveState: CognitiveState
): BehavioralState {
  const lowerMessage = message.toLowerCase();

  const survivalMode = detectSurvivalMode(lowerMessage, emotionalState, cognitiveState);
  const agencyLevel = calculateAgencyLevel(lowerMessage, survivalMode);
  const avoidancePattern = detectAvoidancePattern(lowerMessage);
  const followThroughCapacity = calculateFollowThroughCapacity(lowerMessage, agencyLevel, survivalMode);
  const loopState = detectLoopState(lowerMessage);

  return {
    survivalMode,
    agencyLevel,
    avoidancePattern,
    followThroughCapacity,
    loopState,
  };
}

function detectSurvivalMode(
  text: string,
  emotional: EmotionalState,
  cognitive: CognitiveState
): boolean {
  // Survival mode signals from Section 13.1
  const survivalPatterns = /\b(just getting through|day by day|surviving|barely|hanging on|making it|one foot)\b/i;
  
  const textSignal = survivalPatterns.test(text);
  const emotionalSignal = emotional.isShutdown || emotional.saturationLevel > 80;
  const cognitiveSignal = cognitive.cognitiveLoad === "overwhelmed" || cognitive.clarity < 30;
  
  return textSignal || emotionalSignal || cognitiveSignal;
}

function calculateAgencyLevel(text: string, survivalMode: boolean): number {
  let agency = survivalMode ? 25 : 60;

  // Agency boosters
  if (/\b(i decided|i'm going to|i will|i chose|my choice|taking control|making it happen)\b/i.test(text)) {
    agency += 25;
  }
  // Agency reducers
  if (/\b(can't|have no choice|forced|stuck|trapped|powerless|helpless|no control)\b/i.test(text)) {
    agency -= 25;
  }

  return Math.max(0, Math.min(100, agency));
}

function detectAvoidancePattern(text: string): AvoidancePattern | null {
  if (/\b(anyway|moving on|let's talk about|forget it|whatever)\b/i.test(text)) {
    return "deflection";
  }
  if (/\b(later|tomorrow|eventually|soon|when i get to it|putting off)\b/i.test(text)) {
    return "procrastination";
  }
  if (/\b(don't want to feel|numb|blocking|avoiding|don't think about)\b/i.test(text)) {
    return "emotional_escape";
  }
  if (/\b(scared to|afraid to|can't bring myself|too afraid)\b/i.test(text)) {
    return "internalized_fear";
  }
  if (/\b(can't think|brain fog|unclear|lost|confused)\b/i.test(text)) {
    return "cognitive_fog";
  }
  return null;
}

function calculateFollowThroughCapacity(text: string, agency: number, survivalMode: boolean): number {
  let capacity = agency;
  
  if (survivalMode) capacity -= 20;
  
  if (/\b(committed|doing it|started|making progress|following through)\b/i.test(text)) {
    capacity += 15;
  }
  if (/\b(gave up|stopped|quit|abandoned|couldn't finish)\b/i.test(text)) {
    capacity -= 20;
  }

  return Math.max(0, Math.min(100, capacity));
}

function detectLoopState(text: string): "offered" | "accepted" | "stalled" | "resolved" | "failed" | null {
  if (/\b(i did it|finished|completed|done|accomplished|succeeded)\b/i.test(text)) {
    return "resolved";
  }
  if (/\b(gave up|failed|couldn't|didn't work|abandoned)\b/i.test(text)) {
    return "failed";
  }
  if (/\b(stuck|stalled|haven't|not yet|still trying|struggling)\b/i.test(text)) {
    return "stalled";
  }
  if (/\b(i'm going to|will do|starting|working on|taking on)\b/i.test(text)) {
    return "accepted";
  }
  return null;
}

// ============================================
// SAFETY ENGINE (Section 15)
// ============================================

export function runSafetyEngine(
  message: string,
  emotionalState: EmotionalState
): SafetyState {
  const lowerMessage = message.toLowerCase();
  const signals = detectSafetySignals(lowerMessage);
  
  // Determine tier
  let tier: SafetyState["tier"] = "T0_stable";
  let distressLevel = 0;
  let enterpriseRouteRequired = false;

  // Crisis detection (T3)
  const crisisPatterns = /\b(end it|hurt myself|kill myself|suicide|don't want to be here|want to die|better off dead)\b/i;
  if (crisisPatterns.test(lowerMessage)) {
    tier = "T3_critical";
    distressLevel = 95;
    enterpriseRouteRequired = true;
  }
  // Risk detection (T2)
  else if (signals.some(s => s.severity >= 4)) {
    tier = "T2_risk";
    distressLevel = 75;
    enterpriseRouteRequired = true;
  }
  // Concern detection (T1)
  else if (signals.some(s => s.severity >= 3) || emotionalState.isDistressed) {
    tier = "T1_concern";
    distressLevel = 55;
  }
  // Elevated but stable
  else if (signals.length > 0 || emotionalState.saturationLevel > 60) {
    distressLevel = 35;
  }

  const needsGrounding = tier !== "T0_stable" || emotionalState.isDistressed;
  const needsContainment = tier === "T2_risk" || tier === "T3_critical";
  const escalationRisk = tier === "T2_risk" || emotionalState.emotionalArc === "rise";

  return {
    tier,
    distressLevel,
    escalationRisk,
    needsGrounding,
    needsContainment,
    enterpriseRouteRequired,
  };
}

function detectSafetySignals(text: string): Signal[] {
  const signals: Signal[] = [];

  // Crisis signals (severity 5)
  if (/\b(suicide|suicidal|kill myself|end my life|better off dead|want to die)\b/i.test(text)) {
    signals.push({ type: "crisis", severity: 5, confidence: 95, requiresEnterpriseRoute: true });
  }
  // Self-harm (severity 4-5)
  if (/\b(hurt myself|cutting|self-harm|harming myself)\b/i.test(text)) {
    signals.push({ type: "crisis", severity: 4, confidence: 90, requiresEnterpriseRoute: true });
  }
  // Hopelessness (severity 3-4)
  if (/\b(hopeless|no point|give up|can't go on|nothing matters|no future)\b/i.test(text)) {
    signals.push({ type: "hopelessness", severity: 4, confidence: 80, requiresEnterpriseRoute: false });
  }
  // Panic (severity 3)
  if (/\b(panicking|panic attack|can't breathe|heart racing|freaking out)\b/i.test(text)) {
    signals.push({ type: "panic", severity: 3, confidence: 85, requiresEnterpriseRoute: false });
  }
  // Distress (severity 2-3)
  if (/\b(overwhelmed|can't handle|too much|falling apart|breaking down)\b/i.test(text)) {
    signals.push({ type: "distress", severity: 3, confidence: 75, requiresEnterpriseRoute: false });
  }
  // Isolation (severity 2)
  if (/\b(alone|no one|nobody|by myself|isolated|cut off)\b/i.test(text)) {
    signals.push({ type: "isolation", severity: 2, confidence: 70, requiresEnterpriseRoute: false });
  }
  // Fatigue (severity 2)
  if (/\b(exhausted|burnt out|drained|no energy|can't keep going)\b/i.test(text)) {
    signals.push({ type: "fatigue", severity: 2, confidence: 65, requiresEnterpriseRoute: false });
  }

  return signals;
}

// ============================================
// SHAME BUFFERING SYSTEM (Section 58)
// ============================================

export function runShameBuffer(message: string): ShameBufferState {
  const lowerMessage = message.toLowerCase();
  const markers = detectShameMarkers(lowerMessage);
  const shameDetected = markers.length > 0;
  const deactivationMoves = selectDeactivationMoves(markers);

  return {
    shameDetected,
    shameMarkers: markers,
    deactivationMoves,
  };
}

function detectShameMarkers(text: string): string[] {
  const markers: string[] = [];

  // Self-blame language
  if (/\b(my fault|i'm so|i'm such|i always|i never|stupid me|idiot)\b/i.test(text)) {
    markers.push("self_blame");
  }
  // Apologizing patterns
  if (/\b(sorry for|apologize|shouldn't have|i know i|my bad)\b/i.test(text)) {
    markers.push("excessive_apologizing");
  }
  // Minimizing self
  if (/\b(just|only|nothing|not important|doesn't matter|who cares)\b/i.test(text)) {
    markers.push("minimization");
  }
  // Worthlessness
  if (/\b(worthless|useless|failure|pathetic|loser|mess|burden)\b/i.test(text)) {
    markers.push("worthlessness");
  }
  // Hiding/concealment
  if (/\b(can't tell anyone|don't tell|secret|hide|ashamed|embarrassed)\b/i.test(text)) {
    markers.push("concealment");
  }

  return markers;
}

function selectDeactivationMoves(markers: string[]): ShameDeactivationMove[] {
  const moves: ShameDeactivationMove[] = [];

  if (markers.includes("self_blame")) {
    moves.push("truth_reframing");
  }
  if (markers.includes("worthlessness")) {
    moves.push("identity_reminder");
  }
  if (markers.includes("excessive_apologizing") || markers.includes("minimization")) {
    moves.push("validation");
  }
  if (markers.includes("concealment")) {
    moves.push("normalization");
    moves.push("belonging_cue");
  }
  if (moves.length === 0 && markers.length > 0) {
    moves.push("soft_directness");
  }

  return moves;
}

// ============================================
// IDENTITY ENGINE (Section 9)
// ============================================

export function runIdentityEngine(
  message: string,
  emotionalState: EmotionalState,
  shameState: ShameBufferState
): IdentityState {
  const lowerMessage = message.toLowerCase();

  const selfTrust = calculateSelfTrust(lowerMessage, shameState);
  const identityCoherence = calculateIdentityCoherence(lowerMessage);
  const tensions = detectIdentityTensions(lowerMessage);
  const needsRepair = selfTrust < 40 || shameState.shameDetected;
  const expansionReady = selfTrust > 70 && emotionalState.emotionalMomentum === "rising" && !shameState.shameDetected;

  return {
    selfTrust,
    identityCoherence,
    activeIdentityTensions: tensions,
    needsRepair,
    expansionReady,
  };
}

function calculateSelfTrust(text: string, shameState: ShameBufferState): number {
  let trust = 60;

  // Trust boosters
  if (/\b(i can|i know|i trust|believe in myself|capable|strong|got this)\b/i.test(text)) {
    trust += 20;
  }
  // Trust reducers
  if (/\b(can't trust|don't trust myself|doubt|unsure|second-guess|wrong)\b/i.test(text)) {
    trust -= 25;
  }
  // Shame reduces trust
  if (shameState.shameDetected) {
    trust -= 15;
  }

  return Math.max(0, Math.min(100, trust));
}

function calculateIdentityCoherence(text: string): number {
  let coherence = 70;

  // Coherence signals
  if (/\b(i am|i'm the kind|that's who i|my values|what i stand for)\b/i.test(text)) {
    coherence += 15;
  }
  // Incoherence signals
  if (/\b(don't know who|lost myself|not myself|who am i|don't recognize)\b/i.test(text)) {
    coherence -= 25;
  }

  return Math.max(0, Math.min(100, coherence));
}

function detectIdentityTensions(text: string): string[] {
  const tensions: string[] = [];

  if (/\b(who i was|used to be|not anymore|changed|different now)\b/i.test(text)) {
    tensions.push("past_present_conflict");
  }
  if (/\b(they want me to|expectations|supposed to be|should be)\b/i.test(text)) {
    tensions.push("external_pressure");
  }
  if (/\b(two sides|part of me|conflicted|torn between)\b/i.test(text)) {
    tensions.push("internal_conflict");
  }

  return tensions;
}

// ============================================
// SOCIAL INTELLIGENCE ENGINE (Section 14)
// ============================================

export function runSocialEngine(message: string): SocialState {
  const lowerMessage = message.toLowerCase();

  const powerDynamicsConcern = detectPowerDynamics(lowerMessage);
  const manipulationRisk = detectManipulation(lowerMessage);
  const socialThreatLevel = calculateSocialThreat(lowerMessage);
  const isolationLevel = calculateIsolation(lowerMessage);
  const communicationStyle = detectCommunicationStyle(lowerMessage);

  return {
    powerDynamicsConcern,
    manipulationRisk,
    socialThreatLevel,
    isolationLevel,
    communicationStyle,
  };
}

function detectPowerDynamics(text: string): boolean {
  return /\b(boss|authority|control|power over|making me|forcing|intimidat)\b/i.test(text);
}

function detectManipulation(text: string): boolean {
  return /\b(gaslighting|manipulat|lying to me|making me feel crazy|twisting|guilt trip)\b/i.test(text);
}

function calculateSocialThreat(text: string): number {
  let threat = 0;
  
  if (/\b(attacked|bullied|harassed|threatened|abused)\b/i.test(text)) threat += 40;
  if (/\b(unsafe|dangerous|scared of|afraid of)\b/i.test(text)) threat += 30;
  if (/\b(conflict|fight|argument|tension)\b/i.test(text)) threat += 20;
  
  return Math.min(100, threat);
}

function calculateIsolation(text: string): number {
  let isolation = 20;

  if (/\b(alone|no one|nobody|by myself|don't have anyone)\b/i.test(text)) {
    isolation += 35;
  }
  if (/\b(friends|family|people|support|community|together)\b/i.test(text)) {
    isolation -= 15;
  }

  return Math.max(0, Math.min(100, isolation));
}

function detectCommunicationStyle(text: string): "direct" | "indirect" | "guarded" | "open" {
  if (/\b(don't want to|can't say|hard to|not sure if)\b/i.test(text)) {
    return "guarded";
  }
  if (/\b(maybe|kind of|sort of|i guess)\b/i.test(text)) {
    return "indirect";
  }
  if (/\b(honestly|truth is|real talk|straight up)\b/i.test(text)) {
    return "direct";
  }
  return "open";
}

// ============================================
// MASTER STATE ANALYZER
// ============================================

export function analyzeUserState(
  message: string,
  prosody?: ProsodyAnalysis
): UserState {
  const emotionalState = runEmotionalEngine(message, prosody);
  const cognitiveState = runCognitiveEngine(message);
  const shameState = runShameBuffer(message);
  const behavioralState = runBehavioralEngine(message, emotionalState, cognitiveState);
  const identityState = runIdentityEngine(message, emotionalState, shameState);
  const socialState = runSocialEngine(message);
  const safetyState = runSafetyEngine(message, emotionalState);

  return {
    emotionalState,
    cognitiveState,
    behavioralState,
    identityState,
    socialState,
    safetyState,
  };
}

// ============================================
// RESPONSE STRATEGY BUILDER
// ============================================

export function buildResponseStrategy(
  userState: UserState,
  attunement: AttunementOutput,
  shameState: ShameBufferState
): {
  responseGoal: string;
  constraints: string[];
  forbidden: string[];
  engineFocus: EngineType[];
  toneGuidance: string;
} {
  const constraints: string[] = [];
  const forbidden: string[] = [
    "Never say 'I hear you' or 'That must be hard'",
    "Never use clinical language",
    "Never give unsolicited advice",
    "Never shame or guilt",
    "Never break character",
  ];
  const engineFocus: EngineType[] = [attunement.nextEngine];

  let responseGoal = "Be present and real";
  let toneGuidance = "Warm and grounded";

  // Safety-first responses
  if (userState.safetyState.tier === "T3_critical") {
    responseGoal = "Stabilize and ground. Create safety. Slow everything down.";
    constraints.push("Use short, grounding phrases");
    constraints.push("Slow breathing-coded pacing");
    constraints.push("No questions that increase pressure");
    toneGuidance = "Maximum calm. Maximum groundedness. Soft but present.";
    engineFocus.push("grounding", "safety");
  } else if (userState.safetyState.tier === "T2_risk") {
    responseGoal = "De-escalate and contain. Help regain control.";
    constraints.push("Reduce emotional intensity");
    constraints.push("Create space without forcing");
    toneGuidance = "Calm, steady, containing";
    engineFocus.push("grounding");
  } else if (userState.safetyState.tier === "T1_concern") {
    responseGoal = "Acknowledge and stabilize. Be present.";
    constraints.push("Create safety without being clinical");
    toneGuidance = "Warm, steady, grounded";
  }

  // Shame buffering
  if (shameState.shameDetected) {
    constraints.push("Absolutely no blame or judgment");
    constraints.push("Use shame deactivation moves");
    engineFocus.push("shame_buffer");
    
    shameState.deactivationMoves.forEach(move => {
      switch (move) {
        case "truth_reframing":
          constraints.push("Reframe without blame");
          break;
        case "normalization":
          constraints.push("Normalize their experience");
          break;
        case "identity_reminder":
          constraints.push("Remind them of their real identity");
          break;
        case "belonging_cue":
          constraints.push("Create sense of belonging");
          break;
        case "validation":
          constraints.push("Validate their experience");
          break;
      }
    });
  }

  // Survival mode
  if (userState.behavioralState.survivalMode) {
    responseGoal = "Create capacity. Reduce overwhelm. Build micro-agency.";
    constraints.push("Break things into smallest possible steps");
    constraints.push("No pressure, only choices");
    constraints.push("Relief before activation");
    toneGuidance = "Soft, slow, spacious";
    engineFocus.push("capacity", "relief");
  }

  // Cognitive overwhelm
  if (userState.cognitiveState.cognitiveLoad === "overwhelmed") {
    constraints.push("Keep response short");
    constraints.push("One thing at a time");
    constraints.push("No complex questions");
    toneGuidance = "Clear, simple, grounded";
    engineFocus.push("cognitive");
  }

  // Low agency
  if (userState.behavioralState.agencyLevel < 40) {
    constraints.push("Reflect their power back to them");
    constraints.push("Highlight their capability");
    constraints.push("Create micro-proofs of agency");
    engineFocus.push("behavioral");
  }

  // Identity repair needed
  if (userState.identityState.needsRepair) {
    constraints.push("Affirm their real identity");
    constraints.push("Separate behavior from identity");
    engineFocus.push("identity");
  }

  // Attunement mode-specific guidance
  switch (attunement.mode) {
    case "mirror":
      constraints.push("Reflect back their emotional truth");
      break;
    case "stabilize":
      constraints.push("Reduce intensity, create safety");
      break;
    case "activate":
      constraints.push("Create momentum, amplify agency");
      break;
    case "elevate":
      constraints.push("Reinforce identity, build pride");
      break;
    case "challenge":
      constraints.push("Gently disrupt limiting patterns");
      break;
    case "contain":
      constraints.push("Hold space, prevent escalation");
      break;
  }

  return {
    responseGoal,
    constraints,
    forbidden,
    engineFocus,
    toneGuidance,
  };
}
