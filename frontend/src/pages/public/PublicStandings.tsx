import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { standingApi } from '@/features/standings/api';
import type { OverallStandings, GroupStandings } from '@/features/standings/types';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function PublicStandings() {
    const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C' | 'D' | 'overall'>('overall');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const tournamentId = 1; // デフォルトの大会ID

    // グループ別順位表を取得
    const { data: groupStandings, isLoading: isLoadingStandings, refetch: refetchStandings, error: standingsError } = useQuery<GroupStandings[]>({
        queryKey: ['public-standings', tournamentId],
        queryFn: () => standingApi.getStandingsByGroup(tournamentId),
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

    // 大会形式（グループ制か1リーグ制か）
    const useGroupSystem = tournament?.use_group_system ?? true;

    // 総合順位を取得（総合タブまたは総合順位ルールの場合）
    const { data: overallStandings, isLoading: isLoadingOverall, refetch: refetchOverall } = useQuery<OverallStandings>({
        queryKey: ['public-overall-standings', tournamentId],
        queryFn: () => standingApi.getOverallStandings(tournamentId),
        staleTime: 30000,
        retry: 2,
        enabled: activeTab === 'overall' || isOverallRanking,
    });

    // 総合順位マップを作成（グループ別表示で総合順位を表示するため）
    const overallRankingsMap = useMemo(() => {
        if (!overallStandings?.entries) return new Map<number, number>();
        const map = new Map<number, number>();
        overallStandings.entries.forEach(entry => {
            map.set(entry.teamId, entry.overallRank);
        });
        return map;
    }, [overallStandings]);

    // データ更新関数
    const refreshData = useCallback(async () => {
        await refetchStandings();
        if (activeTab === 'overall' || isOverallRanking) {
            await refetchOverall();
        }
        setLastUpdated(new Date());
    }, [refetchStandings, refetchOverall, activeTab, isOverallRanking]);

    // 初回読み込み時に更新時刻を設定
    useEffect(() => {
        if (groupStandings) {
            setLastUpdated(new Date());
        }
    }, [groupStandings]);

    // 30秒ごとに自動更新
    useEffect(() => {
        const interval = setInterval(() => {
            refreshData();
        }, 30000);
        return () => clearInterval(interval);
    }, [refreshData]);

    const isLoading = isLoadingStandings || (activeTab === 'overall' && isLoadingOverall);
    const hasError = standingsError;

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

    // 現在のグループの順位表を取得
    const currentGroupStandings = activeTab !== 'overall'
        ? groupStandings?.find(g => g.groupId === activeTab)
        : null;

    // グループ色設定
    const groupColors: Record<string, { header: string; highlight: string }> = {
        A: { header: 'bg-red-600', highlight: 'bg-red-50' },
        B: { header: 'bg-blue-600', highlight: 'bg-blue-50' },
        C: { header: 'bg-green-600', highlight: 'bg-green-50' },
        D: { header: 'bg-yellow-500', highlight: 'bg-yellow-50' },
    };

    // 表示するタブ（1リーグ制の場合は総合のみ）
    const availableTabs = useGroupSystem
        ? (['A', 'B', 'C', 'D', 'overall'] as const)
        : (['overall'] as const);

    return (
        <div className="space-y-4 pb-20">
            <h1 className="text-xl font-bold text-gray-800 px-1">
                {useGroupSystem ? '予選リーグ 順位表' : '順位表'}
            </h1>

            {/* Tabs（グループ制の場合のみ表示） */}
            {useGroupSystem && (
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                    {availableTabs.map(tab => (
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
            )}

            {/* コンテンツ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {(activeTab === 'overall' || !useGroupSystem) ? (
                    // 総合順位表（1リーグ制の場合は常に表示）
                    overallStandings && overallStandings.entries.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-amber-500 text-white">
                                        <th className="px-2 py-2 text-center w-12">順位</th>
                                        <th className="px-2 py-2 text-left">チーム</th>
                                        {useGroupSystem && <th className="px-2 py-2 text-center w-12">G</th>}
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
                                                {useGroupSystem && (
                                                    <td className="px-2 py-2 text-center text-xs text-gray-500">
                                                        {entry.groupId}
                                                    </td>
                                                )}
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
                            <p className="text-xs text-amber-600 mt-3 px-4 pb-3">
                                ※ 上位{overallStandings.qualifyingCount}チームが決勝トーナメント進出
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            順位データがありません
                        </div>
                    )
                ) : (
                    // グループ別順位表
                    currentGroupStandings && currentGroupStandings.standings.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className={`${groupColors[activeTab]?.header || 'bg-gray-600'} text-white`}>
                                        <th className="px-2 py-2 text-center w-10">順位</th>
                                        {isOverallRanking && (
                                            <th className="px-2 py-2 text-center w-10">総合</th>
                                        )}
                                        <th className="px-2 py-2 text-left">チーム</th>
                                        <th className="px-2 py-2 text-center w-10">試</th>
                                        <th className="px-2 py-2 text-center w-10">勝</th>
                                        <th className="px-2 py-2 text-center w-10">分</th>
                                        <th className="px-2 py-2 text-center w-10">負</th>
                                        <th className="px-2 py-2 text-center w-10">得</th>
                                        <th className="px-2 py-2 text-center w-10">失</th>
                                        <th className="px-2 py-2 text-center w-12">得失</th>
                                        <th className="px-2 py-2 text-center w-12 font-bold">勝点</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentGroupStandings.standings.map((standing) => {
                                        const isTop2 = standing.rank <= 2;
                                        const overallRank = overallRankingsMap.get(standing.teamId);
                                        return (
                                            <tr
                                                key={standing.teamId}
                                                className={`border-b ${isTop2 ? groupColors[activeTab]?.highlight || 'bg-gray-50' : ''}`}
                                            >
                                                <td className="px-2 py-2 text-center font-bold">
                                                    {isTop2 ? (
                                                        <span className={`inline-block w-6 h-6 ${groupColors[activeTab]?.header || 'bg-gray-600'} text-white rounded-full leading-6 text-xs`}>
                                                            {standing.rank}
                                                        </span>
                                                    ) : (
                                                        standing.rank
                                                    )}
                                                </td>
                                                {isOverallRanking && (
                                                    <td className="px-2 py-2 text-center">
                                                        {overallRank && overallRank <= 4 ? (
                                                            <span className="inline-block w-5 h-5 bg-amber-500 text-white rounded-full leading-5 text-xs">
                                                                {overallRank}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">{overallRank || '-'}</span>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="px-2 py-2 font-medium">{standing.teamName}</td>
                                                <td className="px-2 py-2 text-center">{standing.played}</td>
                                                <td className="px-2 py-2 text-center text-green-600">{standing.won}</td>
                                                <td className="px-2 py-2 text-center text-gray-500">{standing.drawn}</td>
                                                <td className="px-2 py-2 text-center text-red-500">{standing.lost}</td>
                                                <td className="px-2 py-2 text-center">{standing.goalsFor}</td>
                                                <td className="px-2 py-2 text-center">{standing.goalsAgainst}</td>
                                                <td className="px-2 py-2 text-center">
                                                    <span className={standing.goalDifference > 0 ? 'text-green-600' : standing.goalDifference < 0 ? 'text-red-500' : ''}>
                                                        {standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-2 text-center font-bold">{standing.points}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {!isOverallRanking && (
                                <p className="text-xs text-gray-500 mt-3 px-4 pb-3">
                                    ※ 上位2チームが決勝トーナメント進出
                                </p>
                            )}
                            {isOverallRanking && (
                                <p className="text-xs text-amber-600 mt-3 px-4 pb-3">
                                    ※ 総合順位で上位4チームが決勝トーナメント進出
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            順位データがありません
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
                ※ 順位決定: 勝点 → 得失点差 → 総得点
            </p>
        </div>
    );
}
