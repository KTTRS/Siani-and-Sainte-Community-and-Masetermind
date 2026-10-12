import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PulseQuestion, Rhythm } from "@shared/schema";

interface PulseOption {
  value: string;
  label: string;
}

interface PulseQuestionWithOptions extends PulseQuestion {
  options: PulseOption[] | string;
}

interface AggregateResult {
  value: string;
  count: number;
  percentage: number;
}

interface PulseResponseResult {
  success: boolean;
  credGained: number;
  xpGained: number;
  aggregateResults: AggregateResult[];
  totalResponses: number;
  alreadyAnsweredToday?: boolean;
  questionId?: string;
}

interface RhythmCompleteResult {
  success: boolean;
  rhythm: Rhythm;
  credGained: number;
  xpGained: number;
}

export function useTodaysPulse() {
  return useQuery<{ question: PulseQuestionWithOptions | null }>({
    queryKey: ["/api/pulse/today"],
  });
}

export function usePulseRespond() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, response }: { questionId: string; response: string }) => {
      const res = await apiRequest("POST", "/api/pulse/respond", { questionId, response });
      return res.json() as Promise<PulseResponseResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pulse/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pulse/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cred"] });
    },
  });
}

export function useRhythms() {
  return useQuery<{ rhythms: Rhythm[] }>({
    queryKey: ["/api/rhythms"],
  });
}

export function useCompleteRhythm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rhythmId, note, mood }: { rhythmId: string; note?: string; mood?: number }) => {
      const res = await apiRequest("POST", `/api/rhythms/${rhythmId}/complete`, { note, mood });
      return res.json() as Promise<RhythmCompleteResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rhythms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cred"] });
    },
  });
}

export function useCredData() {
  return useQuery<{
    balance: number;
    transactions: Array<{
      id: string;
      amount: number;
      reason: string;
      sourceType: string | null;
      sourceId: string | null;
      createdAt: string;
    }>;
    level: number;
    streak: number;
  }>({
    queryKey: ["/api/cred"],
  });
}
