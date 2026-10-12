/**
 * SIANI Trait-Building Engines
 * 
 * From "In Depth System Information" documentation:
 * These engines help users develop positive traits and capabilities
 * over time through consistent interaction and behavioral nudges.
 * 
 * Six Trait-Building Engines:
 * 1. Confidence Engine - Building self-belief and reducing self-doubt
 * 2. Discipline Engine - Developing consistency and follow-through
 * 3. Initiative Engine - Taking first steps and breaking inertia
 * 4. Persistence Engine - Maintaining effort through setbacks
 * 5. Reframing Engine - Shifting perspectives on challenges
 * 6. Self-Care Engine - Prioritizing personal wellness
 */

import type {
  UserState,
  EngineOutput,
  ToneModulation,
  PacingModulation,
} from "./types";

// ============================================
// TRAIT STATE INTERFACES
// ============================================

export interface TraitState {
  confidence: ConfidenceState;
  discipline: DisciplineState;
  initiative: InitiativeState;
  persistence: PersistenceState;
  reframing: ReframingState;
  selfCare: SelfCareState;
}

export interface ConfidenceState {
  selfEfficacy: number; // 0-100
  imposterSignals: string[];
  recentWins: number;
  selfDoubtLevel: number;
  needsAffirmation: boolean;
}

export interface DisciplineState {
  consistencyScore: number; // 0-100
  followThroughHistory: "strong" | "moderate" | "weak";
  distractionLevel: number;
  commitmentStrength: number;
  needsAccountability: boolean;
}

export interface InitiativeState {
  actionReadiness: number; // 0-100
  inertiaPatterns: string[];
  procrastinationLevel: number;
  startingEnergy: number;
  needsMomentum: boolean;
}

export interface PersistenceState {
  resilienceScore: number; // 0-100
  setbackResponse: "bounce" | "struggle" | "collapse";
  gritIndicators: string[];
  fatigueLevel: number;
  needsEncouragement: boolean;
}

export interface ReframingState {
  perspectiveFlexibility: number; // 0-100
  stuckPatterns: string[];
  growthMindsetIndicators: number;
  rigidityLevel: number;
  needsNewPerspective: boolean;
}

export interface SelfCareState {
  selfPrioritization: number; // 0-100
  neglectSignals: string[];
  boundaryStrength: number;
  burnoutRisk: number;
  needsPermission: boolean;
}

// ============================================
// CONFIDENCE ENGINE
// ============================================

export function runConfidenceEngine(
  message: string,
  userState: UserState
): ConfidenceState & EngineOutput {
  const lowerMessage = message.toLowerCase();
  
  const imposterSignals = detectImposterSignals(lowerMessage);
  const selfDoubtLevel = calculateSelfDoubt(lowerMessage, imposterSignals);
  const selfEfficacy = 100 - selfDoubtLevel;
  const recentWins = detectWinMentions(lowerMessage);
  const needsAffirmation = selfDoubtLevel > 50 || imposterSignals.length > 0;
  
  const recommendations: string[] = [];
  const contentFocus: string[] = [];
  
  if (needsAffirmation) {
    recommendations.push("Reflect their capability back to them");
    recommendations.push("Reference specific evidence of their competence");
    contentFocus.push("capability_reminder");
  }
  
  if (imposterSignals.includes("comparison")) {
    recommendations.push("Redirect from comparison to their own journey");
    contentFocus.push("unique_path");
  }
  
  if (imposterSignals.includes("fear_of_exposure")) {
    recommendations.push("Normalize the fear without dismissing it");
    contentFocus.push("normalization");
  }
  
  if (recentWins > 0) {
    recommendations.push("Amplify and anchor the win");
    contentFocus.push("win_celebration");
  }

  return {
    selfEfficacy,
    imposterSignals,
    recentWins,
    selfDoubtLevel,
    needsAffirmation,
    engine: "resilience",
    analysis: {
      selfEfficacy,
      imposterSignals,
      selfDoubtLevel,
    },
    recommendations,
    nextEngines: needsAffirmation ? ["identity", "emotional"] : [],
    responseModifiers: {
      toneShift: needsAffirmation ? { warmth: 85, directness: 60 } : undefined,
      contentFocus,
    },
  };
}

function detectImposterSignals(text: string): string[] {
  const signals: string[] = [];
  
  if (/\b(fake|pretending|don't belong|not good enough|fraud|lucky)\b/i.test(text)) {
    signals.push("imposter_core");
  }
  if (/\b(compared to|others are|everyone else|they're better)\b/i.test(text)) {
    signals.push("comparison");
  }
  if (/\b(find out|figure out|realize|discover|exposed)\b/i.test(text)) {
    signals.push("fear_of_exposure");
  }
  if (/\b(can't do|won't work|not smart|not capable|not ready)\b/i.test(text)) {
    signals.push("self_doubt");
  }
  if (/\b(undeserving|shouldn't be here|don't deserve)\b/i.test(text)) {
    signals.push("unworthiness");
  }
  
  return signals;
}

function calculateSelfDoubt(text: string, signals: string[]): number {
  let doubt = 30;
  
  doubt += signals.length * 12;
  
  if (/\b(always fail|never succeed|can't win|give up)\b/i.test(text)) {
    doubt += 20;
  }
  if (/\b(got this|can do|will do|confident|ready|capable)\b/i.test(text)) {
    doubt -= 25;
  }
  
  return Math.max(0, Math.min(100, doubt));
}

function detectWinMentions(text: string): number {
  let wins = 0;
  
  if (/\b(did it|made it|got the|achieved|accomplished|succeeded|nailed|crushed|killed it)\b/i.test(text)) {
    wins++;
  }
  if (/\b(promoted|hired|accepted|won|earned|completed)\b/i.test(text)) {
    wins++;
  }
  
  return wins;
}

// ============================================
// DISCIPLINE ENGINE
// ============================================

export function runDisciplineEngine(
  message: string,
  userState: UserState
): DisciplineState & EngineOutput {
  const lowerMessage = message.toLowerCase();
  
  const consistencyScore = calculateConsistency(lowerMessage);
  const followThroughHistory = detectFollowThrough(lowerMessage);
  const distractionLevel = calculateDistraction(lowerMessage);
  const commitmentStrength = 100 - distractionLevel;
  const needsAccountability = followThroughHistory === "weak" || distractionLevel > 60;
  
  const recommendations: string[] = [];
  const contentFocus: string[] = [];
  
  if (needsAccountability) {
    recommendations.push("Offer to be their accountability partner");
    recommendations.push("Break down into smallest possible steps");
    contentFocus.push("micro_commitments");
  }
  
  if (distractionLevel > 50) {
    recommendations.push("Help identify and remove friction");
    contentFocus.push("friction_reduction");
  }
  
  if (followThroughHistory === "weak") {
    recommendations.push("Focus on process, not outcome");
    recommendations.push("Create environment over willpower narrative");
    contentFocus.push("systems_over_goals");
  }

  return {
    consistencyScore,
    followThroughHistory,
    distractionLevel,
    commitmentStrength,
    needsAccountability,
    engine: "grit",
    analysis: {
      consistencyScore,
      followThroughHistory,
      distractionLevel,
    },
    recommendations,
    nextEngines: needsAccountability ? ["behavioral", "cognitive"] : [],
    responseModifiers: {
      toneShift: needsAccountability ? { directness: 65, groundedness: 80 } : undefined,
      contentFocus,
    },
  };
}

function calculateConsistency(text: string): number {
  let consistency = 50;
  
  if (/\b(every day|daily|routine|habit|consistent|always do)\b/i.test(text)) {
    consistency += 25;
  }
  if (/\b(sometimes|occasionally|when i remember|sporadic)\b/i.test(text)) {
    consistency -= 15;
  }
  if (/\b(keep stopping|start and stop|on and off|inconsistent)\b/i.test(text)) {
    consistency -= 25;
  }
  
  return Math.max(0, Math.min(100, consistency));
}

function detectFollowThrough(text: string): "strong" | "moderate" | "weak" {
  const strongPatterns = /\b(finished|completed|followed through|kept going|stuck with)\b/i;
  const weakPatterns = /\b(stopped|quit|gave up|abandoned|dropped|forgot)\b/i;
  
  if (strongPatterns.test(text)) return "strong";
  if (weakPatterns.test(text)) return "weak";
  return "moderate";
}

function calculateDistraction(text: string): number {
  let distraction = 30;
  
  if (/\b(distracted|side tracked|lost focus|forgot|got busy)\b/i.test(text)) {
    distraction += 30;
  }
  if (/\b(can't focus|too many things|overwhelmed|scattered)\b/i.test(text)) {
    distraction += 25;
  }
  if (/\b(focused|dedicated|committed|locked in|tunnel vision)\b/i.test(text)) {
    distraction -= 25;
  }
  
  return Math.max(0, Math.min(100, distraction));
}

// ============================================
// INITIATIVE ENGINE
// ============================================

export function runInitiativeEngine(
  message: string,
  userState: UserState
): InitiativeState & EngineOutput {
  const lowerMessage = message.toLowerCase();
  
  const inertiaPatterns = detectInertiaPatterns(lowerMessage);
  const procrastinationLevel = calculateProcrastination(lowerMessage, inertiaPatterns);
  const actionReadiness = 100 - procrastinationLevel;
  const startingEnergy = calculateStartingEnergy(lowerMessage, userState);
  const needsMomentum = procrastinationLevel > 50 || startingEnergy < 40;
  
  const recommendations: string[] = [];
  const contentFocus: string[] = [];
  
  if (needsMomentum) {
    recommendations.push("Create the smallest possible first step");
    recommendations.push("Remove decision paralysis by offering one clear action");
    contentFocus.push("first_step");
  }
  
  if (inertiaPatterns.includes("perfectionism")) {
    recommendations.push("Challenge perfect as enemy of done");
    contentFocus.push("imperfect_action");
  }
  
  if (inertiaPatterns.includes("overwhelm")) {
    recommendations.push("Simplify to one thing only");
    contentFocus.push("single_focus");
  }
  
  if (inertiaPatterns.includes("fear")) {
    recommendations.push("Acknowledge the fear without reinforcing it");
    contentFocus.push("courage_activation");
  }

  return {
    actionReadiness,
    inertiaPatterns,
    procrastinationLevel,
    startingEnergy,
    needsMomentum,
    engine: "courage",
    analysis: {
      actionReadiness,
      inertiaPatterns,
      procrastinationLevel,
    },
    recommendations,
    nextEngines: needsMomentum ? ["behavioral", "emotional"] : [],
    responseModifiers: {
      toneShift: needsMomentum ? { energy: 65, directness: 55 } : undefined,
      contentFocus,
    },
  };
}

function detectInertiaPatterns(text: string): string[] {
  const patterns: string[] = [];
  
  if (/\b(can't start|haven't started|keep putting off|tomorrow|later)\b/i.test(text)) {
    patterns.push("avoidance");
  }
  if (/\b(perfect|right way|not ready|need to prepare|more research)\b/i.test(text)) {
    patterns.push("perfectionism");
  }
  if (/\b(too many|don't know where|overwhelmed|so much)\b/i.test(text)) {
    patterns.push("overwhelm");
  }
  if (/\b(scared|afraid|what if|nervous|worried about)\b/i.test(text)) {
    patterns.push("fear");
  }
  if (/\b(don't feel like|not in the mood|no energy|tired)\b/i.test(text)) {
    patterns.push("motivation_gap");
  }
  
  return patterns;
}

function calculateProcrastination(text: string, patterns: string[]): number {
  let procrastination = 30;
  
  procrastination += patterns.length * 10;
  
  if (/\b(keep delaying|putting off|avoiding|waiting for)\b/i.test(text)) {
    procrastination += 20;
  }
  if (/\b(just did|started|took action|went for it|jumped in)\b/i.test(text)) {
    procrastination -= 30;
  }
  
  return Math.max(0, Math.min(100, procrastination));
}

function calculateStartingEnergy(text: string, userState: UserState): number {
  let energy = 50;
  
  if (/\b(ready|let's go|excited|pumped|want to)\b/i.test(text)) {
    energy += 30;
  }
  if (/\b(tired|drained|no energy|exhausted|can't)\b/i.test(text)) {
    energy -= 30;
  }
  
  if (userState.emotionalState.arousalLevel > 60) {
    energy += 15;
  } else if (userState.emotionalState.arousalLevel < 30) {
    energy -= 15;
  }
  
  return Math.max(0, Math.min(100, energy));
}

// ============================================
// PERSISTENCE ENGINE
// ============================================

export function runPersistenceEngine(
  message: string,
  userState: UserState
): PersistenceState & EngineOutput {
  const lowerMessage = message.toLowerCase();
  
  const gritIndicators = detectGritIndicators(lowerMessage);
  const setbackResponse = detectSetbackResponse(lowerMessage);
  const fatigueLevel = calculateFatigue(lowerMessage, userState);
  const resilienceScore = calculateResilience(lowerMessage, setbackResponse, gritIndicators);
  const needsEncouragement = setbackResponse === "collapse" || fatigueLevel > 70;
  
  const recommendations: string[] = [];
  const contentFocus: string[] = [];
  
  if (needsEncouragement) {
    recommendations.push("Acknowledge how hard this is");
    recommendations.push("Remind them of past times they pushed through");
    contentFocus.push("past_resilience");
  }
  
  if (setbackResponse === "collapse") {
    recommendations.push("Normalize the feeling of wanting to quit");
    recommendations.push("Create space before pushing forward");
    contentFocus.push("rest_before_restart");
  }
  
  if (setbackResponse === "struggle") {
    recommendations.push("Validate the effort, not just the outcome");
    contentFocus.push("effort_recognition");
  }
  
  if (gritIndicators.length > 0) {
    recommendations.push("Amplify their grit - they're showing real strength");
    contentFocus.push("grit_celebration");
  }

  return {
    resilienceScore,
    setbackResponse,
    gritIndicators,
    fatigueLevel,
    needsEncouragement,
    engine: "endurance",
    analysis: {
      resilienceScore,
      setbackResponse,
      fatigueLevel,
    },
    recommendations,
    nextEngines: needsEncouragement ? ["emotional", "identity"] : [],
    responseModifiers: {
      toneShift: needsEncouragement ? { warmth: 90, groundedness: 85 } : undefined,
      contentFocus,
    },
  };
}

function detectGritIndicators(text: string): string[] {
  const indicators: string[] = [];
  
  if (/\b(keep going|not giving up|won't quit|pushing through)\b/i.test(text)) {
    indicators.push("determination");
  }
  if (/\b(tried again|back at it|another shot|one more time)\b/i.test(text)) {
    indicators.push("retry_behavior");
  }
  if (/\b(hard but|difficult but|struggling but|tough but)\b/i.test(text)) {
    indicators.push("adversity_acknowledgment");
  }
  if (/\b(learning from|figured out|understood why|now i know)\b/i.test(text)) {
    indicators.push("growth_from_failure");
  }
  
  return indicators;
}

function detectSetbackResponse(text: string): "bounce" | "struggle" | "collapse" {
  const bouncePatterns = /\b(got back up|tried again|bounced back|recovered|stronger)\b/i;
  const collapsePatterns = /\b(give up|quit|done|can't anymore|no point|hopeless)\b/i;
  
  if (bouncePatterns.test(text)) return "bounce";
  if (collapsePatterns.test(text)) return "collapse";
  return "struggle";
}

function calculateFatigue(text: string, userState: UserState): number {
  let fatigue = 30;
  
  if (/\b(exhausted|burnt out|drained|running on empty|tired of)\b/i.test(text)) {
    fatigue += 35;
  }
  if (/\b(rested|energized|ready|refreshed|recharged)\b/i.test(text)) {
    fatigue -= 25;
  }
  
  if (userState.behavioralState.survivalMode) {
    fatigue += 20;
  }
  
  return Math.max(0, Math.min(100, fatigue));
}

function calculateResilience(text: string, response: string, indicators: string[]): number {
  let resilience = 50;
  
  resilience += indicators.length * 12;
  
  if (response === "bounce") resilience += 25;
  else if (response === "collapse") resilience -= 25;
  
  return Math.max(0, Math.min(100, resilience));
}

// ============================================
// REFRAMING ENGINE
// ============================================

export function runReframingEngine(
  message: string,
  userState: UserState
): ReframingState & EngineOutput {
  const lowerMessage = message.toLowerCase();
  
  const stuckPatterns = detectStuckPatterns(lowerMessage);
  const growthMindsetIndicators = detectGrowthMindset(lowerMessage);
  const rigidityLevel = calculateRigidity(lowerMessage, stuckPatterns);
  const perspectiveFlexibility = 100 - rigidityLevel;
  const needsNewPerspective = rigidityLevel > 50 || stuckPatterns.length > 1;
  
  const recommendations: string[] = [];
  const contentFocus: string[] = [];
  
  if (needsNewPerspective) {
    recommendations.push("Offer a gentle alternative perspective");
    recommendations.push("Use 'what if' to open possibilities");
    contentFocus.push("perspective_shift");
  }
  
  if (stuckPatterns.includes("fixed_story")) {
    recommendations.push("Challenge the permanence of their narrative");
    contentFocus.push("narrative_flexibility");
  }
  
  if (stuckPatterns.includes("victim_frame")) {
    recommendations.push("Without dismissing pain, highlight agency");
    contentFocus.push("agency_recovery");
  }
  
  if (growthMindsetIndicators > 60) {
    recommendations.push("Reinforce their growth orientation");
    contentFocus.push("growth_amplification");
  }

  return {
    perspectiveFlexibility,
    stuckPatterns,
    growthMindsetIndicators,
    rigidityLevel,
    needsNewPerspective,
    engine: "adaptability",
    analysis: {
      perspectiveFlexibility,
      stuckPatterns,
      growthMindsetIndicators,
    },
    recommendations,
    nextEngines: needsNewPerspective ? ["cognitive", "narrative"] : [],
    responseModifiers: {
      toneShift: needsNewPerspective ? { directness: 55, warmth: 75 } : undefined,
      contentFocus,
    },
  };
}

function detectStuckPatterns(text: string): string[] {
  const patterns: string[] = [];
  
  if (/\b(always|never|every time|this is how|that's just)\b/i.test(text)) {
    patterns.push("fixed_story");
  }
  if (/\b(they made me|because of them|it's their|i had no choice)\b/i.test(text)) {
    patterns.push("victim_frame");
  }
  if (/\b(can't change|won't change|this is who|that's how i am)\b/i.test(text)) {
    patterns.push("fixed_identity");
  }
  if (/\b(only way|no other|have to|must be)\b/i.test(text)) {
    patterns.push("binary_thinking");
  }
  
  return patterns;
}

function detectGrowthMindset(text: string): number {
  let growth = 50;
  
  if (/\b(learning|growing|improving|getting better|developing)\b/i.test(text)) {
    growth += 20;
  }
  if (/\b(yet|not yet|still learning|in progress|work in progress)\b/i.test(text)) {
    growth += 15;
  }
  if (/\b(feedback|lesson|experience|opportunity)\b/i.test(text)) {
    growth += 10;
  }
  if (/\b(can't learn|too late|too old|not smart enough)\b/i.test(text)) {
    growth -= 25;
  }
  
  return Math.max(0, Math.min(100, growth));
}

function calculateRigidity(text: string, patterns: string[]): number {
  let rigidity = 30;
  
  rigidity += patterns.length * 15;
  
  if (/\b(but|however|except|only if)\b/i.test(text)) {
    rigidity += 5;
  }
  if (/\b(maybe|perhaps|could be|might|open to)\b/i.test(text)) {
    rigidity -= 15;
  }
  
  return Math.max(0, Math.min(100, rigidity));
}

// ============================================
// SELF-CARE ENGINE
// ============================================

export function runSelfCareEngine(
  message: string,
  userState: UserState
): SelfCareState & EngineOutput {
  const lowerMessage = message.toLowerCase();
  
  const neglectSignals = detectNeglectSignals(lowerMessage);
  const boundaryStrength = calculateBoundaryStrength(lowerMessage);
  const burnoutRisk = calculateBurnoutRisk(lowerMessage, neglectSignals, userState);
  const selfPrioritization = 100 - burnoutRisk;
  const needsPermission = neglectSignals.length > 0 || boundaryStrength < 40;
  
  const recommendations: string[] = [];
  const contentFocus: string[] = [];
  
  if (needsPermission) {
    recommendations.push("Give explicit permission to rest/care for self");
    recommendations.push("Frame self-care as non-negotiable, not selfish");
    contentFocus.push("permission_giving");
  }
  
  if (neglectSignals.includes("basic_needs")) {
    recommendations.push("Check on basics: food, water, sleep");
    contentFocus.push("basic_needs_check");
  }
  
  if (boundaryStrength < 40) {
    recommendations.push("Support boundary setting without judgment");
    contentFocus.push("boundary_support");
  }
  
  if (burnoutRisk > 70) {
    recommendations.push("Urgent: Create space for recovery");
    recommendations.push("Reduce demands, create margin");
    contentFocus.push("burnout_intervention");
  }

  return {
    selfPrioritization,
    neglectSignals,
    boundaryStrength,
    burnoutRisk,
    needsPermission,
    engine: "capacity",
    analysis: {
      selfPrioritization,
      neglectSignals,
      burnoutRisk,
    },
    recommendations,
    nextEngines: needsPermission ? ["emotional", "behavioral"] : [],
    responseModifiers: {
      toneShift: needsPermission ? { warmth: 90, groundedness: 85, shouldBeGentle: true } : undefined,
      contentFocus,
    },
  };
}

function detectNeglectSignals(text: string): string[] {
  const signals: string[] = [];
  
  if (/\b(haven't eaten|no sleep|not sleeping|forgot to eat|running on)\b/i.test(text)) {
    signals.push("basic_needs");
  }
  if (/\b(no time for|don't have time|too busy|can't rest|always working)\b/i.test(text)) {
    signals.push("time_poverty");
  }
  if (/\b(everyone else|others first|their needs|put them)\b/i.test(text)) {
    signals.push("others_first");
  }
  if (/\b(selfish|feel guilty|should be|can't say no)\b/i.test(text)) {
    signals.push("guilt_block");
  }
  
  return signals;
}

function calculateBoundaryStrength(text: string): number {
  let strength = 50;
  
  if (/\b(said no|set a boundary|not my responsibility|my time)\b/i.test(text)) {
    strength += 25;
  }
  if (/\b(can't say no|feel bad|obligated|have to|should help)\b/i.test(text)) {
    strength -= 25;
  }
  if (/\b(always available|never say no|drop everything)\b/i.test(text)) {
    strength -= 30;
  }
  
  return Math.max(0, Math.min(100, strength));
}

function calculateBurnoutRisk(text: string, signals: string[], userState: UserState): number {
  let risk = 25;
  
  risk += signals.length * 12;
  
  if (/\b(burnt out|burning out|breaking down|falling apart|can't keep)\b/i.test(text)) {
    risk += 35;
  }
  if (/\b(exhausted|drained|empty|nothing left|running on fumes)\b/i.test(text)) {
    risk += 25;
  }
  
  if (userState.behavioralState.survivalMode) {
    risk += 20;
  }
  if (userState.emotionalState.saturationLevel > 70) {
    risk += 15;
  }
  
  return Math.max(0, Math.min(100, risk));
}

// ============================================
// MASTER TRAIT ANALYZER
// ============================================

export function analyzeTraitState(
  message: string,
  userState: UserState
): TraitState {
  const confidenceResult = runConfidenceEngine(message, userState);
  const disciplineResult = runDisciplineEngine(message, userState);
  const initiativeResult = runInitiativeEngine(message, userState);
  const persistenceResult = runPersistenceEngine(message, userState);
  const reframingResult = runReframingEngine(message, userState);
  const selfCareResult = runSelfCareEngine(message, userState);
  
  return {
    confidence: {
      selfEfficacy: confidenceResult.selfEfficacy,
      imposterSignals: confidenceResult.imposterSignals,
      recentWins: confidenceResult.recentWins,
      selfDoubtLevel: confidenceResult.selfDoubtLevel,
      needsAffirmation: confidenceResult.needsAffirmation,
    },
    discipline: {
      consistencyScore: disciplineResult.consistencyScore,
      followThroughHistory: disciplineResult.followThroughHistory,
      distractionLevel: disciplineResult.distractionLevel,
      commitmentStrength: disciplineResult.commitmentStrength,
      needsAccountability: disciplineResult.needsAccountability,
    },
    initiative: {
      actionReadiness: initiativeResult.actionReadiness,
      inertiaPatterns: initiativeResult.inertiaPatterns,
      procrastinationLevel: initiativeResult.procrastinationLevel,
      startingEnergy: initiativeResult.startingEnergy,
      needsMomentum: initiativeResult.needsMomentum,
    },
    persistence: {
      resilienceScore: persistenceResult.resilienceScore,
      setbackResponse: persistenceResult.setbackResponse,
      gritIndicators: persistenceResult.gritIndicators,
      fatigueLevel: persistenceResult.fatigueLevel,
      needsEncouragement: persistenceResult.needsEncouragement,
    },
    reframing: {
      perspectiveFlexibility: reframingResult.perspectiveFlexibility,
      stuckPatterns: reframingResult.stuckPatterns,
      growthMindsetIndicators: reframingResult.growthMindsetIndicators,
      rigidityLevel: reframingResult.rigidityLevel,
      needsNewPerspective: reframingResult.needsNewPerspective,
    },
    selfCare: {
      selfPrioritization: selfCareResult.selfPrioritization,
      neglectSignals: selfCareResult.neglectSignals,
      boundaryStrength: selfCareResult.boundaryStrength,
      burnoutRisk: selfCareResult.burnoutRisk,
      needsPermission: selfCareResult.needsPermission,
    },
  };
}

// ============================================
// TRAIT-BUILDING RESPONSE MODIFIERS
// ============================================

export function getTraitBuildingGuidance(traitState: TraitState): {
  priorityTraits: string[];
  responseGuidance: string[];
  forbidden: string[];
} {
  const priorityTraits: string[] = [];
  const responseGuidance: string[] = [];
  const forbidden: string[] = [];
  
  if (traitState.confidence.needsAffirmation) {
    priorityTraits.push("confidence");
    responseGuidance.push("Reflect their capability without being preachy");
  }
  
  if (traitState.discipline.needsAccountability) {
    priorityTraits.push("discipline");
    responseGuidance.push("Offer gentle accountability, not pressure");
  }
  
  if (traitState.initiative.needsMomentum) {
    priorityTraits.push("initiative");
    responseGuidance.push("Create the smallest possible first step");
  }
  
  if (traitState.persistence.needsEncouragement) {
    priorityTraits.push("persistence");
    responseGuidance.push("Acknowledge the struggle, remind of past strength");
  }
  
  if (traitState.reframing.needsNewPerspective) {
    priorityTraits.push("reframing");
    responseGuidance.push("Offer alternative perspective gently");
  }
  
  if (traitState.selfCare.needsPermission) {
    priorityTraits.push("self_care");
    responseGuidance.push("Give explicit permission to prioritize self");
  }
  
  forbidden.push("Never lecture about self-improvement");
  forbidden.push("Never use motivational poster language");
  forbidden.push("Never shame about lack of progress");
  
  return {
    priorityTraits,
    responseGuidance,
    forbidden,
  };
}
