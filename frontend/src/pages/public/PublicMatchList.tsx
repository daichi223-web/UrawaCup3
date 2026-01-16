import { useState, useEffect } from 'react';
import { matchesApi, tournamentsApi } from '@/lib/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MapPin, Clock, AlertCircle, Calendar } from 'lucide-react';

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
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tournamentName, setTournamentName] = useState<string>('');
    const [useGroupSystem, setUseGroupSystem] = useState<boolean>(true);

    useEffect(() => {
        let mounted = true;
        let retryCount = 0;
        const maxRetries = 2;

        const fetchData = async (): Promise<void> => {
            try {
                setLoading(true);
                setError(null);

                // まず最新の大会を取得
                const tournaments = await tournamentsApi.getAll();
                if (!mounted) return;

                if (!tournaments || tournaments.length === 0) {
                    setError('NO_TOURNAMENT');
                    setLoading(false);
                    return;
                }

                const latestTournament = tournaments[0];
                const tournamentId = latestTournament.id;
                setTournamentName(latestTournament.name || latestTournament.short_name || '');
                setUseGroupSystem(latestTournament.use_group_system ?? true);

                // タイムアウト付きで試合データをフェッチ
                const fetchPromise = matchesApi.getAll(tournamentId);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT')), 8000)
                );

                const data: any = await Promise.race([fetchPromise, timeoutPromise]);

                if (!mounted) return;

                // Sort by date and time
                const matchList = data.matches || [];
                const sorted = (matchList as MatchData[]).sort((a, b) => {
                    const aTime = `${a.match_date} ${a.match_time}`;
                    const bTime = `${b.match_date} ${b.match_time}`;
                    return new Date(aTime).getTime() - new Date(bTime).getTime();
                });
                setMatches(sorted);
                setLoading(false);
            } catch (err: any) {
                if (!mounted) return;
                console.error("Failed to load matches", err);

                // 自動リトライ（最大2回）
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`[PublicMatchList] Retrying... (${retryCount}/${maxRetries})`);
                    setTimeout(() => {
                        if (mounted) fetchData();
                    }, 1000 * retryCount);
                    return;
                }

                // エラータイプを判定
                const errorMessage = err.message || '';
                if (errorMessage === 'TIMEOUT') {
                    setError('TIMEOUT');
                } else if (errorMessage.includes('permission') || errorMessage.includes('RLS')) {
                    setError('PERMISSION');
                } else {
                    setError('UNKNOWN');
                }
                setLoading(false);
            }
        };

        // 少し遅延してからフェッチ開始（認証状態の安定化を待つ）
        const startTimeout = setTimeout(() => {
            if (mounted) fetchData();
        }, 100);

        return () => {
            mounted = false;
            clearTimeout(startTimeout);
        };
    }, []);

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <LoadingSpinner />
            <p className="text-gray-500 text-sm">データを読み込んでいます...</p>
        </div>
    );

    if (error) {
        const errorContent = {
            NO_TOURNAMENT: {
                icon: <Calendar className="w-12 h-12 text-gray-400 mb-4" />,
                title: '大会が登録されていません',
                description: '公開用の大会データが準備されていないようです。管理者にお問い合わせください。',
                bgColor: 'bg-gray-50',
                textColor: 'text-gray-600',
            },
            TIMEOUT: {
                icon: <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />,
                title: '接続がタイムアウトしました',
                description: '通信状況を確認の上、再読み込みしてください。',
                bgColor: 'bg-yellow-50',
                textColor: 'text-yellow-700',
            },
            PERMISSION: {
                icon: <AlertCircle className="w-12 h-12 text-red-500 mb-4" />,
                title: 'アクセス権限がありません',
                description: '公開ページのデータ取得が許可されていない可能性があります。管理者にお問い合わせください。',
                bgColor: 'bg-red-50',
                textColor: 'text-red-600',
            },
            UNKNOWN: {
                icon: <AlertCircle className="w-12 h-12 text-red-500 mb-4" />,
                title: 'データの読み込みに失敗しました',
                description: '通信状況を確認の上、再読み込みしてください。',
                bgColor: 'bg-red-50',
                textColor: 'text-red-600',
            },
        };
        const content = errorContent[error as keyof typeof errorContent] || errorContent.UNKNOWN;

        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className={`${content.bgColor} ${content.textColor} p-6 rounded-lg max-w-sm w-full`}>
                    {content.icon}
                    <p className="font-bold mb-2">{content.title}</p>
                    <p className="text-sm mb-4 text-gray-600">
                        {content.description}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-gray-700 text-white px-4 py-2 rounded text-sm hover:bg-gray-800 transition-colors"
                    >
                        再読み込み
                    </button>
                    {import.meta.env.DEV && (
                        <div className="mt-4 pt-4 border-t border-gray-200 text-left text-xs font-mono bg-white p-2 rounded text-gray-700">
                            <p>Debug: {error}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (matches.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="font-bold text-gray-700 mb-2">
                    {tournamentName ? `${tournamentName}` : '試合日程'}
                </h3>
                <p className="text-gray-500 text-sm">
                    試合日程がまだ登録されていません。<br />
                    大会開始前にご確認ください。
                </p>
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

    // 時系列ソート: 日付・時間順（早い順）
    const sortedMatches = [...matches].sort((a, b) => {
        const timeA = new Date(`${a.match_date} ${a.match_time}`).getTime();
        const timeB = new Date(`${b.match_date} ${b.match_time}`).getTime();
        return timeA - timeB;
    });

    // グループ一覧を取得（1リーグ制の場合はグループタブを非表示）
    const groupKeys = useGroupSystem
        ? ['all', 'A', 'B', 'C', 'D', 'finals', 'training']
        : ['all', 'finals', 'training'];
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

    // グループ別ビュー用: グループごとに試合を分類（利用可能なグループキーのみ）
    const matchesByGroup = groupKeys.slice(1).reduce((acc, groupKey) => {
        acc[groupKey] = sortedMatches.filter(m => getGroupKey(m) === groupKey);
        return acc;
    }, {} as Record<string, MatchData[]>);

    // フィルタリングされた試合（時系列順）
    const filteredMatches = filterByGroup(sortedMatches);

    return (
        <div className="space-y-4 pb-20">
            {/* グループタブ */}
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

            {/* 試合リスト（時系列順） */}
            {filteredMatches.length > 0 ? (
                <div className="space-y-2">
                    {filteredMatches.map(match => (
                        <PublicMatchCard
                            key={match.id}
                            match={match}
                            groupKey={getGroupKey(match)}
                            groupLabel={getGroupLabel(getGroupKey(match))}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 text-gray-500">
                    このグループの試合はありません
                </div>
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
