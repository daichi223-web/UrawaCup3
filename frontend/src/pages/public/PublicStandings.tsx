import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { matchesApi, teamsApi } from '@/lib/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StarTable from '../../components/StarTable';

export default function PublicStandings() {
    const [activeTab, setActiveTab] = useState('A');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const tournamentId = 1; // デフォルトの大会ID

    // チーム一覧を取得
    const { data: teamsData, isLoading: isLoadingTeams, refetch: refetchTeams } = useQuery({
        queryKey: ['public-teams', tournamentId],
        queryFn: async () => {
            const data = await teamsApi.getAll(tournamentId);
            return data?.teams || [];
        },
        staleTime: 30000,
    });

    // 試合一覧を取得
    const { data: matchesData, isLoading: isLoadingMatches, refetch: refetchMatches } = useQuery({
        queryKey: ['public-matches', tournamentId],
        queryFn: async () => {
            const data = await matchesApi.getAll(tournamentId);
            return data?.matches || [];
        },
        staleTime: 30000,
    });

    // データ更新関数
    const refreshData = useCallback(async () => {
        await Promise.all([refetchTeams(), refetchMatches()]);
        setLastUpdated(new Date());
    }, [refetchTeams, refetchMatches]);

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

    const isLoading = isLoadingTeams || isLoadingMatches;

    if (isLoading) {
        return <div className="flex justify-center py-10"><LoadingSpinner /></div>;
    }

    // グループごとのチームと試合を抽出
    const groupTeams = (teamsData || []).filter(
        (t: any) => (t.group_id || t.groupId) === activeTab
    );
    const groupMatches = (matchesData || []).filter(
        (m: any) => (m.group_id || m.groupId) === activeTab && m.stage === 'preliminary'
    );

    return (
        <div className="space-y-4 pb-20">
            <h1 className="text-xl font-bold text-gray-800 px-1">予選リーグ 星取表</h1>

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                {['A', 'B', 'C', 'D'].map(group => (
                    <button
                        key={group}
                        onClick={() => setActiveTab(group)}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === group
                            ? 'bg-white text-red-600 shadow-sm'
                            : 'text-gray-500 hover:bg-gray-200'
                            }`}
                    >
                        Group {group}
                    </button>
                ))}
            </div>

            {/* 星取表 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-4">
                {groupTeams.length > 0 ? (
                    <StarTable
                        teams={groupTeams}
                        matches={groupMatches}
                        groupId={activeTab}
                    />
                ) : (
                    <div className="text-center py-8 text-gray-400">
                        チームデータがありません
                    </div>
                )}
            </div>

            {/* 最終更新時刻 */}
            {lastUpdated && (
                <p className="text-[10px] text-gray-400 text-center">
                    最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}（30秒ごとに自動更新）
                </p>
            )}

            <p className="text-[10px] text-gray-400 px-2">
                ※ ○=勝利 △=引分 ●=敗北
            </p>
        </div>
    );
}
