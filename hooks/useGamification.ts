import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { triggerLevelUp, triggerBadgeUnlock, triggerStreakMilestone, triggerConfetti } from "@/lib/celebrations";

interface GamificationStats {
  level: number;
  xp: number;
  xpProgress: number;
  nextLevelXp: number;
  credBalance: number;
  currentStreak: number;
  longestStreak: number;
  badges: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    xpReward: number;
    earnedAt: string;
  }>;
  badgeCount: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: string;
  xpReward: number;
  isSecret: boolean;
  earned: boolean;
  isLocked: boolean;
}

interface LevelUpResult {
  previousLevel: number;
  newLevel: number;
  totalXp: number;
  nextLevelXp: number;
}

interface BadgeAward {
  badge: {
    id: string;
    name: string;
    description: string;
  };
  isNew: boolean;
}

interface ActionResult {
  success: boolean;
  credAwarded: number;
  xpAwarded: number;
  badgesAwarded: BadgeAward[];
  levelUp?: LevelUpResult;
  streakUpdated: boolean;
  newStreak: number;
  message: string;
}

interface StreakResult {
  success: boolean;
  streak: number;
  isNewDay: boolean;
  streakBroken: boolean;
  newBadges: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

type ActionType = 
  | "move_completed" 
  | "checkin" 
  | "drop_rsvp" 
  | "signal_posted"
  | "circle_help" 
  | "referral_completed" 
  | "vault_confession"
  | "daily_action";

export function useGamification(userId: string = "demo-user") {
  const queryClient = useQueryClient();

  const statsQuery = useQuery<GamificationStats>({
    queryKey: ["/api/gamification", userId],
    enabled: !!userId,
  });

  const badgesQuery = useQuery<Badge[]>({
    queryKey: ["/api/badges", { userId }],
    enabled: !!userId,
  });

  const processAction = useMutation({
    mutationFn: async ({ actionType, sourceId }: { actionType: ActionType; sourceId?: string }) => {
      const response = await apiRequest("POST", "/api/gamification/action", {
        userId,
        actionType,
        sourceId,
      });
      return response.json() as Promise<ActionResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/badges", { userId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "stats"] });
      
      if (data.levelUp) {
        triggerLevelUp(data.levelUp.newLevel);
      } else if (data.badgesAwarded.length > 0) {
        data.badgesAwarded.forEach((award, index) => {
          setTimeout(() => {
            triggerBadgeUnlock(award.badge.name);
          }, index * 2000);
        });
      } else if (data.credAwarded > 0) {
        triggerConfetti();
      }
    },
  });

  const updateStreak = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/gamification/streak", { userId });
      return response.json() as Promise<StreakResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "stats"] });
      
      const streakMilestones = [3, 7, 14, 21, 30, 60, 90, 180, 365];
      if (data.isNewDay && streakMilestones.includes(data.streak)) {
        triggerStreakMilestone(data.streak);
      }
      
      if (data.newBadges.length > 0) {
        data.newBadges.forEach((badge, index) => {
          setTimeout(() => {
            triggerBadgeUnlock(badge.name);
          }, index * 2000);
        });
      }
    },
  });

  const completeMove = async (moveId: string) => {
    return processAction.mutateAsync({ actionType: "move_completed", sourceId: moveId });
  };

  const checkIn = async () => {
    return processAction.mutateAsync({ actionType: "checkin" });
  };

  const claimDrop = async (dropId: string) => {
    return processAction.mutateAsync({ actionType: "drop_rsvp", sourceId: dropId });
  };

  const postSignal = async (signalId: string) => {
    return processAction.mutateAsync({ actionType: "signal_posted", sourceId: signalId });
  };

  const helpCircle = async (helpId: string) => {
    return processAction.mutateAsync({ actionType: "circle_help", sourceId: helpId });
  };

  const completeReferral = async (referralId: string) => {
    return processAction.mutateAsync({ actionType: "referral_completed", sourceId: referralId });
  };

  const postVaultConfession = async (confessionId: string) => {
    return processAction.mutateAsync({ actionType: "vault_confession", sourceId: confessionId });
  };

  return {
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    statsError: statsQuery.error,
    
    badges: badgesQuery.data,
    isLoadingBadges: badgesQuery.isLoading,
    
    completeMove,
    checkIn,
    claimDrop,
    postSignal,
    helpCircle,
    completeReferral,
    postVaultConfession,
    updateStreak: updateStreak.mutate,
    
    isPending: processAction.isPending || updateStreak.isPending,
  };
}

export function useDailyStreak(userId: string = "demo-user") {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/gamification/streak", { userId });
      return response.json() as Promise<StreakResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification", userId] });
      
      const streakMilestones = [3, 7, 14, 21, 30, 60, 90, 180, 365];
      if (data.isNewDay && streakMilestones.includes(data.streak)) {
        triggerStreakMilestone(data.streak);
      }
    },
  });
}
