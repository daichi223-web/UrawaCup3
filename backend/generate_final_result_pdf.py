#!/usr/bin/env python3
"""
最終結果報告書PDF生成スクリプト

使い方:
    python generate_final_result_pdf.py final_results_for_pdf.json

入力: final_day_results.html からエクスポートしたJSON
出力: 最終結果報告書PDF
"""

import json
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, 
    Spacer, KeepTogether
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


class FinalResultPDFGenerator:
    """最終結果報告書PDF生成"""
    
    def __init__(self, config: dict = None):
        self.config = config or {}
        self.styles = self._create_styles()
    
    def _create_styles(self):
        return {
            'title': ParagraphStyle(
                name='Title', fontName=FONT, fontSize=16, 
                alignment=1, spaceAfter=8
            ),
            'subtitle': ParagraphStyle(
                name='SubTitle', fontName=FONT, fontSize=12, 
                alignment=1, spaceAfter=6
            ),
            'section': ParagraphStyle(
                name='Section', fontName=FONT, fontSize=11, 
                spaceBefore=12, spaceAfter=6
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
            topMargin=15*mm,
            bottomMargin=15*mm,
            leftMargin=15*mm,
            rightMargin=15*mm
        )
        
        story = []
        
        # タイトル
        story.append(Paragraph(
            "第44回 浦和カップ高校サッカーフェスティバル",
            self.styles['title']
        ))
        story.append(Paragraph(
            "最終結果報告書",
            self.styles['subtitle']
        ))
        story.append(Spacer(1, 3*mm))
        
        # 発信情報
        config = data.get('reportConfig', {})
        header_data = [
            ['日付', data.get('date', '2025年3月31日（月）最終日')],
            ['発信元', config.get('sender', '県立浦和高校　森川大地')],
        ]
        header_table = Table(header_data, colWidths=[25*mm, 80*mm])
        header_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), FONT, 9),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 8*mm))
        
        # 最終順位
        story.append(Paragraph("■ 最終順位", self.styles['section']))
        story.extend(self._create_ranking_table(data.get('ranking', [])))
        story.append(Spacer(1, 8*mm))
        
        # 決勝トーナメント結果
        story.append(Paragraph("■ 決勝トーナメント結果", self.styles['section']))
        story.extend(self._create_tournament_table(data.get('tournament', [])))
        story.append(Spacer(1, 8*mm))
        
        # 優秀選手
        story.append(Paragraph("■ 優秀選手", self.styles['section']))
        story.extend(self._create_players_table(data.get('players', [])))
        story.append(Spacer(1, 8*mm))
        
        # 研修試合結果（全件）
        story.append(Paragraph("■ 研修試合結果", self.styles['section']))
        story.extend(self._create_training_summary(data.get('training', [])))
        
        doc.build(story)
        print(f"✓ PDF生成完了: {output_path}")
    
    def _create_ranking_table(self, ranking: list) -> list:
        """最終順位表"""
        labels = ['優勝', '準優勝', '第3位', '第4位']
        
        data = [['順位', 'チーム名']]
        for r in ranking[:4]:
            rank = r.get('rank', 0)
            team = r.get('team', '---')
            label = labels[rank - 1] if 0 < rank <= 4 else f'{rank}位'
            data.append([label, team or '---'])
        
        table = Table(data, colWidths=[30*mm, 70*mm])
        
        style = [
            ('FONT', (0, 0), (-1, -1), FONT, 12),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.2, 0.3, 0.5)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]
        
        # 順位別の背景色
        if len(data) > 1:
            style.append(('BACKGROUND', (0, 1), (-1, 1), colors.Color(1, 0.85, 0.4)))  # 金
        if len(data) > 2:
            style.append(('BACKGROUND', (0, 2), (-1, 2), colors.Color(0.85, 0.85, 0.85)))  # 銀
        if len(data) > 3:
            style.append(('BACKGROUND', (0, 3), (-1, 3), colors.Color(0.8, 0.5, 0.2)))  # 銅
        
        table.setStyle(TableStyle(style))
        return [table]
    
    def _create_tournament_table(self, matches: list) -> list:
        """決勝トーナメント結果表"""
        data = [['種別', 'ホーム', 'スコア', 'アウェイ']]
        
        for m in matches:
            data.append([
                m.get('type', ''),
                m.get('home', ''),
                m.get('score', ''),
                m.get('away', ''),
            ])
        
        table = Table(data, colWidths=[30*mm, 45*mm, 35*mm, 45*mm])
        
        style = [
            ('FONT', (0, 0), (-1, -1), FONT, 9),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.2, 0.3, 0.5)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]
        
        # 決勝をハイライト
        if len(data) > 4:
            style.append(('BACKGROUND', (0, -1), (-1, -1), colors.Color(1, 0.95, 0.8)))
        
        table.setStyle(TableStyle(style))
        return [table]
    
    def _create_players_table(self, players: list) -> list:
        """優秀選手表"""
        if not players:
            return [Paragraph("（データなし）", self.styles['small'])]
        
        data = [['賞', '選手名', 'チーム名']]
        for p in players:
            data.append([
                p.get('type', '優秀選手'),
                p.get('name', ''),
                p.get('team', ''),
            ])
        
        table = Table(data, colWidths=[30*mm, 50*mm, 50*mm])
        
        style = [
            ('FONT', (0, 0), (-1, -1), FONT, 9),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('ALIGN', (1, 1), (1, -1), 'LEFT'),
            ('ALIGN', (2, 1), (2, -1), 'LEFT'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.2, 0.3, 0.5)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]
        
        # MVPをハイライト
        if len(data) > 1 and players[0].get('type') == '最優秀選手':
            style.append(('BACKGROUND', (0, 1), (-1, 1), colors.Color(1, 0.9, 0.7)))
        
        table.setStyle(TableStyle(style))
        return [table]
    
    def _create_training_summary(self, training: list) -> list:
        """研修試合結果（4会場横並びテーブル）"""
        content = []
        
        # 会場ごとにグループ化
        venues = ['浦和南高G', '市立浦和高G', '浦和学院高G', '武南高G']
        venue_short = ['浦和南', '市立浦和', '浦和学院', '武南']
        by_venue = {v: [] for v in venues}
        
        for m in training:
            venue = m.get('venue', '')
            if venue in by_venue:
                by_venue[venue].append(m)
        
        # KO時間のリスト
        kickoff_times = ['9:30', '10:35', '11:40', '12:45', '13:50']
        
        # ヘッダー行
        header = ['KO'] + venue_short
        data = [header]
        
        # 各KO時間の行を作成
        for ko in kickoff_times:
            row = [ko]
            for venue in venues:
                matches = by_venue[venue]
                match_text = ''
                for m in matches:
                    if m.get('kickoff', '') == ko:
                        home = m.get('home', '')
                        away = m.get('away', '')
                        score = m.get('score', '-')
                        match_text = f"{home}\n{score}\n{away}"
                        break
                row.append(match_text)
            
            # 空行でなければ追加
            if any(row[1:]):
                data.append(row)
        
        col_width = 42*mm
        table = Table(data, colWidths=[12*mm, col_width, col_width, col_width, col_width])
        
        style = [
            ('FONT', (0, 0), (-1, -1), FONT, 7),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.6, 0.2, 0.2)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 1), (0, -1), colors.Color(0.95, 0.95, 0.95)),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (1, 1), (-1, -1), 2),
            ('RIGHTPADDING', (1, 1), (-1, -1), 2),
        ]
        
        table.setStyle(TableStyle(style))
        content.append(table)
        
        return content


def load_json(filepath: str) -> dict:
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def create_sample_data() -> dict:
    """サンプルデータ"""
    return {
        'date': '2025年3月31日（月）最終日',
        'reportConfig': {
            'sender': '県立浦和高校　森川大地',
        },
        'ranking': [
            {'rank': 1, 'team': '浦和レッズユース'},
            {'rank': 2, 'team': '富士市立'},
            {'rank': 3, 'team': '市立浦和'},
            {'rank': 4, 'team': '佐野日大'},
        ],
        'tournament': [
            {'type': '準決勝1', 'home': '市立浦和', 'away': '佐野日大', 'score': '0-0 (PK 4-5)'},
            {'type': '準決勝2', 'home': '浦和レッズユース', 'away': '富士市立', 'score': '1-1 (PK 4-3)'},
            {'type': '3位決定戦', 'home': '市立浦和', 'away': '富士市立', 'score': '2-0'},
            {'type': '決勝', 'home': '浦和レッズユース', 'away': '佐野日大', 'score': '3-1'},
        ],
        'players': [
            {'type': '最優秀選手', 'name': '中村 虎太郎', 'team': '浦和レッズユース'},
            {'type': '優秀選手', 'name': '安藤 純和', 'team': '浦和レッズユース'},
            {'type': '優秀選手', 'name': 'マルコム アレックス恵太', 'team': '浦和レッズユース'},
            {'type': '優秀選手', 'name': '蔦澤 洋紀', 'team': '浦和レッズユース'},
            {'type': '優秀選手', 'name': '和田 武士', 'team': '浦和レッズユース'},
            {'type': '優秀選手', 'name': '青木 利仁', 'team': '富士市立'},
            {'type': '優秀選手', 'name': '小畑 龍武', 'team': '富士市立'},
            {'type': '優秀選手', 'name': '竹内 悠仁', 'team': '富士市立'},
            {'type': '優秀選手', 'name': '小山 拓', 'team': '市立浦和'},
            {'type': '優秀選手', 'name': '山崎 倖汰', 'team': '市立浦和'},
            {'type': '優秀選手', 'name': '青山 遥成', 'team': '佐野日大'},
            {'type': '優秀選手', 'name': '柿沼 楓音', 'team': '佐野日大'},
        ],
        'training': [
            {'venue': '浦和南高G', 'kickoff': '9:30', 'home': '浦和南', 'away': '聖和学園', 'score': '0-2'},
            {'venue': '浦和南高G', 'kickoff': '10:35', 'home': '日大明誠', 'away': '聖和学園', 'score': '1-0'},
            {'venue': '浦和南高G', 'kickoff': '11:40', 'home': '浦和南', 'away': '日大明誠', 'score': '2-1'},
            {'venue': '浦和南高G', 'kickoff': '12:45', 'home': '東海大相模', 'away': '浦和レッズ', 'score': '1-2'},
            {'venue': '浦和南高G', 'kickoff': '13:50', 'home': '健大高崎', 'away': '野辺地西', 'score': '3-0'},
            {'venue': '市立浦和高G', 'kickoff': '9:30', 'home': '市立浦和', 'away': '富士市立', 'score': '3-3'},
            {'venue': '市立浦和高G', 'kickoff': '10:35', 'home': '日本文理', 'away': '旭川実業', 'score': '0-0'},
            {'venue': '市立浦和高G', 'kickoff': '11:40', 'home': '専大北上', 'away': '磐田東', 'score': '2-1'},
            {'venue': '市立浦和高G', 'kickoff': '12:45', 'home': '新潟西', 'away': '浦和', 'score': '1-1'},
            {'venue': '市立浦和高G', 'kickoff': '13:50', 'home': '浦和東', 'away': 'RB大宮', 'score': '0-2'},
            {'venue': '浦和学院高G', 'kickoff': '9:30', 'home': '浦和学院', 'away': '専大北上', 'score': '3-1'},
            {'venue': '浦和学院高G', 'kickoff': '10:35', 'home': '浦和東', 'away': '野辺地西', 'score': '0-3'},
            {'venue': '浦和学院高G', 'kickoff': '11:40', 'home': '磐田東', 'away': '新潟西', 'score': '2-0'},
            {'venue': '浦和学院高G', 'kickoff': '12:45', 'home': '浦和', 'away': 'RB大宮', 'score': '1-3'},
            {'venue': '浦和学院高G', 'kickoff': '13:50', 'home': '浦和レッズ', 'away': '佐野日大', 'score': '2-2'},
            {'venue': '武南高G', 'kickoff': '9:30', 'home': '武南', 'away': '帝京大可児', 'score': '4-3'},
            {'venue': '武南高G', 'kickoff': '10:35', 'home': '韮崎', 'away': '健大高崎', 'score': '1-4'},
            {'venue': '武南高G', 'kickoff': '11:40', 'home': '國學院久我山', 'away': '東海大相模', 'score': '0-1'},
            {'venue': '武南高G', 'kickoff': '12:45', 'home': '日大明誠', 'away': '旭川実業', 'score': '2-2'},
            {'venue': '武南高G', 'kickoff': '13:50', 'home': '浦和西', 'away': '帝京大可児', 'score': '0-1'},
        ],
    }


def main():
    if len(sys.argv) > 1:
        json_path = sys.argv[1]
        data = load_json(json_path)
        output_path = json_path.replace('.json', '.pdf')
    else:
        data = create_sample_data()
        output_path = 'sample_final_result.pdf'
    
    generator = FinalResultPDFGenerator()
    generator.generate(data, output_path)


if __name__ == "__main__":
    main()
