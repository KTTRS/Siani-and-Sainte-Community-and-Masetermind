/**
 * HSDS RESOURCE INDEX
 * 
 * Open Referral HSDS-compliant resource indexing layer
 * Implements the multi-tier data source architecture:
 * 
 * Tier 1: Modern HSDS-compliant endpoints (Open Referral Alliance)
 * Tier 2: 211 National v2 endpoints (not deprecated v1)
 * Tier 3: Commercial providers (FindHelp, Unite Us, NowPow) - enterprise
 * Tier 4: SAINTE community-sourced resources - viral, local, unique
 * 
 * Schema follows Open Referral HSDS standard for provider-agnostic integration
 */

import type { Resource, InsertResource } from "@shared/schema";

// ============================================
// HSDS STANDARD TYPES (Open Referral)
// ============================================

export interface HSDSOrganization {
  id: string;
  name: string;
  alternate_name?: string;
  description?: string;
  email?: string;
  url?: string;
  tax_status?: string;
  tax_id?: string;
  year_incorporated?: number;
  legal_status?: string;
  logo?: string;
  uri?: string;
}

export interface HSDSService {
  id: string;
  organization_id: string;
  program_id?: string;
  name: string;
  alternate_name?: string;
  description?: string;
  url?: string;
  email?: string;
  status: 'active' | 'inactive' | 'defunct' | 'temporarily_closed';
  interpretation_services?: string;
  application_process?: string;
  wait_time?: string;
  fees?: string;
  accreditations?: string;
  licenses?: string;
}

export interface HSDSLocation {
  id: string;
  organization_id?: string;
  name?: string;
  alternate_name?: string;
  description?: string;
  transportation?: string;
  latitude?: number;
  longitude?: number;
  external_identifier?: string;
  external_identifier_type?: string;
}

export interface HSDSAddress {
  id: string;
  location_id?: string;
  attention?: string;
  address_1: string;
  address_2?: string;
  city: string;
  region?: string;
  state_province: string;
  postal_code: string;
  country: string;
  address_type?: 'physical' | 'mailing' | 'virtual';
}

export interface HSDSPhone {
  id: string;
  location_id?: string;
  service_id?: string;
  organization_id?: string;
  contact_id?: string;
  number: string;
  extension?: string;
  type?: string;
  language?: string;
  description?: string;
}

export interface HSDSServiceArea {
  id: string;
  service_id: string;
  service_area?: string;
  description?: string;
  extent?: string; // WKT geometry
  extent_type?: 'geojson' | 'topojson' | 'kml';
  uri?: string;
}

export interface HSDSTaxonomy {
  id: string;
  name: string;
  parent_id?: string;
  parent_name?: string;
  vocabulary?: string;
  uri?: string;
}

export interface HSDSServiceTaxonomy {
  id: string;
  service_id: string;
  taxonomy_id: string;
  taxonomy_detail?: string;
}

export interface HSDSEligibility {
  id: string;
  service_id: string;
  eligibility?: string;
}

export interface HSDSSchedule {
  id: string;
  service_id?: string;
  location_id?: string;
  service_at_location_id?: string;
  valid_from?: string;
  valid_to?: string;
  dtstart?: string;
  timezone?: number;
  until?: string;
  count?: number;
  wkst?: string;
  freq?: string;
  interval?: number;
  byday?: string;
  byweekno?: string;
  bymonthday?: string;
  byyearday?: string;
  description?: string;
  opens_at?: string;
  closes_at?: string;
  schedule_link?: string;
  attending_type?: string;
  notes?: string;
}

// ============================================
// INDEXED RESOURCE (Enhanced for matching)
// ============================================

export interface IndexedResource {
  // HSDS core data
  hsds: {
    organization: HSDSOrganization;
    services: HSDSService[];
    locations: HSDSLocation[];
    addresses: HSDSAddress[];
    phones: HSDSPhone[];
    serviceAreas: HSDSServiceArea[];
    taxonomies: HSDSTaxonomy[];
    eligibility: HSDSEligibility[];
    schedules: HSDSSchedule[];
  };
  
  // SAINTE-specific enhancements
  sainte: {
    sourceId: string; // Internal resource ID
    sourceTier: 'hsds' | '211' | 'commercial' | 'community';
    sourceProvider?: string; // e.g., "211_bay_area", "findhelp", "community"
    category: string; // SAINTE category mapping
    connectionType: 'connected' | 'verified' | 'external';
    hasSainteAccess: boolean;
    
    // Matching scores
    reliabilityScore: number; // 0-100 based on outcomes
    responseRate: number; // % of referrals that got responses
    successRate: number; // % of referrals marked successful
    userRating: number; // 1-5 stars from community
    lastVerified?: Date;
    
    // Geo-index data
    geoHash?: string; // For fast geo queries
    serviceZipCodes: string[];
    serviceCities: string[];
    serviceCounties: string[];
    serviceStates: string[];
    isNationwide: boolean;
    
    // Semantic index data (for vector search)
    embedding?: number[];
    keywords: string[];
    
    // Sync metadata
    lastSyncedAt: Date;
    syncSource: string;
    rawData?: any;
  };
}

// ============================================
// TAXONOMY MAPPING (211 HSIS → SAINTE)
// ============================================

const TAXONOMY_TO_SAINTE_CATEGORY: Record<string, string> = {
  // Housing (BH)
  'BH': 'housing',
  'BH-1800': 'housing', // Emergency Shelter
  'BH-3000': 'housing', // Housing Search
  'BH-3500': 'housing', // Low Income Housing
  'BH-3900': 'housing', // Public Housing
  'BH-5000': 'housing', // Subsidized Housing
  'BH-8600': 'housing', // Transitional Housing
  
  // Food (BD)
  'BD': 'food',
  'BD-1800': 'food', // Food Pantries
  'BD-2000': 'food', // SNAP/Food Stamps
  'BD-5000': 'food', // Meals/Soup Kitchens
  'BD-6500': 'food', // Senior Meals
  
  // Transportation (BT)
  'BT': 'transportation',
  'BT-4500': 'transportation', // Medical Transportation
  'BT-8000': 'transportation', // Public Transit
  
  // Mental Health (RF)
  'RF': 'mental_health',
  'RF-2000': 'mental_health', // Counseling
  'RF-6500': 'mental_health', // Crisis Intervention
  'RP': 'mental_health', // Suicide Prevention
  
  // Employment (ND)
  'ND': 'employment',
  'ND-2000': 'employment', // Job Training
  'ND-3000': 'employment', // Job Search
  
  // Education (HH)
  'HH': 'education',
  'HH-0500': 'education', // Adult Education
  'HH-3000': 'education', // GED
  
  // Legal (FT)
  'FT': 'legal',
  'FT-1000': 'legal', // Legal Aid
  'FT-3000': 'legal', // Tenant Rights
  
  // Financial (NT/NL)
  'NT': 'financial',
  'NT-1800': 'financial', // Emergency Financial
  'NL': 'financial', // Utility Assistance
};

// Crisis categories that bypass normal ranking
const CRISIS_TAXONOMIES = new Set([
  'RP', // Suicide prevention
  'RF-6500', // Crisis intervention
  'BH-1800', // Emergency shelter
]);

// ============================================
// RESOURCE INDEX CLASS
// ============================================

export class HSDSResourceIndex {
  private resources: Map<string, IndexedResource> = new Map();
  private geoIndex: Map<string, Set<string>> = new Map(); // zipCode -> resourceIds
  private categoryIndex: Map<string, Set<string>> = new Map(); // category -> resourceIds
  private crisisResources: Set<string> = new Set(); // Fast access to crisis resources
  
  /**
   * Index a resource from HSDS format
   */
  indexFromHSDS(
    org: HSDSOrganization,
    services: HSDSService[],
    locations: HSDSLocation[],
    addresses: HSDSAddress[],
    phones: HSDSPhone[],
    serviceAreas: HSDSServiceArea[],
    taxonomies: HSDSTaxonomy[],
    eligibility: HSDSEligibility[],
    schedules: HSDSSchedule[],
    sourceTier: 'hsds' | '211' | 'commercial' | 'community',
    sourceProvider?: string
  ): IndexedResource {
    // Map taxonomies to SAINTE category
    const taxonomyIds = taxonomies.map(t => t.id);
    const category = this.mapTaxonomyToCategory(taxonomyIds, org.name, org.description || '');
    
    // Check if any taxonomy is crisis-related
    const isCrisis = taxonomyIds.some(id => CRISIS_TAXONOMIES.has(id) || CRISIS_TAXONOMIES.has(id.substring(0, 2)));
    
    // Extract service area data
    const zipCodes: string[] = [];
    const cities: string[] = [];
    const counties: string[] = [];
    const states: string[] = [];
    let isNationwide = false;
    
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      if (addr.postal_code) zipCodes.push(addr.postal_code);
      if (addr.city) cities.push(addr.city);
      if (addr.state_province) states.push(addr.state_province);
    }
    
    for (let i = 0; i < serviceAreas.length; i++) {
      const area = serviceAreas[i];
      if (area.service_area?.toLowerCase().includes('nationwide') || 
          area.service_area?.toLowerCase().includes('national')) {
        isNationwide = true;
      }
    }
    
    // Build keywords for semantic matching
    const keywords = this.extractKeywords(org, services, taxonomies);
    
    const indexed: IndexedResource = {
      hsds: {
        organization: org,
        services,
        locations,
        addresses,
        phones,
        serviceAreas,
        taxonomies,
        eligibility,
        schedules,
      },
      sainte: {
        sourceId: org.id,
        sourceTier,
        sourceProvider,
        category,
        connectionType: sourceTier === 'community' ? 'connected' : 'external',
        hasSainteAccess: sourceTier === 'community',
        reliabilityScore: 50, // Start neutral
        responseRate: 0,
        successRate: 0,
        userRating: 0,
        serviceZipCodes: Array.from(new Set(zipCodes)),
        serviceCities: Array.from(new Set(cities)),
        serviceCounties: Array.from(new Set(counties)),
        serviceStates: Array.from(new Set(states)),
        isNationwide,
        keywords,
        lastSyncedAt: new Date(),
        syncSource: sourceProvider || sourceTier,
      },
    };
    
    // Add to indexes
    this.resources.set(org.id, indexed);
    
    // Geo index
    for (const zip of indexed.sainte.serviceZipCodes) {
      if (!this.geoIndex.has(zip)) {
        this.geoIndex.set(zip, new Set());
      }
      this.geoIndex.get(zip)!.add(org.id);
    }
    
    // Category index
    if (!this.categoryIndex.has(category)) {
      this.categoryIndex.set(category, new Set());
    }
    this.categoryIndex.get(category)!.add(org.id);
    
    // Crisis index
    if (isCrisis) {
      this.crisisResources.add(org.id);
    }
    
    return indexed;
  }
  
  /**
   * Index from SAINTE Resource format
   * Preserves all geographic data from the resource for proper matching
   */
  indexFromSainteResource(resource: Resource): IndexedResource {
    // Cast contact to proper type
    const contact = resource.contact as { phone?: string; email?: string; website?: string; address?: string } | null;
    
    const org: HSDSOrganization = {
      id: resource.id,
      name: resource.name,
      description: resource.description || undefined,
      url: contact?.website || undefined,
      email: contact?.email || undefined,
    };
    
    const phones: HSDSPhone[] = contact?.phone ? [{
      id: `${resource.id}-phone`,
      number: contact.phone,
      type: 'voice',
    }] : [];
    
    const addresses: HSDSAddress[] = contact?.address ? [{
      id: `${resource.id}-addr`,
      address_1: contact.address,
      city: resource.serviceCities?.[0] || '',
      state_province: resource.serviceStates?.[0] || '',
      postal_code: resource.serviceZipCodes?.[0] || '',
      country: 'US',
    }] : [];
    
    // Map SAINTE connection type to source tier
    const sourceTier = resource.hasSainteAccess ? 'community' as const : 'hsds' as const;
    
    // Create the indexed resource directly to preserve SAINTE geo data
    const indexed: IndexedResource = {
      hsds: {
        organization: org,
        services: [],
        locations: [],
        addresses,
        phones,
        serviceAreas: [],
        taxonomies: [],
        eligibility: [],
        schedules: [],
      },
      sainte: {
        sourceId: resource.id,
        sourceTier,
        sourceProvider: 'sainte_db',
        category: resource.category,
        connectionType: resource.connectionType === 'connected' ? 'connected' : 
                        resource.connectionType === 'verified' ? 'verified' : 'external',
        hasSainteAccess: resource.hasSainteAccess || false,
        reliabilityScore: resource.reliabilityScore || 50,
        responseRate: 0,
        successRate: resource.successRate || 0,
        userRating: 0,
        // CRITICAL: Use geo data directly from resource
        serviceZipCodes: resource.serviceZipCodes || [],
        serviceCities: resource.serviceCities || [],
        serviceCounties: resource.serviceCounties || [],
        serviceStates: resource.serviceStates || [],
        isNationwide: resource.isNationwide || false,
        keywords: this.extractKeywordsFromText(resource.name, resource.description || ''),
        lastSyncedAt: new Date(),
        syncSource: 'sainte_db',
      },
    };
    
    // Add to indexes
    this.resources.set(resource.id, indexed);
    
    // Geo index by zip codes
    for (const zip of indexed.sainte.serviceZipCodes) {
      if (!this.geoIndex.has(zip)) {
        this.geoIndex.set(zip, new Set());
      }
      this.geoIndex.get(zip)!.add(resource.id);
    }
    
    // City index
    for (const city of indexed.sainte.serviceCities) {
      const key = `city:${city.toLowerCase()}`;
      if (!this.geoIndex.has(key)) {
        this.geoIndex.set(key, new Set());
      }
      this.geoIndex.get(key)!.add(resource.id);
    }
    
    // State index
    for (const state of indexed.sainte.serviceStates) {
      const key = `state:${state.toUpperCase()}`;
      if (!this.geoIndex.has(key)) {
        this.geoIndex.set(key, new Set());
      }
      this.geoIndex.get(key)!.add(resource.id);
    }
    
    // Category index
    if (!this.categoryIndex.has(resource.category)) {
      this.categoryIndex.set(resource.category, new Set());
    }
    this.categoryIndex.get(resource.category)!.add(resource.id);
    
    // Check for crisis resources
    const isCrisis = resource.name.toLowerCase().includes('crisis') ||
                     resource.name.toLowerCase().includes('hotline') ||
                     resource.name.toLowerCase().includes('suicide') ||
                     resource.name.toLowerCase().includes('emergency shelter');
    if (isCrisis) {
      this.crisisResources.add(resource.id);
    }
    
    return indexed;
  }
  
  /**
   * Extract keywords from name and description
   */
  private extractKeywordsFromText(name: string, description: string): string[] {
    const keywords = new Set<string>();
    const text = `${name} ${description}`.toLowerCase();
    text.split(/\W+/).forEach(w => {
      if (w.length > 3) keywords.add(w);
    });
    return Array.from(keywords);
  }
  
  /**
   * Map taxonomy codes to SAINTE category
   */
  private mapTaxonomyToCategory(taxonomyIds: string[], name: string, description: string): string {
    // Try direct taxonomy mapping
    for (const taxId of taxonomyIds) {
      if (TAXONOMY_TO_SAINTE_CATEGORY[taxId]) {
        return TAXONOMY_TO_SAINTE_CATEGORY[taxId];
      }
      // Try prefix match
      const prefix = taxId.substring(0, 2);
      if (TAXONOMY_TO_SAINTE_CATEGORY[prefix]) {
        return TAXONOMY_TO_SAINTE_CATEGORY[prefix];
      }
    }
    
    // Keyword fallback
    const text = `${name} ${description}`.toLowerCase();
    const categoryKeywords: Record<string, string[]> = {
      housing: ['housing', 'shelter', 'rent', 'homeless', 'apartment'],
      food: ['food', 'meal', 'pantry', 'snap', 'hunger'],
      transportation: ['transport', 'ride', 'bus', 'transit'],
      mental_health: ['mental', 'counsel', 'therapy', 'crisis'],
      employment: ['job', 'employ', 'career', 'work'],
      education: ['education', 'school', 'ged', 'literacy'],
      legal: ['legal', 'lawyer', 'attorney', 'tenant'],
      financial: ['financial', 'utility', 'bill', 'assistance'],
    };
    
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        return cat;
      }
    }
    
    return 'financial'; // Default
  }
  
  /**
   * Extract keywords for semantic matching
   */
  private extractKeywords(
    org: HSDSOrganization,
    services: HSDSService[],
    taxonomies: HSDSTaxonomy[]
  ): string[] {
    const keywords = new Set<string>();
    
    // From org name
    org.name.toLowerCase().split(/\W+/).forEach(w => {
      if (w.length > 3) keywords.add(w);
    });
    
    // From description
    if (org.description) {
      org.description.toLowerCase().split(/\W+/).forEach(w => {
        if (w.length > 3) keywords.add(w);
      });
    }
    
    // From services
    for (const svc of services) {
      svc.name.toLowerCase().split(/\W+/).forEach(w => {
        if (w.length > 3) keywords.add(w);
      });
    }
    
    // From taxonomies
    for (const tax of taxonomies) {
      keywords.add(tax.name.toLowerCase());
    }
    
    return Array.from(keywords);
  }
  
  /**
   * Find resources matching location and category
   * Enhanced with city/state geographic matching
   */
  findResources(
    zipCode?: string,
    category?: string,
    isCrisis: boolean = false,
    city?: string,
    state?: string
  ): IndexedResource[] {
    let candidates: Set<string>;
    
    // Start with crisis resources if needed
    if (isCrisis) {
      candidates = new Set(this.crisisResources);
    } else if (category) {
      candidates = new Set(this.categoryIndex.get(category) || []);
    } else {
      candidates = new Set(this.resources.keys());
    }
    
    // Filter by location using multi-level geo matching
    if ((zipCode || city || state) && candidates.size > 0) {
      const geoMatches = new Set<string>();
      
      // Exact zip code matches (highest priority)
      if (zipCode) {
        const zipMatches = this.geoIndex.get(zipCode) || new Set();
        zipMatches.forEach(id => geoMatches.add(id));
      }
      
      // City matches
      if (city) {
        const cityKey = `city:${city.toLowerCase()}`;
        const cityMatches = this.geoIndex.get(cityKey) || new Set();
        cityMatches.forEach(id => geoMatches.add(id));
      }
      
      // State matches (widest coverage)
      if (state) {
        const stateKey = `state:${state.toUpperCase()}`;
        const stateMatches = this.geoIndex.get(stateKey) || new Set();
        stateMatches.forEach(id => geoMatches.add(id));
      }
      
      // Always include nationwide resources
      const nationwide = Array.from(candidates).filter(id => 
        this.resources.get(id)?.sainte.isNationwide
      );
      
      // Combine geo matches with candidates
      candidates = new Set([
        ...Array.from(candidates).filter(id => geoMatches.has(id)),
        ...nationwide,
      ]);
    }
    
    return Array.from(candidates)
      .map(id => this.resources.get(id)!)
      .filter(Boolean);
  }
  
  /**
   * Rank resources for a user
   * Enhanced with city/state geographic prioritization
   */
  rankResources(
    resources: IndexedResource[],
    userContext: {
      zipCode?: string;
      city?: string;
      state?: string;
      previousSuccesses?: string[]; // Resource IDs that worked before
      previousFailures?: string[]; // Resource IDs that didn't work
      preferences?: string[];
    }
  ): IndexedResource[] {
    return resources
      .map(r => ({
        resource: r,
        score: this.calculateMatchScore(r, userContext),
      }))
      .sort((a, b) => b.score - a.score)
      .map(r => r.resource);
  }
  
  private calculateMatchScore(
    resource: IndexedResource,
    context: {
      zipCode?: string;
      city?: string;
      state?: string;
      previousSuccesses?: string[];
      previousFailures?: string[];
      preferences?: string[];
    }
  ): number {
    let score = 0;
    
    // Base reliability score (0-40 points)
    score += resource.sainte.reliabilityScore * 0.4;
    
    // Success rate (0-25 points)
    score += resource.sainte.successRate * 0.25;
    
    // User rating (0-20 points)
    score += (resource.sainte.userRating / 5) * 20;
    
    // Geographic proximity scoring (0-50 points) - HIGHEST PRIORITY
    // Uses tiered matching: zip > city > state > nationwide
    let geoScore = 0;
    const normalizedCity = context.city?.toLowerCase().trim();
    const normalizedState = context.state?.toUpperCase().trim();
    
    // Check zip match (highest priority)
    if (context.zipCode && resource.sainte.serviceZipCodes.includes(context.zipCode)) {
      geoScore = 50; // Perfect zip match
    }
    // Check city match
    else if (normalizedCity && resource.sainte.serviceCities
      .map(c => c.toLowerCase().trim())
      .includes(normalizedCity)) {
      geoScore = 40; // City match
    }
    // Check state match
    else if (normalizedState && resource.sainte.serviceStates
      .map(s => s.toUpperCase().trim())
      .includes(normalizedState)) {
      geoScore = 20; // State match only
    }
    // Nationwide fallback
    else if (resource.sainte.isNationwide) {
      geoScore = 10; // Nationwide resource
    }
    
    score += geoScore;
    
    // Penalty for no geographic match
    if (geoScore === 0 && (context.zipCode || normalizedCity || normalizedState)) {
      score -= 20; // Non-matching location
    }
    
    // Previous experience bonus/penalty
    if (context.previousSuccesses?.includes(resource.sainte.sourceId)) {
      score += 20; // Strong preference for what worked before
    }
    if (context.previousFailures?.includes(resource.sainte.sourceId)) {
      score -= 30; // Strong penalty for what didn't work
    }
    
    // SAINTE connection bonus
    if (resource.sainte.hasSainteAccess) {
      score += 10; // Prefer connected resources
    }
    
    // Source tier bonus
    switch (resource.sainte.sourceTier) {
      case 'hsds': score += 5; break;
      case '211': score += 4; break;
      case 'community': score += 3; break;
      case 'commercial': score += 2; break;
    }
    
    return Math.max(0, score);
  }
  
  /**
   * Update resource scores based on referral outcome
   */
  updateFromOutcome(
    resourceId: string,
    outcome: 'successful' | 'failed' | 'no_response' | 'partial'
  ): void {
    const resource = this.resources.get(resourceId);
    if (!resource) return;
    
    // Update success rate (simple moving average)
    const successValue = outcome === 'successful' ? 100 : 
                         outcome === 'partial' ? 50 : 0;
    resource.sainte.successRate = 
      (resource.sainte.successRate * 0.9) + (successValue * 0.1);
    
    // Update reliability based on response
    if (outcome === 'no_response') {
      resource.sainte.reliabilityScore = Math.max(0, 
        resource.sainte.reliabilityScore - 5
      );
    } else {
      resource.sainte.reliabilityScore = Math.min(100,
        resource.sainte.reliabilityScore + 1
      );
    }
  }
  
  /**
   * Get stats for the index
   */
  getStats(): {
    totalResources: number;
    byCategory: Record<string, number>;
    byTier: Record<string, number>;
    crisisResources: number;
    geoIndexed: number;
  } {
    const byCategory: Record<string, number> = {};
    const byTier: Record<string, number> = {};
    
    // Use Array.from to avoid downlevelIteration issues
    Array.from(this.categoryIndex.entries()).forEach(([cat, ids]) => {
      byCategory[cat] = ids.size;
    });
    
    Array.from(this.resources.values()).forEach(r => {
      byTier[r.sainte.sourceTier] = (byTier[r.sainte.sourceTier] || 0) + 1;
    });
    
    return {
      totalResources: this.resources.size,
      byCategory,
      byTier,
      crisisResources: this.crisisResources.size,
      geoIndexed: this.geoIndex.size,
    };
  }
}

// Singleton instance
export const resourceIndex = new HSDSResourceIndex();
