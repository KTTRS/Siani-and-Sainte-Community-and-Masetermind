import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, getDatabaseStatus } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import { generateSianiResponse, analyzeGoalIntents, getVoiceConfig, type AvailableResource } from "./siani";
import { detectNeeds } from "./engines/needs";
import { voiceService } from "./voice/voiceService";
import { runSianiTurn } from "./sianiTurn";
import { WhisperTranscriptionProvider } from "./voice/whisperProvider";
import { 
  getConversationContext, 
  updateConversationContext, 
  buildContextPrompt 
} from "./services/conversationMemory";
import { processSignals, getCrisisResponseGuidance } from "./services/crisisEscalation";
import { 
  processAction, 
  getUserGamificationStats, 
  checkAndAwardBadges, 
  updateStreak,
  ensureBadgesExist 
} from "./services/gamification";
import { insertMessageSchema, insertGoalSchema, insertConversationSchema, insertMoveSchema, insertCareMessageSchema, referralVerifications, users, drops, feedSignals, badges, userBadges, pulseQuestions, pulseResponses, CRED_REWARDS, VAULT_CRED_REWARDS, userConsentSchema, DEFAULT_USER_CONSENT, type InsertResource } from "@shared/schema";
import { randomBytes } from "crypto";
import { michiganSeedResources } from "./seed-michigan";
import { z } from "zod";
import { verifyToken, optionalAuth, requireRole, supabase as supabaseAdmin } from "./middleware/auth";
import { requireOwnership, scopeToAuthUser } from "./middleware/ownership";

// Validation schemas for API endpoints
const chatBodySchema = z.object({
  message: z.string().min(1, "Message is required").max(10000, "Message too long"),
  userId: z.string().optional(),
  conversationId: z.string().optional(),
});

const careMessageBodySchema = z.object({
  threadId: z.string().min(1, "Thread ID is required"),
  duration: z.number().optional(),
  audioUrl: z.string().optional().nullable(),
  content: z.string().optional(),
  userId: z.string().optional(),
});

const dropRsvpBodySchema = z.object({
  userId: z.string().optional(),
});

const flowReactBodySchema = z.object({
  contentType: z.enum(["drops", "signals", "spotlights"], { 
    errorMap: () => ({ message: "Invalid content type" }) 
  }),
  contentId: z.string().min(1, "Content ID is required"),
  reactionType: z.enum(["fire", "strength", "heart"], { 
    errorMap: () => ({ message: "Invalid reaction type" }) 
  }),
  action: z.enum(["add", "remove"]).optional(),
  userId: z.string().optional(),
});

const synthesizeBodySchema = z.object({
  text: z.string().min(1, "Text is required").max(5000, "Text too long"),
  emotionalContext: z.object({
    mood: z.string().default("neutral"),
    arousalLevel: z.number().default(0.5),
    shouldBeGentle: z.boolean().default(false),
  }).optional(),
});

const textToSpeechBodySchema = z.object({
  message: z.string().min(1, "Message is required").max(10000, "Message too long"),
  conversationId: z.string().optional(),
  userId: z.string().optional(),
});
import type { ProsodyAnalysis } from "./engines/types";
import { eventBus, dataLake, EventTypes, initializeServices } from "./supabase";
import { smartMatcher } from "./engines/smart-matching";
import { chatRateLimiter, voiceRateLimiter, apiRateLimiter, readRateLimiter, authRateLimiter } from "./middleware/rateLimit";
import vaultRoutes from "./routes/vault";
import heatRoutes from "./routes/heat";
import notificationRoutes from "./routes/notifications";
import inviteRoutes from "./routes/invites";
import membershipRoutes from "./routes/membership";
import eventRoutes from "./routes/events";
import mastermindRoutes from "./routes/mastermind";

// Standalone providers for individual endpoints
const whisperProvider = new WhisperTranscriptionProvider();

// Structured error logging
function logError(context: string, error: any, meta?: Record<string, any>) {
  const errorInfo = {
    context,
    message: error?.message || String(error),
    code: error?.code,
    status: error?.status,
    stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    ...meta,
    timestamp: new Date().toISOString(),
  };
  console.error('[SAINTE Error]', JSON.stringify(errorInfo));
}

// Auto-seed drops and signals data if tables are empty
async function seedFlowDataIfEmpty() {
  try {
    const existingDrops = await storage.getActiveDrops(1);
    const existingSignals = await storage.getRecentSignals(1);
    
    if (existingDrops.length === 0) {
      console.log('[Seed] Adding initial drops data...');
      const dropsToSeed = [
        {
          id: 'drop-seed-001',
          headline: "ROOFTOP SESSIONS",
          subhead: "Exclusive members gathering",
          description: "Network with fellow SAINTE members. Complimentary refreshments. Dress code: Elevated casual.",
          exclusivityTier: "members",
          seatCount: 25,
          seatsRemaining: 18,
          accessWindowEnd: new Date(Date.now() + 2 * 60 * 60 * 1000),
          prizeDescription: "Free access + drinks",
          prizeValue: 75,
          status: "active",
          isFeatured: true,
        },
        {
          id: 'drop-seed-002',
          headline: "PRIVATE DINING EXPERIENCE",
          subhead: "Three-course meal with executive chef",
          description: "Curated dinner experience. Limited to 12 members.",
          exclusivityTier: "icons",
          seatCount: 12,
          seatsRemaining: 3,
          accessWindowEnd: new Date(Date.now() + 5 * 60 * 60 * 1000),
          prizeDescription: "Three-course dinner",
          prizeValue: 150,
          status: "active",
          isFeatured: false,
        },
        {
          id: 'drop-seed-003',
          headline: "WELLNESS WORKSHOP",
          subhead: "Mindfulness and movement",
          description: "Session led by certified instructor. All levels welcome.",
          exclusivityTier: "members",
          seatCount: 30,
          seatsRemaining: 22,
          accessWindowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
          prizeDescription: "Free class + materials",
          prizeValue: 45,
          status: "active",
          isFeatured: false,
        },
        {
          id: 'drop-seed-004',
          headline: "MEMBERS LOUNGE ACCESS",
          subhead: "One-day pass",
          description: "Work, relax, connect at the exclusive SAINTE members lounge.",
          exclusivityTier: "inner_circle",
          seatCount: 50,
          seatsRemaining: 35,
          accessWindowEnd: new Date(Date.now() + 48 * 60 * 60 * 1000),
          prizeDescription: "Day pass + amenities",
          prizeValue: 100,
          status: "active",
          isFeatured: true,
        },
      ];
      
      for (const drop of dropsToSeed) {
        await db.insert(drops).values(drop).onConflictDoUpdate({
          target: drops.id,
          set: {
            accessWindowEnd: drop.accessWindowEnd,
            seatsRemaining: drop.seatsRemaining,
            status: drop.status,
          },
        });
      }
      console.log('[Seed] Refreshed', dropsToSeed.length, 'drops');
    }
    
    if (existingSignals.length === 0) {
      console.log('[Seed] Adding initial signals data...');
      const signalsToSeed = [
        {
          id: 'signal-seed-001',
          narrative: "Behind every late night is a vision others can't see yet. Three years in this studio, countless sessions that went nowhere. Now I'm working with artists who top charts. The Circle believed in the sound before anyone else did.",
          storyteller: "MARCUS COLE",
          storytellerRole: "PRODUCER · PLATINUM CREDITS",
          locationContext: "EASTERN MARKET · STUDIO SESSION",
          mediaUrl: "/attached_assets/stock_images/music_producer_studi_4b3b02ab.jpg",
          mediaType: "image",
          cinematicTags: ["music", "creative", "hustle", "vision"],
          exclusivityTier: "members",
          status: "active",
          isFeatured: true,
        },
        {
          id: 'signal-seed-002',
          narrative: "Access is everything. Who you know determines what doors open. Built my company from a coffee shop pitch to 12 employees in 18 months. The network here isn't just connections—it's people who actually pick up the phone.",
          storyteller: "NIA RICHARDSON",
          storytellerRole: "FOUNDER · TECH STARTUP",
          locationContext: "DOWNTOWN DETROIT · FOUNDER HQ",
          mediaUrl: "/attached_assets/stock_images/confident_woman_entr_1d2be2a2.jpg",
          mediaType: "image",
          cinematicTags: ["startup", "networking", "founder", "success"],
          exclusivityTier: "icons",
          status: "active",
          isFeatured: true,
        },
        {
          id: 'signal-seed-003',
          narrative: "The grind doesn't stop but neither does the growth. Four campaigns this quarter for Fortune 500 brands. Started as the intern everyone overlooked. Now I'm building the team and we're looking for hungry creatives.",
          storyteller: "DAMON HAYES",
          storytellerRole: "CREATIVE DIRECTOR · AGENCY OWNER",
          locationContext: "MIDTOWN · CREATIVE DISTRICT",
          mediaUrl: "/attached_assets/stock_images/professional_black_m_3e06c141.jpg",
          mediaType: "image",
          cinematicTags: ["career", "creative", "hiring", "growth"],
          exclusivityTier: "members",
          status: "active",
          isFeatured: true,
        },
        {
          id: 'signal-seed-004',
          narrative: "Real wealth is having options. We're building options. Closed my third property this month. Started with nothing but a spreadsheet and discipline. DM me if you're serious about financial literacy—running a workshop next week.",
          storyteller: "JASMINE CHEN",
          storytellerRole: "INVESTOR · WEALTH STRATEGIST",
          locationContext: "CORKTOWN · WEALTH BUILD",
          mediaUrl: "/attached_assets/stock_images/luxury_office_desk_d_773ee642.jpg",
          mediaType: "image",
          cinematicTags: ["money", "wealth", "investing", "education"],
          exclusivityTier: "icons",
          status: "active",
          isFeatured: true,
        },
        {
          id: 'signal-seed-005',
          narrative: "Rooftop session tomorrow night. Connecting creatives with brand deals. Last month we placed 4 members with campaigns worth $15K+ each. Dress code: drip required. This is how we move.",
          storyteller: "KEVIN OKAFOR",
          storytellerRole: "CREATIVE DIRECTOR · BRAND PARTNERSHIPS",
          locationContext: "MIDTOWN ROOFTOP · INVITE ONLY",
          mediaUrl: "/attached_assets/stock_images/exclusive_rooftop_ev_1fc02052.jpg",
          mediaType: "image",
          cinematicTags: ["lifestyle", "creative", "networking", "opportunity"],
          exclusivityTier: "members",
          status: "active",
          isFeatured: false,
        },
        {
          id: 'signal-seed-006',
          narrative: "Just finished producing for a major label artist. If you make beats, I'm doing free studio sessions this weekend. Bring your best 3 tracks. Let's build something together.",
          storyteller: "DARIUS KING",
          storytellerRole: "MUSIC PRODUCER · PLATINUM CREDITS",
          locationContext: "EASTERN MARKET · STUDIO DROP",
          mediaUrl: "/attached_assets/stock_images/music_producer_studi_4b3b02ab.jpg",
          mediaType: "image",
          cinematicTags: ["lifestyle", "music", "creative", "mentorship"],
          exclusivityTier: "members",
          status: "active",
          isFeatured: false,
        },
        {
          id: 'signal-seed-007',
          narrative: "Community wellness check: free mental health consultations at the community center this Saturday. Licensed therapists, no insurance needed. Self-care is survival.",
          storyteller: "DR. AMARA CHEN",
          storytellerRole: "LICENSED THERAPIST · COMMUNITY ADVOCATE",
          locationContext: "GRAND RIVER · WELLNESS CENTER",
          mediaUrl: "/attached_assets/stock_images/professional_headsho_6a6ac3dc.jpg",
          mediaType: "image",
          cinematicTags: ["wellness", "mental-health", "community", "free"],
          exclusivityTier: "members",
          status: "active",
          isFeatured: false,
        },
        {
          id: 'signal-seed-008',
          narrative: "Hiring 15 people for my logistics company. $22/hr starting, benefits day one, no experience needed. Training provided. Priority to Circle members. This is how we build generational wealth.",
          storyteller: "ANDRE WASHINGTON",
          storytellerRole: "CEO · SWIFT LOGISTICS",
          locationContext: "SOUTHWEST DETROIT · HIRING EVENT",
          mediaUrl: "/attached_assets/stock_images/professional_black_m_9195792f.jpg",
          mediaType: "image",
          cinematicTags: ["career", "hiring", "opportunity", "community"],
          exclusivityTier: "members",
          status: "active",
          isFeatured: true,
        },
      ];
      
      for (const signal of signalsToSeed) {
        await db.insert(feedSignals).values(signal).onConflictDoNothing();
      }
      console.log('[Seed] Added', signalsToSeed.length, 'signals');
    }
  } catch (error) {
    console.warn('[Seed] Flow data seeding error:', error);
  }
}

async function seedResourcesIfEmpty() {
  try {
    const existing = await storage.getAllResources();
    const existingNames = new Set(existing.map(r => r.name.toLowerCase().trim()));
    if (existing.length >= 150) {
      console.log('[Seed] Resources already populated:', existing.length, 'resources');
      return;
    }

    console.log('[Seed] Adding Michigan Medicaid resources...');
    const michiganResources: InsertResource[] = [
      {
        name: "Michigan 2-1-1",
        description: "Free, confidential helpline connecting Michigan residents to local health and human services 24/7. Call 2-1-1 or text your zip code to 898-211 for housing, food, utilities, mental health, and more.",
        category: "crisis",
        contact: { phone: "211", website: "https://www.mi211.org", address: "Statewide - Michigan" },
        serviceArea: "Michigan Statewide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "All Michigan residents. No income requirements.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Michigan Department of Health & Human Services (MDHHS)",
        description: "Apply for Medicaid, food assistance (SNAP/Bridge Card), cash assistance, childcare assistance, and State Emergency Relief. Online applications via MI Bridges portal.",
        category: "financial",
        contact: { phone: "844-799-9876", website: "https://newmibridges.michigan.gov", address: "Multiple offices statewide" },
        serviceArea: "Michigan Statewide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Michigan residents meeting income guidelines. Medicaid: up to 138% FPL for adults.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Community Mental Health Services Program",
        description: "Michigan's public mental health system providing crisis services, therapy, psychiatric care, substance use treatment, and developmental disability supports through local Community Mental Health boards.",
        category: "mental_health",
        contact: { phone: "800-649-3777", website: "https://www.michigan.gov/mdhhs/keep-mi-healthy/mentalhealth", address: "46 Community Mental Health boards across Michigan" },
        serviceArea: "Michigan Statewide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Michigan Medicaid recipients and uninsured individuals with serious mental illness, substance use disorders, or intellectual/developmental disabilities.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Covenant Community Care",
        description: "Federally Qualified Health Center providing primary care, dental, behavioral health, and pharmacy services to underserved communities in Detroit. Sliding scale fees available.",
        category: "healthcare",
        contact: { phone: "313-554-1770", website: "https://www.covenantcommunitycare.org", address: "5716 Michigan Ave, Detroit, MI 48210" },
        serviceArea: "Detroit Metro Area",
        serviceAreaType: "city",
        serviceCities: ["Detroit", "Dearborn", "Hamtramck"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Open to all. Accepts Medicaid, Medicare, most insurance. Sliding scale for uninsured.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Gleaners Community Food Bank",
        description: "Distributes food to over 500 partner agencies across Southeast Michigan. Operates mobile food distributions, school pantries, and emergency food assistance programs.",
        category: "food",
        contact: { phone: "866-453-2637", website: "https://www.gcfb.org", address: "2131 Beaufait St, Detroit, MI 48207" },
        serviceArea: "Southeast Michigan",
        serviceAreaType: "county",
        serviceCounties: ["Wayne", "Oakland", "Macomb", "Livingston", "Monroe"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "All residents in need. No documentation required at most distribution sites.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Forgotten Harvest",
        description: "Rescues surplus food from grocery stores, restaurants, and farms and delivers it free to emergency food providers in Metro Detroit. Over 250 distribution sites weekly.",
        category: "food",
        contact: { phone: "248-967-1500", website: "https://www.forgottenharvest.org", address: "21800 Greenfield Rd, Oak Park, MI 48237" },
        serviceArea: "Metro Detroit",
        serviceAreaType: "county",
        serviceCounties: ["Wayne", "Oakland", "Macomb"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "All community members in need. Free food distribution, no ID required.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Michigan Legal Help",
        description: "Free legal information and self-help tools for Michigan residents who cannot afford an attorney. Covers family law, housing, consumer rights, public benefits, and immigration issues.",
        category: "legal",
        contact: { phone: "888-783-8190", website: "https://michiganlegalhelp.org", address: "Online and phone assistance" },
        serviceArea: "Michigan Statewide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Michigan residents who cannot afford legal representation.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Michigan State Housing Development Authority (MSHDA)",
        description: "Provides rental assistance, homeownership programs, homeless prevention, and affordable housing development. Administers Emergency Rental Assistance and Housing Choice Voucher programs.",
        category: "housing",
        contact: { phone: "517-335-6602", website: "https://www.michigan.gov/mshda", address: "735 E Michigan Ave, Lansing, MI 48912" },
        serviceArea: "Michigan Statewide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Income-eligible Michigan residents. Most programs require income below 80% AMI.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Detroit Rescue Mission Ministries",
        description: "Emergency shelter, transitional housing, substance abuse recovery, workforce development, and family services. Multiple facilities in Detroit serving men, women, and families.",
        category: "housing",
        contact: { phone: "313-993-4700", website: "https://www.drmm.org", address: "150 Stimson St, Detroit, MI 48201" },
        serviceArea: "Detroit",
        serviceAreaType: "city",
        serviceCities: ["Detroit"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Adults and families experiencing homelessness or in crisis. Walk-in intake available.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "COTS (Coalition on Temporary Shelter)",
        description: "Comprehensive homeless services including emergency shelter, permanent supportive housing, mental health counseling, job readiness training, and children's programs in Detroit.",
        category: "housing",
        contact: { phone: "313-831-3777", website: "https://www.cotsdetroit.org", address: "26 Peterboro St, Detroit, MI 48201" },
        serviceArea: "Detroit Metro",
        serviceAreaType: "city",
        serviceCities: ["Detroit"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Individuals and families experiencing homelessness in Detroit. Priority for veterans and families with children.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Michigan Works! Association",
        description: "Free career services including job search assistance, resume writing, skills training, apprenticeship connections, and barrier removal (childcare, transportation). 100+ Michigan Works! service centers statewide.",
        category: "employment",
        contact: { phone: "800-285-9675", website: "https://www.michiganworks.org", address: "Multiple locations statewide" },
        serviceArea: "Michigan Statewide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "All Michigan job seekers. Additional services for SNAP recipients, veterans, and youth.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "JVS Human Services",
        description: "Employment, career counseling, refugee resettlement, and disability services in Southeast Michigan. Partners with local employers for job placement and training programs.",
        category: "employment",
        contact: { phone: "248-233-4232", website: "https://www.jvshumanservices.org", address: "29699 Southfield Rd, Southfield, MI 48076" },
        serviceArea: "Southeast Michigan",
        serviceAreaType: "county",
        serviceCounties: ["Wayne", "Oakland", "Macomb"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "All job seekers. Specialized programs for immigrants, refugees, and individuals with disabilities.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Wayne Metropolitan Community Action Agency",
        description: "Anti-poverty programs including utility assistance (LIHEAP), weatherization, financial coaching, tax preparation, early childhood education (Head Start), and homeless prevention in Wayne County.",
        category: "financial",
        contact: { phone: "734-284-6999", website: "https://www.waynemetro.org", address: "7310 Woodward Ave, Ste 800, Detroit, MI 48202" },
        serviceArea: "Wayne County",
        serviceAreaType: "county",
        serviceCounties: ["Wayne"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Wayne County residents at or below 200% Federal Poverty Level.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Michigan Rehabilitation Services (MRS)",
        description: "Vocational rehabilitation services for individuals with disabilities including job training, assistive technology, education support, and job placement. Part of Michigan DHHS.",
        category: "employment",
        contact: { phone: "800-605-6722", website: "https://www.michigan.gov/leo/bureaus-agencies/mrs", address: "Multiple offices statewide" },
        serviceArea: "Michigan Statewide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Michigan residents with a physical, mental, or emotional disability that impacts employment.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "DDOT & SMART Transit",
        description: "Public bus transportation serving Detroit (DDOT) and suburban Metro Detroit (SMART). Reduced fare programs available for seniors, disabled riders, and Medicare/Medicaid recipients.",
        category: "transportation",
        contact: { phone: "313-933-1300", website: "https://www.detroitmi.gov/ddot", address: "Detroit and Southeast Michigan" },
        serviceArea: "Detroit Metro",
        serviceAreaType: "county",
        serviceCounties: ["Wayne", "Oakland", "Macomb"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "All riders. Reduced fare for seniors 65+, disabled, Medicare/Medicaid cardholders.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "MichiVan / Michigan Rideshare",
        description: "Commuter vanpool and rideshare matching program helping Michigan workers share rides to employment. Subsidized vanpool rates available through MDOT.",
        category: "transportation",
        contact: { phone: "800-CAR-POOL", website: "https://www.michigan.gov/mdot/travel/commuting", address: "Statewide" },
        serviceArea: "Michigan Statewide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Michigan commuters traveling to employment. Must have consistent work schedule.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Focus: HOPE",
        description: "Workforce development, advanced manufacturing training, early childhood education (Head Start), and food programs for seniors in Detroit. Free machinist and IT training with job placement.",
        category: "education",
        contact: { phone: "313-494-5500", website: "https://www.focushope.edu", address: "1400 Oakman Blvd, Detroit, MI 48238" },
        serviceArea: "Detroit",
        serviceAreaType: "city",
        serviceCities: ["Detroit"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Detroit area residents. Training programs: 18+, must pass aptitude assessment. Head Start: income-eligible families with children 0-5.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Adult Education Programs (Michigan)",
        description: "Free GED preparation, high school completion, ESL classes, and basic skills instruction through Michigan's public school system. Available at 150+ locations statewide.",
        category: "education",
        contact: { phone: "517-335-4000", website: "https://www.michigan.gov/mde/services/adult-ed", address: "Multiple locations statewide" },
        serviceArea: "Michigan Statewide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Michigan residents 18+ without a high school diploma or needing basic skills improvement.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Neighborhood Legal Services Michigan",
        description: "Free civil legal aid for low-income residents covering landlord-tenant disputes, public benefits denials, family law, consumer protection, and elder law. Serves Southeast Michigan.",
        category: "legal",
        contact: { phone: "877-313-1215", website: "https://www.neighborhoodlegalservices.org", address: "Fisher Bldg, 3011 W Grand Blvd, Detroit, MI 48202" },
        serviceArea: "Southeast Michigan",
        serviceAreaType: "county",
        serviceCounties: ["Wayne", "Oakland", "Macomb", "Washtenaw", "Monroe", "Lenawee"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Residents at or below 200% Federal Poverty Level. Medicaid recipients qualify automatically.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Crisis Text Line",
        description: "Free 24/7 crisis support via text message. Text HOME to 741741 to connect with a trained crisis counselor for any crisis including anxiety, depression, suicidal thoughts, or abuse.",
        category: "crisis",
        contact: { phone: "741741", website: "https://www.crisistextline.org", address: "Text-based service - nationwide" },
        serviceArea: "Nationwide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: true,
        eligibility: "Anyone in crisis. Free, confidential, available 24/7. Text HOME to 741741.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "988 Suicide & Crisis Lifeline",
        description: "Call or text 988 for free, confidential 24/7 support for mental health crises, suicidal thoughts, substance use, or emotional distress. Spanish-language and deaf/hard-of-hearing services available.",
        category: "crisis",
        contact: { phone: "988", website: "https://988lifeline.org", address: "Nationwide phone/text service" },
        serviceArea: "Nationwide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: true,
        eligibility: "Anyone in crisis or emotional distress. Free, confidential, 24/7.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "SER Metro-Detroit",
        description: "Job training, youth development, early childhood education, financial literacy, and senior services for underserved communities in Metro Detroit. GED prep and ESL classes available.",
        category: "education",
        contact: { phone: "313-846-2240", website: "https://www.sermetro.org", address: "9301 Michigan Ave, Detroit, MI 48210" },
        serviceArea: "Metro Detroit",
        serviceAreaType: "city",
        serviceCities: ["Detroit", "Dearborn", "Hamtramck", "Highland Park"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Low-income Metro Detroit residents. Youth programs: ages 14-24. Senior services: 55+.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Michigan Medicaid Non-Emergency Medical Transportation (NEMT)",
        description: "Free rides to medical appointments for Michigan Medicaid members. Covers doctor visits, therapy, pharmacy trips, dialysis, and other healthcare appointments. Book 2+ business days in advance.",
        category: "transportation",
        contact: { phone: "855-275-6424", website: "https://www.michigan.gov/mdhhs", address: "Michigan statewide" },
        serviceArea: "Michigan Statewide",
        serviceAreaType: "state",
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Active Michigan Medicaid recipients. Must book rides 2+ business days before appointment.",
        isVerified: true,
        connectionType: "external",
      },
      {
        name: "Alternatives For Girls",
        description: "Shelter, supportive housing, mentoring, and prevention programs for homeless and high-risk girls and young women in Detroit. 24-hour emergency shelter for youth ages 15-20.",
        category: "housing",
        contact: { phone: "313-361-4000", website: "https://www.alternativesforgirls.org", address: "903 W Grand Blvd, Detroit, MI 48208" },
        serviceArea: "Detroit",
        serviceAreaType: "city",
        serviceCities: ["Detroit"],
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Girls and young women ages 15-21 in Detroit who are homeless, at-risk, or experiencing exploitation.",
        isVerified: true,
        connectionType: "external",
      },
    ];

    let addedCount = 0;
    for (const resource of michiganResources) {
      if (!existingNames.has(resource.name.toLowerCase().trim())) {
        await storage.createResource(resource);
        existingNames.add(resource.name.toLowerCase().trim());
        addedCount++;
      }
    }
    console.log('[Seed] Added', addedCount, 'core Michigan resources (skipped', michiganResources.length - addedCount, 'existing)');

    const additionalResources: InsertResource[] = [
      { name: "Michigan Energy Assistance Program (MEAP)", description: "Helps low-income households pay heating and electric bills. Funded through LIHEAP federal dollars and state appropriations. Applications accepted October through May.", category: "financial", contact: { phone: "800-292-5650", website: "https://www.michigan.gov/mdhhs", address: "Apply through local community action agencies" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], eligibility: "Households at or below 150% FPL. Medicaid recipients often auto-qualify.", isVerified: true, connectionType: "external" },
      { name: "Salvation Army - Southeast Michigan", description: "Emergency assistance including utility shutoff prevention, rent/mortgage assistance, food pantry, holiday assistance, and disaster relief throughout Metro Detroit.", category: "financial", contact: { phone: "313-965-7760", website: "https://centralusa.salvationarmy.org/usc/southeast-michigan", address: "16130 Northland Dr, Southfield, MI 48075" }, serviceArea: "Southeast Michigan", serviceAreaType: "county", serviceCounties: ["Wayne", "Oakland", "Macomb", "Monroe"], serviceStates: ["MI"], eligibility: "Residents in crisis. Typically requires ID, proof of income, and documentation of need.", isVerified: true, connectionType: "external" },
      { name: "United Way of Southeastern Michigan", description: "Coordinates community impact programs in education, income, and health. Operates 2-1-1 information line and supports 100+ partner agencies providing direct services.", category: "financial", contact: { phone: "313-226-9300", website: "https://unitedwaysem.org", address: "3011 W Grand Blvd, Suite 500, Detroit, MI 48202" }, serviceArea: "Southeast Michigan", serviceAreaType: "county", serviceCounties: ["Wayne", "Oakland", "Macomb", "Washtenaw", "Monroe", "Livingston"], serviceStates: ["MI"], eligibility: "Open to all. Programs target low-to-moderate income families.", isVerified: true, connectionType: "external" },
      { name: "St. Vincent de Paul Society - Detroit", description: "Home visits to families in need providing emergency financial assistance for rent, utilities, food, furniture, and clothing. Volunteers assess needs and provide direct aid.", category: "financial", contact: { phone: "313-972-3100", website: "https://svdpdetroit.org", address: "18425 W McNichols Rd, Detroit, MI 48219" }, serviceArea: "Detroit Metro", serviceAreaType: "city", serviceCities: ["Detroit", "Dearborn", "Hamtramck"], serviceStates: ["MI"], eligibility: "Families in crisis. Contact local parish conference for assistance.", isVerified: true, connectionType: "external" },
      { name: "Brilliant Detroit", description: "Transforms homes in Detroit neighborhoods into family resource hubs offering early childhood education, parenting classes, literacy programs, and community events for families with children 0-8.", category: "education", contact: { phone: "313-483-1715", website: "https://www.brilliantdetroit.org", address: "Multiple neighborhood houses in Detroit" }, serviceArea: "Detroit", serviceAreaType: "city", serviceCities: ["Detroit"], serviceStates: ["MI"], eligibility: "Detroit families with children ages 0-8. Free programs, no income requirements.", isVerified: true, connectionType: "external" },
      { name: "Matrix Human Services", description: "Comprehensive community services including Head Start/Early Head Start, youth development, senior services, workforce development, and after-school programs across Detroit.", category: "education", contact: { phone: "313-526-4000", website: "https://www.matrixhumanservices.org", address: "13560 E McNichols Rd, Detroit, MI 48205" }, serviceArea: "Detroit", serviceAreaType: "city", serviceCities: ["Detroit"], serviceStates: ["MI"], eligibility: "Detroit residents. Head Start: income-eligible families. Youth programs: ages 6-18.", isVerified: true, connectionType: "external" },
      { name: "Southwest Solutions", description: "Comprehensive community development organization providing behavioral health services, housing counseling, workforce development, youth programs, and family services in Southwest Detroit.", category: "mental_health", contact: { phone: "313-841-8150", website: "https://www.swsol.org", address: "5716 Michigan Ave, Detroit, MI 48210" }, serviceArea: "Southwest Detroit", serviceAreaType: "city", serviceCities: ["Detroit"], serviceStates: ["MI"], eligibility: "Detroit residents. Accepts Medicaid, sliding scale available.", isVerified: true, connectionType: "external" },
      { name: "CNS Healthcare", description: "Outpatient behavioral health services including psychiatry, therapy, substance use treatment, case management, and crisis stabilization. Multiple locations in Southeast Michigan.", category: "mental_health", contact: { phone: "734-425-8151", website: "https://www.cnshealthcare.org", address: "28000 Joy Rd, Westland, MI 48185" }, serviceArea: "Southeast Michigan", serviceAreaType: "county", serviceCounties: ["Wayne", "Oakland", "Macomb", "Washtenaw"], serviceStates: ["MI"], eligibility: "All ages. Accepts Medicaid, Medicare, private insurance. Sliding scale for uninsured.", isVerified: true, connectionType: "external" },
      { name: "Hegira Programs (now Samaritas)", description: "Behavioral health and substance use disorder treatment including outpatient therapy, residential treatment, detox, medication-assisted treatment, and recovery support in Wayne County.", category: "mental_health", contact: { phone: "734-458-4601", website: "https://www.samaritas.org", address: "8623 N Wayne Rd, Westland, MI 48185" }, serviceArea: "Wayne County", serviceAreaType: "county", serviceCounties: ["Wayne"], serviceStates: ["MI"], eligibility: "Adults 18+. Accepts Medicaid. Priority for opioid use disorders.", isVerified: true, connectionType: "external" },
      { name: "DWIHN (Detroit Wayne Integrated Health Network)", description: "Mental health authority for Wayne County managing public mental health, substance use, and developmental disability services. Coordinates access to 200+ provider agencies.", category: "mental_health", contact: { phone: "800-241-4949", website: "https://www.dwihn.org", address: "707 W Milwaukee St, Detroit, MI 48202" }, serviceArea: "Wayne County", serviceAreaType: "county", serviceCounties: ["Wayne"], serviceStates: ["MI"], eligibility: "Wayne County residents with Medicaid or who are uninsured with a serious mental health condition.", isVerified: true, connectionType: "external" },
      { name: "Starfish Family Services", description: "Early childhood education (Head Start), family support, behavioral health services, workforce development, and teen parent programs serving Western Wayne County.", category: "education", contact: { phone: "734-728-3400", website: "https://www.starfishonline.org", address: "30000 Hiveley, Inkster, MI 48141" }, serviceArea: "Western Wayne County", serviceAreaType: "county", serviceCounties: ["Wayne"], serviceStates: ["MI"], eligibility: "Western Wayne County families. Head Start: income-eligible. Behavioral health: Medicaid accepted.", isVerified: true, connectionType: "external" },
      { name: "Goodwill Industries of Greater Detroit", description: "Job training, employment placement, career services, and retail stores providing affordable clothing and household goods. Barrier-removal programs for individuals with disabilities.", category: "employment", contact: { phone: "313-964-3900", website: "https://www.goodwilldetroit.org", address: "3901 Chrysler Service Dr, Detroit, MI 48201" }, serviceArea: "Southeast Michigan", serviceAreaType: "county", serviceCounties: ["Wayne", "Oakland", "Macomb", "Monroe", "Washtenaw"], serviceStates: ["MI"], eligibility: "All job seekers. Priority for individuals with barriers to employment.", isVerified: true, connectionType: "external" },
      { name: "ACCESS (Arab Community Center for Economic and Social Services)", description: "Comprehensive human services for all including job training, immigration services, health and mental health, youth programs, education, and social services. Largest Arab American community nonprofit.", category: "employment", contact: { phone: "313-842-7010", website: "https://www.accesscommunity.org", address: "6450 Maple St, Dearborn, MI 48126" }, serviceArea: "Southeast Michigan", serviceAreaType: "city", serviceCities: ["Dearborn", "Detroit", "Hamtramck", "Sterling Heights"], serviceStates: ["MI"], eligibility: "All community members. Multilingual services available (Arabic, Bengali, Bosnian).", isVerified: true, connectionType: "external" },
      { name: "THAW (The Heat and Warmth Fund)", description: "Emergency utility assistance and weatherization services helping Michigan families avoid shutoffs. Provides direct bill payment to utility companies on behalf of eligible households.", category: "financial", contact: { phone: "800-866-8429", website: "https://www.thawfund.org", address: "535 Griswold St, Suite 200, Detroit, MI 48226" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], eligibility: "Michigan households facing utility shutoff. Income at or below 200% FPL.", isVerified: true, connectionType: "external" },
      { name: "Michigan Legal Services", description: "Free legal representation for low-income individuals in civil matters including public benefits, housing, consumer law, immigration, disability rights, and elder law. Statewide coverage.", category: "legal", contact: { phone: "313-964-4130", website: "https://www.michiganlegal.org", address: "220 Bagley Ave, Suite 900, Detroit, MI 48226" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], eligibility: "Michigan residents at or below 200% FPL. Medicaid recipients automatically qualify.", isVerified: true, connectionType: "external" },
      { name: "Lakeshore Legal Aid", description: "Free civil legal services covering housing, family law, consumer rights, public benefits, and immigration for low-income residents in Southeast Michigan's eastern counties.", category: "legal", contact: { phone: "888-783-8190", website: "https://www.lakeshorelegalaid.org", address: "Robert A. Vercruysse Bldg, 21885 Dunham Rd, Clinton Twp, MI 48036" }, serviceArea: "Eastern Southeast Michigan", serviceAreaType: "county", serviceCounties: ["Macomb", "Oakland", "St. Clair", "Sanilac", "Huron", "Tuscola"], serviceStates: ["MI"], eligibility: "Residents at or below 200% FPL in service area. Priority for seniors, veterans, and domestic violence survivors.", isVerified: true, connectionType: "external" },
      { name: "Community Housing Network", description: "Affordable housing development and supportive housing services including permanent supportive housing for formerly homeless individuals, rapid rehousing, and housing navigation.", category: "housing", contact: { phone: "248-928-0111", website: "https://www.communityhousingnetwork.org", address: "44 Elizabeth Lake Rd, Suite 100, Pontiac, MI 48341" }, serviceArea: "Oakland County", serviceAreaType: "county", serviceCounties: ["Oakland"], serviceStates: ["MI"], eligibility: "Individuals and families experiencing homelessness or at risk. Must meet HUD eligibility criteria.", isVerified: true, connectionType: "external" },
      { name: "Neighborhood Service Organization (NSO)", description: "Comprehensive services for Detroit's most vulnerable populations including homeless services, mental health treatment, substance use recovery, re-entry programs, and affordable housing.", category: "housing", contact: { phone: "313-961-4890", website: "https://www.nso-mi.org", address: "882 Oakman Blvd, Detroit, MI 48238" }, serviceArea: "Detroit", serviceAreaType: "city", serviceCities: ["Detroit"], serviceStates: ["MI"], eligibility: "Detroit residents. Priority for homeless, mentally ill, justice-involved, and substance use populations.", isVerified: true, connectionType: "external" },
      { name: "Food Bank Council of Michigan", description: "Network of 7 regional food banks and 2,700+ partner agencies distributing over 300 million meals annually. Find your nearest food pantry, soup kitchen, or mobile distribution.", category: "food", contact: { phone: "517-485-1202", website: "https://www.fbcmich.org", address: "PO Box 2715, East Lansing, MI 48826" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], eligibility: "All Michigan residents in need. No documentation required at most sites.", isVerified: true, connectionType: "external" },
      { name: "Feeding America West Michigan", description: "Regional food bank serving 40 counties in West Michigan. Distributes 35+ million pounds of food annually through 1,100+ partner agencies including pantries, shelters, and meal programs.", category: "food", contact: { phone: "616-784-3250", website: "https://www.feedwm.org", address: "864 West River Center Dr NE, Comstock Park, MI 49321" }, serviceArea: "West Michigan", serviceAreaType: "county", serviceCounties: ["Kent", "Ottawa", "Muskegon", "Allegan", "Kalamazoo", "Calhoun", "Ingham"], serviceStates: ["MI"], eligibility: "All residents in 40-county service area. No income verification required.", isVerified: true, connectionType: "external" },
      { name: "Michigan Domestic Violence Hotline", description: "24/7 crisis hotline providing safety planning, shelter referrals, legal advocacy, and support services for survivors of domestic violence, sexual assault, and stalking throughout Michigan.", category: "crisis", contact: { phone: "800-799-7233", website: "https://www.michigan.gov/mdhhs/safety-injury-prev/dv", address: "Phone/text service statewide" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], isNationwide: false, eligibility: "Anyone experiencing domestic violence, dating violence, sexual assault, or stalking. Free, confidential.", isVerified: true, connectionType: "external" },
      { name: "Michigan Substance Use Disorder Helpline", description: "Free, confidential 24/7 helpline for substance use disorder information, referrals, and crisis support. Connects callers to local treatment providers and support groups.", category: "crisis", contact: { phone: "800-662-4357", website: "https://www.michigan.gov/mdhhs", address: "Phone service statewide" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], isNationwide: false, eligibility: "Anyone seeking substance use disorder help. Free and confidential.", isVerified: true, connectionType: "external" },
      { name: "Beaumont Community Health", description: "Community health programs including chronic disease management, health screenings, wellness classes, maternal health, and community health worker programs throughout Southeast Michigan.", category: "healthcare", contact: { phone: "248-898-5000", website: "https://www.beaumont.org/community-health", address: "Multiple locations in Southeast Michigan" }, serviceArea: "Southeast Michigan", serviceAreaType: "county", serviceCounties: ["Wayne", "Oakland", "Macomb"], serviceStates: ["MI"], eligibility: "Community residents. Many programs free or low-cost. Accepts Medicaid.", isVerified: true, connectionType: "external" },
      { name: "Henry Ford Health Community Programs", description: "Community health initiatives including chronic disease prevention, behavioral health integration, maternal child health, violence prevention, and community health worker programs.", category: "healthcare", contact: { phone: "313-916-2600", website: "https://www.henryford.com/community", address: "1 Ford Place, Detroit, MI 48202" }, serviceArea: "Detroit Metro", serviceAreaType: "county", serviceCounties: ["Wayne", "Oakland", "Macomb"], serviceStates: ["MI"], eligibility: "Community residents. Accepts Medicaid and most insurance. Many programs free.", isVerified: true, connectionType: "external" },
      { name: "Arab American and Chaldean Council (ACC)", description: "Social services, immigration help, behavioral health, substance abuse treatment, youth programs, and cultural services serving diverse communities in Metro Detroit.", category: "mental_health", contact: { phone: "248-559-1990", website: "https://www.myacc.org", address: "111 W Seven Mile Rd, Detroit, MI 48203" }, serviceArea: "Metro Detroit", serviceAreaType: "county", serviceCounties: ["Wayne", "Oakland", "Macomb"], serviceStates: ["MI"], eligibility: "All community members. Multilingual services. Accepts Medicaid and most insurance.", isVerified: true, connectionType: "external" },
      { name: "Michigan Immigrant Rights Center (MIRC)", description: "Free immigration legal services for low-income immigrants including DACA renewals, asylum, family petitions, citizenship applications, and Know Your Rights presentations.", category: "legal", contact: { phone: "269-492-7196", website: "https://www.michiganimmigrant.org", address: "Kalamazoo and Detroit offices" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], eligibility: "Low-income immigrants in Michigan. Income-based eligibility for free legal services.", isVerified: true, connectionType: "external" },
      { name: "Michigan Community Action", description: "Network of 29 community action agencies providing anti-poverty services including LIHEAP energy assistance, weatherization, Head Start, homeless prevention, and financial coaching.", category: "financial", contact: { phone: "517-321-7500", website: "https://www.michigancommunityaction.org", address: "29 agencies across all 83 Michigan counties" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], eligibility: "Households at or below 200% FPL. Services vary by local agency.", isVerified: true, connectionType: "external" },
      { name: "Michigan Prisoner ReEntry Initiative (MPRI)", description: "Reentry services for formerly incarcerated individuals including employment, housing, mentoring, transportation, and substance abuse treatment. Coordinated through local community agencies.", category: "employment", contact: { phone: "517-335-1426", website: "https://www.michigan.gov/corrections", address: "Statewide through regional coordinators" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], eligibility: "Individuals released from Michigan prisons within the past 24 months.", isVerified: true, connectionType: "external" },
      { name: "MiCAFE (Michigan's Complementary Assistance for Elders)", description: "Free benefits enrollment assistance for seniors 60+ helping access Medicare Savings Programs, Medicaid, SNAP, LIHEAP, and prescription drug assistance. Phone and in-person help.", category: "financial", contact: { phone: "877-664-2233", website: "https://www.elderlawofmi.org/micafe", address: "Phone-based statewide" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], eligibility: "Michigan residents age 60+. Free service regardless of income.", isVerified: true, connectionType: "external" },
      { name: "Great Lakes Women's Business Council", description: "Business development for women and minority entrepreneurs including mentorship, certification (WBENC/SBA 8(a)), access to capital, government contracting assistance, and business education.", category: "employment", contact: { phone: "313-962-0230", website: "https://www.glwbc.org", address: "400 Renaissance Center, Suite 2260, Detroit, MI 48243" }, serviceArea: "Michigan and Northern Ohio", serviceAreaType: "state", serviceStates: ["MI"], eligibility: "Women and minority business owners in Michigan. Some programs have income/business criteria.", isVerified: true, connectionType: "external" },
      { name: "Medicaid Health Plans (Michigan)", description: "Michigan Medicaid managed care health plans including Molina, Priority Health, Meridian, United Healthcare, and Blue Cross Complete. Members choose a plan for coordinated healthcare services.", category: "healthcare", contact: { phone: "800-975-7630", website: "https://www.michigan.gov/mdhhs/assistance-programs/healthcare", address: "Statewide coverage" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], isNationwide: false, eligibility: "Michigan Medicaid-eligible residents. Enrollment through MDHHS.", isVerified: true, connectionType: "external" },
      { name: "Michigan Healthy Mothers Healthy Babies", description: "Prenatal and postpartum support including home visiting, breastfeeding support, car seat safety, safe sleep education, and doula services for pregnant women and new mothers.", category: "healthcare", contact: { phone: "800-26-BIRTH", website: "https://www.michigan.gov/mdhhs", address: "Programs available statewide through local health departments" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], isNationwide: false, eligibility: "Pregnant women and new mothers in Michigan. Priority for Medicaid-eligible and high-risk pregnancies.", isVerified: true, connectionType: "external" },
      { name: "Habitat for Humanity Michigan", description: "Affordable homeownership through new construction and home repairs. Partners with families to build homes with affordable mortgages. Also provides critical home repair services for low-income homeowners.", category: "housing", contact: { phone: "517-484-5940", website: "https://www.habitatmichigan.org", address: "52 Michigan affiliates statewide" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], isNationwide: false, eligibility: "Families earning 30-80% AMI, willing to partner (sweat equity), and in need of adequate housing.", isVerified: true, connectionType: "external" },
      { name: "Oakland Livingston Human Service Agency (OLHSA)", description: "Anti-poverty services including energy assistance, weatherization, Head Start, financial coaching, home repair, transportation, and senior services in Oakland and Livingston Counties.", category: "financial", contact: { phone: "248-209-2600", website: "https://www.olhsa.org", address: "196 Cesar E. Chavez Ave, Pontiac, MI 48342" }, serviceArea: "Oakland and Livingston Counties", serviceAreaType: "county", serviceCounties: ["Oakland", "Livingston"], serviceStates: ["MI"], eligibility: "Households at or below 200% FPL in Oakland or Livingston County.", isVerified: true, connectionType: "external" },
      { name: "Michigan Works! Southeast (DESC)", description: "Workforce development services including career coaching, skills training, apprenticeship connections, youth employment, and employer partnerships for Wayne County job seekers.", category: "employment", contact: { phone: "313-876-0674", website: "https://www.descmiworks.com", address: "455 W Fort St, 6th Fl, Detroit, MI 48226" }, serviceArea: "Wayne County", serviceAreaType: "county", serviceCounties: ["Wayne"], serviceStates: ["MI"], eligibility: "Wayne County residents 18+. Additional programs for SNAP recipients and veterans.", isVerified: true, connectionType: "external" },
      { name: "Michigan Association of Community Mental Health Boards", description: "Coordinates 46 Community Mental Health Service Programs providing psychiatric services, crisis intervention, substance use treatment, autism services, and developmental disability supports across all Michigan counties.", category: "mental_health", contact: { phone: "517-374-6848", website: "https://www.macmhb.org", address: "426 S Walnut St, Lansing, MI 48933" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], eligibility: "Michigan Medicaid recipients and uninsured with serious mental illness. Access through county CMH.", isVerified: true, connectionType: "external" },
      { name: "Hope Network", description: "Rehabilitation and community services including brain injury rehab, vocational training, affordable housing, substance use treatment, mental health, and autism services statewide.", category: "mental_health", contact: { phone: "800-695-7273", website: "https://www.hopenetwork.org", address: "755 36th St SE, Grand Rapids, MI 49548" }, serviceArea: "Michigan Statewide", serviceAreaType: "state", serviceStates: ["MI"], eligibility: "Individuals with disabilities, brain injuries, mental health conditions, or substance use disorders. Accepts Medicaid.", isVerified: true, connectionType: "external" },
      { name: "Piquette Square Veterans' Housing", description: "Permanent supportive housing for homeless veterans in Detroit. 150 furnished studio apartments with on-site support services including mental health, substance use treatment, and employment assistance.", category: "housing", contact: { phone: "313-576-1175", website: "https://www.swsol.org", address: "75 Piquette Ave, Detroit, MI 48202" }, serviceArea: "Detroit Metro", serviceAreaType: "city", serviceCities: ["Detroit"], serviceStates: ["MI"], eligibility: "Homeless veterans. Must have VA healthcare eligibility and meet HUD-VASH criteria.", isVerified: true, connectionType: "external" },
      { name: "Legal Aid of Western Michigan", description: "Free civil legal services for low-income residents in 17 counties of West Michigan. Covers housing, family law, consumer debt, public benefits, and immigration issues.", category: "legal", contact: { phone: "888-783-8190", website: "https://www.lawestmi.org", address: "25 Division Ave S, Suite 600, Grand Rapids, MI 49503" }, serviceArea: "Western Michigan", serviceAreaType: "county", serviceCounties: ["Kent", "Ottawa", "Muskegon", "Kalamazoo", "Calhoun", "Barry", "Allegan", "Ionia"], serviceStates: ["MI"], eligibility: "Residents at or below 200% FPL in 17-county service area.", isVerified: true, connectionType: "external" },
    ];

    let additionalAdded = 0;
    for (const resource of additionalResources) {
      if (!existingNames.has(resource.name.toLowerCase().trim())) {
        await storage.createResource(resource);
        existingNames.add(resource.name.toLowerCase().trim());
        additionalAdded++;
      }
    }
    console.log('[Seed] Added', additionalAdded, 'additional Michigan resources (skipped', additionalResources.length - additionalAdded, 'existing)');

    let bulkAdded = 0;
    for (const resource of michiganSeedResources) {
      if (!existingNames.has(resource.name.toLowerCase().trim())) {
        try {
          await storage.createResource(resource);
          existingNames.add(resource.name.toLowerCase().trim());
          bulkAdded++;
        } catch (err: any) {
          console.warn('[Seed] Skip:', resource.name, err?.message?.slice(0, 60));
        }
      }
    }
    console.log('[Seed] Added', bulkAdded, 'bulk Michigan seed resources (skipped', michiganSeedResources.length - bulkAdded, 'existing)');
    console.log('[Seed] Total resources now:', existingNames.size);

  } catch (error) {
    console.warn('[Seed] Resource seeding error:', error);
  }
}

async function autoSyncExternalResources() {
  try {
    const { getAPIStatus, searchExternalResources } = await import('./services/resource-apis');
    const { fetchAllFreePublicResources } = await import('./services/free-resource-apis');
    const status = getAPIStatus();

    console.log(
      '[AutoSync] Sources enabled:',
      'free-public(HUD)',
      status.api211 ? '211' : '',
      status.findHelp ? 'FindHelp' : '',
    );

    // 1. FREE public sources (HUD ArcGIS) — no key required, always run
    try {
      console.log('[AutoSync:Free] Fetching HUD public housing data...');
      const free = await fetchAllFreePublicResources();
      let freeAdded = 0;
      let freeSkipped = 0;
      for (const resource of free.resources) {
        const existing = await storage.searchResources(resource.name);
        const isDuplicate = existing.some(
          (e) => e.name.toLowerCase().trim() === resource.name.toLowerCase().trim(),
        );
        if (!isDuplicate) {
          try {
            await storage.createResource(resource);
            freeAdded++;
          } catch {
            freeSkipped++;
          }
        } else {
          freeSkipped++;
        }
      }
      console.log(
        `[AutoSync:Free] Imported ${freeAdded} new resources, skipped ${freeSkipped} duplicates.`,
        'By source:', JSON.stringify(free.bySource),
      );
      if (free.errors.length) {
        console.warn('[AutoSync:Free] Provider errors:', free.errors);
      }
    } catch (err) {
      console.warn('[AutoSync:Free] HUD sync failed (non-critical):', err);
    }

    // 2. Paid sources (211, FindHelp) — only if keys configured
    if (!status.api211 && !status.findHelp) {
      console.log('[AutoSync] No paid API keys (API_211_KEY/FINDHELP_API_KEY). Skipping paid sync.');
      return;
    }

    const MICHIGAN_ZIP_CODES = [
      '48201', '48202', '48204', '48205', '48206', '48207', '48208', '48209', '48210',
      '48211', '48212', '48213', '48214', '48215', '48216', '48217', '48219', '48221',
      '48223', '48224', '48225', '48226', '48227', '48228', '48229', '48230', '48234',
      '48235', '48236', '48237', '48238', '48239', '48240',
      '48009', '48067', '48071', '48073', '48075', '48076', '48084', '48085',
      '48030', '48034', '48037', '48301', '48302', '48304', '48307', '48309',
      '48021', '48035', '48036', '48038', '48042', '48043', '48044', '48045',
      '48823', '48824', '48842', '48854', '48864', '48906', '48910', '48911', '48912',
      '49503', '49504', '49505', '49506', '49507', '49508', '49525', '49546',
      '48103', '48104', '48105', '48108', '48197',
      '49001', '49002', '49006', '49007', '49008',
      '48601', '48602', '48603', '48604',
      '48502', '48503', '48504', '48505', '48506', '48507',
    ];

    const CATEGORIES = ['housing', 'food', 'mental_health', 'employment', 'transportation', 'legal', 'financial', 'healthcare', 'education'];

    let totalSynced = 0;
    let totalSkipped = 0;

    for (const zipCode of MICHIGAN_ZIP_CODES) {
      for (const category of CATEGORIES) {
        try {
          const externalResources = await searchExternalResources(zipCode, category, 10);

          for (const resource of externalResources) {
            const existing = await storage.searchResources(resource.name);
            const isDuplicate = existing.some(e => e.name.toLowerCase().trim() === resource.name.toLowerCase().trim());
            if (!isDuplicate) {
              await storage.createResource(resource);
              totalSynced++;
            } else {
              totalSkipped++;
            }
          }
        } catch {
          continue;
        }
      }

      if (totalSynced > 0 && totalSynced % 50 === 0) {
        console.log(`[AutoSync] Progress: ${totalSynced} new resources synced, ${totalSkipped} duplicates skipped...`);
      }
    }

    console.log(`[AutoSync] Complete: ${totalSynced} new resources imported, ${totalSkipped} duplicates skipped`);
  } catch (error) {
    console.warn('[AutoSync] External resource sync failed (non-critical):', error);
  }
}

async function seedPulseQuestionsIfEmpty() {
  try {
    const existing = await db.select().from(pulseQuestions).limit(1);
    if (existing.length > 0) return;

    console.log('[Seed] Adding initial pulse questions...');
    const questions = [
      {
        id: 'pulse-001',
        question: "How are you really doing today?",
        category: "mood",
        questionType: "multiple_choice",
        options: JSON.stringify([
          { value: "thriving", label: "Thriving" },
          { value: "good", label: "Good" },
          { value: "okay", label: "Okay" },
          { value: "struggling", label: "Struggling" },
          { value: "surviving", label: "Just surviving" },
        ]),
        isActive: true,
        priority: 10,
        xpReward: 5,
      },
      {
        id: 'pulse-002',
        question: "What's your energy level right now?",
        category: "mood",
        questionType: "multiple_choice",
        options: JSON.stringify([
          { value: "charged", label: "Fully charged" },
          { value: "steady", label: "Steady" },
          { value: "low", label: "Running low" },
          { value: "drained", label: "Completely drained" },
        ]),
        isActive: true,
        priority: 8,
        xpReward: 5,
      },
      {
        id: 'pulse-003',
        question: "What matters most to you this week?",
        category: "future",
        questionType: "multiple_choice",
        options: JSON.stringify([
          { value: "career", label: "Career moves" },
          { value: "health", label: "Health & wellness" },
          { value: "relationships", label: "Relationships" },
          { value: "money", label: "Financial goals" },
          { value: "growth", label: "Personal growth" },
        ]),
        isActive: true,
        priority: 7,
        xpReward: 5,
      },
      {
        id: 'pulse-004',
        question: "One word to describe your current mindset?",
        category: "wisdom",
        questionType: "multiple_choice",
        options: JSON.stringify([
          { value: "focused", label: "Focused" },
          { value: "anxious", label: "Anxious" },
          { value: "motivated", label: "Motivated" },
          { value: "lost", label: "Lost" },
          { value: "grateful", label: "Grateful" },
          { value: "determined", label: "Determined" },
        ]),
        isActive: true,
        priority: 6,
        xpReward: 5,
      },
      {
        id: 'pulse-005',
        question: "What would make today a W?",
        category: "real_talk",
        questionType: "multiple_choice",
        options: JSON.stringify([
          { value: "progress", label: "Making progress on a goal" },
          { value: "connection", label: "Connecting with someone" },
          { value: "rest", label: "Actually resting" },
          { value: "money", label: "Getting the bag" },
          { value: "clarity", label: "Getting clarity on something" },
        ]),
        isActive: true,
        priority: 5,
        xpReward: 5,
      },
      {
        id: 'pulse-006',
        question: "What's your biggest challenge right now?",
        category: "community",
        questionType: "multiple_choice",
        options: JSON.stringify([
          { value: "time", label: "Not enough time" },
          { value: "motivation", label: "Staying motivated" },
          { value: "resources", label: "Lack of resources" },
          { value: "support", label: "Need more support" },
          { value: "direction", label: "Finding direction" },
        ]),
        isActive: true,
        priority: 4,
        xpReward: 5,
      },
    ];

    for (const q of questions) {
      await db.insert(pulseQuestions).values(q).onConflictDoNothing();
    }
    console.log('[Seed] Added', questions.length, 'pulse questions');
  } catch (error) {
    console.warn('[Seed] Pulse questions seeding error:', error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Initialize services (event bus + S3 data lake)
  initializeServices().catch((err: Error) => {
    console.warn('Services initialization failed (non-critical):', err.message);
  });
  
  // Auto-seed drops and signals if empty
  seedFlowDataIfEmpty().catch((err: Error) => {
    console.warn('Flow data seeding failed (non-critical):', err.message);
  });

  // Auto-seed pulse questions if empty
  seedPulseQuestionsIfEmpty().catch((err: Error) => {
    console.warn('Pulse questions seeding failed (non-critical):', err.message);
  });

  // Seed resources, initialize SmartMatcher, then auto-sync external APIs
  seedResourcesIfEmpty().then(() => {
    return smartMatcher.initialize();
  }).then(() => {
    console.log('SmartMatcher: HSDS Resource Index initialized');
    return autoSyncExternalResources();
  }).then(() => {
    return smartMatcher.initialize();
  }).catch((err: Error) => {
    console.warn('Resource seeding / SmartMatcher init failed (non-critical):', err.message);
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Database health check - for ops monitoring
  app.get("/api/health/db", (req, res) => {
    const dbStatus = getDatabaseStatus();
    const status = dbStatus.connected ? "ok" : "error";
    const httpStatus = dbStatus.connected ? 200 : 503;
    
    res.status(httpStatus).json({
      status,
      database: {
        connected: dbStatus.connected,
        error: dbStatus.error,
        provider: "supabase",
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================
  // AUTH ENDPOINTS
  // ============================================

  // Sync user after Supabase auth
  const authSyncSchema = z.object({
    email: z.string().email().max(254).optional(),
    displayName: z.string().min(1).max(100).optional(),
    consent: userConsentSchema.optional(),
    termsAccepted: z.boolean().optional(),
  });
  app.post("/api/auth/sync", authRateLimiter, verifyToken, async (req, res) => {
    try {
      const parseResult = authSyncSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid auth sync payload", details: parseResult.error.flatten() });
      }
      const { email, displayName, consent, termsAccepted } = parseResult.data;
      const authUserId = req.authUser?.authUserId;

      if (!authUserId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Pull consent + terms acceptance from Supabase user_metadata as a fallback
      // (covers the email-verification signup path where the client has no
      // session at signUp() time and re-syncs later without consent in body).
      let metaConsent: typeof consent | undefined = undefined;
      let metaTermsAcceptedAt: Date | null = null;
      try {
        const { data: adminUser } = await supabaseAdmin.auth.admin.getUserById(authUserId);
        const meta = (adminUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
        const rawConsent = meta.consent;
        if (rawConsent && typeof rawConsent === 'object') {
          const parsed = userConsentSchema.partial().safeParse(rawConsent);
          if (parsed.success) {
            metaConsent = { ...DEFAULT_USER_CONSENT, ...parsed.data } as typeof consent;
          }
        }
        if (meta.terms_accepted === true) {
          const ts = typeof meta.terms_accepted_at === 'string' ? new Date(meta.terms_accepted_at) : new Date();
          metaTermsAcceptedAt = isNaN(ts.getTime()) ? new Date() : ts;
        }
      } catch (metaErr) {
        console.warn('[auth/sync] could not read Supabase user_metadata:', metaErr);
      }

      const effectiveConsent = consent ?? metaConsent;
      const effectiveTermsAt: Date | null = termsAccepted ? new Date() : metaTermsAcceptedAt;

      // Check if user already exists with this authUserId
      const existingUsers = await db.select().from(users).where(eq(users.authUserId, authUserId));
      
      if (existingUsers.length > 0) {
        // User exists. NEVER overwrite existing DB consent from stale
        // signup metadata on routine sign-ins — only backfill when the
        // DB value is missing, OR when the current request body explicitly
        // supplies fresh consent (e.g. a re-onboarding flow).
        const existing = existingUsers[0];
        const needsConsentBackfill = !existing.consent && (consent || metaConsent);
        const needsTermsBackfill = !existing.termsAcceptedAt && (termsAccepted || metaTermsAcceptedAt);
        const explicitConsentInBody = !!consent;

        if (needsConsentBackfill || needsTermsBackfill || explicitConsentInBody) {
          await db.update(users)
            .set({
              consent: explicitConsentInBody
                ? consent
                : (existing.consent ?? metaConsent ?? DEFAULT_USER_CONSENT),
              termsAcceptedAt: existing.termsAcceptedAt
                ?? (termsAccepted ? new Date() : metaTermsAcceptedAt),
            })
            .where(eq(users.id, existing.id));
          const refreshed = await storage.getUser(existing.id);
          return res.json(refreshed);
        }
        return res.json(existing);
      }

      // Create new user linked to Supabase auth
      const username = email?.split('@')[0] || `user_${Date.now()}`;
      const newUser = await storage.createUser({
        username: username,
        displayName: displayName || username,
        userType: "member",
      });

      // Update with authUserId, email, and consent (body OR metadata fallback)
      await db.update(users)
        .set({
          authUserId,
          email,
          consent: effectiveConsent ?? DEFAULT_USER_CONSENT,
          termsAcceptedAt: effectiveTermsAt,
        })
        .where(eq(users.id, newUser.id));

      const updatedUser = await storage.getUser(newUser.id);
      res.json(updatedUser);
    } catch (error) {
      console.error("Auth sync error:", error);
      res.status(500).json({ error: "Failed to sync user" });
    }
  });

  // Update data-sharing consent (Profile → Privacy panel)
  app.patch("/api/auth/consent", authRateLimiter, verifyToken, async (req, res) => {
    try {
      const authUserId = req.authUser?.authUserId;
      if (!authUserId) return res.status(401).json({ error: "Not authenticated" });

      const parseResult = userConsentSchema.partial().safeParse(req.body ?? {});
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid consent payload", details: parseResult.error.flatten() });
      }

      const existingUsers = await db.select().from(users).where(eq(users.authUserId, authUserId));
      if (existingUsers.length === 0) {
        return res.status(404).json({ error: "Profile not found" });
      }
      const user = existingUsers[0];
      const merged = { ...(user.consent ?? DEFAULT_USER_CONSENT), ...parseResult.data };

      await db.update(users).set({ consent: merged }).where(eq(users.id, user.id));

      // Keep Supabase auth metadata in sync so a future /api/auth/sync
      // metadata fallback can't resurrect stale signup-time consent.
      try {
        await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          user_metadata: { consent: merged },
        });
      } catch (metaErr) {
        console.warn('[auth/consent] could not mirror consent to Supabase metadata:', metaErr);
      }

      const updated = await storage.getUser(user.id);
      res.json({ consent: updated?.consent ?? merged });
    } catch (error) {
      console.error("Update consent error:", error);
      res.status(500).json({ error: "Failed to update consent" });
    }
  });

  // Get current user profile
  app.get("/api/auth/profile", readRateLimiter, verifyToken, async (req, res) => {
    try {
      const authUserId = req.authUser?.authUserId;

      if (!authUserId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const existingUsers = await db.select().from(users).where(eq(users.authUserId, authUserId));
      
      if (existingUsers.length === 0) {
        return res.status(404).json({ error: "Profile not found. Please complete registration." });
      }

      const user = existingUsers[0];
      
      // Get additional profile data
      const [userBadges] = await Promise.all([
        storage.getUserBadges(user.id),
      ]);

      res.json({
        ...user,
        badges: userBadges.map(ub => ub.badge),
      });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  // Update user profile
  const profilePatchSchema = z.object({
    displayName: z.string().min(1).max(100).optional(),
    bio: z.string().max(2000).optional(),
    avatarUrl: z.string().url().max(2048).optional(),
  });
  app.patch("/api/auth/profile", authRateLimiter, verifyToken, async (req, res) => {
    try {
      const authUserId = req.authUser?.authUserId;
      const parseResult = profilePatchSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid profile payload", details: parseResult.error.flatten() });
      }
      const { displayName, bio, avatarUrl } = parseResult.data;

      if (!authUserId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const existingUsers = await db.select().from(users).where(eq(users.authUserId, authUserId));
      
      if (existingUsers.length === 0) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const user = existingUsers[0];

      await db.update(users)
        .set({ 
          displayName: displayName ?? user.displayName,
          bio: bio ?? user.bio,
          avatarUrl: avatarUrl ?? user.avatarUrl,
        })
        .where(eq(users.id, user.id));

      const updatedUser = await storage.getUser(user.id);
      res.json(updatedUser);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  const VALID_DOMAINS = ["housing", "health", "career", "education", "financial", "mental_health", "family", "community"] as const;

  const onboardingCompleteSchema = z.object({
    domains: z.array(z.enum(VALID_DOMAINS)).max(8).default([]),
    zipCode: z.string().regex(/^\d{5}$/).optional(),
    sianiMessage: z.string().max(500).optional(),
  });

  app.post("/api/auth/onboarding/complete", authRateLimiter, verifyToken, async (req, res) => {
    try {
      const authUserId = req.authUser?.authUserId;
      if (!authUserId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const existingUsers = await db.select().from(users).where(eq(users.authUserId, authUserId));
      if (existingUsers.length === 0) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const user = existingUsers[0];

      if (user.onboardingComplete) {
        return res.json(user);
      }

      const parseResult = onboardingCompleteSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid onboarding data", details: parseResult.error.flatten() });
      }

      const { domains, zipCode, sianiMessage } = parseResult.data;

      if (zipCode) {
        await storage.upsertUserLocation({
          userId: user.id,
          zipCode,
          source: "self_reported",
          isPrimary: true,
        });
      }

      const domainGoalMap: Record<string, { title: string; description: string }> = {
        housing: { title: "Secure stable housing", description: "Find and maintain safe, affordable housing" },
        health: { title: "Prioritize my health", description: "Build consistent health and wellness habits" },
        career: { title: "Level up my career", description: "Take steps toward career growth and stability" },
        education: { title: "Invest in my education", description: "Pursue learning opportunities and skill development" },
        financial: { title: "Build financial stability", description: "Create a plan for financial security and growth" },
        mental_health: { title: "Strengthen my mental health", description: "Prioritize emotional well-being and resilience" },
        family: { title: "Support my family", description: "Build stronger family connections and support systems" },
        community: { title: "Connect with my community", description: "Get involved and build meaningful community ties" },
      };

      for (const domain of domains) {
        const goalInfo = domainGoalMap[domain];
        if (goalInfo) {
          await storage.createGoal({
            userId: user.id,
            title: goalInfo.title,
            description: goalInfo.description,
            category: domain,
          });
        }
      }

      if (domains.length > 0) {
        await storage.createSianiMemory({
          userId: user.id,
          memoryType: "preference",
          category: "goals",
          content: `During onboarding, chose to focus on: ${domains.join(", ")}. These are their priority life domains.`,
          importance: 8,
          emotionalWeight: 5,
          isActive: true,
        });
      }

      if (zipCode) {
        await storage.createSianiMemory({
          userId: user.id,
          memoryType: "fact",
          category: "location",
          content: `Lives in zip code ${zipCode}. Set during onboarding for resource matching.`,
          importance: 7,
          emotionalWeight: 3,
          isActive: true,
        });
      }

      if (sianiMessage && sianiMessage.trim()) {
        await storage.createSianiMemory({
          userId: user.id,
          memoryType: "goal",
          category: "personal",
          content: `First message to Siani during onboarding: "${sianiMessage.trim()}"`,
          importance: 9,
          emotionalWeight: 7,
          isActive: true,
        });
      }

      await db.update(users)
        .set({ onboardingComplete: true })
        .where(eq(users.id, user.id));

      const updatedUser = await storage.getUser(user.id);
      res.json(updatedUser);
    } catch (error) {
      console.error("Onboarding complete error:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // ============================================
  // USER ENDPOINTS
  // ============================================

  // Helper to get or create demo user
  async function getOrCreateDemoUser(idOrUsername: string) {
    // Try to get by ID first
    let user = await storage.getUser(idOrUsername);
    if (user) return user;
    
    // Try to get by username for demo-user
    if (idOrUsername === "demo-user") {
      user = await storage.getUserByUsername("demo-user");
      if (user) return user;
      
      // Create demo user if it doesn't exist
      user = await storage.createUser({
        username: "demo-user",
        displayName: "Member",
        userType: "member",
      });
      return user;
    }
    
    return undefined;
  }

  // Hard-delete the authenticated user's account. Requires an explicit
  // typed confirmation phrase in the body to guard against accidental
  // calls. All owned rows are removed by the FK cascades declared in
  // shared/schema.ts; assignment-style fields are set null so historical
  // care/issue tracking survives. Anonymous vault confessions are NOT
  // deleted (they are already unattributable by design).
  app.delete("/api/users/me", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const confirmation = (req.body?.confirmation ?? "").toString();
      if (confirmation !== "DELETE MY ACCOUNT") {
        return res.status(400).json({
          error: "Confirmation required",
          hint: 'POST body must include { "confirmation": "DELETE MY ACCOUNT" }',
        });
      }
      const ok = await storage.deleteUser(userId);
      if (!ok) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true, deletedUserId: userId });
    } catch (error: any) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Failed to delete account", detail: error?.message });
    }
  });

  // Get user by ID
  app.get("/api/users/:id", verifyToken, async (req, res) => {
    try {
      const { id } = req.params;
      if (req.authUser?.id !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const user = await getOrCreateDemoUser(id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Get user profile (membership info)
  app.get("/api/users/:id/profile", verifyToken, async (req, res) => {
    try {
      const { id } = req.params;
      if (req.authUser?.id !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const user = await getOrCreateDemoUser(id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Return membership profile data
      const profile = {
        memberSince: user.createdAt || new Date().toISOString(),
        membershipTier: user.userType === 'icon' ? 'Icon' : user.userType === 'admin' ? 'Admin' : 'Member',
        location: "Detroit, MI", // Default location for demo
        interests: ["Community", "Growth", "Wellness"],
      };
      
      res.json(profile);
    } catch (error) {
      console.error("Get user profile error:", error);
      res.status(500).json({ error: "Failed to get user profile" });
    }
  });

  // Get user stats (XP, level, streak, badges, etc.)
  app.get("/api/users/:id/stats", verifyToken, async (req, res) => {
    try {
      const { id } = req.params;
      if (req.authUser?.id !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const user = await getOrCreateDemoUser(id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get complete gamification stats from the service
      const gamificationStats = await getUserGamificationStats(user.id);
      
      // Get actual completed moves count from storage
      const movesCompleted = await storage.getCompletedMovesCount(user.id);
      const challengesCompleted = await storage.getCompletedChallengesCount(user.id);
      const challengeWins = await storage.getChallengeWins(user.id);

      // Calculate pulse score from gamification data
      const stats = gamificationStats || {
        xp: 0, credBalance: 0, currentStreak: 0, longestStreak: 0,
        level: 1, nextLevelXp: 100, xpProgress: 0, badges: [], badgeCount: 0
      };
      
      const pulseScore = Math.round(
        (stats.xp * 0.1) + 
        (stats.credBalance * 0.2) +
        (stats.currentStreak * 10)
      );

      // Generate pulse trend (last 7 days - simplified for now)
      const pulseTrend = Array.from({ length: 7 }, (_, i) => 
        Math.round(pulseScore * (0.8 + Math.random() * 0.4))
      );

      res.json({
        xp: stats.xp,
        credBalance: stats.credBalance,
        level: stats.level,
        xpForNextLevel: stats.nextLevelXp,
        xpProgress: stats.xpProgress,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        streakSaveUsed: (stats as any).streakSaveUsed ?? false,
        streakSavedAt: (stats as any).streakSavedAt ?? null,
        movesCompleted,
        challengesCompleted,
        challengeWins,
        badges: stats.badges,
        badgeCount: stats.badgeCount,
        pulseScore,
        pulseTrend,
        prizesWon: challengeWins.length,
        memberSince: user.createdAt,
      });
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({ error: "Failed to get user stats" });
    }
  });

  // Update user location - for resource matching (separate HSDS-compatible table)
  app.patch("/api/users/:id/location", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { id } = req.params;
      if (req.authUser?.id !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { zipCode, city, state, county, latitude, longitude, source } = req.body;

      const user = await getOrCreateDemoUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Upsert user location in separate table
      const location = await storage.upsertUserLocation({
        userId: user.id,
        zipCode,
        city,
        state,
        county,
        latitude,
        longitude,
        source: source || 'self_reported',
      });

      res.json(location);
    } catch (error) {
      console.error("Update location error:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  // Get user location
  app.get("/api/users/:id/location", verifyToken, readRateLimiter, async (req, res) => {
    try {
      const { id } = req.params;
      if (req.authUser?.id !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const user = await getOrCreateDemoUser(id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const location = await storage.getUserLocation(user.id);

      if (!location) {
        return res.json({
          hasLocation: false,
          message: "No location set. Siani can help with local resources once you share your location.",
        });
      }

      res.json({
        ...location,
        hasLocation: !!(location.zipCode || location.city || location.state),
      });
    } catch (error) {
      console.error("Get location error:", error);
      res.status(500).json({ error: "Failed to get location" });
    }
  });

  // ============================================
  // GAMIFICATION ENGINE
  // ============================================

  // Initialize badges on startup
  ensureBadgesExist().catch(console.error);

  // Get detailed gamification stats
  app.get("/api/gamification/:userId", verifyToken, readRateLimiter, async (req, res) => {
    try {
      const { userId } = req.params;
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const user = await getOrCreateDemoUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const stats = await getUserGamificationStats(user.id);
      if (!stats) {
        return res.status(404).json({ error: "Could not retrieve stats" });
      }

      res.json(stats);
    } catch (error) {
      console.error("Get gamification stats error:", error);
      res.status(500).json({ error: "Failed to get gamification stats" });
    }
  });

  // Process an action and get gamification rewards
  app.post("/api/gamification/action", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { userId, actionType, sourceId } = req.body;
      
      if (!userId || !actionType) {
        return res.status(400).json({ error: "userId and actionType are required" });
      }
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const validActions = [
        "move_completed", "checkin", "drop_rsvp", "signal_posted",
        "circle_help", "referral_completed", "vault_confession", "daily_action"
      ];
      
      if (!validActions.includes(actionType)) {
        return res.status(400).json({ 
          error: "Invalid actionType",
          validActions 
        });
      }

      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const result = await processAction(user.id, actionType, sourceId);
      
      res.json({
        success: true,
        ...result,
        message: result.levelUp 
          ? `Level up! You're now level ${result.levelUp.newLevel}!` 
          : result.badgesAwarded.length > 0
            ? `Badge earned: ${result.badgesAwarded.map(b => b.badge.name).join(", ")}`
            : result.credAwarded > 0
              ? `+${result.credAwarded} CRED earned`
              : "Action recorded",
      });
    } catch (error) {
      console.error("Process action error:", error);
      res.status(500).json({ error: "Failed to process action" });
    }
  });

  // Update streak (daily check-in)
  app.post("/api/gamification/streak", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const streakResult = await updateStreak(user.id);
      
      // Check for streak badges
      const badgeAwards = await checkAndAwardBadges(user.id, {
        currentStreak: streakResult.streak,
      });
      
      res.json({
        success: true,
        streak: streakResult.streak,
        isNewDay: streakResult.isNewDay,
        streakBroken: streakResult.streakBroken,
        newBadges: badgeAwards.map(b => ({
          id: b.badge.id,
          name: b.badge.name,
          description: b.badge.description,
        })),
      });
    } catch (error) {
      console.error("Update streak error:", error);
      res.status(500).json({ error: "Failed to update streak" });
    }
  });

  // T102 — Server-validated surprise micro-CRED ("lucky drop").
  // Deterministic 1-in-7 by (userId, calendar-day) with at-most-once-per-day
  // semantics enforced by the unique idempotencyKey on credTransactions.
  // Awards +5 CRED silently when the roll hits.
  app.post("/api/gamification/lucky-drop", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const user = await getOrCreateDemoUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Calendar-day key in server local time.
      const d = new Date();
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // Deterministic 1-in-7 hash.
      const seed = `${user.id}|${dayKey}`;
      let h = 5381;
      for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
      const hit = (Math.abs(h) % 7) === 0;

      if (!hit) {
        return res.json({ awarded: false, credAwarded: 0, reason: "no_hit" });
      }

      const { awardCred } = await import("./services/gamification");
      const idempotencyKey = `lucky-drop:${user.id}:${dayKey}`;
      const beforeTs = Date.now();
      const result = await awardCred(user.id, 5, "lucky_drop", "lucky_drop", undefined, idempotencyKey);
      // A pre-existing transaction has a createdAt before the request started;
      // a freshly-inserted one has createdAt at/after `beforeTs`. This is the
      // only reliable way to tell new from duplicate via the current API.
      const txCreated = result.transaction?.createdAt
        ? new Date(result.transaction.createdAt).getTime()
        : 0;
      const wasNew = txCreated >= beforeTs - 1000;

      return res.json({
        awarded: wasNew,
        credAwarded: wasNew ? 5 : 0,
        newBalance: result.newBalance,
      });
    } catch (error) {
      console.error("Lucky drop error:", error);
      res.status(500).json({ error: "Failed to roll lucky drop" });
    }
  });

  // T107 — 7-day "Nexus" activity strip. Returns the past 7 calendar days
  // (oldest → newest), each with `active: true` if the user logged any
  // check-in or CRED transaction on that day.
  app.get("/api/gamification/nexus/:userId", verifyToken, readRateLimiter, async (req, res) => {
    try {
      const { userId } = req.params;
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const user = await getOrCreateDemoUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const { db } = await import("./db");
      const { checkIns, credTransactions } = await import("@shared/schema");
      const { and, eq, gte } = await import("drizzle-orm");

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

      const [checks, creds] = await Promise.all([
        db.select({ createdAt: checkIns.createdAt }).from(checkIns)
          .where(and(eq(checkIns.userId, user.id), gte(checkIns.createdAt, sevenAgo))),
        db.select({ createdAt: credTransactions.createdAt }).from(credTransactions)
          .where(and(eq(credTransactions.userId, user.id), gte(credTransactions.createdAt, sevenAgo))),
      ]);

      const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const activeKeys = new Set<string>();
      for (const r of checks) if (r.createdAt) activeKeys.add(dayKey(new Date(r.createdAt)));
      for (const r of creds)  if (r.createdAt) activeKeys.add(dayKey(new Date(r.createdAt)));

      const days: { date: string; active: boolean; isToday: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const key = dayKey(d);
        days.push({ date: key, active: activeKeys.has(key), isToday: key === dayKey(today) });
      }

      res.json({ days });
    } catch (error) {
      console.error("Nexus strip error:", error);
      res.status(500).json({ error: "Failed to load nexus strip" });
    }
  });

  // Get available badges (for badge gallery)
  app.get("/api/badges", readRateLimiter, async (req, res) => {
    try {
      const { userId } = req.query;
      const allBadges = await db.select().from(badges);
      
      let earnedBadgeIds: Set<string> = new Set();
      if (userId) {
        const user = await getOrCreateDemoUser(userId as string);
        if (user) {
          const earned = await db.select()
            .from(userBadges)
            .where(eq(userBadges.userId, user.id));
          earnedBadgeIds = new Set(earned.map(ub => ub.badgeId));
        }
      }
      
      res.json(allBadges.map(badge => ({
        ...badge,
        earned: earnedBadgeIds.has(badge.id),
        isLocked: badge.isSecret && !earnedBadgeIds.has(badge.id),
      })));
    } catch (error) {
      console.error("Get badges error:", error);
      res.status(500).json({ error: "Failed to get badges" });
    }
  });

  // ============================================
  // CHAT ENDPOINTS (Siani Conversation)
  // ============================================

  // Main chat endpoint - talk to Siani
  app.post("/api/chat", verifyToken, chatRateLimiter, async (req, res) => {
    try {
      const parseResult = chatBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.flatten(),
        });
      }
      const { message, conversationId } = parseResult.data;

      // Always act as the authenticated user — never trust a client-supplied userId
      const user = await getOrCreateDemoUser(req.authUser!.id);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }

      // Verify conversation ownership before loading history into the turn
      if (conversationId) {
        const conv = await storage.getConversation(conversationId);
        if (!conv) {
          return res.status(404).json({ error: "Conversation not found" });
        }
        if (conv.userId !== user.id) {
          return res.status(403).json({ error: "Forbidden: you do not own this conversation" });
        }
      }

      const turn = await runSianiTurn({
        user,
        message,
        conversationId,
        modality: "text",
      });

      res.json({
        response: turn.sianiResponse.message,
        conversationId: turn.effectiveConversationId,
        messageId: turn.assistantMessageId,
        goalsCreated: turn.goalsCreated,
        matchedResources: turn.matchedResources,
        detectedNeeds: turn.detectedNeeds,
        shouldOfferResources: turn.shouldOfferResources,
        shouldEscalate: turn.shouldEscalate,
        referralCreated: turn.referralCreated || undefined,
      });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({
        error: "Something went wrong",
        response:
          "I'm here. Sometimes the connection gets shaky, but I'm not going anywhere. What were you saying?",
      });
    }
  });

  // Get conversation history (own only; admin/chw bypass)
  app.get(
    "/api/conversations/:id/messages",
    verifyToken,
    requireOwnership(async (req) => storage.getConversation(req.params.id) ?? null),
    async (req, res) => {
      try {
        const { id } = req.params;
        const messages = await storage.getMessagesByConversation(id);
        res.json(messages.reverse()); // Return in chronological order
      } catch (error) {
        console.error("Get messages error:", error);
        res.status(500).json({ error: "Failed to get messages" });
      }
    },
  );

  // Get user's conversations (scoped to caller)
  app.get("/api/conversations", verifyToken, scopeToAuthUser(), async (req, res) => {
    try {
      const userId = (req.query.userId as string) || req.authUser!.id;
      const conversations = await storage.getConversationsByUser(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  // ============================================
  // GOALS (The Bag) ENDPOINTS
  // ============================================

  // Get user's goals (scoped to caller)
  app.get("/api/goals", verifyToken, scopeToAuthUser(), async (req, res) => {
    try {
      const userId = (req.query.userId as string) || req.authUser!.id;
      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const goals = await storage.getGoalsByUser(user.id);
      res.json(goals);
    } catch (error) {
      console.error("Get goals error:", error);
      res.status(500).json({ error: "Failed to get goals" });
    }
  });

  // Create a goal — server forces userId to authenticated caller
  app.post("/api/goals", verifyToken, scopeToAuthUser(), async (req, res) => {
    try {
      const userId = req.body.userId || req.authUser!.id;
      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const parseResult = insertGoalSchema.safeParse({
        ...req.body,
        userId: user.id,
      });
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid goal data", 
          details: parseResult.error.flatten() 
        });
      }
      const goal = await storage.createGoal(parseResult.data);

      // Publish goal creation event
      eventBus.publish(EventTypes.GOAL_CREATED, {
        type: EventTypes.GOAL_CREATED,
        userId: user.id,
        data: {
          goalId: goal.id,
          title: goal.title,
          category: goal.category,
        }
      }).catch(() => {});

      res.status(201).json(goal);
    } catch (error) {
      console.error("Create goal error:", error);
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  // Update a goal (own only; admin/chw bypass)
  const goalPatchSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    category: z.string().max(64).optional(),
    isCompleted: z.boolean().optional(),
    xpReward: z.number().int().min(0).max(1000).optional(),
  });
  app.patch(
    "/api/goals/:id",
    verifyToken,
    requireOwnership(async (req) => storage.getGoalById(req.params.id) ?? null),
    async (req, res) => {
    try {
      const { id } = req.params;
      const parseResult = goalPatchSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid goal update", details: parseResult.error.flatten() });
      }
      const updates = parseResult.data;
      
      // Get the goal first to check if it's being completed
      const existingGoal = await storage.getGoalById(id);
      if (!existingGoal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      
      // Update the goal
      const goal = await storage.updateGoal(id, {
        ...updates,
        completedAt: updates.isCompleted ? new Date() : null,
      });
      
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      
      // Award XP if goal is being completed for the first time
      if (updates.isCompleted && !existingGoal.isCompleted) {
        const xpReward = goal.xpReward || 25;
        await storage.addXpToUser(goal.userId, xpReward);

        // Publish goal completion event
        eventBus.publish(EventTypes.GOAL_COMPLETED, {
          type: EventTypes.GOAL_COMPLETED,
          userId: goal.userId,
          data: {
            goalId: goal.id,
            title: goal.title,
            xpEarned: xpReward,
          }
        }).catch(() => {});
      }
      
      res.json(goal);
    } catch (error) {
      console.error("Update goal error:", error);
      res.status(500).json({ error: "Failed to update goal" });
    }
  });

  // Delete a goal (own only; admin/chw bypass)
  app.delete(
    "/api/goals/:id",
    verifyToken,
    requireOwnership(async (req) => storage.getGoalById(req.params.id) ?? null),
    async (req, res) => {
      try {
        const { id } = req.params;
        await storage.deleteGoal(id);
        res.status(204).send();
      } catch (error) {
        console.error("Delete goal error:", error);
        res.status(500).json({ error: "Failed to delete goal" });
      }
    },
  );

  // ============================================
  // RESOURCES & REFERRALS ENDPOINTS
  // ============================================

  // Get all resources
  app.get("/api/resources", readRateLimiter, async (req, res) => {
    try {
      const category = req.query.category as string;
      const query = req.query.q as string;
      
      let resources;
      if (query) {
        resources = await storage.searchResources(query);
      } else if (category) {
        resources = await storage.getResourcesByCategory(category);
      } else {
        resources = await storage.getAllResources();
      }
      res.json(resources);
    } catch (error) {
      console.error("Get resources error:", error);
      res.status(500).json({ error: "Failed to get resources" });
    }
  });

  // Get a specific resource
  app.get("/api/resources/:id", readRateLimiter, async (req, res) => {
    try {
      const { id } = req.params;
      const resource = await storage.getResource(id);
      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }
      res.json(resource);
    } catch (error) {
      console.error("Get resource error:", error);
      res.status(500).json({ error: "Failed to get resource" });
    }
  });

  // Create a resource (for admin/testing)
  app.post("/api/resources", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { name, description, category, eligibility, contact, serviceArea, isVerified } = req.body;
      
      if (!name || !category) {
        return res.status(400).json({ error: "Name and category are required" });
      }

      const resource = await storage.createResource({
        name,
        description,
        category,
        eligibility,
        contact,
        serviceArea,
        isVerified: isVerified ?? false,
      });
      
      res.status(201).json(resource);
    } catch (error) {
      console.error("Create resource error:", error);
      res.status(500).json({ error: "Failed to create resource" });
    }
  });

  // ============================================
  // EXTERNAL RESOURCE API ENDPOINTS (211 / FindHelp)
  // ============================================

  // Search external APIs (211, FindHelp) for resources
  app.get("/api/resources/external/search", readRateLimiter, async (req, res) => {
    try {
      const zipCode = req.query.zipCode as string;
      const category = req.query.category as string;
      const radius = parseInt(req.query.radius as string) || 25;

      if (!zipCode) {
        return res.status(400).json({ error: "zipCode is required" });
      }

      const { searchExternalResources, getAPIStatus } = await import('./services/resource-apis');
      
      const status = getAPIStatus();
      if (!status.anyConfigured) {
        return res.json({
          message: "No external APIs configured. Add API_211_KEY or FINDHELP_API_KEY to enable.",
          resources: [],
          apiStatus: status,
        });
      }

      const resources = await searchExternalResources(zipCode, category, radius);
      res.json({
        count: resources.length,
        resources,
        apiStatus: status,
      });
    } catch (error) {
      console.error("External resource search error:", error);
      res.status(500).json({ error: "Failed to search external resources" });
    }
  });

  // Sync resources from external APIs to local database
  app.post("/api/resources/external/sync", apiRateLimiter, async (req, res) => {
    try {
      const { zipCode, category, radius = 25 } = req.body;

      if (!zipCode) {
        return res.status(400).json({ error: "zipCode is required" });
      }

      const { searchExternalResources, getAPIStatus } = await import('./services/resource-apis');
      
      const status = getAPIStatus();
      if (!status.anyConfigured) {
        return res.status(400).json({
          error: "No external APIs configured",
          apiStatus: status,
        });
      }

      const externalResources = await searchExternalResources(zipCode, category, radius);
      
      let created = 0;
      let skipped = 0;
      
      for (const resource of externalResources) {
        // Check if resource already exists by name
        const existing = await storage.searchResources(resource.name);
        if (existing.some(r => r.name.toLowerCase() === resource.name.toLowerCase())) {
          skipped++;
          continue;
        }
        
        await storage.createResource(resource);
        created++;
      }

      res.json({
        message: `Synced ${created} new resources, skipped ${skipped} duplicates`,
        created,
        skipped,
        total: externalResources.length,
      });
    } catch (error) {
      console.error("Resource sync error:", error);
      res.status(500).json({ error: "Failed to sync resources" });
    }
  });

  // Get external API configuration status
  app.get("/api/resources/external/status", readRateLimiter, async (req, res) => {
    try {
      const { getAPIStatus } = await import('./services/resource-apis');
      const status = getAPIStatus();
      
      res.json({
        ...status,
        message: status.anyConfigured 
          ? "External APIs are configured and ready"
          : "No external APIs configured. Set API_211_KEY for 211 or FINDHELP_API_KEY + FINDHELP_BASE_URL for FindHelp.",
      });
    } catch (error) {
      console.error("Get API status error:", error);
      res.status(500).json({ error: "Failed to get API status" });
    }
  });

  // Get user's referrals (own only; admin/chw bypass)
  app.get("/api/referrals", verifyToken, scopeToAuthUser(), readRateLimiter, async (req, res) => {
    try {
      const userId = (req.query.userId as string) || req.authUser!.id;
      const activeOnly = req.query.active === "true";
      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const referrals = activeOnly 
        ? await storage.getActiveReferralsForUser(user.id)
        : await storage.getReferralsForUser(user.id);
      res.json(referrals);
    } catch (error) {
      console.error("Get referrals error:", error);
      res.status(500).json({ error: "Failed to get referrals" });
    }
  });

  // Get a specific referral (own only; admin/chw bypass)
  app.get(
    "/api/referrals/:id",
    verifyToken,
    requireOwnership(async (req) => (await storage.getReferral(req.params.id)) ?? null),
    readRateLimiter,
    async (req, res) => {
      try {
        const { id } = req.params;
        const referral = await storage.getReferral(id);
        if (!referral) {
          return res.status(404).json({ error: "Referral not found" });
        }
        res.json(referral);
      } catch (error) {
        console.error("Get referral error:", error);
        res.status(500).json({ error: "Failed to get referral" });
      }
    },
  );

  // Create a referral (Siani or care team initiated)
  const referralCreateSchema = z.object({
    resourceId: z.string().min(1),
    source: z.enum(["siani", "self", "care_team", "system"]).optional(),
    linkedGoalId: z.string().optional(),
    linkedSignalId: z.string().optional(),
    state: z.enum(["proposed", "offered", "accepted", "scheduled", "in_progress", "completed", "could_not_complete", "declined"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    dueDate: z.string().datetime().optional(),
    notes: z.string().max(4000).optional(),
  });
  app.post("/api/referrals", verifyToken, scopeToAuthUser(), apiRateLimiter, async (req, res) => {
    try {
      const userId = req.body.userId || req.authUser!.id;
      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const parseResult = referralCreateSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid referral payload", details: parseResult.error.flatten() });
      }
      const body = parseResult.data;

      // Validate resource exists
      const resource = await storage.getResource(body.resourceId);
      if (!resource) {
        return res.status(400).json({ error: "Invalid resource ID" });
      }

      const referral = await storage.createReferral({
        userId: user.id,
        resourceId: body.resourceId,
        source: body.source || "siani",
        linkedGoalId: body.linkedGoalId,
        linkedSignalId: body.linkedSignalId,
        state: body.state || "proposed",
        priority: body.priority || "normal",
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        notes: body.notes,
      });

      // Publish referral event
      eventBus.publish(EventTypes.REFERRAL_UPDATE, {
        type: EventTypes.REFERRAL_UPDATE,
        userId: user.id,
        data: {
          referralId: referral.id,
          resourceId: resource.id,
          resourceName: resource.name,
          state: referral.state,
          action: "created",
        }
      }).catch(() => {});

      res.status(201).json({ ...referral, resource });
    } catch (error) {
      console.error("Create referral error:", error);
      res.status(500).json({ error: "Failed to create referral" });
    }
  });

  // Update referral state (follow the loop with valid transitions)
  const referralPatchSchema = z.object({
    state: z.enum(["proposed", "offered", "accepted", "scheduled", "in_progress", "completed", "could_not_complete", "declined"]),
    notes: z.string().max(4000).optional(),
  });
  app.patch(
    "/api/referrals/:id",
    verifyToken,
    requireOwnership(async (req) => (await storage.getReferral(req.params.id)) ?? null),
    apiRateLimiter,
    async (req, res) => {
    try {
      const { id } = req.params;
      const parseResult = referralPatchSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid referral update", details: parseResult.error.flatten() });
      }
      const { state, notes } = parseResult.data;

      // Valid state transition map: currentState -> allowedNextStates
      const stateTransitions: Record<string, string[]> = {
        proposed: ["offered", "declined"],
        offered: ["accepted", "declined"],
        accepted: ["scheduled", "in_progress", "declined", "could_not_complete"],
        scheduled: ["in_progress", "could_not_complete", "declined"],
        in_progress: ["completed", "could_not_complete"],
        completed: [], // Terminal state
        could_not_complete: ["proposed"], // Can retry
        declined: [] // Terminal state
      };

      // Get current referral to validate transition
      const currentReferral = await storage.getReferral(id);
      if (!currentReferral) {
        return res.status(404).json({ error: "Referral not found" });
      }

      const currentState = currentReferral.state || "proposed";
      const allowedTransitions = stateTransitions[currentState] || [];

      // Validate transition is allowed
      if (!allowedTransitions.includes(state) && currentState !== state) {
        return res.status(400).json({ 
          error: "Invalid state transition",
          currentState,
          requestedState: state,
          allowedTransitions
        });
      }

      const referral = await storage.updateReferralState(id, state, notes);
      if (!referral) {
        return res.status(404).json({ error: "Referral not found" });
      }

      // Award XP if referral is completed
      if (state === "completed" && currentState !== "completed") {
        const xpReward = 50; // Fixed XP for completing referrals
        await storage.addXpToUser(referral.userId, xpReward);
      }

      // Publish referral update event
      eventBus.publish(EventTypes.REFERRAL_UPDATE, {
        type: EventTypes.REFERRAL_UPDATE,
        userId: referral.userId,
        data: {
          referralId: referral.id,
          resourceId: referral.resourceId,
          state: referral.state,
          previousState: currentState,
          action: "updated",
          xpAwarded: state === "completed" ? 50 : 0
        }
      }).catch(() => {});

      // Get full referral with resource
      const fullReferral = await storage.getReferral(id);
      res.json(fullReferral);
    } catch (error) {
      console.error("Update referral error:", error);
      res.status(500).json({ error: "Failed to update referral" });
    }
  },
  );

  // Match resources to detected needs (for Siani integration)
  // Now powered by HSDS Resource Index with multi-tier data sources
  app.post("/api/resources/match", apiRateLimiter, async (req, res) => {
    try {
      const { category, keywords, userId, zipCode, message } = req.body;
      
      // Use smart matching if we have user context
      if (userId || message || zipCode) {
        const result = await smartMatcher.match({
          userId: userId || "anonymous",
          message,
          zipCode,
          detectedNeed: category ? {
            category,
            confidence: 80,
            urgency: 'medium',
            triggerPhrases: keywords || [],
          } : undefined,
          limit: 5,
        });
        
        return res.json({
          category: category || result.detectedNeeds[0]?.category,
          count: result.resources.length,
          resources: result.resources,
          matchMethod: result.matchMethod,
          isCrisis: result.isCrisis,
          detectedNeeds: result.detectedNeeds,
        });
      }
      
      // Fallback to simple category match
      if (!category) {
        return res.status(400).json({ error: "Category is required" });
      }

      const categoryResources = await storage.getResourcesByCategory(category);
      
      let matchedResources = categoryResources;
      if (keywords && Array.isArray(keywords) && keywords.length > 0) {
        matchedResources = categoryResources.filter(r => {
          const searchText = `${r.name} ${r.description || ""}`.toLowerCase();
          return keywords.some((kw: string) => searchText.includes(kw.toLowerCase()));
        });
        if (matchedResources.length === 0) {
          matchedResources = categoryResources;
        }
      }

      res.json({
        category,
        count: matchedResources.length,
        resources: matchedResources.slice(0, 5),
        matchMethod: 'database_fallback',
      });
    } catch (error) {
      console.error("Match resources error:", error);
      res.status(500).json({ error: "Failed to match resources" });
    }
  });

  // Smart resource matching - primary endpoint for Siani
  // Uses HSDS index with geo-indexing, crisis routing, and adaptive scoring
  app.post("/api/resources/smart-match", apiRateLimiter, async (req, res) => {
    try {
      const { 
        userId, 
        message, 
        zipCode, 
        city, 
        state, 
        category, 
        urgency,
        limit = 5,
        includeCrisisResources = false,
      } = req.body;
      
      if (!userId && !message) {
        return res.status(400).json({ 
          error: "Either userId or message is required" 
        });
      }

      const result = await smartMatcher.match({
        userId: userId || "anonymous",
        message,
        zipCode,
        city,
        state,
        detectedNeed: category ? {
          category,
          confidence: 80,
          urgency: urgency || 'medium',
          triggerPhrases: [],
        } : undefined,
        limit,
        includeCrisisResources,
      });

      res.json({
        success: true,
        ...result,
        indexStats: smartMatcher.getStats(),
      });
    } catch (error) {
      console.error("Smart match error:", error);
      res.status(500).json({ error: "Failed to match resources" });
    }
  });

  // Get HSDS index statistics
  app.get("/api/resources/index/stats", readRateLimiter, async (_req, res) => {
    try {
      const stats = smartMatcher.getStats();
      res.json({
        success: true,
        ...stats,
      });
    } catch (error) {
      console.error("Index stats error:", error);
      res.status(500).json({ error: "Failed to get index stats" });
    }
  });

  // ============================================
  // ORGANIZATION ACCOUNTABILITY ENDPOINTS
  // ============================================

  // Record referral outcome with organization tracking
  app.post("/api/referrals/:id/outcome", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { id } = req.params;
      const {
        result,
        orgResponded,
        orgResponseDays,
        orgCompletionDays,
        barrierType,
        barrierDetails,
        userRating,
        userFeedback,
        wouldRecommend,
        notes,
        followUpNeeded
      } = req.body;

      if (!result) {
        return res.status(400).json({ error: "Result is required" });
      }

      // Get the referral to find the resource
      const referral = await storage.getReferral(id);
      if (!referral) {
        return res.status(404).json({ error: "Referral not found" });
      }

      // Create the outcome record
      const outcome = await storage.createReferralOutcome({
        referralId: id,
        resourceId: referral.resourceId,
        result,
        orgResponded: orgResponded ?? false,
        orgResponseDays,
        orgCompletionDays,
        barrierType,
        barrierDetails,
        userRating,
        userFeedback,
        wouldRecommend,
        notes,
        followUpNeeded: followUpNeeded ?? false,
      });

      // Update organization metrics based on outcome
      await storage.updateResourceMetricsFromOutcome(referral.resourceId, outcome);
      
      // Feed back into HSDS index for adaptive scoring
      const hsdsOutcome = result === 'success' ? 'successful' :
                          result === 'partial' ? 'partial' :
                          result === 'no_contact' ? 'no_response' : 'failed';
      smartMatcher.recordOutcome(referral.resourceId, hsdsOutcome);

      // Update referral state if appropriate
      const stateFromResult: Record<string, string> = {
        success: "completed",
        partial: "completed",
        org_failed: "could_not_complete",
        no_contact: "could_not_complete",
        user_declined: "declined",
      };
      const newState = stateFromResult[result];
      if (newState) {
        await storage.updateReferralState(id, newState, notes);
        
        // Award XP for completed referrals
        if (newState === "completed") {
          await storage.addXpToUser(referral.userId, 50);
        }
      }

      res.status(201).json(outcome);
    } catch (error) {
      console.error("Record outcome error:", error);
      res.status(500).json({ error: "Failed to record outcome" });
    }
  });

  // Report an issue with an organization
  app.post("/api/organizations/:resourceId/issues", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { resourceId } = req.params;
      const userId = req.body.userId || "demo-user";
      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const resource = await storage.getResource(resourceId);
      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      const {
        issueType,
        severity,
        title,
        description,
        referralId
      } = req.body;

      if (!issueType || !title || !description) {
        return res.status(400).json({ 
          error: "issueType, title, and description are required" 
        });
      }

      const issue = await storage.createOrganizationIssue({
        resourceId,
        reportedByUserId: user.id,
        referralId,
        issueType,
        severity: severity || "medium",
        title,
        description,
      });

      // Update resource metrics based on the issue
      await storage.updateResourceMetricsFromIssue(resourceId, issue);

      res.status(201).json(issue);
    } catch (error) {
      console.error("Report issue error:", error);
      res.status(500).json({ error: "Failed to report issue" });
    }
  });

  // Get issues for an organization
  app.get("/api/organizations/:resourceId/issues", readRateLimiter, async (req, res) => {
    try {
      const { resourceId } = req.params;
      const status = req.query.status as string;
      const issues = await storage.getOrganizationIssues(resourceId, status);
      res.json(issues);
    } catch (error) {
      console.error("Get issues error:", error);
      res.status(500).json({ error: "Failed to get issues" });
    }
  });

  // Get organization performance metrics
  app.get("/api/organizations/:resourceId/metrics", readRateLimiter, async (req, res) => {
    try {
      const { resourceId } = req.params;
      const resource = await storage.getResource(resourceId);
      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      const outcomes = await storage.getResourceOutcomes(resourceId);
      const issues = await storage.getOrganizationIssues(resourceId);
      const openIssues = issues.filter(i => i.status === "open" || i.status === "investigating");

      // Calculate trends
      const recentWindow = new Date();
      recentWindow.setDate(recentWindow.getDate() - 90);
      const recentOutcomes = outcomes.filter(o => new Date(o.createdAt) >= recentWindow);
      
      const recentSuccesses = recentOutcomes.filter(o => 
        o.result === "success" || o.result === "partial"
      ).length;
      const recentFailures = recentOutcomes.filter(o => 
        o.result === "org_failed" || o.result === "no_contact"
      ).length;

      res.json({
        resource: {
          id: resource.id,
          name: resource.name,
          category: resource.category,
          isVerified: resource.isVerified,
          isFlagged: resource.isFlagged,
          flagReason: resource.flagReason,
        },
        metrics: {
          totalReferrals: resource.totalReferrals || 0,
          successfulReferrals: resource.successfulReferrals || 0,
          failedReferrals: resource.failedReferrals || 0,
          successRate: resource.successRate || 0,
          reliabilityScore: resource.reliabilityScore || 100,
          redTapeScore: resource.redTapeScore || 0,
          avgResponseDays: resource.avgResponseDays,
          avgCompletionDays: resource.avgCompletionDays,
          issueCount: resource.issueCount || 0,
        },
        recent: {
          successes: recentSuccesses,
          failures: recentFailures,
          openIssues: openIssues.length,
        },
        issues: openIssues,
      });
    } catch (error) {
      console.error("Get metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // Flag/unflag an organization for review
  app.patch("/api/organizations/:resourceId/flag", verifyToken, requireRole("admin", "chw"), apiRateLimiter, async (req, res) => {
    try {
      const { resourceId } = req.params;
      const { isFlagged, flagReason } = req.body;

      const resource = await storage.updateResourceFlag(resourceId, isFlagged, flagReason);
      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      res.json(resource);
    } catch (error) {
      console.error("Flag resource error:", error);
      res.status(500).json({ error: "Failed to flag resource" });
    }
  });

  // Get resource engine configuration
  app.get("/api/resource-engine/config", readRateLimiter, async (_req, res) => {
    try {
      const { getEngineConfig } = await import("./engines/resource-engine");
      res.json(getEngineConfig());
    } catch (error) {
      console.error("Get config error:", error);
      res.status(500).json({ error: "Failed to get engine config" });
    }
  });

  // Update resource engine configuration (for iteration)
  app.patch("/api/resource-engine/config", verifyToken, requireRole("admin"), apiRateLimiter, async (req, res) => {
    try {
      const { updateEngineConfig } = await import("./engines/resource-engine");
      const newConfig = updateEngineConfig(req.body);
      res.json(newConfig);
    } catch (error) {
      console.error("Update config error:", error);
      res.status(500).json({ error: "Failed to update engine config" });
    }
  });

  // Get ranked resources with scoring (smart matching)
  app.post("/api/resource-engine/rank", apiRateLimiter, async (req, res) => {
    try {
      const { category } = req.body;
      if (!category) {
        return res.status(400).json({ error: "Category is required" });
      }

      const { calculateResourceScore } = await import("./engines/resource-engine");
      const resources = await storage.getResourcesByCategory(category);
      
      const resourceIds = resources.map(r => r.id);
      const [outcomesMap, issuesMap] = await Promise.all([
        storage.getResourceOutcomesBatch(resourceIds),
        storage.getOrganizationIssuesBatch(resourceIds),
      ]);

      const rankedResources = resources.map((resource) => {
        const outcomes = outcomesMap.get(resource.id) || [];
        const issues = issuesMap.get(resource.id) || [];
        return calculateResourceScore(resource, outcomes, issues);
      });

      // Sort by match score
      rankedResources.sort((a, b) => b.matchScore - a.matchScore);

      res.json({
        category,
        count: rankedResources.length,
        resources: rankedResources,
      });
    } catch (error) {
      console.error("Rank resources error:", error);
      res.status(500).json({ error: "Failed to rank resources" });
    }
  });

  // ============================================
  // REFERRAL NOTES & VERIFICATION ENDPOINTS
  // ============================================

  // Get notes for a referral
  app.get("/api/referrals/:id/notes", readRateLimiter, async (req, res) => {
    try {
      const { id } = req.params;
      const notes = await storage.getReferralNotes(id);
      res.json(notes);
    } catch (error) {
      console.error("Get notes error:", error);
      res.status(500).json({ error: "Failed to get notes" });
    }
  });

  // Create a note (org contact or user)
  app.post("/api/referrals/:id/notes", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { id } = req.params;
      const {
        authorType,
        authorId,
        authorName,
        authorRole,
        noteType,
        title,
        content,
        proposedState,
        isVisibleToUser,
        isVisibleToOrg,
      } = req.body;

      if (!authorType || !noteType || !title || !content) {
        return res.status(400).json({ 
          error: "authorType, noteType, title, and content are required" 
        });
      }

      // Get referral to find resourceId
      const referral = await storage.getReferral(id);
      if (!referral) {
        return res.status(404).json({ error: "Referral not found" });
      }

      const note = await storage.createReferralNote({
        referralId: id,
        resourceId: referral.resourceId,
        authorType,
        authorId,
        authorName,
        authorRole,
        noteType,
        title,
        content,
        proposedState,
        isVisibleToUser: isVisibleToUser ?? true,
        isVisibleToOrg: isVisibleToOrg ?? true,
      });

      res.status(201).json(note);
    } catch (error) {
      console.error("Create note error:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  // Get pending verifications for a user
  app.get("/api/verifications/pending", readRateLimiter, async (req, res) => {
    try {
      const userId = (req.query.userId as string) || "demo-user";
      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const pending = await storage.getPendingVerifications(user.id);
      res.json(pending);
    } catch (error) {
      console.error("Get pending verifications error:", error);
      res.status(500).json({ error: "Failed to get pending verifications" });
    }
  });

  // Verify or reject a note
  app.patch("/api/notes/:noteId/verify", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { noteId } = req.params;
      const userId = req.body.userId || "demo-user";
      const { status, verificationNote, verifiedBySiani } = req.body;

      if (!status || !['verified', 'rejected'].includes(status)) {
        return res.status(400).json({ 
          error: "Status must be 'verified' or 'rejected'" 
        });
      }

      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updated = await storage.verifyReferralNote(
        noteId,
        status,
        verifiedBySiani ? undefined : user.id,
        verifiedBySiani ?? false,
        verificationNote
      );

      if (!updated) {
        return res.status(404).json({ error: "Note not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Verify note error:", error);
      res.status(500).json({ error: "Failed to verify note" });
    }
  });

  // Create org contact
  app.post("/api/organizations/:resourceId/contacts", verifyToken, requireRole("admin", "chw"), apiRateLimiter, async (req, res) => {
    try {
      const { resourceId } = req.params;
      const { name, email, phone, role, canUpdateReferrals, hasPortalAccess } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const resource = await storage.getResource(resourceId);
      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      const contact = await storage.createOrgContact({
        resourceId,
        name,
        email,
        phone,
        role,
        canUpdateReferrals: canUpdateReferrals ?? true,
        hasPortalAccess: hasPortalAccess ?? false,
      });

      res.status(201).json(contact);
    } catch (error) {
      console.error("Create org contact error:", error);
      res.status(500).json({ error: "Failed to create org contact" });
    }
  });

  // Get org contacts for a resource
  app.get("/api/organizations/:resourceId/contacts", readRateLimiter, async (req, res) => {
    try {
      const { resourceId } = req.params;
      const contacts = await storage.getOrgContactsForResource(resourceId);
      res.json(contacts);
    } catch (error) {
      console.error("Get org contacts error:", error);
      res.status(500).json({ error: "Failed to get org contacts" });
    }
  });

  // ============================================
  // MULTI-TIER VERIFICATION ENDPOINTS
  // For external resources without SAINTE connection
  // ============================================

  // Create a self-report verification (Siani-driven)
  app.post("/api/referrals/:referralId/verify/self-report", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { referralId } = req.params;
      const userId = req.body.userId || "demo-user";
      const { proposedState, responses } = req.body;

      if (!proposedState || !responses || !Array.isArray(responses)) {
        return res.status(400).json({ 
          error: "proposedState and responses array are required" 
        });
      }

      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Import verification engine
      const { createSianiVerification, getUserTrustScore } = await import('./engines/verification-engine');
      
      const userTrustScore = await getUserTrustScore(user.id);
      const result = await createSianiVerification(
        referralId,
        user.id,
        proposedState,
        responses,
        userTrustScore
      );

      res.status(201).json(result);
    } catch (error) {
      console.error("Self-report verification error:", error);
      res.status(500).json({ error: "Failed to create verification" });
    }
  });

  // Upload evidence (photo/document) for verification
  app.post("/api/referrals/:referralId/verify/evidence", apiRateLimiter, async (req, res) => {
    try {
      const { referralId } = req.params;
      const userId = req.body.userId || "demo-user";
      const { evidenceType, evidenceUrl, proposedState, description } = req.body;

      if (!evidenceType || !evidenceUrl) {
        return res.status(400).json({ 
          error: "evidenceType and evidenceUrl are required" 
        });
      }

      if (!['photo', 'document'].includes(evidenceType)) {
        return res.status(400).json({ 
          error: "evidenceType must be 'photo' or 'document'" 
        });
      }

      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { createEvidenceVerification } = await import('./engines/verification-engine');
      
      const verification = await createEvidenceVerification(
        referralId,
        user.id,
        evidenceType,
        evidenceUrl,
        proposedState,
        description
      );

      res.status(201).json(verification);
    } catch (error) {
      console.error("Evidence verification error:", error);
      res.status(500).json({ error: "Failed to create evidence verification" });
    }
  });

  // Get verification history and confidence for a referral
  app.get("/api/referrals/:referralId/verifications", readRateLimiter, async (req, res) => {
    try {
      const { referralId } = req.params;
      
      const { getReferralConfidence } = await import('./engines/verification-engine');
      const confidence = await getReferralConfidence(referralId);

      // Also get all verification records
      const verifications = await db.query.referralVerifications.findMany({
        where: eq(referralVerifications.referralId, referralId),
        orderBy: (v, { desc }) => [desc(v.createdAt)],
      });

      res.json({
        ...confidence,
        verifications
      });
    } catch (error) {
      console.error("Get verifications error:", error);
      res.status(500).json({ error: "Failed to get verifications" });
    }
  });

  // Get user's verification reliability/trust score
  app.get("/api/users/:userId/verification-trust", readRateLimiter, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const { getUserTrustScore } = await import('./engines/verification-engine');
      const trustScore = await getUserTrustScore(userId);

      res.json({ userId, trustScore });
    } catch (error) {
      console.error("Get trust score error:", error);
      res.status(500).json({ error: "Failed to get trust score" });
    }
  });

  // Get validation questions for a state (Siani uses these)
  app.get("/api/verification/questions/:proposedState", readRateLimiter, async (req, res) => {
    try {
      const { proposedState } = req.params;
      
      const { getValidationQuestions } = await import('./engines/verification-engine');
      const questions = getValidationQuestions(proposedState);

      res.json({ proposedState, questions });
    } catch (error) {
      console.error("Get validation questions error:", error);
      res.status(500).json({ error: "Failed to get questions" });
    }
  });

  // ============================================
  // MOVES ENDPOINTS
  // ============================================

  // Get user's moves
  app.get("/api/moves", verifyToken, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || undefined;
      // Always scope to the authenticated user — ignore any client-supplied userId
      const moves = await storage.getMovesByUser(req.authUser!.id, limit);
      res.json(moves);
    } catch (error) {
      console.error("Get moves error:", error);
      res.status(500).json({ error: "Failed to get moves" });
    }
  });

  // Get moves for a specific goal
  app.get("/api/goals/:goalId/moves", verifyToken, async (req, res) => {
    try {
      const { goalId } = req.params;
      // Verify the goal belongs to the authenticated user before returning its moves
      const goal = await storage.getGoalById(goalId);
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      if (goal.userId !== req.authUser!.id) {
        return res.status(403).json({ error: "Forbidden: you do not own this goal" });
      }
      const moves = await storage.getMovesByGoal(goalId);
      res.json(moves);
    } catch (error) {
      console.error("Get goal moves error:", error);
      res.status(500).json({ error: "Failed to get moves" });
    }
  });

  // Create a move
  app.post("/api/moves", verifyToken, async (req, res) => {
    try {
      // Always scope to the authenticated user — ignore any client-supplied userId
      const parseResult = insertMoveSchema.safeParse({
        ...req.body,
        userId: req.authUser!.id,
      });
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid move data", 
          details: parseResult.error.flatten() 
        });
      }
      
      const move = await storage.createMove(parseResult.data);
      res.status(201).json(move);
    } catch (error) {
      console.error("Create move error:", error);
      res.status(500).json({ error: "Failed to create move" });
    }
  });

  // Update a move
  app.patch(
    "/api/moves/:id",
    verifyToken,
    requireOwnership(async (req) => storage.getMoveById?.(req.params.id) ?? null),
    async (req, res) => {
      try {
        const { id } = req.params;
        const moveUpdateSchema = z.object({
          title: z.string().min(1).max(200).optional(),
          description: z.string().max(2000).optional(),
          isCompleted: z.boolean().optional(),
          xpReward: z.number().int().min(0).max(1000).optional(),
        }).strict();
        const parseResult = moveUpdateSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({ error: "Invalid move update", details: parseResult.error.flatten() });
        }
        const move = await storage.updateMove(id, parseResult.data);
        if (!move) {
          return res.status(404).json({ error: "Move not found" });
        }
        res.json(move);
      } catch (error) {
        console.error("Update move error:", error);
        res.status(500).json({ error: "Failed to update move" });
      }
    },
  );

  // Complete a move
  app.post(
    "/api/moves/:id/complete",
    verifyToken,
    requireOwnership(async (req) => storage.getMoveById?.(req.params.id) ?? null),
    async (req, res) => {
      try {
        const { id } = req.params;
        const move = await storage.completeMove(id);
        if (!move) {
          return res.status(404).json({ error: "Move not found" });
        }
        const xpReward = move.xpReward || 15;
        await storage.addXpToUser(move.userId, xpReward);
        res.json(move);
      } catch (error) {
        console.error("Complete move error:", error);
        res.status(500).json({ error: "Failed to complete move" });
      }
    },
  );

  // ============================================
  // ESCALATIONS ENDPOINTS (For care team/enterprise)
  // ============================================

  // Get open escalations (care team / admin only)
  app.get("/api/escalations", verifyToken, requireRole("admin", "chw"), async (req, res) => {
    try {
      const escalations = await storage.getOpenEscalations();
      res.json(escalations);
    } catch (error) {
      console.error("Get escalations error:", error);
      res.status(500).json({ error: "Failed to get escalations" });
    }
  });

  // Acknowledge an escalation (care team / admin only)
  app.post("/api/escalations/:id/acknowledge", verifyToken, requireRole("admin", "chw"), apiRateLimiter, async (req, res) => {
    try {
      const { id } = req.params;
      const escalation = await storage.updateEscalationState(id, "acknowledged");
      
      if (!escalation) {
        return res.status(404).json({ error: "Escalation not found" });
      }
      
      res.json(escalation);
    } catch (error) {
      console.error("Acknowledge escalation error:", error);
      res.status(500).json({ error: "Failed to acknowledge escalation" });
    }
  });

  // Resolve an escalation (care team / admin only)
  app.post("/api/escalations/:id/resolve", verifyToken, requireRole("admin", "chw"), apiRateLimiter, async (req, res) => {
    try {
      const { id } = req.params;
      const escalation = await storage.updateEscalationState(id, "resolved", new Date());
      
      if (!escalation) {
        return res.status(404).json({ error: "Escalation not found" });
      }
      
      res.json(escalation);
    } catch (error) {
      console.error("Resolve escalation error:", error);
      res.status(500).json({ error: "Failed to resolve escalation" });
    }
  });

  // ============================================
  // SIGNALS ENDPOINTS (For monitoring/enterprise)
  // ============================================

  // Get user's signals — own data, or any if care team / admin
  app.get("/api/signals", verifyToken, scopeToAuthUser(), async (req, res) => {
    try {
      const userId = (req.query.userId as string) || req.authUser!.id;
      const signals = await storage.getSignalsByUser(userId);
      res.json(signals);
    } catch (error) {
      console.error("Get signals error:", error);
      res.status(500).json({ error: "Failed to get signals" });
    }
  });

  // Get unresolved signals — own data, or any if care team / admin
  app.get("/api/signals/unresolved", verifyToken, scopeToAuthUser(), async (req, res) => {
    try {
      const userId = (req.query.userId as string) || req.authUser!.id;
      const signals = await storage.getUnresolvedSignalsByUser(userId);
      res.json(signals);
    } catch (error) {
      console.error("Get unresolved signals error:", error);
      res.status(500).json({ error: "Failed to get signals" });
    }
  });

  // Resolve a signal
  app.post("/api/signals/:id/resolve", verifyToken, async (req, res) => {
    try {
      const { id } = req.params;
      const signal = await storage.resolveSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }
      res.json(signal);
    } catch (error) {
      console.error("Resolve signal error:", error);
      res.status(500).json({ error: "Failed to resolve signal" });
    }
  });

  // ============================================
  // EMOTIONAL STATES ENDPOINTS
  // ============================================

  // Get user's emotional state history — own data, or any if care team / admin
  app.get("/api/emotional-states", verifyToken, scopeToAuthUser(), async (req, res) => {
    try {
      const userId = (req.query.userId as string) || req.authUser!.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const states = await storage.getEmotionalStatesByUser(userId, limit);
      res.json(states);
    } catch (error) {
      console.error("Get emotional states error:", error);
      res.status(500).json({ error: "Failed to get emotional states" });
    }
  });

  // ============================================
  // CARE TEAM ENDPOINTS
  // ============================================

  // Get care team contacts (threads with caregivers) for a user
  app.get("/api/care-team", verifyToken, scopeToAuthUser(), async (req, res) => {
    try {
      const userId = (req.query.userId as string) || req.authUser!.id;
      const user = await getOrCreateDemoUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const threads = await storage.getCareThreadsForUser(user.id);
      
      // Format response for frontend
      const contacts = threads.map(({ thread, caregiver, unreadCount, lastMessage }) => ({
        id: thread.id,
        caregiverName: caregiver.displayName || caregiver.username,
        caregiverRole: caregiver.userType === "chw" ? "Community Health Worker" : 
                       caregiver.userType === "admin" ? "Care Coordinator" : "Care Team Member",
        caregiverAvatar: caregiver.avatarUrl,
        lastMessage: lastMessage?.content || lastMessage?.transcript || "Voice memo",
        lastMessageTime: lastMessage?.createdAt || thread.createdAt,
        unreadCount,
        priority: thread.priority || "normal",
        status: thread.status,
        isVerified: caregiver.isVerified ?? true,
      }));

      res.json(contacts);
    } catch (error) {
      console.error("Get care team error:", error);
      res.status(500).json({ error: "Failed to get care team" });
    }
  });

  // Get messages for a specific care thread (only the thread's user or care team)
  app.get("/api/care-messages/:threadId", verifyToken, async (req, res) => {
    try {
      const { threadId } = req.params;
      const authUserId = req.authUser!.id;
      const authUserType = req.authUser!.userType;

      // Verify the thread exists and the caller is authorized to read it.
      // Members may only read their own thread; CHW/admin bypass for care-team access.
      const thread = await storage.getCareThread(threadId);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      const isPrivileged = ["admin", "chw"].includes(authUserType);
      if (!isPrivileged && thread.memberUserId !== authUserId) {
        return res.status(403).json({ error: "Forbidden: you do not have access to this thread" });
      }

      const messages = await storage.getCareMessages(threadId);
      
      // Format for frontend — "user" side is always the thread's member
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        senderId: msg.senderId === thread.memberUserId ? "user" : "care",
        kind: msg.kind,
        content: msg.content,
        audioUrl: msg.audioUrl,
        duration: msg.duration || 0,
        transcript: msg.transcript,
        createdAt: msg.createdAt,
        isRead: msg.isRead,
      }));

      res.json(formattedMessages);
    } catch (error) {
      console.error("Get care messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Send a voice message to care team
  app.post("/api/care-messages", verifyToken, async (req, res) => {
    try {
      const parseResult = careMessageBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: parseResult.error.flatten() 
        });
      }
      const { threadId, duration, audioUrl, content } = parseResult.data;
      // Always use the authenticated user — ignore any client-supplied userId
      const senderId = req.authUser!.id;
      const authUserType = req.authUser!.userType;

      // Verify the thread exists and the caller is authorized to post into it.
      // Members may only post to their own thread; CHW/admin bypass for care-team replies.
      const thread = await storage.getCareThread(threadId);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      const isPrivileged = ["admin", "chw"].includes(authUserType);
      if (!isPrivileged && thread.memberUserId !== senderId) {
        return res.status(403).json({ error: "Forbidden: you do not have access to this thread" });
      }

      const message = await storage.createCareMessage({
        threadId,
        senderId,
        kind: "voice",
        content: content || "Voice memo",
        audioUrl: audioUrl || null,
        duration: duration || 0,
        transcript: null,
        emotion: null,
        isRead: false,
      });

      res.status(201).json({
        id: message.id,
        senderId: "user",
        kind: message.kind,
        content: message.content,
        audioUrl: message.audioUrl,
        duration: message.duration,
        createdAt: message.createdAt,
        isRead: message.isRead,
      });
    } catch (error) {
      console.error("Send care message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // ============================================
  // REFERRALS ENDPOINTS
  // ============================================

  // (Removed: duplicate /api/referrals listing — the hardened handler earlier in
  // this file now serves all referral reads with auth + ownership scoping.)

  // ============================================
  // THE FLOW - Three Lane Exclusive Feed
  // ============================================

  // DEV: Seed drops data (development only)
  app.post("/api/dev/seed-flow", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Not available in production" });
    }
    try {
      const { drops: dropsData, feedSignals: signalsData } = req.body;
      
      // Insert drops
      if (dropsData?.length) {
        for (const drop of dropsData) {
          const parsedDrop = {
            ...drop,
            accessWindowStart: drop.accessWindowStart ? new Date(drop.accessWindowStart) : null,
            accessWindowEnd: drop.accessWindowEnd ? new Date(drop.accessWindowEnd) : null,
          };
          await db.insert(drops).values(parsedDrop).onConflictDoNothing();
        }
      }
      
      // Insert signals
      if (signalsData?.length) {
        for (const signal of signalsData) {
          await db.insert(feedSignals).values(signal).onConflictDoNothing();
        }
      }
      
      res.json({ success: true, dropsAdded: dropsData?.length || 0, signalsAdded: signalsData?.length || 0 });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "Seed failed", details: String(error) });
    }
  });

  // LANE 1: Drops & Access - Time-gated invites with scarcity
  app.get("/api/flow/drops", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const drops = await storage.getActiveDrops(limit);
      res.json(drops);
    } catch (error) {
      console.error("Get drops error:", error);
      res.status(500).json({ error: "Failed to get drops" });
    }
  });

  // RSVP to a drop
  app.post("/api/flow/drops/:id/rsvp", verifyToken, async (req, res) => {
    try {
      const { id } = req.params;
      // Always use the authenticated user — ignore any client-supplied userId
      const result = await storage.rsvpToDrop(id, req.authUser!.id);
      
      if (result.success) {
        res.json({ 
          message: result.status === "waitlist" 
            ? "You're on the waitlist. We'll notify you if a spot opens." 
            : "You're in. Check your email for details.",
          status: result.status,
        });
      } else {
        res.status(400).json({ 
          error: result.status === "not_found" 
            ? "Drop not found" 
            : "Already RSVPed",
          status: result.status,
        });
      }
    } catch (error) {
      console.error("RSVP error:", error);
      res.status(500).json({ error: "Failed to RSVP" });
    }
  });

  // Get user's drop RSVPs (own only)
  app.get("/api/flow/drops/rsvps", verifyToken, scopeToAuthUser(), async (req, res) => {
    try {
      const userId = (req.query.userId as string) || req.authUser!.id;
      const user = await getOrCreateDemoUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const rsvps = await storage.getUserDropRsvps(user.id);
      res.json(rsvps);
    } catch (error) {
      console.error("Get RSVPs error:", error);
      res.status(500).json({ error: "Failed to get RSVPs" });
    }
  });

  // LANE 2: Signals & Sightings - Cinematic reportage
  app.get("/api/flow/signals", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const signals = await storage.getRecentSignals(limit);
      res.json(signals);
    } catch (error) {
      console.error("Get signals error:", error);
      res.status(500).json({ error: "Failed to get signals" });
    }
  });

  // LANE 3: Circle Spotlights - Member achievements
  app.get("/api/flow/spotlights", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const spotlights = await storage.getSpotlights(limit);
      res.json(spotlights);
    } catch (error) {
      console.error("Get spotlights error:", error);
      res.status(500).json({ error: "Failed to get spotlights" });
    }
  });

  // Energy Reactions - Universal for all Flow content
  app.post("/api/flow/react", verifyToken, async (req, res) => {
    try {
      const parseResult = flowReactBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: parseResult.error.flatten() 
        });
      }
      const { contentType, contentId, reactionType, action } = parseResult.data;
      // Prefer the authenticated user; fall back to body userId / demo-user
      // so the route works for both real members and the demo seed.
      const candidateId = req.authUser?.id || parseResult.data.userId || "demo-user";
      let user = await storage.getUser(candidateId);
      if (!user) user = await getOrCreateDemoUser(candidateId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let success: boolean;
      if (action === "remove") {
        success = await storage.removeEnergyReaction(user.id, contentType, contentId, reactionType);
      } else {
        success = await storage.addEnergyReaction(user.id, contentType, contentId, reactionType);
      }

      res.json({ success, action: action || "add" });
    } catch (error) {
      console.error("React error:", error);
      res.status(500).json({ error: "Failed to process reaction" });
    }
  });

  // Get user's reactions for content (own only)
  app.get("/api/flow/reactions", verifyToken, scopeToAuthUser(), async (req, res) => {
    try {
      const userId = (req.query.userId as string) || req.authUser!.id;
      const contentType = req.query.contentType as string;
      const contentIds = (req.query.contentIds as string)?.split(",").filter(Boolean) || [];
      
      const user = await getOrCreateDemoUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!contentType || contentIds.length === 0) {
        return res.json([]);
      }

      const reactions = await storage.getUserReactions(user.id, contentType as any, contentIds);
      res.json(reactions);
    } catch (error) {
      console.error("Get reactions error:", error);
      res.status(500).json({ error: "Failed to get reactions" });
    }
  });

  // ============================================
  // VOICE API ENDPOINTS (Siani Voice-First)
  // ============================================

  // Voice health check endpoint
  app.get("/api/voice/health", async (req, res) => {
    const health = await voiceService.checkHealth();
    res.json(health);
  });

  // Transcribe audio using Whisper ASR
  app.post("/api/voice/transcribe", verifyToken, async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on("end", async () => {
        try {
          const audioBuffer = Buffer.concat(chunks);
          
          if (audioBuffer.length === 0) {
            return res.status(400).json({ error: "No audio data received" });
          }

          const contentType = req.headers["content-type"] || "audio/webm";
          const filename = contentType.includes("webm") ? "audio.webm" : 
                          contentType.includes("mp3") ? "audio.mp3" :
                          contentType.includes("wav") ? "audio.wav" : "audio.webm";

          const result = await whisperProvider.transcribe(audioBuffer, filename, contentType);
          
          res.json({
            text: result.text,
            language: result.language,
            duration: result.duration,
            prosody: result.prosody,
          });
        } catch (error) {
          console.error("Transcription processing error:", error);
          res.status(500).json({ error: "Failed to transcribe audio" });
        }
      });
    } catch (error) {
      console.error("Transcription endpoint error:", error);
      res.status(500).json({ error: "Failed to process audio" });
    }
  });

  // Synthesize speech using ElevenLabs (with OpenAI fallback)
  app.post("/api/voice/synthesize", verifyToken, async (req, res) => {
    try {
      const parseResult = synthesizeBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: parseResult.error.flatten() 
        });
      }
      const { text, emotionalContext } = parseResult.data;

      const result = await voiceService.synthesizeResponse(text, emotionalContext);

      if (!result) {
        return res.status(503).json({ error: "TTS service unavailable" });
      }

      res.set({
        "Content-Type": result.contentType,
        "Content-Length": result.audioBuffer.length.toString(),
      });
      res.send(result.audioBuffer);
    } catch (error) {
      console.error("TTS synthesis error:", error);
      res.status(500).json({ error: "Failed to synthesize speech" });
    }
  });

  // Voice chat — STT → runSianiTurn (same brain as /api/chat) → TTS
  // The middle step is the SHARED pipeline so voice gets identical engines,
  // memory, smartMatcher resources, referrals, signals, and goal extraction.
  app.post("/api/voice/chat", verifyToken, async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      // Always scope to the authenticated user — ignore any client-supplied userId
      const authenticatedUserId = req.authUser!.id;
      const conversationId = req.query.conversationId as string | undefined;

      // Bail out of expensive work (Whisper/GPT-5/ElevenLabs) if the client
      // disconnects mid-turn. `aborted` fires only on true client abort
      // (barge-in / nav-away); a normal `close` after the response was
      // fully written will not flip the flag because we also gate on
      // !res.writableEnded.
      let aborted = false;
      const markAborted = () => { if (!res.writableEnded) aborted = true; };
      req.on("aborted", markAborted);
      res.on("close", markAborted);
      const bail = () => {
        if (aborted && !res.writableEnded) {
          try { res.end(); } catch {}
          return true;
        }
        return false;
      };

      req.on("data", (chunk: Buffer) => chunks.push(chunk));

      req.on("end", async () => {
        try {
          const audioBuffer = Buffer.concat(chunks);
          if (audioBuffer.length === 0) {
            return res.status(400).json({ error: "No audio data received" });
          }
          if (bail()) return;

          const user = await getOrCreateDemoUser(authenticatedUserId);
          if (!user) {
            return res.status(400).json({ error: "User not found" });
          }

          // Verify conversation ownership before loading history into the turn
          if (conversationId) {
            const conv = await storage.getConversation(conversationId);
            if (!conv) {
              return res.status(404).json({ error: "Conversation not found" });
            }
            if (conv.userId !== user.id) {
              return res.status(403).json({ error: "Forbidden: you do not own this conversation" });
            }
          }

          // 1. STT (Whisper) — also extracts prosody so engines see how it was said
          const contentType = req.headers["content-type"] || "audio/webm";
          const filename = contentType.includes("webm")
            ? "audio.webm"
            : contentType.includes("mp4")
            ? "audio.mp4"
            : "audio.mp3";

          const stt = await voiceService.transcribeAudio(
            audioBuffer,
            filename,
            contentType
          );
          if (bail()) return;
          if (stt.error && !stt.transcript) {
            return res.status(400).json({ error: stt.error });
          }
          if (!stt.transcript.trim()) {
            return res.json({
              transcript: "",
              response: "I didn't catch that. Try again?",
              error: "No speech detected",
            });
          }

          // Voice transcription event (analytics / live UI listeners)
          eventBus
            .publish(EventTypes.VOICE_TRANSCRIPTION, {
              type: EventTypes.VOICE_TRANSCRIPTION,
              userId: user.id,
              data: {
                transcript: stt.transcript,
                conversationId,
              },
            })
            .catch(() => {});

          // 2. SHARED Siani brain — same engines, memory, smartMatcher,
          // referrals, signals, escalations, goal extraction as text chat.
          const turn = await runSianiTurn({
            user,
            message: stt.transcript,
            conversationId,
            prosody: stt.prosody,
            modality: "voice",
          });
          if (bail()) return;

          // 3. TTS — open a streaming response so the client gets the first
          // audible byte ASAP instead of waiting for full synthesis. Headers
          // (transcript, response text, conv id, etc) MUST be set before we
          // pipe a single byte or Express won't send them.
          const cleanedMessage = voiceService.sanitizeForSpeech(
            turn.spokenMessage ?? turn.sianiResponse.message
          );
          // SSML break tags are added speculatively for the ElevenLabs path;
          // openSynthesisStream silently strips them again if it falls back
          // to OpenAI. Keeps the cinematic pacing on the happy path without
          // making the fallback path read tag soup.
          const ttsText = voiceService.addSpeechProsody(
            cleanedMessage,
            "elevenlabs",
            turn.sianiResponse.attunementMode
          );
          const synth = await voiceService.openSynthesisStream({
            text: ttsText,
            emotionalContext: {
              mood:
                turn.sianiResponse.emotionalState?.dominantEmotion || "neutral",
              arousalLevel:
                turn.sianiResponse.emotionalState?.arousalLevel ?? 50,
              shouldBeGentle:
                (turn.sianiResponse.emotionalState?.arousalLevel ?? 50) < 40 ||
                turn.sianiResponse.attunementMode === "stabilize" ||
                turn.sianiResponse.attunementMode === "contain",
            },
          });

          if (synth) {
            res.set({
              "Content-Type": synth.contentType,
              "X-Transcript": encodeURIComponent(stt.transcript),
              "X-Response": encodeURIComponent(turn.sianiResponse.message),
              "X-Conversation-Id": turn.effectiveConversationId,
              "X-Message-Id": turn.assistantMessageId,
              "X-Should-Escalate": turn.shouldEscalate ? "1" : "0",
              "X-TTS-Provider": synth.provider,
              "Cache-Control": "no-store",
            });
            if (synth.provider === "elevenlabs") {
              // True pipe-through. No buffering, no Content-Length.
              const reader = synth.stream.getReader();
              const pump = async () => {
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value && !res.writableEnded) {
                      res.write(Buffer.from(value));
                    }
                  }
                } catch (streamErr) {
                  console.error("Voice TTS stream pump error:", streamErr);
                } finally {
                  try { reader.releaseLock(); } catch {}
                  if (!res.writableEnded) res.end();
                }
              };
              // Abort upstream stream when the client actually goes away.
              const cancelReader = () => { try { reader.cancel().catch(() => {}); } catch {} };
              req.on("aborted", cancelReader);
              res.on("close", cancelReader);
              await pump();
            } else {
              // OpenAI buffered fallback
              res.setHeader("Content-Length", synth.audioBuffer.length.toString());
              res.send(synth.audioBuffer);
            }
          } else {
            // Audio synthesis failed — still return the conversation result
            res.json({
              transcript: stt.transcript,
              response: turn.sianiResponse.message,
              conversationId: turn.effectiveConversationId,
              messageId: turn.assistantMessageId,
              matchedResources: turn.matchedResources,
              detectedNeeds: turn.detectedNeeds,
              shouldEscalate: turn.shouldEscalate,
              referralCreated: turn.referralCreated || undefined,
              error: "Audio synthesis unavailable",
            });
          }
        } catch (error) {
          console.error("Voice chat processing error:", error);
          res.status(500).json({ error: "Failed to process voice chat" });
        }
      });
    } catch (error) {
      console.error("Voice chat endpoint error:", error);
      res.status(500).json({ error: "Failed to process voice" });
    }
  });

  // Text chat with voice response
  app.post("/api/voice/text-to-speech", verifyToken, async (req, res) => {
    try {
      const parseResult = textToSpeechBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: parseResult.error.flatten() 
        });
      }
      const { message, conversationId } = parseResult.data;

      // Always act as the authenticated user — never trust a client-supplied userId
      const user = await getOrCreateDemoUser(req.authUser!.id);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }

      // Verify conversation ownership before loading history
      if (conversationId) {
        const conv = await storage.getConversation(conversationId);
        if (!conv) {
          return res.status(404).json({ error: "Conversation not found" });
        }
        if (conv.userId !== user.id) {
          return res.status(403).json({ error: "Forbidden: you do not own this conversation" });
        }
      }

      let effectiveConversationId = conversationId;
      if (!effectiveConversationId) {
        const conversation = await storage.createConversation({
          userId: user.id,
          title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
        });
        effectiveConversationId = conversation.id;
      }

      // Get conversation history
      const messageHistory = await storage.getMessagesByConversation(effectiveConversationId, 10);
      const conversationHistory = messageHistory.reverse().map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Get user context
      const goals = await storage.getGoalsByUser(user.id);
      const userContext = {
        recentBagItems: goals.slice(0, 3).map((g) => g.title),
      };

      // Generate Siani's response
      const sianiResponse = await generateSianiResponse(
        message,
        conversationHistory,
        userContext
      );

      // Save messages
      await storage.createMessage({
        conversationId: effectiveConversationId,
        role: "user",
        content: message,
      });

      const assistantMessage = await storage.createMessage({
        conversationId: effectiveConversationId,
        role: "assistant",
        content: sianiResponse.message,
        emotionalState: sianiResponse.emotionalState || null,
      });

      // Get voice configuration
      const voiceConfig = sianiResponse.userState 
        ? getVoiceConfig(sianiResponse.userState, {
            mode: sianiResponse.attunementMode || "mirror",
            nextEngine: "emotional",
            toneModulation: { warmth: 70, directness: 50, groundedness: 60, energy: 50, shouldBeGentle: false },
            pacingModulation: { speed: "normal", breathingCoded: false, silenceComfort: 50, sentenceLength: "medium" },
            intensity: 50,
          })
        : { voice: "nova" as const, speed: 1.0 };

      // Synthesize voice using ElevenLabs
      const ttsResult = await voiceService.synthesizeResponse(sianiResponse.message, {
        mood: sianiResponse.emotionalState?.dominantEmotion || "neutral",
        arousalLevel: sianiResponse.emotionalState?.arousalLevel || 50,
        shouldBeGentle: sianiResponse.userState?.safetyState.tier !== "T0_stable",
      });

      // Return audio with metadata
      if (ttsResult) {
        res.set({
          "Content-Type": ttsResult.contentType,
          "X-Response": encodeURIComponent(sianiResponse.message),
          "X-Conversation-Id": effectiveConversationId,
          "X-Message-Id": assistantMessage.id,
          "X-Attunement-Mode": sianiResponse.attunementMode || "mirror",
          "X-TTS-Provider": "elevenlabs",
        });
        res.send(ttsResult.audioBuffer);
      } else {
        // Return text-only if TTS unavailable
        res.json({
          response: sianiResponse.message,
          conversationId: effectiveConversationId,
          error: "Audio synthesis unavailable",
        });
      }
    } catch (error) {
      console.error("Text-to-speech error:", error);
      res.status(500).json({ error: "Failed to generate voice response" });
    }
  });

  // ============================================
  // PHASE 1: PULSE - Daily Community Questions
  // ============================================

  // Get today's pulse question for authenticated user.
  // Returns null if the user has already answered any pulse today,
  // so the daily ritual surface can show the "answered" state.
  app.get("/api/pulse/today", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const today = new Date();
      const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const respondedToday = await db
        .select({ id: pulseResponses.id })
        .from(pulseResponses)
        .where(
          and(
            eq(pulseResponses.userId, userId),
            sql`${pulseResponses.createdAt} >= ${startOfDay}`,
          ),
        )
        .limit(1);
      if (respondedToday.length > 0) {
        return res.json({ question: null, alreadyAnsweredToday: true });
      }
      const question = await storage.getTodaysPulseQuestion(userId);
      if (!question) {
        return res.json({ message: "No questions available", question: null });
      }
      res.json({ question });
    } catch (error) {
      console.error("Get pulse question error:", error);
      res.status(500).json({ error: "Failed to get pulse question" });
    }
  });

  // Get a specific pulse question
  app.get("/api/pulse/questions/:id", verifyToken, async (req, res) => {
    try {
      const { id } = req.params;
      const question = await storage.getPulseQuestionById(id);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }
      res.json({ question });
    } catch (error) {
      console.error("Get pulse question by id error:", error);
      res.status(500).json({ error: "Failed to get question" });
    }
  });

  // Submit pulse response
  app.post("/api/pulse/respond", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const { questionId, response } = req.body;
      if (!questionId || !response) {
        return res.status(400).json({ error: "questionId and response are required" });
      }

      // Idempotency: enforce one rewarded pulse response per user per
      // UTC day across ALL questions (matches the "today's pulse"
      // product contract and prevents farming via question rotation).
      const today = new Date();
      const dayKey = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, '0')}${String(today.getUTCDate()).padStart(2, '0')}`;
      const idempotencyKey = `pulse:${userId}:${dayKey}`;

      const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const existingToday = await db
        .select({ id: pulseResponses.id })
        .from(pulseResponses)
        .where(
          and(
            eq(pulseResponses.userId, userId),
            sql`${pulseResponses.createdAt} >= ${startOfDay}`,
          ),
        )
        .limit(1);

      let result;
      let credAmount = 0;
      let alreadyAnsweredToday = false;
      if (existingToday.length === 0) {
        result = await storage.submitPulseResponse(userId, questionId, response);
        credAmount = CRED_REWARDS.DAILY_CHECKIN;
        await storage.addCredToUser(
          userId,
          credAmount,
          'pulse_response',
          'pulse',
          questionId,
          idempotencyKey,
        );
      } else {
        result = existingToday[0];
        alreadyAnsweredToday = true;
      }

      // Get aggregate results for this question
      const allResponses = await db.select({ response: pulseResponses.response })
        .from(pulseResponses)
        .where(eq(pulseResponses.questionId, questionId));
      const totalResponses = allResponses.length;
      const responseCounts: Record<string, number> = {};
      for (const r of allResponses) {
        responseCounts[r.response] = (responseCounts[r.response] || 0) + 1;
      }
      const aggregateResults = Object.entries(responseCounts).map(([value, count]) => ({
        value,
        count,
        percentage: Math.round((count / totalResponses) * 100),
      }));
      
      res.json({ success: true, response: result, credGained: credAmount, xpGained: credAmount, aggregateResults, totalResponses, alreadyAnsweredToday, questionId });
    } catch (error) {
      console.error("Submit pulse response error:", error);
      res.status(500).json({ error: "Failed to submit response" });
    }
  });

  // Get user's pulse response history
  app.get("/api/pulse/history", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const limit = parseInt(req.query.limit as string) || 20;
      const responses = await storage.getUserPulseResponses(userId, limit);
      res.json({ responses });
    } catch (error) {
      console.error("Get pulse history error:", error);
      res.status(500).json({ error: "Failed to get pulse history" });
    }
  });

  // Get aggregate results for a pulse question
  app.get("/api/pulse/questions/:id/results", verifyToken, async (req, res) => {
    try {
      const { id } = req.params;
      const question = await storage.getPulseQuestionById(id);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }
      const allResponses = await db.select({ response: pulseResponses.response })
        .from(pulseResponses)
        .where(eq(pulseResponses.questionId, id));
      const totalResponses = allResponses.length;
      const responseCounts: Record<string, number> = {};
      for (const r of allResponses) {
        responseCounts[r.response] = (responseCounts[r.response] || 0) + 1;
      }
      const aggregateResults = Object.entries(responseCounts).map(([value, count]) => ({
        value,
        count,
        percentage: Math.round((count / totalResponses) * 100),
      }));
      res.json({ question, aggregateResults, totalResponses });
    } catch (error) {
      console.error("Get pulse results error:", error);
      res.status(500).json({ error: "Failed to get results" });
    }
  });

  // ============================================
  // PHASE 1: RHYTHM - Habit/Routine Tracking
  // ============================================

  // Get user's rhythms
  app.get("/api/rhythms", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const rhythms = await storage.getUserRhythms(userId);
      res.json({ rhythms });
    } catch (error) {
      console.error("Get rhythms error:", error);
      res.status(500).json({ error: "Failed to get rhythms" });
    }
  });

  // Get a specific rhythm
  app.get("/api/rhythms/:id", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const { id } = req.params;
      const rhythm = await storage.getRhythmById(id);
      if (!rhythm) {
        return res.status(404).json({ error: "Rhythm not found" });
      }
      if (rhythm.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json({ rhythm });
    } catch (error) {
      console.error("Get rhythm error:", error);
      res.status(500).json({ error: "Failed to get rhythm" });
    }
  });

  // Create a new rhythm
  app.post("/api/rhythms", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const { title, category, frequency } = req.body;
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      const rhythm = await storage.createRhythm({
        userId,
        title,
        category: category || "personal",
        frequency: frequency || "daily",
      });
      res.json({ success: true, rhythm });
    } catch (error) {
      console.error("Create rhythm error:", error);
      res.status(500).json({ error: "Failed to create rhythm" });
    }
  });

  // Log rhythm completion
  app.post("/api/rhythms/:id/complete", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const { id } = req.params;
      const { note, mood } = req.body;

      // Idempotency: prevent farming by limiting one rewarded completion
      // per user per rhythm per UTC day.
      const existingRhythm = await storage.getRhythmById(id);
      if (!existingRhythm) {
        return res.status(404).json({ error: "Rhythm not found" });
      }
      // Authz: rhythms are user-scoped — block IDOR.
      if (existingRhythm.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const today = new Date();
      const todayStr = today.toDateString();
      const alreadyDoneToday = existingRhythm.lastCompletedAt
        && new Date(existingRhythm.lastCompletedAt).toDateString() === todayStr;

      const dayKey = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, '0')}${String(today.getUTCDate()).padStart(2, '0')}`;
      const idempotencyKey = `rhythm:${userId}:${id}:${dayKey}`;

      let log = null;
      let credAmount = 0;
      if (!alreadyDoneToday) {
        log = await storage.logRhythmCompletion(id, userId, note, mood);
        credAmount = CRED_REWARDS.DAILY_ACTION;
        await storage.addCredToUser(
          userId,
          credAmount,
          'rhythm_complete',
          'rhythm',
          id,
          idempotencyKey,
        );
      }

      const updatedRhythm = await storage.getRhythmById(id);

      res.json({ success: true, log, rhythm: updatedRhythm, credGained: credAmount, xpGained: credAmount, alreadyCompletedToday: alreadyDoneToday });
    } catch (error) {
      console.error("Log rhythm completion error:", error);
      res.status(500).json({ error: "Failed to log completion" });
    }
  });

  // Get rhythm completion logs
  app.get("/api/rhythms/:id/logs", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const { id } = req.params;
      const ownerCheck = await storage.getRhythmById(id);
      if (!ownerCheck) {
        return res.status(404).json({ error: "Rhythm not found" });
      }
      if (ownerCheck.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const limit = parseInt(req.query.limit as string) || 30;
      const logs = await storage.getRhythmLogs(id, limit);
      res.json({ logs });
    } catch (error) {
      console.error("Get rhythm logs error:", error);
      res.status(500).json({ error: "Failed to get logs" });
    }
  });

  // ============================================
  // PHASE 1: THE REAL - End-of-Day Capture
  // ============================================

  // Create a new real capture
  app.post("/api/real/capture", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Check if capture already exists for today
      const existingCapture = await storage.getTodaysRealCapture(userId);
      if (existingCapture) {
        return res.json({ 
          success: false, 
          error: "Already captured today", 
          existingCapture 
        });
      }
      
      const { 
        captureType, 
        transcription, 
        audioUrl, 
        duration,
        dayRating,
        gratitude,
        tomorrow 
      } = req.body;
      
      const capture = await storage.createRealCapture({
        userId,
        captureType: captureType || "voice",
        transcription,
        audioUrl,
        duration,
        dayRating,
        gratitude,
        tomorrow,
      });
      
      // Award XP for new capture
      await storage.addXpToUser(userId, 25);
      
      res.json({ success: true, capture, xpGained: 25 });
    } catch (error) {
      console.error("Create real capture error:", error);
      res.status(500).json({ error: "Failed to create capture" });
    }
  });

  // Check if today's capture exists
  app.get("/api/real/today", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const capture = await storage.getTodaysRealCapture(userId);
      res.json({ 
        hasCapture: !!capture, 
        capture: capture || null 
      });
    } catch (error) {
      console.error("Get today's capture error:", error);
      res.status(500).json({ error: "Failed to check capture" });
    }
  });

  // Get capture history
  app.get("/api/real/history", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const limit = parseInt(req.query.limit as string) || 30;
      const captures = await storage.getUserRealCaptures(userId, limit);
      res.json({ captures });
    } catch (error) {
      console.error("Get capture history error:", error);
      res.status(500).json({ error: "Failed to get history" });
    }
  });

  // ============================================
  // INSTITUTIONAL DASHBOARD ENDPOINTS
  // ============================================

  /**
   * Assert that the authenticated caller is an active member of the given
   * organization (or a platform-level admin).  Returns true when access is
   * granted; writes the 401/403 response and returns false when denied.
   */
  async function assertOrgAccess(req: any, res: any, orgId: string): Promise<boolean> {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return false;
    }
    // Platform admins may access any org dashboard
    if (req.authUser?.userType === "admin") {
      return true;
    }
    const membership = await storage.getOrgMember(userId, orgId);
    if (!membership || membership.isActive === false) {
      res.status(403).json({ error: "Access denied: not a member of this organization" });
      return false;
    }
    return true;
  }

  // Get dashboard stats for an organization
  app.get("/api/dashboard/stats/:orgId", verifyToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!await assertOrgAccess(req, res, orgId)) return;
      const stats = await storage.getDashboardStats(orgId);
      res.json(stats);
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({ error: "Failed to get dashboard stats" });
    }
  });

  // Get referral metrics for an organization
  app.get("/api/dashboard/referrals/:orgId", verifyToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!await assertOrgAccess(req, res, orgId)) return;
      const metrics = await storage.getReferralMetrics(orgId);
      res.json(metrics);
    } catch (error) {
      console.error("Get referral metrics error:", error);
      res.status(500).json({ error: "Failed to get referral metrics" });
    }
  });

  // Get recent user events (live signals)
  app.get("/api/dashboard/events/:orgId", verifyToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!await assertOrgAccess(req, res, orgId)) return;
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getRecentUserEvents(orgId, limit);
      res.json(events);
    } catch (error) {
      console.error("Get user events error:", error);
      res.status(500).json({ error: "Failed to get user events" });
    }
  });

  // Get event counts by type
  app.get("/api/dashboard/events/:orgId/counts", verifyToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!await assertOrgAccess(req, res, orgId)) return;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24h
      const counts = await storage.getEventCounts(orgId, since);
      res.json(counts);
    } catch (error) {
      console.error("Get event counts error:", error);
      res.status(500).json({ error: "Failed to get event counts" });
    }
  });

  // Get AI sentiment data
  app.get("/api/dashboard/sentiment/:orgId", verifyToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!await assertOrgAccess(req, res, orgId)) return;
      const limit = parseInt(req.query.limit as string) || 100;
      const sentiments = await storage.getRecentSentiment(orgId, limit);
      res.json(sentiments);
    } catch (error) {
      console.error("Get sentiment error:", error);
      res.status(500).json({ error: "Failed to get sentiment data" });
    }
  });

  // Get average sentiment
  app.get("/api/dashboard/sentiment/:orgId/average", verifyToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!await assertOrgAccess(req, res, orgId)) return;
      const days = parseInt(req.query.days as string) || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const avg = await storage.getAverageSentiment(orgId, since);
      res.json(avg);
    } catch (error) {
      console.error("Get average sentiment error:", error);
      res.status(500).json({ error: "Failed to get average sentiment" });
    }
  });

  // Get risk tiers
  app.get("/api/dashboard/risk/:orgId", verifyToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!await assertOrgAccess(req, res, orgId)) return;
      const tiers = await storage.getRiskTiers(orgId);
      res.json(tiers);
    } catch (error) {
      console.error("Get risk tiers error:", error);
      res.status(500).json({ error: "Failed to get risk tiers" });
    }
  });

  // Get risk shifts (members who changed tiers)
  app.get("/api/dashboard/risk/:orgId/shifts", verifyToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!await assertOrgAccess(req, res, orgId)) return;
      const hours = parseInt(req.query.hours as string) || 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const shifts = await storage.getRiskShifts(orgId, since);
      res.json(shifts);
    } catch (error) {
      console.error("Get risk shifts error:", error);
      res.status(500).json({ error: "Failed to get risk shifts" });
    }
  });

  // Get metric history
  app.get("/api/dashboard/metrics/:orgId/:metricName", verifyToken, async (req, res) => {
    try {
      const { orgId, metricName } = req.params;
      if (!await assertOrgAccess(req, res, orgId)) return;
      const days = parseInt(req.query.days as string) || 30;
      const history = await storage.getMetricHistory(orgId, metricName, days);
      res.json(history);
    } catch (error) {
      console.error("Get metric history error:", error);
      res.status(500).json({ error: "Failed to get metric history" });
    }
  });

  // Get user's organizations
  app.get("/api/dashboard/organizations", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const orgs = await storage.getUserOrganizations(userId);
      res.json(orgs);
    } catch (error) {
      console.error("Get user organizations error:", error);
      res.status(500).json({ error: "Failed to get organizations" });
    }
  });

  // Get organization members — requires org membership; returns safe subset of user fields
  app.get("/api/dashboard/organizations/:orgId/members", verifyToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!await assertOrgAccess(req, res, orgId)) return;
      const members = await storage.getOrgMembers(orgId);
      res.json(members);
    } catch (error) {
      console.error("Get org members error:", error);
      res.status(500).json({ error: "Failed to get organization members" });
    }
  });

  // ============================================
  // NIGHT SHIFT API - Mobile App Core Endpoints
  // ============================================

  // Get today's signal (care pings + today's actions)
  app.get("/api/nightshift/signal", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get today's check-ins
      const todaysCheckIns = await storage.getTodaysCheckIns(userId);
      
      // Get active goals with today's moves
      const goals = await storage.getGoalsByUser(userId, 5);
      const todaysMoves = [];
      for (const goal of goals) {
        const moves = await storage.getMovesByGoal(goal.id);
        todaysMoves.push(...moves.filter(m => !m.isCompleted).slice(0, 3));
      }

      // Get unresolved signals (care alerts)
      const carePings = await storage.getUnresolvedSignalsByUser(userId);

      // Get user's CRED balance
      const credBalance = await storage.getUserCredBalance(userId);

      // Current time slot (morning 5-12, midday 12-17, evening 17-21, night 21-5)
      const hour = new Date().getHours();
      const currentSlot = hour >= 5 && hour < 12 ? 'morning' : hour < 17 ? 'midday' : hour < 21 ? 'evening' : 'night';
      const slotCheckedIn = todaysCheckIns.some(c => c.slot === currentSlot);

      res.json({
        currentSlot,
        slotCheckedIn,
        todaysCheckIns,
        todaysMoves: todaysMoves.slice(0, 3), // 3 daily actions
        carePings,
        credBalance,
        streak: req.authUser?.currentStreak || 0,
      });
    } catch (error) {
      console.error("Get night shift signal error:", error);
      res.status(500).json({ error: "Failed to get signal" });
    }
  });

  // Get available drops (resources via SmartMatcher)
  app.get("/api/nightshift/drops", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get user's location for geo-matching
      const userLocation = await storage.getUserLocation(userId);
      
      // Get active referrals to filter out already claimed
      const activeReferrals = await storage.getActiveReferralsForUser(userId);
      const claimedResourceIds = new Set(activeReferrals.map(r => r.resourceId));

      // Get resources (drops)
      const allResources = await storage.getAllResources();
      
      // Filter and format as drops
      const drops = allResources
        .filter(r => !claimedResourceIds.has(r.id) && r.isVerified !== false)
        .slice(0, 20)
        .map(r => {
          const contact = (r.contact as { address?: string; phone?: string; email?: string; website?: string } | null) || {};
          return {
            id: r.id,
            title: r.name,
            category: r.category,
            description: r.description,
            address: contact.address || null,
            phone: contact.phone || null,
            isExclusive: (r.successRate || 0) > 80,
            slotsRemaining: Math.floor(Math.random() * 10) + 1, // Simulate scarcity
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
            credReward: 25,
            claimed: false,
          };
        });

      res.json({ drops });
    } catch (error) {
      console.error("Get drops error:", error);
      res.status(500).json({ error: "Failed to get drops" });
    }
  });

  // Claim a drop (create referral)
  app.post("/api/nightshift/drops/:id/claim", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { id: resourceId } = req.params;
      const { linkedGoalId } = req.body;

      // Check if already claimed
      const existing = await storage.getActiveReferralsForUser(userId);
      if (existing.some(r => r.resourceId === resourceId)) {
        return res.status(400).json({ error: "Already claimed this drop" });
      }

      // Create referral
      const referral = await storage.createReferral({
        userId,
        resourceId,
        source: 'nightshift_drop',
        linkedGoalId,
        state: 'accepted',
        priority: 'normal',
      });

      // Award CRED for claiming
      await storage.addCredToUser(
        userId, 
        25, 
        'drop_claimed', 
        'referral', 
        referral.id,
        `claim-${resourceId}-${userId}`
      );

      res.json({ 
        success: true, 
        referralId: referral.id,
        credEarned: 25,
        message: "Drop claimed! Visit within 7 days to complete the loop." 
      });
    } catch (error) {
      console.error("Claim drop error:", error);
      res.status(500).json({ error: "Failed to claim drop" });
    }
  });

  // Get circle status (community heat/leaderboard)
  app.get("/api/nightshift/circle", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get top users by CRED (simplified leaderboard)
      const topUsers = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        credBalance: users.credBalance,
        level: users.level,
        currentStreak: users.currentStreak,
      })
      .from(users)
      .where(sql`${users.credBalance} > 0`)
      .orderBy(desc(users.credBalance))
      .limit(20);

      // Find user's rank
      const userRank = topUsers.findIndex(u => u.id === userId) + 1;

      // Get recent community achievements
      const recentSpotlights = await storage.getSpotlights(5);

      res.json({
        leaderboard: topUsers.map((u, i) => ({
          ...u,
          rank: i + 1,
          movement: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable',
        })),
        userRank: userRank || null,
        recentSpotlights,
        circleSize: topUsers.length,
      });
    } catch (error) {
      console.error("Get circle error:", error);
      res.status(500).json({ error: "Failed to get circle" });
    }
  });

  // Get pending loops (referrals needing closure)
  app.get("/api/nightshift/loops", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const activeReferrals = await storage.getActiveReferralsForUser(userId);
      
      // Format as loops
      const loops = activeReferrals.map(r => ({
        id: r.id,
        resourceId: r.resourceId,
        resourceName: r.resource.name,
        category: r.resource.category,
        state: r.state,
        createdAt: r.createdAt,
        dueDate: r.dueDate || new Date(new Date(r.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000),
        credReward: 50, // CRED for closing loop
        isUrgent: r.priority === 'urgent' || r.priority === 'critical',
      }));

      res.json({ loops });
    } catch (error) {
      console.error("Get loops error:", error);
      res.status(500).json({ error: "Failed to get loops" });
    }
  });

  // Close a loop (complete referral)
  app.post("/api/nightshift/loops/:id/close", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { id: referralId } = req.params;
      const { outcome, note } = req.body;

      // Update referral state
      const referral = await storage.updateReferralState(referralId, 'completed', note);
      if (!referral) {
        return res.status(404).json({ error: "Referral not found" });
      }

      // Create outcome record
      await storage.createReferralOutcome({
        referralId,
        result: outcome || 'success',
        userFeedback: note,
      });

      // Award CRED for closing the loop
      const credResult = await storage.addCredToUser(
        userId, 
        50, 
        'loop_closed', 
        'referral', 
        referralId,
        `loop-close-${referralId}`
      );

      res.json({ 
        success: true,
        credEarned: 50,
        newCredBalance: credResult?.user.credBalance || 0,
        message: "Loop closed! +50 CRED earned." 
      });
    } catch (error) {
      console.error("Close loop error:", error);
      res.status(500).json({ error: "Failed to close loop" });
    }
  });

  // ============================================
  // ENHANCED CHECK-IN ENDPOINTS
  // ============================================

  // Create a check-in for a specific slot
  app.post("/api/checkin", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { slot, mood, energyLevel, gratitude, intentForDay, progressNote, barriers, wins, reflection, note } = req.body;

      // Validate slot
      if (!['morning', 'midday', 'evening', 'night'].includes(slot)) {
        return res.status(400).json({ error: "Invalid slot. Must be morning, midday, evening, or night" });
      }

      // Check if already checked in for this slot today
      const existing = await storage.getCheckInForSlot(userId, slot, new Date());
      if (existing) {
        return res.status(400).json({ error: `Already checked in for ${slot} today` });
      }

      const checkIn = await storage.createCheckIn({
        userId,
        slot,
        mood,
        energyLevel,
        gratitude,
        intentForDay,
        progressNote,
        barriers,
        wins,
        reflection,
        note,
      });

      res.json({ 
        success: true, 
        checkIn,
        credEarned: checkIn.credEarned,
        message: `${slot.charAt(0).toUpperCase() + slot.slice(1)} check-in complete!` 
      });
    } catch (error) {
      console.error("Create check-in error:", error);
      res.status(500).json({ error: "Failed to create check-in" });
    }
  });

  // Get today's check-ins
  app.get("/api/checkin/today", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const checkIns = await storage.getTodaysCheckIns(userId);
      
      // Determine which slots are completed
      const completedSlots = checkIns.map(c => c.slot);
      // Current time slot (morning 5-12, midday 12-17, evening 17-21, night 21-5)
      const hour = new Date().getHours();
      const currentSlot = hour >= 5 && hour < 12 ? 'morning' : hour < 17 ? 'midday' : hour < 21 ? 'evening' : 'night';

      res.json({
        checkIns,
        completedSlots,
        currentSlot,
        canCheckIn: !completedSlots.includes(currentSlot),
      });
    } catch (error) {
      console.error("Get today's check-ins error:", error);
      res.status(500).json({ error: "Failed to get check-ins" });
    }
  });

  // Get check-in history
  app.get("/api/checkin/history", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const limit = parseInt(req.query.limit as string) || 30;
      const history = await storage.getCheckInHistory(userId, limit);

      res.json({ history });
    } catch (error) {
      console.error("Get check-in history error:", error);
      res.status(500).json({ error: "Failed to get history" });
    }
  });

  // ============================================
  // IMPACT DOSSIER ENDPOINTS
  // ============================================

  // Get user's impact dossiers
  app.get("/api/dossier", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const dossiers = await storage.getImpactDossiers(userId, limit);

      res.json({ dossiers });
    } catch (error) {
      console.error("Get dossiers error:", error);
      res.status(500).json({ error: "Failed to get dossiers" });
    }
  });

  // Get a specific dossier
  app.get("/api/dossier/:id", verifyToken, async (req, res) => {
    try {
      const { id } = req.params;
      const dossier = await storage.getImpactDossier(id);

      if (!dossier) {
        return res.status(404).json({ error: "Dossier not found" });
      }

      // Strict ownership check — isShareable only enables the public share-code route,
      // it must not bypass ownership on this authenticated endpoint.
      if (dossier.userId !== req.authUser?.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json({ dossier });
    } catch (error) {
      console.error("Get dossier error:", error);
      res.status(500).json({ error: "Failed to get dossier" });
    }
  });

  // Get dossier by share code (public access)
  app.get("/api/dossier/share/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const dossier = await storage.getImpactDossierByShareCode(code);

      if (!dossier || !dossier.isShareable) {
        return res.status(404).json({ error: "Dossier not found or not shareable" });
      }

      res.json({ dossier });
    } catch (error) {
      console.error("Get shared dossier error:", error);
      res.status(500).json({ error: "Failed to get dossier" });
    }
  });

  // Generate weekly dossier
  app.post("/api/dossier/generate", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const dossier = await storage.generateWeeklyDossier(userId);

      res.json({ 
        success: true, 
        dossier,
        message: "Your weekly impact dossier has been generated!" 
      });
    } catch (error) {
      console.error("Generate dossier error:", error);
      res.status(500).json({ error: "Failed to generate dossier" });
    }
  });

  // ============================================
  // CRED ECONOMY ENDPOINTS
  // ============================================

  // Get user's CRED balance and recent transactions
  app.get("/api/cred", verifyToken, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const balance = await storage.getUserCredBalance(userId);
      const limit = parseInt(req.query.limit as string) || 20;
      const transactions = await storage.getCredTransactions(userId, limit);

      res.json({ 
        balance,
        transactions,
        level: req.authUser?.level || 1,
        streak: req.authUser?.currentStreak || 0,
      });
    } catch (error) {
      console.error("Get CRED error:", error);
      res.status(500).json({ error: "Failed to get CRED data" });
    }
  });

  // ============================================
  // STREAK FREEZE ENDPOINTS
  // ============================================

  // Get available streak freezes for user
  app.get("/api/users/:userId/streak-freezes", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Authorization check: users can only access their own data
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const freezes = await storage.getAvailableStreakFreezes(userId);
      
      res.json({
        freezes,
        count: freezes.length,
      });
    } catch (error) {
      console.error("Get streak freezes error:", error);
      res.status(500).json({ error: "Failed to get streak freezes" });
    }
  });

  // Use a streak freeze
  app.post("/api/users/:userId/streak-freezes/use", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Authorization check: users can only use their own freezes
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const usedFreeze = await storage.useStreakFreeze(userId);
      
      if (!usedFreeze) {
        return res.status(400).json({ 
          error: "No available streak freezes",
          success: false,
        });
      }

      res.json({
        success: true,
        freeze: usedFreeze,
        message: "Streak freeze used! Your streak is protected.",
      });
    } catch (error) {
      console.error("Use streak freeze error:", error);
      res.status(500).json({ error: "Failed to use streak freeze" });
    }
  });

  // ============================================
  // STREAK RECOVERY QUEST ENDPOINTS
  // ============================================

  // Get active recovery quest
  app.get("/api/users/:userId/recovery-quest", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Authorization check: users can only access their own quests
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const quest = await storage.getActiveRecoveryQuest(userId);
      
      res.json({
        quest,
        hasActiveQuest: !!quest,
      });
    } catch (error) {
      console.error("Get recovery quest error:", error);
      res.status(500).json({ error: "Failed to get recovery quest" });
    }
  });

  // Create a recovery quest
  app.post("/api/users/:userId/recovery-quest", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { userId } = req.params;
      const { lostStreak } = req.body;
      
      // Authorization check: users can only create their own quests
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      if (!lostStreak || typeof lostStreak !== 'number' || lostStreak < 1) {
        return res.status(400).json({ error: "Valid lostStreak is required" });
      }

      // Check if user already has an active quest
      const existingQuest = await storage.getActiveRecoveryQuest(userId);
      if (existingQuest) {
        return res.status(400).json({ 
          error: "Already have an active recovery quest",
          quest: existingQuest,
        });
      }

      // Generate quest based on lost streak value
      const questTypes = ["double_checkin", "complete_move", "vault_confession"];
      const questType = questTypes[Math.floor(Math.random() * questTypes.length)];
      
      const questDescriptions: Record<string, string> = {
        double_checkin: "Complete two check-ins today to recover your streak",
        complete_move: "Complete one move from your bag to recover your streak",
        vault_confession: "Share your truth in The Vault to recover your streak",
      };

      const expiresAt = new Date();
      expiresAt.setHours(23, 59, 59, 999); // End of day

      const quest = await storage.createRecoveryQuest({
        userId,
        brokenStreak: lostStreak,
        questType,
        questDescription: questDescriptions[questType],
        expiresAt,
      });

      res.json({
        success: true,
        quest,
        message: "Recovery quest created! Complete it before midnight to restore your streak.",
      });
    } catch (error) {
      console.error("Create recovery quest error:", error);
      res.status(500).json({ error: "Failed to create recovery quest" });
    }
  });

  // Complete a recovery quest. Server VERIFIES the quest's required action
  // actually happened in the quest window (createdAt → expiresAt) before
  // restoring the streak. The DONE path is not a free button — it's a
  // confirmation that the user really did the work.
  app.post("/api/users/:userId/recovery-quest/:questId/complete", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { userId, questId } = req.params;
      
      // Authorization check: users can only complete their own quests
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Load the quest first (without marking it complete) so we can verify
      // its criterion against actual user activity in the quest window.
      const { db } = await import("./db");
      const { streakRecoveryQuests, moves, checkIns, vaultConfessions, users } = await import("@shared/schema");
      const { and, eq, gte, lte, sql: dsql } = await import("drizzle-orm");

      const [quest] = await db.select().from(streakRecoveryQuests)
        .where(and(
          eq(streakRecoveryQuests.id, questId),
          eq(streakRecoveryQuests.userId, userId),
        ))
        .limit(1);

      if (!quest) {
        return res.status(404).json({ error: "Quest not found" });
      }
      if (quest.isCompleted) {
        return res.status(400).json({ error: "Quest already completed" });
      }
      const now = new Date();
      if (quest.expiresAt && new Date(quest.expiresAt) < now) {
        return res.status(400).json({ error: "Quest expired" });
      }

      // Count qualifying activity in the quest window.
      const windowStart = quest.createdAt as Date;
      const windowEnd = quest.expiresAt as Date;

      let qualifyingCount = 0;
      let required = 1;
      let criterionLabel = "";

      if (quest.questType === "complete_move") {
        const rows = await db.select({ c: dsql<number>`count(*)` }).from(moves)
          .where(and(
            eq(moves.userId, userId),
            eq(moves.isCompleted, true),
            gte(moves.completedAt, windowStart),
            lte(moves.completedAt, windowEnd),
          ));
        qualifyingCount = Number(rows[0]?.c ?? 0);
        required = 1;
        criterionLabel = "complete a move from your bag";
      } else if (quest.questType === "double_checkin") {
        const rows = await db.select({ c: dsql<number>`count(*)` }).from(checkIns)
          .where(and(
            eq(checkIns.userId, userId),
            gte(checkIns.createdAt, windowStart),
            lte(checkIns.createdAt, windowEnd),
          ));
        qualifyingCount = Number(rows[0]?.c ?? 0);
        required = 2;
        criterionLabel = "complete two check-ins";
      } else if (quest.questType === "vault_confession") {
        const rows = await db.select({ c: dsql<number>`count(*)` }).from(vaultConfessions)
          .where(and(
            eq(vaultConfessions.userId, userId),
            gte(vaultConfessions.createdAt, windowStart),
            lte(vaultConfessions.createdAt, windowEnd),
          ));
        qualifyingCount = Number(rows[0]?.c ?? 0);
        required = 1;
        criterionLabel = "share in The Vault";
      } else {
        return res.status(400).json({ error: `Unsupported quest type: ${quest.questType}` });
      }

      if (qualifyingCount < required) {
        return res.status(400).json({
          error: "Quest criteria not met",
          progress: qualifyingCount,
          required,
          message: `Still need to ${criterionLabel} (${qualifyingCount}/${required}).`,
        });
      }

      // Criterion verified — mark quest complete (idempotent + ownership-checked).
      const completedQuest = await storage.completeRecoveryQuest(questId, userId);
      if (!completedQuest) {
        return res.status(409).json({ error: "Quest could not be completed" });
      }

      // Restore the broken streak on the user row. Only raise it — never
      // lower a streak the user has rebuilt past the recovered value.
      // NOTE: do NOT touch streakSavedAt here — that field is reserved for
      // freeze-token rescues so the cyan "saved" pulse on Home stays
      // semantically distinct from quest-based recoveries.
      try {
        const user = await storage.getUser(userId);
        if (user) {
          const restored = Math.max(user.currentStreak ?? 0, completedQuest.brokenStreak ?? 0);
          if (restored > (user.currentStreak ?? 0)) {
            await db.update(users)
              .set({
                currentStreak: restored,
                longestStreak: Math.max(user.longestStreak ?? 0, restored),
              })
              .where(eq(users.id, userId));
          }
        }
      } catch (err) {
        console.error("Restore streak after recovery quest error:", err);
      }

      res.json({
        success: true,
        quest: completedQuest,
        recoveredStreak: completedQuest.brokenStreak,
        message: `Your ${completedQuest.brokenStreak}-day streak has been recovered!`,
      });
    } catch (error) {
      console.error("Complete recovery quest error:", error);
      res.status(500).json({ error: "Failed to complete recovery quest" });
    }
  });

  // ============================================
  // SIANI MEMORY ENDPOINTS
  // ============================================

  // Get Siani's memories about user
  app.get("/api/siani/memories/:userId", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Authorization check: users can only access their own memories
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const memories = await storage.getSianiMemories(userId, limit);
      
      res.json({
        memories,
        count: memories.length,
      });
    } catch (error) {
      console.error("Get Siani memories error:", error);
      res.status(500).json({ error: "Failed to get memories" });
    }
  });

  // Create a Siani memory (only on own profile)
  app.post("/api/siani/memories", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const sianiMemorySchema = z.object({
        memoryType: z.enum(["fact", "preference", "struggle", "goal", "relationship", "trigger", "strength"]),
        content: z.string().min(1).max(2000),
        importance: z.number().int().min(1).max(10).optional(),
      });
      const parseResult = sianiMemorySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid memory data", details: parseResult.error.flatten() });
      }
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const memory = await storage.createSianiMemory({
        userId,
        memoryType: parseResult.data.memoryType,
        content: parseResult.data.content,
        importance: parseResult.data.importance ?? 5,
      });
      res.json({ success: true, memory });
    } catch (error) {
      console.error("Create Siani memory error:", error);
      res.status(500).json({ error: "Failed to create memory" });
    }
  });

  // ============================================
  // SIANI NUDGE ENDPOINTS
  // ============================================

  // Get pending nudges for user
  app.get("/api/siani/nudges/:userId", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Authorization check: users can only access their own nudges
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const nudges = await storage.getPendingNudges(userId);
      
      res.json({
        nudges,
        count: nudges.length,
      });
    } catch (error) {
      console.error("Get Siani nudges error:", error);
      res.status(500).json({ error: "Failed to get nudges" });
    }
  });

  // Create a nudge (admin / care team only — nudges are server-driven)
  app.post("/api/siani/nudges", verifyToken, requireRole("admin", "chw"), apiRateLimiter, async (req, res) => {
    try {
      const sianiNudgeSchema = z.object({
        userId: z.string().min(1),
        nudgeType: z.enum(["streak_reminder", "checkin_prompt", "goal_nudge", "celebration", "recovery_offer", "gentle_push"]),
        content: z.string().min(1).max(1000),
        triggerContext: z.string().max(500).optional(),
      });
      const parseResult = sianiNudgeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid nudge data", details: parseResult.error.flatten() });
      }
      const { userId, nudgeType, content, triggerContext } = parseResult.data;
      const nudge = await storage.createSianiNudge({
        userId,
        nudgeType,
        message: content,
        triggerReason: triggerContext || null,
      });
      res.json({ success: true, nudge });
    } catch (error) {
      console.error("Create Siani nudge error:", error);
      res.status(500).json({ error: "Failed to create nudge" });
    }
  });

  // Mark nudge as seen (own only)
  app.post(
    "/api/siani/nudges/:nudgeId/seen",
    verifyToken,
    requireOwnership(async (req) => storage.getNudgeById?.(req.params.nudgeId) ?? null),
    apiRateLimiter,
    async (req, res) => {
      try {
        const { nudgeId } = req.params;
        const updatedNudge = await storage.markNudgeSeen(nudgeId);
        if (!updatedNudge) {
          return res.status(404).json({ error: "Nudge not found" });
        }
        res.json({ success: true, nudge: updatedNudge });
      } catch (error) {
        console.error("Mark nudge seen error:", error);
        res.status(500).json({ error: "Failed to mark nudge as seen" });
      }
    },
  );

  // ============================================
  // VAULT CONFESSIONS ENDPOINTS (alternate paths)
  // ============================================

  // Legacy vault paths kept for the existing client (`useNightShift.ts`)
  // but rewired to the safe storage methods so they (a) never leak
  // user_id, (b) write user_id=NULL for anonymous posts, and (c) skip
  // CRED rewards for self-reactions / anonymous-author rewards. New
  // clients should use `/api/vault/feed` and `/api/vault/:id/react` from
  // `server/routes/vault.ts`.

  app.get("/api/vault/confessions", optionalAuth, async (req, res) => {
    try {
      const userId = req.authUser?.id ?? null;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = parseInt(req.query.offset as string) || 0;
      const result = await storage.getVaultFeedPublic({ userId, limit, offset });
      res.json({ confessions: result.confessions, count: result.confessions.length });
    } catch (error) {
      console.error("Get vault confessions error:", error);
      res.status(500).json({ error: "Failed to get confessions" });
    }
  });

  app.post("/api/vault/confessions", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const { content, isAnonymous, mood, displayName, category, audioUrl, audioDuration } = req.body ?? {};
      if (!content) return res.status(400).json({ error: "Content is required" });

      const anon = isAnonymous !== false;
      const authorHandle = anon ? randomBytes(6).toString("hex") : null;

      const { confession, bonusCredReward } = await storage.createVaultConfessionForUser({
        userId,
        content,
        isAnonymous: anon,
        authorHandle,
        displayName,
        category: category || "truth",
        mood: mood || null,
        audioUrl,
        audioDuration,
      });

      const totalCredEarned = VAULT_CRED_REWARDS.POST_CONFESSION + bonusCredReward;
      await storage.awardCred({
        userId,
        amount: totalCredEarned,
        reason: "vault_confession",
        sourceType: "confession",
        sourceId: confession.id,
      });

      res.json({
        success: true,
        confession: {
          id: confession.id,
          content: confession.content,
          isAnonymous: confession.isAnonymous,
          category: confession.category,
          mood: confession.mood,
          createdAt: confession.createdAt,
        },
        credEarned: totalCredEarned,
        bonusAwarded: bonusCredReward > 0,
      });
    } catch (error) {
      console.error("Create vault confession error:", error);
      res.status(500).json({ error: "Failed to create confession" });
    }
  });

  app.post("/api/vault/confessions/:confessionId/react", verifyToken, apiRateLimiter, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const { confessionId } = req.params;
      const { reactionType, action } = req.body ?? {};
      const validReactions = ["fire", "strength", "heart", "real"];
      if (!reactionType || !validReactions.includes(reactionType)) {
        return res.status(400).json({ error: "Invalid reactionType", validTypes: validReactions });
      }

      const result = await storage.applyVaultReaction({
        userId,
        confessionId,
        reactionType,
        action: action === "remove" ? "remove" : "add",
      });

      if (!result.ok && result.action === "not_found") {
        return res.status(404).json({ error: "Confession not found" });
      }

      if (result.action === "added" && result.authorIdToReward) {
        await storage.awardCred({
          userId: result.authorIdToReward,
          amount: VAULT_CRED_REWARDS.RECEIVE_REACTION,
          reason: "vault_reaction_received",
          sourceType: "reaction",
          sourceId: `${confessionId}-${userId}-${reactionType}`,
        });
      }

      res.json({ success: true, action: result.action, reactionType: result.reactionType });
    } catch (error) {
      console.error("React to confession error:", error);
      res.status(500).json({ error: "Failed to react" });
    }
  });

  // ============================================
  // HEAT INDEX RANKINGS (alternate paths)
  // ============================================

  // Get heat rankings
  app.get("/api/heat-rankings", readRateLimiter, async (req, res) => {
    try {
      const periodType = (req.query.periodType as string) || "weekly";
      const limit = parseInt(req.query.limit as string) || 25;

      const rankings = await storage.getHeatRankings(periodType, limit);
      
      res.json({
        rankings,
        periodType,
        count: rankings.length,
      });
    } catch (error) {
      console.error("Get heat rankings error:", error);
      res.status(500).json({ error: "Failed to get rankings" });
    }
  });

  // Get user's heat ranking - requires auth to view own ranking
  app.get("/api/heat-rankings/:userId", verifyToken, readRateLimiter, async (req, res) => {
    try {
      const { userId } = req.params;
      const periodType = (req.query.periodType as string) || "weekly";
      
      // Authorization check: users can only access their own ranking details
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const ranking = await storage.getUserHeatRanking(userId, periodType);
      
      if (!ranking) {
        return res.json({
          ranking: null,
          message: "User not yet ranked",
        });
      }

      res.json({
        ranking,
        periodType,
      });
    } catch (error) {
      console.error("Get user heat ranking error:", error);
      res.status(500).json({ error: "Failed to get ranking" });
    }
  });

  // ============================================
  // MEMBERSHIP KEY ENDPOINTS (by userId)
  // ============================================

  // Get user's membership key
  app.get("/api/membership/:userId", verifyToken, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Authorization check: users can only access their own membership
      if (req.authUser?.id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const membershipKey = await storage.getMembershipKey(userId);
      
      if (!membershipKey) {
        return res.json({
          hasMembership: false,
          message: "No membership key found",
        });
      }

      res.json({
        hasMembership: true,
        membershipKey,
      });
    } catch (error) {
      console.error("Get membership key error:", error);
      res.status(500).json({ error: "Failed to get membership key" });
    }
  });

  // Legacy self-service membership creation route removed.
  // Memberships are issued exclusively through the invite claim flow
  // at POST /api/invites/claim, which requires a valid invite code.
  // The old route allowed any authenticated user to self-issue any tier
  // (including "founder") without an invite, bypassing the membership gate.

  // ============================================
  // THE VAULT (CONFESSIONAL) ROUTES
  // ============================================
  app.use("/api/vault", vaultRoutes);

  // ============================================
  // HEAT INDEX (LEADERBOARD) ROUTES
  // ============================================
  app.use("/api/heat", heatRoutes);

  // ============================================
  // NOTIFICATIONS ROUTES
  // ============================================
  app.use("/api/notifications", notificationRoutes);

  // ============================================
  // INVITE SYSTEM ROUTES
  // ============================================
  app.use("/api/invites", authRateLimiter, inviteRoutes);

  // ============================================
  // MEMBERSHIP CARD ROUTES
  // ============================================
  app.use("/api/membership", verifyToken, membershipRoutes);

  // ============================================
  // EVENTS ROUTES
  // ============================================
  app.use("/api/events", verifyToken, eventRoutes);

  // ============================================
  // MASTERMIND NETWORK HUB ROUTES
  // ============================================
  app.use("/api/mastermind", mastermindRoutes);

  return httpServer;
}
