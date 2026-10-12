import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { fadeUp, SPRING, EASE, flip, prefersReducedMotion } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  ChevronRight,
  Users,
  MapPin,
} from "lucide-react";
import { Icons3D, Icon3DImage } from "@/lib/icons3d";
import { hapticLight, hapticMedium, hapticSuccess } from "@/lib/haptics";
import { playTap, playClick, playCommit } from "@/lib/useSound";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { differenceInSeconds } from "date-fns";
import { CelebrationOverlay } from "@/lib/celebrations";
import { EditorialLoading, EditorialEmpty } from "@/components/Editorial";

interface Drop {
  id: string;
  headline: string;
  subhead: string | null;
  description: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  exclusivityTier: string;
  seatCount: number | null;
  seatsRemaining: number | null;
  accessWindowStart: Date | null;
  accessWindowEnd: Date | null;
  windowState: string;
  prizeDescription: string | null;
  prizeValue: number | null;
  fireCount: number | null;
  strengthCount: number | null;
  heartCount: number | null;
  rsvpCount: number | null;
  isFeatured: boolean | null;
  status: string;
  createdAt: Date;
}

import rooftopImg from "@assets/generated_images/sainte_rooftop_night.png";
import clubImg from "@assets/generated_images/sainte_club_clean.png";
import loungeImg from "@assets/generated_images/sainte_lounge_clean.png";
import alleyImg from "@assets/generated_images/sainte_urban_alley.png";

const FALLBACK_IMAGES = [rooftopImg, clubImg, loungeImg, alleyImg];

function getImageForDrop(drop: Drop, index: number): string {
  if (drop.mediaUrl) return drop.mediaUrl;
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

function getExclusivityLabel(tier: string): string {
  switch (tier) {
    case 'inner_circle': return 'INNER CIRCLE';
    case 'icons': return 'ICONS ONLY';
    default: return 'MEMBERS';
  }
}

function CountdownTimer({ expiresAt }: { expiresAt: string | null }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft("OPEN");
      return;
    }

    const updateTimer = () => {
      const seconds = differenceInSeconds(new Date(expiresAt), new Date());
      if (seconds <= 0) {
        setTimeLeft("EXPIRED");
        return;
      }
      
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      
      setIsUrgent(seconds < 3600);
      
      if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m`);
      } else if (mins > 0) {
        setTimeLeft(`${mins}m ${secs}s`);
      } else {
        setTimeLeft(`${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className={`scarcity-timer ${isUrgent ? 'urgent' : ''}`} data-testid="countdown-timer">
      <Clock className="w-3 h-3" />
      <span>{timeLeft}</span>
    </div>
  );
}

/**
 * Wraps DropCard with a reveal-tied cast shadow. The shadow only paints
 * once the card scrolls into view (`useInView`, once: true) so the cast
 * pool feels like the card landing in light from the locked --key-light
 * vector — not a permanent drop shadow under every card. Reduced-motion
 * is honored via the CSS rules on `.of-cast-shadow`.
 */
const DropCardWithCastShadow = React.forwardRef<HTMLDivElement, {
  drop: Drop;
  index: number;
  userRsvps: string[];
  onRsvp: (dropId: string) => void;
}>(function DropCardWithCastShadow(props, _outerRef) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px -15% 0px" });
  // Merge framer's popLayout ref with the local inView ref.
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (typeof _outerRef === 'function') _outerRef(node);
    else if (_outerRef) (_outerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [_outerRef]);
  return (
    <div
      ref={setRefs}
      className={`of-cast-shadow${inView ? " is-revealed" : ""}`}
    >
      <DropCard {...props} />
    </div>
  );
});

function DropCard({ 
  drop, 
  index, 
  userRsvps,
  onRsvp 
}: { 
  drop: Drop; 
  index: number; 
  userRsvps: string[];
  onRsvp: (dropId: string) => void;
}) {
  const { toast } = useToast();
  const isRsvpd = userRsvps.includes(drop.id);
  const spotsRemaining = drop.seatsRemaining ?? drop.seatCount ?? null;
  const isSoldOut = spotsRemaining !== null && spotsRemaining <= 0;

  const handleRsvp = () => {
    if (isRsvpd || isSoldOut) return;
    // No extra haptic here — HoldButton already fires the success beat
    // on completion, so the ladder lands exactly once.
    onRsvp(drop.id);
  };

  const categoryIcons: Record<string, string> = {
    members: Icons3D.crown,
    icons: Icons3D.star,
    inner_circle: Icons3D.heart,
  };

  const serialNumber = `SN-DROP-${drop.id.slice(-4).toUpperCase().padStart(4, '0')}`;

  const flipMotion = flip(index * 0.06);
  // T101 — Card-reveal haptic ladder: tap on enter, click as it settles.
  // Only fires for the first card so the cascade doesn't buzz once per
  // item. The 'success' beat lands later via HoldButton on claim/commit.
  useEffect(() => {
    if (index !== 0) return;
    if (prefersReducedMotion()) return;
    haptic('tap');
    void playTap();
    const t = window.setTimeout(() => { haptic('click'); void playClick(); }, 380);
    return () => window.clearTimeout(t);
  }, [index]);
  return (
    <motion.div
      initial={flipMotion.initial}
      animate={flipMotion.animate}
      transition={flipMotion.transition}
      style={flipMotion.style}
      className="relative overflow-hidden rounded-2xl"
      data-testid={`card-drop-${drop.id}`}
    >
      <div className="absolute inset-0">
        <img 
          src={getImageForDrop(drop, index)} 
          alt={drop.headline}
          className="w-full h-full object-cover"
        />
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.95) 100%)'
          }}
        />
      </div>

      <div className="relative z-10 p-5 min-h-[320px] flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="serial-tape" data-testid={`text-serial-${drop.id}`}>
            {serialNumber}
          </span>
          <CountdownTimer expiresAt={drop.accessWindowEnd?.toString() || null} />
        </div>

        <div className="flex-1 flex items-center justify-center py-6">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="matte-3d w-20 h-20 rounded-2xl flex items-center justify-center"
          >
            <img 
              src={categoryIcons[drop.exclusivityTier] || Icons3D.crown} 
              alt={drop.exclusivityTier}
              className="w-12 h-12 object-contain"
              style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
            />
          </motion.div>
        </div>

        <div className="space-y-4">
          <div>
            <span className="font-condensed text-[10px] tracking-[0.25em] text-crimson uppercase">
              {getExclusivityLabel(drop.exclusivityTier)}
            </span>
            <h3 
              className="status-exclusive text-xl font-black text-white mt-1 leading-tight"
              data-testid={`text-title-${drop.id}`}
            >
              {drop.headline}
            </h3>
            {drop.subhead && (
              <p className="text-sm text-silver/70 mt-1">{drop.subhead}</p>
            )}
          </div>

          <p className="text-sm text-silver/90 leading-relaxed line-clamp-2">
            {drop.description || drop.prizeDescription || "Exclusive opportunity for SAINTE members."}
          </p>

          <div className="flex items-center gap-4 text-xs text-steel">
            {drop.prizeValue && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>${drop.prizeValue} value</span>
              </div>
            )}
            {spotsRemaining !== null && (
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span className={spotsRemaining <= 5 ? 'text-crimson font-bold' : ''}>
                  {spotsRemaining} spots left
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="premium-chip-crimson">
              <img src={Icons3D.money} alt="CRED" className="w-4 h-4" />
              <span>{drop.rsvpCount || 0} RSVPs</span>
            </div>

            {isRsvpd || isSoldOut ? (
              <Button
                disabled
                className={`
                  px-6 py-2 rounded-xl font-condensed text-xs tracking-wider uppercase
                  ${isRsvpd 
                    ? 'bg-charcoal text-emerald-400 border border-emerald-500/30' 
                    : 'bg-charcoal/50 text-steel cursor-not-allowed'}
                `}
                data-testid={`button-rsvp-${drop.id}`}
              >
                {isRsvpd ? (
                  <span className="flex items-center gap-2">
                    <Icon3DImage icon="check" size={16} />
                    SECURED
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Icon3DImage icon="vault" size={16} />
                    SOLD OUT
                  </span>
                )}
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => { haptic('success'); handleRsvp(); }}
                className="btn-glass px-6 py-2 rounded-card font-condensed text-xs tracking-wider uppercase hover-elevate active-elevate-2"
                data-testid={`button-rsvp-${drop.id}`}
                aria-label="Claim your spot"
              >
                <span className="flex items-center gap-2">
                  CLAIM
                  <ChevronRight className="w-4 h-4" />
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function TheDrop() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<'all' | 'members' | 'icons' | 'inner_circle'>('all');
  const [localRsvps, setLocalRsvps] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationDrop, setCelebrationDrop] = useState<Drop | null>(null);

  const { data: drops = [], isLoading, error } = useQuery<Drop[]>({
    queryKey: ['/api/flow/drops'],
  });

  const handleCelebrationComplete = useCallback(() => {
    setShowCelebration(false);
    setCelebrationDrop(null);
  }, []);

  const rsvpMutation = useMutation({
    mutationFn: async (dropId: string) => {
      const response = await apiRequest('POST', `/api/flow/drops/${dropId}/rsvp`, {
        userId: profile?.id || 'demo-user'
      });
      return response.json();
    },
    onSuccess: (data, dropId) => {
      setLocalRsvps(prev => [...prev, dropId]);
      queryClient.invalidateQueries({ queryKey: ['/api/flow/drops'] });
      
      const drop = drops.find(d => d.id === dropId);
      hapticSuccess();
      void playCommit();
      setCelebrationDrop(drop || null);
      setShowCelebration(true);
      
      toast({
        title: "SPOT SECURED",
        description: `Your spot for ${drop?.headline || 'this drop'} has been claimed.`,
        duration: 4000,
      });
    },
    onError: () => {
      toast({
        title: "RSVP FAILED",
        description: "Unable to claim spot. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  });

  const filteredDrops = drops.filter(drop => 
    activeFilter === 'all' || drop.exclusivityTier === activeFilter
  );

  const totalDrops = drops.length;
  const totalSpotsRemaining = drops.reduce((sum, d) => sum + (d.seatsRemaining ?? d.seatCount ?? 0), 0);
  const rsvpCount = localRsvps.length;

  const filters: Array<{ key: typeof activeFilter; label: string }> = [
    { key: 'all', label: 'ALL' },
    { key: 'members', label: 'MEMBERS' },
    { key: 'icons', label: 'ICONS' },
    { key: 'inner_circle', label: 'INNER CIRCLE' }
  ];

  return (
    <>
      <SEO 
        title="The Drop | SAINTE"
        description="Exclusive drops and opportunities for SAINTE members"
      />

      <AnimatePresence>
        {showCelebration && (
          <CelebrationOverlay
            message="SPOT SECURED"
            sublabel={celebrationDrop?.headline || "You're in."}
            showConfetti
            onComplete={handleCelebrationComplete}
          >
            <motion.div
              className="mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={SPRING.sheet}
            >
              <img
                src={Icons3D.check}
                alt="Secured"
                className="w-24 h-24 mx-auto object-contain"
                style={{ filter: 'drop-shadow(0 4px 12px rgba(199,255,62,0.4))' }}
              />
            </motion.div>
          </CelebrationOverlay>
        )}
      </AnimatePresence>
      
      <div className="min-h-screen pb-24 safe-area-top app-ground">
        <div 
          className="relative px-5 pt-12 pb-8 overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(12,23,18,0.3) 0%, rgba(12,23,18,0.85) 60%, rgba(12,23,18,1) 100%), url(${rooftopImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        >
          <div className="hero-grain" aria-hidden />
          <span className="issue-serial absolute top-4 right-5 z-10" data-testid="text-issue-serial-drop">
            SAINTE / VOL 04 / DROP 0127
          </span>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUp()}
            className="relative z-10"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-condensed text-[10px] tracking-[0.3em] text-crimson uppercase">
                  NIGHT SHIFT
                </span>
                <h1 className="status-exclusive text-3xl font-black text-white mt-2">
                  THE DROP
                </h1>
                <p className="text-sm text-silver/70 mt-2 max-w-sm">
                  Time-sensitive opportunities. Limited spots. Claim yours before they're gone.
                </p>
              </div>
              {rsvpCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0"
                  style={{ background: 'rgba(199,255,62,0.15)', border: '1px solid rgba(199,255,62,0.3)' }}
                  data-testid="chip-your-rsvps"
                >
                  <Icon3DImage icon="ticket" size={14} />
                  <span className="font-condensed text-[11px] tracking-wider text-crimson font-bold">
                    {rsvpCount} RSVP{rsvpCount !== 1 ? 'S' : ''}
                  </span>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {!isLoading && !error && totalDrops > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUp(0.2)}
            className="px-5 pt-4 pb-2"
          >
            <div className="flex items-center gap-3 flex-wrap" data-testid="stats-summary">
              <span className="gel-capsule">
                <span className="icon-halo"><Icon3DImage icon="flame" size={14} /></span>
                <span className="font-stats tabular-nums" data-testid="text-total-drops">{totalDrops}</span>
                <span>drops live</span>
              </span>
              <span className="gel-capsule">
                <span className="icon-halo"><Icon3DImage icon="community" size={14} /></span>
                <span className="font-stats tabular-nums" data-testid="text-total-spots">{totalSpotsRemaining}</span>
                <span>spots left</span>
              </span>
            </div>
          </motion.div>
        )}

        <div className="px-5 py-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filters.map(filter => (
              <button
                key={filter.key}
                type="button"
                onClick={() => {
                  hapticLight();
                  setActiveFilter(filter.key);
                }}
                className={`gel-capsule ${activeFilter === filter.key ? 'gel-capsule--active' : ''}`}
                data-testid={`filter-${filter.key}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 space-y-6">
          {isLoading ? (
            <EditorialLoading
              serial="SAINTE / DROP / —"
              label="loading"
              testId="loading-drops"
            />
          ) : error ? (
            <EditorialEmpty
              serial="SAINTE / DROP / ERR"
              label="unable to load"
              testId="error-drops"
            />
          ) : filteredDrops.length === 0 ? (
            <div data-testid="empty-state">
              <EditorialEmpty
                serial={activeFilter === 'all' ? 'SAINTE / DROP / 00' : `SAINTE / DROP / ${activeFilter.slice(0, 3).toUpperCase()}`}
                label={activeFilter === 'all' ? 'no drops right now' : `no ${activeFilter.replace('_', ' ')} drops`}
              />
              {activeFilter !== 'all' && (
                <div className="text-center mt-2">
                  <Button
                    onClick={() => {
                      hapticLight();
                      setActiveFilter('all');
                    }}
                    className="bg-charcoal text-white border border-graphite rounded-xl font-condensed text-xs tracking-wider uppercase"
                    data-testid="button-view-all-drops"
                  >
                    VIEW ALL DROPS
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredDrops.map((drop, index) => (
                <DropCardWithCastShadow
                  key={drop.id}
                  drop={drop}
                  index={index}
                  userRsvps={localRsvps}
                  onRsvp={(dropId) => rsvpMutation.mutate(dropId)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  );
}
