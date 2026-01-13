import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { matchesApi, teamsApi, tournamentsApi } from '@/lib/api';
import { standingApi } from '@/features/standings/api';
import type { OverallStandings } from '@/features/standings/types';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StarTable from '../../components/StarTable';

export default function PublicStandings() {
    const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C' | 'D' | 'overall'>('A');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const tournamentId = 1; // デフォルトの大会ID

    // チーム一覧を取得
    const { data: teamsData, isLoading: isLoadingTeams, refetch: refetchTeams, error: teamsError } = useQuery({
        queryKey: ['public-teams', tournamentId],
        queryFn: async () => {
            const data = await teamsApi.getAll(tournamentId);
            return data?.teams || [];
        },
        staleTime: 30000,
        retry: 2,
    });

    // 試合一覧を取得
    const { data: matchesData, isLoading: isLoadingMatches, refetch: refetchMatches, error: matchesError } = useQuery({
        queryKey: ['public-matches', tournamentId],
        queryFn: async () => {
            const data = await matchesApi.getAll(tournamentId);
            return data?.matches || [];
        },
        staleTime: 30000,
        retry: 2,
    });

    // 大会設定を取得
    const { data: tournament } = useQuery({
        queryKey: ['public-tournament', tournamentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tournaments')
                .select('*')
                .eq('id', tournamentId)
                .single();
            if (error) throw error;
            return data;
        },
        staleTime: 60000,
        retry: 2,
    });

    const isOverallRanking = tournament?.qualification_rule === 'overall_ranking';

    // 総合順位を取得（総合タブまたは総合順位ルールの場合）
    const { data: overallStandings, isLoading: isLoadingOverall, refetch: refetchOverall } = useQuery<OverallStandings>({
        queryKey: ['public-overall-standings', tournamentId],
        queryFn: () => standingApi.getOverallStandings(tournamentId),
        staleTime: 30000,
        retry: 2,
        enabled: activeTab === 'overall' || isOverallRanking,
    });

    // 総合順位マップを作成
    const overallRankingsMap = useMemo(() => {
        if (!overallStandings?.entries) return undefined;
        const map = new Map<number, number>();
        overallStandings.entries.forEach(entry => {
            map.set(entry.teamId, entry.overallRank);
        });
        return map;
    }, [overallStandings]);

    // データ更新関数
    const refreshData = useCallback(async () => {
        await Promise.all([refetchTeams(), refetchMatches()]);
        if (activeTab === 'overall') {
            await refetchOverall();
        }
        setLastUpdated(new Date());
    }, [refetchTeams, refetchMatches, refetchOverall, activeTab]);

    // 初回読み込み時に更新時刻を設定
    useEffect(() => {
        if (teamsData && matchesData) {
            setLastUpdated(new Date());
        }
    }, [teamsData, matchesData]);

    // 30秒ごとに自動更新
    useEffect(() => {
        const interval = setInterval(() => {
            refreshData();
        }, 30000);
        return () => clearInterval(interval);
    }, [refreshData]);

    const isLoading = isLoadingTeams || isLoadingMatches || (activeTab === 'overall' && isLoadingOverall);
    const hasError = teamsError || matchesError;

    if (isLoading) {
        return <div className="flex justify-center py-10"><LoadingSpinner /></div>;
    }

    if (hasError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg max-w-sm w-full">
                    <p className="font-bold mb-2">データの読み込みに失敗しました</p>
                    <p className="text-sm mb-4 text-gray-600">
                        通信状況を確認の上、再読み込みしてください。
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                    >
                        再読み込み
                    </button>
                </div>
            </div>
        );
    }

    // グループごとのチームと試合を抽出
    const groupTeams = activeTab !== 'overall'
        ? (teamsData || []).filter((t: any) => (t.group_id || t.groupId) === activeTab)
        : [];
    const groupMatches = activeTab !== 'overall'
        ? (matchesData || []).filter((m: any) => (m.group_id || m.groupId) === activeTab && m.stage === 'preliminary')
        : [];

    return (
        <div className="space-y-4 pb-20">
            <h1 className="text-xl font-bold text-gray-800 px-1">予選リーグ 星取表</h1>

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                {(['A', 'B', 'C', 'D', 'overall'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === tab
                            ? tab === 'overall'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-white text-red-600 shadow-sm'
                            : 'text-gray-500 hover:bg-gray-200'
                            }`}
                    >
                        {tab === 'overall' ? '総合' : `${tab}グループ`}
                    </button>
                ))}
            </div>

            {/* コンテンツ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-4">
                {activeTab === 'overall' ? (
                    // 総合順位表
                    overallStandings && overallStandings.entries.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="px-2 py-2 text-center w-12">順位</th>
                                        <th className="px-2 py-2 text-left">チーム</th>
                                        <th className="px-2 py-2 text-center w-12">G</th>
                                        <th className="px-2 py-2 text-center w-10">試</th>
                                        <th className="px-2 py-2 text-center w-10">勝</th>
                                        <th className="px-2 py-2 text-center w-10">分</th>
                                        <th className="px-2 py-2 text-center w-10">負</th>
                                        <th className="px-2 py-2 text-center w-12">得失</th>
                                        <th className="px-2 py-2 text-center w-12 font-bold">勝点</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {overallStandings.entries.map((entry) => {
                                        const isQualifying = entry.overallRank <= overallStandings.qualifyingCount;
                                        return (
                                            <tr
                                                key={entry.teamId}
                                                className={`border-b ${isQualifying ? 'bg-amber-50' : ''}`}
                                            >
                                                <td className="px-2 py-2 text-center font-bold">
                                                    {isQualifying && (
                                                        <span className="inline-block w-6 h-6 bg-amber-500 text-white rounded-full leading-6 text-xs mr-1">
                                                            {entry.overallRank}
                                                        </span>
                                                    )}
                                                    {!isQualifying && entry.overallRank}
                                                </td>
                                                <td className="px-2 py-2 font-medium">
                                                    {entry.shortName || entry.teamName}
                                                </td>
                                                <td className="px-2 py-2 text-center text-xs text-gray-500">
                                                    {entry.groupId}
                                                </td>
                                                <td className="px-2 py-2 text-center">{entry.played}</td>
                                                <td className="px-2 py-2 text-center text-green-600">{entry.won}</td>
                                                <td className="px-2 py-2 text-center text-gray-500">{entry.drawn}</td>
                                                <td className="px-2 py-2 text-center text-red-500">{entry.lost}</td>
                                                <td className="px-2 py-2 text-center">
                                                    <span className={entry.goalDifference > 0 ? 'text-green-600' : entry.goalDifference < 0 ? 'text-red-500' : ''}>
                                                        {entry.goalDifference > 0 ? '+' : ''}{entry.goalDifference}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-2 text-center font-bold">{entry.points}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <p className="text-xs text-amber-600 mt-3 px-2">
                                ※ 上位{overallStandings.qualifyingCount}チームが決勝トーナメント進出
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            順位データがありません
                        </div>
                    )
                ) : (
                    // グループ別星取表
                    groupTeams.length > 0 ? (
                        <StarTable
                            teams={groupTeams}
                            matches={groupMatches}
                            groupId={activeTab}
                            overallRankings={overallRankingsMap}
                            showOverallRank={isOverallRanking}
                        />
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            チームデータがありません
                        </div>
                    )
                )}
            </div>

            {/* 最終更新時刻 */}
            {lastUpdated && (
                <p className="text-[10px] text-gray-400 text-center">
                    最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}（30秒ごとに自動更新）
                </p>
            )}

            <p className="text-[10px] text-gray-400 px-2">
                {activeTab === 'overall'
                    ? '※ 順位決定: 勝点 → 得失点差 → 総得点'
                    : '※ ○=勝利 △=引分 ●=敗北'}
            </p>
        </div>
    );
}
