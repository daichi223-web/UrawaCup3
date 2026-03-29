#!/usr/bin/env python3
"""
星取表（リーグ表）PDF生成 - A4横向き

入力JSON形式:
{
  "title": "第45回浦和カップ 成績表",
  "teams": [{"id": 1, "shortName": "浦和南"}, ...],
  "matches": [{"homeTeamId": 1, "awayTeamId": 2, "homeScore": 2, "awayScore": 1}, ...]
}
"""

import json
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from pdf_utils import register_japanese_font

FONT = register_japanese_font()


class StarTablePDFGenerator:
    """星取表PDF生成（A4横向き）"""

    def generate(self, data: dict, output_path: str):
        doc = SimpleDocTemplate(
            output_path,
            pagesize=landscape(A4),
            leftMargin=10 * mm,
            rightMargin=10 * mm,
            topMargin=10 * mm,
            bottomMargin=10 * mm,
        )

        elements = []

        title_style = ParagraphStyle(
            'Title', fontName=FONT, fontSize=14, spaceAfter=6, alignment=1
        )
        note_style = ParagraphStyle(
            'Note', fontName=FONT, fontSize=7, spaceAfter=4, alignment=1,
            textColor=colors.grey,
        )

        title = data.get('title', '成績表')
        elements.append(Paragraph(title, title_style))
        elements.append(Paragraph('○勝　△分　●負', note_style))

        teams = data.get('teams', [])
        matches = data.get('matches', [])
        n = len(teams)

        if n == 0:
            elements.append(Paragraph('データがありません', note_style))
            doc.build(elements)
            return output_path

        # チームIDからインデックスへのマップ
        id_to_idx = {t['id']: i for i, t in enumerate(teams)}

        # 対戦マトリクス構築
        matrix = [['' for _ in range(n)] for _ in range(n)]
        for m in matches:
            h_id = m.get('homeTeamId')
            a_id = m.get('awayTeamId')
            hs = m.get('homeScore')
            a_s = m.get('awayScore')
            if h_id is None or a_id is None or hs is None or a_s is None:
                continue
            hi = id_to_idx.get(h_id)
            ai = id_to_idx.get(a_id)
            if hi is None or ai is None:
                continue

            # ホーム視点
            if hs > a_s:
                matrix[hi][ai] = f'○{hs}-{a_s}'
            elif hs == a_s:
                matrix[hi][ai] = f'△{hs}-{a_s}'
            else:
                matrix[hi][ai] = f'●{hs}-{a_s}'

            # アウェイ視点
            if a_s > hs:
                matrix[ai][hi] = f'○{a_s}-{hs}'
            elif a_s == hs:
                matrix[ai][hi] = f'△{a_s}-{hs}'
            else:
                matrix[ai][hi] = f'●{a_s}-{hs}'

        # テーブルデータ構築
        # ヘッダー行: No., チーム, 1, 2, 3, ...
        header = ['', 'チーム'] + [str(i + 1) for i in range(n)]
        table_data = [header]

        for i, team in enumerate(teams):
            row = [str(i + 1), team.get('shortName', '')]
            for j in range(n):
                if i == j:
                    row.append('-')
                else:
                    row.append(matrix[i][j])
            table_data.append(row)

        # 列幅計算（A4横: 841.89pt - 56.7pt margins ≈ 785pt）
        available = 785
        rank_w = 18
        name_w = 72
        cell_w = (available - rank_w - name_w) / n
        col_widths = [rank_w, name_w] + [cell_w] * n

        table = Table(table_data, colWidths=col_widths, hAlign='CENTER')

        style_cmds = [
            ('FONTNAME', (0, 0), (-1, -1), FONT),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('FONTSIZE', (0, 0), (-1, 0), 6),   # ヘッダー行
            ('FONTSIZE', (0, 1), (0, -1), 6),    # No.列
            ('FONTSIZE', (1, 1), (1, -1), 6.5),  # チーム名列
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2B6CB0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 1), (0, -1), colors.HexColor('#2B6CB0')),
            ('TEXTCOLOR', (0, 1), (0, -1), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (1, 1), (1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#cccccc')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 1.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 1),
            ('RIGHTPADDING', (0, 0), (-1, -1), 1),
            ('LEFTPADDING', (1, 1), (1, -1), 3),  # チーム名に少し余白
            ('ROWBACKGROUNDS', (0, 1), (-1, -1),
             [colors.white, colors.HexColor('#f8f8f8')]),
        ]

        # 対角線セル（自チーム）をグレーに
        for i in range(n):
            r = i + 1  # ヘッダー行分オフセット
            c = i + 2  # No.+チーム名分オフセット
            style_cmds.append(('BACKGROUND', (c, r), (c, r), colors.HexColor('#d9d9d9')))

        table.setStyle(TableStyle(style_cmds))
        elements.append(table)

        # 凡例（チーム番号対応）
        elements.append(Spacer(1, 3 * mm))
        legend_style = ParagraphStyle(
            'Legend', fontName=FONT, fontSize=6, leading=8,
        )
        # 4列×6行で番号対応を表示
        lines = []
        for i in range(0, n, 6):
            chunk = []
            for j in range(i, min(i + 6, n)):
                chunk.append(f'{j+1}:{teams[j].get("shortName", "")}')
            lines.append('　　'.join(chunk))
        elements.append(Paragraph('<br/>'.join(lines), legend_style))

        doc.build(elements)
        return output_path


if __name__ == '__main__':
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            data = json.load(f)
        gen = StarTablePDFGenerator()
        gen.generate(data, 'star_table.pdf')
        print('Generated star_table.pdf')
