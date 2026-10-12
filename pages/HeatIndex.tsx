import { useState, useMemo, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fadeUp, SPRING, EASE } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useHeatRankings, useUserHeatRanking } from "@/hooks/useNightShift";
import { Clay3DCard, GlowBadge } from "@/lib/layouts";
import { Icons3D, Icon3DImage } from "@/lib/icons3d";
import { Skeleton } from "@/components/ui/skeleton";
import { EditorialLoading, EditorialEmpty } from "@/components/Editorial";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowUp, 
  ArrowDown, 
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";
import { playRise, playWarn } from "@/lib/useSound";

import heroImg from "@assets/generated_images/sainte_club_clean.png";

import avatar1 from "@assets/stock_images/professional_headsho_29836af5.jpg";
import avatar2 from "@assets/stock_images/professional_headsho_6a6ac3dc.jpg";
import avatar3 from "@assets/stock_images/professional_headsho_7bbe2959.jpg";
import avatar4 from "@assets/stock_images/professional_headsho_bc6dd9a5.jpg";
import avatar5 from "@assets/stock_images/professional_headsho_cbc139c4.jpg";
import avatar6 from "@assets/stock_images/professional_headsho_d50d1455.jpg";
import avatar7 from "@assets/stock_images/professional_black_m_3e06c141.jpg";
import avatar8 from "@assets/stock_images/professional_black_m_9195792f.jpg";

const FALLBACK_AVATARS = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7, avatar8];

type PeriodType = "daily" | "weekly" | "monthly";

interface RankingEntry {
  id: string;
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  cred: number;
  level: number;
  movement: "up" | "down" | "same" | "new";
  movementAmount: number;
  previousRank: number | null;
  currentStreak?: number;
}

function getResetHours(periodType: PeriodType): number {
  const now = new Date();
  if (periodType === "daily") {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.ceil((midnight.getTime() - now.getTime()) / (1000 * 60 * 60));
  }
  if (periodType === "weekly") {
    const daysUntilSunday = 7 - now.getDay();
    return daysUntilSunday * 24 + (24 - now.getHours());
  }
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = lastDay.getDate() - now.getDate();
  return daysLeft * 24 + (24 - now.getHours());
}

function LoadingSkeleton() {
  return (
    <EditorialLoading
      serial="SAINTE / HEAT / —"
      label="loading"
      testId="loading-heat"
    />
  );
}

function RankBadge({ rank }: { rank: number }) {
  // Matte clay container for top-3 badges - premium 3D treatment
  const clayContainer = "relative flex items-center justify-center rounded-xl bg-gradient-to-b from-graphite to-charcoal border-t border-l border-smoke/30 border-r border-b-2 border-b-void/80";
  
  if (rank === 1) {
    return (
      <div className={`w-14 h-14 ${clayContainer}`} style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.3), 0 4px 12px rgba(255, 215, 0, 0.15), 0 6px 16px rgba(0,0,0,0.4)'
      }}>
        <div className="relative z-10">
          <img 
            src={Icons3D.crown} 
            alt="1st" 
            className="w-10 h-10"
            style={{ filter: 'drop-shadow(0 3px 6px rgba(255, 215, 0, 0.5))' }}
          />
        </div>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className={`w-12 h-12 ${clayContainer}`} style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.3), 0 4px 12px rgba(192, 192, 192, 0.15), 0 6px 16px rgba(0,0,0,0.4)'
      }}>
        <div className="relative z-10">
          <img 
            src={Icons3D.medal} 
            alt="2nd" 
            className="w-8 h-8"
            style={{ filter: 'drop-shadow(0 3px 6px rgba(192, 192, 192, 0.5))' }}
          />
        </div>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className={`w-12 h-12 ${clayContainer}`} style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.3), 0 4px 12px rgba(205, 127, 50, 0.15), 0 6px 16px rgba(0,0,0,0.4)'
      }}>
        <div className="relative z-10">
          <img 
            src={Icons3D.badge} 
            alt="3rd" 
            className="w-8 h-8"
            style={{ filter: 'drop-shadow(0 3px 6px rgba(205, 127, 50, 0.5))' }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-b from-graphite to-charcoal border-t border-smoke/20 border-b border-void/40">
      <span className="font-stats text-xl text-steel tabular-nums relative z-10">{rank}</span>
    </div>
  );
}

function StatusBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <span className="status-exclusive text-amber-400">ELITE</span>;
  }
  if (rank === 2) {
    return <span className="status-exclusive text-silver">ICON</span>;
  }
  if (rank === 3) {
    return <span className="status-exclusive text-orange-400">RISING</span>;
  }
  return null;
}

function MovementIndicator({ movement, amount }: { movement: "up" | "down" | "same" | "new"; amount?: number }) {
  if (movement === "new") {
    return (
      <motion.div
        className="flex items-center gap-1"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.pop}
        data-testid="badge-new-member"
      >
        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 font-condensed text-[10px] tracking-widest uppercase">
          NEW
        </span>
      </motion.div>
    );
  }
  if (movement === "up") {
    return (
      <motion.div 
        className="flex items-center gap-0.5 text-emerald-500"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.pop}
      >
        <motion.div
          animate={{ y: [0, -2, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </motion.div>
        {amount && amount > 0 && (
          <span className="font-stats text-xs tabular-nums">+{amount}</span>
        )}
      </motion.div>
    );
  }
  if (movement === "down") {
    return (
      <motion.div 
        className="flex items-center gap-0.5 text-red-500"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.pop}
      >
        <motion.div
          animate={{ y: [0, 2, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </motion.div>
        {amount && amount > 0 && (
          <span className="font-stats text-xs tabular-nums">-{amount}</span>
        )}
      </motion.div>
    );
  }
  return (
    <motion.div 
      className="flex items-center gap-0.5 text-steel"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING.pop}
    >
      <Minus className="w-3.5 h-3.5" />
    </motion.div>
  );
}

function RankingRow({ 
  entry, 
  isCurrentUser,
  index 
}: { 
  entry: RankingEntry; 
  isCurrentUser: boolean;
  index: number;
}) {
  const isTopThree = entry.rank <= 3;
  const rankAccentClass = {
    1: "border-amber-500/30",
    2: "border-silver/30", 
    3: "border-orange-700/30",
  }[entry.rank] || "border-smoke/20";

  const serialNumber = `SN-HEAT-${entry.rank.toString().padStart(4, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING.sheet, delay: index * 0.05 }}
      data-testid={`ranking-row-${entry.rank}`}
    >
      <div
        className={cn(
          "surface-tier1 p-4",
          isCurrentUser && "surface-tier1-charged",
        )}
      >
        <div className="flex items-start justify-between mb-2">
          <span className="serial-chip">{serialNumber}</span>
          {isTopThree && <StatusBadge rank={entry.rank} />}
        </div>
        
        <div className="flex items-center gap-4">
          <RankBadge rank={entry.rank} />
          
          <div className="avatar-resin">
            <Avatar className="w-11 h-11 border-2 border-smoke/30">
              <AvatarImage src={entry.avatarUrl || undefined} />
              <AvatarFallback className="bg-graphite text-silver font-condensed text-sm">
                {(entry.displayName || entry.username || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span 
                className={cn(
                  "font-display text-base truncate text-fog-100",
                  isCurrentUser && "text-mint-200"
                )}
                data-testid={`text-username-${entry.rank}`}
              >
                {entry.displayName || entry.username}
              </span>
              {isCurrentUser && (
                <span className="text-[10px] font-condensed tracking-widest text-mint-300/80 uppercase">
                  You
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="font-stats text-sm text-fog-100 tabular-nums" data-testid={`text-cred-${entry.rank}`}>
                {entry.cred.toLocaleString()}
              </span>
              <span className="text-[10px] font-condensed tracking-wider text-fog-200/60 uppercase">
                CRED
              </span>
              <span className="text-[10px] font-condensed tracking-wider text-fog-200/60 uppercase">
                LVL {entry.level}
              </span>
            </div>
          </div>
          
          <MovementIndicator movement={entry.movement} amount={entry.movementAmount} />
        </div>
      </div>
    </motion.div>
  );
}

function Podium({ 
  rankings, 
  currentUserId 
}: { 
  rankings: RankingEntry[]; 
  currentUserId?: string;
}) {
  const top3 = rankings.slice(0, 3);
  if (top3.length === 0) return null;

  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <img 
          src={Icons3D.trophy} 
          alt="" 
          className="w-5 h-5"
          style={{ filter: 'drop-shadow(0 2px 4px rgba(255, 215, 0, 0.3))' }}
        />
        <h2 className="font-condensed text-xs tracking-[0.2em] text-silver uppercase">
          Top Champions
        </h2>
      </div>
      
      <div className="flex items-end justify-center gap-3" data-testid="podium">
        {second && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING.sheet, delay: 0.3 }}
            className="flex flex-col items-center"
          >
            <div className="avatar-resin avatar-resin--silver mb-3">
              <Avatar className="w-12 h-12 border-2 border-silver/60 relative z-10">
                <AvatarImage src={second.avatarUrl || undefined} />
                <AvatarFallback className="bg-graphite text-silver font-condensed">
                  {(second.displayName || second.username || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div 
              className={cn(
                "plate-pedestal plate-pedestal--second w-20 h-24 flex items-center justify-center"
              )}
            >
              <span className="plate-pedestal-grain" aria-hidden />
              <span className="font-display text-5xl text-silver/90 tabular-nums leading-none">2</span>
            </div>
            <div className="text-center mt-2">
              <p className={cn(
                "font-display text-xs truncate max-w-[80px]",
                currentUserId === second.userId ? "text-crimson" : "text-white"
              )} data-testid="podium-name-2">
                {second.displayName || second.username}
              </p>
              <p className="font-stats text-xs text-silver tabular-nums" data-testid="podium-cred-2">
                {second.cred.toLocaleString()}
              </p>
            </div>
          </motion.div>
        )}
        
        {first && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING.sheet, delay: 0.2 }}
            className="flex flex-col items-center -mt-4"
          >
            <div className="avatar-resin avatar-resin--lime mb-3">
              <Avatar className="w-16 h-16 border-2 border-[#9BFF6A]/70 relative z-10">
                <AvatarImage src={first.avatarUrl || undefined} />
                <AvatarFallback className="bg-everglade-800 text-mint-200 font-condensed text-lg">
                  {(first.displayName || first.username || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div 
              className={cn(
                "plate-pedestal plate-pedestal--first w-24 h-32 flex items-center justify-center"
              )}
            >
              <span className="plate-pedestal-grain" aria-hidden />
              <span className="font-display text-6xl text-[#C7FF3E] tabular-nums leading-none">1</span>
            </div>
            <div className="text-center mt-2">
              <p className={cn(
                "font-display text-sm truncate max-w-[100px]",
                currentUserId === first.userId ? "text-crimson" : "text-white"
              )} data-testid="podium-name-1">
                {first.displayName || first.username}
              </p>
              <p className="font-stats text-sm text-[#9BFF6A] tabular-nums" data-testid="podium-cred-1">
                {first.cred.toLocaleString()}
              </p>
            </div>
          </motion.div>
        )}
        
        {third && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING.sheet, delay: 0.4 }}
            className="flex flex-col items-center"
          >
            <div className="avatar-resin avatar-resin--fog mb-3">
              <Avatar className="w-10 h-10 border-2 border-[#EFEAD8]/55 relative z-10">
                <AvatarImage src={third.avatarUrl || undefined} />
                <AvatarFallback className="bg-graphite text-[#EFEAD8] font-condensed text-sm">
                  {(third.displayName || third.username || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div 
              className={cn(
                "plate-pedestal plate-pedestal--third w-16 h-20 flex items-center justify-center"
              )}
            >
              <span className="plate-pedestal-grain" aria-hidden />
              <span className="font-display text-4xl text-[#EFEAD8]/85 tabular-nums leading-none">3</span>
            </div>
            <div className="text-center mt-2">
              <p className={cn(
                "font-display text-xs truncate max-w-[70px]",
                currentUserId === third.userId ? "text-crimson" : "text-white"
              )} data-testid="podium-name-3">
                {third.displayName || third.username}
              </p>
              <p className="font-stats text-xs text-steel tabular-nums" data-testid="podium-cred-3">
                {third.cred.toLocaleString()}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function UserRankingCard({ 
  userRanking, 
  isLoading,
  periodType,
}: { 
  userRanking: RankingEntry | null | undefined; 
  isLoading: boolean;
  periodType: PeriodType;
}) {
  // T105 — fire haptic + colored number-roll on rank changes.
  // Compare against the rank we persisted from the LAST session for this
  // user+period. That way the rise/warn haptic fires once when the
  // member opens HeatIndex and discovers their rank moved, not just
  // when it changes mid-session. We also dedupe by the (old → new) shift
  // tuple so refetches resolving to the same rank don't keep buzzing.
  const rank = userRanking?.rank ?? 0;
  const userId = userRanking?.userId;
  const reduceMotion = useReducedMotion();
  const storageKey = userId ? `sainte:heat:lastRank:${userId}:${periodType}` : null;
  const baselineRef = useRef<number | null>(null);
  const lastShiftKey = useRef<string | null>(null);
  const [shiftDir, setShiftDir] = useState<"up" | "down" | null>(null);

  // Load the persisted prior rank exactly once per user+period.
  // Reset the dedup key when the storage key changes so a different
  // user/period can't accidentally suppress its first detected shift.
  useEffect(() => {
    if (!storageKey) return;
    lastShiftKey.current = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      baselineRef.current = raw ? parseInt(raw, 10) || null : null;
    } catch {
      baselineRef.current = null;
    }
  }, [storageKey]);

  useEffect(() => {
    if (!rank || !storageKey) return;
    const prior = baselineRef.current;
    if (prior && prior !== rank) {
      const shiftKey = `${prior}->${rank}`;
      if (lastShiftKey.current !== shiftKey) {
        lastShiftKey.current = shiftKey;
        if (rank < prior) {
          if (!reduceMotion) { haptic("rise"); void playRise(); }
          setShiftDir("up");
        } else {
          if (!reduceMotion) { haptic("warn"); void playWarn(); }
          setShiftDir("down");
        }
        const t = window.setTimeout(() => setShiftDir(null), 1400);
        // Persist the new rank as the next session's baseline AFTER firing
        // the haptic so we don't suppress the visible-on-mount shift.
        try { window.localStorage.setItem(storageKey, String(rank)); } catch {}
        baselineRef.current = rank;
        return () => window.clearTimeout(t);
      }
    } else if (!prior) {
      // First time we've seen this user+period — record the baseline so
      // the NEXT session can detect a shift. No haptic on first sight.
      try { window.localStorage.setItem(storageKey, String(rank)); } catch {}
      baselineRef.current = rank;
    }
  }, [rank, storageKey, reduceMotion]);

  if (isLoading) {
    return <Skeleton className="h-28 w-full rounded-2xl bg-charcoal" />;
  }
  
  if (!userRanking) {
    return null;
  }

  const serialNumber = `SN-HEAT-${userRanking.rank.toString().padStart(4, '0')}`;
  const rankBadgeColor =
    shiftDir === "up" ? "text-[#9BFF6A] border-[#9BFF6A]/50" :
    shiftDir === "down" ? "text-[#EFEAD8] border-[#EFEAD8]/40" :
    "text-crimson border-crimson/40";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING.sheet, delay: 0.2 }}
    >
      <div className="matte-3d-crimson rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="status-exclusive">YOUR POSITION</span>
          <span className="serial-tape text-[9px]">{serialNumber}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-14 h-14 border-2 border-crimson/50">
              <AvatarImage src={userRanking.avatarUrl || undefined} />
              <AvatarFallback className="bg-crimson/20 text-crimson font-condensed text-lg">
                {(userRanking.displayName || userRanking.username || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <motion.div
              key={`rank-${userRanking.rank}`}
              initial={{ scale: 0.85, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.pop}
              className={cn(
                "absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-charcoal border flex items-center justify-center",
                rankBadgeColor,
              )}
              data-testid="badge-rank-shift"
            >
              <span className="font-stats text-xs tabular-nums">
                #{userRanking.rank}
              </span>
            </motion.div>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg text-fog-100" data-testid="text-user-rank-name">
                {userRanking.displayName || userRanking.username}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-stats text-xl text-mint-200 tabular-nums" data-testid="text-user-cred">
                {userRanking.cred.toLocaleString()}
              </span>
              <span className="text-[11px] font-condensed tracking-wider text-fog-200/60 uppercase">
                CRED
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={SPRING.pop}
            >
              <MovementIndicator movement={userRanking.movement} amount={userRanking.movementAmount} />
            </motion.div>
            <span className="text-[10px] font-condensed tracking-wider text-steel uppercase">
              LVL {userRanking.level}
            </span>
          </div>
        </div>

        {(userRanking.currentStreak !== undefined && userRanking.currentStreak > 0) && (
          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-crimson/20">
            <img 
              src={Icons3D.fire} 
              alt="" 
              className="w-7 h-7"
              style={{ filter: 'drop-shadow(0 2px 6px rgba(199, 255, 62, 0.4))' }}
            />
            <div className="flex items-center gap-2">
              <span className="font-condensed text-xs tracking-[0.15em] text-silver uppercase">
                Your Streak
              </span>
              <span className="font-stats text-lg text-mint-200 tabular-nums" data-testid="text-user-streak">
                {userRanking.currentStreak}
              </span>
              <span className="text-[10px] font-condensed tracking-wider text-steel uppercase">
                {userRanking.currentStreak === 1 ? 'day' : 'days'}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function HeatIndex() {
  const { profile } = useAuth();
  const [periodType, setPeriodType] = useState<PeriodType>("weekly");
  
  const { 
    data: rankingsResponse, 
    isLoading: rankingsLoading,
    isError: rankingsError,
    error: rankingsErrorObj
  } = useHeatRankings(periodType, 50);
  
  const { 
    data: userRankingResponse, 
    isLoading: userRankingLoading 
  } = useUserHeatRanking(profile?.id, periodType);

  const isLoading = rankingsLoading;
  
  const apiRankings = useMemo(() => {
    if (!rankingsResponse) return [];
    if (Array.isArray(rankingsResponse)) return rankingsResponse;
    if (rankingsResponse.rankings && Array.isArray(rankingsResponse.rankings)) {
      return rankingsResponse.rankings;
    }
    return [];
  }, [rankingsResponse]);

  const rankings: RankingEntry[] = useMemo(() => {
    if (apiRankings.length === 0) return [];
    
    return apiRankings.map((r: any, index: number) => ({
      id: r.id || r.userId || `rank-${index}`,
      rank: r.rank || index + 1,
      userId: r.userId || r.id,
      username: r.username || `member_${index}`,
      displayName: r.displayName || r.display_name || r.username || null,
      avatarUrl: r.avatarUrl || r.avatar_url || FALLBACK_AVATARS[index % FALLBACK_AVATARS.length],
      cred: r.cred || r.credBalance || 0,
      level: r.level || 1,
      movement: r.movement || "same",
      movementAmount: r.movementAmount || 0,
      previousRank: r.previousRank || null,
    }));
  }, [apiRankings]);

  const userRanking = useMemo(() => {
    if (!userRankingResponse) return null;
    const r = userRankingResponse.ranking || userRankingResponse;
    if (!r || !r.userId) return null;
    return {
      id: r.id || r.userId,
      rank: r.rank || 0,
      userId: r.userId,
      username: r.username || 'you',
      displayName: r.displayName || r.display_name || null,
      avatarUrl: r.avatarUrl || r.avatar_url || null,
      cred: r.cred || r.credBalance || 0,
      level: r.level || 1,
      movement: r.movement || "same",
      movementAmount: r.movementAmount || 0,
      previousRank: r.previousRank || null,
      currentStreak: r.currentStreak || r.streak || 0,
    } as RankingEntry;
  }, [userRankingResponse]);
  
  const resetHours = useMemo(() => getResetHours(periodType), [periodType]);
  const membersJoinedToday = useMemo(() => Math.floor(Math.random() * 12) + 3, []);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (rankingsError) {
    return (
      <div className="flex flex-col min-h-full app-ground pb-24">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center" data-testid="error-heat-index">
          <Icon3DImage icon="flame" size={40} className="mb-4" />
          <h3 className="font-display text-xl text-white mb-2">Failed to load rankings</h3>
          <p className="text-sm text-steel max-w-xs">
            {rankingsErrorObj instanceof Error ? rankingsErrorObj.message : "Something went wrong. Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  const periodOptions: { value: PeriodType; label: string }[] = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];

  return (
    <div className="flex flex-col min-h-full app-ground pb-24">
      <SEO 
        title="Heat Index | SAINTE"
        description="See who's rising in the SAINTE community. The Heat Index ranks members by their engagement and CRED score."
      />
      
      <header 
        className="relative px-6 pt-12 pb-8 overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(12,23,18,0.3) 0%, rgba(12,23,18,0.85) 60%, rgba(12,23,18,1) 100%), url(${heroImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-crimson/10 via-crimson/5 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black opacity-60" />
        <div className="hero-grain" aria-hidden />
        <span className="issue-serial absolute top-4 right-6 z-10" data-testid="text-issue-serial-heat">
          SAINTE / VOL 04 / RANK 0127
        </span>
        
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            <img 
              src={Icons3D.trophy} 
              alt="" 
              className="w-12 h-12"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(199, 255, 62, 0.3))' }}
            />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-3"
          >
            <span className="status-exclusive text-2xl md:text-3xl">HEAT INDEX</span>
          </motion.h1>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center gap-3"
          >
            <span className="gel-capsule">
              <span className="icon-halo"><Icon3DImage icon="clock" size={14} /></span>
              <span>Rankings reset in {resetHours}h</span>
            </span>
            
            <span className="gel-capsule">
              <span className="icon-halo"><Icon3DImage icon="community" size={14} /></span>
              <span className="font-stats tabular-nums">{rankings.length}</span>
              <span>members competing</span>
            </span>
          </motion.div>
        </div>
      </header>

      <div className="px-6 space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex justify-center gap-2"
        >
          {periodOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                hapticLight();
                setPeriodType(option.value);
              }}
              data-testid={`button-period-${option.value}`}
              className={cn(
                "gel-capsule",
                periodType === option.value && "gel-capsule--active"
              )}
            >
              {option.label}
            </button>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex items-center justify-center gap-3"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-2 h-2 rounded-full bg-emerald-500"
          />
          <span className="text-sm text-silver font-condensed tracking-wider">
            <span className="font-stats text-emerald-400 tabular-nums">{membersJoinedToday}</span> members joined today
          </span>
          <Icon3DImage icon="goals" size={16} />
        </motion.div>

        {profile && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Icon3DImage icon="flame" size={16} />
              <h2 className="font-condensed text-xs tracking-[0.2em] text-silver uppercase">
                Your Position
              </h2>
            </div>
            <UserRankingCard 
              userRanking={userRanking} 
              isLoading={userRankingLoading} 
              periodType={periodType}
            />
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-condensed text-xs tracking-[0.2em] text-silver uppercase">
              Top Rankings
            </h2>
            <GlowBadge variant="crimson" pulse>
              <span className="font-stats tabular-nums">{rankings.length}</span> Active
            </GlowBadge>
          </div>

          {rankings.length === 0 ? (
            <EditorialEmpty
              serial="SAINTE / HEAT / 00"
              label="throne is open — climb"
              testId="empty-heat"
            />
          ) : (
            <>
              {rankings.length >= 1 && (
                <Podium rankings={rankings} currentUserId={profile?.id} />
              )}
              <div className="space-y-3" data-testid="leaderboard-list">
                {rankings.slice(3).map((entry: RankingEntry, index: number) => (
                  <RankingRow
                    key={entry.id || entry.userId}
                    entry={entry}
                    isCurrentUser={profile?.id === entry.userId}
                    index={index}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="pt-4">
          <Clay3DCard className="p-6 text-center">
            <img 
              src={Icons3D.fire} 
              alt="" 
              className="w-10 h-10 mx-auto mb-3"
              style={{ filter: 'drop-shadow(0 4px 8px rgba(199, 255, 62, 0.4))' }}
            />
            <h3 className="font-display text-xl text-white mb-2">
              Climb The Ranks
            </h3>
            <p className="text-silver text-sm max-w-xs mx-auto">
              Complete daily rituals, engage with the community, and earn CRED to rise through the Heat Index.
            </p>
          </Clay3DCard>
        </section>
      </div>
    </div>
  );
}
