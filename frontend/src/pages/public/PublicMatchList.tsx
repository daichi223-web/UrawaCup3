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
    home_score_total: number | null;
    away_score_total: number | null;
    home_pk: number | null;
    away_pk: number | null;
    home_team: { id: number; name: string } | null;
    away_team: { id: number; name: string } | null;
    venue: { id: number; name: string } | null;
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
    const groupedMatches = matches.reduce((acc, match) => {
        const dateStr = match.match_date || '';
        const date = format(new Date(dateStr), 'M月d日(E)', { locale: ja });
        if (!acc[date]) acc[date] = [];
        acc[date].push(match);
        return acc;
    }, {} as Record<string, MatchData[]>);

    return (
        <div className="space-y-6 pb-20">
            {Object.entries(groupedMatches).map(([date, dayMatches]) => (
                <div key={date}>
                    <h2 className="text-sm font-bold text-gray-500 mb-3 px-1 sticky top-0 bg-gray-50 py-2 z-10">
                        {date}
                    </h2>
                    <div className="space-y-3">
                        {dayMatches.map(match => (
                            <PublicMatchCard key={match.id} match={match} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function PublicMatchCard({ match }: { match: MatchData }) {
    const isFinished = match.status === 'completed';
    const isLive = match.status === 'in_progress';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header: Time & Venue */}
            <div className="bg-gray-50 px-4 py-2 flex justify-between items-center text-xs text-gray-500">
                <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {match.match_time || '--:--'}
                    {isLive && <span className="ml-2 text-red-600 font-bold animate-pulse">● LIVE</span>}
                    {isFinished && <span className="ml-2 font-medium text-gray-400">終了</span>}
                </div>
                <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {match.venue?.name || '未定'}
                </div>
            </div>

            {/* Score Board */}
            <div className="p-4">
                <div className="flex items-center justify-between">
                    {/* Home Team */}
                    <div className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 text-xs">
                            {match.home_team?.name?.slice(0, 1) || '?'}
                        </div>
                        <span className="font-bold text-sm text-center leading-tight">
                            {match.home_team?.name || 'TBD'}
                        </span>
                    </div>

                    {/* Score */}
                    <div className="px-4 flex flex-col items-center">
                        <div className="text-3xl font-black font-mono tracking-widest text-gray-800">
                            {isFinished || isLive ? (
                                <>
                                    {match.home_score_total ?? '-'} <span className="text-gray-300 text-xl">-</span> {match.away_score_total ?? '-'}
                                </>
                            ) : (
                                <span className="text-xl text-gray-400">vs</span>
                            )}
                        </div>
                        {(match.home_pk != null || match.away_pk != null) && (
                            <span className="text-xs text-gray-500 mt-1">
                                (PK: {match.home_pk}-{match.away_pk})
                            </span>
                        )}
                    </div>

                    {/* Away Team */}
                    <div className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 text-xs">
                            {match.away_team?.name?.slice(0, 1) || '?'}
                        </div>
                        <span className="font-bold text-sm text-center leading-tight">
                            {match.away_team?.name || 'TBD'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
