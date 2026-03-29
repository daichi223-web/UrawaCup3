import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { standingApi } from '@/features/standings/api';
import type { OverallStandings, GroupStandings, OverallStandingEntry } from '@/features/standings/types';
import { supabase } from '@/lib/supabase';
import { teamsApi, matchesApi } from '@/lib/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StarTable from '@/components/StarTable';
import { Download } from 'lucide-react';

const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || '';

// API レスポンス型
interface TeamApiData {
  id: number
  name: string
  short_name?: string
  shortName?: string
  group_id?: string
  groupId?: string
}

interface MatchApiData {
  id: number
  home_team_id?: number
  homeTeamId?: number
  away_team_id?: number
  awayTeamId?: number
  home_score_total?: number
  homeScoreTotal?: number
  away_score_total?: number
  awayScoreTotal?: number
  group_id?: string
  groupId?: string
  stage?: string
  status?: string
  is_b_match?: boolean
  isBMatch?: boolean
}

type MainTab = 'results' | 'standings';  // 成績表 or 順位表

export default function PublicStandings() {
    const [mainTab, setMainTab] = useState<MainTab>('results');  // デフォルトは成績表
    const [groupTab, setGroupTab] = useState<'A' | 'B' | 'C' | 'D' | 'overall'>('overall');
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

    const isOverallRanking = (tournament as unknown as { qualification_rule?: string } | null)?.qualification_rule === 'overall_ranking';

    // 大会形式（グループ制か1リーグ制か）
    const useGroupSystem = (tournament as unknown as { use_group_system?: boolean } | null)?.use_group_system ?? true;

    // チーム一覧を取得（成績表用）
    const { data: teamsData } = useQuery({
        queryKey: ['public-teams', tournamentId],
        queryFn: () => teamsApi.getAll(tournamentId),
        staleTime: 60000,
        retry: 2,
    });
    const teams = useMemo(() => {
        const rawTeams = (teamsData?.teams || []) as TeamApiData[];
        return rawTeams.map((t) => ({
            ...t,
            shortName: t.short_name || t.shortName,
            groupId: t.group_id || t.groupId,
        }));
    }, [teamsData]);

    // 試合一覧を取得（成績表用）
    const { data: matchesData } = useQuery({
        queryKey: ['public-matches', tournamentId],
        queryFn: () => matchesApi.getAll(tournamentId),
        staleTime: 30000,
        retry: 2,
    });
    const matches = useMemo(() => {
        const rawMatches = (matchesData?.matches || []) as MatchApiData[];
        return rawMatches.map((m) => ({
            ...m,
            homeTeamId: m.home_team_id || m.homeTeamId,
            awayTeamId: m.away_team_id || m.awayTeamId,
            homeScoreTotal: m.home_score_total ?? m.homeScoreTotal,
            awayScoreTotal: m.away_score_total ?? m.awayScoreTotal,
            groupId: m.group_id || m.groupId,
        }));
    }, [matchesData]);

    // 総合順位を取得
    const { data: overallStandings, isLoading: isLoadingOverall, refetch: refetchOverall } = useQuery<OverallStandings>({
        queryKey: ['public-overall-standings', tournamentId],
        queryFn: () => standingApi.getOverallStandings(tournamentId),
        staleTime: 30000,
        retry: 2,
    });

    // 試合データから総合順位を計算（DBにデータがない場合のフォールバック）
    const calculatedOverallData = useMemo(() => {
        if (teams.length === 0 || matches.length === 0) return { map: new Map<number, number>(), entries: [] };

        const completedMatches = matches.filter((m) => m.status === 'completed' && m.stage === 'preliminary' && !m.is_b_match && !m.isBMatch);
        if (completedMatches.length === 0) return { map: new Map<number, number>(), entries: [] };

        // チームごとの成績を集計
        const statsMap = new Map<number, {
            teamId: number;
            teamName: string;
            shortName: string;
            groupId: string;
            points: number;
            goalDiff: number;
            goalsFor: number;
            goalsAgainst: number;
            played: number;
            won: number;
            drawn: number;
            lost: number;
        }>();

        teams.forEach((t) => {
            statsMap.set(t.id, {
                teamId: t.id,
                teamName: t.name,
                shortName: t.short_name || t.shortName || t.name,
                groupId: t.group_id || t.groupId || '',
                points: 0,
                goalDiff: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
            });
        });

        completedMatches.forEach((m) => {
            const homeId = m.homeTeamId ?? m.home_team_id;
            const awayId = m.awayTeamId ?? m.away_team_id;
            const homeScore = m.homeScoreTotal ?? m.home_score_total ?? 0;
            const awayScore = m.awayScoreTotal ?? m.away_score_total ?? 0;

            if (!homeId || !awayId) return;

            const homeStats = statsMap.get(homeId);
            const awayStats = statsMap.get(awayId);
            if (!homeStats || !awayStats) return;

            homeStats.played++;
            awayStats.played++;
            homeStats.goalsFor += homeScore;
            homeStats.goalsAgainst += awayScore;
            awayStats.goalsFor += awayScore;
            awayStats.goalsAgainst += homeScore;
            homeStats.goalDiff += (homeScore - awayScore);
            awayStats.goalDiff += (awayScore - homeScore);

            if (homeScore > awayScore) {
                homeStats.points += 3;
                homeStats.won++;
                awayStats.lost++;
            } else if (homeScore < awayScore) {
                awayStats.points += 3;
                awayStats.won++;
                homeStats.lost++;
            } else {
                homeStats.points += 1;
                awayStats.points += 1;
                homeStats.drawn++;
                awayStats.drawn++;
            }
        });

        // ソートして順位付け
        const sorted = Array.from(statsMap.values())
            .filter(s => s.played > 0)
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
                return b.goalsFor - a.goalsFor;
            });

        const rankMap = new Map<number, number>();
        const entries = sorted.map((stats, index) => {
            rankMap.set(stats.teamId, index + 1);
            return {
                overallRank: index + 1,
                groupId: stats.groupId,
                groupRank: 0,
                teamId: stats.teamId,
                teamName: stats.teamName,
                shortName: stats.shortName,
                points: stats.points,
                goalDifference: stats.goalDiff,
                goalsFor: stats.goalsFor,
                goalsAgainst: stats.goalsAgainst,
                played: stats.played,
                won: stats.won,
                drawn: stats.drawn,
                lost: stats.lost,
            };
        });

        return { map: rankMap, entries };
    }, [teams, matches]);

    // 総合順位マップを作成（DB優先、なければローカル計算）
    const overallRankingsMap = useMemo(() => {
        if (overallStandings?.entries && overallStandings.entries.length > 0) {
            const map = new Map<number, number>();
            overallStandings.entries.forEach(entry => {
                map.set(entry.teamId, entry.overallRank);
            });
            return map;
        }
        return calculatedOverallData.map;
    }, [overallStandings, calculatedOverallData]);

    // 総合順位表用のエントリ（DB優先、なければローカル計算）
    const displayOverallEntries = useMemo(() => {
        if (overallStandings?.entries && overallStandings.entries.length > 0) {
            return overallStandings.entries;
        }
        return calculatedOverallData.entries;
    }, [overallStandings, calculatedOverallData]);

    // データ更新関数
    const refreshData = useCallback(async () => {
        await refetchStandings();
        await refetchOverall();
        setLastUpdated(new Date());
    }, [refetchStandings, refetchOverall]);

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

    const [pdfLoading, setPdfLoading] = useState(false);

    const handleDownloadPdf = useCallback(async () => {
        if (displayOverallEntries.length === 0) return;
        setPdfLoading(true);
        try {
            const pdfPayload = {
                title: '第45回浦和カップ 成績表',
                groups: [{
                    groupId: 'all',
                    groupName: '',
                    standings: displayOverallEntries.map((e: OverallStandingEntry) => ({
                        rank: e.overallRank,
                        teamName: e.shortName || e.teamName,
                        played: e.played,
                        won: e.won,
                        drawn: e.drawn,
                        lost: e.lost,
                        goalsFor: e.goalsFor,
                        goalsAgainst: (e.goalsFor ?? 0) - (e.goalDifference ?? 0),
                        goalDifference: e.goalDifference,
                        points: e.points,
                    })),
                }],
            };

            if (!CORE_API_URL) throw new Error('API未設定');

            const res = await fetch(`${CORE_API_URL}/standings-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pdfPayload),
            });

            if (!res.ok) throw new Error(`API error: ${res.status}`);

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '第45回浦和カップ_成績表.pdf';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('PDF download failed:', err);
            alert('PDF生成に失敗しました。\nブラウザの印刷機能（Ctrl+P）でPDF保存してください。');
        } finally {
            setPdfLoading(false);
        }
    }, [displayOverallEntries]);

    const isLoading = isLoadingStandings || isLoadingOverall;
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
    const currentGroupStandings = groupTab !== 'overall'
        ? groupStandings?.find(g => g.groupId === groupTab)
        : null;

    // グループ色設定
    const groupColors: Record<string, { header: string; highlight: string }> = {
        A: { header: 'bg-red-600', highlight: 'bg-red-50' },
        B: { header: 'bg-blue-600', highlight: 'bg-blue-50' },
        C: { header: 'bg-green-600', highlight: 'bg-green-50' },
        D: { header: 'bg-yellow-500', highlight: 'bg-yellow-50' },
    };

    return (
        <div className="space-y-3 pb-20">
            {/* メインタブ: 成績表 / 順位表 */}
            <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg">
                <button
                    onClick={() => setMainTab('results')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                        mainTab === 'results'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-300'
                    }`}
                >
                    成績表
                </button>
                <button
                    onClick={() => setMainTab('standings')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                        mainTab === 'standings'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-300'
                    }`}
                >
                    順位表
                </button>
            </div>

            {/* 成績表タブ */}
            {mainTab === 'results' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100">
                    {teams.length > 0 && matches.length > 0 ? (
                        <div className="overflow-x-auto p-2">
                            <StarTable
                                teams={teams as unknown as import('@/types').Team[]}
                                matches={matches as unknown as import('@/types').MatchWithDetails[]}
                                groupId="all"
                                overallRankings={overallRankingsMap}
                                showOverallRank={true}
                            />
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            成績データがありません
                        </div>
                    )}
                </div>
            )}

            {/* 順位表タブ */}
            {mainTab === 'standings' && (
                <>
                    {/* グループタブ（グループ制の場合のみ表示） */}
                    {useGroupSystem && (
                        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                            {(['A', 'B', 'C', 'D', 'overall'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setGroupTab(tab)}
                                    className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${groupTab === tab
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

                    {/* 順位表コンテンツ */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {(groupTab === 'overall' || !useGroupSystem) ? (
                            // 総合順位表
                            displayOverallEntries.length > 0 ? (
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
                                            {displayOverallEntries.map((entry) => {
                                                const qualifyingCount = overallStandings?.qualifyingCount || 4;
                                                const isQualifying = entry.overallRank <= qualifyingCount;
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
                                        ※ 上位{overallStandings?.qualifyingCount || 4}チームが決勝トーナメント進出
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
                                            <tr className={`${groupColors[groupTab]?.header || 'bg-gray-600'} text-white`}>
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
                                                        className={`border-b ${isTop2 ? groupColors[groupTab]?.highlight || 'bg-gray-50' : ''}`}
                                                    >
                                                        <td className="px-2 py-2 text-center font-bold">
                                                            {isTop2 ? (
                                                                <span className={`inline-block w-6 h-6 ${groupColors[groupTab]?.header || 'bg-gray-600'} text-white rounded-full leading-6 text-xs`}>
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

                    {/* PDF DL ボタン（順位表タブ内） */}
                    {displayOverallEntries.length > 0 && (
                        <div className="flex justify-center mt-3">
                            <button
                                onClick={handleDownloadPdf}
                                disabled={pdfLoading}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                <Download size={16} />
                                {pdfLoading ? 'PDF生成中...' : '順位表PDF (A4)'}
                            </button>
                        </div>
                    )}
                </>
            )}

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
