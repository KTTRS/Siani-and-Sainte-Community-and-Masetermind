import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, SPRING, EASE, flip, prefersReducedMotion } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Eye,
  EyeOff,
  Clock,
  ChevronRight,
  Bookmark,
  Share2
} from "lucide-react";
import { Icons3D } from "@/lib/icons3d";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { playSignalIn, playTap, playClick } from "@/lib/useSound";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { differenceInSeconds } from "date-fns";
import { EditorialLoading, EditorialEmpty } from "@/components/Editorial";

interface FeedSignal {
  id: string;
  narrative: string;
  locationContext: string | null;
  storyteller: string | null;
  storytellerRole: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  cinematicTags: string[] | null;
  proofAssets: string[] | null;
  fireCount: number | null;
  strengthCount: number | null;
  heartCount: number | null;
  exclusivityTier: string;
  isFeatured: boolean | null;
  status: string;
  createdAt: Date;
}

import tunnelImg from "@assets/generated_images/sainte_tunnel_crimson.png";
import clubImg from "@assets/generated_images/sainte_club_clean.png";
import loungeImg from "@assets/generated_images/sainte_lounge_clean.png";
import alleyImg from "@assets/generated_images/sainte_urban_alley.png";
import studioImg from "@assets/generated_images/sainte_studio_dark.png";
import textureImg from "@assets/generated_images/sainte_texture_clean.png";

const FALLBACK_IMAGES = [tunnelImg, clubImg, loungeImg, alleyImg, studioImg, textureImg];

function getImageForSignal(signal: FeedSignal, index: number): string {
  if (signal.mediaUrl) return signal.mediaUrl;
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

function SignalTimer({ createdAt }: { createdAt: string }) {
  const [timeAgo, setTimeAgo] = useState("");
  const [isRecent, setIsRecent] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const seconds = differenceInSeconds(new Date(), new Date(createdAt));
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      
      setIsRecent(seconds < 3600);
      
      if (hours > 24) {
        setTimeAgo(`${Math.floor(hours / 24)}d ago`);
      } else if (hours > 0) {
        setTimeAgo(`${hours}h ago`);
      } else if (mins > 0) {
        setTimeAgo(`${mins}m ago`);
      } else {
        setTimeAgo("Just now");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <div className={`flex items-center gap-1.5 text-xs ${isRecent ? 'text-crimson' : 'text-steel'}`}>
      <Clock className="w-3 h-3" />
      <span className={isRecent ? 'font-bold' : ''}>{timeAgo}</span>
    </div>
  );
}

const SignalCard = React.forwardRef<HTMLDivElement, { 
  signal: FeedSignal; 
  index: number;
  onReact: (signalId: string, type: string) => void;
  onAcknowledge: (signalId: string) => void;
  isAcknowledged: boolean;
}>(function SignalCard({ 
  signal, 
  index,
  onReact,
  onAcknowledge,
  isAcknowledged,
}, ref) {
  const [isSaved, setIsSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    hapticLight();
    setIsSaved(!isSaved);
    toast({
      title: isSaved ? "REMOVED FROM VAULT" : "SAVED TO VAULT",
      description: isSaved ? "Signal removed from your saved intel" : "Signal saved for later access",
      duration: 2000,
    });
  };

  const handleShare = () => {
    hapticLight();
    if (navigator.share) {
      navigator.share({
        title: signal.storyteller || 'SAINTE Signal',
        text: signal.narrative.slice(0, 100) + '...',
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(signal.narrative);
      toast({
        title: "COPIED",
        description: "Signal copied to clipboard",
        duration: 2000,
      });
    }
  };

  const categoryConfig: Record<string, { icon: string; color: string; label: string }> = {
    members: { icon: Icons3D.sparkles, color: 'text-blue-400', label: 'INTEL' },
    icons: { icon: Icons3D.star, color: 'text-amber-400', label: 'INSIDER' },
    inner_circle: { icon: Icons3D.crown, color: 'text-purple-400', label: 'EXCLUSIVE' }
  };

  const config = categoryConfig[signal.exclusivityTier] || categoryConfig.members;
  const serialNumber = `SN-SIGNAL-${signal.id.slice(-4).toUpperCase().padStart(4, '0')}`;

  const flipMotion = flip(index * 0.06);
  // T101 — Card-reveal haptic ladder (first card only): tap on enter,
  // click as it settles after the 380ms flip. The 'success' beat lands
  // later when the user holds-to-acknowledge.
  useEffect(() => {
    if (index !== 0) return;
    if (prefersReducedMotion()) return;
    haptic('tap');
    void playTap();
    void playSignalIn();
    const t = window.setTimeout(() => { haptic('click'); void playClick(); }, 380);
    return () => window.clearTimeout(t);
  }, [index]);
  return (
    <motion.div
      ref={ref}
      initial={flipMotion.initial}
      animate={flipMotion.animate}
      transition={flipMotion.transition}
      style={flipMotion.style}
      className="matte-3d rounded-2xl overflow-hidden"
      data-testid={`card-signal-${signal.id}`}
    >
      <div className="relative h-32 overflow-hidden">
        <img 
          src={getImageForSignal(signal, index)} 
          alt=""
          className="w-full h-full object-cover"
        />
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 100%)'
          }}
        />
        
        <div className="absolute inset-0 p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="serial-tape">{serialNumber}</span>
            <div className="flex items-center gap-2">
              <SignalTimer createdAt={signal.createdAt?.toString() || new Date().toISOString()} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="matte-3d w-10 h-10 rounded-xl flex items-center justify-center">
              <img 
                src={config.icon} 
                alt={config.label}
                className="w-6 h-6 object-contain"
              />
            </div>
            <div>
              <span className={`font-condensed text-[10px] tracking-[0.2em] ${config.color} uppercase`}>
                {config.label}
              </span>
              {signal.storyteller && (
                <p className="text-xs text-white/80">{signal.storyteller}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {signal.locationContext && (
          <p className="text-[10px] font-condensed tracking-wider text-steel uppercase">
            {signal.locationContext}
          </p>
        )}
        
        <p className={`text-sm text-silver leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
          {signal.narrative}
        </p>

        {signal.narrative.length > 150 && (
          <button
            onClick={() => {
              hapticLight();
              setIsExpanded(!isExpanded);
            }}
            className="text-xs text-crimson font-condensed tracking-wider uppercase"
            data-testid={`button-expand-${signal.id}`}
          >
            {isExpanded ? 'SHOW LESS' : 'READ MORE'}
          </button>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-graphite">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                hapticLight();
                onReact(signal.id, 'fire');
              }}
              className="flex items-center gap-1 text-xs text-steel hover:text-amber-400 transition-colors"
              data-testid={`button-fire-${signal.id}`}
            >
              <img src={Icons3D.zap} alt="fire" className="w-4 h-4" />
              <span>{signal.fireCount || 0}</span>
            </button>
            <button
              onClick={() => {
                hapticLight();
                onReact(signal.id, 'heart');
              }}
              className="flex items-center gap-1 text-xs text-steel hover:text-crimson transition-colors"
              data-testid={`button-heart-${signal.id}`}
            >
              <img src={Icons3D.heart} alt="heart" className="w-4 h-4" />
              <span>{signal.heartCount || 0}</span>
            </button>
          </div>

          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              className={`w-9 h-9 rounded-xl ${isSaved ? 'text-crimson' : 'text-steel hover:text-white'}`}
              onClick={handleSave}
              data-testid={`button-save-${signal.id}`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="w-9 h-9 rounded-xl text-steel hover:text-white"
              onClick={handleShare}
              data-testid={`button-share-${signal.id}`}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* T104 — HoldButton acknowledge. Press-and-hold to "ACKNOWLEDGE",
            sharing the same haptic ladder (tap → click → success) as the
            Drop claim. Once acknowledged the row collapses to a quiet
            confirmation. */}
        <div className="pt-2">
          {isAcknowledged ? (
            <p
              className="font-condensed text-[10px] tracking-[0.3em] uppercase text-[#9BFF6A] text-center"
              data-testid={`text-ack-${signal.id}`}
            >
              ACKNOWLEDGED
            </p>
          ) : (
            <button
              type="button"
              onClick={() => { haptic('success'); onAcknowledge(signal.id); }}
              className="signal-ack-btn w-full h-10 rounded-xl hover-elevate active-elevate-2"
              aria-label="Acknowledge this signal"
              data-testid={`button-ack-${signal.id}`}
            >
              <span className="font-condensed text-[11px] tracking-[0.3em] uppercase text-white/85">
                Acknowledge
              </span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default function Signal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<'all' | 'members' | 'icons' | 'inner_circle'>('all');

  const { data: signals = [], isLoading, error } = useQuery<FeedSignal[]>({
    queryKey: ['/api/flow/signals'],
  });

  const reactMutation = useMutation({
    mutationFn: async ({ signalId, type }: { signalId: string; type: string }) => {
      const response = await apiRequest('POST', '/api/flow/react', {
        userId: user?.id || 'demo-user',
        contentType: 'signals',
        contentId: signalId,
        reactionType: type
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flow/signals'] });
    }
  });

  // T104 — Acknowledged signal IDs persist locally so the HoldButton
  // collapses on subsequent loads. The acknowledge action also pings the
  // 'fire' reaction so the count reflects engagement on the server.
  const ACK_KEY = `sainte_signal_ack_${user?.id || 'demo-user'}`;
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => {
    if (typeof localStorage === 'undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(ACK_KEY) || '[]')); }
    catch { return new Set(); }
  });
  const handleAcknowledge = (signalId: string) => {
    if (acknowledged.has(signalId)) return;
    // No extra haptic here — HoldButton already emits 'success' on
    // completion. Adding another would double-pulse the ladder.
    const next = new Set(acknowledged);
    next.add(signalId);
    setAcknowledged(next);
    try { localStorage.setItem(ACK_KEY, JSON.stringify(Array.from(next))); } catch {}
    reactMutation.mutate({ signalId, type: 'fire' });
    toast({
      title: 'ACKNOWLEDGED',
      description: 'Signal received.',
      duration: 1800,
    });
  };

  const filteredSignals = signals.filter(signal => 
    activeFilter === 'all' || signal.exclusivityTier === activeFilter
  );

  const filters: Array<{ key: typeof activeFilter; label: string }> = [
    { key: 'all', label: 'ALL SIGNALS' },
    { key: 'members', label: 'INTEL' },
    { key: 'icons', label: 'INSIDER' },
    { key: 'inner_circle', label: 'EXCLUSIVE' }
  ];

  return (
    <>
      <SEO 
        title="Signal | SAINTE"
        description="Real-time intel and insights for SAINTE members"
      />
      
      <div className="min-h-screen pb-24 safe-area-top app-ground">
        <div 
          className="relative px-5 pt-12 pb-8"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(12,23,18,0.4) 0%, rgba(12,23,18,0.9) 60%, rgba(12,23,18,1) 100%), url(${tunnelImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUp()}
          >
            <span className="font-condensed text-[10px] tracking-[0.3em] text-crimson uppercase">
              NIGHT SHIFT
            </span>
            <h1 className="status-exclusive text-3xl font-black text-white mt-2">
              SIGNAL
            </h1>
            <p className="text-sm text-silver/70 mt-2 max-w-sm">
              Intel from the inside. Stories and insights you won't find anywhere else.
            </p>
          </motion.div>
        </div>

        <div className="px-5 py-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filters.map(filter => (
              <Button
                key={filter.key}
                onClick={() => {
                  hapticLight();
                  setActiveFilter(filter.key);
                }}
                className={`
                  px-4 py-2 rounded-xl font-condensed text-[10px] tracking-wider uppercase whitespace-nowrap
                  ${activeFilter === filter.key 
                    ? 'bg-crimson text-white' 
                    : 'bg-charcoal text-steel hover:text-white border border-graphite'
                  }
                `}
                data-testid={`filter-${filter.key}`}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="px-5 space-y-4">
          {isLoading ? (
            <EditorialLoading
              serial="SAINTE / SIG / —"
              label="loading"
              testId="loading-signals"
            />
          ) : error ? (
            <EditorialEmpty
              serial="SAINTE / SIG / ERR"
              label="unable to load"
              testId="error-signals"
            />
          ) : filteredSignals.length === 0 ? (
            <EditorialEmpty
              serial="SAINTE / SIG / 00"
              label="no signals available"
              testId="empty-signals"
            />
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredSignals.map((signal, index) => (
                <SignalCard 
                  key={signal.id} 
                  signal={signal} 
                  index={index}
                  onReact={(signalId, type) => reactMutation.mutate({ signalId, type })}
                  onAcknowledge={handleAcknowledge}
                  isAcknowledged={acknowledged.has(signal.id)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  );
}
