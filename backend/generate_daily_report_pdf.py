#!/usr/bin/env python3
"""
日次報告書PDF生成スクリプト

使い方:
    python generate_daily_report_pdf.py input.json

入力: HTML画面からエクスポートしたJSON
出力: 日次報告書PDF（会場ごとにページ）
"""

import json
import sys
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, 
    Spacer, PageBreak, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# 日本語フォント登録（Windows環境対応）
def register_japanese_font():
    """Windows環境で利用可能な日本語フォントを登録"""
    # (font_name, font_path, subfontIndex) - subfontIndexはTTCファイル用
    font_candidates = [
        # Windows標準フォント（優先度順）
        ('YuGothic', r'C:\Windows\Fonts\YuGothR.ttc', 0),
        ('MSGothic', r'C:\Windows\Fonts\msgothic.ttc', 0),
        ('Meiryo', r'C:\Windows\Fonts\meiryo.ttc', 0),
        ('MSMincho', r'C:\Windows\Fonts\msmincho.ttc', 0),
    ]

    for font_name, font_path, subfont_index in font_candidates:
        if os.path.exists(font_path):
            try:
                pdfmetrics.registerFont(TTFont(font_name, font_path, subfontIndex=subfont_index))
                print(f"[PDF] Using font: {font_name} from {font_path}")
                return font_name
            except Exception as e:
                print(f"[PDF] Font {font_name} failed: {e}")
                continue

    # CIDフォントにフォールバック（環境によっては動作しない可能性あり）
    try:
        from reportlab.pdfbase.cidfonts import UnicodeCIDFont
        pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
        print("[PDF] Using CID font: HeiseiKakuGo-W5")
        return 'HeiseiKakuGo-W5'
    except Exception as e:
        print(f"[PDF] CID font failed: {e}")
        pass

    # 最後の手段: Helvetica（日本語表示不可）
    print("[PDF] WARNING: No Japanese font available, using Helvetica")
    return 'Helvetica'

FONT = register_japanese_font()


class DailyReportGenerator:
    """日次報告書PDF生成"""
    
    def __init__(self, config: dict = None):
        self.config = config or {}
        self.styles = self._create_styles()
    
    def _create_styles(self):
        return {
            'title': ParagraphStyle(
                name='Title', fontName=FONT, fontSize=14, 
                alignment=1, spaceAfter=6
            ),
            'subtitle': ParagraphStyle(
                name='SubTitle', fontName=FONT, fontSize=11, 
                alignment=1, spaceAfter=4
            ),
            'header': ParagraphStyle(
                name='Header', fontName=FONT, fontSize=10, 
                alignment=0
            ),
            'venue': ParagraphStyle(
                name='Venue', fontName=FONT, fontSize=11, 
                spaceBefore=6, spaceAfter=4
            ),
            'match_title': ParagraphStyle(
                name='MatchTitle', fontName=FONT, fontSize=10,
                alignment=1, spaceBefore=8, spaceAfter=4
            ),
            'normal': ParagraphStyle(
                name='Normal', fontName=FONT, fontSize=9
            ),
            'small': ParagraphStyle(
                name='Small', fontName=FONT, fontSize=8
            ),
        }
    
    def generate(self, data: dict, output_path: str):
        """PDF生成"""
        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            topMargin=12*mm,
            bottomMargin=12*mm,
            leftMargin=15*mm,
            rightMargin=15*mm
        )
        
        story = []
        
        # 設定取得
        report_config = data.get('reportConfig', {})
        recipient = report_config.get('recipient', '○○御中')
        sender = report_config.get('sender', '県立浦和高校　森川大地')
        contact = report_config.get('contact', '090-8519-7032')
        day = data.get('day', 1)
        date_str = data.get('dateStr', '2025年3月29日（土）')
        
        # 会場ごとにページ生成
        match_data = data.get('matchData', {})
        venues = [v for v in match_data.keys() if len(match_data[v]) > 0]
        
        for i, venue in enumerate(venues):
            matches = match_data[venue]
            if not matches:
                continue
            
            # ページ内容
            page_content = self._create_venue_page(
                venue, matches, 
                recipient, sender, contact, 
                day, date_str
            )
            story.extend(page_content)
            
            # ページ区切り（最後以外）
            if i < len(venues) - 1:
                story.append(PageBreak())
        
        doc.build(story)
        print(f"✓ PDF生成完了: {output_path}")
    
    def _create_venue_page(
        self, venue: str, matches: list,
        recipient: str, sender: str, contact: str,
        day: int, date_str: str
    ) -> list:
        """会場ごとのページ内容を生成"""
        content = []
        
        # ヘッダー
        content.append(Paragraph(
            "第44回 浦和カップ高校サッカーフェスティバル",
            self.styles['title']
        ))
        content.append(Paragraph(
            "試合結果報告書",
            self.styles['subtitle']
        ))
        content.append(Spacer(1, 2*mm))
        
        # 発信情報
        header_data = [
            ['送信先：', recipient, '', '発信元：', sender],
            ['', '', '', '連絡先：', contact],
            ['', '', '', '', f'{date_str}　第{day}日'],
        ]
        header_table = Table(header_data, colWidths=[18*mm, 45*mm, 10*mm, 18*mm, 60*mm])
        header_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), FONT, 9),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        content.append(header_table)
        content.append(Spacer(1, 3*mm))
        
        # 会場名 + 区切り線
        content.append(Paragraph(f"大会会場：　{venue}", self.styles['venue']))
        line = Table([['']], colWidths=[175*mm])
        line.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, -1), 1, colors.black)
        ]))
        content.append(line)
        content.append(Spacer(1, 5*mm))
        
        # 各試合
        for idx, match in enumerate(matches):
            match_content = self._create_match_row(match, idx + 1)
            content.append(KeepTogether(match_content))
            content.append(Spacer(1, 3*mm))
            
            # 試合間の仕切り線
            if idx < len(matches) - 1:
                divider = Table([['']], colWidths=[175*mm])
                divider.setStyle(TableStyle([
                    ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.Color(0.7, 0.7, 0.7))
                ]))
                content.append(divider)
                content.append(Spacer(1, 3*mm))
        
        return content
    
    def _create_match_row(self, match: dict, match_num: int) -> Table:
        """試合結果 + 得点経過を横並びで生成"""
        
        # データ取得
        home_team = match.get('homeTeam', {}).get('name', '---')
        away_team = match.get('awayTeam', {}).get('name', '---')
        kickoff = match.get('kickoff', '--:--')
        
        h1 = match.get('homeScore1H', '')
        h2 = match.get('homeScore2H', '')
        a1 = match.get('awayScore1H', '')
        a2 = match.get('awayScore2H', '')
        
        home_total = (int(h1) if h1 != '' else 0) + (int(h2) if h2 != '' else 0)
        away_total = (int(a1) if a1 != '' else 0) + (int(a2) if a2 != '' else 0)
        
        h1_str = str(h1) if h1 != '' else '-'
        h2_str = str(h2) if h2 != '' else '-'
        a1_str = str(a1) if a1 != '' else '-'
        a2_str = str(a2) if a2 != '' else '-'
        
        scorers = match.get('scorers', [])
        
        # 左側：試合結果
        result_data = [
            [f'第{match_num}試合', '', f'KO {kickoff}', '', ''],
            [home_team, '', 'VS', away_team, ''],
            ['', '', '', '', ''],
            [str(home_total), f'{h1_str}  前半  {a1_str}', '', str(away_total), ''],
            ['', f'{h2_str}  後半  {a2_str}', '', '', ''],
        ]
        
        result_table = Table(result_data, colWidths=[22*mm, 30*mm, 12*mm, 5*mm, 22*mm])
        result_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), FONT, 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            # 第N試合行
            ('SPAN', (0, 0), (1, 0)),
            ('SPAN', (2, 0), (4, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.93, 0.93, 0.93)),
            ('FONT', (0, 0), (1, 0), FONT, 10),
            ('FONT', (2, 0), (4, 0), FONT, 9),
            ('ALIGN', (2, 0), (4, 0), 'RIGHT'),
            # チーム名行
            ('SPAN', (0, 1), (1, 1)),
            ('SPAN', (3, 1), (4, 1)),
            ('FONT', (0, 1), (-1, 1), FONT, 11),
            # スコア行
            ('FONT', (0, 3), (0, 4), FONT, 18),
            ('FONT', (4, 3), (4, 4), FONT, 18),
            ('SPAN', (0, 3), (0, 4)),
            ('SPAN', (4, 3), (4, 4)),
            ('SPAN', (1, 3), (3, 3)),
            ('SPAN', (1, 4), (3, 4)),
            ('BOX', (0, 3), (0, 4), 1, colors.black),
            ('BOX', (4, 3), (4, 4), 1, colors.black),
        ]))
        
        # 右側：得点経過
        if scorers:
            goal_data = [['時間', 'チーム', '得点者名']]
            for s in scorers[:8]:  # 最大8人まで表示
                goal_data.append([
                    f"{s.get('time', '')}'",
                    s.get('team', ''),
                    s.get('name', '')
                ])
            if len(scorers) > 8:
                goal_data.append(['', f'他{len(scorers)-8}名', ''])
            
            goal_table = Table(goal_data, colWidths=[12*mm, 28*mm, 38*mm])
            goal_table.setStyle(TableStyle([
                ('FONT', (0, 0), (-1, -1), FONT, 8),
                ('ALIGN', (0, 0), (0, -1), 'CENTER'),
                ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                ('ALIGN', (2, 0), (2, -1), 'LEFT'),
                ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.9, 0.9, 0.9)),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.Color(0.8, 0.8, 0.8)),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]))
        else:
            # 得点なし
            goal_data = [['得点経過'], ['（得点なし）']]
            goal_table = Table(goal_data, colWidths=[78*mm])
            goal_table.setStyle(TableStyle([
                ('FONT', (0, 0), (-1, -1), FONT, 9),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.Color(0.5, 0.5, 0.5)),
            ]))
        
        # 左右を結合
        combined = Table(
            [[result_table, goal_table]],
            colWidths=[95*mm, 80*mm]
        )
        combined.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (1, 0), (1, 0), 8),
        ]))
        
        return combined


def load_json(filepath: str) -> dict:
    """JSONファイルを読み込み"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def main():
    # コマンドライン引数またはサンプルデータ
    if len(sys.argv) > 1:
        json_path = sys.argv[1]
        data = load_json(json_path)
        
        # matchDataの構造を変換（HTML出力形式 → PDF用形式）
        if 'matchData' in data:
            # Day1のデータを取得
            day_data = data['matchData'].get('1', data['matchData'])
            output_data = {
                'day': 1,
                'dateStr': '2025年3月29日（土）',
                'reportConfig': {
                    'recipient': '埼玉県サッカー協会 御中',
                    'sender': '県立浦和高校　森川大地',
                    'contact': '090-8519-7032',
                },
                'matchData': day_data,
            }
        else:
            output_data = data
        
        output_path = json_path.replace('.json', '_report.pdf')
    else:
        # サンプルデータで生成
        output_data = create_sample_data()
        output_path = 'sample_daily_report.pdf'
    
    generator = DailyReportGenerator()
    generator.generate(output_data, output_path)


def create_sample_data() -> dict:
    """サンプルデータ"""
    return {
        'day': 1,
        'dateStr': '2025年3月29日（土）',
        'reportConfig': {
            'recipient': '埼玉県サッカー協会 御中',
            'sender': '県立浦和高校　森川大地',
            'contact': '090-8519-7032',
        },
        'matchData': {
            '浦和南高G': [
                {
                    'homeTeam': {'name': '浦和南'},
                    'awayTeam': {'name': '専大北上'},
                    'kickoff': '9:00',
                    'homeScore1H': 0, 'homeScore2H': 0,
                    'awayScore1H': 1, 'awayScore2H': 1,
                    'scorers': [
                        {'time': '16', 'team': '専大北上', 'name': '山崎 諒太'},
                        {'time': '41', 'team': '専大北上', 'name': '稲葉 蓮'},
                    ]
                },
                {
                    'homeTeam': {'name': '東海大相模'},
                    'awayTeam': {'name': '健大高崎'},
                    'kickoff': '10:05',
                    'homeScore1H': 1, 'homeScore2H': 0,
                    'awayScore1H': 0, 'awayScore2H': 0,
                    'scorers': [
                        {'time': '6', 'team': '東海大相模', 'name': '戸川 昌也'},
                    ]
                },
                {
                    'homeTeam': {'name': '健大高崎'},
                    'awayTeam': {'name': '専大北上'},
                    'kickoff': '11:10',
                    'homeScore1H': 0, 'homeScore2H': 0,
                    'awayScore1H': 0, 'awayScore2H': 0,
                    'scorers': []
                },
                {
                    'homeTeam': {'name': '浦和南'},
                    'awayTeam': {'name': '東海大相模'},
                    'kickoff': '12:15',
                    'homeScore1H': 1, 'homeScore2H': 0,
                    'awayScore1H': 0, 'awayScore2H': 1,
                    'scorers': [
                        {'time': '6', 'team': '浦和南', 'name': '大塚 逸平'},
                        {'time': '51', 'team': '東海大相模', 'name': '戸川 昌也'},
                    ]
                },
            ],
            '市立浦和高G': [
                {
                    'homeTeam': {'name': '市立浦和'},
                    'awayTeam': {'name': '旭川実業'},
                    'kickoff': '9:00',
                    'homeScore1H': 0, 'homeScore2H': 1,
                    'awayScore1H': 0, 'awayScore2H': 1,
                    'scorers': [
                        {'time': '31', 'team': '市立浦和', 'name': '嶋田 秀太朗'},
                        {'time': '47', 'team': '旭川実業', 'name': '森 悠斗'},
                    ]
                },
                {
                    'homeTeam': {'name': '新潟西'},
                    'awayTeam': {'name': '富士市立'},
                    'kickoff': '10:05',
                    'homeScore1H': 0, 'homeScore2H': 0,
                    'awayScore1H': 0, 'awayScore2H': 1,
                    'scorers': [
                        {'time': '44', 'team': '富士市立', 'name': '遠藤 壮大'},
                    ]
                },
                {
                    'homeTeam': {'name': '市立浦和'},
                    'awayTeam': {'name': '新潟西'},
                    'kickoff': '11:10',
                    'homeScore1H': 0, 'homeScore2H': 2,
                    'awayScore1H': 0, 'awayScore2H': 0,
                    'scorers': [
                        {'time': '34', 'team': '市立浦和', 'name': '川津 創史'},
                        {'time': '48', 'team': '市立浦和', 'name': '大木 彬照'},
                    ]
                },
                {
                    'homeTeam': {'name': '旭川実業'},
                    'awayTeam': {'name': '富士市立'},
                    'kickoff': '12:15',
                    'homeScore1H': 0, 'homeScore2H': 0,
                    'awayScore1H': 0, 'awayScore2H': 2,
                    'scorers': [
                        {'time': '46', 'team': '富士市立', 'name': '遠藤 壮大'},
                        {'time': '50', 'team': '富士市立', 'name': '小山 慶'},
                    ]
                },
            ],
        }
    }


if __name__ == "__main__":
    main()
