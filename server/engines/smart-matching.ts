/**
 * SMART RESOURCE MATCHING SERVICE
 * 
 * Unified matching service that integrates:
 * - HSDS Resource Index for multi-tier data sources
 * - Needs Detection for understanding user requests
 * - Adaptive scoring based on outcomes
 * - Crisis routing for immediate needs
 * 
 * This is the primary entry point for Siani's resource matching.
 */

import type { Resource, User, Referral, InsertReferral } from "@shared/schema";
import type { NeedCategory, DetectedNeed } from "./needs";
import { detectNeeds } from "./needs";
import { resourceIndex, type IndexedResource } from "./hsds-resource-index";
import { storage } from "../storage";

export interface SmartMatchRequest {
  userId: string;
  message?: string;
  detectedNeed?: DetectedNeed;
  zipCode?: string;
  city?: string;
  state?: string;
  limit?: number;
  includeCrisisResources?: boolean;
}

export interface SmartMatchResult {
  resources: MatchedResource[];
  detectedNeeds: DetectedNeed[];
  isCrisis: boolean;
  matchMethod: 'hsds_index' | 'database_fallback' | 'hybrid';
  totalAvailable: number;
}

export interface MatchedResource {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  contact: {
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
  } | null;
  matchScore: number;
  matchReason: string;
  isRecommended: boolean;
  locationMatch: 'exact' | 'nearby' | 'regional' | 'nationwide' | 'unknown';
  sourceTier: 'hsds' | '211' | 'commercial' | 'community';
  hasSainteAccess: boolean;
  reliabilityScore: number;
}

export class SmartMatcher {
  private initialized = false;
  
  /**
   * Initialize the matcher by loading resources from database into HSDS index
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const resources = await storage.getAllResources();
      console.log(`SmartMatcher: Loading ${resources.length} resources into HSDS index...`);
      
      let indexed = 0;
      for (const resource of resources) {
        try {
          resourceIndex.indexFromSainteResource(resource);
          indexed++;
        } catch (err) {
          console.warn(`SmartMatcher: Failed to index resource ${resource.id}:`, err);
        }
      }
      
      const stats = resourceIndex.getStats();
      console.log(`SmartMatcher: Indexed ${indexed}/${resources.length} resources`);
      console.log(`  Categories: ${JSON.stringify(stats.byCategory)}`);
      console.log(`  Crisis resources: ${stats.crisisResources}`);
      console.log(`  Geo-indexed locations: ${stats.geoIndexed}`);
      
      this.initialized = true;
    } catch (error: any) {
      console.error('SmartMatcher: Failed to load resources from database:', error?.message || error);
      console.log('SmartMatcher: Will rely on fallback database queries');
      this.initialized = true; // Mark as initialized so fallback works
    }
  }
  
  /**
   * Smart match resources to user needs
   * Primary entry point for Siani integration
   */
  async match(request: SmartMatchRequest): Promise<SmartMatchResult> {
    await this.initialize();
    
    const detectedNeeds: DetectedNeed[] = [];
    let isCrisis = false;
    
    if (request.message) {
      const needResult = detectNeeds(request.message);
      detectedNeeds.push(...needResult.needsDetected);
      isCrisis = needResult.needsDetected.some(n => n.urgency === 'crisis');
    }
    
    if (request.detectedNeed) {
      detectedNeeds.push(request.detectedNeed);
      if (request.detectedNeed.urgency === 'crisis') {
        isCrisis = true;
      }
    }
    
    const user = await this.getUserContext(request.userId);
    const userZip = request.zipCode || user?.location?.zipCode;
    const userCity = request.city || user?.location?.city;
    const userState = request.state || user?.location?.state;
    
    let resources: MatchedResource[] = [];
    let matchMethod: 'hsds_index' | 'database_fallback' | 'hybrid' = 'hsds_index';
    
    if (isCrisis) {
      resources = await this.getCrisisResources(userZip, userCity, userState);
    } else if (detectedNeeds.length > 0) {
      resources = await this.matchToNeeds(detectedNeeds, userZip, userCity, userState, user);
    } else {
      resources = await this.getTopResources(userZip, userCity, userState, request.limit || 5);
    }
    
    if (resources.length === 0) {
      matchMethod = 'database_fallback';
      resources = await this.fallbackToDatabaseMatch(
        detectedNeeds[0]?.category,
        userZip,
        userCity,
        userState,
        request.limit || 5
      );
    }
    
    if (request.includeCrisisResources && !isCrisis) {
      const crisisResources = await this.getCrisisResources(userZip, userCity, userState);
      const existingIds = new Set(resources.map(r => r.id));
      for (const cr of crisisResources) {
        if (!existingIds.has(cr.id)) {
          resources.push(cr);
        }
      }
    }
    
    return {
      resources: resources.slice(0, request.limit || 10),
      detectedNeeds,
      isCrisis,
      matchMethod,
      totalAvailable: resources.length,
    };
  }
  
  /**
   * Get user context for personalized matching
   */
  private async getUserContext(userId: string): Promise<{
    id: string;
    location?: { zipCode?: string; city?: string; state?: string };
    previousSuccesses?: string[];
    previousFailures?: string[];
  } | null> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return null;
      
      const referrals = await storage.getReferralsForUser(userId);
      const previousSuccesses = referrals
        .filter((r: { state: string }) => r.state === 'completed')
        .map((r: { resourceId: string }) => r.resourceId);
      const previousFailures = referrals
        .filter((r: { state: string }) => r.state === 'failed' || r.state === 'rejected')
        .map((r: { resourceId: string }) => r.resourceId);
      
      let location: { zipCode?: string; city?: string; state?: string } | undefined;
      try {
        const userLocation = await storage.getUserLocation(userId);
        if (userLocation) {
          location = {
            zipCode: userLocation.zipCode || undefined,
            city: userLocation.city || undefined,
            state: userLocation.state || undefined,
          };
        }
      } catch {
        // Location table may not exist yet
      }
      
      return {
        id: user.id,
        location,
        previousSuccesses,
        previousFailures,
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Get crisis resources (bypass normal ranking)
   */
  private async getCrisisResources(zipCode?: string, city?: string, state?: string): Promise<MatchedResource[]> {
    const indexed = resourceIndex.findResources(zipCode, undefined, true, city, state);
    return indexed.map(r => this.toMatchedResource(r, 100, 'Crisis resource - immediate help available'));
  }
  
  /**
   * Match resources to detected needs
   * Enhanced with city/state geographic matching
   */
  private async matchToNeeds(
    needs: DetectedNeed[],
    zipCode?: string,
    city?: string,
    state?: string,
    userContext?: {
      previousSuccesses?: string[];
      previousFailures?: string[];
    } | null
  ): Promise<MatchedResource[]> {
    const allMatches: MatchedResource[] = [];
    
    for (const need of needs) {
      // Pass city and state to findResources for proper geo matching
      const indexed = resourceIndex.findResources(
        zipCode, 
        need.category, 
        need.urgency === 'crisis',
        city,
        state
      );
      
      const ranked = resourceIndex.rankResources(indexed, {
        zipCode,
        city,
        state,
        previousSuccesses: userContext?.previousSuccesses,
        previousFailures: userContext?.previousFailures,
      });
      
      for (const r of ranked) {
        const matchScore = this.calculateNeedMatchScore(r, need);
        const reason = this.generateMatchReason(r, need);
        allMatches.push(this.toMatchedResource(r, matchScore, reason));
      }
    }
    
    allMatches.sort((a, b) => b.matchScore - a.matchScore);
    
    const seen = new Set<string>();
    return allMatches.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }
  
  /**
   * Get top resources without specific need
   */
  private async getTopResources(zipCode?: string, city?: string, state?: string, limit: number = 5): Promise<MatchedResource[]> {
    const indexed = resourceIndex.findResources(zipCode, undefined, false, city, state);
    const ranked = resourceIndex.rankResources(indexed, { zipCode, city, state });
    return ranked.slice(0, limit).map(r => 
      this.toMatchedResource(r, 50, 'Highly-rated local resource')
    );
  }
  
  /**
   * Fallback to database match if HSDS index is empty
   * Enhanced with proper geographic filtering (zip → city → county → state → nationwide)
   */
  private async fallbackToDatabaseMatch(
    category?: NeedCategory,
    zipCode?: string,
    city?: string,
    state?: string,
    limit: number = 5
  ): Promise<MatchedResource[]> {
    try {
      let resources: Resource[];
      if (category) {
        resources = await storage.getResourcesByCategory(category);
      } else {
        resources = await storage.getAllResources();
      }
      
      // Score and filter resources by geographic proximity
      const scored = resources.map(r => {
        let geoScore = 0;
        let locationMatch: 'exact' | 'nearby' | 'regional' | 'nationwide' | 'unknown' = 'unknown';
        
        // Check nationwide first
        if (r.isNationwide) {
          geoScore = 30;
          locationMatch = 'nationwide';
        }
        
        // State match (if user has state)
        if (state && r.serviceStates?.includes(state)) {
          geoScore = Math.max(geoScore, 50);
          locationMatch = 'regional';
        }
        
        // County match (Michigan counties are in serviceCounties)
        // Skip for now as we don't have user county
        
        // City match
        if (city && r.serviceCities?.some(c => 
          c.toLowerCase() === city.toLowerCase()
        )) {
          geoScore = Math.max(geoScore, 80);
          locationMatch = 'nearby';
        }
        
        // Zip code exact match
        if (zipCode && r.serviceZipCodes?.includes(zipCode)) {
          geoScore = 100;
          locationMatch = 'exact';
        }
        
        // If resource has no geo data at all AND we have geo context,
        // only include if it's in the same state or no state is known
        if (!r.isNationwide && 
            !r.serviceZipCodes?.length && 
            !r.serviceCities?.length && 
            !r.serviceCounties?.length && 
            !r.serviceStates?.length) {
          // No geo data - give low score but still include for nationwide resources
          geoScore = 10;
          locationMatch = 'unknown';
        }
        
        return { resource: r, geoScore, locationMatch };
      });
      
      // Filter to only resources with some geographic relevance
      // (score > 0, or nationwide, or matching state)
      const filtered = scored.filter(s => 
        s.geoScore >= 30 || // At least state-level match
        (!state && !city && !zipCode) // No geo context provided
      );
      
      // Sort by geo score (highest first), then by reliability
      filtered.sort((a, b) => {
        if (b.geoScore !== a.geoScore) return b.geoScore - a.geoScore;
        return (b.resource.reliabilityScore || 50) - (a.resource.reliabilityScore || 50);
      });
      
      return filtered.slice(0, limit).map(({ resource: r, geoScore, locationMatch }) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        contact: r.contact as MatchedResource['contact'],
        matchScore: 50 + (geoScore / 2), // 50-100 based on geo match
        matchReason: locationMatch === 'exact' ? 'Serves your area' :
                     locationMatch === 'nearby' ? 'Serves your city' :
                     locationMatch === 'regional' ? 'Serves your state' :
                     locationMatch === 'nationwide' ? 'Nationwide service' : 'Database match',
        isRecommended: geoScore >= 50,
        locationMatch,
        sourceTier: 'community' as const,
        hasSainteAccess: r.hasSainteAccess || false,
        reliabilityScore: r.reliabilityScore || 50,
      }));
    } catch {
      return [];
    }
  }
  
  /**
   * Calculate match score for a specific need
   */
  private calculateNeedMatchScore(resource: IndexedResource, need: DetectedNeed): number {
    let score = 50;
    
    score += resource.sainte.reliabilityScore * 0.3;
    score += resource.sainte.successRate * 0.2;
    
    if (resource.sainte.category === need.category) {
      score += 20;
    }
    
    if (need.urgency === 'crisis' || need.urgency === 'high') {
      score += 10;
    }
    
    const keywords = need.triggerPhrases.map(p => p.toLowerCase());
    const matchingKeywords = resource.sainte.keywords.filter(k => 
      keywords.some(nk => k.includes(nk) || nk.includes(k))
    );
    score += Math.min(matchingKeywords.length * 5, 15);
    
    if (resource.sainte.hasSainteAccess) {
      score += 10;
    }
    
    return Math.min(100, Math.max(0, score));
  }
  
  /**
   * Generate human-readable match reason
   */
  private generateMatchReason(resource: IndexedResource, need: DetectedNeed): string {
    const parts: string[] = [];
    
    if (resource.sainte.category === need.category) {
      parts.push(`Matches your ${need.category} need`);
    } else {
      parts.push(`Related to ${need.category}`);
    }
    
    if (resource.sainte.successRate >= 70) {
      parts.push('high success rate');
    }
    
    if (resource.sainte.hasSainteAccess) {
      parts.push('fast-track available');
    }
    
    return parts.join(' • ');
  }
  
  /**
   * Convert indexed resource to matched resource format
   */
  private toMatchedResource(
    indexed: IndexedResource,
    matchScore: number,
    matchReason: string
  ): MatchedResource {
    const phone = indexed.hsds.phones[0]?.number;
    const address = indexed.hsds.addresses[0];
    
    return {
      id: indexed.hsds.organization.id,
      name: indexed.hsds.organization.name,
      description: indexed.hsds.organization.description || null,
      category: indexed.sainte.category,
      contact: {
        phone: phone || undefined,
        email: indexed.hsds.organization.email || undefined,
        website: indexed.hsds.organization.url || undefined,
        address: address ? `${address.address_1}, ${address.city}, ${address.state_province} ${address.postal_code}` : undefined,
      },
      matchScore,
      matchReason,
      isRecommended: matchScore >= 70,
      locationMatch: this.determineLocationMatch(indexed),
      sourceTier: indexed.sainte.sourceTier,
      hasSainteAccess: indexed.sainte.hasSainteAccess,
      reliabilityScore: indexed.sainte.reliabilityScore,
    };
  }
  
  /**
   * Determine location match type
   */
  private determineLocationMatch(resource: IndexedResource): MatchedResource['locationMatch'] {
    if (resource.sainte.isNationwide) return 'nationwide';
    if (resource.sainte.serviceZipCodes.length > 0) return 'exact';
    if (resource.sainte.serviceCities.length > 0) return 'nearby';
    if (resource.sainte.serviceStates.length > 0) return 'regional';
    return 'unknown';
  }
  
  /**
   * Record referral outcome to improve future matching
   */
  recordOutcome(
    resourceId: string,
    outcome: 'successful' | 'failed' | 'no_response' | 'partial'
  ): void {
    resourceIndex.updateFromOutcome(resourceId, outcome);
  }
  
  /**
   * Add new resource to the index
   */
  async indexResource(resource: Resource): Promise<void> {
    await this.initialize();
    resourceIndex.indexFromSainteResource(resource);
  }
  
  /**
   * Get index statistics
   */
  getStats(): ReturnType<typeof resourceIndex.getStats> {
    return resourceIndex.getStats();
  }
}

export const smartMatcher = new SmartMatcher();
