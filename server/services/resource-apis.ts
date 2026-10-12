/**
 * EXTERNAL RESOURCE API INTEGRATIONS
 * 
 * Connects to 211 and FindHelp APIs to pull real-time resource data
 * for Siani to recommend to users.
 */

import type { Resource, InsertResource } from "@shared/schema";

// API Configuration
const API_211_BASE_URL = process.env.API_211_BASE_URL || 'https://api.211.org/v2';
const API_211_KEY = process.env.API_211_KEY;

const FINDHELP_BASE_URL = process.env.FINDHELP_BASE_URL;
const FINDHELP_API_KEY = process.env.FINDHELP_API_KEY;

// 211 HSDS Taxonomy mapping to SAINTE categories
const TAXONOMY_TO_CATEGORY: Record<string, string> = {
  // Housing
  'BH': 'housing', // Housing/Shelter
  'BH-1800': 'housing', // Emergency Shelter
  'BH-3000': 'housing', // Housing Search Assistance
  'BH-5000': 'housing', // Subsidized Housing
  
  // Food
  'BD': 'food', // Food/Meals
  'BD-1800': 'food', // Food Pantries
  'BD-2000': 'food', // SNAP/Food Stamps
  'BD-5000': 'food', // Meals/Soup Kitchens
  
  // Transportation
  'BT': 'transportation', // Transportation
  'BT-4500': 'transportation', // Medical Transportation
  'BT-8000': 'transportation', // Public Transit
  
  // Mental Health
  'RF': 'mental_health', // Mental Health/Addictions
  'RF-2000': 'mental_health', // Counseling Services
  'RF-6500': 'mental_health', // Crisis Intervention
  'RP': 'mental_health', // Suicide Prevention
  
  // Employment
  'ND': 'employment', // Employment
  'ND-2000': 'employment', // Job Training
  'ND-3000': 'employment', // Job Search
  
  // Education
  'HH': 'education', // Education
  'HH-0500': 'education', // Adult Education
  'HH-3000': 'education', // GED Programs
  
  // Legal
  'FT': 'legal', // Legal Services
  'FT-1000': 'legal', // Legal Assistance
  'FT-3000': 'legal', // Tenant Rights
  
  // Financial
  'NT': 'financial', // Financial Assistance
  'NT-1800': 'financial', // Emergency Financial Assistance
  'NL': 'financial', // Utility Assistance
};

// Service category keywords for fallback mapping
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  housing: ['housing', 'shelter', 'rent', 'homeless', 'apartment', 'home'],
  food: ['food', 'meal', 'pantry', 'snap', 'hunger', 'nutrition'],
  transportation: ['transport', 'ride', 'bus', 'transit', 'medical transport'],
  mental_health: ['mental', 'counsel', 'therapy', 'crisis', 'suicide', 'depression', 'anxiety'],
  employment: ['job', 'employ', 'career', 'work', 'training', 'resume'],
  education: ['education', 'school', 'ged', 'literacy', 'college', 'tutor'],
  legal: ['legal', 'lawyer', 'attorney', 'tenant', 'immigration', 'rights'],
  financial: ['financial', 'money', 'utility', 'bill', 'assistance', 'benefit'],
};

/**
 * 211 API Response Types (based on HSDS standard)
 */
interface HSDS_Service {
  id: string;
  organization_id: string;
  program_id?: string;
  name: string;
  description?: string;
  url?: string;
  email?: string;
  status?: string;
  taxonomy_ids?: string[];
}

interface HSDS_Organization {
  id: string;
  name: string;
  description?: string;
  url?: string;
  phones?: { number: string; type?: string }[];
  locations?: HSDS_Location[];
  services?: HSDS_Service[];
}

interface HSDS_Location {
  id: string;
  name?: string;
  address?: {
    address_1?: string;
    city?: string;
    state_province?: string;
    postal_code?: string;
  };
  latitude?: number;
  longitude?: number;
}

interface API211SearchResult {
  organizations?: HSDS_Organization[];
  services?: HSDS_Service[];
  total_count?: number;
}

/**
 * Map 211 taxonomy codes to SAINTE categories
 */
function mapTaxonomyToCategory(taxonomyIds: string[] = [], name: string = '', description: string = ''): string {
  // Try direct taxonomy mapping first
  for (const taxId of taxonomyIds) {
    const prefix = taxId.substring(0, 2);
    const fullMatch = TAXONOMY_TO_CATEGORY[taxId];
    const prefixMatch = TAXONOMY_TO_CATEGORY[prefix];
    if (fullMatch) return fullMatch;
    if (prefixMatch) return prefixMatch;
  }
  
  // Fall back to keyword matching
  const text = `${name} ${description}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return category;
    }
  }
  
  return 'financial'; // Default fallback
}

/**
 * Search 211 API for resources by location and category
 */
export async function search211Resources(
  zipCode: string,
  category?: string,
  radiusMiles: number = 25
): Promise<InsertResource[]> {
  if (!API_211_KEY) {
    console.log('211 API key not configured - using fallback data');
    return [];
  }
  
  try {
    const searchTerms = category ? getCategorySearchTerms(category) : '';
    
    const response = await fetch(
      `${API_211_BASE_URL}/search?` + new URLSearchParams({
        location: zipCode,
        distance: radiusMiles.toString(),
        search: searchTerms,
      }),
      {
        headers: {
          'Authorization': `Bearer ${API_211_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('211 API error:', response.status, await response.text());
      return [];
    }
    
    const data: API211SearchResult = await response.json();
    return transform211ToResources(data, zipCode);
    
  } catch (error) {
    console.error('211 API search error:', error);
    return [];
  }
}

/**
 * Get category-specific search terms for 211 API
 */
function getCategorySearchTerms(category: string): string {
  const terms: Record<string, string> = {
    housing: 'housing shelter rent assistance',
    food: 'food pantry meals SNAP',
    transportation: 'transportation rides medical transport',
    mental_health: 'mental health counseling crisis',
    employment: 'job training employment career',
    education: 'education GED adult learning',
    legal: 'legal aid attorney tenant rights',
    financial: 'financial assistance utility help',
  };
  return terms[category] || category;
}

/**
 * Transform 211 API response to SAINTE Resource format
 */
function transform211ToResources(data: API211SearchResult, searchZipCode: string): InsertResource[] {
  const resources: InsertResource[] = [];
  
  if (data.organizations) {
    for (const org of data.organizations) {
      const location = org.locations?.[0];
      const service = org.services?.[0];
      
      const category = mapTaxonomyToCategory(
        service?.taxonomy_ids,
        org.name,
        org.description || service?.description || ''
      );
      
      const phone = org.phones?.find(p => p.type === 'voice' || !p.type)?.number;
      
      resources.push({
        name: org.name,
        description: org.description || service?.description || undefined,
        category,
        contact: {
          phone: phone || undefined,
          email: service?.email || undefined,
          website: org.url || service?.url || undefined,
          address: location?.address ? 
            `${location.address.address_1 || ''}, ${location.address.city || ''}, ${location.address.state_province || ''} ${location.address.postal_code || ''}`.trim() 
            : undefined,
        },
        serviceArea: location?.address?.city ? 
          `${location.address.city}, ${location.address.state_province}` : undefined,
        serviceAreaType: 'local',
        serviceZipCodes: location?.address?.postal_code ? [location.address.postal_code] : [searchZipCode],
        serviceCities: location?.address?.city ? [location.address.city] : undefined,
        serviceStates: location?.address?.state_province ? [location.address.state_province] : undefined,
        isNationwide: false,
        eligibility: undefined, // 211 doesn't always provide this
        isVerified: true, // 211 data is verified
        connectionType: 'external',
        hasSainteAccess: false,
      });
    }
  }
  
  return resources;
}

/**
 * FindHelp (Aunt Bertha) API Integration
 * Note: Requires enterprise API access
 */
export async function searchFindHelpResources(
  zipCode: string,
  category?: string,
  radiusMiles: number = 25
): Promise<InsertResource[]> {
  if (!FINDHELP_API_KEY || !FINDHELP_BASE_URL) {
    console.log('FindHelp API not configured');
    return [];
  }
  
  try {
    const response = await fetch(
      `${FINDHELP_BASE_URL}/v1/programs/search?` + new URLSearchParams({
        location: zipCode,
        category: category || '',
        radius: radiusMiles.toString(),
      }),
      {
        headers: {
          'Authorization': `Bearer ${FINDHELP_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('FindHelp API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    return transformFindHelpToResources(data, zipCode);
    
  } catch (error) {
    console.error('FindHelp API error:', error);
    return [];
  }
}

/**
 * Transform FindHelp API response to SAINTE Resource format
 */
function transformFindHelpToResources(data: any, searchZipCode: string): InsertResource[] {
  const resources: InsertResource[] = [];
  
  if (data.results) {
    for (const program of data.results) {
      resources.push({
        name: program.name,
        description: program.description,
        category: mapFindHelpCategory(program.category),
        contact: {
          phone: program.phone,
          email: program.email,
          website: program.website,
          address: program.address,
        },
        serviceArea: program.service_area || undefined,
        serviceAreaType: 'local',
        serviceZipCodes: [searchZipCode],
        isNationwide: false,
        eligibility: program.eligibility,
        isVerified: program.verified || true,
        connectionType: 'external',
        hasSainteAccess: false,
      });
    }
  }
  
  return resources;
}

function mapFindHelpCategory(findHelpCategory: string): string {
  const mapping: Record<string, string> = {
    'Food': 'food',
    'Housing': 'housing',
    'Transportation': 'transportation',
    'Health': 'mental_health',
    'Mental Health': 'mental_health',
    'Employment': 'employment',
    'Education': 'education',
    'Legal': 'legal',
    'Money': 'financial',
    'Utilities': 'financial',
  };
  return mapping[findHelpCategory] || 'financial';
}

/**
 * Combined resource search - tries 211 first, then FindHelp
 */
export async function searchExternalResources(
  zipCode: string,
  category?: string,
  radiusMiles: number = 25
): Promise<InsertResource[]> {
  // Try 211 first (more accessible)
  let resources = await search211Resources(zipCode, category, radiusMiles);
  
  // If no 211 results, try FindHelp
  if (resources.length === 0) {
    resources = await searchFindHelpResources(zipCode, category, radiusMiles);
  }
  
  return resources;
}

/**
 * Check if external APIs are configured.
 * `freePublic` is always true — HUD ArcGIS feeds need no API key.
 */
export function getAPIStatus(): {
  api211: boolean;
  findHelp: boolean;
  freePublic: boolean;
  anyConfigured: boolean;
} {
  return {
    api211: !!API_211_KEY,
    findHelp: !!(FINDHELP_API_KEY && FINDHELP_BASE_URL),
    freePublic: true,
    anyConfigured: true, // Free providers always available
  };
}
