import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Icons3D } from "@/lib/icons3d";
import { playCommit, playRise, playSignalIn, playClick } from "@/lib/useSound";

// Streetwear celebration types - think sneaker drops, not SaaS gamification
type CelebrationType = 
  | "secured"      // You got the drop - Supreme W energy
  | "streak"       // Consistency = credibility  
  | "level_up"     // Status elevation - VIP rope drop
  | "access"       // Exclusive access granted
  | "verified"     // Circle verified - elite status
  | "badge_unlock" // Badge/achievement unlocked
  | "confetti";    // Pure confetti celebration

interface CelebrationConfig {
  type: CelebrationType;
  value?: number;
  label?: string;
  sublabel?: string;
  showConfetti?: boolean;
}

interface CelebrationContextType {
  celebrate: (config: CelebrationConfig) => void;
  isActive: boolean;
}

const CelebrationContext = createContext<CelebrationContextType | null>(null);

// Global celebration trigger for use outside React components
let globalCelebrateFn: ((config: CelebrationConfig) => void) | null = null;

// Embers — Organic Futurism replaces rainbow confetti. Soft mint + fog
// motes drift UPWARD from bottom-third like resin smoke / firefly haze.
// Never lime. Never red. Never high-saturation.
const EMBER_COLORS = ['#E6FFE8', '#A7E9BC', '#F6F8F7', '#D9FBD9'];

interface ConfettiParticle {
  id: number;
  x: number;            // 0-100 horizontal start (%)
  startY: number;       // 0-100 vertical start (%) — bottom third only
  color: string;        // mint or fog
  size: number;         // 3-8 px
  drift: number;        // -40..40 horizontal drift (px) at peak
  delay: number;        // stagger 0-1.5s
  duration: number;     // 2.4-4.2s rise
  opacity: number;      // 0.5-0.85 peak
}

// Generate ember particles — limited count for the matte aesthetic.
function generateConfettiParticles(count: number = 32): ConfettiParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    startY: 70 + Math.random() * 25,
    color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
    size: Math.random() * 5 + 3,
    drift: (Math.random() - 0.5) * 80,
    delay: Math.random() * 1.4,
    duration: Math.random() * 1.8 + 2.4,
    opacity: 0.5 + Math.random() * 0.35,
  }));
}

// Sound effect trigger point - can be connected to audio system
export function triggerSoundEffect(type: 'confetti' | 'levelup' | 'badge' | 'streak' | 'success') {
  // Wired to the Organic Futurism mil-spec sound layer. Honors the global
  // sound toggle, visibility, and prefers-reduced-motion gates inside useSound.
  switch (type) {
    case 'levelup':  void playRise(); break;
    case 'badge':    void playSignalIn(); break;
    case 'streak':   void playClick(); break;
    case 'success':
    case 'confetti':
    default:         void playCommit(); break;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('celebration-sound', { detail: { type } }));
  }
}

// Haptic patterns - not gamey, more like Sneaker Pass push alerts
function triggerHaptic(type: CelebrationType) {
  if (!("vibrate" in navigator)) return;
  
  const patterns: Record<CelebrationType, number[]> = {
    secured: [50, 30, 80],
    streak: [20, 10, 20],
    level_up: [30, 50, 30, 50, 100],
    access: [100],
    verified: [40, 80, 40],
    badge_unlock: [25, 40, 25, 40, 80],
    confetti: [30, 20, 30],
  };
  
  try {
    navigator.vibrate(patterns[type] || [50]);
  } catch {
    // Haptics not available
  }
}

// Generate a fake serial/SKU number for that Off-White aesthetic
function generateSerial() {
  const prefix = ["ST", "NX", "XC", "VIP"][Math.floor(Math.random() * 4)];
  const num = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `${prefix}-${num}`;
}

// ============================================================================
// CONFETTI COMPONENT - Premium falling particles
// ============================================================================
function ConfettiOverlay({ 
  particleCount = 45,
  duration = 4000,
  onComplete 
}: { 
  particleCount?: number;
  duration?: number;
  onComplete?: () => void;
}) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const particles = useMemo(
    () => generateConfettiParticles(reducedMotion ? 0 : particleCount),
    [particleCount, reducedMotion],
  );
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;

  useEffect(() => {
    triggerSoundEffect('confetti');
    const timer = setTimeout(() => {
      onComplete?.();
    }, reducedMotion ? 0 : duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div className="fixed inset-0 z-[99] pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.startY}%`,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
          }}
          initial={{
            y: 0,
            x: 0,
            opacity: 0,
            scale: 0.4,
          }}
          animate={{
            y: -viewportH * 0.85,
            x: [0, particle.drift * 0.6, particle.drift],
            opacity: [0, particle.opacity, particle.opacity * 0.7, 0],
            scale: [0.4, 1, 1, 0.7],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: [0.25, 0.1, 0.25, 1],
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// CELEBRATION OVERLAY COMPONENT - Confetti + centered message
// ============================================================================
export function CelebrationOverlay({
  message,
  sublabel,
  showConfetti = true,
  onComplete,
  children,
}: {
  message?: string;
  sublabel?: string;
  showConfetti?: boolean;
  onComplete?: () => void;
  children?: React.ReactNode;
}) {
  const [confettiComplete, setConfettiComplete] = useState(!showConfetti);
  const serial = useRef(generateSerial());

  const handleConfettiComplete = useCallback(() => {
    setConfettiComplete(true);
  }, []);

  const handleDismiss = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-void/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={handleDismiss}
      data-testid="celebration-overlay"
    >
      {showConfetti && (
        <ConfettiOverlay onComplete={handleConfettiComplete} />
      )}
      
      {/* Corner markers */}
      {['top-6 left-6', 'top-6 right-6 rotate-90', 'bottom-6 left-6 -rotate-90', 'bottom-6 right-6 rotate-180'].map((pos, i) => (
        <motion.div
          key={i}
          className={`absolute ${pos} w-6 h-6`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 0.1 + i * 0.05 }}
        >
          <div className="absolute top-0 left-0 w-full h-[1px] bg-white/50" />
          <div className="absolute top-0 left-0 w-[1px] h-full bg-white/50" />
        </motion.div>
      ))}

      {/* Serial number */}
      <motion.div
        className="absolute top-4 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 0.4, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-[9px] tracking-[0.4em] font-mono text-silver">
          {serial.current}
        </p>
      </motion.div>

      {/* Main content with scale-in animation */}
      <motion.div
        className="relative text-center px-8 z-10"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 25,
          delay: 0.15 
        }}
      >
        {children}
        
        {message && (
          <>
            <motion.h1
              className="text-3xl md:text-4xl font-black tracking-tight leading-none mb-3 text-white"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              {message}
            </motion.h1>
            
            {sublabel && (
              <motion.p
                className="text-sm tracking-wide text-silver"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                "{sublabel}"
              </motion.p>
            )}
          </>
        )}
      </motion.div>

      {/* Close button */}
      <motion.button
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        className="absolute top-6 right-6 z-20 p-2 rounded-full"
        style={{ background: 'rgba(255,255,255,0.08)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        data-testid="button-close-celebration-overlay"
      >
        <X className="w-4 h-4 text-white/60" />
      </motion.button>

      {/* Tap to dismiss */}
      <motion.p
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.2em] uppercase text-silver/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Tap anywhere
      </motion.p>
    </motion.div>
  );
}

// ============================================================================
// STANDALONE TRIGGER FUNCTIONS - Can be called from anywhere
// ============================================================================

/**
 * Trigger confetti animation only
 */
export function triggerConfetti() {
  if (globalCelebrateFn) {
    globalCelebrateFn({ type: 'confetti', showConfetti: true });
  }
  triggerHaptic('confetti');
  triggerSoundEffect('confetti');
}

/**
 * Trigger level up celebration with confetti
 */
export function triggerLevelUp(level: number) {
  if (globalCelebrateFn) {
    globalCelebrateFn({ type: 'level_up', value: level, showConfetti: true });
  }
  triggerHaptic('level_up');
  triggerSoundEffect('levelup');
}

/**
 * Trigger badge unlock celebration
 */
export function triggerBadgeUnlock(badgeName: string) {
  if (globalCelebrateFn) {
    globalCelebrateFn({ type: 'badge_unlock', label: badgeName, showConfetti: true });
  }
  triggerHaptic('badge_unlock');
  triggerSoundEffect('badge');
}

/**
 * Trigger streak milestone celebration
 */
export function triggerStreakMilestone(days: number) {
  if (globalCelebrateFn) {
    globalCelebrateFn({ type: 'streak', value: days, showConfetti: true });
  }
  triggerHaptic('streak');
  triggerSoundEffect('streak');
}

// ============================================================================
// CELEBRATION COMPONENTS
// ============================================================================

// Close button component for celebrations
function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute top-6 right-6 z-20 p-2 rounded-full"
      style={{ background: 'rgba(255,255,255,0.1)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      data-testid="button-close-celebration"
    >
      <X className="w-5 h-5 text-white/70" />
    </motion.button>
  );
}

// "SECURED" - The main drop secured celebration
function SecuredCelebration({ label, sublabel, showConfetti, onComplete }: { 
  label?: string;
  sublabel?: string;
  showConfetti?: boolean;
  onComplete: () => void;
}) {
  const serial = useRef(generateSerial());
  
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-void"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onComplete}
    >
      {showConfetti && <ConfettiOverlay />}
      <CloseButton onClick={onComplete} />
      
      {/* Scan lines - VHS/surveillance aesthetic */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,0.1) 2px,
            rgba(255,255,255,0.1) 4px
          )`,
        }}
      />

      {/* Corner markers - security cam / authentication feel */}
      {[
        'top-6 left-6',
        'top-6 right-6 rotate-90',
        'bottom-6 left-6 -rotate-90',
        'bottom-6 right-6 rotate-180'
      ].map((pos, i) => (
        <motion.div
          key={i}
          className={`absolute ${pos} w-8 h-8`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.1 + i * 0.05 }}
        >
          <div className="absolute top-0 left-0 w-full h-[2px] bg-white/60" />
          <div className="absolute top-0 left-0 w-[2px] h-full bg-white/60" />
        </motion.div>
      ))}

      {/* Serial number - Off-White style */}
      <motion.div
        className="absolute top-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 0.5, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-[10px] tracking-[0.3em] font-mono text-silver">
          {serial.current}
        </p>
      </motion.div>

      {/* Main content */}
      <div className="relative text-center px-8">
        {/* Status badge */}
        <motion.div
          className="mb-6"
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 15,
            delay: 0.1 
          }}
        >
          <div className="inline-block px-4 py-1 border border-crimson bg-crimson-subtle">
            <p className="text-[11px] tracking-[0.4em] font-bold text-crimson">
              "SECURED"
            </p>
          </div>
        </motion.div>

        {/* Main title - big, bold, unapologetic */}
        <motion.h1
          className="text-4xl font-black tracking-tight leading-none mb-3 text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {label || "MOVE COMPLETE"}
        </motion.h1>

        {/* Sublabel with quotation marks */}
        {sublabel && (
          <motion.p
            className="text-sm tracking-wide text-silver"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            "{sublabel}"
          </motion.p>
        )}

        {/* Accent line */}
        <motion.div
          className="mx-auto mt-8 h-[1px] bg-crimson"
          initial={{ width: 0 }}
          animate={{ width: 60 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        />

        {/* Tap to dismiss */}
        <motion.p
          className="mt-8 text-[10px] tracking-[0.2em] uppercase text-silver"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Tap anywhere
        </motion.p>
      </div>

      {/* Timestamp - bottom right */}
      <motion.div
        className="absolute bottom-8 right-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-[10px] font-mono tracking-wider text-white">
          {new Date().toLocaleTimeString('en-US', { hour12: false })}
        </p>
      </motion.div>
    </motion.div>
  );
}

// Premium 3D Clay Icon Container - PURE MATTE, NO GLOW, NO GLASS
function Clay3DIcon({ 
  children, 
  size = 280
}: { 
  children: React.ReactNode; 
  size?: number;
}) {
  return (
    <motion.div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      initial={{ scale: 0.5, rotateX: -15 }}
      animate={{ scale: 1, rotateX: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
    >
      {/* 3D Clay container - solid matte with layered shadows only */}
      <div
        className="absolute inset-0 rounded-[40px]"
        style={{
          background: '#1a1a1a',
          boxShadow: `
            0 4px 8px rgba(0,0,0,0.5),
            0 12px 24px rgba(0,0,0,0.6),
            0 24px 48px rgba(0,0,0,0.7),
            0 48px 96px rgba(0,0,0,0.8),
            inset 0 -3px 6px rgba(0,0,0,0.5)
          `,
          border: '2px solid #2a2a2a',
        }}
      />
      
      {/* Inner content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </motion.div>
  );
}

// STREAK - Consistency is credibility
function StreakCelebration({ value, showConfetti, onComplete }: { value: number; showConfetti?: boolean; onComplete: () => void }) {
  useEffect(() => {
    triggerSoundEffect('streak');
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-void"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
    >
      {showConfetti && <ConfettiOverlay />}
      <CloseButton onClick={onComplete} />
      
      <div className="text-center relative z-10 px-4 w-full max-w-sm">
        {/* Flame Icon - HUGE, NO CONTAINER */}
        <motion.div 
          className="mb-8"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
        >
          <motion.div
            animate={{ 
              scale: [1, 1.08, 1],
              rotate: [0, 3, -3, 0],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <img 
              src={Icons3D.fire} 
              alt="Streak Fire" 
              className="w-72 h-72 object-contain mx-auto"
            />
          </motion.div>
        </motion.div>

        {/* Day count - premium typography */}
        <motion.p
          className="font-stats text-8xl font-bold tracking-tight text-white"
          style={{ fontVariantNumeric: 'tabular-nums' }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {value}
        </motion.p>
        
        <motion.p
          className="font-condensed text-base tracking-[0.25em] mt-3 text-silver"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          DAY STREAK
        </motion.p>

        {/* Tag pill - matte elevated */}
        <motion.div
          className="mt-8 px-8 py-3 inline-block rounded-full matte-surface"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p className="font-condensed text-sm tracking-[0.15em] text-crimson whitespace-nowrap">
            "CONSISTENCY"
          </p>
        </motion.div>
        
        {/* Tap to dismiss */}
        <motion.p
          className="mt-10 text-[10px] tracking-[0.25em] uppercase text-silver/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Tap anywhere to continue
        </motion.p>
      </div>
    </motion.div>
  );
}

// LEVEL UP - Status elevation, VIP rope drop moment
function LevelUpCelebration({ value, showConfetti, onComplete }: { value: number; showConfetti?: boolean; onComplete: () => void }) {
  useEffect(() => {
    triggerSoundEffect('levelup');
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-void"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
    >
      {showConfetti && <ConfettiOverlay particleCount={55} />}
      <CloseButton onClick={onComplete} />

      <div className="text-center relative z-10 px-8">
        {/* 3D Crown Icon - HUGE HERO SIZE */}
        <motion.div className="mb-8">
          <Clay3DIcon size={320}>
            <motion.div
              animate={{ 
                rotateY: [0, 8, 0, -8, 0],
                scale: [1, 1.04, 1],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <img 
                src={Icons3D.crown} 
                alt="Crown" 
                className="w-48 h-48 object-contain"
              />
            </motion.div>
          </Clay3DIcon>
        </motion.div>

        {/* Level number - premium display, NO TEXT SHADOW */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 24 }}
        >
          <p className="font-condensed text-xs tracking-[0.4em] mb-2 text-silver">
            LEVEL
          </p>
          <p 
            className="font-stats text-9xl font-bold text-white"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </p>
        </motion.div>

        {/* Status tag - matte */}
        <motion.div
          className="mt-8 px-6 py-2.5 inline-block rounded-full relative matte-surface"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="font-condensed text-xs tracking-[0.3em] text-crimson">
            "STATUS ELEVATED"
          </p>
        </motion.div>
        
        {/* Tap to dismiss */}
        <motion.p
          className="mt-10 text-[10px] tracking-[0.25em] uppercase text-silver/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Tap anywhere to continue
        </motion.p>
      </div>
    </motion.div>
  );
}

// BADGE UNLOCK - Achievement unlocked celebration
function BadgeUnlockCelebration({ label, showConfetti, onComplete }: { label?: string; showConfetti?: boolean; onComplete: () => void }) {
  const serial = useRef(generateSerial());

  useEffect(() => {
    triggerSoundEffect('badge');
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-void"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
    >
      {showConfetti && <ConfettiOverlay particleCount={50} />}
      <CloseButton onClick={onComplete} />
      
      {/* Serial number */}
      <motion.div
        className="absolute top-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 0.4, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-[9px] tracking-[0.4em] font-mono text-silver">
          {serial.current}
        </p>
      </motion.div>

      <div className="text-center relative z-10 px-8">
        {/* Badge Icon with premium 3D container */}
        <motion.div className="mb-8">
          <Clay3DIcon size={280}>
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 350, 
                damping: 20,
                delay: 0.15
              }}
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.06, 1],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <img 
                  src={Icons3D.verified} 
                  alt="Badge" 
                  className="w-44 h-44 object-contain"
                />
              </motion.div>
            </motion.div>
          </Clay3DIcon>
        </motion.div>

        {/* UNLOCKED label */}
        <motion.div
          className="mb-4"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="inline-block px-5 py-1.5 border border-[#FFD700] bg-[#FFD700]/10 rounded-sm">
            <p className="text-[11px] tracking-[0.4em] font-bold text-[#FFD700]">
              "UNLOCKED"
            </p>
          </div>
        </motion.div>

        {/* Badge name - big and bold */}
        <motion.h1
          className="text-3xl md:text-4xl font-black tracking-tight leading-none mb-2 text-white"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          {label || "NEW BADGE"}
        </motion.h1>

        {/* Sublabel */}
        <motion.p
          className="text-sm tracking-wide text-silver"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
        >
          "Achievement Secured"
        </motion.p>

        {/* Gold accent line */}
        <motion.div
          className="mx-auto mt-8 h-[2px] rounded-full"
          style={{ backgroundColor: '#FFD700' }}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 80, opacity: 0.8 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        />
        
        {/* Tap to dismiss */}
        <motion.p
          className="mt-10 text-[10px] tracking-[0.25em] uppercase text-silver/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Tap anywhere to continue
        </motion.p>
      </div>
    </motion.div>
  );
}

// CONFETTI ONLY - Pure celebration without content
function ConfettiCelebration({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[99] pointer-events-none">
      <ConfettiOverlay particleCount={60} duration={3500} />
    </div>
  );
}

// ACCESS - Exclusive access granted, rope drop moment
function AccessCelebration({ label, showConfetti, onComplete }: { label?: string; showConfetti?: boolean; onComplete: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-void"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
    >
      {showConfetti && <ConfettiOverlay />}
      <CloseButton onClick={onComplete} />
      
      <div className="text-center px-8 relative z-10">
        {/* 3D Zap Icon - HUGE HERO SIZE */}
        <motion.div className="mb-8">
          <Clay3DIcon size={300}>
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <img 
                src={Icons3D.zap} 
                alt="Access" 
                className="w-48 h-48 object-contain"
              />
            </motion.div>
          </Clay3DIcon>
        </motion.div>

        {/* Access text - premium styled */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 24 }}
        >
          <p className="font-condensed text-4xl tracking-[0.2em] text-crimson mb-1">
            ACCESS
          </p>
          <p className="font-condensed text-2xl tracking-[0.25em] text-crimson/80">
            GRANTED
          </p>
        </motion.div>

        {/* What they got access to */}
        {label && (
          <motion.div
            className="mt-8 px-5 py-2.5 inline-block rounded-full"
            style={{
              background: 'linear-gradient(175deg, rgba(30,30,30,0.9) 0%, rgba(18,18,18,0.95) 100%)',
              border: '1px solid rgba(80,80,80,0.3)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <p className="font-condensed text-sm tracking-[0.15em] text-silver">
              "{label}"
            </p>
          </motion.div>
        )}
        
        {/* Tap to dismiss */}
        <motion.p
          className="mt-10 text-[10px] tracking-[0.25em] uppercase text-silver/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Tap anywhere to continue
        </motion.p>
      </div>
    </motion.div>
  );
}

// VERIFIED - Circle verified, elite status confirmation
function VerifiedCelebration({ showConfetti, onComplete }: { showConfetti?: boolean; onComplete: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-void"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
    >
      {showConfetti && <ConfettiOverlay />}
      <CloseButton onClick={onComplete} />
      
      <div className="text-center relative z-10">
        {/* 3D Verified Icon - HUGE HERO SIZE */}
        <motion.div className="mb-8">
          <Clay3DIcon size={300}>
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
            >
              <img 
                src={Icons3D.verified} 
                alt="Verified" 
                className="w-48 h-48 object-contain"
              />
            </motion.div>
          </Clay3DIcon>
        </motion.div>

        {/* Verified tag - BIGGER, matte */}
        <motion.div
          className="px-8 py-3 inline-block rounded-full matte-surface"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 260, damping: 24 }}
        >
          <p className="font-condensed text-lg tracking-[0.3em] text-silver">
            "VERIFIED"
          </p>
        </motion.div>
        
        {/* Tap to dismiss */}
        <motion.p
          className="mt-10 text-[10px] tracking-[0.25em] uppercase text-silver/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Tap anywhere to continue
        </motion.p>
      </div>
    </motion.div>
  );
}

// Quick toast for small wins - not full screen
function QuickToast({ label, onComplete }: { label: string; onComplete: () => void }) {
  useEffect(() => {
    triggerSoundEffect('success');
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed top-6 left-1/2 z-[100] pointer-events-none"
      initial={{ x: '-50%', y: -20, opacity: 0 }}
      animate={{ x: '-50%', y: 0, opacity: 1 }}
      exit={{ x: '-50%', y: -10, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="px-5 py-2.5 flex items-center gap-3 bg-charcoal border border-crimson-medium">
        <div className="w-5 h-5 flex items-center justify-center border border-crimson">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#A7E9BC" strokeWidth={3}>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-sm font-medium tracking-wide text-white">
          {label}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [celebration, setCelebration] = useState<CelebrationConfig | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const celebrate = useCallback((config: CelebrationConfig) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Trigger haptic
    triggerHaptic(config.type);
    
    // Show celebration
    setCelebration(config);
    
    // Auto-dismiss for quick toasts only
    if (config.type === "secured" && !config.label) {
      timeoutRef.current = setTimeout(() => {
        setCelebration(null);
      }, 2500);
    }
  }, []);

  // Register global celebrate function for standalone triggers
  useEffect(() => {
    globalCelebrateFn = celebrate;
    return () => {
      globalCelebrateFn = null;
    };
  }, [celebrate]);

  const handleComplete = useCallback(() => {
    setCelebration(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const renderCelebration = () => {
    if (!celebration) return null;

    // Small wins get quick toast
    if (celebration.type === "secured" && !celebration.sublabel && (!celebration.label || celebration.label.length < 20)) {
      return (
        <QuickToast 
          key="toast"
          label={celebration.label || "SECURED"} 
          onComplete={handleComplete} 
        />
      );
    }

    switch (celebration.type) {
      case "confetti":
        return (
          <ConfettiCelebration
            key="confetti"
            onComplete={handleComplete}
          />
        );
      case "secured":
        return (
          <SecuredCelebration 
            key="secured"
            label={celebration.label}
            sublabel={celebration.sublabel}
            showConfetti={celebration.showConfetti}
            onComplete={handleComplete}
          />
        );
      case "streak":
        return (
          <StreakCelebration 
            key="streak"
            value={celebration.value || 1}
            showConfetti={celebration.showConfetti}
            onComplete={handleComplete}
          />
        );
      case "level_up":
        return (
          <LevelUpCelebration 
            key="level"
            value={celebration.value || 1}
            showConfetti={celebration.showConfetti}
            onComplete={handleComplete}
          />
        );
      case "badge_unlock":
        return (
          <BadgeUnlockCelebration
            key="badge"
            label={celebration.label}
            showConfetti={celebration.showConfetti}
            onComplete={handleComplete}
          />
        );
      case "access":
        return (
          <AccessCelebration 
            key="access"
            label={celebration.label}
            showConfetti={celebration.showConfetti}
            onComplete={handleComplete}
          />
        );
      case "verified":
        return (
          <VerifiedCelebration 
            key="verified"
            showConfetti={celebration.showConfetti}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <CelebrationContext.Provider value={{ celebrate, isActive: !!celebration }}>
      {children}
      <AnimatePresence mode="wait">
        {renderCelebration()}
      </AnimatePresence>
    </CelebrationContext.Provider>
  );
}

// Hook to trigger celebrations
export function useCelebration() {
  const context = useContext(CelebrationContext);
  if (!context) {
    throw new Error("useCelebration must be used within CelebrationProvider");
  }
  return context;
}
