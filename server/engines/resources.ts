/**
 * RESOURCE MATCHING SERVICE
 * 
 * Matches detected needs to available resources in the database.
 * Handles resource recommendations and referral creation.
 * Now with location-aware filtering to only show resources that serve the user's area.
 */

import type { Resource, Referral, InsertReferral, User } from "@shared/schema";
import type { NeedCategory, DetectedNeed } from "./needs";

export interface ResourceMatch {
  resource: Resource;
  matchScore: number; // 0-100
  matchReason: string;
  isRecommended: boolean;
  locationMatch?: 'exact' | 'nearby' | 'regional' | 'nationwide' | 'unknown';
}

export interface UserLocation {
  zipCode?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ReferralContext {
  userId: string;
  need: DetectedNeed;
  conversationId?: string;
  messageId?: string;
  signalId?: string;
  goalId?: string;
  userLocation?: UserLocation;
}

/**
 * Check if a resource serves a user's location
 * Returns match type: 'exact' (zip match), 'nearby' (city match), 'regional' (state match), 
 * 'nationwide' (serves everywhere), or null (doesn't serve this location)
 */
export function checkLocationMatch(
  resource: Resource,
  userLocation: UserLocation
): 'exact' | 'nearby' | 'regional' | 'nationwide' | null {
  // Nationwide resources serve everyone
  if (resource.isNationwide) {
    return 'nationwide';
  }
  
  // If user has no location, we can't filter - return null to indicate unknown
  if (!userLocation.zipCode && !userLocation.city && !userLocation.state) {
    return null;
  }
  
  // Check zip code match (most specific)
  if (userLocation.zipCode && resource.serviceZipCodes?.length) {
    if (resource.serviceZipCodes.includes(userLocation.zipCode)) {
      return 'exact';
    }
  }
  
  // Check city match
  if (userLocation.city && resource.serviceCities?.length) {
    const userCityLower = userLocation.city.toLowerCase();
    if (resource.serviceCities.some(c => c.toLowerCase() === userCityLower)) {
      return 'nearby';
    }
  }
  
  // Check state match
  if (userLocation.state && resource.serviceStates?.length) {
    const userStateUpper = userLocation.state.toUpperCase();
    if (resource.serviceStates.some(s => s.toUpperCase() === userStateUpper)) {
      return 'regional';
    }
  }
  
  // No match found
  return null;
}

/**
 * Filter resources by user location
 * Returns only resources that serve the user's area
 */
export function filterResourcesByLocation(
  resources: Resource[],
  userLocation: UserLocation
): Resource[] {
  // If no user location, return all resources (can't filter)
  if (!userLocation.zipCode && !userLocation.city && !userLocation.state) {
    return resources;
  }
  
  return resources.filter(resource => {
    const match = checkLocationMatch(resource, userLocation);
    // Include if there's any location match, or if resource has no location data (legacy)
    return match !== null || (!resource.serviceZipCodes?.length && 
                               !resource.serviceCities?.length && 
                               !resource.serviceStates?.length &&
                               !resource.isNationwide);
  });
}

/**
 * Match resources to a detected need (legacy - no location filtering)
 */
export function matchResourcesToNeed(
  need: DetectedNeed,
  resources: Resource[]
): ResourceMatch[] {
  const matches: ResourceMatch[] = [];
  
  for (const resource of resources) {
    // Direct category match
    if (resource.category === need.category) {
      const score = calculateMatchScore(resource, need);
      matches.push({
        resource,
        matchScore: score,
        matchReason: `Direct match for ${need.category}`,
        isRecommended: score >= 70
      });
      continue;
    }
    
    // Related category matches
    const relatedCategories = getRelatedCategories(need.category);
    if (relatedCategories.includes(resource.category as NeedCategory)) {
      const score = calculateMatchScore(resource, need) * 0.7; // 30% penalty for indirect match
      matches.push({
        resource,
        matchScore: score,
        matchReason: `Related category: ${resource.category}`,
        isRecommended: score >= 70
      });
    }
  }
  
  // Sort by match score descending
  matches.sort((a, b) => b.matchScore - a.matchScore);
  
  return matches;
}

/**
 * LOCATION-AWARE RESOURCE MATCHING
 * Primary function Siani should use - filters by location first, then matches by need
 * This ensures users only see resources that actually serve their area
 */
export function matchResourcesWithLocation(
  need: DetectedNeed,
  resources: Resource[],
  userLocation: UserLocation
): ResourceMatch[] {
  // First filter by location
  const localResources = filterResourcesByLocation(resources, userLocation);
  
  const matches: ResourceMatch[] = [];
  
  for (const resource of localResources) {
    const locationMatch = checkLocationMatch(resource, userLocation);
    
    // Direct category match
    if (resource.category === need.category) {
      let score = calculateMatchScore(resource, need);
      
      // Boost score based on location proximity
      if (locationMatch === 'exact') score += 10;
      else if (locationMatch === 'nearby') score += 5;
      
      matches.push({
        resource,
        matchScore: Math.min(score, 100),
        matchReason: `Direct match for ${need.category}`,
        isRecommended: score >= 70,
        locationMatch: locationMatch || 'unknown'
      });
      continue;
    }
    
    // Related category matches
    const relatedCategories = getRelatedCategories(need.category);
    if (relatedCategories.includes(resource.category as NeedCategory)) {
      let score = calculateMatchScore(resource, need) * 0.7;
      
      if (locationMatch === 'exact') score += 10;
      else if (locationMatch === 'nearby') score += 5;
      
      matches.push({
        resource,
        matchScore: Math.min(score, 100),
        matchReason: `Related category: ${resource.category}`,
        isRecommended: score >= 70,
        locationMatch: locationMatch || 'unknown'
      });
    }
  }
  
  // Sort by match score descending, with location boost
  matches.sort((a, b) => {
    // Prioritize exact location matches
    const locOrder = { exact: 0, nearby: 1, regional: 2, nationwide: 3, unknown: 4 };
    const locDiff = (locOrder[a.locationMatch || 'unknown'] || 4) - (locOrder[b.locationMatch || 'unknown'] || 4);
    if (locDiff !== 0) return locDiff;
    return b.matchScore - a.matchScore;
  });
  
  return matches;
}

/**
 * Get user-friendly location description for Siani to use in responses
 */
export function describeLocationMatch(match: ResourceMatch['locationMatch']): string {
  switch (match) {
    case 'exact': return 'in your neighborhood';
    case 'nearby': return 'in your city';
    case 'regional': return 'in your state';
    case 'nationwide': return 'available everywhere';
    default: return '';
  }
}

/**
 * Calculate match score based on resource attributes
 */
function calculateMatchScore(resource: Resource, need: DetectedNeed): number {
  let score = 50; // Base score for category match
  
  // Boost for verified resources
  if (resource.isVerified) {
    score += 20;
  }
  
  // Boost if description mentions keywords from need
  if (resource.description) {
    const descLower = resource.description.toLowerCase();
    const keywordMatches = need.triggerPhrases.filter(phrase => 
      descLower.includes(phrase.toLowerCase())
    );
    score += keywordMatches.length * 5;
  }
  
  // Urgency matching - crisis resources get priority for crisis needs
  if (need.urgency === 'crisis' || need.urgency === 'high') {
    // Check if resource description mentions emergency/crisis
    if (resource.description?.toLowerCase().includes('emergency') ||
        resource.description?.toLowerCase().includes('crisis') ||
        resource.description?.toLowerCase().includes('24/7') ||
        resource.description?.toLowerCase().includes('immediate')) {
      score += 15;
    }
  }
  
  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Get categories that are related to the primary need
 * Only uses the 8 mandated NeedCategory types
 */
function getRelatedCategories(category: NeedCategory): NeedCategory[] {
  const relations: Record<NeedCategory, NeedCategory[]> = {
    housing: ['financial', 'legal'],
    food: ['financial'],
    transportation: ['employment'],
    mental_health: ['legal'],
    employment: ['education', 'transportation'],
    education: ['employment', 'financial'],
    legal: ['housing', 'financial'],
    financial: ['housing', 'food']
  };
  
  return relations[category] || [];
}

/**
 * Build a referral record from context
 */
export function buildReferral(
  context: ReferralContext,
  resource: Resource,
  source: 'siani' | 'care' | 'self' = 'siani'
): InsertReferral {
  // Determine priority based on need urgency
  let priority: 'low' | 'normal' | 'high' = 'normal';
  if (context.need.urgency === 'crisis') {
    priority = 'high';
  } else if (context.need.urgency === 'high') {
    priority = 'high';
  } else if (context.need.urgency === 'low') {
    priority = 'low';
  }
  
  // Set due date based on urgency
  let dueDate: Date | undefined;
  const now = new Date();
  if (context.need.urgency === 'crisis') {
    dueDate = now; // Same day
  } else if (context.need.urgency === 'high') {
    dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
  } else if (context.need.urgency === 'medium') {
    dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week
  }
  
  return {
    userId: context.userId,
    resourceId: resource.id,
    source,
    linkedGoalId: context.goalId || undefined,
    linkedSignalId: context.signalId || undefined,
    state: 'proposed',
    priority,
    dueDate,
    notes: `Auto-generated from conversation. Need detected: ${context.need.category} (${context.need.confidence}% confidence). Context: ${context.need.context || context.need.triggerPhrases.join(', ')}`
  };
}

/**
 * Get follow-up questions for a referral based on its state
 */
export function getReferralFollowUpPrompt(referral: Referral & { resource?: Resource }): string {
  const resourceName = referral.resource?.name || 'that resource';
  
  switch (referral.state) {
    case 'proposed':
      return `[Follow-up on proposed referral to ${resourceName}. Ask if they want to learn more about it in a casual way.]`;
      
    case 'offered':
      return `[You previously shared info about ${resourceName}. Check if they had a chance to look into it, without pressure.]`;
      
    case 'accepted':
      return `[They said they wanted to try ${resourceName}. Ask how it's going - did they reach out yet?]`;
      
    case 'scheduled':
      return `[They have something scheduled with ${resourceName}. Check in on how they're feeling about it.]`;
      
    case 'in_progress':
      return `[They're working with ${resourceName}. Ask how it's going - any wins or challenges?]`;
      
    case 'completed':
      return `[They completed their work with ${resourceName}. Celebrate the win! Ask how it went.]`;
      
    case 'could_not_complete':
      return `[They had trouble with ${resourceName}. Acknowledge that without judgment. Ask if they want to try something else.]`;
      
    case 'declined':
      return `[They decided not to pursue ${resourceName}. That's okay. Be curious if there's something else that might help.]`;
      
    default:
      return '';
  }
}

/**
 * Get next steps for a referral based on current state
 */
export function getNextSteps(state: Referral['state']): string[] {
  switch (state) {
    case 'proposed':
      return [
        'Share more details about the resource',
        'Help them understand what to expect',
        'Offer to help them make first contact'
      ];
    case 'offered':
      return [
        'Follow up to see if they looked into it',
        'Offer to answer any questions',
        'Help them take the first step'
      ];
    case 'accepted':
      return [
        'Help them make the call/visit',
        'Prepare them for what to expect',
        'Set a reminder to check in'
      ];
    case 'scheduled':
      return [
        'Remind them about the appointment',
        'Help them prepare what to bring',
        'Check in after to hear how it went'
      ];
    case 'in_progress':
      return [
        'Celebrate progress',
        'Help troubleshoot any issues',
        'Keep them motivated'
      ];
    case 'completed':
      return [
        'Celebrate the completion',
        'Ask if there are other needs',
        'Document the outcome'
      ];
    case 'could_not_complete':
      return [
        'Understand what went wrong',
        'Find alternative resources',
        'Adjust approach if needed'
      ];
    case 'declined':
      return [
        'Respect their decision',
        'Keep the door open',
        'Explore other options if they want'
      ];
    default:
      return [];
  }
}

/**
 * Determine if a referral needs follow-up
 */
export function needsFollowUp(referral: Referral): boolean {
  // Completed and declined don't need active follow-up
  if (referral.state === 'completed' || referral.state === 'declined') {
    return false;
  }
  
  // Check time since last update
  const lastUpdate = new Date(referral.updatedAt);
  const now = new Date();
  const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Follow-up timing based on state and priority
  const followUpDays: Record<string, number> = {
    proposed: 1,
    offered: 2,
    accepted: 3,
    scheduled: 1, // Day before or after appointment
    in_progress: 7,
    could_not_complete: 2
  };
  
  const threshold = followUpDays[referral.state] || 3;
  
  // High priority referrals need faster follow-up
  if (referral.priority === 'high') {
    return daysSinceUpdate >= threshold * 0.5;
  }
  
  return daysSinceUpdate >= threshold;
}

/**
 * Format resource for display to user
 */
export function formatResourceForUser(resource: Resource): string {
  let formatted = `**${resource.name}**`;
  
  if (resource.description) {
    formatted += `\n${resource.description}`;
  }
  
  if (resource.contact) {
    const contact = resource.contact as any;
    if (contact.phone) formatted += `\nPhone: ${contact.phone}`;
    if (contact.website) formatted += `\nWebsite: ${contact.website}`;
    if (contact.address) formatted += `\nAddress: ${contact.address}`;
  }
  
  if (resource.eligibility) {
    formatted += `\nWho can use it: ${resource.eligibility}`;
  }
  
  if (resource.serviceArea) {
    formatted += `\nServes: ${resource.serviceArea}`;
  }
  
  return formatted;
}
