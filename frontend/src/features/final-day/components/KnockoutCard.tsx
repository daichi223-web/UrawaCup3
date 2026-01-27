// src/features/final-day/components/KnockoutCard.tsx
// 決勝トーナメントカードコンポーネント

import { RefreshCw } from 'lucide-react';
import type { FinalMatch } from '../types';
import { MatchRow } from './MatchRow';

interface KnockoutCardProps {
  venueName: string;
  matches: FinalMatch[];
  onMatchClick?: (match: FinalMatch) => void;
  onUpdateBracket?: () => void;
  isUpdating?: boolean;
  /** クリック入れ替えモード用: 選択中のチーム情報 */
  selectedSlot?: { matchId: number; side: 'home' | 'away' } | null;
  /** クリック入れ替えモード用: チームスロットクリック時のコールバック */
  onSlotClick?: (matchId: number, side: 'home' | 'away') => void;
}

export function KnockoutCard({
  venueName,
  matches,
  onMatchClick,
  onUpdateBracket,
  isUpdating,
  selectedSlot,
  onSlotClick,
}: KnockoutCardProps) {
  // 試合を種別でソート
  const sortedMatches = [...matches].sort((a, b) => {
    const order = { semifinal: 1, training: 2, third_place: 3, final: 4 };
    const aOrder = order[a.matchType] || 99;
    const bOrder = order[b.matchType] || 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.matchOrder - b.matchOrder;
  });

  // 準決勝が両方完了しているかチェック
  const semifinals = matches.filter((m) => m.matchType === 'semifinal');
  const bothSemifinalsCompleted =
    semifinals.length === 2 &&
    semifinals.every((m) => m.status === 'completed');

  return (
    <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* 会場名ヘッダー */}
      <div className="bg-blue-600 text-white px-3 py-2 font-semibold text-center border-b text-sm">
        <div className="flex items-center justify-center gap-2">
          <span>{venueName}</span>
          <span className="px-1.5 py-0.5 bg-blue-500 text-blue-100 text-xs rounded">決勝</span>
        </div>
        {onUpdateBracket && bothSemifinalsCompleted && (
          <button
            onClick={onUpdateBracket}
            disabled={isUpdating}
            className="mt-1 text-xs px-2 py-1 bg-white text-blue-700 rounded hover:bg-blue-50 disabled:opacity-50 inline-flex items-center gap-1"
            title="準決勝結果を3決・決勝に反映"
          >
            <RefreshCw size={12} className={isUpdating ? 'animate-spin' : ''} />
            結果反映
          </button>
        )}
      </div>

      {/* 試合テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs">
              <th className="px-2 py-1 w-8"></th>
              <th className="px-2 py-1 w-16">KO</th>
              <th className="px-2 py-1">対 戦</th>
              <th className="px-2 py-1 w-20">審 判</th>
            </tr>
          </thead>
          <tbody>
            {sortedMatches.length > 0 ? (
              sortedMatches.map((match) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  onMatchClick={onMatchClick}
                  showLabel={true}
                  selectedSlot={selectedSlot}
                  onSlotClick={onSlotClick}
                />
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  決勝トーナメントが生成されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
