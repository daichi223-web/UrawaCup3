"""
日次報告書PDF生成

Platypus (SimpleDocTemplate, Table等) を使用した日次試合報告書PDF生成クラス
"""

import io
import os
from datetime import date
from typing import Optional, List, Dict, Any

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
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

from sqlalchemy.orm import Session, joinedload

from ..models.tournament import Tournament
from ..models.match import Match, MatchStage, MatchStatus
from ..models.venue import Venue
from ..models.goal import Goal


def _register_font() -> str:
    """
    日本語フォントを登録して使用可能なフォント名を返す

    環境変数FONT_PATHで指定されたパス、またはシステムフォントを検索
    """
    font_paths = [
        os.getenv('FONT_PATH'),  # 環境変数で指定されたパス
        'C:/Windows/Fonts/msgothic.ttc',  # Windows
        'C:/Windows/Fonts/meiryo.ttc',  # Windows Meiryo
        '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',  # macOS
        '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',  # Linux (Debian/Ubuntu)
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',  # Linux (Noto)
    ]

    for font_path in font_paths:
        if font_path and os.path.exists(font_path):
            try:
                pdfmetrics.registerFont(TTFont('JapaneseGothic', font_path))
                return 'JapaneseGothic'
            except Exception:
                continue

    # TTFが見つからない場合はCIDフォントを試す
    try:
        pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
        return 'HeiseiKakuGo-W5'
    except Exception:
        pass

    # フォールバック
    return 'Helvetica'


# フォント登録（モジュールロード時に一度だけ実行）
FONT = _register_font()


class DailyReportGenerator:
    """日次報告書PDF生成クラス"""

    def __init__(self, db: Session, config: Optional[Dict[str, Any]] = None):
        """
        初期化

        Args:
            db: SQLAlchemyセッション
            config: 追加設定（オプション）
        """
        self.db = db
        self.config = config or {}
        self.styles = self._create_styles()

    def _create_styles(self) -> Dict[str, ParagraphStyle]:
        """スタイル定義を作成"""
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

    def _get_tournament(self, tournament_id: int) -> Tournament:
        """大会情報を取得"""
        tournament = self.db.query(Tournament).filter(Tournament.id == tournament_id).first()
        if not tournament:
            raise ValueError(f"Tournament not found (ID: {tournament_id})")
        return tournament

    def _get_matches_by_venue(
        self,
        tournament_id: int,
        target_date: date
    ) -> Dict[str, List[Match]]:
        """
        会場ごとにグループ化された試合データを取得

        Args:
            tournament_id: 大会ID
            target_date: 対象日付

        Returns:
            会場名をキー、試合リストを値とする辞書
        """
        matches = (
            self.db.query(Match)
            .options(
                joinedload(Match.home_team),
                joinedload(Match.away_team),
                joinedload(Match.venue),
                joinedload(Match.goals).joinedload(Goal.team),
                joinedload(Match.goals).joinedload(Goal.player),
            )
            .filter(
                Match.tournament_id == tournament_id,
                Match.match_date == target_date,
                Match.status == MatchStatus.completed,
                Match.stage != MatchStage.training,
            )
            .order_by(Match.venue_id, Match.match_time)
            .all()
        )

        # 会場ごとにグループ化
        by_venue: Dict[str, List[Match]] = {}
        for match in matches:
            venue_name = match.venue.name if match.venue else "Unknown Venue"
            if venue_name not in by_venue:
                by_venue[venue_name] = []
            by_venue[venue_name].append(match)

        return by_venue

    def generate(
        self,
        tournament_id: int,
        target_date: date,
        day_number: int = 1,
        recipient: Optional[str] = None
    ) -> io.BytesIO:
        """
        PDF生成

        Args:
            tournament_id: 大会ID
            target_date: 対象日付
            day_number: 大会第何日目か
            recipient: 送信先（省略時は大会設定から取得）

        Returns:
            PDF内容を含むBytesIO
        """
        tournament = self._get_tournament(tournament_id)
        match_data = self._get_matches_by_venue(tournament_id, target_date)

        # 送信元情報
        sender = f"{tournament.sender_organization or ''} {tournament.sender_name or ''}".strip()
        contact = tournament.sender_contact or ''

        # 受信者（引数優先、なければデフォルト）
        if not recipient:
            recipients = tournament.report_recipients
            if recipients:
                recipient = f"{recipients[0].organization} 御中"
            else:
                recipient = "御中"

        # 日付文字列の作成
        weekday_jp = ['月', '火', '水', '木', '金', '土', '日']
        date_str = f"{target_date.year}年{target_date.month}月{target_date.day}日（{weekday_jp[target_date.weekday()]}）"

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
            leftMargin=15 * mm,
            rightMargin=15 * mm
        )

        story = []

        # 会場ごとにページ生成
        venues = [v for v in match_data.keys() if len(match_data[v]) > 0]

        for i, venue in enumerate(venues):
            matches = match_data[venue]
            if not matches:
                continue

            # ページ内容
            page_content = self._create_venue_page(
                tournament=tournament,
                venue=venue,
                matches=matches,
                recipient=recipient,
                sender=sender,
                contact=contact,
                day=day_number,
                date_str=date_str
            )
            story.extend(page_content)

            # ページ区切り（最後以外）
            if i < len(venues) - 1:
                story.append(PageBreak())

        doc.build(story)
        buffer.seek(0)

        return buffer

    def _create_venue_page(
        self,
        tournament: Tournament,
        venue: str,
        matches: List[Match],
        recipient: str,
        sender: str,
        contact: str,
        day: int,
        date_str: str
    ) -> list:
        """会場ごとのページ内容を生成"""
        content = []

        # ヘッダー
        title_text = f"第{tournament.edition or ''}回 {tournament.name}"
        content.append(Paragraph(title_text, self.styles['title']))
        content.append(Paragraph("試合結果報告書", self.styles['subtitle']))
        content.append(Spacer(1, 2 * mm))

        # 発信情報
        header_data = [
            ['送信先：', recipient, '', '発信元：', sender],
            ['', '', '', '連絡先：', contact],
            ['', '', '', '', f'{date_str}  第{day}日'],
        ]
        header_table = Table(header_data, colWidths=[18 * mm, 45 * mm, 10 * mm, 18 * mm, 60 * mm])
        header_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), FONT, 9),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        content.append(header_table)
        content.append(Spacer(1, 3 * mm))

        # 会場名 + 区切り線
        content.append(Paragraph(f"大会会場：  {venue}", self.styles['venue']))
        line = Table([['']], colWidths=[175 * mm])
        line.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, -1), 1, colors.black)
        ]))
        content.append(line)
        content.append(Spacer(1, 5 * mm))

        # 各試合
        for idx, match in enumerate(matches):
            match_content = self._create_match_row(match, idx + 1)
            content.append(KeepTogether(match_content))
            content.append(Spacer(1, 3 * mm))

            # 試合間の仕切り線
            if idx < len(matches) - 1:
                divider = Table([['']], colWidths=[175 * mm])
                divider.setStyle(TableStyle([
                    ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.Color(0.7, 0.7, 0.7))
                ]))
                content.append(divider)
                content.append(Spacer(1, 3 * mm))

        return content

    def _create_match_row(self, match: Match, match_num: int) -> Table:
        """試合結果 + 得点経過を横並びで生成"""

        # データ取得
        home_team = match.home_team.name if match.home_team else '---'
        away_team = match.away_team.name if match.away_team else '---'
        kickoff = match.match_time.strftime('%H:%M') if match.match_time else '--:--'

        h1 = match.home_score_half1 or 0
        h2 = match.home_score_half2 or 0
        a1 = match.away_score_half1 or 0
        a2 = match.away_score_half2 or 0

        home_total = h1 + h2
        away_total = a1 + a2

        h1_str = str(h1) if h1 is not None else '-'
        h2_str = str(h2) if h2 is not None else '-'
        a1_str = str(a1) if a1 is not None else '-'
        a2_str = str(a2) if a2 is not None else '-'

        # 得点者リスト（Goalモデルから取得）
        scorers = []
        for goal in sorted(match.goals, key=lambda g: (g.half, g.minute)):
            scorer_name = goal.scorer_name
            if not scorer_name and goal.player:
                scorer_name = goal.player.name
            scorers.append({
                'time': goal.minute,
                'team': goal.team.name if goal.team else '',
                'name': scorer_name or ''
            })

        # 左側：試合結果
        result_data = [
            [f'第{match_num}試合', '', f'KO {kickoff}', '', ''],
            [home_team, '', 'VS', '', away_team],
            ['', '', '', '', ''],
            [str(home_total), f'{h1_str}  前半  {a1_str}', '', '', str(away_total)],
            ['', f'{h2_str}  後半  {a2_str}', '', '', ''],
        ]

        result_table = Table(result_data, colWidths=[22 * mm, 30 * mm, 12 * mm, 5 * mm, 22 * mm])
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
                goal_data.append(['', f'他{len(scorers) - 8}名', ''])

            goal_table = Table(goal_data, colWidths=[12 * mm, 28 * mm, 38 * mm])
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
            goal_table = Table(goal_data, colWidths=[78 * mm])
            goal_table.setStyle(TableStyle([
                ('FONT', (0, 0), (-1, -1), FONT, 9),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.Color(0.5, 0.5, 0.5)),
            ]))

        # 左右を結合
        combined = Table(
            [[result_table, goal_table]],
            colWidths=[95 * mm, 80 * mm]
        )
        combined.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (1, 0), (1, 0), 8),
        ]))

        return combined

    def generate_from_dict(self, data: dict, output_path: str) -> None:
        """
        辞書データからPDFを生成（coreスクリプトとの互換性用）

        Args:
            data: coreスクリプト形式のデータ辞書
            output_path: 出力ファイルパス
        """
        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
            leftMargin=15 * mm,
            rightMargin=15 * mm
        )

        story = []

        # 設定取得
        report_config = data.get('reportConfig', {})
        recipient = report_config.get('recipient', '御中')
        sender = report_config.get('sender', '')
        contact = report_config.get('contact', '')
        day = data.get('day', 1)
        date_str = data.get('dateStr', '')

        # 会場ごとにページ生成
        match_data = data.get('matchData', {})
        venues = [v for v in match_data.keys() if len(match_data[v]) > 0]

        for i, venue in enumerate(venues):
            matches = match_data[venue]
            if not matches:
                continue

            # ページ内容
            page_content = self._create_venue_page_from_dict(
                venue, matches,
                recipient, sender, contact,
                day, date_str
            )
            story.extend(page_content)

            # ページ区切り（最後以外）
            if i < len(venues) - 1:
                story.append(PageBreak())

        doc.build(story)

    def _create_venue_page_from_dict(
        self,
        venue: str,
        matches: list,
        recipient: str,
        sender: str,
        contact: str,
        day: int,
        date_str: str
    ) -> list:
        """会場ごとのページ内容を生成（辞書データ版）"""
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
        content.append(Spacer(1, 2 * mm))

        # 発信情報
        header_data = [
            ['送信先：', recipient, '', '発信元：', sender],
            ['', '', '', '連絡先：', contact],
            ['', '', '', '', f'{date_str}  第{day}日'],
        ]
        header_table = Table(header_data, colWidths=[18 * mm, 45 * mm, 10 * mm, 18 * mm, 60 * mm])
        header_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), FONT, 9),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        content.append(header_table)
        content.append(Spacer(1, 3 * mm))

        # 会場名 + 区切り線
        content.append(Paragraph(f"大会会場：  {venue}", self.styles['venue']))
        line = Table([['']], colWidths=[175 * mm])
        line.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, -1), 1, colors.black)
        ]))
        content.append(line)
        content.append(Spacer(1, 5 * mm))

        # 各試合
        for idx, match in enumerate(matches):
            match_content = self._create_match_row_from_dict(match, idx + 1)
            content.append(KeepTogether(match_content))
            content.append(Spacer(1, 3 * mm))

            # 試合間の仕切り線
            if idx < len(matches) - 1:
                divider = Table([['']], colWidths=[175 * mm])
                divider.setStyle(TableStyle([
                    ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.Color(0.7, 0.7, 0.7))
                ]))
                content.append(divider)
                content.append(Spacer(1, 3 * mm))

        return content

    def _create_match_row_from_dict(self, match: dict, match_num: int) -> Table:
        """試合結果 + 得点経過を横並びで生成（辞書データ版）"""

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
            [home_team, '', 'VS', '', away_team],
            ['', '', '', '', ''],
            [str(home_total), f'{h1_str}  前半  {a1_str}', '', '', str(away_total)],
            ['', f'{h2_str}  後半  {a2_str}', '', '', ''],
        ]

        result_table = Table(result_data, colWidths=[22 * mm, 30 * mm, 12 * mm, 5 * mm, 22 * mm])
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
                goal_data.append(['', f'他{len(scorers) - 8}名', ''])

            goal_table = Table(goal_data, colWidths=[12 * mm, 28 * mm, 38 * mm])
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
            goal_table = Table(goal_data, colWidths=[78 * mm])
            goal_table.setStyle(TableStyle([
                ('FONT', (0, 0), (-1, -1), FONT, 9),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.Color(0.5, 0.5, 0.5)),
            ]))

        # 左右を結合
        combined = Table(
            [[result_table, goal_table]],
            colWidths=[95 * mm, 80 * mm]
        )
        combined.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (1, 0), (1, 0), 8),
        ]))

        return combined
