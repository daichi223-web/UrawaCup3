// src/pages/Standings/constants.ts

// 印刷用スタイル（成績表=A4横 / 順位表=A4横）
export const PRINT_STYLES = `
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .no-print { display: none !important; }
  nav, header, aside, footer, .sidebar { display: none !important; }

  /* 印刷対象のみ表示 */
  .print-content {
    padding: 0 !important;
    margin: 0 !important;
  }
  .print-content .space-y-6 > * {
    margin-top: 4px !important;
  }
  .print-content h1 {
    font-size: 14px !important;
    margin-bottom: 4px !important;
  }

  /* 2x2グリッド（グループ制用） */
  .standings-grid {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 6px !important;
  }
  .standings-grid .card {
    break-inside: avoid;
    page-break-inside: avoid;
    margin: 0 !important;
    box-shadow: none !important;
    border: 1px solid #ddd !important;
  }
  .standings-grid .card-header {
    padding: 3px 6px !important;
    font-size: 10px !important;
  }
  .standings-grid table {
    font-size: 8px !important;
  }
  .standings-grid th,
  .standings-grid td {
    padding: 1px 3px !important;
    line-height: 1.2 !important;
  }

  /* 成績表（星取表）- A4横に24チーム収める */
  .star-table-container {
    overflow: visible !important;
  }
  .star-table-container table {
    font-size: 7px !important;
    width: 100% !important;
    table-layout: fixed !important;
  }
  .star-table-container th,
  .star-table-container td {
    padding: 1px 1px !important;
    line-height: 1.1 !important;
    white-space: nowrap !important;
  }
  .star-table-container th {
    font-size: 6px !important;
  }
  /* チーム名列 */
  .star-table-container td:nth-child(2),
  .star-table-container th:nth-child(2) {
    white-space: normal !important;
    font-size: 6.5px !important;
    max-width: 60px !important;
  }

  /* カードの影を消す */
  .card {
    box-shadow: none !important;
    border: 1px solid #e5e7eb !important;
  }
}
`

export const GROUP_COLORS: Record<string, string> = {
  A: 'bg-red-100',
  B: 'bg-blue-100',
  C: 'bg-green-100',
  D: 'bg-yellow-100',
}
