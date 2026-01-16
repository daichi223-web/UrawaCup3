import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, RefreshCw } from 'lucide-react';
import { standingsApi } from '@/lib/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// lib/api.tsから返されるデータ型
interface TopScorer {
    rank: number;
    scorerName: string;
    teamId: number;
    teamName: string;
    goals: number;
}

export default function PublicScorerRanking() {
    const tournamentId = 1;

    const {
        data: scorers = [],
        isLoading,
        isError,
        refetch,
        isFetching,
    } = useQuery<TopScorer[]>({
        queryKey: ['top-scorers', tournamentId],
        queryFn: () => standingsApi.getTopScorers(tournamentId, 30),
        refetchOnWindowFocus: true,
        staleTime: 30000,
    });

    // 順位に応じたスタイル
    const getRankStyle = (rank: number) => {
        switch (rank) {
            case 1:
                return { bg: 'bg-yellow-50', icon: <Trophy className="w-5 h-5 text-yellow-500" /> };
            case 2:
                return { bg: 'bg-gray-50', icon: <Medal className="w-5 h-5 text-gray-400" /> };
            case 3:
                return { bg: 'bg-amber-50', icon: <Medal className="w-5 h-5 text-amber-600" /> };
            default:
                return { bg: '', icon: null };
        }
    };

    if (isLoading) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

    if (isError) {
        return (
            <div className="text-center py-10">
                <p className="text-red-500 mb-4">データの取得に失敗しました</p>
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg"
                >
                    再試行
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20">
            <div className="flex items-center justify-between px-1">
                <h1 className="text-xl font-bold text-gray-800">得点ランキング</h1>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                    <RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* ランキング表 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                        <tr>
                            <th className="py-3 pl-3 text-center w-12">#</th>
                            <th className="py-3 text-left">選手</th>
                            <th className="py-3 text-center w-16 bg-blue-50 text-blue-700 font-bold">得点</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {scorers.length === 0 ? (
                            <tr><td colSpan={3} className="text-center py-8 text-gray-400">得点データなし</td></tr>
                        ) : (
                            scorers.map((scorer) => {
                                const style = getRankStyle(scorer.rank);
                                return (
                                    <tr key={`${scorer.teamId}-${scorer.scorerName}`} className={`hover:bg-red-50 transition-colors ${style.bg}`}>
                                        <td className="py-3 pl-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {style.icon}
                                                <span className={`font-bold ${scorer.rank <= 3 ? 'text-lg text-gray-900' : 'text-gray-400'}`}>
                                                    {scorer.rank}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <div className="font-bold text-gray-800">{scorer.scorerName}</div>
                                            <div className="text-xs text-gray-500">{scorer.teamName}</div>
                                        </td>
                                        <td className="py-3 text-center font-black text-blue-600 bg-blue-50 text-lg">
                                            {scorer.goals}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <p className="text-[10px] text-gray-400 px-2">
                ※ 研修試合・オウンゴールは含みません
            </p>
        </div>
    );
}
