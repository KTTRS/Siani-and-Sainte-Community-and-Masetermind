import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Icons3D, Icon3DImage } from "@/lib/icons3d";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMembershipKey } from "@/hooks/useNightShift";
import { haptic } from "@/lib/haptics";
import { EASE, SPRING, STEP, WEDGE } from "@/lib/motion";
import { playChime } from "@/lib/useSound";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import { SEO } from "@/components/SEO";
import bgImage from "@assets/generated_images/sainte_dark_abstract_1.png";

const STEP_HERO_ICON: Record<string, keyof typeof Icons3D> = {
  welcome: "crown",      // initiation into the inner circle
  domains: "sparkles",   // pick what matters — focus areas
  location: "location",  // geography / where you at
  siani: "chat",         // meet siani — conversation
};

function serialFromId(id: string | undefined): string {
  if (!id) return "0001";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  const n = (Math.abs(h) % 9999) + 1;
  return n.toString().padStart(4, "0");
}

const LIFE_DOMAINS = [
  { id: "housing", label: "HOUSING", description: "Safe, stable place to live", icon: "community" },
  { id: "health", label: "HEALTH", description: "Physical wellness & care", icon: "heart" },
  { id: "career", label: "CAREER", description: "Work & professional growth", icon: "trophy" },
  { id: "education", label: "EDUCATION", description: "Learning & skill building", icon: "sparkles" },
  { id: "financial", label: "FINANCIAL", description: "Money & financial security", icon: "crown" },
  { id: "mental_health", label: "MENTAL HEALTH", description: "Emotional well-being", icon: "heart" },
  { id: "family", label: "FAMILY", description: "Family connections & support", icon: "community" },
  { id: "community", label: "COMMUNITY", description: "Getting involved & giving back", icon: "community" },
] as const;

type OnboardingStep = "welcome" | "domains" | "location" | "siani" | "complete";

const STEPS: OnboardingStep[] = ["welcome", "domains", "location", "siani"];

export default function OnboardingRitual() {
  const [, setLocation] = useLocation();
  const { user, session, refreshProfile } = useAuth();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [zipCode, setZipCode] = useState("");
  const [sianiMessage, setSianiMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const currentStep = STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const tierLabel = useMemo(() => {
    const t = (user as any)?.profile?.tier ?? (user as any)?.tier ?? "member";
    return String(t).toUpperCase();
  }, [user]);
  const serial = useMemo(() => serialFromId((user as any)?.id ?? session?.user?.id), [user, session]);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 800);
    return () => clearTimeout(timer);
  }, [currentStepIndex]);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case "welcome":
        return true;
      case "domains":
        return selectedDomains.length > 0;
      case "location":
        return zipCode.length === 0 || zipCode.length === 5;
      case "siani":
        return true;
      default:
        return true;
    }
  }, [currentStep, selectedDomains, zipCode]);

  const handleNext = useCallback(async () => {
    if (!canProceed()) return;

    if (isLastStep) {
      setIsSubmitting(true);
      try {
        await apiRequest("POST", "/api/auth/onboarding/complete", {
          domains: selectedDomains,
          zipCode: zipCode.trim() || undefined,
          sianiMessage: sianiMessage.trim() || undefined,
        });

        await refreshProfile();

        await queryClient.invalidateQueries({ queryKey: ["/api/membership/card"] });

        playChime();
        setCompleted(true);
        // Single coordinated haptic fires inside WedgeReveal at WEDGE.haptic.

        setTimeout(() => {
          setLocation("/");
        }, 3600);
      } catch (error: any) {
        toast({
          title: "Something went wrong",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      haptic('click');
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [isLastStep, canProceed, selectedDomains, zipCode, sianiMessage, refreshProfile, setLocation, toast]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      haptic('soft');
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const handleSkip = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/onboarding/complete", {
        domains: [],
      });
      await refreshProfile();
      setLocation("/");
    } catch {
      setLocation("/");
    } finally {
      setIsSubmitting(false);
    }
  }, [refreshProfile, setLocation]);

  const toggleDomain = useCallback((domainId: string) => {
    haptic('tap');
    setSelectedDomains((prev) =>
      prev.includes(domainId) ? prev.filter((d) => d !== domainId) : [...prev, domainId]
    );
  }, []);

  if (completed) {
    return (
      <WedgeReveal
        fallbackTierLabel={tierLabel}
        fallbackSerial={serial}
        reduceMotion={!!reduceMotion}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-void overflow-hidden">
      <SEO title="Welcome to SAINTE" description="Your initiation into the inner circle" />

      <div className="absolute inset-0">
        <img src={bgImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/75 to-black/90" />
      </div>

      <div className="absolute inset-0 pointer-events-none grain-overlay opacity-30" />

      <button
        onClick={handleSkip}
        disabled={isSubmitting}
        className="absolute top-4 right-4 z-50 text-silver hover:text-white text-sm font-condensed tracking-wider transition-colors"
        data-testid="button-skip-onboarding"
      >
        SKIP
      </button>

      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={reduceMotion ? { opacity: 0 } : STEP.enter}
            animate={STEP.center}
            exit={reduceMotion ? { opacity: 0 } : STEP.exit}
            transition={reduceMotion ? { duration: 0 } : STEP.spring}
            className="w-full max-w-md"
          >
            {currentStep === "welcome" && <WelcomeStep reduceMotion={!!reduceMotion} />}
            {currentStep === "domains" && (
              <DomainsStep selected={selectedDomains} onToggle={toggleDomain} reduceMotion={!!reduceMotion} />
            )}
            {currentStep === "location" && (
              <LocationStep zipCode={zipCode} onZipChange={setZipCode} reduceMotion={!!reduceMotion} />
            )}
            {currentStep === "siani" && (
              <SianiStep message={sianiMessage} onMessageChange={setSianiMessage} reduceMotion={!!reduceMotion} />
            )}

            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { delay: STEP.delay.cta, duration: STEP.duration.cta, ease: EASE.out }}
              className="mt-8 flex flex-col gap-3"
            >
              <Button
                onClick={handleNext}
                disabled={isAnimating || isSubmitting || !canProceed()}
                className="btn-glass w-full text-white py-6 text-lg font-condensed tracking-wider"
                data-testid="button-onboarding-next"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">SETTING UP...</span>
                ) : isLastStep ? (
                  "ENTER THE CIRCLE"
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    CONTINUE
                    <ChevronRight className="w-5 h-5" />
                  </span>
                )}
              </Button>
              {currentStepIndex > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="text-silver hover:text-white font-condensed tracking-wider"
                  data-testid="button-onboarding-back"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  BACK
                </Button>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="flex gap-2">
            {STEPS.map((_, index) => (
              <motion.div
                key={index}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === currentStepIndex
                    ? "w-8 bg-crimson"
                    : index < currentStepIndex
                      ? "w-4 bg-crimson/50"
                      : "w-4 bg-silver/30"
                }`}
                animate={index === currentStepIndex ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5 }}
                data-testid={`indicator-step-${index}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroClay({ icon, reduceMotion, size = 96 }: { icon: keyof typeof Icons3D; reduceMotion: boolean; size?: number }) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { scale: 0.6, opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { ...SPRING.pop, delay: STEP.delay.hero }}
      className="mx-auto mb-8"
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full flex items-center justify-center matte-3d rounded-2xl">
        <Icon3DImage icon={icon} size={Math.round(size * 0.66)} />
      </div>
    </motion.div>
  );
}

function WelcomeStep({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="text-center">
      <HeroClay icon={STEP_HERO_ICON.welcome} reduceMotion={reduceMotion} size={104} />

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: STEP.delay.headline, duration: STEP.duration.headline, ease: EASE.out }}
      >
        <p className="font-condensed text-[11px] tracking-[0.35em] text-crimson mb-2">WELCOME TO</p>
        <h1 className="text-broken-display text-5xl text-white mb-6 quote-marks" data-testid="text-welcome-heading">
          THE INNER CIRCLE
        </h1>
      </motion.div>

      <motion.p
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: STEP.delay.body, duration: STEP.duration.body, ease: EASE.out }}
        className="text-silver text-base leading-relaxed max-w-sm mx-auto"
      >
        Let's set things up so I can actually help you. This takes about a minute.
      </motion.p>
    </div>
  );
}

function DomainsStep({ selected, onToggle, reduceMotion }: { selected: string[]; onToggle: (id: string) => void; reduceMotion: boolean }) {
  return (
    <div className="text-center">
      <HeroClay icon={STEP_HERO_ICON.domains} reduceMotion={reduceMotion} size={80} />

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: STEP.delay.headline, duration: STEP.duration.headline, ease: EASE.out }}
      >
        <p className="font-condensed text-[11px] tracking-[0.35em] text-crimson mb-2">WHAT MATTERS</p>
        <h1 className="text-broken-display text-4xl text-white mb-3" data-testid="text-domains-heading">
          YOUR FOCUS
        </h1>
        <p className="text-silver text-sm mb-6">
          Pick the areas of life you want to work on. Choose as many as you want.
        </p>
      </motion.div>

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: STEP.delay.body, duration: STEP.duration.body, ease: EASE.out }}
        className="grid grid-cols-2 gap-3 mb-4"
      >
        {LIFE_DOMAINS.map((domain) => {
          const isSelected = selected.includes(domain.id);
          return (
            <button
              key={domain.id}
              onClick={() => onToggle(domain.id)}
              className={`relative p-4 rounded-xl border transition-all duration-200 text-left ${
                isSelected
                  ? "border-crimson bg-crimson/15"
                  : "border-silver/20 bg-white/5 hover:border-silver/40"
              }`}
              data-testid={`button-domain-${domain.id}`}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2"
                >
                  <Check className="w-4 h-4 text-crimson" />
                </motion.div>
              )}
              <div className="w-8 h-8 mb-2">
                <Icon3DImage icon={domain.icon as keyof typeof Icons3D} size={32} />
              </div>
              <p className="font-condensed text-xs tracking-wider text-white mb-0.5">{domain.label}</p>
              <p className="text-[11px] text-silver/70">{domain.description}</p>
            </button>
          );
        })}
      </motion.div>

      {selected.length > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-crimson text-xs font-condensed tracking-wider"
          data-testid="text-domains-count"
        >
          {selected.length} SELECTED
        </motion.p>
      )}
    </div>
  );
}

function LocationStep({ zipCode, onZipChange, reduceMotion }: { zipCode: string; onZipChange: (val: string) => void; reduceMotion: boolean }) {
  return (
    <div className="text-center">
      <HeroClay icon={STEP_HERO_ICON.location} reduceMotion={reduceMotion} size={80} />

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: STEP.delay.headline, duration: STEP.duration.headline, ease: EASE.out }}
      >
        <p className="font-condensed text-[11px] tracking-[0.35em] text-crimson mb-2">WHERE YOU AT</p>
        <h1 className="text-broken-display text-4xl text-white mb-3" data-testid="text-location-heading">
          YOUR AREA
        </h1>
        <p className="text-silver text-sm mb-8">
          Your zip code helps us find real resources near you. This is optional.
        </p>
      </motion.div>

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: STEP.delay.body, duration: STEP.duration.body, ease: EASE.out }}
      >
        <Input
          value={zipCode}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 5);
            onZipChange(val);
          }}
          placeholder="ZIP CODE"
          inputMode="numeric"
          maxLength={5}
          className="bg-void border-crimson/30 text-white placeholder:text-silver/50 text-center font-condensed tracking-widest text-lg py-6"
          data-testid="input-zip-code"
        />
        {zipCode.length > 0 && zipCode.length < 5 && (
          <p className="text-crimson/80 text-xs mt-3" data-testid="text-zip-error">
            Enter a full 5-digit zip code
          </p>
        )}
        {(zipCode.length === 0 || zipCode.length === 5) && (
          <p className="text-silver/50 text-xs mt-3">
            Used for local resource matching only
          </p>
        )}
      </motion.div>
    </div>
  );
}

function SianiStep({ message, onMessageChange, reduceMotion }: { message: string; onMessageChange: (val: string) => void; reduceMotion: boolean }) {
  return (
    <div className="text-center">
      <HeroClay icon={STEP_HERO_ICON.siani} reduceMotion={reduceMotion} size={80} />

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: STEP.delay.headline, duration: STEP.duration.headline, ease: EASE.out }}
      >
        <p className="font-condensed text-[11px] tracking-[0.35em] text-crimson mb-2">MEET</p>
        <h1 className="text-broken-display text-4xl text-white mb-3" data-testid="text-siani-heading">
          SIANI
        </h1>
      </motion.div>

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: STEP.delay.body, duration: STEP.duration.body, ease: EASE.out }}
      >
        <p className="text-silver text-sm mb-4">
          What's the one thing you most want to change in your life right now? (optional)
        </p>
        <Textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder="I want to..."
          maxLength={500}
          rows={3}
          className="bg-void border-crimson/30 text-white placeholder:text-silver/50 font-condensed tracking-wide resize-none"
          data-testid="input-siani-message"
        />
        <p className="text-silver/50 text-xs mt-2">
          Siani will remember this and help you work toward it
        </p>
      </motion.div>
    </div>
  );
}

/**
 * Final crescendo: a wax-seal disc holds, splits into two wedges, and
 * exposes the member's assigned issue number. Single coordinated haptic
 * fires at the moment the seal cracks. Reduced-motion = instant cross-fade.
 */
const TIER_DIGIT: Record<string, string> = {
  FOUNDER: "01",
  ICON: "02",
  VIP: "03",
  MEMBER: "04",
};

function WedgeReveal({
  fallbackTierLabel,
  fallbackSerial,
  reduceMotion,
}: {
  fallbackTierLabel: string;
  fallbackSerial: string;
  reduceMotion: boolean;
}) {
  // Pull canonical assigned serial + tier from the member's membership key
  // so the reveal hands them the same identity used on TheDrop / MembershipCard.
  // Fall back to the locally-derived placeholder only when the card hasn't been
  // provisioned yet (e.g. a transient network failure during onboarding).
  const { data: membership } = useMembershipKey();
  const cardSerial = membership?.card?.serialNumber;
  const cardTier = membership?.card?.tier?.toUpperCase?.();

  const tierLabel = cardTier || fallbackTierLabel;
  const tierDigit = TIER_DIGIT[tierLabel] ?? "04";
  // Canonical serials look like "SN-SAINTE-XXXXX" / "STE-2026-XXXXX"; show the
  // trailing identifier on the hero line and the full serial on the footer tape.
  const serialFull = cardSerial || fallbackSerial;
  const serialShort = (cardSerial?.split("-").pop() || fallbackSerial).toUpperCase();

  useEffect(() => {
    if (reduceMotion) {
      haptic('success');
      return;
    }
    const t = window.setTimeout(() => haptic('success'), WEDGE.haptic * 1000);
    return () => window.clearTimeout(t);
  }, [reduceMotion]);

  const sealWedge = (side: 'left' | 'right') => {
    const isLeft = side === 'left';
    return (
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, hsl(var(--mint-200)) 0%, hsl(var(--mint-500)) 45%, hsl(var(--everglade-700)) 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 24px -8px hsl(var(--mint-300) / 0.55)',
          clipPath: isLeft
            ? 'polygon(0 0, 50% 0, 50% 100%, 0 100%)'
            : 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)',
          transformOrigin: isLeft ? '0% 50%' : '100% 50%',
        }}
        initial={reduceMotion ? { opacity: 0 } : { rotateY: 0, opacity: 1 }}
        animate={reduceMotion ? { opacity: 0 } : { rotateY: isLeft ? -110 : 110, opacity: [1, 1, 0] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { ...WEDGE.sealCrack, delay: WEDGE.sealHold, times: [0, 0.85, 1] }
        }
      />
    );
  };

  return (
    <div className="fixed inset-0 bg-void flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img src={bgImage} alt="" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/90 to-black" />
      </div>

      {!reduceMotion && (
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(199,255,62,0.42) 0%, rgba(199,255,62,0.14) 35%, rgba(0,0,0,0) 70%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ ...WEDGE.flash, delay: WEDGE.haptic - 0.15 }}
        />
      )}

      <div
        className="relative z-10 w-full max-w-md px-8"
        data-testid="text-onboarding-complete"
      >
        <motion.div
          className="absolute -top-16 left-8 right-8 flex items-center justify-between"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { delay: 0.2, duration: 0.4, ease: EASE.out }
          }
        >
          <span className="issue-serial">SAINTE</span>
          <span className="issue-serial">VOL · 04</span>
        </motion.div>

        <motion.div
          aria-hidden
          className="h-px bg-silver/20 mb-8"
          initial={reduceMotion ? { scaleX: 1 } : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          style={{ transformOrigin: 'left' }}
          transition={
            reduceMotion ? { duration: 0 } : { delay: 0.35, duration: 0.6, ease: EASE.out }
          }
        />

        <div className="relative flex items-end gap-4 mb-3">
          {/* Wedge/seal — sits in front of the issue number, cracks open */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 'clamp(160px, 42vw, 240px)',
              height: 'clamp(160px, 42vw, 240px)',
              perspective: 900,
            }}
          >
            {sealWedge('left')}
            {sealWedge('right')}
            {/* Etched ring + monogram on the unsplit seal */}
            <motion.div
              aria-hidden
              className="absolute inset-3 rounded-full flex items-center justify-center"
              style={{
                border: '1px dashed rgba(255,255,255,0.35)',
              }}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0.85 }}
              animate={reduceMotion ? { opacity: 0 } : { opacity: [0.85, 0.85, 0] }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: WEDGE.sealCrack.duration + WEDGE.sealHold, times: [0, 0.5, 1] }
              }
            >
              <span
                className="font-broken text-white/95"
                style={{ fontSize: 'clamp(40px, 11vw, 64px)', letterSpacing: '-0.04em' }}
              >
                S
              </span>
            </motion.div>
          </div>

          <motion.span
            className="font-broken text-white leading-none relative"
            style={{ fontSize: 'clamp(140px, 38vw, 220px)', letterSpacing: '-0.04em' }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={reduceMotion ? { duration: 0 } : WEDGE.numberReveal}
            data-testid="text-issue-number"
          >
            {tierDigit}
          </motion.span>
          <motion.span
            className="font-condensed text-silver/60 mb-6"
            style={{ fontSize: '20px', letterSpacing: '0.18em' }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reduceMotion ? { duration: 0 } : WEDGE.serialReveal}
          >
            / {serialShort}
          </motion.span>
        </div>

        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : WEDGE.footerReveal}
          className="flex items-center justify-between"
        >
          <span className="font-condensed text-[11px] tracking-[0.35em] text-white">
            {tierLabel}
          </span>
          <span className="issue-serial">
            SAINTE / {tierLabel.slice(0, 3)} / {serialFull}
          </span>
        </motion.div>
      </div>
    </div>
  );
}
