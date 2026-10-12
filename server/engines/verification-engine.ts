import { db } from '../db';
import { 
  referralVerifications, 
  referrals, 
  resources, 
  userVerificationReliability,
  verificationReminders,
  EVIDENCE_TRUST_WEIGHTS,
  type EvidenceType,
  type VerificationTier,
  type InsertReferralVerification
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Siani's validation questions for different referral outcomes
const VALIDATION_QUESTION_TEMPLATES = {
  completed: [
    "What was the name of the person who helped you there?",
    "Did they give you any paperwork or a confirmation number?",
    "When is your next appointment or follow-up?",
    "What steps did they say come next?",
  ],
  scheduled: [
    "When is your appointment?",
    "Where exactly is it located?",
    "Did they give you a confirmation or reference number?",
    "What should you bring with you?",
  ],
  in_progress: [
    "What stage are you at now?",
    "Who have you been working with?",
    "What's the next step?",
    "When do you expect to hear back?",
  ],
  could_not_complete: [
    "What happened when you tried to reach them?",
    "Did someone tell you why they couldn't help?",
    "Did they suggest anywhere else you could try?",
    "Would you like me to find another option for you?",
  ],
};

// Calculate confidence score based on user responses
interface ValidationResponse {
  questionAsked: string;
  userResponse: string;
  specificity: 'vague' | 'moderate' | 'specific';
}

export function calculateConfidenceFromResponses(
  responses: ValidationResponse[],
  userTrustScore: number = 70
): number {
  if (responses.length === 0) return 30;
  
  // Base score from specificity of responses
  const specificityScores = {
    vague: 20,
    moderate: 50,
    specific: 80,
  };
  
  const avgSpecificity = responses.reduce((sum, r) => 
    sum + specificityScores[r.specificity], 0) / responses.length;
  
  // Weight by user's historical trust score
  const trustMultiplier = userTrustScore / 100;
  
  // Final confidence = avg specificity * trust multiplier, capped at 100
  return Math.min(100, Math.round(avgSpecificity * trustMultiplier * 1.2));
}

// Analyze response specificity using simple heuristics
export function analyzeResponseSpecificity(response: string): 'vague' | 'moderate' | 'specific' {
  const words = response.toLowerCase().split(/\s+/);
  const wordCount = words.length;
  
  // Check for specific details
  const hasName = /\b(dr\.?|doctor|mr\.?|mrs\.?|ms\.?)\s+\w+|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(response);
  const hasDate = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d{1,2}:\d{2})/i.test(response);
  const hasNumber = /\b\d{4,}\b/.test(response); // Reference/confirmation numbers
  const hasAddress = /\b\d+\s+\w+\s+(st|street|ave|avenue|rd|road|blvd|boulevard|way|dr|drive)/i.test(response);
  
  // Vague responses
  const vaguePatterns = /\b(i don't know|not sure|maybe|i think|probably|idk|dunno|forgot)\b/i;
  if (vaguePatterns.test(response) || wordCount < 3) {
    return 'vague';
  }
  
  // Specific responses
  if ((hasName && hasDate) || (hasNumber && hasDate) || hasAddress || wordCount > 15) {
    return 'specific';
  }
  
  if (hasName || hasDate || hasNumber || wordCount > 8) {
    return 'moderate';
  }
  
  return 'vague';
}

// Get validation questions based on proposed state
export function getValidationQuestions(proposedState: string): string[] {
  const templates = VALIDATION_QUESTION_TEMPLATES[proposedState as keyof typeof VALIDATION_QUESTION_TEMPLATES];
  return templates || VALIDATION_QUESTION_TEMPLATES.completed;
}

// Create a verification record from Siani conversation
export async function createSianiVerification(
  referralId: string,
  userId: string,
  proposedState: string,
  responses: ValidationResponse[],
  userTrustScore?: number
): Promise<{ verification: any; shouldApplyStateChange: boolean }> {
  // Get referral and resource info
  const referral = await db.query.referrals.findFirst({
    where: eq(referrals.id, referralId),
  });
  
  if (!referral) throw new Error('Referral not found');
  
  // Get resource to check if it has SAINTE access
  const resource = await db.query.resources.findFirst({
    where: eq(resources.id, referral.resourceId),
  });
  
  // Calculate confidence
  const confidence = calculateConfidenceFromResponses(responses, userTrustScore);
  
  // Determine tier based on confidence and evidence
  let tier: VerificationTier = 'self_report';
  let evidenceType: EvidenceType = 'conversation';
  
  if (confidence >= 70) {
    tier = 'siani_validated';
    evidenceType = 'siani_validation';
  } else if (confidence >= 50) {
    evidenceType = 'voice_confirmation';
  }
  
  const trustWeight = EVIDENCE_TRUST_WEIGHTS[evidenceType];
  
  // Determine if state change should be applied
  // For external resources (no SAINTE access), we need higher confidence
  const isExternalResource = !resource?.hasSainteAccess;
  const confidenceThreshold = isExternalResource ? 60 : 50;
  const shouldApplyStateChange = confidence >= confidenceThreshold;
  
  // Create verification record
  const [verification] = await db.insert(referralVerifications).values({
    referralId,
    resourceId: referral.resourceId,
    userId,
    tier,
    evidenceType,
    confidenceScore: confidence,
    trustWeight,
    verifiedByType: 'siani',
    evidenceDescription: `Siani validation conversation with ${responses.length} follow-up questions answered`,
    evidenceMetadata: { responses, proposedState },
    outcome: shouldApplyStateChange ? 'confirmed' : 'inconclusive',
    outcomeNote: shouldApplyStateChange 
      ? `Verified with ${confidence}% confidence based on conversation details`
      : `Confidence ${confidence}% below threshold - additional evidence may help`,
    proposedState: shouldApplyStateChange ? proposedState : null,
    verifiedAt: new Date(),
  }).returning();
  
  // If confidence is high enough, update referral state
  if (shouldApplyStateChange && proposedState) {
    await db.update(referrals)
      .set({ 
        state: proposedState, 
        updatedAt: new Date() 
      })
      .where(eq(referrals.id, referralId));
    
    await db.update(referralVerifications)
      .set({ stateChangeApplied: true })
      .where(eq(referralVerifications.id, verification.id));
  }
  
  // Update user's verification reliability
  await updateUserReliability(userId, confidence >= 60);
  
  return { verification, shouldApplyStateChange };
}

// Create verification from evidence upload (photo/document)
export async function createEvidenceVerification(
  referralId: string,
  userId: string,
  evidenceType: 'photo' | 'document',
  evidenceUrl: string,
  proposedState?: string,
  description?: string
): Promise<any> {
  const referral = await db.query.referrals.findFirst({
    where: eq(referrals.id, referralId),
  });
  
  if (!referral) throw new Error('Referral not found');
  
  const trustWeight = EVIDENCE_TRUST_WEIGHTS[evidenceType];
  const confidence = trustWeight; // Evidence uploads have fixed confidence based on type
  
  const [verification] = await db.insert(referralVerifications).values({
    referralId,
    resourceId: referral.resourceId,
    userId,
    tier: 'evidence',
    evidenceType,
    confidenceScore: confidence,
    trustWeight,
    verifiedByType: 'user',
    verifiedByUserId: userId,
    evidenceDescription: description || `${evidenceType} evidence uploaded`,
    evidenceUrl,
    outcome: 'confirmed',
    outcomeNote: `${evidenceType} evidence provided`,
    proposedState,
    verifiedAt: new Date(),
  }).returning();
  
  // Apply state change if proposed
  if (proposedState) {
    await db.update(referrals)
      .set({ state: proposedState, updatedAt: new Date() })
      .where(eq(referrals.id, referralId));
    
    await db.update(referralVerifications)
      .set({ stateChangeApplied: true })
      .where(eq(referralVerifications.id, verification.id));
  }
  
  // Update user reliability (evidence upload is always a positive signal)
  await updateUserReliability(userId, true);
  
  return verification;
}

// Create location-based verification
export async function createLocationVerification(
  referralId: string,
  userId: string,
  locationData: { lat: number; lng: number; timestamp: Date }
): Promise<any> {
  const referral = await db.query.referrals.findFirst({
    where: eq(referrals.id, referralId),
    with: { resource: true }
  });
  
  if (!referral) throw new Error('Referral not found');
  
  const trustWeight = EVIDENCE_TRUST_WEIGHTS.location;
  
  const [verification] = await db.insert(referralVerifications).values({
    referralId,
    resourceId: referral.resourceId,
    userId,
    tier: 'evidence',
    evidenceType: 'location',
    confidenceScore: trustWeight,
    trustWeight,
    verifiedByType: 'system',
    evidenceDescription: 'User location detected near resource',
    evidenceMetadata: locationData,
    outcome: 'confirmed',
    outcomeNote: 'Location verification - user was near the resource location',
    verifiedAt: new Date(),
  }).returning();
  
  return verification;
}

// Update user's verification reliability score
async function updateUserReliability(userId: string, wasAccurate: boolean): Promise<void> {
  const existing = await db.query.userVerificationReliability.findFirst({
    where: eq(userVerificationReliability.userId, userId),
  });
  
  if (existing) {
    const newTotal = (existing.totalVerifications || 0) + 1;
    const newConfirmed = (existing.confirmedVerifications || 0) + (wasAccurate ? 1 : 0);
    const newContradicted = (existing.contradictedVerifications || 0) + (wasAccurate ? 0 : 1);
    const accuracy = (newConfirmed / newTotal) * 100;
    
    // Trust score moves slowly - weighted average with history
    const newTrustScore = Math.round(
      (existing.trustScore * 0.8) + ((wasAccurate ? 80 : 50) * 0.2)
    );
    
    await db.update(userVerificationReliability)
      .set({
        totalVerifications: newTotal,
        confirmedVerifications: newConfirmed,
        contradictedVerifications: newContradicted,
        trustScore: Math.max(30, Math.min(100, newTrustScore)),
        selfReportAccuracy: accuracy,
        lastVerificationAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userVerificationReliability.id, existing.id));
  } else {
    // Create new reliability record
    await db.insert(userVerificationReliability).values({
      userId,
      totalVerifications: 1,
      confirmedVerifications: wasAccurate ? 1 : 0,
      contradictedVerifications: wasAccurate ? 0 : 1,
      trustScore: wasAccurate ? 75 : 65,
      selfReportAccuracy: wasAccurate ? 100 : 0,
      lastVerificationAt: new Date(),
    });
  }
}

// Get user's current trust score
export async function getUserTrustScore(userId: string): Promise<number> {
  const reliability = await db.query.userVerificationReliability.findFirst({
    where: eq(userVerificationReliability.userId, userId),
  });
  
  return reliability?.trustScore || 70; // Default to 70 for new users
}

// Schedule a follow-up verification reminder
export async function scheduleVerificationReminder(
  referralId: string,
  userId: string,
  reminderType: 'siani_followup' | 'evidence_request',
  scheduledFor: Date,
  message?: string
): Promise<any> {
  const [reminder] = await db.insert(verificationReminders).values({
    referralId,
    userId,
    reminderType,
    message,
    scheduledFor,
    status: 'pending',
    attemptNumber: 1,
    maxAttempts: 3,
  }).returning();
  
  return reminder;
}

// Get pending verification reminders that are due
export async function getDueReminders(): Promise<any[]> {
  const now = new Date();
  
  const reminders = await db.query.verificationReminders.findMany({
    where: and(
      eq(verificationReminders.status, 'pending'),
    ),
  });
  
  // Filter for reminders that are due
  return reminders.filter(r => new Date(r.scheduledFor) <= now);
}

// Calculate cumulative confidence for a referral (combines all verification evidence)
export async function getReferralConfidence(referralId: string): Promise<{
  totalConfidence: number;
  verificationCount: number;
  highestTier: VerificationTier;
  evidenceTypes: EvidenceType[];
}> {
  const verifications = await db.query.referralVerifications.findMany({
    where: eq(referralVerifications.referralId, referralId),
  });
  
  if (verifications.length === 0) {
    return {
      totalConfidence: 0,
      verificationCount: 0,
      highestTier: 'self_report',
      evidenceTypes: [],
    };
  }
  
  // Combine confidence scores with diminishing returns for multiple pieces
  let combinedConfidence = 0;
  const tierPriority: Record<VerificationTier, number> = {
    self_report: 1,
    evidence: 2,
    siani_validated: 3,
  };
  
  let highestTierValue = 0;
  let highestTier: VerificationTier = 'self_report';
  const evidenceTypes: EvidenceType[] = [];
  
  // Sort by confidence, highest first
  const sorted = [...verifications].sort((a, b) => b.confidenceScore - a.confidenceScore);
  
  sorted.forEach((v, i) => {
    // Each additional verification adds less (diminishing returns)
    const weight = 1 / (i + 1);
    combinedConfidence += v.confidenceScore * weight;
    
    const tier = v.tier as VerificationTier;
    if (tierPriority[tier] > highestTierValue) {
      highestTierValue = tierPriority[tier];
      highestTier = tier;
    }
    
    if (!evidenceTypes.includes(v.evidenceType as EvidenceType)) {
      evidenceTypes.push(v.evidenceType as EvidenceType);
    }
  });
  
  // Normalize to 0-100
  const totalConfidence = Math.min(100, Math.round(combinedConfidence));
  
  return {
    totalConfidence,
    verificationCount: verifications.length,
    highestTier,
    evidenceTypes,
  };
}
