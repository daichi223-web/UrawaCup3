// src/pages/Standings/utils/exportStandingsExcel.ts
import ExcelJS from 'exceljs'
import type { GroupStandings } from '@/features/standings'
import type { StandingsEntry } from '../types'

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: '2B6CB0' },
}
const QUALIFYING_FILL: ExcelJS.FillPattern = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' },
}
const ALT_FILL: ExcelJS.FillPattern = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F5F5' },
}

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 10 }
const CELL_FONT: Partial<ExcelJS.Font> = { size: 10 }
const BOLD_FONT: Partial<ExcelJS.Font> = { bold: true, size: 10 }
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 14 }

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, bottom: { style: 'thin' },
  left: { style: 'thin' }, right: { style: 'thin' },
}

function styleHeaderRow(ws: ExcelJS.Worksheet, rowNum: number, colCount: number) {
  const row = ws.getRow(rowNum)
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c)
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = THIN_BORDER
  }
}

function styleDataCell(
  cell: ExcelJS.Cell,
  opts?: { bold?: boolean; align?: 'left' | 'center'; fill?: ExcelJS.FillPattern }
) {
  cell.font = opts?.bold ? BOLD_FONT : CELL_FONT
  cell.alignment = { horizontal: opts?.align || 'center', vertical: 'middle' }
  cell.border = THIN_BORDER
  if (opts?.fill) cell.fill = opts.fill
}

/**
 * 総合順位表をExcelでエクスポート
 */
export async function exportOverallStandingsExcel(
  entries: StandingsEntry[],
  qualifyingCount: number,
  useGroupSystem: boolean,
  tournamentName?: string,
) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('順位表')

  // タイトル
  const title = tournamentName ? `${tournamentName} 順位表` : '順位表'
  const colCount = useGroupSystem ? 11 : 10
  ws.mergeCells(1, 1, 1, colCount)
  const titleCell = ws.getCell('A1')
  titleCell.value = title
  titleCell.font = TITLE_FONT
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 28

  // 注記
  ws.mergeCells(2, 1, 2, colCount)
  const noteCell = ws.getCell('A2')
  noteCell.value = `※ 上位${qualifyingCount}チームが決勝トーナメント進出`
  noteCell.font = { size: 10, color: { argb: 'FF0000' } }
  noteCell.alignment = { horizontal: 'center' }

  // ヘッダー
  const headers = useGroupSystem
    ? ['順位', 'チーム', 'G', '��合', '勝', '分', '負', '得点', '失点', '得失差', '勝点']
    : ['順位', 'チーム', '試合', '勝', '分', '負', '得点', '失点', '得失差', '勝点']
  const headerRow = 4
  ws.getRow(headerRow).values = headers
  styleHeaderRow(ws, headerRow, colCount)

  // 列幅
  if (useGroupSystem) {
    const widths = [6, 18, 5, 6, 6, 6, 6, 6, 6, 7, 7]
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  } else {
    const widths = [6, 18, 6, 6, 6, 6, 6, 6, 7, 7]
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  }

  // データ行
  entries.forEach((entry, idx) => {
    const rowNum = headerRow + 1 + idx
    const isQ = entry.overallRank <= qualifyingCount
    const fill = isQ ? QUALIFYING_FILL : (idx % 2 === 1 ? ALT_FILL : undefined)

    const values = useGroupSystem
      ? [
          entry.overallRank,
          entry.shortName || entry.teamName,
          entry.groupId,
          entry.played,
          entry.won,
          entry.drawn,
          entry.lost,
          entry.goalsFor,
          entry.goalsAgainst ?? (entry.goalsFor - entry.goalDifference),
          entry.goalDifference,
          entry.points,
        ]
      : [
          entry.overallRank,
          entry.shortName || entry.teamName,
          entry.played,
          entry.won,
          entry.drawn,
          entry.lost,
          entry.goalsFor,
          entry.goalsAgainst ?? (entry.goalsFor - entry.goalDifference),
          entry.goalDifference,
          entry.points,
        ]

    ws.getRow(rowNum).values = values
    for (let c = 1; c <= colCount; c++) {
      const cell = ws.getRow(rowNum).getCell(c)
      const isTeamCol = c === 2
      styleDataCell(cell, {
        bold: isQ,
        align: isTeamCol ? 'left' : 'center',
        fill,
      })
    }
  })

  // フッタ��
  const footerRow = headerRow + entries.length + 2
  ws.mergeCells(footerRow, 1, footerRow, colCount)
  const footerCell = ws.getCell(footerRow, 1)
  footerCell.value = '順位決定: 勝点 → 得失点差 → 総得点'
  footerCell.font = { size: 9, color: { argb: '666666' } }

  // 印刷設定
  ws.pageSetup.orientation = 'landscape'
  ws.pageSetup.fitToPage = true
  ws.pageSetup.fitToWidth = 1
  ws.pageSetup.fitToHeight = 1

  return downloadWorkbook(wb, '順位表.xlsx')
}

/**
 * グループ別成績表をExcelでエクスポート
 */
export async function exportGroupStandingsExcel(
  groupStandings: GroupStandings[],
  tournamentName?: string,
) {
  const wb = new ExcelJS.Workbook()

  for (const group of groupStandings) {
    const sheetName = `グループ${group.groupId}`
    const ws = wb.addWorksheet(sheetName)
    const colCount = 10

    // タイトル
    ws.mergeCells(1, 1, 1, colCount)
    const titleCell = ws.getCell('A1')
    titleCell.value = tournamentName
      ? `${tournamentName} ${sheetName}`
      : sheetName
    titleCell.font = TITLE_FONT
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 28

    // ヘッダー
    const headers = ['順位', 'チーム', '試合', '勝', '分', '負', '得点', '失点', '得失差', '勝点']
    const headerRow = 3
    ws.getRow(headerRow).values = headers
    styleHeaderRow(ws, headerRow, colCount)

    const widths = [6, 18, 6, 6, 6, 6, 6, 6, 7, 7]
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    // データ行
    group.standings.forEach((s, idx) => {
      const rowNum = headerRow + 1 + idx
      const isFirst = s.rank === 1
      const fill = isFirst ? QUALIFYING_FILL : (idx % 2 === 1 ? ALT_FILL : undefined)

      ws.getRow(rowNum).values = [
        s.rank,
        s.teamName || s.team?.name || '',
        s.played, s.won, s.drawn, s.lost,
        s.goalsFor, s.goalsAgainst, s.goalDifference, s.points,
      ]

      for (let c = 1; c <= colCount; c++) {
        styleDataCell(ws.getRow(rowNum).getCell(c), {
          bold: isFirst,
          align: c === 2 ? 'left' : 'center',
          fill,
        })
      }
    })

    ws.pageSetup.orientation = 'landscape'
    ws.pageSetup.fitToPage = true
    ws.pageSetup.fitToWidth = 1
    ws.pageSetup.fitToHeight = 1
  }

  return downloadWorkbook(wb, '成績表.xlsx')
}

async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
