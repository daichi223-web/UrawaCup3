import { useState, useEffect } from 'react';
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

    useEffect(() => {
        const fetchStandings = async () => {
            try {
                setLoading(true);
                setError(null);

                // 順位表データを取得（APIがチームへのフォールバックを含む）
                console.log('[PublicStandings] Fetching standings for tournament 1...');
                const data = await standingsApi.getByGroup(1);
                console.log('[PublicStandings] API response:', JSON.stringify(data, null, 2));

                // Transform Array to Map for easier access by tab
                const standingsMap: Record<string, StandingData[]> = {};
                if (Array.isArray(data)) {
                    console.log('[PublicStandings] Data is array with', data.length, 'groups');
                    data.forEach((groupData: GroupStandingsData) => {
                        console.log('[PublicStandings] Group:', groupData.groupId, 'has', groupData.standings?.length, 'teams');
                        if (groupData.groupId) {
                            standingsMap[groupData.groupId] = groupData.standings;
                        }
                    });
                } else {
                    console.log('[PublicStandings] Data is NOT an array:', typeof data);
                }

                console.log('[PublicStandings] Final standingsMap keys:', Object.keys(standingsMap));
                setStandings(standingsMap);
            } catch (err) {
                console.error("Failed to load standings", err);
                setError("順位表の読み込みに失敗しました");
            } finally {
                setLoading(false);
            }
        };
        fetchStandings();
    }, []);

    if (loading) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

    if (error) {
        return (
            <div className="text-center py-10 text-red-600">
                {error}
            </div>
        );
    }

    const currentGroupStandings = standings[activeTab] || [];

    // デバッグ情報を表示
    const showDebug = true; // TODO: 本番前にfalseにする

    return (
        <div className="space-y-4 pb-20">
            <h1 className="text-xl font-bold text-gray-800 px-1">予選リーグ順位表</h1>

            {/* デバッグ情報（問題解決後に削除） */}
            {showDebug && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-xs space-y-1">
                    <div className="font-bold text-yellow-800">🔍 デバッグ情報</div>
                    <div>standings keys: [{Object.keys(standings).map(k => `"${k}"`).join(', ')}]</div>
                    <div>activeTab: "{activeTab}"</div>
                    <div>standings[activeTab]: {standings[activeTab] ? `${standings[activeTab].length}件` : 'undefined'}</div>
                    <div>currentGroupStandings: {currentGroupStandings.length}件</div>
                    {Object.entries(standings).map(([key, value]) => (
                        <div key={key}>Group {key}: {value?.length || 0}チーム</div>
                    ))}
                </div>
            )}

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
                            <th className="py-3 text-center w-8">勝</th>
                            <th className="py-3 text-center w-8">敗</th>
                            <th className="py-3 text-center w-8">分</th>
                            <th className="py-3 text-center w-8">得</th>
                            <th className="py-3 text-center w-8">失</th>
                            <th className="py-3 text-center w-10">差</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {currentGroupStandings.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-8 text-gray-400">データなし</td></tr>
                        ) : (
                            currentGroupStandings.map((row, index) => (
                                <tr key={index} className={`hover:bg-red-50 transition-colors ${index < 2 ? 'bg-green-50/50' : ''}`}>
                                    <td className="py-3 pl-3 text-center font-bold text-gray-700">
                                        {row.rank || index + 1}
                                    </td>
                                    <td className="py-3 font-bold text-gray-800">
                                        {row.team?.name ?? `Team ${row.team_id}`}
                                    </td>
                                    <td className="py-3 text-center text-gray-600">{row.won}</td>
                                    <td className="py-3 text-center text-gray-600">{row.lost}</td>
                                    <td className="py-3 text-center text-gray-600">{row.drawn}</td>
                                    <td className="py-3 text-center text-gray-600">{row.goals_for}</td>
                                    <td className="py-3 text-center text-gray-600">{row.goals_against}</td>
                                    <td className="py-3 text-center font-medium text-gray-900">
                                        {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <p className="text-[10px] text-gray-400 px-2">
                ※ 順位決定ルール: 1.勝点 2.得失点 3.総得点 4.直接対決
            </p>
        </div>
    );
}
