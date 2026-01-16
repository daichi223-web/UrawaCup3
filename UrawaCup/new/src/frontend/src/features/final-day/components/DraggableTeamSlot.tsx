// src/features/final-day/components/DraggableTeamSlot.tsx
// クリック入れ替え可能なチーム枠

import type { TeamSlot } from '../types';

// グループ色の定義（A〜Hまで対応）
const GROUP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800' },
  B: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' },
  C: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800' },
  D: { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800' },
  E: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
  F: { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800' },
  G: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800' },
  H: { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-800' },
};

interface DraggableTeamSlotProps {
  matchId: number;
  side: 'home' | 'away';
  team: TeamSlot;
  disabled?: boolean;
  onClick?: () => void;
  /** クリック入れ替えモードで選択されているか */
  isSelected?: boolean;
  /** 会場のグループID（確定時の色決定用） */
  venueGroupId?: string;
  /** 組み合わせ確定済みか */
  isConfirmed?: boolean;
}

export function DraggableTeamSlot({
  matchId: _matchId,
  side: _side,
  team,
  disabled = false,
  onClick,
  isSelected = false,
  venueGroupId,
  isConfirmed = false,
}: DraggableTeamSlotProps) {
  // クリック不可の条件
  const isClickDisabled = disabled || team.type === 'winner' || team.type === 'loser';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isClickDisabled && onClick) {
      onClick();
    }
  };

  // 色を決定: 確定済みなら会場色、未確定ならチームのグループ色
  const getColorClasses = () => {
    if (isClickDisabled) {
      return 'bg-gray-100 border-gray-300';
    }
    if (isSelected) {
      return 'ring-2 ring-blue-500 bg-blue-100 border-blue-500';
    }

    // 確定状態に応じて色を決定
    const colorGroupId = isConfirmed ? venueGroupId : team.groupId;
    const colors = colorGroupId ? GROUP_COLORS[colorGroupId] : null;

    if (colors) {
      return `${colors.bg} ${colors.border}`;
    }

    // デフォルト色（グループ情報がない場合）
    return 'bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400';
  };

  return (
    <div
      className={`
        px-2 py-1 min-w-[70px] text-center text-xs
        border rounded select-none
        transition-all duration-150
        ${isClickDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
        ${getColorClasses()}
      `}
      onClick={handleClick}
    >
      {/* チーム名 */}
      <div className="font-medium truncate">
        {team.displayName}
      </div>
      {/* シード表示 */}
      {team.seed && (
        <div className="text-[10px] text-gray-500">
          {team.seed}
        </div>
      )}
      {/* ロックアイコン（勝者/敗者枠） */}
      {(team.type === 'winner' || team.type === 'loser') && (
        <div className="text-[10px] text-gray-400">
          {team.type === 'winner' ? '(勝者)' : '(敗者)'}
        </div>
      )}
    </div>
  );
}
