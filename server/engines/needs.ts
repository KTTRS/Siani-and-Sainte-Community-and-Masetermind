/**
 * NEEDS DETECTION ENGINE
 * 
 * Detects social determinants of health (SDOH) needs from conversation.
 * Maps detected needs to resource categories for referral matching.
 * 
 * 8 MANDATED CATEGORIES ONLY:
 * - housing: Housing instability, homelessness, rent assistance
 * - food: Food insecurity, SNAP/WIC, food pantries
 * - transportation: Getting to appointments, bus passes, rides
 * - mental_health: Therapy, counseling, crisis support, healthcare
 * - employment: Job search, training, resume help
 * - education: GED, college, skills training
 * - legal: Legal aid, immigration, criminal justice
 * - financial: Bills, debt, banking, benefits, utilities
 */

export type NeedCategory = 
  | 'housing'
  | 'food'
  | 'transportation'
  | 'mental_health'
  | 'employment'
  | 'education'
  | 'legal'
  | 'financial';

export const NEED_CATEGORIES: NeedCategory[] = [
  'housing', 'food', 'transportation', 'mental_health',
  'employment', 'education', 'legal', 'financial'
];

export interface DetectedNeed {
  category: NeedCategory;
  confidence: number; // 0-100
  urgency: 'low' | 'medium' | 'high' | 'crisis';
  triggerPhrases: string[];
  context?: string;
}

export interface NeedDetectionResult {
  needsDetected: DetectedNeed[];
  hasNeeds: boolean;
  primaryNeed?: DetectedNeed;
  shouldOfferResources: boolean;
}

// Keyword patterns for each need category (8 categories only)
const NEED_PATTERNS: Record<NeedCategory, { keywords: string[]; urgencyIndicators: string[] }> = {
  housing: {
    keywords: [
      'homeless', 'evicted', 'eviction', 'kicked out', 'couch surfing', 'shelter',
      'rent', 'landlord', 'lease', 'apartment', 'housing', 'place to stay',
      'place to live', 'find a place', 'sleeping in car', 'sleeping in my car',
      'staying with', "can't afford rent", 'behind on rent',
      'nowhere to go', 'moving out', 'need a place', 'living situation',
      'domestic violence', 'abuse', 'not safe', 'scared at home', 'threatened'
    ],
    urgencyIndicators: ['tonight', 'nowhere', 'kicked out', 'evicted', 'homeless', 'sleeping outside', 'not safe', 'abuse']
  },
  food: {
    keywords: [
      'hungry', 'food', 'eat', 'groceries', 'food stamps', 'snap', 'wic',
      'food bank', 'pantry', "can't afford food", 'no food', 'kids are hungry',
      'meal', 'skipping meals', 'running low', 'haven\'t eaten'
    ],
    urgencyIndicators: ['haven\'t eaten', 'kids hungry', 'no food', 'starving']
  },
  transportation: {
    keywords: [
      'ride', 'car', 'bus', 'bus pass', 'transportation', 'get to',
      'no way to get', 'can\'t get there', 'appointment', 'uber', 'lyft',
      'driving', 'license', 'gas', 'broken down', 'towed'
    ],
    urgencyIndicators: ['appointment tomorrow', 'no way to get', 'stranded']
  },
  mental_health: {
    keywords: [
      'therapist', 'therapy', 'counseling', 'counselor', 'depressed', 'depression',
      'anxiety', 'anxious', 'panic', 'mental health', 'psychiatrist', 'medication',
      'struggling', 'overwhelmed', 'can\'t cope', 'breaking down', 'crisis',
      'doctor', 'hospital', 'sick', 'medicine', 'prescription', 'health',
      'pain', 'clinic', 'medical', 'insurance', 'medicaid', 'childcare',
      'daycare', 'babysitter', 'kids', 'watch my kids'
    ],
    urgencyIndicators: ['crisis', 'can\'t take it', 'breaking down', 'want to give up', 'really sick', 'emergency', 'in pain']
  },
  employment: {
    keywords: [
      'job', 'work', 'fired', 'laid off', 'unemployed', 'interview', 'resume',
      'career', 'hiring', 'application', 'income', 'paycheck', 'hours cut',
      'looking for work', 'need a job', 'job training'
    ],
    urgencyIndicators: ['fired', 'laid off', 'no income', 'bills due']
  },
  education: {
    keywords: [
      'school', 'college', 'ged', 'diploma', 'degree', 'class', 'training',
      'certificate', 'education', 'learn', 'study', 'tuition', 'scholarship',
      'fafsa', 'student loan'
    ],
    urgencyIndicators: ['deadline', 'dropping out', 'can\'t afford tuition']
  },
  legal: {
    keywords: [
      'lawyer', 'attorney', 'court', 'case', 'legal', 'custody', 'divorce',
      'immigration', 'visa', 'deportation', 'arrest', 'charges', 'probation',
      'warrant', 'ticket', 'lease dispute', 'landlord issue', 'restraining order',
      'stalking', 'harassment', 'protection order'
    ],
    urgencyIndicators: ['court date', 'arrested', 'deported', 'custody hearing', 'threatened']
  },
  financial: {
    keywords: [
      'money', 'bills', 'debt', 'credit', 'bank', 'cash', 'broke', 'behind',
      'collections', 'payments', 'benefits', 'ssi', 'disability', 'tax',
      'budget', 'savings', 'overdraft', 'payday loan', 'electric', 'electricity',
      'gas', 'water', 'phone', 'internet', 'shut off', 'disconnected', 'utility'
    ],
    urgencyIndicators: ['getting shut off', 'collections', 'overdraft', 'no money', 'disconnected', 'shut off']
  }
};

// Additional context patterns that increase confidence
const CONTEXT_BOOSTERS = [
  'need help with', 'struggling with', 'don\'t know how to',
  'can\'t figure out', 'any resources for', 'where can i',
  'do you know anyone who', 'is there a place that',
  'having trouble with', 'dealing with', 'going through'
];

// Phrases that indicate the user is not asking for help
const NEGATIVE_INDICATORS = [
  'helped someone', 'my friend', 'asking for a friend',
  'just wondering', 'hypothetically', 'in the past',
  'used to', 'was able to', 'figured out', 'resolved'
];

/**
 * Analyze a message for potential resource needs
 */
export function detectNeeds(
  message: string, 
  conversationHistory: { role: string; content: string }[] = []
): NeedDetectionResult {
  const lowerMessage = message.toLowerCase();
  const detectedNeeds: DetectedNeed[] = [];
  
  // Check for negative indicators that suggest this isn't a personal need
  const hasNegativeIndicator = NEGATIVE_INDICATORS.some(phrase => 
    lowerMessage.includes(phrase)
  );
  
  if (hasNegativeIndicator) {
    return {
      needsDetected: [],
      hasNeeds: false,
      shouldOfferResources: false
    };
  }
  
  // Check each need category (only the 8 mandated categories)
  for (const category of NEED_CATEGORIES) {
    const patterns = NEED_PATTERNS[category];
    // Word-boundary match — substring matching incorrectly fires on
    // accidental overlaps (e.g. food keyword "eat" matching "wEATher",
    // employment keyword "work" matching "homeWORK"). Apostrophes and
    // spaces inside keywords need to be preserved as-is, so we escape
    // regex metachars and wrap in `\b...\b` only when the keyword starts
    // and ends with a word char.
    const matchedKeywords = patterns.keywords.filter(kw => {
      const lower = kw.toLowerCase();
      const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const startsWord = /^\w/.test(lower);
      const endsWord = /\w$/.test(lower);
      const re = new RegExp(
        `${startsWord ? "\\b" : ""}${escaped}${endsWord ? "\\b" : ""}`,
        "i"
      );
      return re.test(lowerMessage);
    });
    
    if (matchedKeywords.length > 0) {
      // Calculate base confidence from number of keyword matches.
      // A single high-signal phrase (e.g. "evicted", "homeless", "need a
      // place") is enough to clear the meaningful-need threshold below; we
      // start at 35 per match so one keyword still surfaces, and additional
      // matches stack toward the 80 cap.
      let confidence = Math.min(matchedKeywords.length * 35, 80);
      // A keyword that also appears in this category's urgencyIndicators
      // is a strong personal signal (not a passing reference) — bump it.
      const matchedAlsoUrgent = matchedKeywords.some((kw) =>
        patterns.urgencyIndicators.includes(kw.toLowerCase())
      );
      if (matchedAlsoUrgent) {
        confidence += 10;
      }
      
      // Boost confidence if context phrases are present
      const hasContextBooster = CONTEXT_BOOSTERS.some(phrase => 
        lowerMessage.includes(phrase)
      );
      if (hasContextBooster) {
        confidence += 15;
      }
      
      // Check conversation history for reinforcement
      const recentMessages = conversationHistory.slice(-5);
      const historyMentions = recentMessages.filter(msg => 
        patterns.keywords.some(kw => 
          msg.content.toLowerCase().includes(kw.toLowerCase())
        )
      );
      if (historyMentions.length > 0) {
        confidence += historyMentions.length * 5;
      }
      
      // Cap confidence at 95
      confidence = Math.min(confidence, 95);
      
      // Determine urgency
      const hasUrgencyIndicator = patterns.urgencyIndicators.some(ind => 
        lowerMessage.includes(ind.toLowerCase())
      );
      
      let urgency: DetectedNeed['urgency'] = 'medium';
      if (hasUrgencyIndicator) {
        // Housing with safety keywords is crisis level
        if (category === 'housing' && ['not safe', 'abuse', 'threatened'].some(k => lowerMessage.includes(k))) {
          urgency = 'crisis';
        } else {
          urgency = 'high';
        }
      } else if (confidence < 50) {
        urgency = 'low';
      }
      
      detectedNeeds.push({
        category,
        confidence,
        urgency,
        triggerPhrases: matchedKeywords,
        context: extractContext(message, matchedKeywords[0])
      });
    }
  }
  
  // Sort by confidence and urgency
  detectedNeeds.sort((a, b) => {
    // Prioritize crisis/high urgency
    const urgencyOrder = { crisis: 0, high: 1, medium: 2, low: 3 };
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return b.confidence - a.confidence;
  });
  
  // Filter to meaningful detections — single keyword now scores 35, so the
  // threshold sits just below that to admit clear single-phrase asks while
  // still rejecting incidental matches under 30.
  const meaningfulNeeds = detectedNeeds.filter(n => n.confidence >= 35);
  
  return {
    needsDetected: meaningfulNeeds,
    hasNeeds: meaningfulNeeds.length > 0,
    primaryNeed: meaningfulNeeds[0],
    shouldOfferResources: meaningfulNeeds.length > 0 && meaningfulNeeds[0].confidence > 50
  };
}

/**
 * Extract context around a keyword
 */
function extractContext(message: string, keyword: string): string {
  const lowerMessage = message.toLowerCase();
  const index = lowerMessage.indexOf(keyword.toLowerCase());
  if (index === -1) return message.slice(0, 100);
  
  const start = Math.max(0, index - 30);
  const end = Math.min(message.length, index + keyword.length + 50);
  
  return message.slice(start, end).trim();
}

/**
 * Generate natural language description of the detected need
 */
export function describeNeed(need: DetectedNeed): string {
  const descriptions: Record<NeedCategory, string> = {
    housing: 'housing or a place to stay',
    food: 'food or groceries',
    transportation: 'transportation or getting somewhere',
    mental_health: 'mental health or healthcare support',
    employment: 'finding work or job help',
    education: 'education or training',
    legal: 'legal help',
    financial: 'money, bills, or utilities'
  };
  
  return descriptions[need.category] || need.category;
}

/**
 * Get urgency level description for care team
 */
export function getUrgencyDescription(urgency: DetectedNeed['urgency']): string {
  switch (urgency) {
    case 'crisis': return 'CRISIS - Immediate intervention needed';
    case 'high': return 'HIGH - Time-sensitive, prioritize';
    case 'medium': return 'MEDIUM - Should be addressed soon';
    case 'low': return 'LOW - Can be addressed when possible';
  }
}

/**
 * Check if detected needs warrant immediate care team notification
 */
export function shouldEscalateToCareTeam(needs: DetectedNeed[]): boolean {
  return needs.some(need => 
    need.urgency === 'crisis' || 
    (need.urgency === 'high' && need.confidence > 70)
  );
}

/**
 * Validate that a category is one of the 8 mandated categories
 */
export function isValidNeedCategory(category: string): category is NeedCategory {
  return NEED_CATEGORIES.includes(category as NeedCategory);
}

/**
 * Generate a natural resource offer prompt for Siani
 * No clinical language - just guidance on how to bring it up like a friend
 */
export function generateResourceOfferPrompt(needs: DetectedNeed[]): string {
  if (needs.length === 0) return '';
  
  const primaryNeed = needs[0];
  const needDesc = describeNeed(primaryNeed);
  
  let prompt = `\n\nThey mentioned something about ${needDesc}. `;
  prompt += `You might know some people or places that could help with that. `;
  
  if (primaryNeed.urgency === 'crisis' || primaryNeed.urgency === 'high') {
    prompt += `This sounds pretty urgent. `;
  }
  
  prompt += `If it feels right, you could casually offer - like "hey, I might actually know something that could help with that" - but don't push it. Let them say if they want to hear about it.`;
  
  return prompt;
}
