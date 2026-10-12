import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { playTap, playSoft, playCommit, playWarn } from "@/lib/useSound";

export const SPRING_CONFIG = {
  snappy: { stiffness: 400, damping: 25 },
  bouncy: { stiffness: 260, damping: 20 },
  smooth: { stiffness: 200, damping: 30 },
  premium: { stiffness: 260, damping: 24 },
};

export function triggerHaptic(type: "light" | "medium" | "heavy" | "success" | "error" | "selection") {
  // Sound cue is paired regardless of vibration support — desktops have no
  // vibrate API but should still get the mil-spec sound layer. The sound
  // helpers self-gate on global toggle / reduced-motion / visibility.
  switch (type) {
    case "success": void playCommit(); break;
    case "error":   void playWarn(); break;
    case "medium":
    case "heavy":   void playSoft(); break;
    case "light":
    case "selection":
    default:        void playTap(); break;
  }

  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;

  const patterns: Record<string, number[]> = {
    light: [10],
    medium: [25],
    heavy: [50],
    success: [30, 50, 80],
    error: [100, 50, 100],
    selection: [5],
  };

  try {
    navigator.vibrate(patterns[type] || [10]);
  } catch {
    // Haptics not available
  }
}

interface PressHoldButtonProps {
  onComplete: () => void;
  holdDuration?: number;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function PressHoldButton({
  onComplete,
  holdDuration = 800,
  children,
  className = "",
  disabled = false,
}: PressHoldButtonProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);
  const animationFrame = useRef<number>(0);

  const updateProgress = useCallback(() => {
    const elapsed = Date.now() - startTime.current;
    const newProgress = Math.min(elapsed / holdDuration, 1);
    setProgress(newProgress);

    if (newProgress >= 1) {
      triggerHaptic("success");
      onComplete();
      setIsHolding(false);
      setProgress(0);
    } else if (isHolding) {
      animationFrame.current = requestAnimationFrame(updateProgress);
    }
  }, [holdDuration, isHolding, onComplete]);

  const handleStart = useCallback(() => {
    if (disabled) return;
    setIsHolding(true);
    startTime.current = Date.now();
    triggerHaptic("selection");
    animationFrame.current = requestAnimationFrame(updateProgress);
  }, [disabled, updateProgress]);

  const handleEnd = useCallback(() => {
    setIsHolding(false);
    setProgress(0);
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  return (
    <motion.button
      className={`relative overflow-hidden ${className}`}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      disabled={disabled}
      animate={{
        scale: isHolding ? 0.97 : 1,
      }}
      transition={SPRING_CONFIG.snappy}
      data-testid="button-press-hold"
    >
      <motion.div
        className="absolute inset-0 bg-white/20 origin-left"
        style={{ scaleX: progress }}
        transition={{ duration: 0 }}
      />
      <span className="relative z-10">{children}</span>
      
      {isHolding && (
        <motion.div
          className="absolute inset-0 border-2 border-white/30 rounded-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </motion.button>
  );
}

interface ParticleBurstProps {
  trigger: boolean;
  particleCount?: number;
  size?: "sm" | "md" | "lg";
  colorClass?: string;
}

export function ParticleBurst({
  trigger,
  particleCount = 12,
  size = "md",
  colorClass = "bg-crimson",
}: ParticleBurstProps) {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    rotation: number;
  }>>([]);

  useEffect(() => {
    if (trigger) {
      const newParticles = Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * (size === "lg" ? 200 : size === "md" ? 150 : 100),
        y: (Math.random() - 0.5) * (size === "lg" ? 200 : size === "md" ? 150 : 100),
        rotation: Math.random() * 360,
      }));
      setParticles(newParticles);
      
      const timer = setTimeout(() => setParticles([]), 1000);
      return () => clearTimeout(timer);
    }
  }, [trigger, particleCount, size]);

  const particleSize = size === "lg" ? 8 : size === "md" ? 6 : 4;

  return (
    <AnimatePresence>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className={`absolute pointer-events-none rounded-full ${colorClass}`}
          style={{
            width: particleSize,
            height: particleSize,
          }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{
            x: particle.x,
            y: particle.y,
            scale: 0,
            opacity: 0,
            rotate: particle.rotation,
          }}
          exit={{ opacity: 0 }}
          transition={SPRING_CONFIG.smooth}
        />
      ))}
    </AnimatePresence>
  );
}

interface ElasticCounterProps {
  value: number;
  className?: string;
}

export function ElasticCounter({ value, className = "" }: ElasticCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [value, displayValue]);

  return (
    <motion.span
      className={className}
      animate={{
        scale: isAnimating ? [1, 1.3, 1] : 1,
        y: isAnimating ? [0, -4, 0] : 0,
      }}
      transition={SPRING_CONFIG.bouncy}
    >
      {displayValue}
    </motion.span>
  );
}

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  colorClass?: string;
  bgColorClass?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 4,
  colorClass = "stroke-crimson",
  bgColorClass = "stroke-white/10",
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const springProgress = useSpring(progress, SPRING_CONFIG.smooth);
  const strokeDashoffset = useTransform(
    springProgress,
    [0, 100],
    [circumference, 0]
  );

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={bgColorClass}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={colorClass}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

interface WobbleOnUpdateProps {
  value: unknown;
  children: React.ReactNode;
  className?: string;
}

export function WobbleOnUpdate({ value, children, className = "" }: WobbleOnUpdateProps) {
  const [key, setKey] = useState(0);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      setKey((k) => k + 1);
      prevValue.current = value;
    }
  }, [value]);

  return (
    <motion.div
      key={key}
      className={className}
      initial={{ scale: 1 }}
      animate={{
        scale: [1, 1.08, 0.95, 1.02, 1],
        rotate: [0, 2, -2, 1, 0],
      }}
      transition={{
        duration: 0.5,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
}

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}

export function MagneticButton({ children, className = "", strength = 0.3 }: MagneticButtonProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const ref = useRef<HTMLButtonElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * strength);
    y.set((e.clientY - centerY) * strength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const springX = useSpring(x, SPRING_CONFIG.snappy);
  const springY = useSpring(y, SPRING_CONFIG.snappy);

  return (
    <motion.button
      ref={ref}
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  );
}

interface PulseRingProps {
  active: boolean;
  colorClass?: string;
  size?: number;
}

export function PulseRing({ active, colorClass = "border-crimson", size = 100 }: PulseRingProps) {
  return (
    <AnimatePresence>
      {active && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`absolute rounded-full pointer-events-none border-2 ${colorClass}`}
              style={{
                width: size,
                height: size,
                left: "50%",
                top: "50%",
                marginLeft: -size / 2,
                marginTop: -size / 2,
              }}
              initial={{ scale: 0.5, opacity: 0.8 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.6,
                ease: "easeOut",
              }}
            />
          ))}
        </>
      )}
    </AnimatePresence>
  );
}

interface FloatingIconProps {
  icon: string;
  size?: "sm" | "md" | "lg" | "xl";
  intensity?: "subtle" | "normal" | "dramatic";
  className?: string;
}

export function FloatingIcon({ 
  icon, 
  size = "md", 
  intensity = "normal",
  className = "" 
}: FloatingIconProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-20 h-20",
    xl: "w-32 h-32",
  };

  const floatRange = {
    subtle: { y: [-2, 2], rotate: [-1, 1], scale: [1, 1.02] },
    normal: { y: [-4, 4], rotate: [-3, 3], scale: [1, 1.05] },
    dramatic: { y: [-8, 8], rotate: [-5, 5], scale: [1, 1.1] },
  };

  const range = floatRange[intensity];

  return (
    <motion.div
      className={`flex items-center justify-center ${className}`}
      animate={{
        y: range.y,
        rotate: range.rotate,
        scale: range.scale,
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut",
      }}
    >
      <img 
        src={icon} 
        alt="" 
        className={`${sizeClasses[size]} object-contain icon-shadow`}
      />
    </motion.div>
  );
}

interface ElasticProgressBarProps {
  value: number;
  max: number;
  colorClass?: string;
  bgColorClass?: string;
  height?: number;
  showLabel?: boolean;
  labelFormatter?: (value: number, max: number) => string;
  className?: string;
  onComplete?: () => void;
}

export function ElasticProgressBar({
  value,
  max,
  colorClass = "bg-crimson",
  bgColorClass = "bg-white/10",
  height = 8,
  showLabel = false,
  labelFormatter = (v, m) => `${v}/${m}`,
  className = "",
  onComplete,
}: ElasticProgressBarProps) {
  const progress = Math.min((value / max) * 100, 100);
  const springProgress = useSpring(progress, SPRING_CONFIG.bouncy);
  const scaleY = useTransform(springProgress, (p) => {
    const delta = Math.abs(p - progress);
    return 1 + delta * 0.02;
  });

  const prevProgress = useRef(progress);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (progress > prevProgress.current) {
      setIsAnimating(true);
      if (progress >= 100 && onComplete) {
        onComplete();
      }
      setTimeout(() => setIsAnimating(false), 500);
    }
    prevProgress.current = progress;
  }, [progress, onComplete]);

  return (
    <div className={`relative ${className}`}>
      <motion.div
        className={`relative w-full rounded-full overflow-hidden ${bgColorClass}`}
        style={{ height }}
        animate={isAnimating ? {
          scaleY: [1, 1.15, 0.9, 1.05, 1],
        } : {}}
        transition={SPRING_CONFIG.bouncy}
      >
        <motion.div
          className={`absolute left-0 top-0 h-full rounded-full ${colorClass}`}
          style={{ width: `${progress}%` }}
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={SPRING_CONFIG.smooth}
        >
          <motion.div
            className="absolute inset-0 rounded-full progress-bar-shine"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </motion.div>
      </motion.div>
      
      {showLabel && (
        <motion.span
          className="absolute right-0 top-full mt-1 text-xs text-steel-400 font-mono"
          animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
          transition={SPRING_CONFIG.snappy}
        >
          {labelFormatter(value, max)}
        </motion.span>
      )}
    </div>
  );
}

interface LevelUpIndicatorProps {
  level: number;
  show: boolean;
  onAnimationComplete?: () => void;
}

export function LevelUpIndicator({ level, show, onAnimationComplete }: LevelUpIndicatorProps) {
  return (
    <AnimatePresence onExitComplete={onAnimationComplete}>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex flex-col items-center gap-4"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ 
              scale: [0.5, 1.2, 1],
              opacity: [0, 1, 1],
            }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{
              duration: 0.8,
              times: [0, 0.6, 1],
              ease: "easeOut",
            }}
          >
            <div className="text-center">
              <motion.p
                className="text-steel-400 text-sm uppercase tracking-[0.2em] mb-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Level Up
              </motion.p>
              <motion.div
                className="text-7xl font-bold text-white font-space"
                initial={{ scale: 0 }}
                animate={{ 
                  scale: [0, 1.3, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  delay: 0.3,
                  duration: 0.6,
                  ease: "easeOut",
                }}
              >
                {level}
              </motion.div>
            </div>
            
            <ParticleBurst trigger={show} colorClass="bg-crimson" particleCount={20} size="lg" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useRipple() {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const addRipple = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    
    setRipples((prev) => [...prev, { id, x, y }]);
    triggerHaptic("light");
    
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
  }, []);

  const RippleContainer = useCallback(() => (
    <AnimatePresence>
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="absolute rounded-full bg-white/20 pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: "translate(-50%, -50%)",
          }}
          initial={{ width: 0, height: 0, opacity: 0.5 }}
          animate={{ width: 200, height: 200, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      ))}
    </AnimatePresence>
  ), [ripples]);

  return { addRipple, RippleContainer };
}
