// src/pages/Standings/constants.ts

// 印刷用スタイル（2x2レイアウトで1ページに収める）
export const PRINT_STYLES = `
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
`

export const GROUP_COLORS: Record<string, string> = {
  A: 'bg-red-100',
  B: 'bg-blue-100',
  C: 'bg-green-100',
  D: 'bg-yellow-100',
}
