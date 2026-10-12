/**
 * RESOURCE ENGINE
 * 
 * Smart resource matching and recommendation system that:
 * 1. Matches members to resources based on detected needs
 * 2. Scores organizations based on performance history
 * 3. Tracks outcomes to improve recommendations over time
 * 4. Penalizes organizations that create red tape or fail to follow through
 * 5. APIs for iteration and improvement based on end user feedback
 * 
 * This engine is designed to be called via API and improved iteratively
 * based on real-world referral outcomes.
 */

import type { Resource, Referral, ReferralOutcome, OrganizationIssue } from "@shared/schema";

// Barrier types that organizations create
export const BARRIER_TYPES = [
  'none',
  'documentation',    // Required excessive paperwork
  'eligibility',      // Changed or unclear eligibility
  'wait_time',        // Long wait times
  'unresponsive',     // Didn't respond to member
  'denied',           // Denied service unfairly
  'closed',           // Closed/no longer accepting
  'rude_staff',       // Treated member poorly
  'wrong_info',       // Info was incorrect
  'discrimination',   // Discriminatory treatment
  'other'
] as const;

export type BarrierType = typeof BARRIER_TYPES[number];

// Issue types for organization accountability
export const ISSUE_TYPES = [
  'unresponsive',
  'excessive_docs',
  'denied_unfairly',
  'rude_staff',
  'closed_unexpectedly',
  'wrong_info',
  'long_wait',
  'discrimination',
  'other'
] as const;

export type IssueType = typeof ISSUE_TYPES[number];

// Severity levels for issues
export const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type SeverityLevel = typeof SEVERITY_LEVELS[number];

// Result types for referral outcomes
export const OUTCOME_RESULTS = [
  'success',          // Member got the help they needed
  'partial',          // Some help but not complete
  'no_contact',       // Organization never responded
  'waitlist',         // Put on waitlist (may still help later)
  'not_eligible',     // Member didn't meet criteria
  'org_failed',       // Organization failed to deliver
  'user_declined',    // Member chose not to proceed
  'other'
] as const;

export type OutcomeResult = typeof OUTCOME_RESULTS[number];

/**
 * Resource scoring weights - these can be tuned over time
 * Higher weights = more impact on final score
 */
export const SCORING_WEIGHTS = {
  // Positive factors
  successRate: 0.35,        // Success rate is most important
  reliabilityScore: 0.25,   // Track record of following through
  responseTime: 0.15,       // How fast they respond
  userRating: 0.15,         // Member satisfaction
  
  // Negative factors (penalty multipliers)
  redTapePenalty: -0.20,    // Excessive requirements
  issuePenalty: -0.15,      // Each issue reduces score
  recentFailurePenalty: -0.25, // Recent failures hurt more
};

/**
 * Resource match result with scoring breakdown
 */
export interface ResourceMatch {
  resource: Resource;
  matchScore: number;         // 0-100 overall match
  reliabilityScore: number;   // 0-100 how reliable is this org
  redTapeScore: number;       // 0-100 how much bureaucracy
  recentOutcomes: {
    successes: number;
    failures: number;
    lastSuccessAt?: Date;
    lastFailureAt?: Date;
  };
  warnings: string[];         // Any warnings about this resource
  recommendation: 'strong' | 'moderate' | 'weak' | 'avoid';
}

/**
 * Resource engine configuration - can be updated via API
 */
export interface EngineConfig {
  // Thresholds
  minReliabilityScore: number;      // Below this, warn member
  maxRedTapeScore: number;          // Above this, deprioritize
  minSuccessRate: number;           // Below this, flag for review
  
  // Time windows
  recentWindowDays: number;         // How far back to look for "recent"
  
  // Penalties
  failurePenaltyPerIncident: number;  // How much each failure hurts score
  issuePenaltyPerReport: number;      // How much each issue report hurts
  unresponsivePenalty: number;        // Extra penalty for no response
}

// Default configuration - can be updated via API
export const DEFAULT_CONFIG: EngineConfig = {
  minReliabilityScore: 50,
  maxRedTapeScore: 60,
  minSuccessRate: 0.5,
  recentWindowDays: 90,
  failurePenaltyPerIncident: 5,
  issuePenaltyPerReport: 3,
  unresponsivePenalty: 10,
};

let currentConfig: EngineConfig = { ...DEFAULT_CONFIG };

/**
 * Get current engine configuration
 */
export function getEngineConfig(): EngineConfig {
  return { ...currentConfig };
}

/**
 * Update engine configuration (for iteration/improvement)
 */
export function updateEngineConfig(updates: Partial<EngineConfig>): EngineConfig {
  currentConfig = { ...currentConfig, ...updates };
  return { ...currentConfig };
}

/**
 * Calculate resource match score based on member needs and org performance
 */
export function calculateResourceScore(
  resource: Resource,
  outcomes: ReferralOutcome[] = [],
  issues: OrganizationIssue[] = []
): ResourceMatch {
  const warnings: string[] = [];
  
  // Base scores from resource data
  const successRate = resource.successRate ?? 50;
  const reliabilityScore = resource.reliabilityScore ?? 100;
  const redTapeScore = resource.redTapeScore ?? 0;
  const totalReferrals = resource.totalReferrals ?? 0;
  
  // Calculate recent outcomes
  const recentWindow = new Date();
  recentWindow.setDate(recentWindow.getDate() - currentConfig.recentWindowDays);
  
  const recentOutcomes = outcomes.filter(o => 
    new Date(o.createdAt) >= recentWindow
  );
  
  const recentSuccesses = recentOutcomes.filter(o => 
    o.result === 'success' || o.result === 'partial'
  ).length;
  
  const recentFailures = recentOutcomes.filter(o => 
    o.result === 'no_contact' || o.result === 'org_failed'
  ).length;
  
  // Calculate score components
  let matchScore = 50; // Start at baseline
  
  // Add success rate contribution (0-35 points)
  matchScore += (successRate / 100) * SCORING_WEIGHTS.successRate * 100;
  
  // Add reliability contribution (0-25 points)
  matchScore += (reliabilityScore / 100) * SCORING_WEIGHTS.reliabilityScore * 100;
  
  // Add response time contribution (0-15 points)
  const avgResponseDays = resource.avgResponseDays ?? 7;
  const responseScore = Math.max(0, 100 - (avgResponseDays * 10)); // 10 points per day penalty
  matchScore += (responseScore / 100) * SCORING_WEIGHTS.responseTime * 100;
  
  // Apply red tape penalty
  if (redTapeScore > 0) {
    matchScore += (redTapeScore / 100) * SCORING_WEIGHTS.redTapePenalty * 100;
  }
  
  // Apply issue penalty
  const openIssues = issues.filter(i => i.status === 'open' || i.status === 'investigating');
  if (openIssues.length > 0) {
    matchScore -= openIssues.length * currentConfig.issuePenaltyPerReport;
    warnings.push(`${openIssues.length} open issue(s) reported`);
  }
  
  // Apply recent failure penalty (failures in last 90 days hurt more)
  if (recentFailures > 0) {
    matchScore -= recentFailures * currentConfig.failurePenaltyPerIncident;
    matchScore += SCORING_WEIGHTS.recentFailurePenalty * 100 * (recentFailures / Math.max(recentSuccesses + recentFailures, 1));
    warnings.push(`${recentFailures} recent failure(s)`);
  }
  
  // Check for unresponsive pattern
  const unresponsiveOutcomes = recentOutcomes.filter(o => o.result === 'no_contact');
  if (unresponsiveOutcomes.length >= 2) {
    matchScore -= currentConfig.unresponsivePenalty;
    warnings.push('Pattern of not responding');
  }
  
  // Check thresholds and add warnings
  if (reliabilityScore < currentConfig.minReliabilityScore) {
    warnings.push('Low reliability score');
  }
  
  if (redTapeScore > currentConfig.maxRedTapeScore) {
    warnings.push('May require extensive documentation');
  }
  
  if (successRate < currentConfig.minSuccessRate * 100 && totalReferrals > 5) {
    warnings.push('Below average success rate');
  }
  
  if (resource.isFlagged) {
    matchScore -= 20;
    warnings.push(resource.flagReason || 'Flagged for review');
  }
  
  // Clamp score to 0-100
  matchScore = Math.max(0, Math.min(100, matchScore));
  
  // Determine recommendation level
  let recommendation: ResourceMatch['recommendation'];
  if (matchScore >= 75) {
    recommendation = 'strong';
  } else if (matchScore >= 55) {
    recommendation = 'moderate';
  } else if (matchScore >= 35) {
    recommendation = 'weak';
  } else {
    recommendation = 'avoid';
  }
  
  // Find last success/failure dates
  const lastSuccess = outcomes
    .filter(o => o.result === 'success')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  
  const lastFailure = outcomes
    .filter(o => o.result === 'org_failed' || o.result === 'no_contact')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  
  return {
    resource,
    matchScore: Math.round(matchScore),
    reliabilityScore,
    redTapeScore,
    recentOutcomes: {
      successes: recentSuccesses,
      failures: recentFailures,
      lastSuccessAt: lastSuccess ? new Date(lastSuccess.createdAt) : undefined,
      lastFailureAt: lastFailure ? new Date(lastFailure.createdAt) : undefined,
    },
    warnings,
    recommendation,
  };
}

/**
 * Rank resources by match score for a given category
 */
export function rankResources(
  resources: Resource[],
  outcomesMap: Map<string, ReferralOutcome[]>,
  issuesMap: Map<string, OrganizationIssue[]>
): ResourceMatch[] {
  return resources
    .map(resource => calculateResourceScore(
      resource,
      outcomesMap.get(resource.id) || [],
      issuesMap.get(resource.id) || []
    ))
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Calculate updated org metrics after a referral outcome
 * This is called after each outcome to update resource performance data
 */
export function calculateUpdatedMetrics(
  resource: Resource,
  newOutcome: ReferralOutcome
): Partial<Resource> {
  const updates: Partial<Resource> = {};
  
  const totalReferrals = (resource.totalReferrals ?? 0) + 1;
  updates.totalReferrals = totalReferrals;
  
  // Update success/failure counts
  if (newOutcome.result === 'success') {
    updates.successfulReferrals = (resource.successfulReferrals ?? 0) + 1;
  } else if (newOutcome.result === 'org_failed' || newOutcome.result === 'no_contact') {
    updates.failedReferrals = (resource.failedReferrals ?? 0) + 1;
  }
  
  // Recalculate success rate
  const successful = updates.successfulReferrals ?? resource.successfulReferrals ?? 0;
  updates.successRate = totalReferrals > 0 ? (successful / totalReferrals) * 100 : null;
  
  // Update response time average
  if (newOutcome.orgResponseDays !== null && newOutcome.orgResponseDays !== undefined) {
    const currentAvg = resource.avgResponseDays ?? 0;
    const prevTotal = (resource.totalReferrals ?? 0);
    if (prevTotal > 0) {
      updates.avgResponseDays = ((currentAvg * prevTotal) + newOutcome.orgResponseDays) / totalReferrals;
    } else {
      updates.avgResponseDays = newOutcome.orgResponseDays;
    }
  }
  
  // Update completion time average
  if (newOutcome.orgCompletionDays !== null && newOutcome.orgCompletionDays !== undefined) {
    const currentAvg = resource.avgCompletionDays ?? 0;
    const prevTotal = (resource.totalReferrals ?? 0);
    if (prevTotal > 0) {
      updates.avgCompletionDays = ((currentAvg * prevTotal) + newOutcome.orgCompletionDays) / totalReferrals;
    } else {
      updates.avgCompletionDays = newOutcome.orgCompletionDays;
    }
  }
  
  // Update red tape score based on barrier type
  if (newOutcome.barrierType && newOutcome.barrierType !== 'none') {
    const barrierWeight = getBarrierWeight(newOutcome.barrierType as BarrierType);
    const currentRedTape = resource.redTapeScore ?? 0;
    // Exponential moving average for red tape score
    updates.redTapeScore = Math.min(100, Math.round(currentRedTape * 0.8 + barrierWeight * 0.2));
  }
  
  // Update reliability score based on outcome
  const currentReliability = resource.reliabilityScore ?? 100;
  if (newOutcome.result === 'success') {
    // Successful outcomes improve reliability
    updates.reliabilityScore = Math.min(100, currentReliability + 2);
  } else if (newOutcome.result === 'org_failed' || newOutcome.result === 'no_contact') {
    // Failures hurt reliability more than successes help
    updates.reliabilityScore = Math.max(0, currentReliability - 5);
  }
  
  updates.updatedAt = new Date();
  
  return updates;
}

/**
 * Calculate updated org metrics after an issue is reported
 */
export function calculateIssueImpact(
  resource: Resource,
  issue: OrganizationIssue
): Partial<Resource> {
  const updates: Partial<Resource> = {};
  
  updates.issueCount = (resource.issueCount ?? 0) + 1;
  updates.lastIssueAt = new Date();
  
  // Reduce reliability based on severity
  const severityImpact = getSeverityImpact(issue.severity as SeverityLevel);
  const currentReliability = resource.reliabilityScore ?? 100;
  updates.reliabilityScore = Math.max(0, currentReliability - severityImpact);
  
  // Increase red tape score for documentation-related issues
  if (issue.issueType === 'excessive_docs' || issue.issueType === 'wrong_info') {
    const currentRedTape = resource.redTapeScore ?? 0;
    updates.redTapeScore = Math.min(100, currentRedTape + 10);
  }
  
  // Flag resource if too many issues or critical severity
  if ((updates.issueCount ?? 0) >= 3 || issue.severity === 'critical') {
    updates.isFlagged = true;
    updates.flagReason = issue.severity === 'critical' 
      ? `Critical issue: ${issue.issueType}`
      : `Multiple issues reported (${updates.issueCount})`;
  }
  
  updates.updatedAt = new Date();
  
  return updates;
}

/**
 * Get weight for barrier types (how much they should affect red tape score)
 */
function getBarrierWeight(barrierType: BarrierType): number {
  const weights: Record<BarrierType, number> = {
    none: 0,
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
  return weights[barrierType] ?? 15;
}

/**
 * Get impact for severity levels (how much they affect reliability)
 */
function getSeverityImpact(severity: SeverityLevel): number {
  const impacts: Record<SeverityLevel, number> = {
    low: 3,
    medium: 7,
    high: 15,
    critical: 25,
  };
  return impacts[severity] ?? 7;
}

/**
 * Generate analytics for organization performance
 */
export interface OrgPerformanceAnalytics {
  resourceId: string;
  resourceName: string;
  totalReferrals: number;
  successRate: number;
  reliabilityScore: number;
  redTapeScore: number;
  avgResponseDays: number | null;
  avgCompletionDays: number | null;
  openIssues: number;
  recommendation: 'keep' | 'monitor' | 'review' | 'remove';
  trends: {
    successRateTrend: 'improving' | 'stable' | 'declining';
    responseTrend: 'faster' | 'stable' | 'slower';
  };
}

export function generateOrgAnalytics(
  resource: Resource,
  recentOutcomes: ReferralOutcome[],
  openIssueCount: number
): OrgPerformanceAnalytics {
  const successRate = resource.successRate ?? 50;
  const reliabilityScore = resource.reliabilityScore ?? 100;
  const redTapeScore = resource.redTapeScore ?? 0;
  
  // Determine recommendation
  let recommendation: OrgPerformanceAnalytics['recommendation'];
  if (resource.isFlagged) {
    recommendation = 'review';
  } else if (reliabilityScore < 40 || successRate < 30) {
    recommendation = 'remove';
  } else if (reliabilityScore < 60 || successRate < 50 || openIssueCount > 0) {
    recommendation = 'monitor';
  } else {
    recommendation = 'keep';
  }
  
  // Simple trend analysis (would be more sophisticated in production)
  const halfwayPoint = Math.floor(recentOutcomes.length / 2);
  const firstHalf = recentOutcomes.slice(0, halfwayPoint);
  const secondHalf = recentOutcomes.slice(halfwayPoint);
  
  const firstHalfSuccessRate = firstHalf.length > 0 
    ? firstHalf.filter(o => o.result === 'success').length / firstHalf.length 
    : 0;
  const secondHalfSuccessRate = secondHalf.length > 0 
    ? secondHalf.filter(o => o.result === 'success').length / secondHalf.length 
    : 0;
  
  let successRateTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (secondHalfSuccessRate > firstHalfSuccessRate + 0.1) {
    successRateTrend = 'improving';
  } else if (secondHalfSuccessRate < firstHalfSuccessRate - 0.1) {
    successRateTrend = 'declining';
  }
  
  return {
    resourceId: resource.id,
    resourceName: resource.name,
    totalReferrals: resource.totalReferrals ?? 0,
    successRate,
    reliabilityScore,
    redTapeScore,
    avgResponseDays: resource.avgResponseDays ?? null,
    avgCompletionDays: resource.avgCompletionDays ?? null,
    openIssues: openIssueCount,
    recommendation,
    trends: {
      successRateTrend,
      responseTrend: 'stable', // Simplified for now
    },
  };
}
