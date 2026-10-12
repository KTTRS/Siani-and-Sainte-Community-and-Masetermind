import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, SPRING, EASE } from "@/lib/motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SEO, PAGE_SEO } from "@/components/SEO";
import { 
  Zap, 
  Sparkles,
  ArrowUpRight,
  X,
  ChevronRight
} from "lucide-react";
import { 
  BentoGrid, 
  BentoItem, 
  MagazineCard, 
  Clay3DCard, 
  GlowBadge, 
  HeroFeature 
} from "@/lib/layouts";
import { hapticLight } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EditorialLoading } from "@/components/Editorial";
import { useSianiNudges, useMarkNudgeSeen } from "@/hooks/useNightShift";
import { useAuth } from "@/contexts/AuthContext";
import { Icons3D } from "@/lib/icons3d";
import { formatDistanceToNow } from "date-fns";

import heroImg from "@assets/generated_images/sainte_rooftop_night.png";
import clubImg from "@assets/generated_images/sainte_club_clean.png";
import loungeImg from "@assets/generated_images/sainte_lounge_clean.png";
import tunnelImg from "@assets/generated_images/sainte_tunnel_crimson.png";
import alleyImg from "@assets/generated_images/sainte_urban_alley.png";
import studioImg from "@assets/generated_images/sainte_studio_dark.png";
import textureImg from "@assets/generated_images/sainte_texture_clean.png";

const SIGNAL_FALLBACK_IMAGES = [tunnelImg, clubImg, loungeImg, studioImg];
const DROP_FALLBACK_IMAGES = [alleyImg, textureImg, clubImg, tunnelImg];

interface Nudge {
  id: string;
  nudgeType: 'streak_warning' | 'goal_nudge' | 'celebration' | 'check_in';
  message: string;
  actionUrl?: string;
  urgency: 'low' | 'medium' | 'high';
  createdAt: string;
}

interface NudgeCardProps {
  nudge: Nudge;
  onDismiss: () => void;
  isPending: boolean;
}

const NudgeCard = React.forwardRef<HTMLDivElement, NudgeCardProps>(function NudgeCard({ nudge, onDismiss, isPending }, ref) {
  const [, navigate] = useLocation();
  const getTypeLabel = (type: Nudge['nudgeType']) => {
    switch (type) {
      case 'streak_warning': return 'STREAK ALERT';
      case 'goal_nudge': return 'GOAL CHECK';
      case 'celebration': return 'CELEBRATION';
      case 'check_in': return 'CHECK IN';
      default: return 'SIANI';
    }
  };

  const urgencyStyles = {
    high: 'border-l-4 border-l-crimson',
    medium: 'border-l-4 border-l-amber-500',
    low: 'border-l-2 border-l-steel'
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, x: -20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, x: 20 }}
      transition={SPRING.sheet}
      className="flex-shrink-0 w-[280px]"
      data-testid={`card-nudge-${nudge.id}`}
    >
      <div className={`matte-surface clay-chip rounded-2xl p-4 space-y-3 ${urgencyStyles[nudge.urgency]}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-charcoal flex items-center justify-center clay-chip">
              <img 
                src={Icons3D.heart} 
                alt="Siani" 
                className="w-6 h-6 object-contain"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
              />
            </div>
            <div>
              <span className="font-condensed text-[10px] tracking-[0.2em] text-crimson uppercase block">
                {getTypeLabel(nudge.nudgeType)}
              </span>
              <span className="text-[10px] text-steel">
                {formatDistanceToNow(new Date(nudge.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 text-steel hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              hapticLight();
              onDismiss();
            }}
            disabled={isPending}
            data-testid={`button-dismiss-nudge-${nudge.id}`}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>

        <p className="text-sm text-silver leading-relaxed" data-testid={`text-nudge-message-${nudge.id}`}>
          {nudge.message}
        </p>

        {nudge.actionUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-white group"
            onClick={() => {
              hapticLight();
              if (nudge.actionUrl!.startsWith('/')) {
                navigate(nudge.actionUrl!);
              } else {
                window.open(nudge.actionUrl!, '_blank');
              }
            }}
            data-testid={`button-nudge-action-${nudge.id}`}
          >
            <span className="font-condensed text-xs tracking-wider uppercase">Take Action</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        )}
      </div>
    </motion.div>
  );
});

function NudgesSection({ userId }: { userId: string }) {
  const { data: nudges = [], isLoading } = useSianiNudges(userId);
  const markSeenMutation = useMarkNudgeSeen();

  const handleDismiss = (nudgeId: string) => {
    markSeenMutation.mutate({ userId, nudgeId });
  };

  if (isLoading) {
    return (
      <section className="px-6 py-4" data-testid="section-nudges-loading">
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          <Skeleton className="h-32 w-[280px] rounded-2xl bg-charcoal flex-shrink-0" />
          <Skeleton className="h-32 w-[280px] rounded-2xl bg-charcoal flex-shrink-0" />
        </div>
      </section>
    );
  }

  const activeNudges = (nudges as Nudge[]).filter((n: Nudge) => n);

  if (activeNudges.length === 0) return null;

  return (
    <section className="py-4" data-testid="section-nudges">
      <div className="px-6 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-condensed text-[10px] tracking-[0.2em] text-silver uppercase">
            Siani Says
          </span>
          {activeNudges.some((n: Nudge) => n.urgency === 'high') && (
            <span className="w-2 h-2 rounded-full bg-crimson animate-pulse" />
          )}
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {activeNudges.map((nudge: Nudge) => (
            <NudgeCard
              key={nudge.id}
              nudge={nudge}
              onDismiss={() => handleDismiss(nudge.id)}
              isPending={markSeenMutation.isPending}
            />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <EditorialLoading
      serial="SAINTE / FY / —"
      label="loading"
      testId="loading-foryou"
    />
  );
}

export default function ForYou() {
  const { profile, session } = useAuth();
  const userId = profile?.id;
  const [, navigate] = useLocation();

  const { data: drops = [], isLoading: dropsLoading } = useQuery<any[]>({
    queryKey: ['/api/flow/drops'],
  });

  const { data: signals = [], isLoading: signalsLoading } = useQuery<any[]>({
    queryKey: ['/api/flow/signals'],
  });

  const { data: credData } = useQuery<{ credBalance: number }>({
    queryKey: ['/api/cred'],
    enabled: !!session?.access_token,
  });

  const credBalance = credData?.credBalance ?? 0;

  const isLoading = dropsLoading || signalsLoading;

  if (isLoading) return <LoadingSkeleton />;

  const featuredDrop = drops?.[0];
  const secondaryDrops = drops?.slice(1, 3) || [];
  const signalItems = signals?.slice(0, 4) || [];

  return (
    <div className="flex flex-col min-h-full app-ground pb-24">
      <SEO {...PAGE_SEO.flow} />
      
      {/* Hero Section with Background Image */}
      <header 
        className="relative px-6 pt-12 pb-8"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(12,23,18,0.3) 0%, rgba(12,23,18,0.85) 60%, rgba(12,23,18,1) 100%), url(${heroImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative z-10 space-y-1"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <GlowBadge variant="crimson" pulse>
              <Zap className="w-3 h-3" />
              Live Intel
            </GlowBadge>
            <div
              className="flex items-center gap-1.5 matte-surface clay-chip rounded-full px-3 py-1.5 cursor-pointer"
              onClick={() => { hapticLight(); navigate('/bag'); }}
              data-testid="chip-cred-balance"
            >
              <img src={Icons3D.money} alt="CRED" className="w-4 h-4 object-contain" />
              <span className="font-condensed text-xs tracking-wider text-white">{credBalance.toLocaleString()}</span>
              <span className="text-[10px] text-steel uppercase">CRED</span>
            </div>
          </div>
          <h1 className="text-broken-display text-5xl text-white tracking-tighter">
            FOR<br/>YOU
          </h1>
          <p className="text-silver text-sm mt-2">Curated experiences just for you</p>
        </motion.div>
      </header>

      {/* Siani Nudges Section */}
      {userId && <NudgesSection userId={userId} />}

      <div className="px-6 space-y-10">
        {/* Hero Drop - Cinematic Visual */}
        {featuredDrop && (
          <section>
            <HeroFeature>
              <MagazineCard
                image={featuredDrop.mediaUrl || featuredDrop.imageUrl || DROP_FALLBACK_IMAGES[0]}
                overline="Limited Time"
                headline={featuredDrop.headline || featuredDrop.title}
                deck={featuredDrop.description}
                size="hero"
                className="rounded-[32px]"
                onClick={() => { hapticLight(); navigate('/drop'); }}
              />
            </HeroFeature>
          </section>
        )}

        {/* Secondary Drops - Asymmetric Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-condensed text-xs tracking-[0.2em] text-silver uppercase">Exclusive Drops</h2>
          </div>
          <BentoGrid cols={2}>
            {secondaryDrops.map((drop, i) => (
              <BentoItem key={drop.id} span="1">
                <MagazineCard
                  image={drop.mediaUrl || drop.imageUrl || DROP_FALLBACK_IMAGES[(i + 1) % DROP_FALLBACK_IMAGES.length]}
                  overline={drop.category}
                  headline={drop.headline || drop.title}
                  size="md"
                  className="rounded-2xl"
                  onClick={() => { hapticLight(); navigate('/drop'); }}
                />
              </BentoItem>
            ))}
          </BentoGrid>
        </section>

        {/* The Feed - Intel Signals */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-condensed text-xs tracking-[0.2em] text-silver uppercase">Intelligence Feed</h2>
          </div>
          
          <div className="space-y-4">
            {signalItems.map((signal, i) => {
              const signalImage = signal.mediaUrl || signal.imageUrl || SIGNAL_FALLBACK_IMAGES[i % SIGNAL_FALLBACK_IMAGES.length];
              return (
                <motion.div
                  key={signal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Clay3DCard className="p-0 overflow-hidden" onClick={() => { hapticLight(); navigate('/signal'); }}>
                    <div className="flex gap-4 p-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 clay-chip">
                        <img src={signalImage} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-condensed tracking-widest text-crimson uppercase">
                            {signal.category}
                          </span>
                          <span className="text-[10px] text-steel">•</span>
                          <span className="text-[10px] text-steel uppercase">
                            {signal.source || signal.storyteller}
                          </span>
                        </div>
                        <h3 className="font-display text-lg text-white leading-tight truncate">
                          {signal.title || signal.narrative?.split('.')[0]}
                        </h3>
                        <p className="text-sm text-silver/70 line-clamp-1 mt-1">
                          {signal.content || signal.narrative}
                        </p>
                      </div>
                      <div className="flex items-center justify-center">
                        <ArrowUpRight className="w-5 h-5 text-steel group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </Clay3DCard>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Action Teaser */}
        <section>
          <Clay3DCard variant="crimson" className="p-8 text-center space-y-4">
            <Sparkles className="w-8 h-8 text-white mx-auto animate-pulse" />
            <h3 className="font-display text-2xl text-white" data-testid="text-level-up-heading">Level Up Your Bag</h3>
            <p className="text-silver text-sm">Members with high engagement scores get early access to tiered drops.</p>
            <Button
              className="w-full clay-button bg-white text-black"
              onClick={() => { hapticLight(); navigate('/bag'); }}
              data-testid="button-increase-cred"
            >
              Increase My CRED
            </Button>
          </Clay3DCard>
        </section>
      </div>
    </div>
  );
}
