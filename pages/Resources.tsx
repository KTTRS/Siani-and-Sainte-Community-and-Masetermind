import { useState } from "react";
import { motion } from "framer-motion";
import { fadeUp, SPRING, EASE } from "@/lib/motion";
import { useQuery } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { Search, Phone, MapPin, ExternalLink } from "lucide-react";
import { haptic } from "@/lib/haptics";

import heroImg from "@assets/generated_images/sainte_urban_alley.png";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EditorialLoading, EditorialEmpty } from "@/components/Editorial";
import type { Resource } from "@shared/schema";

interface ResourceContact {
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "crisis", label: "Crisis" },
  { key: "housing", label: "Housing" },
  { key: "food", label: "Food" },
  { key: "healthcare", label: "Healthcare" },
  { key: "mental_health", label: "Mental Health" },
  { key: "employment", label: "Employment" },
  { key: "education", label: "Education" },
  { key: "legal", label: "Legal" },
  { key: "financial", label: "Financial" },
  { key: "transportation", label: "Transport" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  housing: "Housing",
  food: "Food",
  mental_health: "Mental Health",
  employment: "Employment",
  education: "Education",
  legal: "Legal",
  financial: "Financial",
  transportation: "Transport",
  healthcare: "Healthcare",
  childcare: "Childcare",
  veterans: "Veterans",
  crisis: "Crisis",
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category.replace(/_/g, " ");
}

// Get all service tags for a resource based on its description and category
function getServiceTags(resource: Resource): { label: string }[] {
  const tags: { label: string }[] = [];
  const textToScan = [
    resource.category,
    resource.description || "",
    resource.eligibility || "",
  ].join(" ").toLowerCase();
  
  // Map keywords to service tags
  const serviceMap: Record<string, string> = {
    housing: "housing",
    shelter: "housing",
    food: "food",
    meals: "food",
    pantry: "food",
    grocery: "food",
    mental: "mental_health",
    counseling: "mental_health",
    therapy: "mental_health",
    employment: "employment",
    jobs: "employment",
    career: "employment",
    training: "education",
    education: "education",
    ged: "education",
    legal: "legal",
    attorney: "legal",
    financial: "financial",
    assistance: "financial",
    rent: "financial",
    utility: "financial",
    transportation: "transportation",
    bus: "transportation",
    ride: "transportation",
    healthcare: "healthcare",
    medical: "healthcare",
    doctor: "healthcare",
    childcare: "childcare",
    children: "childcare",
    veteran: "veterans",
    military: "veterans",
    crisis: "crisis",
    emergency: "crisis",
    hotline: "crisis",
  };
  
  // Always add primary category first
  tags.push({ label: getCategoryLabel(resource.category) });
  
  const addedCategories = new Set([resource.category]);
  
  for (const [keyword, categoryKey] of Object.entries(serviceMap)) {
    if (textToScan.includes(keyword) && !addedCategories.has(categoryKey)) {
      tags.push({ label: getCategoryLabel(categoryKey) });
      addedCategories.add(categoryKey);
      if (tags.length >= 4) break;
    }
  }
  
  return tags;
}

function ResourceCard({ resource }: { resource: Resource }) {
  const contact = resource.contact as ResourceContact | null;
  const serviceTags = getServiceTags(resource);
  
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, ease: EASE.out }}
    >
      <Card 
        className="matte-surface p-5 border-smoke"
        data-testid={`card-resource-${resource.id}`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-bold text-lg text-white leading-tight" data-testid={`text-resource-name-${resource.id}`}>
            {resource.name}
          </h3>
        </div>
        
        {/* Service tags row */}
        <div className="flex flex-wrap gap-2 mb-3">
          {serviceTags.map((tag, idx) => (
            <span 
              key={idx}
              className="text-[10px] font-condensed uppercase tracking-wider px-2 py-1 rounded-md bg-graphite/80 text-steel border border-smoke/50"
            >
              {tag.label}
            </span>
          ))}
        </div>
        
        {resource.description && (
          <p className="text-sm text-steel mb-4 line-clamp-2" data-testid={`text-resource-description-${resource.id}`}>
            {resource.description}
          </p>
        )}
        
        <div className="flex flex-wrap gap-3">
          {contact?.phone && (
            <a 
              href={`tel:${contact.phone}`}
              onClick={() => haptic('rise')}
              className="flex items-center gap-2 text-sm text-silver hover:text-white transition-colors"
              data-testid={`link-resource-phone-${resource.id}`}
            >
              <Phone className="w-4 h-4" />
              <span>{contact.phone}</span>
            </a>
          )}
          
          {contact?.website && (
            <a 
              href={contact.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic('click')}
              className="flex items-center gap-2 text-sm text-silver hover:text-white transition-colors"
              data-testid={`link-resource-website-${resource.id}`}
            >
              <ExternalLink className="w-4 h-4" />
              <span>Website</span>
            </a>
          )}
          
          {resource.serviceArea && (
            <span className="flex items-center gap-2 text-sm text-steel">
              <MapPin className="w-4 h-4" />
              <span>{resource.serviceArea}</span>
            </span>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <EditorialLoading
      serial="SAINTE / RES / —"
      label="loading"
      testId="loading-resources"
    />
  );
}

export default function Resources() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: resources = [], isLoading, isError, error } = useQuery<Resource[]>({
    queryKey: ["/api/resources"],
  });

  const filteredResources = resources.filter(resource => {
    const matchesSearch = searchQuery === "" || 
      resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || resource.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col min-h-full app-ground">
      <SEO 
        title="Resources | SAINTE"
        description="Browse housing, food, mental health, employment, and other resources available to SAINTE members."
      />
      <div className="pb-20">
        <div className="relative h-[35vh] min-h-[240px]">
          <div className="absolute inset-0">
            <img 
              src={heroImg} 
              alt="" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
          </div>
          
          <header className="relative z-10 h-full flex flex-col justify-end px-fluid pb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={fadeUp()}
              className="space-y-2"
            >
              <p className="font-condensed text-fluid-label text-steel">
                Your Network
              </p>
              <h1 className="text-broken-display text-fluid-display text-white">
                RESOURCES
              </h1>
              <p className="text-fluid-body text-silver">
                Housing, services, and opportunities near you.
              </p>
            </motion.div>
          </header>
        </div>

        <section className="px-fluid py-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUp(0.1)}
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-steel" />
              <Input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-charcoal border-smoke text-white placeholder:text-steel"
                data-testid="input-search-resources"
              />
            </div>
          </motion.div>
        </section>

        <section className="px-fluid py-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUp(0.15)}
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
          >
            {CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category.key;
              return (
                <button
                  key={category.key}
                  onClick={() => { haptic('click'); setSelectedCategory(category.key); }}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isSelected 
                      ? "bg-crimson text-white border border-crimson/50" 
                      : "bg-charcoal text-silver border border-t-smoke/30 border-l-smoke/30 border-b-black/50 border-r-black/50 hover:text-white"
                  }`}
                  style={{
                    boxShadow: isSelected 
                      ? '3px 3px 8px rgba(0,0,0,0.5), inset 1px 1px 2px rgba(255,255,255,0.1)'
                      : '3px 3px 8px rgba(0,0,0,0.4), inset 1px 1px 2px rgba(255,255,255,0.02)'
                  }}
                  data-testid={`button-filter-${category.key}`}
                >
                  {category.label}
                </button>
              );
            })}
          </motion.div>
        </section>

        <section className="px-fluid py-4">
          {isError ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center"
              data-testid="error-resources"
            >
              <p className="text-lg font-bold text-silver mb-2">Failed to load resources</p>
              <p className="text-sm text-steel">
                {error instanceof Error ? error.message : "Something went wrong. Please try again later."}
              </p>
            </motion.div>
          ) : isLoading ? (
            <LoadingSkeleton />
          ) : filteredResources.length === 0 ? (
            <EditorialEmpty
              serial="SAINTE / RES / 00"
              label={searchQuery || selectedCategory !== "all" ? "no matches — adjust filters" : "no resources yet"}
              testId="empty-resources"
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={fadeUp(0.2)}
              className="space-y-3"
            >
              <p className="text-sm text-steel mb-4">
                {filteredResources.length} resource{filteredResources.length !== 1 ? "s" : ""} available
              </p>
              
              {filteredResources.map((resource, index) => (
                <motion.div
                  key={resource.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + index * 0.03 }}
                >
                  <ResourceCard resource={resource} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}
