// src/features/matches/hooks.ts
// 試合 React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { matchApi } from './api';
import type {
  MatchScoreInput,
  CreateMatchInput,
  MatchGenerateScheduleInput,
  MatchStage,
} from './types';

const QUERY_KEY = ['matches'];

/**
 * 試合一覧取得
 * @param params フィルタオプション
 *   - tournamentId: 大会ID
 *   - groupId: グループID
 *   - venueId: 会場ID
 *   - matchDate: 試合日（YYYY-MM-DD形式）
 *   - stage: 試合ステージ（preliminary, training, semifinal等）
 *   - isBMatch: B戦フィルタ（新フォーマット用）
 *   - matchDay: 試合日番号（新フォーマット用、1=1日目, 2=2日目...）
 */
export function useMatches(params?: {
  tournamentId?: number;
  groupId?: string;
  venueId?: number;
  matchDate?: string;
  stage?: MatchStage;
  isBMatch?: boolean;
  matchDay?: number;
}) {
  return useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: () => matchApi.getAll(params),
  });
}

export function useMatch(id: number) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => matchApi.getById(id),
    enabled: id > 0,
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMatchInput) => matchApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateMatchScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MatchScoreInput }) =>
      matchApi.updateScore(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
    },
  });
}

export function useDeleteMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => matchApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
    },
  });
}

export function useGenerateMatchSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MatchGenerateScheduleInput) => matchApi.generateSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
    },
  });
}

export function useGenerateTrainingMatches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tournamentId: number) => matchApi.generateTrainingMatches(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
    },
  });
}

export function useGenerateFinals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tournamentId: number) => matchApi.generateFinals(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
    },
  });
}

export function useApproveMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => matchApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
    },
  });
}

export function useRejectMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      matchApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
    },
  });
}

export function usePendingApprovalMatches(tournamentId: number) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'pending-approval', tournamentId],
    queryFn: () => matchApi.getPendingApproval(tournamentId),
    enabled: tournamentId > 0,
  });
}

export function useLockMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => matchApi.lock(id),
    onSuccess: (_, matchId) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, matchId] });
    },
  });
}

export function useUnlockMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, force }: { id: number; force?: boolean }) =>
      matchApi.unlock(id, force),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, variables.id] });
    },
  });
}
