// src/pages/Settings/components/VenueSettingsTable.tsx
import type { Venue } from '../types'
import { GROUP_COLORS } from '../constants'

interface Props {
  venues: Venue[] | undefined
  onEdit: (venue: Venue) => void
  onAdd: () => void
}

export function VenueSettingsTable({ venues, onEdit, onAdd }: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">会場設定</h2>
        <button className="btn-secondary text-sm" onClick={onAdd}>
          会場を追加
        </button>
      </div>

      {venues && venues.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">会場名</th>
                <th className="text-left py-2 px-3 font-medium">グループ</th>
                <th className="text-left py-2 px-3 font-medium">用途</th>
                <th className="text-center py-2 px-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => (
                <tr key={venue.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{venue.name}</td>
                  <td className="py-2 px-3">
                    {venue.assigned_group ? (
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          GROUP_COLORS[venue.assigned_group] || 'bg-gray-100'
                        }`}
                      >
                        グループ{venue.assigned_group}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">未割当</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-1">
                      {venue.for_preliminary !== false && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-100 text-green-700">予選</span>
                      )}
                      {venue.for_final_day && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-orange-100 text-orange-700">研修</span>
                      )}
                      {venue.is_finals_venue && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700">決勝</span>
                      )}
                      {venue.is_mixed_use && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 text-purple-700">混合</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      onClick={() => onEdit(venue)}
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-500 py-8">会場が登録されていません</p>
      )}
    </div>
  )
}
