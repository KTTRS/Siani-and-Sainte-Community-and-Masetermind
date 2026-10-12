import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";

async function authFetch(url: string): Promise<Response> {
  const headers: Record<string, string> = {};
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {}
  const response = await fetch(url, { credentials: "include", headers });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface StreakFreezeData {
  available: number;
  used: number;
  lastUsedAt?: string;
}

export interface RecoveryQuestData {
  active: boolean;
  questId?: string;
  progress: number;
  total: number;
  streakBroken: boolean;
  challenge?: string;
  expiresAt?: string;
}

export interface SianiNudge {
  id: string;
  nudgeType: 'streak_warning' | 'goal_nudge' | 'celebration' | 'check_in';
  message: string;
  actionUrl?: string;
  urgency: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface VaultConfession {
  id: string;
  content: string;
  isAnonymous: boolean;
  displayName?: string;
  mood?: string;
  reactions: { fire: number; heart: number; strength: number };
  createdAt: string;
}

export interface HeatRanking {
  id: string;
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  cred: number;
  level: number;
  movement: number;
  periodType: 'daily' | 'weekly' | 'monthly';
}

// ============================================================================
// STREAK FREEZES
// ============================================================================

export function useStreakFreezes(userId: string | undefined) {
  return useQuery<StreakFreezeData>({
    queryKey: ["/api/users", userId, "streak-freezes"],
    queryFn: async () => {
      const response = await authFetch(`/api/users/${userId}/streak-freezes`);
      return response.json();
    },
    enabled: !!userId,
  });
}

export function useStreakFreeze() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest("POST", `/api/users/${userId}/streak-freezes/use`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", variables.userId, "streak-freezes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification", variables.userId] });
    },
  });
}

// ============================================================================
// RECOVERY QUESTS
// ============================================================================

export function useRecoveryQuest(userId: string | undefined) {
  return useQuery<RecoveryQuestData>({
    queryKey: ["/api/users", userId, "recovery-quest"],
    queryFn: async () => {
      const response = await authFetch(`/api/users/${userId}/recovery-quest`);
      return response.json();
    },
    enabled: !!userId,
  });
}

export function useStartRecoveryQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, lostStreak }: { userId: string; lostStreak: number }) => {
      const response = await apiRequest("POST", `/api/users/${userId}/recovery-quest`, { lostStreak });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", variables.userId, "recovery-quest"] });
    },
  });
}

export function useCompleteRecoveryQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, questId }: { userId: string; questId: string }) => {
      const response = await apiRequest("POST", `/api/users/${userId}/recovery-quest/${questId}/complete`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", variables.userId, "recovery-quest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification", variables.userId] });
    },
  });
}

// ============================================================================
// SIANI NUDGES
// ============================================================================

export function useSianiNudges(userId: string | undefined) {
  return useQuery<SianiNudge[]>({
    queryKey: ["/api/siani/nudges", userId],
    queryFn: async () => {
      const response = await authFetch(`/api/siani/nudges/${userId}`);
      const data = await response.json();
      // API returns { nudges: SianiNudge[], count: number } — unwrap to array.
      // Tolerate older/alt shapes that returned a bare array.
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.nudges)) return data.nudges;
      return [];
    },
    enabled: !!userId,
  });
}

export function useMarkNudgeSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, nudgeId }: { userId: string; nudgeId: string }) => {
      const response = await apiRequest("POST", `/api/siani/nudges/${nudgeId}/seen`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/siani/nudges", variables.userId] });
    },
  });
}

// ============================================================================
// VAULT CONFESSIONS
// ============================================================================

export function useVaultConfessions(limit?: number) {
  const queryParams = limit ? `?limit=${limit}` : "";
  return useQuery({
    queryKey: ["/api/vault/confessions", { limit }],
    queryFn: async () => {
      const response = await authFetch(`/api/vault/confessions${queryParams}`);
      return response.json();
    },
  });
}

export function useCreateConfession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { content: string; isAnonymous?: boolean }) => {
      const response = await apiRequest("POST", "/api/vault/confessions", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vault/confessions"] });
    },
  });
}

export function useReactToConfession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ confessionId, reaction }: { confessionId: string; reaction: string }) => {
      const response = await apiRequest("POST", `/api/vault/confessions/${confessionId}/react`, { reaction });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vault/confessions"] });
    },
  });
}

// ============================================================================
// HEAT RANKINGS
// ============================================================================

export function useHeatRankings(periodType?: string, limit?: number) {
  const params = new URLSearchParams();
  if (periodType) params.append("period", periodType);
  if (limit) params.append("limit", limit.toString());
  const queryString = params.toString();

  return useQuery({
    queryKey: ["/api/heat/rankings", { periodType, limit }],
    queryFn: async () => {
      const url = queryString ? `/api/heat/rankings?${queryString}` : "/api/heat/rankings";
      try {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          console.warn("Heat rankings endpoint returned error, using fallback");
          return { rankings: [], periodType, totalMembers: 0 };
        }
        return response.json();
      } catch (error) {
        console.warn("Failed to fetch heat rankings, using fallback");
        return { rankings: [], periodType, totalMembers: 0 };
      }
    },
    retry: false,
  });
}

export function useUserHeatRanking(userId: string | undefined, periodType?: string) {
  return useQuery({
    queryKey: ["/api/heat/rankings/user", userId, { periodType }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (periodType) params.append("period", periodType);
      const queryString = params.toString();
      const url = queryString ? `/api/heat/rankings?${queryString}` : "/api/heat/rankings";
      
      try {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          return { ranking: null };
        }
        const data = await response.json();
        return { ranking: data.userRank || null };
      } catch (error) {
        return { ranking: null };
      }
    },
    enabled: !!userId,
    retry: false,
  });
}

// ============================================================================
// MEMBERSHIP KEY
// ============================================================================

export interface MembershipData {
  hasMembership: boolean;
  isActive: boolean;
  card: {
    serialNumber: string;
    memberSince: string;
    tier: string;
    cardDesign?: string;
    totalCheckins: number;
    lastUsedAt?: string;
  };
  member: {
    displayName: string;
    username?: string;
    credBalance: number;
    level: number;
    avatarUrl?: string;
  };
  qrData: {
    token: string;
    expiresAt: string;
  };
}

export function useMembershipKey() {
  return useQuery<MembershipData>({
    queryKey: ["/api/membership/card"],
    queryFn: async () => {
      const response = await authFetch("/api/membership/card");
      return response.json();
    },
  });
}

