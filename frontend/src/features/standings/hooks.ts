// src/features/standings/hooks.ts
// 順位表 React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { standingApi } from './api';
import type { ResolveTiebreakerInput } from './types';

const QUERY_KEY = ['standings'];

export function useGroupStandings(tournamentId: number, groupId: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, { tournamentId, groupId }],
    queryFn: () => standingApi.getByGroup(tournamentId, groupId),
    enabled: !!tournamentId && !!groupId,
  });
}

export function useAllStandings(tournamentId: number) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'all', tournamentId],
    queryFn: () => standingApi.getAll(tournamentId),
    enabled: tournamentId > 0,
  });
}

/**
 * 総合順位表を取得（新フォーマット用）
 * 全グループの順位を統合し、総合順位を計算
 * ソート順: 勝点 -> 得失点差 -> 総得点
 * @param tournamentId 大会ID
 */
export function useOverallStandings(tournamentId: number) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'overall', tournamentId],
    queryFn: () => standingApi.getOverallStandings(tournamentId),
    enabled: tournamentId > 0,
  });
}

/**
 * 総合順位をDBに保存
 */
export function useSaveOverallRanks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tournamentId: number) => standingApi.saveOverallRanks(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * 順位表をクリア（全チーム0勝0敗0分にリセット）
 */
export function useClearStandings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tournamentId: number) => standingApi.clearStandings(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * 全グループの順位を一括再計算
 */
export function useRecalculateAllStandings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tournamentId: number) => standingApi.recalculateAll(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useRecalculateStandings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tournamentId, groupId }: { tournamentId: number; groupId?: string }) =>
      standingApi.recalculate(tournamentId, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useResolveTiebreaker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ResolveTiebreakerInput) => standingApi.resolveTiebreaker(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useTopScorers(tournamentId: number, limit = 10) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'top-scorers', tournamentId, limit],
    queryFn: () => standingApi.getTopScorers(tournamentId, limit),
    enabled: tournamentId > 0,
  });
}
