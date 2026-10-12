import { useAuth } from '@/contexts/AuthContext';
import { useMembershipKey } from '@/hooks/useNightShift';
import { motion } from 'framer-motion';
import { fadeUp, SPRING, EASE } from '@/lib/motion';
import { Loader2, ChevronRight, Share2, Check, CreditCard, Clock } from 'lucide-react';
import { Icons3D } from '@/lib/icons3d';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useLocation } from 'wouter';
import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Icon3DImage } from '@/lib/icons3d';
import { hapticSuccess, hapticMedium } from '@/lib/haptics';
import bgImage from "@assets/68769442b06d1435e6e18a9f_cover11_1764759126395.png";

const TIER_CONFIG = {
  founder: {
    bg: 'bg-amber-950',
    cardClass: 'matte-3d-crimson',
    border: 'border-amber-600/60',
    accent: 'text-amber-400',
    badge: 'premium-chip-crimson',
    highlight: 'bg-amber-400/15',
    icon: 'crown' as const,
    label: 'FOUNDER',
    statusLabel: 'FOUNDER STATUS',
    verifiedBadge: 'ICON STATUS',
  },
  icon: {
    bg: 'bg-charcoal',
    cardClass: 'matte-3d-crimson',
    border: 'border-crimson/60',
    accent: 'text-crimson',
    badge: 'premium-chip-crimson',
    highlight: 'bg-crimson/15',
    icon: 'flame' as const,
    label: 'ICON',
    statusLabel: 'ICON',
    verifiedBadge: 'ICON STATUS',
  },
  vip: {
    bg: 'bg-slate-800',
    cardClass: 'matte-3d-crimson',
    border: 'border-slate-400/50',
    accent: 'text-slate-200',
    badge: 'premium-chip',
    highlight: 'bg-slate-300/10',
    icon: 'medal' as const,
    label: 'VIP',
    statusLabel: 'VIP',
    verifiedBadge: 'VERIFIED MEMBER',
  },
  member: {
    bg: 'bg-graphite',
    cardClass: 'matte-3d',
    border: 'border-silver/30',
    accent: 'text-silver',
    badge: 'premium-chip',
    highlight: 'bg-silver/10',
    icon: 'heart' as const,
    label: 'MEMBER',
    statusLabel: 'MEMBER',
    verifiedBadge: 'VERIFIED MEMBER',
  },
};

const cardRevealVariants = {
  hidden: { 
    opacity: 0, 
    y: 40, 
    scale: 0.92,
    rotateX: 20 
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    rotateX: 0,
    transition: {
      ...SPRING.sheet,
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const staggerChildVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: SPRING.sheet
  }
};

export default function MembershipCard() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [tokenExpiry, setTokenExpiry] = useState<string>('');

  const { data: membership, isLoading, error, isError } = useMembershipKey();
  
  const noMembership = isError || (!isLoading && !membership);

  useEffect(() => {
    if (membership?.qrData?.expiresAt) {
      const updateExpiry = () => {
        const now = new Date();
        const expiry = new Date(membership.qrData.expiresAt);
        const diff = expiry.getTime() - now.getTime();
        
        if (diff <= 0) {
          setTokenExpiry('EXPIRED');
          return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
          setTokenExpiry(`${hours}h ${minutes}m`);
        } else {
          setTokenExpiry(`${minutes}m`);
        }
      };
      
      updateExpiry();
      const interval = setInterval(updateExpiry, 60000);
      return () => clearInterval(interval);
    }
  }, [membership?.qrData?.expiresAt]);

  const [, setLocation] = useLocation();

  const handleShare = useCallback(async () => {
    hapticMedium();
    const shareUrl = `${window.location.origin}/member/${membership?.card.serialNumber}`;
    const shareText = `I'm a ${membership?.card.tier.toUpperCase()} member at SAINTE. The inner circle awaits.`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SAINTE Membership',
          text: shareText,
          url: shareUrl,
        });
        hapticSuccess();
        toast({
          title: "Shared",
          description: "Your membership has been shared.",
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink(shareUrl);
        }
      }
    } else {
      handleCopyLink(shareUrl);
    }
  }, [membership, toast]);

  const handleCopyLink = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    hapticSuccess();
    toast({
      title: "Link copied",
      description: "Share link copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  }, [toast]);

  const handleQRTap = useCallback(() => {
    hapticMedium();
    if (membership?.qrData?.token) {
      navigator.clipboard.writeText(membership.qrData.token);
      hapticSuccess();
      toast({
        title: "Token Copied",
        description: "Access token copied to clipboard.",
      });
    }
  }, [membership, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center relative overflow-hidden p-6">
        <div className="absolute inset-0">
          <img src={bgImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/75 to-black/90" />
        </div>
        <div className="absolute inset-0 pointer-events-none grain-overlay" />
        
        <div className="relative z-10 w-full max-w-sm space-y-6">
          <div className="text-center mb-8">
            <Skeleton className="h-8 w-40 mx-auto bg-smoke/30" />
            <Skeleton className="h-3 w-24 mx-auto mt-2 bg-smoke/20" />
          </div>
          
          <Skeleton 
            className="w-full aspect-[1.586/1] rounded-2xl of-resin of-card-lift matte-3d" 
            data-testid="skeleton-card"
          />
          
          <div className="flex justify-center">
            <Skeleton className="w-40 h-40 rounded-xl bg-smoke/30" />
          </div>
          
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin text-crimson mx-auto" />
            <p className="font-condensed text-xs tracking-[0.2em] text-muted mt-2">LOADING CARD...</p>
          </div>
        </div>
      </div>
    );
  }

  if (noMembership) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={bgImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/75 to-black/90" />
        </div>
        <div className="absolute inset-0 pointer-events-none grain-overlay" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl of-resin of-card-lift matte-3d flex items-center justify-center">
            <CreditCard className="h-10 w-10 text-silver/40" />
          </div>
          <h2 className="font-condensed text-xl tracking-[0.15em] text-white mb-2">
            NO MEMBERSHIP CARD
          </h2>
          <p className="text-silver text-sm mb-8 max-w-xs mx-auto">
            {isAuthenticated 
              ? "Generate your exclusive membership card to access SAINTE events and perks."
              : "Sign in to generate your membership card."
            }
          </p>
          
          {isAuthenticated ? (
            <Button 
              className="btn-glass group gap-2"
              onClick={() => setLocation('/request-invite')}
              data-testid="button-request-membership"
            >
              <CreditCard className="h-4 w-4" />
              REQUEST MEMBERSHIP
            </Button>
          ) : (
            <Link href="/login">
              <Button 
                className="btn-glass group"
                data-testid="button-sign-in"
              >
                SIGN IN
                <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          )}
        </motion.div>
      </div>
    );
  }

  if (!membership) return null;

  const tierKey = membership.card.tier as keyof typeof TIER_CONFIG;
  const config = TIER_CONFIG[tierKey] || TIER_CONFIG.member;
  const isIconTier = tierKey === 'icon' || tierKey === 'founder';
  const memberDate = new Date(membership.card.memberSince);
  const formattedDate = memberDate.toLocaleDateString('en-US', { 
    month: 'short', 
    year: 'numeric' 
  });

  return (
    <div className="page-container bg-void relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={bgImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/75 to-black/90" />
      </div>
      
      <div className="page-content p-6 relative z-10 overflow-visible">
        <div className="absolute inset-0 pointer-events-none grain-overlay" />

        <motion.header 
          className="text-center mb-6 relative"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp()}
        >
          <span className="status-exclusive">MEMBERSHIP</span>
          <div className="mt-3">
            <span className="issue-serial" data-testid="text-header-serial">
              SAINTE / VOL 04 / NO {membership.card.serialNumber}
            </span>
          </div>
        </motion.header>

        <motion.div
          variants={cardRevealVariants}
          initial="hidden"
          animate="visible"
          className="perspective-1000 relative z-10"
        >
          <motion.div 
            className={`
              relative mx-auto max-w-sm aspect-[1.586/1] rounded-2xl p-6
              ${config.cardClass}
              overflow-hidden
            `}
            data-testid="card-membership"
          >
            <div className={`absolute top-0 left-0 right-0 h-12 ${config.highlight} rounded-t-2xl`} />
            
            <div className="absolute inset-0 opacity-20 grid-pattern" />
            
            <motion.div 
              className="absolute top-4 right-4 w-16 h-16 opacity-30"
              variants={staggerChildVariants}
            >
              <Icon3DImage icon={config.icon} size={64} />
            </motion.div>

            <div className="relative h-full flex flex-col justify-between z-10">
              <motion.div 
                className="flex justify-between items-start"
                variants={staggerChildVariants}
              >
                <div>
                  <h2 className="text-broken-display text-xl tracking-[0.3em] text-white">SAINTE</h2>
                  <p className="font-condensed text-[8px] tracking-[0.5em] text-silver/50 quote-marks">
                    MEMBERS ONLY
                  </p>
                </div>
                <div className={config.badge}>
                  {isIconTier ? (
                    <span className="status-exclusive">{config.statusLabel}</span>
                  ) : (
                    config.label
                  )}
                </div>
              </motion.div>

              <motion.div 
                className="flex justify-between items-end"
                variants={staggerChildVariants}
              >
                <div className="space-y-2">
                  <p 
                    className="text-lg font-semibold tracking-wide text-white"
                    data-testid="text-member-name"
                  >
                    {membership.member.displayName || 'MEMBER'}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="serial-tape" data-testid="text-serial-number">
                      {membership.card.serialNumber}
                    </span>
                    <span className="serial-tape">
                      {formattedDate}
                    </span>
                  </div>
                </div>
                
                <motion.div 
                  className="text-right"
                  variants={staggerChildVariants}
                >
                  <div className={`${config.badge} mb-2`}>
                    <img src={Icons3D.verified} alt="" aria-hidden className="w-3.5 h-3.5 object-contain icon-shadow-subtle" />
                    {config.verifiedBadge}
                  </div>
                  <div className="flex items-center gap-1 justify-end mb-1">
                    <img src={Icons3D.star} alt="" aria-hidden className="w-4 h-4 object-contain icon-shadow-subtle" />
                    <span className={`font-stats text-sm font-bold ${config.accent}`}>
                      LVL {membership.member.level}
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div 
          className="mt-8 text-center relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...SPRING.sheet, delay: 0.4 }}
        >
          <div className="inline-block">
            <div 
              className="bg-white p-4 rounded-xl cursor-pointer border-4 border-smoke/20"
              style={{
                boxShadow: `
                  0 0 0 2px hsl(var(--mint-300) / 0.2),
                  0 2px 0 rgba(255,255,255,0.8) inset,
                  0 -2px 0 rgba(0,0,0,0.1) inset,
                  0 8px 24px rgba(0,0,0,0.4),
                  0 16px 48px rgba(0,0,0,0.3)
                `
              }}
              onClick={handleQRTap}
              data-testid="qr-code-container"
            >
              <QRCodeDisplay value={membership.qrData.token} size={160} />
            </div>
          </div>
          
          <p className="text-gray text-xs mt-4 tracking-wide font-condensed">
            TAP TO COPY • PRESENT FOR EXCLUSIVE ACCESS
          </p>
          
          {tokenExpiry && (
            <div className={`scarcity-timer mx-auto mt-4 ${tokenExpiry === 'EXPIRED' ? 'urgent' : ''}`}>
              <Clock className="w-4 h-4" />
              TOKEN {tokenExpiry === 'EXPIRED' ? 'EXPIRED' : `VALID: ${tokenExpiry}`}
            </div>
          )}
        </motion.div>

        <motion.div 
          className="mt-6 flex justify-center gap-3 relative z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp(0.6)}
        >
          <Button
            variant="outline"
            className="gap-2 border-smoke/30 text-silver hover:text-white hover:border-crimson/50"
            onClick={handleShare}
            data-testid="button-share-card"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                COPIED
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                SHARE CARD
              </>
            )}
          </Button>
        </motion.div>

        <motion.div 
          className="mt-8 max-w-sm mx-auto space-y-3 relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp(0.5)}
        >
          <div className="matte-surface p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isIconTier ? 'bg-mint-200/15' : 'bg-smoke/30'}`}>
                  <img src={Icons3D.sparkles} alt="" aria-hidden className="w-6 h-6 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Check-ins</p>
                  <p className="text-xs text-gray">Event attendance record</p>
                </div>
              </div>
              <div className={config.badge}>
                {membership.card.totalCheckins ?? 0}
              </div>
            </div>
          </div>

          <div className="matte-surface p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isIconTier ? 'bg-mint-200/15' : 'bg-smoke/30'}`}>
                  <img src={Icons3D.star} alt="" aria-hidden className="w-6 h-6 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">CRED Balance</p>
                  <p className="text-xs text-gray">Your reputation score</p>
                </div>
              </div>
              <div className={`${isIconTier ? 'premium-chip-crimson' : 'premium-chip'} text-lg font-bold`}>
                {membership.member.credBalance.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="matte-surface p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isIconTier ? 'bg-mint-200/15' : 'bg-smoke/30'}`}>
                  <img src={Icons3D.calendar} alt="" aria-hidden className="w-6 h-6 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Member Since</p>
                  <p className="text-xs text-gray">Access granted to all member events</p>
                </div>
              </div>
              <span className="serial-tape">
                {formattedDate}
              </span>
            </div>
          </div>

          <div className="matte-surface p-4 rounded-xl">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isIconTier ? 'bg-mint-200/15' : 'bg-smoke/30'}`}>
                <img src={Icons3D.crown} alt="" aria-hidden className="w-6 h-6 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Member Privileges</p>
                <p className="text-xs text-gray">Present for exclusive access</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function QRCodeDisplay({ value, size }: { value: string; size: number }) {
  const encodedValue = encodeURIComponent(value);
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedValue}&bgcolor=ffffff&color=000000&margin=0`;
  
  return (
    <img 
      src={qrApiUrl}
      alt="Membership QR Code"
      width={size}
      height={size}
      className="block"
      data-testid="img-qr-code"
    />
  );
}
