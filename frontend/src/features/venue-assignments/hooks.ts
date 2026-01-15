// src/features/venue-assignments/hooks.ts
// 会場割り当て React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { venueAssignmentApi } from './api';
import type {
  CreateVenueAssignmentInput,
  UpdateVenueAssignmentInput,
  AutoGenerateVenueAssignmentsInput,
} from './types';

const QUERY_KEY = ['venue-assignments'];

/**
 * 会場割り当て一覧取得
 * @param tournamentId 大会ID
 * @param matchDay 試合日（オプション）
 */
export function useVenueAssignments(tournamentId: number, matchDay?: number) {
  return useQuery({
    queryKey: [...QUERY_KEY, { tournamentId, matchDay }],
    queryFn: () => venueAssignmentApi.getByTournament(tournamentId, matchDay),
    enabled: tournamentId > 0,
  });
}

/**
 * 会場割り当て取得（ID指定）
 * @param id 会場割り当てID
 */
export function useVenueAssignment(id: number) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => venueAssignmentApi.getById(id),
    enabled: id > 0,
  });
}

/**
 * 会場割り当て作成
 */
export function useCreateVenueAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVenueAssignmentInput) =>
      venueAssignmentApi.create(data),
    onSuccess: (_, variables) => {
      // 関連するクエリを無効化
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, { tournamentId: variables.tournamentId }],
      });
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, { tournamentId: variables.tournamentId, matchDay: variables.matchDay }],
      });
    },
  });
}

/**
 * 会場割り当て更新
 */
export function useUpdateVenueAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateVenueAssignmentInput) =>
      venueAssignmentApi.update(data),
    onSuccess: (result) => {
      // 個別のキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, result.id] });
      // リスト全体も無効化
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * 会場割り当て削除
 */
export function useDeleteVenueAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => venueAssignmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * 会場割り当て一括削除（試合日指定）
 */
export function useDeleteVenueAssignmentsByMatchDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tournamentId, matchDay }: { tournamentId: number; matchDay: number }) =>
      venueAssignmentApi.deleteByMatchDay(tournamentId, matchDay),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, { tournamentId: variables.tournamentId }],
      });
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, { tournamentId: variables.tournamentId, matchDay: variables.matchDay }],
      });
    },
  });
}

/**
 * 会場割り当て自動生成
 */
export function useAutoGenerateVenueAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AutoGenerateVenueAssignmentsInput) =>
      venueAssignmentApi.autoGenerate(data),
    onSuccess: (_, variables) => {
      // 関連するクエリを無効化
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, { tournamentId: variables.tournamentId }],
      });
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, { tournamentId: variables.tournamentId, matchDay: variables.matchDay }],
      });
    },
  });
}
