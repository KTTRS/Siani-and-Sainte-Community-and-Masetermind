import { useState, useRef, useCallback, useMemo, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, SPRING, EASE, DURATION } from "@/lib/motion";
import { Plus, Loader2, X, ChevronDown, Circle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useGamification } from "@/hooks/useGamification";
import { useStreakFreezes, useStreakFreeze, useRecoveryQuest, useStartRecoveryQuest, useCompleteRecoveryQuest } from "@/hooks/useNightShift";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SEO, PAGE_SEO } from "@/components/SEO";
import type { Goal, Move } from "@shared/schema";
import { Icons3D, Icon3DImage } from "@/lib/icons3d";
import { hapticSuccess, hapticImpact, hapticLight } from "@/lib/haptics";
import { playCommit } from "@/lib/useSound";
import { Progress } from "@/components/ui/progress";

import heroImg from "@assets/generated_images/sainte_dark_abstract_2.png";

function getGoalIcon(goal: Goal): string {
  const title = goal.title.toLowerCase();
  
  if (title.includes('app') || title.includes('build') || title.includes('code') || title.includes('develop')) {
    return Icons3D.star;
  }
  if (title.includes('publish') || title.includes('launch') || title.includes('ship') || title.includes('release')) {
    return Icons3D.trophy;
  }
  if (title.includes('health') || title.includes('fitness') || title.includes('exercise')) {
    return Icons3D.vitamins;
  }
  if (title.includes('money') || title.includes('financial') || title.includes('save') || title.includes('budget')) {
    return Icons3D.gift;
  }
  if (title.includes('learn') || title.includes('study') || title.includes('education') || title.includes('course')) {
    return Icons3D.star;
  }
  if (title.includes('job') || title.includes('career') || title.includes('work') || title.includes('employ')) {
    return Icons3D.trophy;
  }
  if (title.includes('home') || title.includes('house') || title.includes('apartment')) {
    return Icons3D.home;
  }
  
  return Icons3D.fire;
}

function generateSerial(id: string): string {
  const hash = id.slice(0, 4).toUpperCase().padStart(4, '0');
  return `SN-BAG-${hash}`;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
  exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } },
};

const expandVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { 
    height: "auto", 
    opacity: 1,
    transition: { 
      height: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
      opacity: { duration: 0.25, delay: 0.1 },
    },
  },
};

const buttonPressVariants = {
  tap: { scale: 0.95 },
  hover: { scale: 1.02 },
};

interface CoinAnimation {
  moveId: string;
  goalId: string;
  startX: number;
  startY: number;
}

interface RewardReveal {
  xpEarned: number;
  newTotal: number;
  suggestion: string;
}

const MOVE_SUGGESTIONS = [
  "Apply for that opportunity",
  "Schedule the important call",
  "Complete the certification",
  "Follow up with the contact",
  "Submit the application",
  "Finish the project milestone",
  "Attend the networking event",
  "Update your portfolio",
];

const SIANI_NUDGES = [
  "Been a minute since we touched this one. Still on your radar?",
  "Yo, this goal's been chillin for a bit. Ready to make a move?",
  "I see you. This one's been quiet. Let's shake it up?",
  "Don't sleep on this one. Small step today hits different.",
  "Been a few days - no pressure but I believe in this one.",
  "This goal misses you. Just saying.",
  "Let's not let this one collect dust. You got this.",
];

function SianiNudge({ 
  goal, 
  onDismiss, 
  onAddMove 
}: { 
  goal: Goal; 
  onDismiss: () => void;
  onAddMove: (goalId: string) => void;
}) {
  const randomNudge = useMemo(() => 
    SIANI_NUDGES[Math.floor(Math.random() * SIANI_NUDGES.length)], 
  []);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="relative rounded-2xl matte-3d-crimson p-5 mb-4"
      data-testid={`siani-nudge-${goal.id}`}
    >
      <motion.button
        onClick={() => {
          hapticLight();
          onDismiss();
        }}
        whileTap={{ scale: 0.9 }}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-charcoal/50 flex items-center justify-center text-earth-5 hover:text-earth-2 transition-colors"
        data-testid={`button-dismiss-nudge-${goal.id}`}
      >
        <X className="w-4 h-4" />
      </motion.button>
      
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl matte-3d flex items-center justify-center flex-shrink-0">
          <Icon3DImage icon="heart" size={28} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="status-exclusive text-[10px]">SIANI</span>
            <span className="text-[9px] text-earth-5">about {goal.title}</span>
          </div>
          <p className="text-fluid-body text-earth-2 leading-relaxed">
            {randomNudge}
          </p>
          <motion.button
            onClick={() => {
              hapticLight();
              onAddMove(goal.id);
            }}
            whileTap={{ scale: 0.95 }}
            className="mt-4 flex items-center gap-2 text-fluid-caption text-crimson hover:text-crimson/80 transition-colors group min-h-[44px]"
            data-testid={`button-nudge-add-move-${goal.id}`}
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Add a move</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function CoinDrop({ 
  startX, 
  startY, 
  onComplete 
}: { 
  startX: number; 
  startY: number; 
  onComplete: () => void;
}) {
  return (
    <motion.div
      className="fixed z-[100] pointer-events-none"
      style={{ left: startX, top: startY }}
      initial={{ y: 0, x: 0, scale: 1, opacity: 1 }}
      animate={{ 
        y: [0, -80, 200],
        x: [0, -30, 0],
        scale: [1, 1.3, 0.6],
        rotate: [0, 360, 720],
        opacity: [1, 1, 0],
      }}
      transition={{ 
        duration: 0.9, 
        ease: [0.25, 0.46, 0.45, 0.94],
        times: [0, 0.3, 1],
      }}
      onAnimationComplete={() => {
        hapticImpact();
        onComplete();
      }}
    >
      <div className="w-12 h-12 rounded-full matte-3d-crimson flex items-center justify-center">
        <span className="text-lg font-black text-white">+</span>
      </div>
    </motion.div>
  );
}

const MoveItem = forwardRef<HTMLDivElement, { 
  move: Move; 
  onComplete: (e: React.MouseEvent) => void;
  isCompleting: boolean;
  index: number;
}>(function MoveItem({ 
  move, 
  onComplete, 
  isCompleting,
  index,
}, ref) {
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 py-3 group"
      data-testid={`move-item-${move.id}`}
    >
      <motion.button
        onClick={(e) => {
          hapticLight();
          onComplete(e);
        }}
        disabled={move.isCompleted || isCompleting}
        whileTap={{ scale: 0.85 }}
        className="w-11 h-11 flex items-center justify-center transition-all rounded-full"
        data-testid={`button-complete-move-${move.id}`}
      >
        {isCompleting ? (
          <Loader2 className="w-5 h-5 animate-spin text-crimson" />
        ) : move.isCompleted ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={SPRING.pop}
          >
            <CheckCircle2 className="w-6 h-6 text-crimson" />
          </motion.div>
        ) : (
          <Circle className="w-6 h-6 text-earth-4 group-hover:text-crimson transition-colors" />
        )}
      </motion.button>
      <span className={`text-fluid-body transition-all flex-1 ${
        move.isCompleted 
          ? "line-through text-earth-5" 
          : "text-earth-2"
      }`}>
        {move.title}
      </span>
      {move.xpReward && !move.isCompleted && (
        <span className="premium-chip text-[9px] py-1 px-2">
          +{move.xpReward} XP
        </span>
      )}
    </motion.div>
  );
});

interface GoalCardProps {
  goal: Goal;
  moves: Move[];
  isExpanded: boolean;
  onToggle: () => void;
  onCompleteMove: (move: Move, e: React.MouseEvent) => void;
  onAddMove: (goalId: string) => void;
  completingMoveId: string | null;
  index: number;
}

const GoalCard = forwardRef(function GoalCard(
  { 
    goal, 
    moves, 
    isExpanded, 
    onToggle, 
    onCompleteMove, 
    onAddMove, 
    completingMoveId,
    index,
  }: GoalCardProps,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const activeMoves = moves.filter(m => !m.isCompleted);
  const completedMoves = moves.filter(m => m.isCompleted);
  const progressPercent = moves.length > 0 ? (completedMoves.length / moves.length) * 100 : 0;
  const serial = generateSerial(goal.id);
  
  return (
    <motion.div
      ref={ref}
      layout
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="rounded-2xl matte-3d overflow-visible"
      style={{
        background: `linear-gradient(135deg, hsl(var(--graphite)) 0%, hsl(var(--charcoal)) 50%, hsl(var(--graphite) / 0.8) 100%)`,
      }}
      data-testid={`goal-card-${goal.id}`}
      data-goal-id={goal.id}
    >
      <motion.button
        onClick={() => {
          hapticLight();
          onToggle();
        }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center gap-4 p-5 text-left transition-all min-h-[88px] relative"
        data-testid={`button-toggle-goal-${goal.id}`}
      >
        <div className="w-14 h-14 rounded-xl matte-3d flex items-center justify-center flex-shrink-0">
          <img 
            src={getGoalIcon(goal)} 
            alt="" 
            className="w-8 h-8 object-contain"
            style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))' }}
          />
        </div>
        
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display text-fluid-title text-earth-1 leading-snug truncate">
              {goal.title}
            </h3>
            {activeMoves.length > 0 && (
              <span className="status-exclusive text-[9px] flex-shrink-0">ACTIVE</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 h-1.5 bg-void rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-crimson to-crimson-light rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={fadeUp()}
              />
            </div>
            <p className="text-[10px] font-condensed text-earth-4 tabular-nums">
              {completedMoves.length}/{moves.length}
            </p>
          </div>
        </div>
        
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-earth-4" />
        </motion.div>
      </motion.button>
      
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={expandVariants}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              <div className="h-px bg-gradient-to-r from-transparent via-smoke/40 to-transparent mb-4" />
              
              <div className="ml-3 pl-4 border-l-2 border-crimson/40 space-y-1">
                {activeMoves.length === 0 && completedMoves.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-4 text-center"
                  >
                    <div className="w-10 h-10 mx-auto mb-3 rounded-xl matte-3d flex items-center justify-center">
                      <img src={Icons3D.star} alt="" aria-hidden className="w-6 h-6 object-contain" />
                    </div>
                    <p className="text-fluid-caption text-earth-4">
                      No moves yet. Add your first action to get started.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    <AnimatePresence mode="popLayout">
                      {activeMoves.map((move, i) => (
                        <MoveItem 
                          key={move.id} 
                          move={move} 
                          onComplete={(e) => onCompleteMove(move, e)}
                          isCompleting={completingMoveId === move.id}
                          index={i}
                        />
                      ))}
                    </AnimatePresence>
                    
                    {completedMoves.length > 0 && (
                      <div className="pt-3 mt-3 border-t border-smoke/30">
                        <p className="font-condensed text-[9px] tracking-[0.2em] text-earth-5 mb-2">
                          COMPLETED
                        </p>
                        {completedMoves.slice(0, 3).map((move, i) => (
                          <MoveItem 
                            key={move.id} 
                            move={move} 
                            onComplete={() => {}}
                            isCompleting={false}
                            index={i}
                          />
                        ))}
                        {completedMoves.length > 3 && (
                          <p className="text-[10px] text-earth-5 py-2">
                            +{completedMoves.length - 3} more completed
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                <motion.button
                  onClick={() => {
                    hapticLight();
                    onAddMove(goal.id);
                  }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl matte-surface border border-smoke/30 text-fluid-caption text-earth-4 hover:text-crimson hover:border-crimson/30 transition-all min-h-[44px] group"
                  data-testid={`button-add-move-to-${goal.id}`}
                >
                  <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Add move</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

GoalCard.displayName = 'GoalCard';

interface StreakControlPanelProps {
  userId: string | undefined;
  currentStreak: number;
}

function StreakControlPanel({ userId, currentStreak }: StreakControlPanelProps) {
  const { data: freezeData, isLoading: freezesLoading } = useStreakFreezes(userId);
  const { data: questData, isLoading: questLoading } = useRecoveryQuest(userId);
  const { toast } = useToast();
  
  const useFreezeMutation = useStreakFreeze();
  const startQuestMutation = useStartRecoveryQuest();
  const completeQuestMutation = useCompleteRecoveryQuest();
  
  const freezeCount = freezeData?.available ?? 0;
  const hasActiveQuest = questData?.active ?? false;
  const questProgress = questData?.progress ?? 0;
  const questTotal = questData?.total ?? 3;
  const isQuestReady = hasActiveQuest && questProgress >= questTotal;
  const isStreakBroken = questData?.streakBroken ?? false;
  const questId = questData?.questId;
  const stepsRemaining = questTotal - questProgress;
  
  const handleUseFreeze = () => {
    if (!userId || freezeCount <= 0) return;
    hapticLight();
    useFreezeMutation.mutate({ userId }, {
      onSuccess: () => {
        hapticSuccess();
        toast({ description: "Immunity deployed successfully" });
      },
      onError: () => {
        toast({ description: "Failed to deploy immunity", variant: "destructive" });
      }
    });
  };
  
  const handleStartQuest = () => {
    if (!userId) return;
    hapticLight();
    const lostStreak = Math.max(1, currentStreak || 1);
    startQuestMutation.mutate({ userId, lostStreak }, {
      onSuccess: () => {
        hapticSuccess();
        toast({ description: "Recovery protocol initiated" });
      },
      onError: () => {
        toast({ description: "Failed to initiate protocol", variant: "destructive" });
      }
    });
  };
  
  const handleCompleteQuest = () => {
    if (!userId || !questId) return;
    hapticLight();
    completeQuestMutation.mutate({ userId, questId }, {
      onSuccess: () => {
        hapticSuccess();
        toast({ description: "Mission complete. Streak immunity restored." });
      },
      onError: () => {
        toast({ description: "Failed to complete mission", variant: "destructive" });
      }
    });
  };
  
  if (!userId) return null;
  
  const freezeSerial = `SN-FREEZE-${String(freezeCount).padStart(3, '0')}`;
  const missionSerial = questId ? `SN-MISSION-${questId.slice(0, 6).toUpperCase()}` : null;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="px-fluid py-fluid-gap" 
      data-testid="streak-control-panel"
    >
      <div className="container-mobile">
        <div 
          className={`rounded-2xl p-5 ${hasActiveQuest ? 'matte-3d-crimson' : 'matte-3d'}`}
          data-testid="streak-control-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl matte-3d flex items-center justify-center">
                <Icon3DImage icon="fire" size={24} />
              </div>
              <span className="status-exclusive">STREAK VAULT</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl matte-3d p-4 relative" data-testid="freeze-section">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl matte-3d flex items-center justify-center flex-shrink-0">
                  <Icon3DImage icon="shield" size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-condensed text-[10px] tracking-wider text-earth-4">IMMUNITY RESERVES</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="premium-chip" data-testid="text-freeze-count">
                      {freezesLoading ? "..." : freezeCount}
                    </span>
                    <span className="text-fluid-caption text-earth-4">
                      {freezeCount === 1 ? 'reserve remaining' : 'reserves remaining'}
                    </span>
                  </div>
                  <p className="text-fluid-caption text-earth-5 mt-1">
                    Access your streak immunity reserves
                  </p>
                  <p className="text-[10px] text-earth-5 mt-2">
                    <span className="text-crimson font-condensed">50 CRED</span> to acquire
                  </p>
                </div>
              </div>
              
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleUseFreeze}
                  disabled={freezeCount <= 0 || useFreezeMutation.isPending}
                  variant={freezeCount > 0 ? "default" : "outline"}
                  className="w-full mt-4 min-h-[44px]"
                  data-testid="button-use-freeze"
                >
                  {useFreezeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : freezeCount > 0 ? (
                    "DEPLOY IMMUNITY"
                  ) : (
                    "NO RESERVES"
                  )}
                </Button>
              </motion.div>
            </div>
            
            <div 
              className={`rounded-xl p-4 relative ${hasActiveQuest ? 'matte-3d-crimson' : 'matte-3d'}`}
              data-testid="recovery-section"
            >
              <div className="flex items-start gap-3">
                <div 
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    hasActiveQuest ? 'matte-3d-crimson' : 'matte-3d'
                  }`}
                >
                  <Icon3DImage icon="zap" size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-condensed text-[10px] tracking-wider text-earth-4">RECOVERY MISSION</span>
                    {hasActiveQuest && (
                      <span className="premium-chip-crimson text-[9px] py-1 px-2">ACTIVE</span>
                    )}
                  </div>
                  
                  {questLoading ? (
                    <p className="text-fluid-caption text-earth-5">Loading...</p>
                  ) : hasActiveQuest ? (
                    <>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-2 bg-void rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-crimson to-crimson-light rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(questProgress / questTotal) * 100}%` }}
                            transition={SPRING.soft}
                          />
                        </div>
                        <span className="font-stats text-fluid-caption text-earth-3 tabular-nums" data-testid="text-quest-progress">
                          {questProgress}/{questTotal}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        {Array.from({ length: stepsRemaining }).map((_, i) => (
                          <span key={i} className="premium-chip text-[9px] py-1 px-2">STEP</span>
                        ))}
                        {stepsRemaining > 0 && (
                          <span className="text-[10px] text-earth-5 ml-1">remaining</span>
                        )}
                      </div>
                      <p className="text-fluid-caption text-earth-5 mt-2">
                        {isQuestReady ? "Mission complete. Ready for extraction." : "Complete moves to restore immunity"}
                      </p>
                    </>
                  ) : (
                    <p className="text-fluid-caption text-earth-5 mt-1">
                      {isStreakBroken 
                        ? "Streak immunity compromised. Initiate recovery protocol." 
                        : "No active recovery mission"}
                    </p>
                  )}
                </div>
              </div>
              
              {hasActiveQuest ? (
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleCompleteQuest}
                    disabled={!isQuestReady || completeQuestMutation.isPending}
                    variant={isQuestReady ? "default" : "outline"}
                    className={`w-full mt-4 min-h-[44px] ${isQuestReady ? 'bg-crimson hover:bg-crimson/90' : ''}`}
                    data-testid="button-complete-quest"
                  >
                    {completeQuestMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isQuestReady ? (
                      "COMPLETE MISSION"
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="premium-chip text-[9px] py-1 px-2">{stepsRemaining}</span>
                        <span>STEPS REMAINING</span>
                      </span>
                    )}
                  </Button>
                </motion.div>
              ) : isStreakBroken ? (
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleStartQuest}
                    disabled={startQuestMutation.isPending}
                    className="w-full mt-4 min-h-[44px]"
                    data-testid="button-start-quest"
                  >
                    {startQuestMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "INITIATE RECOVERY PROTOCOL"
                    )}
                  </Button>
                </motion.div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Bag() {
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [isAddMoveOpen, setIsAddMoveOpen] = useState(false);
  const [addingToGoalId, setAddingToGoalId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [coinAnimation, setCoinAnimation] = useState<CoinAnimation | null>(null);
  const [rewardReveal, setRewardReveal] = useState<RewardReveal | null>(null);
  const [completingMoveId, setCompletingMoveId] = useState<string | null>(null);
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('sainte-dismissed-nudges');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  
  const { toast } = useToast();
  const { profile } = useAuth();
  const userId = profile?.id;
  const { completeMove: gamificationCompleteMove, isPending: gamificationPending } = useGamification(userId || "demo-user");
  const completingMoveRef = useRef<Move | null>(null);

  const { data: goals = [], isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  const { data: moves = [], isLoading: movesLoading } = useQuery<Move[]>({
    queryKey: ["/api/moves"],
  });

  const isLoading = goalsLoading || movesLoading;

  const getMovesForGoal = useCallback((goalId: string) => {
    return moves.filter(m => m.goalId === goalId);
  }, [moves]);

  const getRandomSuggestion = () => {
    return MOVE_SUGGESTIONS[Math.floor(Math.random() * MOVE_SUGGESTIONS.length)];
  };

  const stalledGoal = useMemo(() => {
    if (goals.length === 0) return null;
    
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    for (const goal of goals) {
      if (goal.isCompleted || dismissedNudges.has(goal.id)) continue;
      
      const goalMoves = moves.filter(m => m.goalId === goal.id);
      const hasNoMoves = goalMoves.length === 0;
      
      let lastActivityTime = goal.createdAt ? new Date(goal.createdAt).getTime() : 0;
      
      for (const move of goalMoves) {
        if (move.completedAt) {
          const completedTime = new Date(move.completedAt).getTime();
          if (completedTime > lastActivityTime) {
            lastActivityTime = completedTime;
          }
        }
        if (move.createdAt) {
          const createdTime = new Date(move.createdAt).getTime();
          if (createdTime > lastActivityTime) {
            lastActivityTime = createdTime;
          }
        }
      }
      
      const isStalled = now - lastActivityTime > TWO_DAYS_MS;
      
      if (isStalled && (hasNoMoves || goalMoves.some(m => !m.isCompleted))) {
        return goal;
      }
    }
    return null;
  }, [goals, moves, dismissedNudges]);

  const handleDismissNudge = useCallback((goalId: string) => {
    setDismissedNudges(prev => {
      const next = new Set(prev);
      next.add(goalId);
      localStorage.setItem('sainte-dismissed-nudges', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const toggleGoalExpand = (goalId: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  const createGoalMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/goals", { title, category: "peace" });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setNewTitle("");
      setIsAddGoalOpen(false);
      hapticSuccess();
      toast({ description: "Goal added to your bag" });
      setExpandedGoals(prev => new Set(prev).add(data.id));
    },
  });

  const createMoveMutation = useMutation({
    mutationFn: async ({ title, goalId }: { title: string; goalId: string }) => {
      const response = await apiRequest("POST", "/api/moves", { title, goalId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      setNewTitle("");
      setIsAddMoveOpen(false);
      setAddingToGoalId(null);
      hapticSuccess();
      toast({ description: "Move added" });
    },
  });

  const completeMoveMutation = useMutation({
    mutationFn: async (id: string) => {
      const moveResponse = await apiRequest("POST", `/api/moves/${id}/complete`);
      const moveData = await moveResponse.json();
      
      const gamificationData = await gamificationCompleteMove(id);
      
      return { moveData, gamificationData };
    },
    onSuccess: ({ moveData, gamificationData }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      
      const credEarned = gamificationData?.credAwarded || 10;
      
      setRewardReveal({
        xpEarned: credEarned,
        newTotal: (moveData.xp || 0) + credEarned,
        suggestion: getRandomSuggestion(),
      });
      
      hapticSuccess();
      completingMoveRef.current = null;
      setCompletingMoveId(null);
    },
    onError: () => {
      setCompletingMoveId(null);
      completingMoveRef.current = null;
      toast({ description: "Failed to complete move", variant: "destructive" });
    },
  });

  const handleCompleteMove = (move: Move, e: React.MouseEvent) => {
    if (move.isCompleted || completingMoveId) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    
    completingMoveRef.current = move;
    setCompletingMoveId(move.id);
    
    setCoinAnimation({
      moveId: move.id,
      goalId: move.goalId || "",
      startX: rect.left + rect.width / 2 - 24,
      startY: rect.top + rect.height / 2 - 24,
    });
  };

  const handleCoinAnimationComplete = () => {
    setCoinAnimation(null);
    if (completingMoveRef.current) {
      void playCommit();
      completeMoveMutation.mutate(completingMoveRef.current.id);
    }
  };

  const handleAddMoveToGoal = (goalId: string) => {
    setAddingToGoalId(goalId);
    setIsAddMoveOpen(true);
  };

  const handleSuggestionClick = () => {
    hapticLight();
    if (rewardReveal && addingToGoalId) {
      setNewTitle(rewardReveal.suggestion);
      setRewardReveal(null);
      setIsAddMoveOpen(true);
    } else if (rewardReveal) {
      setNewTitle(rewardReveal.suggestion);
      setRewardReveal(null);
      setIsAddGoalOpen(true);
    }
  };

  const dismissReward = () => {
    hapticLight();
    setRewardReveal(null);
  };

  const activeGoals = goals.filter(g => !g.isCompleted);
  const completedGoals = goals.filter(g => g.isCompleted);
  const activeMoves = moves.filter(m => !m.isCompleted);
  const completedMovesCount = moves.filter(m => m.isCompleted).length;

  return (
    <div className="page-container app-ground">
      <SEO {...PAGE_SEO.bag} />
      <div className="page-content">
        <div className="relative h-[55vh] min-h-[400px]">
          <div className="absolute inset-0">
            <img 
              src={heroImg} 
              alt="" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-everglade-950/50 via-everglade-950/70 to-everglade-950" />
            <div className="absolute inset-0 bg-gradient-to-r from-everglade-950/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-everglade-950 to-transparent" />
          </div>
          
          <div className="relative z-10 h-full flex flex-col justify-end px-fluid pb-10">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="space-y-3"
            >
              <motion.p 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-[11px] tracking-[0.42em] uppercase text-lime-core"
              >
                YOUR COLLECTION
              </motion.p>
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fadeUp(0.3)}
                className="text-fluid-display text-fog-100 uppercase tracking-[0.04em]"
                style={{ fontFamily: "Chillax, 'Neue Haas Grotesk', Inter, sans-serif", fontWeight: 500 }}
              >
                THE BAG
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-fluid-body text-mint-300/80 max-w-[280px]"
              >
                Your goals. Your moves. Your wins.
              </motion.p>
            </motion.div>
          </div>
        </div>

        <StreakControlPanel
          userId={userId}
          currentStreak={profile?.currentStreak ?? 0}
        />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="px-fluid py-fluid-gap relative z-20"
        >
          <div className="flex items-center justify-between gap-4 p-5 matte-3d rounded-2xl container-mobile">
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p className="font-stats text-2xl text-earth-1 tabular-nums">{activeGoals.length}</p>
                <p className="font-condensed text-[9px] tracking-wider text-earth-5">GOALS</p>
              </div>
              <div className="w-px h-10 bg-smoke/40" />
              <div className="text-center">
                <p className="font-stats text-2xl text-earth-1 tabular-nums">{activeMoves.length}</p>
                <p className="font-condensed text-[9px] tracking-wider text-earth-5">ACTIVE</p>
              </div>
              <div className="w-px h-10 bg-smoke/40" />
              <div className="text-center">
                <p className="font-stats text-2xl text-crimson tabular-nums">{completedMovesCount}</p>
                <p className="font-condensed text-[9px] tracking-wider text-earth-5">DONE</p>
              </div>
            </div>
            
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button 
                onClick={() => {
                  hapticLight();
                  setIsAddGoalOpen(true);
                }}
                size="icon"
                className="w-12 h-12 rounded-xl"
                data-testid="button-add-goal"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </motion.div>
          </div>
        </motion.div>

        <div className="px-fluid py-fluid-gap">
          <div className="container-mobile space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="h-24 matte-3d rounded-2xl animate-pulse" 
                  />
                ))}
              </div>
            ) : goals.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="py-16 text-center"
              >
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl matte-3d flex items-center justify-center"
                >
                  <Icon3DImage icon="trophy" size={44} />
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="font-display text-xl text-earth-2 mb-2"
                >
                  YOUR BAG IS EMPTY
                </motion.h3>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-fluid-body text-earth-4 mb-6 max-w-[240px] mx-auto"
                >
                  Drop your first goal and start stacking wins
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() => {
                      hapticLight();
                      setIsAddGoalOpen(true);
                    }}
                    className="min-h-[48px] px-8"
                    data-testid="button-add-first-goal"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    ADD FIRST GOAL
                  </Button>
                </motion.div>
              </motion.div>
            ) : (
              <>
                <AnimatePresence>
                  {stalledGoal && (
                    <SianiNudge
                      key={stalledGoal.id}
                      goal={stalledGoal}
                      onDismiss={() => handleDismissNudge(stalledGoal.id)}
                      onAddMove={handleAddMoveToGoal}
                    />
                  )}
                </AnimatePresence>
                
                <AnimatePresence mode="popLayout">
                  {activeGoals.map((goal, index) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      moves={getMovesForGoal(goal.id)}
                      isExpanded={expandedGoals.has(goal.id)}
                      onToggle={() => toggleGoalExpand(goal.id)}
                      onCompleteMove={handleCompleteMove}
                      onAddMove={handleAddMoveToGoal}
                      completingMoveId={completingMoveId}
                      index={index}
                    />
                  ))}
                </AnimatePresence>

                {completedGoals.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="pt-6 mt-4"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-smoke/40 to-transparent" />
                      <p className="font-condensed text-[10px] tracking-[0.2em] text-earth-5">COMPLETED GOALS</p>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-smoke/40 to-transparent" />
                    </div>
                    <div className="space-y-3">
                      {completedGoals.map((goal, index) => (
                        <motion.div
                          key={goal.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-3 py-4 px-4 rounded-xl matte-surface"
                          data-testid={`goal-completed-${goal.id}`}
                        >
                          <div className="w-10 h-10 rounded-xl matte-3d flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-crimson" />
                          </div>
                          <span className="text-fluid-body text-earth-4 line-through flex-1">{goal.title}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </div>

        <AnimatePresence>
          {coinAnimation && (
            <CoinDrop
              startX={coinAnimation.startX}
              startY={coinAnimation.startY}
              onComplete={handleCoinAnimationComplete}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {rewardReveal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-everglade-950/95 z-50"
                onClick={dismissReward}
                data-testid="reward-reveal-backdrop"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={SPRING.sheet}
                className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto"
                data-testid="reward-reveal-modal"
              >
                <div className="relative rounded-2xl overflow-hidden matte-3d-crimson">
                  
                  <div className="relative p-6">
                    <div className="text-center mb-6">
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", delay: 0.2 }}
                        className="inline-flex items-center justify-center w-20 h-20 rounded-2xl matte-3d mb-4"
                      >
                        <Icon3DImage icon="zap" size={44} />
                      </motion.div>
                      
                      <motion.p 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="font-condensed text-[10px] tracking-[0.3em] text-earth-4 mb-1"
                      >
                        XP EARNED
                      </motion.p>
                      
                      <motion.p 
                        initial={{ opacity: 0, scale: 1.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4, type: "spring" }}
                        className="text-5xl font-black text-crimson"
                        data-testid="xp-earned-amount"
                      >
                        +{rewardReveal.xpEarned}
                      </motion.p>
                    </div>
                    
                    <div className="my-6 h-px bg-gradient-to-r from-transparent via-smoke/40 to-transparent" />

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <Icon3DImage icon="sparkles" size={20} />
                        <p className="font-condensed text-[10px] tracking-[0.2em] text-earth-4">
                          KEEP THE MOMENTUM
                        </p>
                      </div>
                      
                      <motion.button
                        onClick={handleSuggestionClick}
                        whileTap={{ scale: 0.98 }}
                        className="w-full group p-4 rounded-xl transition-all matte-surface border border-smoke/30 hover:border-crimson/30"
                        data-testid="button-accept-suggestion"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-fluid-body text-earth-2 font-medium text-left">
                            {rewardReveal.suggestion}
                          </span>
                          <ChevronDown className="w-5 h-5 text-earth-4 group-hover:text-crimson transition-colors flex-shrink-0 -rotate-90" />
                        </div>
                      </motion.button>
                    </motion.div>
                    
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      onClick={dismissReward}
                      whileTap={{ scale: 0.95 }}
                      className="w-full mt-4 py-3 text-[11px] text-earth-5 tracking-wider uppercase hover:text-earth-3 transition-colors min-h-[44px]"
                      data-testid="button-dismiss-reward"
                    >
                      DONE FOR NOW
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAddGoalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-everglade-950/95 z-50"
                onClick={() => setIsAddGoalOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                transition={{ type: "spring", damping: 25 }}
                className="fixed bottom-0 left-0 right-0 z-50 px-fluid py-6 matte-3d rounded-t-3xl"
              >
                <div className="container-mobile">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-broken-display text-fluid-title text-earth-1 tracking-tight">NEW GOAL</h2>
                    <motion.button
                      onClick={() => setIsAddGoalOpen(false)}
                      whileTap={{ scale: 0.9 }}
                      className="w-10 h-10 rounded-full matte-surface flex items-center justify-center text-earth-4 hover:text-earth-1"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>
                  
                  <div className="flex gap-3">
                    <Input
                      placeholder="What's your next big goal?"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && createGoalMutation.mutate(newTitle)}
                      className="flex-1 min-h-[48px] text-fluid-body bg-void border-smoke text-earth-1 placeholder:text-earth-5"
                      data-testid="input-goal-title"
                      autoFocus
                    />
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={() => newTitle.trim() && createGoalMutation.mutate(newTitle)}
                        disabled={!newTitle.trim() || createGoalMutation.isPending}
                        className="min-h-[48px] px-6"
                        data-testid="button-confirm-add-goal"
                      >
                        {createGoalMutation.isPending ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          "ADD"
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAddMoveOpen && addingToGoalId && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-everglade-950/95 z-50"
                onClick={() => {
                  setIsAddMoveOpen(false);
                  setAddingToGoalId(null);
                }}
              />
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                transition={{ type: "spring", damping: 25 }}
                className="fixed bottom-0 left-0 right-0 z-50 px-fluid py-6 matte-3d rounded-t-3xl"
              >
                <div className="container-mobile">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-broken-display text-fluid-title text-earth-1 tracking-tight">NEW MOVE</h2>
                      <p className="text-fluid-caption text-earth-4 mt-1">
                        for {goals.find(g => g.id === addingToGoalId)?.title}
                      </p>
                    </div>
                    <motion.button
                      onClick={() => {
                        setIsAddMoveOpen(false);
                        setAddingToGoalId(null);
                      }}
                      whileTap={{ scale: 0.9 }}
                      className="w-10 h-10 rounded-full matte-surface flex items-center justify-center text-earth-4 hover:text-earth-1"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>
                  
                  <div className="flex gap-3">
                    <Input
                      placeholder="What's your next action?"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && createMoveMutation.mutate({ title: newTitle, goalId: addingToGoalId })}
                      className="flex-1 min-h-[48px] text-fluid-body bg-void border-smoke text-earth-1 placeholder:text-earth-5"
                      data-testid="input-move-title"
                      autoFocus
                    />
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={() => newTitle.trim() && createMoveMutation.mutate({ title: newTitle, goalId: addingToGoalId })}
                        disabled={!newTitle.trim() || createMoveMutation.isPending}
                        className="min-h-[48px] px-6"
                        data-testid="button-confirm-add-move"
                      >
                        {createMoveMutation.isPending ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          "ADD"
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
