// src/pages/Settings/components/TeamSettingsButtons.tsx

interface Props {
  onLocalTeam: () => void
  onRegion: () => void
  onLeague: () => void
}

export function TeamSettingsButtons({ onLocalTeam, onRegion, onLeague }: Props) {
  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">チーム属性設定</h2>
      <p className="text-sm text-gray-600 mb-4">
        チームに地元/リーグ/地域などの属性を設定します。これらは組み合わせ生成時の制約に使用されます。
      </p>
      <div className="flex flex-wrap gap-3">
        <button className="btn-secondary" onClick={onLocalTeam}>
          地元チーム設定
        </button>
        <button className="btn-secondary" onClick={onRegion}>
          地域設定
        </button>
        <button className="btn-secondary" onClick={onLeague}>
          リーグ設定
        </button>
      </div>
    </div>
  )
}
