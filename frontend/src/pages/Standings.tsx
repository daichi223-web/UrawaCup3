/**
 * 成績表・総合順位表画面
 * グループ別の対戦結果マトリックス表示と総合順位表（リアルタイム更新対応）
 *
 * リアルタイム更新対応:
 * - WebSocket経由で順位表の更新通知を受信
 * - React Queryと連携して自動的にデータを再取得
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertCircle, WifiOff, Clock, Printer, Trophy, Grid3X3 } from 'lucide-react';
import { standingApi, type GroupStandings } from '@/features/standings';
import type { OverallStandings } from '@/features/standings/types';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StarTable from '../components/StarTable';
import { useAppStore } from '@/stores/appStore';
import { matchesApi, teamsApi, venuesApi } from '@/lib/api';

// 印刷用スタイル（2x2レイアウトで1ページに収める）
const printStyles = `
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-size: 9px !important;
  }
  .no-print { display: none !important; }
  nav, header, aside, footer, .sidebar { display: none !important; }

  /* 2x2グリッドレイアウト */
  .standings-grid {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 8px !important;
  }

  /* カードをコンパクトに */
  .standings-grid .card {
    break-inside: avoid;
    page-break-inside: avoid;
    margin: 0 !important;
    box-shadow: none !important;
    border: 1px solid #ddd !important;
  }

  .standings-grid .card-header {
    padding: 4px 8px !important;
    font-size: 11px !important;
  }

  /* テーブルをコンパクトに */
  .standings-grid table {
    font-size: 8px !important;
  }

  .standings-grid th,
  .standings-grid td {
    padding: 2px 4px !important;
    line-height: 1.2 !important;
  }

  .standings-grid th {
    font-size: 7px !important;
  }

  /* タイトル調整 */
  .print-content h1 {
    font-size: 16px !important;
    margin-bottom: 8px !important;
  }

  .print-content .space-y-6 > * {
    margin-top: 8px !important;
  }
}
`;

type ViewMode = 'star' | 'overall';

function Standings() {
  // appStoreから現在のトーナメントIDを取得
  const { currentTournament } = useAppStore();
  const tournamentId = currentTournament?.id;

  // 表示モード（成績表 or 総合順位）
  const [viewMode, setViewMode] = useState<ViewMode>('star');

  // アニメーション用の更新フラグ
  const [recentlyUpdated, setRecentlyUpdated] = useState(false);

  // リアルタイム更新フック
  const { connectionState } = useRealtimeUpdates({
    tournamentId,
    showNotifications: true,
  });

  const isConnected = connectionState === 'connected';

  // React Query を使用してデータを取得（リアルタイム更新と連携）
  const {
    data: groupStandings = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery<GroupStandings[]>({
    queryKey: ['standings', tournamentId],
    queryFn: () => standingApi.getStandingsByGroup(tournamentId!),
    // 自動リフェッチの設定
    refetchOnWindowFocus: false, // WebSocketで更新されるので不要
    staleTime: 30000, // 30秒間はフレッシュとみなす（WebSocketで更新される）
    gcTime: 5 * 60 * 1000, // 5分間キャッシュを保持
    enabled: !!tournamentId, // tournamentIdが確定してから実行
  });

  // 成績表用の試合データを取得
  const { data: matchesData, isLoading: isLoadingMatches } = useQuery({
    queryKey: ['matches', tournamentId],
    queryFn: () => matchesApi.getAll(tournamentId!),
    staleTime: 30000,
    enabled: !!tournamentId,
  });

  // 成績表用のチームデータを取得
  const { data: teamsData, isLoading: isLoadingTeams } = useQuery({
    queryKey: ['teams', tournamentId],
    queryFn: () => teamsApi.getAll(tournamentId!),
    staleTime: 30000,
    enabled: !!tournamentId,
  });

  // 大会形式を取得（グループ制か1リーグ制か）
  const useGroupSystem = (currentTournament as any)?.use_group_system ?? (currentTournament as any)?.useGroupSystem ?? true;

  // 会場一覧を取得（1リーグ制用）
  const { data: venuesData } = useQuery({
    queryKey: ['venues', tournamentId],
    queryFn: () => venuesApi.getAll(tournamentId!),
    staleTime: 30000,
    enabled: !!tournamentId && !useGroupSystem,
  });

  // 総合順位を取得（常に取得）
  const isOverallRanking = currentTournament?.qualification_rule === 'overall_ranking' || !useGroupSystem;
  const { data: overallStandings, isLoading: isLoadingOverall, refetch: refetchOverall } = useQuery<OverallStandings>({
    queryKey: ['overall-standings', tournamentId],
    queryFn: () => standingApi.getOverallStandings(tournamentId!),
    staleTime: 30000,
    enabled: !!tournamentId,
  });

  // 総合順位マップを作成
  const overallRankingsMap = useMemo(() => {
    if (!overallStandings?.entries) return undefined;
    const map = new Map<number, number>();
    overallStandings.entries.forEach(entry => {
      map.set(entry.teamId, entry.overallRank);
    });
    return map;
  }, [overallStandings]);

  // データ更新時のアニメーション
  useEffect(() => {
    if (dataUpdatedAt) {
      setRecentlyUpdated(true);
      const timer = setTimeout(() => setRecentlyUpdated(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [dataUpdatedAt]);

  // 最終更新時刻のフォーマット
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('ja-JP')
    : null;

  // 印刷ハンドラー
  const handlePrint = () => window.print();

  // 更新ハンドラー
  const handleRefresh = () => {
    refetch();
    refetchOverall();
  };

  // tournamentIdがまだない場合やデータロード中はローディング表示
  if (!tournamentId || isLoading || isLoadingTeams || isLoadingMatches) return <LoadingSpinner />;
  if (isError) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-500">成績表の取得に失敗しました</p>
        <p className="text-gray-500 text-sm mt-2">{(error as Error)?.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          再試行
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 印刷用スタイル */}
      <style>{printStyles}</style>
      <div className="space-y-6 print-content">
      {/* ページヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {viewMode === 'star' ? '成績表' : '総合順位表'}
            </h1>
            <p className="text-gray-600 mt-1">
              {viewMode === 'star'
                ? (useGroupSystem ? '各グループの対戦結果を確認できます' : '全チームの対戦結果を確認できます')
                : (useGroupSystem ? '全グループを通じた総合順位を確認できます' : '全チームの総合順位を確認できます')}
            </p>
          </div>
          {/* LIVE インジケーター */}
          <div className={`no-print flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
            isConnected
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                LIVE
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                オフライン
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 no-print">
          {/* 最終更新時刻 */}
          {lastUpdated && (
            <span className={`text-sm flex items-center gap-1.5 transition-colors ${
              recentlyUpdated ? 'text-green-600 font-medium' : 'text-gray-500'
            }`}>
              <Clock className="w-4 h-4" />
              最終更新: {lastUpdated}
              {(isFetching || isLoadingOverall) && !isLoading && (
                <span className="ml-2 text-primary-600">更新中...</span>
              )}
            </span>
          )}
          {/* PDF印刷ボタン */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" />
              PDF印刷
            </button>
            {/* 手動更新ボタン */}
          <button
            onClick={handleRefresh}
            disabled={isFetching || isLoadingOverall}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${(isFetching || isLoadingOverall) ? 'animate-spin' : ''}`} />
            更新
          </button>
        </div>
      </div>

      {/* 表示切り替えタブ */}
      <div className="flex gap-2 no-print">
        <button
          onClick={() => setViewMode('star')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'star'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Grid3X3 className="w-4 h-4" />
          成績表
        </button>
        <button
          onClick={() => setViewMode('overall')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'overall'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${isOverallRanking ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}
        >
          <Trophy className="w-4 h-4" />
          総合順位
          {isOverallRanking && <span className="text-xs bg-amber-600 px-1.5 py-0.5 rounded">採用中</span>}
        </button>
      </div>

      {/* 暫定順位の注意書き */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 no-print">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">暫定{viewMode === 'star' ? '成績表' : '順位表'}</p>
          <p className="text-amber-700">
            試合結果が入力されるとリアルタイムで更新されます。
          </p>
        </div>
      </div>

      {viewMode === 'star' ? (
        // 成績表表示
        <>
          {useGroupSystem ? (
            /* グループ制：グループ別成績表 */
            <div className={`standings-grid grid grid-cols-1 xl:grid-cols-2 gap-6 transition-opacity duration-300 ${
              recentlyUpdated ? 'opacity-80' : 'opacity-100'
            }`}>
              {groupStandings.map((groupData) => {
                // グループのチームと試合を抽出
                const groupTeams = (teamsData?.teams || []).filter(
                  t => (t.group_id || t.groupId) === groupData.groupId
                )
                const groupMatches = (matchesData?.matches || []).filter(
                  m => (m.group_id || m.groupId) === groupData.groupId
                )

                return (
                  <div key={groupData.groupId} className={`card transition-shadow ${
                    recentlyUpdated ? 'shadow-lg ring-2 ring-green-200' : ''
                  }`}>
                    <div className={`card-header group-${groupData.groupId.toLowerCase()} flex justify-between items-center`}>
                      <h3 className="text-lg font-semibold">{groupData.groupId}グループ 成績表</h3>
                    </div>
                    <div className="card-body p-4">
                      {groupTeams.length > 0 ? (
                        <StarTable
                          teams={groupTeams}
                          matches={groupMatches}
                          groupId={groupData.groupId}
                          overallRankings={overallRankingsMap}
                          showOverallRank={isOverallRanking}
                        />
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          チームデータを読み込み中...
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* 1リーグ制：全チーム統合成績表 */
            <div className={`card transition-shadow ${
              recentlyUpdated ? 'shadow-lg ring-2 ring-green-200' : ''
            }`}>
              <div className="card-header bg-primary-600 text-white flex justify-between items-center">
                <h3 className="text-lg font-semibold">全チーム 成績表</h3>
                <span className="text-sm opacity-80">{teamsData?.teams?.length || 0}チーム</span>
              </div>
              <div className="card-body p-4 overflow-x-auto">
                {(teamsData?.teams?.length || 0) > 0 ? (
                  <StarTable
                    teams={teamsData?.teams || []}
                    matches={matchesData?.matches?.filter(m => m.stage === 'preliminary') || []}
                    groupId="all"
                    overallRankings={overallRankingsMap}
                    showOverallRank={true}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    チームデータを読み込み中...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 順位決定ルール説明 */}
          <div className="card no-print">
            <div className="card-header">
              <h3 className="text-lg font-semibold">順位決定ルール</h3>
            </div>
            <div className="card-body">
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                <li>勝点（勝利=3点、引分=1点、敗北=0点）</li>
                <li>得失点差（ゴールディファレンス）</li>
                <li>総得点</li>
                <li>当該チーム間の対戦成績</li>
                <li>抽選</li>
              </ol>
              <p className="mt-3 text-xs text-gray-500">
                {useGroupSystem
                  ? (isOverallRanking
                      ? '※ 総合順位で上位4チームが決勝トーナメントに進出します'
                      : '※ 各グループ上位2チームが決勝トーナメントに進出します')
                  : '※ 総合順位で上位4チームが決勝トーナメントに進出します'}
              </p>
            </div>
          </div>
        </>
      ) : (
        // 総合順位表表示
        <div className="card">
          <div className="card-header bg-amber-500 text-white">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              総合順位表
            </h3>
          </div>
          <div className="card-body p-0">
            {overallStandings && overallStandings.entries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-3 py-3 text-center w-14">順位</th>
                      <th className="px-3 py-3 text-left">チーム</th>
                      {useGroupSystem && <th className="px-3 py-3 text-center w-14">G</th>}
                      <th className="px-3 py-3 text-center w-12">試</th>
                      <th className="px-3 py-3 text-center w-12">勝</th>
                      <th className="px-3 py-3 text-center w-12">分</th>
                      <th className="px-3 py-3 text-center w-12">負</th>
                      <th className="px-3 py-3 text-center w-12">得</th>
                      <th className="px-3 py-3 text-center w-12">失</th>
                      <th className="px-3 py-3 text-center w-14">得失</th>
                      <th className="px-3 py-3 text-center w-14 font-bold">勝点</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overallStandings.entries.map((entry) => {
                      const isQualifying = entry.overallRank <= overallStandings.qualifyingCount;
                      const groupColors: Record<string, string> = {
                        A: 'bg-red-100',
                        B: 'bg-blue-100',
                        C: 'bg-green-100',
                        D: 'bg-yellow-100',
                      };
                      return (
                        <tr
                          key={entry.teamId}
                          className={`border-b hover:bg-gray-50 ${isQualifying ? 'bg-amber-50' : ''}`}
                        >
                          <td className="px-3 py-3 text-center font-bold">
                            {isQualifying ? (
                              <span className="inline-block w-7 h-7 bg-amber-500 text-white rounded-full leading-7 text-sm">
                                {entry.overallRank}
                              </span>
                            ) : (
                              entry.overallRank
                            )}
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {entry.shortName || entry.teamName}
                          </td>
                          {useGroupSystem && (
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${groupColors[entry.groupId] || 'bg-gray-100'}`}>
                                {entry.groupId}
                              </span>
                            </td>
                          )}
                          <td className="px-3 py-3 text-center">{entry.played}</td>
                          <td className="px-3 py-3 text-center text-green-600 font-medium">{entry.won}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{entry.drawn}</td>
                          <td className="px-3 py-3 text-center text-red-500">{entry.lost}</td>
                          <td className="px-3 py-3 text-center">{entry.goalsFor}</td>
                          <td className="px-3 py-3 text-center">{entry.goalsAgainst ?? (entry.goalsFor - entry.goalDifference)}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={entry.goalDifference > 0 ? 'text-green-600 font-medium' : entry.goalDifference < 0 ? 'text-red-500' : ''}>
                              {entry.goalDifference > 0 ? '+' : ''}{entry.goalDifference}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-lg">{entry.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="p-4 bg-gray-50 border-t">
                  <p className="text-sm text-amber-600 font-medium">
                    ※ 上位{overallStandings.qualifyingCount}チームが決勝トーナメント進出
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    順位決定: 勝点 → 得失点差 → 総得点
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>順位データがありません</p>
                <p className="text-sm mt-1">試合結果が入力されると順位が表示されます</p>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  )
}

export default Standings
