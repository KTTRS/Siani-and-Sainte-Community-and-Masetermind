import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, SPRING, EASE, DURATION } from "@/lib/motion";
import { useLocation } from "wouter";
import { SEO, PAGE_SEO } from "@/components/SEO";
import { 
  ChevronRight, 
  Headphones,
  ArrowUpRight,
  ArrowDownRight,
  LogOut,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { MomentumBar } from "@/components/MomentumBar";
import { PrestigeCrest } from "@/components/PrestigeCrest";
import { LevelLadder } from "@/components/LevelLadder";
import { useCredData } from "@/hooks/useDailyLoop";
import { useGamification, type Badge as GamificationBadge } from "@/hooks/useGamification";
import type { User } from "@shared/schema";
import { Icons3D } from "@/lib/icons3d";
import { haptic } from "@/lib/haptics";

import heroImg from "@assets/generated_images/sainte_dark_abstract_1.png";
import celebrationImg from "@assets/generated_images/sainte_club_clean.png";
import luxuryOfficeImg from "@assets/generated_images/sainte_flatlay_clean.png";
import musicStudioImg from "@assets/generated_images/sainte_studio_dark.png";

import trophyIcon1 from "@/assets/trophy-icons/asset-1.svg";
import trophyIcon2 from "@/assets/trophy-icons/asset-2.svg";
import trophyIcon3 from "@/assets/trophy-icons/asset-3.svg";
import trophyIcon4 from "@/assets/trophy-icons/asset-4.svg";


interface MemberProfile {
  memberSince: string;
  membershipTier: string;
  location: string;
  interests: string[];
}

interface UserStats {
  xp: number;
  level: number;
  xpForNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  movesCompleted: number;
  challengesCompleted: number;
  pulseScore: number;
  prizesWon: number;
  memberSince: string;
}

interface AccessRecord {
  id: string;
  type: "drop" | "room" | "event";
  title: string;
  date: string;
  status: "attended" | "rsvp" | "waitlist";
}

export default function Profile() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { profile: authProfile, signOut } = useAuth();
  const userId = authProfile?.id || "demo-user";
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      haptic('warn');
      await signOut();
      navigate("/login");
    } catch {
      toast({
        title: "Logout failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const { data: user, isLoading: isUserLoading, error: userError } = useQuery<User>({
    queryKey: ["/api/users", userId],
  });

  const { data: profile, isLoading: isProfileLoading } = useQuery<MemberProfile>({
    queryKey: ["/api/users", userId, "profile"],
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery<UserStats>({
    queryKey: ["/api/users", userId, "stats"],
  });

  const { data: credData } = useCredData();
  const { badges: badgesList } = useGamification(userId);

  const isLoading = isUserLoading || isProfileLoading || isStatsLoading;

  const formatMemberSince = (dateStr: string | undefined) => {
    if (!dateStr) return "2024";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const getCircleRank = (pulseScore: number) => {
    if (pulseScore >= 1000) return "Elite";
    if (pulseScore >= 500) return "Rising";
    if (pulseScore >= 100) return "Active";
    return "New";
  };

  const accessHistory: AccessRecord[] = [
    { id: "1", type: "drop", title: "Private Screening: Dune III", date: "2024-11-15", status: "attended" },
    { id: "2", type: "room", title: "Members Lounge NYC", date: "2024-11-10", status: "attended" },
    { id: "3", type: "event", title: "Rooftop Session w/ DJ Premier", date: "2024-12-01", status: "rsvp" },
  ];

  if (userError) {
    return (
      <div className="flex flex-col items-center justify-center h-full app-ground px-fluid py-12">
        <div className="text-center">
          <p className="text-fluid-label text-muted font-bold mb-4">Connection Lost</p>
          <h2 className="text-fluid-headline font-black text-white mb-4">
            Unable to load your dossier
          </h2>
          <p className="text-fluid-body text-silver mb-6">
            We couldn't retrieve your member profile at this time.
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="btn-crimson touch-target"
            data-testid="button-retry"
          >
            Reconnect
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full app-ground">
        <div className="px-fluid py-8">
          <div className="flex flex-col items-center">
            <Skeleton className="w-24 h-24 rounded-full surface-flat mb-4" />
            <Skeleton className="h-8 w-40 rounded-card surface-flat mb-2" />
            <Skeleton className="h-4 w-32 bg-smoke" />
          </div>
        </div>
        <div className="px-fluid py-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 rounded-card surface-flat" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayName = user?.displayName || "Member";
  const memberTier = profile?.membershipTier || "Founding Member";
  const memberLocation = profile?.location || "New York";
  const memberInterests = profile?.interests || ["Culture", "Experiences", "Access"];

  return (
    <div className="page-container app-ground">
      <SEO {...PAGE_SEO.profile} />
      <div className="page-content">
      {/* Hero Section with Background Image */}
      <div className="relative">
        {/* Background Image */}
        <div className="absolute inset-0 h-[50vh] min-h-[320px]">
          <img 
            src={heroImg} 
            alt="" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/50" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-transparent" />
        </div>
        
        {/* Profile Content */}
        <motion.header 
          className="relative z-10 pt-12 pb-8 px-fluid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fadeUp()}
        >
          <div className="flex flex-col items-center text-center">
            
            {/* Prestige Crest with XP Ring */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={fadeUp(0.1)}
              className="relative mb-4"
            >
              <PrestigeCrest
                level={stats?.level || 1}
                xp={stats?.xp || 0}
                xpForNextLevel={stats?.xpForNextLevel || 750}
                tier={memberTier}
              />
              
              {/* Avatar overlay in center - smaller */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Avatar className="w-14 h-14 border-2 border-smoke/50 shadow-premium opacity-100">
                  <AvatarImage src={user?.avatarUrl || ""} />
                  <AvatarFallback className="bg-charcoal text-silver text-xl font-black">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              {/* Tier badge */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                <Badge className="badge-crimson font-bold text-[10px] px-2 py-0.5 whitespace-nowrap flex items-center gap-1">
                  <img src={Icons3D.crown} alt="" className="w-4 h-4 object-contain" />
                  {memberTier}
                </Badge>
              </div>
            </motion.div>

            {/* Name */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={fadeUp(0.2)}
              className="space-y-2"
            >
              <h1 
                className="text-broken-display text-fluid-display text-white"
                data-testid="text-member-name"
              >
                {displayName}
              </h1>
              
              <div className="flex items-center justify-center gap-4 text-silver">
                <span className="flex items-center gap-1 text-fluid-caption">
                  <img src={Icons3D.location} alt="" aria-hidden className="w-3.5 h-3.5 object-contain icon-shadow-subtle" />
                  {memberLocation}
                </span>
                <span className="flex items-center gap-1.5 text-fluid-caption">
                  <img src={Icons3D.calendar} alt="" className="w-4 h-4 object-contain icon-shadow-subtle" />
                  Since {formatMemberSince(profile?.memberSince)}
                </span>
              </div>
            </motion.div>
          </div>
        </motion.header>
      </div>

      {/* Momentum Bar - Premium XP Progress with 3D depth */}
      <motion.section 
        className="px-fluid py-4 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeUp(0.25)}
      >
        <div 
          className="card-float-crimson p-5 rounded-2xl overflow-visible"
          data-testid="card-momentum-bar"
        >
          <MomentumBar
            currentXP={stats?.xp || 0}
            xpForNextLevel={stats?.xpForNextLevel || 750}
            level={stats?.level || 1}
            streak={stats?.currentStreak}
          />
        </div>
      </motion.section>

      {/* Stats Grid - Compact 4-column with premium 3D depth */}
      <motion.section 
        className="px-fluid py-4 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeUp(0.3)}
      >
        <div className="grid grid-cols-4 gap-3">
          <motion.div 
            className="stat-block-3d p-3 text-center rounded-xl"
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ y: 1, scale: 0.98 }}
            data-testid="card-momentum-xp"
          >
            <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <img src={Icons3D.zap} alt="" className="w-10 h-10 object-contain" />
            </div>
            <p className="font-stats text-lg font-semibold text-white tabular-nums">
              {(stats?.xp || 0).toLocaleString()}
            </p>
            <p className="font-condensed text-[9px] tracking-wide text-silver mt-0.5 uppercase">
              XP
            </p>
          </motion.div>

          <motion.div 
            className="stat-block-3d p-3 text-center rounded-xl"
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ y: 1, scale: 0.98 }}
            data-testid="card-momentum-moves"
          >
            <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <img src={trophyIcon1} alt="" className="w-10 h-10" />
            </div>
            <p className="font-stats text-lg font-semibold text-white tabular-nums">
              {stats?.movesCompleted || 0}
            </p>
            <p className="font-condensed text-[9px] tracking-wide text-silver mt-0.5 uppercase">
              Moves
            </p>
          </motion.div>

          <motion.div 
            className={`stat-block-3d p-3 text-center rounded-xl ${
              stats?.currentStreak && stats.currentStreak >= 7 
                ? 'stat-block-3d-accent' 
                : ''
            }`}
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ y: 1, scale: 0.98 }}
            data-testid="card-momentum-streak"
          >
            <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <img src={Icons3D.fire} alt="" className="w-10 h-10 object-contain" />
            </div>
            <p className="font-stats text-lg font-semibold text-white tabular-nums">
              {stats?.currentStreak || 0}
            </p>
            <p className="font-condensed text-[9px] tracking-wide text-silver mt-0.5 uppercase">
              Streak
            </p>
          </motion.div>

          <motion.div 
            className="stat-block-3d p-3 text-center rounded-xl"
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ y: 1, scale: 0.98 }}
            data-testid="card-momentum-cred"
          >
            <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <img src={Icons3D.money} alt="" className="w-10 h-10 object-contain" />
            </div>
            <p className="font-stats text-lg font-semibold text-white tabular-nums">
              {(user?.credBalance || 0).toLocaleString()}
            </p>
            <p className="font-condensed text-[9px] tracking-wide text-silver mt-0.5 uppercase">
              CRED
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* Circle Rank Banner - Floating depth with photo background */}
      <motion.section 
        className="px-fluid py-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeUp(0.35)}
      >
        <div className="relative overflow-hidden rounded-2xl" data-testid="card-circle-rank">
          <div className="absolute inset-0">
            <img 
              src={celebrationImg} 
              alt="" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/70" />
          </div>
          
          <div className="relative z-10 p-5">
            <div className="absolute -top-0 left-0 right-0 flex justify-start">
              <Badge className="badge-crimson font-condensed text-[10px] px-3 py-1 flex items-center gap-1.5 whitespace-nowrap rounded-none rounded-br-lg">
                <img src={trophyIcon4} alt="" className="w-4 h-4" />
                <span className="tracking-wide">CIRCLE STATUS</span>
              </Badge>
            </div>
            
            <div className="flex items-center justify-between gap-4 pt-6">
              <div className="flex-1 min-w-0">
                <h3 className="text-broken-display text-2xl text-white mb-1">
                  {getCircleRank(stats?.pulseScore || 0)}
                </h3>
                <p className="text-sm text-silver">
                  {stats?.pulseScore && stats.pulseScore >= 100 
                    ? "Your momentum is building" 
                    : "Start making moves to build momentum"}
                </p>
              </div>
              <div className="w-14 h-14 rounded-full bg-crimson/30 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-crimson/50">
                <img src={Icons3D.crown} alt="" className="w-10 h-10 object-contain" />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Level Ladder - Next Unlocks with 3D depth and photo background */}
      <motion.section 
        className="px-fluid py-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeUp(0.38)}
      >
        <div 
          className="relative overflow-hidden rounded-2xl"
          data-testid="card-level-ladder"
        >
          <div className="absolute inset-0">
            <img 
              src={luxuryOfficeImg} 
              alt="" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-black/75" />
          </div>
          <div className="relative z-10 p-5">
            <LevelLadder currentLevel={stats?.level || 1} />
          </div>
        </div>
      </motion.section>

      {/* CRED Economy Section */}
      <motion.section 
        className="px-fluid py-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeUp(0.38)}
      >
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <p className="section-header">CRED ECONOMY</p>
            <h2 className="text-fluid-title font-black text-white">Your Balance</h2>
          </div>
        </div>

        <div className="rounded-2xl matte-3d p-5" data-testid="card-cred-economy">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl matte-3d flex items-center justify-center">
                <img src={Icons3D.money} alt="" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <p className="font-stats text-2xl font-black text-white tabular-nums" data-testid="text-cred-balance">
                  {(credData?.balance || user?.credBalance || 0).toLocaleString()}
                </p>
                <p className="font-condensed text-[10px] tracking-wider text-silver uppercase">CRED BALANCE</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-fluid-caption text-silver">Level {credData?.level || stats?.level || 1}</p>
              <div className="flex items-center gap-1 text-[10px] text-steel-400">
                <img src={Icons3D.fire} alt="" aria-hidden className="w-3.5 h-3.5 object-contain icon-shadow-subtle" />
                <span>{credData?.streak || stats?.currentStreak || 0} day streak</span>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          {credData?.transactions && credData.transactions.length > 0 && (
            <div>
              <p className="font-condensed text-[9px] tracking-[0.2em] text-earth-5 mb-2 uppercase">RECENT TRANSACTIONS</p>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {credData.transactions.slice(0, 8).map((tx) => {
                  const isPositive = tx.amount > 0;
                  const reasonLabel: Record<string, string> = {
                    pulse_response: "Pulse Answer",
                    rhythm_complete: "Rhythm Complete",
                    action_complete: "Action Complete",
                    loop_closed: "Loop Closed",
                    circle_help: "Circle Help",
                    daily_checkin: "Daily Check-in",
                    checkin: "Check-in",
                    referral: "Referral",
                    badge: "Badge Earned",
                    feed_reaction: "Feed Reaction",
                  };
                  return (
                    <div 
                      key={tx.id} 
                      className="flex items-center gap-3 py-1.5 px-2 rounded-card surface-flat"
                      data-testid={`cred-tx-${tx.id}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isPositive ? 'bg-crimson/20' : 'bg-steel-600/20'
                      }`}>
                        {isPositive ? (
                          <ArrowUpRight className="w-3 h-3 text-crimson" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 text-steel-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-steel-200 font-medium truncate">
                          {reasonLabel[tx.reason] || tx.reason}
                        </p>
                        <p className="text-[9px] text-steel-500">
                          {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <span className={`text-[11px] font-black tabular-nums ${
                        isPositive ? 'text-crimson' : 'text-steel-400'
                      }`}>
                        {isPositive ? '+' : ''}{tx.amount}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* Badges Section */}
      {badgesList && badgesList.length > 0 && (
        <motion.section 
          className="px-fluid py-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp(0.4)}
        >
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <p className="section-header">ACHIEVEMENTS</p>
              <h2 className="text-fluid-title font-black text-white">Badges</h2>
            </div>
            <span className="text-[10px] text-steel-400">
              {badgesList.filter((b: GamificationBadge) => b.earned).length}/{badgesList.length} earned
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2" data-testid="badges-grid">
            {badgesList.slice(0, 12).map((badge: GamificationBadge) => (
              <motion.div
                key={badge.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (badge.earned) {
                    haptic('tap');
                    toast({ title: badge.name, description: badge.description || "Badge earned!" });
                  }
                }}
                className={`rounded-xl p-3 text-center ${
                  badge.earned 
                    ? 'matte-3d cursor-pointer' 
                    : 'rounded-card surface-flat opacity-40'
                }`}
                data-testid={`badge-${badge.id}`}
              >
                <div className="w-10 h-10 mx-auto mb-1 flex items-center justify-center">
                  <img
                    src={Icons3D.medal}
                    alt=""
                    aria-hidden
                    className="w-8 h-8 object-contain"
                    style={{ opacity: badge.earned ? 1 : 0.35, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                  />
                </div>
                <p className={`text-[9px] font-bold truncate ${
                  badge.earned ? 'text-steel-200' : 'text-steel-600'
                }`}>
                  {badge.isLocked ? "???" : badge.name}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Access Ledger */}
      <motion.section 
        className="px-fluid py-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeUp(0.45)}
      >
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <p className="section-header">
              Your Access
            </p>
            <h2 className="text-fluid-title font-black text-white">
              Recent Activity
            </h2>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-secondary-bright hover:text-white text-fluid-label font-bold"
            data-testid="button-view-all-access"
            onClick={() => { haptic('click'); navigate("/flow"); }}
          >
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <div className="space-y-2">
          {accessHistory.map((record, index) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + index * 0.05 }}
            >
              <div 
                className="list-item-3d rimlight-top p-4 rounded-xl cursor-pointer"
                data-testid={`card-access-${record.id}`}
                onClick={() => {
                  haptic('tap');
                  toast({
                    title: record.title,
                    description: `${record.status === "attended" ? "You attended this event" : record.status === "rsvp" ? "You're confirmed for this" : "You're on the waitlist"}`
                  });
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="icon-capsule w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0">
                    {record.type === "drop" && <img src={Icons3D.ticket} alt="" className="w-7 h-7 object-contain icon-shadow" />}
                    {record.type === "room" && <img src={Icons3D.community} alt="" className="w-7 h-7 object-contain icon-shadow" />}
                    {record.type === "event" && <img src={Icons3D.star} alt="" className="w-7 h-7 object-contain icon-shadow" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-fluid-body font-bold text-primary-bright leading-tight">{record.title}</p>
                    <p className="text-fluid-label text-tertiary-bright">
                      {new Date(record.date).toLocaleDateString("en-US", { 
                        month: "short", 
                        day: "numeric"
                      })}
                    </p>
                  </div>
                  <span 
                    className={`text-[10px] font-bold flex-shrink-0 px-3 py-1.5 rounded-full ${
                      record.status === "attended" 
                        ? "badge-success-3d" 
                        : record.status === "rsvp"
                        ? "badge-pending-3d"
                        : "badge-metallic"
                    }`}
                  >
                    {record.status === "attended" ? "Cleared" : record.status === "rsvp" ? "Confirmed" : "Waitlist"}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Interests / Affinity */}
      <motion.section 
        className="px-fluid py-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeUp(0.5)}
      >
        <p className="section-header mb-3">
          Your Affinities
        </p>
        <div className="flex flex-wrap gap-2" data-testid="text-member-interests">
          {memberInterests.map((interest, index) => (
            <span 
              key={index}
              className="pill-3d font-condensed text-fluid-caption px-4 py-2.5 rounded-full text-primary-bright"
            >
              {interest}
            </span>
          ))}
        </div>
      </motion.section>

      {/* Settings & Concierge */}
      <motion.section 
        className="px-fluid py-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeUp(0.55)}
      >
        <div className="space-y-3">
          <div 
            className="settings-row p-4 rounded-xl cursor-pointer"
            onClick={() => { haptic('click'); navigate("/settings"); }}
            data-testid="button-account-settings"
          >
            <div className="flex items-center gap-3">
              <div className="icon-capsule w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0">
                <img src={Icons3D.settings} alt="" className="w-7 h-7 object-contain icon-shadow" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-fluid-body font-bold text-primary-bright">Account Settings</p>
                <p className="text-fluid-label text-tertiary-bright">Manage your preferences</p>
              </div>
              <ChevronRight className="w-5 h-5 text-tertiary-bright flex-shrink-0" />
            </div>
          </div>

          <div 
            className="settings-row p-4 rounded-xl cursor-pointer"
            onClick={() => { haptic('click'); navigate("/concierge"); }}
            data-testid="button-concierge"
          >
            <div className="flex items-center gap-3">
              <div className="icon-capsule w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0">
                <Headphones className="w-5 h-5 text-secondary-bright" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-fluid-body font-bold text-primary-bright">Concierge Line</p>
                <p className="text-fluid-label text-tertiary-bright">Direct access to your team</p>
              </div>
              <ChevronRight className="w-5 h-5 text-tertiary-bright flex-shrink-0" />
            </div>
          </div>

          <div 
            className="settings-row p-4 rounded-xl cursor-pointer"
            onClick={() => { haptic('click'); navigate("/privacy"); }}
            data-testid="button-privacy"
          >
            <div className="flex items-center gap-3">
              <div className="icon-capsule w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0">
                <img src={Icons3D.shield} alt="" className="w-7 h-7 object-contain icon-shadow" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-fluid-body font-bold text-primary-bright">Privacy & Security</p>
                <p className="text-fluid-label text-tertiary-bright">Data & permissions</p>
              </div>
              <ChevronRight className="w-5 h-5 text-tertiary-bright flex-shrink-0" />
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <div
                className="settings-row p-4 rounded-xl cursor-pointer"
                onClick={() => haptic('soft')}
                data-testid="button-logout"
              >
                <div className="flex items-center gap-3">
                  <div className="icon-capsule w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0">
                    {isLoggingOut ? (
                      <Loader2 className="w-5 h-5 text-tertiary-bright animate-spin" />
                    ) : (
                      <LogOut className="w-5 h-5 text-tertiary-bright" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-fluid-body font-bold text-primary-bright">Log Out</p>
                    <p className="text-fluid-label text-tertiary-bright">End this session</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-tertiary-bright flex-shrink-0" />
                </div>
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Log out of SAINTE?</AlertDialogTitle>
                <AlertDialogDescription>
                  You'll need to sign back in to access the club, your CRED, and Siani.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-logout-cancel">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  data-testid="button-logout-confirm"
                >
                  {isLoggingOut ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging out…</>
                  ) : (
                    'Log Out'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </motion.section>

      {/* Footer - minimal spacing */}
      <motion.footer 
        className="px-fluid py-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fadeUp(0.6)}
      >
        <p className="text-fluid-label text-muted font-bold">
          SAINTE
        </p>
        <p className="text-fluid-label text-muted/50">
          Exclusive Members Club
        </p>
      </motion.footer>
      </div>
    </div>
  );
}
