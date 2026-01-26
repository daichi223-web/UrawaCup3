// src/pages/Reports/components/RecipientsCard.tsx

export function RecipientsCard() {
  return (
    <div className="card opacity-60">
      <div className="card-header flex items-center justify-between">
        <h3 className="text-lg font-semibold">送信先一覧</h3>
        <span className="text-xs bg-gray-200 px-2 py-1 rounded">自動送信は将来実装予定</span>
      </div>
      <div className="card-body">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between py-2 border-b">
            <span>埼玉新聞</span>
            <span className="text-gray-500">sports@saitama-np.co.jp</span>
          </li>
          <li className="flex items-center justify-between py-2 border-b">
            <span>テレビ埼玉</span>
            <span className="text-gray-500">sports@teletama.jp</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
