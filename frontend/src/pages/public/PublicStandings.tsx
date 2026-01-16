import { useState, useEffect, useCallback } from 'react';
import { standingsApi } from '@/lib/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Supabaseから取得するデータの型
interface StandingData {
    team_id: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    points: number;
    rank: number;
    team: { id: number; name: string } | null;
}

interface GroupStandingsData {
    groupId: string;
    groupName: string;
    standings: StandingData[];
}

export default function PublicStandings() {
    const [standings, setStandings] = useState<Record<string, StandingData[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('A');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchStandings = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            setError(null);

            // 順位表データを取得（APIがチームへのフォールバックを含む）
            const data = await standingsApi.getByGroup(1);

            // Transform Array to Map for easier access by tab
            const standingsMap: Record<string, StandingData[]> = {};
            if (Array.isArray(data)) {
                data.forEach((groupData: GroupStandingsData) => {
                    if (groupData.groupId) {
                        standingsMap[groupData.groupId] = groupData.standings;
                    }
                });
            }

            setStandings(standingsMap);
            setLastUpdated(new Date());
        } catch (err) {
            console.error("Failed to load standings", err);
            setError("順位表の読み込みに失敗しました");
        } finally {
            setLoading(false);
        }
    }, []);

    // 初回読み込み
    useEffect(() => {
        fetchStandings();
    }, [fetchStandings]);

    // 30秒ごとに自動更新
    useEffect(() => {
        const interval = setInterval(() => {
            fetchStandings(false); // ローディング表示なしで更新
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchStandings]);

    if (loading) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

    if (error) {
        return (
            <div className="text-center py-10 text-red-600">
                {error}
            </div>
        );
    }

    const currentGroupStandings = standings[activeTab] || [];

    return (
        <div className="space-y-4 pb-20">
            <h1 className="text-xl font-bold text-gray-800 px-1">予選リーグ順位表</h1>

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

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                        <tr>
                            <th className="py-3 pl-3 text-center w-10">順位</th>
                            <th className="py-3 text-left">チーム</th>
                            <th className="py-3 text-center w-8">試</th>
                            <th className="py-3 text-center w-8">勝</th>
                            <th className="py-3 text-center w-8">分</th>
                            <th className="py-3 text-center w-8">負</th>
                            <th className="py-3 text-center w-8">得</th>
                            <th className="py-3 text-center w-8">失</th>
                            <th className="py-3 text-center w-10">差</th>
                            <th className="py-3 pr-3 text-center w-12 bg-red-50 text-red-600 font-bold">勝点</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {currentGroupStandings.length === 0 ? (
                            <tr><td colSpan={10} className="text-center py-8 text-gray-400">データなし</td></tr>
                        ) : (
                            currentGroupStandings.map((row, index) => (
                                <tr key={index} className={`hover:bg-red-50 transition-colors ${index < 2 ? 'bg-green-50/50' : ''}`}>
                                    <td className="py-3 pl-3 text-center font-bold text-gray-700">
                                        {row.rank || index + 1}
                                    </td>
                                    <td className="py-3 font-bold text-gray-800">
                                        {row.team?.name ?? `Team ${row.team_id}`}
                                    </td>
                                    <td className="py-3 text-center text-gray-600">{row.played}</td>
                                    <td className="py-3 text-center text-gray-600">{row.won}</td>
                                    <td className="py-3 text-center text-gray-600">{row.drawn}</td>
                                    <td className="py-3 text-center text-gray-600">{row.lost}</td>
                                    <td className="py-3 text-center text-gray-600">{row.goals_for}</td>
                                    <td className="py-3 text-center text-gray-600">{row.goals_against}</td>
                                    <td className="py-3 text-center font-medium text-gray-900">
                                        {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                                    </td>
                                    <td className="py-3 pr-3 text-center font-bold text-lg text-red-600 bg-red-50/50">
                                        {row.points}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 最終更新時刻 */}
            {lastUpdated && (
                <p className="text-[10px] text-gray-400 text-center">
                    最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}（30秒ごとに自動更新）
                </p>
            )}

            <p className="text-[10px] text-gray-400 px-2">
                ※ 順位決定ルール: 1.勝点 2.得失点差 3.総得点 4.直接対決
            </p>
        </div>
    );
}
