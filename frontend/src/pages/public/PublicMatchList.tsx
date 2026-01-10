import { useState, useEffect } from 'react';
import { matchesApi } from '@/lib/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MapPin, Clock, List, LayoutGrid } from 'lucide-react';

// ビューモード
type ViewMode = 'timeline' | 'group';

// Supabaseから取得するデータの型
interface MatchData {
    id: number;
    match_date: string;
    match_time: string;
    status: string;
    stage: string;
    group_id: string | null;
    home_score_total: number | null;
    away_score_total: number | null;
    home_score_half1: number | null;
    home_score_half2: number | null;
    away_score_half1: number | null;
    away_score_half2: number | null;
    home_pk: number | null;
    away_pk: number | null;
    home_team: { id: number; name: string } | null;
    away_team: { id: number; name: string } | null;
    venue: { id: number; name: string } | null;
}

// グループごとの色設定
const GROUP_COLORS: Record<string, { bg: string; border: string; header: string; headerText: string }> = {
    A: { bg: 'bg-red-50', border: 'border-red-200', header: 'bg-red-100', headerText: 'text-red-800' },
    B: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100', headerText: 'text-blue-800' },
    C: { bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-100', headerText: 'text-green-800' },
    D: { bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'bg-yellow-100', headerText: 'text-yellow-800' },
    finals: { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100', headerText: 'text-purple-800' },
    training: { bg: 'bg-gray-50', border: 'border-gray-200', header: 'bg-gray-100', headerText: 'text-gray-700' },
}

export default function PublicMatchList() {
    const [matches, setMatches] = useState<MatchData[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('timeline');
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const tournamentId = 1;

    useEffect(() => {
        let mounted = true;
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 15000); // 15秒でタイムアウト

        const fetchMatches = async () => {
            try {
                setLoading(true);
                setError(null);

                // タイムアウト付きでフェッチ
                // matchesApi.getAll自体はsignalを受け取らないかもしれないが、
                // 非同期処理が長引いた場合にUI側で打ち切るためのロジック
                const fetchPromise = matchesApi.getAll(tournamentId);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('データの取得がタイムアウトしました')), 10000)
                );

                const data: any = await Promise.race([fetchPromise, timeoutPromise]);

                if (!mounted) return;

                // Sort by date and time
                const sorted = (data.matches as MatchData[]).sort((a, b) => {
                    const aTime = `${a.match_date} ${a.match_time}`;
                    const bTime = `${b.match_date} ${b.match_time}`;
                    return new Date(aTime).getTime() - new Date(bTime).getTime();
                });
                setMatches(sorted);
            } catch (err: any) {
                if (!mounted) return;
                console.error("Failed to load matches", err);
                const errorMessage = err.message || "試合データの読み込みに失敗しました";
                setError(`${errorMessage} (Reload to try again)`);
            } finally {
                if (mounted) {
                    setLoading(false);
                    clearTimeout(timeoutId);
                }
            }
        };
        fetchMatches();

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
            abortController.abort();
        };
    }, [tournamentId]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <LoadingSpinner />
            <p className="text-gray-500 text-sm">データを読み込んでいます...</p>
        </div>
    );

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg max-w-sm w-full">
                    <p className="font-bold mb-2">エラーが発生しました</p>
                    <p className="text-sm mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                    >
                        再読み込み
                    </button>
                    <div className="mt-4 pt-4 border-t border-red-200 text-left text-xs font-mono bg-white p-2 rounded">
                        <p>Debug Info:</p>
                        <p>Tournament ID: {tournamentId}</p>
                        <p>Supabase Configured: {import.meta.env.VITE_SUPABASE_URL ? 'Yes' : 'No'}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (matches.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500">
                試合データがありません
            </div>
        );
    }

    // グループキーを取得（予選リーグはA,B,C,D、決勝トーナメント、研修試合）
    const getGroupKey = (match: MatchData): string => {
        if (match.stage === 'preliminary' && match.group_id) {
            return match.group_id;
        }
        if (match.stage === 'semifinal' || match.stage === 'final' || match.stage === 'third_place') {
            return 'finals';
        }
        if (match.stage === 'training') {
            return 'training';
        }
        return match.group_id || 'other';
    };

    // グループ名を取得
    const getGroupLabel = (groupKey: string): string => {
        if (groupKey === 'finals') return '決勝T';
        if (groupKey === 'training') return '研修';
        if (['A', 'B', 'C', 'D'].includes(groupKey)) return `${groupKey}グループ`;
        return groupKey;
    };

    // 速報用ソート: 試合中 > 終了 > 予定 の順で、各ステータス内は時間順（最新が上）
    const sortedMatches = [...matches].sort((a, b) => {
        // ステータス優先度: in_progress > completed > scheduled
        const statusOrder: Record<string, number> = {
            'in_progress': 0,
            'completed': 1,
            'scheduled': 2,
            'cancelled': 3,
        };
        const statusA = statusOrder[a.status] ?? 3;
        const statusB = statusOrder[b.status] ?? 3;

        if (statusA !== statusB) {
            return statusA - statusB;
        }

        // 同じステータス内では日時でソート（終了・試合中は降順、予定は昇順）
        const timeA = new Date(`${a.match_date} ${a.match_time}`).getTime();
        const timeB = new Date(`${b.match_date} ${b.match_time}`).getTime();

        if (a.status === 'completed' || a.status === 'in_progress') {
            return timeB - timeA; // 最新が上
        }
        return timeA - timeB; // 予定は早い順
    });

    // 試合中・終了・予定に分類
    const inProgressMatches = sortedMatches.filter(m => m.status === 'in_progress');
    const completedMatches = sortedMatches.filter(m => m.status === 'completed');
    const scheduledMatches = sortedMatches.filter(m => m.status === 'scheduled');

    // グループ一覧を取得
    const groupKeys = ['all', 'A', 'B', 'C', 'D', 'finals', 'training'];
    const groupLabels: Record<string, string> = {
        all: 'すべて',
        A: 'Aグループ',
        B: 'Bグループ',
        C: 'Cグループ',
        D: 'Dグループ',
        finals: '決勝T',
        training: '研修',
    };

    // グループ別フィルタリング
    const filterByGroup = (matchList: MatchData[]) => {
        if (selectedGroup === 'all') return matchList;
        return matchList.filter(m => getGroupKey(m) === selectedGroup);
    };

    // グループ別ビュー用: グループごとに試合を分類
    const matchesByGroup = groupKeys.slice(1).reduce((acc, groupKey) => {
        acc[groupKey] = sortedMatches.filter(m => getGroupKey(m) === groupKey);
        return acc;
    }, {} as Record<string, MatchData[]>);

    return (
        <div className="space-y-4 pb-20">
            {/* ビュー切り替えボタン */}
            <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-100 p-2">
                <div className="flex gap-1">
                    <button
                        onClick={() => setViewMode('timeline')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            viewMode === 'timeline'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        <List className="w-4 h-4" />
                        時系列
                    </button>
                    <button
                        onClick={() => setViewMode('group')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            viewMode === 'group'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        グループ別
                    </button>
                </div>
                <div className="text-xs text-gray-500">
                    {matches.length}試合
                </div>
            </div>

            {/* グループ別ビュー: タブ */}
            {viewMode === 'group' && (
                <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                    {groupKeys.map(groupKey => {
                        const count = groupKey === 'all'
                            ? matches.length
                            : matchesByGroup[groupKey]?.length || 0;
                        const isActive = selectedGroup === groupKey;

                        // グループ別カラー
                        const tabColors: Record<string, string> = {
                            all: isActive ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600',
                            A: isActive ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700',
                            B: isActive ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700',
                            C: isActive ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700',
                            D: isActive ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700',
                            finals: isActive ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700',
                            training: isActive ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600',
                        };

                        return (
                            <button
                                key={groupKey}
                                onClick={() => setSelectedGroup(groupKey)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${tabColors[groupKey]}`}
                            >
                                {groupLabels[groupKey]}
                                <span className="ml-1 opacity-75">({count})</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {viewMode === 'timeline' ? (
                <>
                    {/* 時系列ビュー: 試合中 */}
                    {inProgressMatches.length > 0 && (
                        <div>
                            <h2 className="text-sm font-bold text-red-600 mb-2 px-1 flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                試合中 ({inProgressMatches.length})
                            </h2>
                            <div className="space-y-2">
                                {inProgressMatches.map(match => (
                                    <PublicMatchCard key={match.id} match={match} groupKey={getGroupKey(match)} groupLabel={getGroupLabel(getGroupKey(match))} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 時系列ビュー: 終了した試合 */}
                    {completedMatches.length > 0 && (
                        <div>
                            <h2 className="text-sm font-bold text-green-700 mb-2 px-1">
                                終了 ({completedMatches.length})
                            </h2>
                            <div className="space-y-2">
                                {completedMatches.map(match => (
                                    <PublicMatchCard key={match.id} match={match} groupKey={getGroupKey(match)} groupLabel={getGroupLabel(getGroupKey(match))} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 時系列ビュー: 予定 */}
                    {scheduledMatches.length > 0 && (
                        <div>
                            <h2 className="text-sm font-bold text-gray-500 mb-2 px-1">
                                予定 ({scheduledMatches.length})
                            </h2>
                            <div className="space-y-2">
                                {scheduledMatches.map(match => (
                                    <PublicMatchCard key={match.id} match={match} groupKey={getGroupKey(match)} groupLabel={getGroupLabel(getGroupKey(match))} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    {/* グループ別ビュー */}
                    {(() => {
                        const filteredMatches = filterByGroup(sortedMatches);
                        const filteredInProgress = filteredMatches.filter(m => m.status === 'in_progress');
                        const filteredCompleted = filteredMatches.filter(m => m.status === 'completed');
                        const filteredScheduled = filteredMatches.filter(m => m.status === 'scheduled');

                        return (
                            <>
                                {/* 試合中 */}
                                {filteredInProgress.length > 0 && (
                                    <div>
                                        <h2 className="text-sm font-bold text-red-600 mb-2 px-1 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                            試合中 ({filteredInProgress.length})
                                        </h2>
                                        <div className="space-y-2">
                                            {filteredInProgress.map(match => (
                                                <PublicMatchCard key={match.id} match={match} groupKey={getGroupKey(match)} groupLabel={getGroupLabel(getGroupKey(match))} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 終了した試合 */}
                                {filteredCompleted.length > 0 && (
                                    <div>
                                        <h2 className="text-sm font-bold text-green-700 mb-2 px-1">
                                            終了 ({filteredCompleted.length})
                                        </h2>
                                        <div className="space-y-2">
                                            {filteredCompleted.map(match => (
                                                <PublicMatchCard key={match.id} match={match} groupKey={getGroupKey(match)} groupLabel={getGroupLabel(getGroupKey(match))} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 予定 */}
                                {filteredScheduled.length > 0 && (
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-500 mb-2 px-1">
                                            予定 ({filteredScheduled.length})
                                        </h2>
                                        <div className="space-y-2">
                                            {filteredScheduled.map(match => (
                                                <PublicMatchCard key={match.id} match={match} groupKey={getGroupKey(match)} groupLabel={getGroupLabel(getGroupKey(match))} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {filteredMatches.length === 0 && (
                                    <div className="text-center py-10 text-gray-500">
                                        このグループの試合はありません
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </>
            )}
        </div>
    );
}

function PublicMatchCard({ match, groupKey, groupLabel }: { match: MatchData; groupKey?: string; groupLabel?: string }) {
    const isFinished = match.status === 'completed';
    const isLive = match.status === 'in_progress';

    // グループに応じたアクセントカラー
    const accentColors: Record<string, string> = {
        A: 'border-l-red-400',
        B: 'border-l-blue-400',
        C: 'border-l-green-400',
        D: 'border-l-yellow-400',
        finals: 'border-l-purple-400',
        training: 'border-l-gray-400',
    };
    const accentClass = groupKey ? accentColors[groupKey] || '' : '';

    // グループに応じたバッジカラー
    const badgeColors: Record<string, string> = {
        A: 'bg-red-100 text-red-700',
        B: 'bg-blue-100 text-blue-700',
        C: 'bg-green-100 text-green-700',
        D: 'bg-yellow-100 text-yellow-700',
        finals: 'bg-purple-100 text-purple-700',
        training: 'bg-gray-100 text-gray-600',
    };
    const badgeClass = groupKey ? badgeColors[groupKey] || 'bg-gray-100 text-gray-600' : '';

    return (
        <div className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden ${accentClass ? `border-l-4 ${accentClass}` : ''}`}>
            {/* Header: Group, Time & Venue */}
            <div className="bg-gray-50 px-3 py-1.5 flex justify-between items-center text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    {/* グループバッジ */}
                    {groupLabel && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>
                            {groupLabel}
                        </span>
                    )}
                    <Clock className="w-3 h-3" />
                    {match.match_time?.substring(0, 5) || '--:--'}
                </div>
                <div className="flex items-center gap-1 truncate ml-2">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{match.venue?.name || '未定'}</span>
                </div>
            </div>

            {/* Score Board */}
            <div className="px-3 py-2">
                {isFinished ? (
                    /* 終了時: 横型レイアウト */
                    <div className="flex items-center">
                        {/* ホームチーム名 + 合計得点 */}
                        <div className="flex-1 flex items-center justify-end gap-2">
                            <span className="font-bold text-sm truncate">{match.home_team?.name || 'TBD'}</span>
                            <span className="text-xl font-black text-gray-800 min-w-[1.5rem] text-center">
                                {match.home_score_total ?? '-'}
                            </span>
                        </div>

                        {/* 中央: 前後半スコア */}
                        <div className="mx-2 text-center min-w-[60px]">
                            <div className="flex items-center justify-center gap-0.5 text-[10px]">
                                <span className="text-gray-600 w-3 text-right">{match.home_score_half1 ?? 0}</span>
                                <span className="text-gray-400">前</span>
                                <span className="text-gray-600 w-3 text-left">{match.away_score_half1 ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-center gap-0.5 text-[10px]">
                                <span className="text-gray-600 w-3 text-right">{match.home_score_half2 ?? 0}</span>
                                <span className="text-gray-400">後</span>
                                <span className="text-gray-600 w-3 text-left">{match.away_score_half2 ?? 0}</span>
                            </div>
                            {/* PK戦結果 */}
                            {(match.home_pk != null && match.away_pk != null && (match.home_pk > 0 || match.away_pk > 0)) && (
                                <div className="flex items-center justify-center gap-0.5 text-[10px]">
                                    <span className="text-orange-600 w-3 text-right font-medium">{match.home_pk}</span>
                                    <span className="text-orange-600 font-medium">PK</span>
                                    <span className="text-orange-600 w-3 text-left font-medium">{match.away_pk}</span>
                                </div>
                            )}
                        </div>

                        {/* アウェイチーム得点 + 名前 */}
                        <div className="flex-1 flex items-center justify-start gap-2">
                            <span className="text-xl font-black text-gray-800 min-w-[1.5rem] text-center">
                                {match.away_score_total ?? '-'}
                            </span>
                            <span className="font-bold text-sm truncate">{match.away_team?.name || 'TBD'}</span>
                        </div>
                    </div>
                ) : (
                    /* 試合前・試合中: コンパクトレイアウト */
                    <div className="flex items-center justify-between">
                        {/* Home Team */}
                        <div className="flex-1 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 text-xs flex-shrink-0">
                                {match.home_team?.name?.slice(0, 1) || '?'}
                            </div>
                            <span className="font-bold text-sm truncate">
                                {match.home_team?.name || 'TBD'}
                            </span>
                        </div>

                        {/* Score */}
                        <div className="px-3 flex flex-col items-center">
                            <div className="text-xl font-black font-mono text-gray-800">
                                {isLive ? (
                                    <>
                                        {match.home_score_total ?? '-'} <span className="text-gray-300">-</span> {match.away_score_total ?? '-'}
                                    </>
                                ) : (
                                    <span className="text-base text-gray-400">vs</span>
                                )}
                            </div>
                        </div>

                        {/* Away Team */}
                        <div className="flex-1 flex items-center justify-end gap-2">
                            <span className="font-bold text-sm truncate">
                                {match.away_team?.name || 'TBD'}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 text-xs flex-shrink-0">
                                {match.away_team?.name?.slice(0, 1) || '?'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
