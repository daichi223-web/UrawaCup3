#!/usr/bin/env python3
"""
順位表PDF生成スクリプト（日本語フォント対応）

入力JSON形式:
{
  "title": "成績表",
  "groups": [
    {
      "groupId": "A",
      "groupName": "Aグループ",
      "standings": [
        {"rank": 1, "teamName": "チーム名", "played": 3, "won": 2, "drawn": 1, "lost": 0,
         "goalsFor": 5, "goalsAgainst": 1, "goalDifference": 4, "points": 7}
      ]
    }
  ]
}
"""

import json
import sys
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# 日本語フォント登録
def register_japanese_font():
    font_candidates = [
        ('YuGothic', r'C:\Windows\Fonts\YuGothR.ttc', 0),
        ('MSGothic', r'C:\Windows\Fonts\msgothic.ttc', 0),
        ('Meiryo', r'C:\Windows\Fonts\meiryo.ttc', 0),
        ('MSMincho', r'C:\Windows\Fonts\msmincho.ttc', 0),
    ]
    for font_name, font_path, subfont_index in font_candidates:
        if os.path.exists(font_path):
            try:
                pdfmetrics.registerFont(TTFont(font_name, font_path, subfontIndex=subfont_index))
                return font_name
            except Exception:
                continue
    try:
        from reportlab.pdfbase.cidfonts import UnicodeCIDFont
        pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
        return 'HeiseiKakuGo-W5'
    except Exception:
        pass
    return 'Helvetica'

FONT = register_japanese_font()

HEADERS = ['順位', 'チーム', '試合', '勝', '分', '負', '得点', '失点', '得失', '勝点']


class StandingsPDFGenerator:
    """順位表PDF生成"""

    def generate(self, data: dict, output_path: str):
        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )

        elements = []

        title_style = ParagraphStyle(
            'Title', fontName=FONT, fontSize=16, spaceAfter=10, alignment=1
        )
        group_style = ParagraphStyle(
            'Group', fontName=FONT, fontSize=12, spaceAfter=4, spaceBefore=8
        )

        title = data.get('title', '成績表')
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 5 * mm))

        groups = data.get('groups', [])
        for group in groups:
            group_name = group.get('groupName', '')
            if group_name:
                elements.append(Paragraph(group_name, group_style))

            standings = group.get('standings', [])
            table_data = [HEADERS]
            for s in standings:
                table_data.append([
                    s.get('rank', ''),
                    s.get('teamName', ''),
                    s.get('played', 0),
                    s.get('won', 0),
                    s.get('drawn', 0),
                    s.get('lost', 0),
                    s.get('goalsFor', 0),
                    s.get('goalsAgainst', 0),
                    s.get('goalDifference', 0),
                    s.get('points', 0),
                ])

            col_widths = [25, 100, 30, 25, 25, 25, 30, 30, 30, 30]
            table = Table(table_data, colWidths=col_widths)
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), FONT),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#428bca')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('ALIGN', (1, 1), (1, -1), 'LEFT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            elements.append(table)
            elements.append(Spacer(1, 5 * mm))

        doc.build(elements)
        return output_path


def create_sample_data():
    return {
        "title": "成績表",
        "groups": [
            {
                "groupId": "A",
                "groupName": "Aグループ",
                "standings": [
                    {"rank": 1, "teamName": "浦和南", "played": 3, "won": 2, "drawn": 1, "lost": 0,
                     "goalsFor": 5, "goalsAgainst": 1, "goalDifference": 4, "points": 7},
                    {"rank": 2, "teamName": "大宮東", "played": 3, "won": 1, "drawn": 1, "lost": 1,
                     "goalsFor": 3, "goalsAgainst": 3, "goalDifference": 0, "points": 4},
                ]
            }
        ]
    }


if __name__ == '__main__':
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = create_sample_data()
    gen = StandingsPDFGenerator()
    gen.generate(data, 'standings.pdf')
    print('Generated standings.pdf')
