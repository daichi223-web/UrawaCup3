import { useState, useEffect } from 'react';
import { matchesApi } from '@/lib/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MapPin, Clock } from 'lucide-react';

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

    // Group by Date for cleaner UI
    const groupedByDate = matches.reduce((acc, match) => {
        const dateStr = match.match_date || '';
        const date = format(new Date(dateStr), 'M月d日(E)', { locale: ja });
        if (!acc[date]) acc[date] = [];
        acc[date].push(match);
        return acc;
    }, {} as Record<string, MatchData[]>);

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
        if (groupKey === 'finals') return '決勝トーナメント';
        if (groupKey === 'training') return '研修試合';
        if (['A', 'B', 'C', 'D'].includes(groupKey)) return `${groupKey}組`;
        return groupKey;
    };

    // グループの表示順
    const groupOrder = ['A', 'B', 'C', 'D', 'finals', 'training', 'other'];

    return (
        <div className="space-y-6 pb-20">
            {Object.entries(groupedByDate).map(([date, dayMatches]) => {
                // 日付内でグループごとに分類
                const matchesByGroup = dayMatches.reduce((acc, match) => {
                    const groupKey = getGroupKey(match);
                    if (!acc[groupKey]) acc[groupKey] = [];
                    acc[groupKey].push(match);
                    return acc;
                }, {} as Record<string, MatchData[]>);

                // グループをソート
                const sortedGroups = Object.keys(matchesByGroup).sort(
                    (a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b)
                );

                return (
                    <div key={date}>
                        <h2 className="text-sm font-bold text-gray-500 mb-3 px-1 sticky top-0 bg-gray-50 py-2 z-10">
                            {date}
                        </h2>
                        <div className="space-y-4">
                            {sortedGroups.map(groupKey => {
                                const groupMatches = matchesByGroup[groupKey];
                                const colors = GROUP_COLORS[groupKey] || GROUP_COLORS.training;

                                return (
                                    <div key={groupKey} className={`rounded-lg border ${colors.border} overflow-hidden`}>
                                        {/* グループヘッダー */}
                                        <div className={`px-3 py-1.5 ${colors.header} ${colors.headerText} font-bold text-sm`}>
                                            {getGroupLabel(groupKey)}
                                            <span className="ml-2 font-normal text-xs opacity-75">
                                                {groupMatches.length}試合
                                            </span>
                                        </div>
                                        {/* 試合リスト */}
                                        <div className={`${colors.bg} p-2 space-y-2`}>
                                            {groupMatches.map(match => (
                                                <PublicMatchCard key={match.id} match={match} groupKey={groupKey} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function PublicMatchCard({ match, groupKey }: { match: MatchData; groupKey?: string }) {
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

    return (
        <div className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden ${accentClass ? `border-l-4 ${accentClass}` : ''}`}>
            {/* Header: Time & Venue */}
            <div className="bg-gray-50 px-3 py-1.5 flex justify-between items-center text-xs text-gray-500">
                <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {match.match_time?.substring(0, 5) || '--:--'}
                    {isLive && <span className="ml-2 text-red-600 font-bold animate-pulse">● LIVE</span>}
                    {isFinished && <span className="ml-2 font-medium text-green-600">終了</span>}
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
