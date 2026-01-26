// src/pages/Reports/components/OutstandingPlayersCard.tsx

import { Medal, Trophy, Users } from 'lucide-react';

interface OutstandingPlayersCardProps {
  onOpenModal: () => void;
}

export function OutstandingPlayersCard({ onOpenModal }: OutstandingPlayersCardProps) {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="text-lg font-semibold">優秀選手登録</h3>
      </div>
      <div className="card-body">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Medal className="w-8 h-8 text-yellow-600" />
              <Trophy className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-yellow-800">最優秀選手・優秀選手</h4>
              <p className="text-sm text-yellow-700 mt-1">
                最優秀選手1名、優秀選手11名を登録して報告書に含めます
              </p>
            </div>
            <button
              onClick={onOpenModal}
              className="btn btn-primary flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              優秀選手登録
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
