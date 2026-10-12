import { motion, useSpring, useTransform } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { SPRING_CONFIG, triggerHaptic } from "@/lib/microInteractions";

interface MomentumBarProps {
  currentXP: number;
  xpForNextLevel: number;
  level: number;
  streak?: number;
  className?: string;
}

export function MomentumBar({ currentXP, xpForNextLevel, level, streak, className = "" }: MomentumBarProps) {
  // Calculate progress percentage (XP within current level)
  const previousLevelXP = level > 1 ? Math.round(500 * Math.pow(1.5, level - 2)) : 0;
  const xpInCurrentLevel = currentXP - previousLevelXP;
  const xpNeededForLevel = xpForNextLevel - previousLevelXP;
  const progress = Math.min((xpInCurrentLevel / xpNeededForLevel) * 100, 100);
  
  // Elastic spring animation for progress
  const springProgress = useSpring(progress, SPRING_CONFIG.bouncy);
  
  // Track XP changes for wobble animation
  const [isWobbling, setIsWobbling] = useState(false);
  const prevXP = useRef(currentXP);
  
  useEffect(() => {
    if (currentXP > prevXP.current) {
      setIsWobbling(true);
      triggerHaptic("light");
      const timer = setTimeout(() => setIsWobbling(false), 600);
      prevXP.current = currentXP;
      return () => clearTimeout(timer);
    }
    prevXP.current = currentXP;
  }, [currentXP]);
  
  return (
    <div className={className}>
      {/* Level and XP header */}
      <div className="flex items-end justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span className="font-condensed text-[10px] tracking-[0.3em] text-silver">
            LEVEL
          </span>
          <motion.span 
            className="font-stats text-2xl font-bold text-white"
            style={{ fontVariantNumeric: 'tabular-nums' }}
            key={level}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {level}
          </motion.span>
        </div>
        
        <div className="flex items-baseline gap-1 text-right">
          <motion.span 
            className="font-stats text-sm font-semibold text-crimson"
            style={{ fontVariantNumeric: 'tabular-nums' }}
            key={currentXP}
            initial={{ y: -8, opacity: 0, scale: 1.2 }}
            animate={{ 
              y: 0, 
              opacity: 1, 
              scale: isWobbling ? [1, 1.15, 0.95, 1] : 1,
            }}
            transition={SPRING_CONFIG.snappy}
          >
            {currentXP.toLocaleString()}
          </motion.span>
          <span className="font-condensed text-[10px] text-silver">
            / {xpForNextLevel.toLocaleString()} XP
          </span>
        </div>
      </div>

      {/* Progress bar container with wobble */}
      <motion.div 
        className="relative h-2.5 overflow-hidden rounded-sm surface-raised border border-charcoal shadow-depth-1"
        animate={isWobbling ? {
          scaleY: [1, 1.4, 0.85, 1.15, 1],
          scaleX: [1, 0.98, 1.01, 0.99, 1],
        } : {}}
        transition={SPRING_CONFIG.bouncy}
      >
        {/* Progress fill with spring animation */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-crimson-deep to-crimson"
          style={{ width: `${progress}%` }}
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={SPRING_CONFIG.smooth}
        />
        
        {/* XP gain pulse effect */}
        {isWobbling && (
          <motion.div
            className="absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-crimson-light"
            initial={{ opacity: 0.8, x: -20 }}
            animate={{ opacity: 0, x: 0 }}
            transition={SPRING_CONFIG.snappy}
          />
        )}
        
        {/* Shine overlay - uses progress-bar-shine class */}
        <motion.div
          className="absolute inset-0 progress-bar-shine"
          style={{ width: '30%' }}
          animate={{
            x: ['-100%', '400%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
            ease: "linear",
          }}
        />
      </motion.div>

      {/* Level markers */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] font-mono text-silver">
          LVL {level}
        </span>
        <span className="text-[9px] font-mono text-silver">
          LVL {level + 1}
        </span>
      </div>

      {/* Streak indicator if present */}
      {streak !== undefined && streak > 0 && (
        <motion.div 
          className="flex items-center justify-center gap-2 mt-4 py-2 border-t border-charcoal"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_CONFIG.smooth}
        >
          <div 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              streak >= 7 ? 'matte-surface border-crimson/30' : 'matte-surface'
            }`}
          >
            <svg 
              className={`w-4 h-4 ${streak >= 7 ? 'text-crimson' : 'text-steel-400'}`}
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M12 2C12 2 8 6 8 10C8 12 9 14 12 16C15 14 16 12 16 10C16 6 12 2 12 2Z" />
              <path d="M12 8C12 8 10 10 10 12C10 13 11 14 12 15C13 14 14 13 14 12C14 10 12 8 12 8Z" className="fill-crimson-light" />
            </svg>
            <span className={`font-stats text-sm font-bold ${streak >= 7 ? 'text-crimson' : 'text-white'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {streak}
            </span>
            <span className="font-condensed text-[10px] tracking-[0.15em] text-silver">
              {streak >= 30 ? '"LEGENDARY"' : streak >= 7 ? '"HEATING UP"' : 'DAY STREAK'}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
