"""
最終結果報告書PDF生成

Platypus (SimpleDocTemplate, Table等) を使用した最終結果報告書PDF生成クラス
"""

import io
import os
from datetime import date, timedelta
from typing import Optional, List, Dict, Any

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
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

from sqlalchemy.orm import Session, joinedload

from ..models.tournament import Tournament
from ..models.match import Match, MatchStage, MatchStatus
from ..models.venue import Venue
from ..models.standing import Standing
from ..models.tournament_award import TournamentAward, AwardType


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
                pdfmetrics.registerFont(TTFont('JapaneseGothicFinal', font_path))
                return 'JapaneseGothicFinal'
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


class FinalResultPDFGenerator:
    """最終結果報告書PDF生成クラス"""

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

    def _get_tournament(self, tournament_id: int) -> Tournament:
        """大会情報を取得"""
        tournament = self.db.query(Tournament).filter(Tournament.id == tournament_id).first()
        if not tournament:
            raise ValueError(f"Tournament not found (ID: {tournament_id})")
        return tournament

    def _get_final_matches(self, tournament_id: int) -> List[Match]:
        """決勝トーナメント試合を取得"""
        return (
            self.db.query(Match)
            .options(
                joinedload(Match.home_team),
                joinedload(Match.away_team),
            )
            .filter(
                Match.tournament_id == tournament_id,
                Match.stage.in_([
                    MatchStage.semifinal,
                    MatchStage.third_place,
                    MatchStage.final
                ]),
                Match.status == MatchStatus.completed,
            )
            .order_by(Match.stage, Match.match_date, Match.match_time)
            .all()
        )

    def _get_training_matches(self, tournament_id: int, target_date: date) -> List[Match]:
        """研修試合を取得"""
        return (
            self.db.query(Match)
            .options(
                joinedload(Match.home_team),
                joinedload(Match.away_team),
                joinedload(Match.venue),
            )
            .filter(
                Match.tournament_id == tournament_id,
                Match.match_date == target_date,
                Match.stage == MatchStage.training,
                Match.status == MatchStatus.completed,
            )
            .order_by(Match.venue_id, Match.match_time)
            .all()
        )

    def _get_awards(self, tournament_id: int) -> List[TournamentAward]:
        """表彰情報を取得"""
        return (
            self.db.query(TournamentAward)
            .options(
                joinedload(TournamentAward.player),
                joinedload(TournamentAward.team),
            )
            .filter(TournamentAward.tournament_id == tournament_id)
            .all()
        )

    def _get_final_ranking(self, tournament_id: int) -> List[Dict[str, Any]]:
        """
        最終順位を取得（決勝トーナメント結果から計算）

        Returns:
            [{'rank': 1, 'team': 'チーム名'}, ...]
        """
        final_matches = self._get_final_matches(tournament_id)
        ranking = []

        # 決勝戦から優勝・準優勝を判定
        final_match = next((m for m in final_matches if m.stage == MatchStage.final), None)
        if final_match:
            winner, loser = self._get_match_winner_loser(final_match)
            if winner:
                ranking.append({'rank': 1, 'team': winner})
            if loser:
                ranking.append({'rank': 2, 'team': loser})

        # 3位決定戦から3位・4位を判定
        third_place_match = next((m for m in final_matches if m.stage == MatchStage.third_place), None)
        if third_place_match:
            winner, loser = self._get_match_winner_loser(third_place_match)
            if winner:
                ranking.append({'rank': 3, 'team': winner})
            if loser:
                ranking.append({'rank': 4, 'team': loser})

        return ranking

    def _get_match_winner_loser(self, match: Match) -> tuple:
        """試合の勝者と敗者を取得"""
        home_total = (match.home_score_total or 0)
        away_total = (match.away_score_total or 0)

        home_name = match.home_team.name if match.home_team else None
        away_name = match.away_team.name if match.away_team else None

        if home_total > away_total:
            return home_name, away_name
        elif away_total > home_total:
            return away_name, home_name
        else:
            # 同点の場合はPK戦で判定
            if match.has_penalty_shootout:
                home_pk = match.home_pk or 0
                away_pk = match.away_pk or 0
                if home_pk > away_pk:
                    return home_name, away_name
                else:
                    return away_name, home_name
        return None, None

    def generate(
        self,
        tournament_id: int,
        target_date: Optional[date] = None
    ) -> io.BytesIO:
        """
        PDF生成

        Args:
            tournament_id: 大会ID
            target_date: 最終日の日付（研修試合取得用、省略時は大会終了日）

        Returns:
            PDF内容を含むBytesIO
        """
        tournament = self._get_tournament(tournament_id)

        if not target_date:
            final_date = tournament.end_date or (tournament.start_date + timedelta(days=2))
            target_date = final_date

        # 日付文字列の作成
        weekday_jp = ['月', '火', '水', '木', '金', '土', '日']
        date_str = f"{target_date.year}年{target_date.month}月{target_date.day}日（{weekday_jp[target_date.weekday()]}）最終日"

        sender = f"{tournament.sender_organization or ''} {tournament.sender_name or ''}".strip()

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
            leftMargin=15 * mm,
            rightMargin=15 * mm
        )

        story = []

        # タイトル
        title_text = f"第{tournament.edition or ''}回 {tournament.name}"
        story.append(Paragraph(title_text, self.styles['title']))
        story.append(Paragraph("最終結果報告書", self.styles['subtitle']))
        story.append(Spacer(1, 3 * mm))

        # 発信情報
        header_data = [
            ['日付', date_str],
            ['発信元', sender],
        ]
        header_table = Table(header_data, colWidths=[25 * mm, 80 * mm])
        header_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), FONT, 9),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 8 * mm))

        # 最終順位
        ranking = self._get_final_ranking(tournament_id)
        story.append(Paragraph("■ 最終順位", self.styles['section']))
        story.extend(self._create_ranking_table(ranking))
        story.append(Spacer(1, 8 * mm))

        # 決勝トーナメント結果
        final_matches = self._get_final_matches(tournament_id)
        tournament_data = self._convert_matches_to_tournament_data(final_matches)
        story.append(Paragraph("■ 決勝トーナメント結果", self.styles['section']))
        story.extend(self._create_tournament_table(tournament_data))
        story.append(Spacer(1, 8 * mm))

        # 優秀選手
        awards = self._get_awards(tournament_id)
        players_data = self._convert_awards_to_players_data(awards)
        story.append(Paragraph("■ 優秀選手", self.styles['section']))
        story.extend(self._create_players_table(players_data))
        story.append(Spacer(1, 8 * mm))

        # 研修試合結果
        if target_date:
            training_matches = self._get_training_matches(tournament_id, target_date)
            training_data = self._convert_training_matches(training_matches)
            story.append(Paragraph("■ 研修試合結果", self.styles['section']))
            story.extend(self._create_training_summary(training_data))

        doc.build(story)
        buffer.seek(0)

        return buffer

    def _convert_matches_to_tournament_data(self, matches: List[Match]) -> List[Dict[str, Any]]:
        """試合データを決勝トーナメント表示用に変換"""
        stage_labels = {
            MatchStage.semifinal: '準決勝',
            MatchStage.third_place: '3位決定戦',
            MatchStage.final: '決勝',
        }

        result = []
        semifinal_count = 0

        for match in matches:
            stage_label = stage_labels.get(match.stage, str(match.stage))
            if match.stage == MatchStage.semifinal:
                semifinal_count += 1
                stage_label = f'準決勝{semifinal_count}'

            home = match.home_team.name if match.home_team else ''
            away = match.away_team.name if match.away_team else ''

            home_total = match.home_score_total or 0
            away_total = match.away_score_total or 0
            score = f'{home_total}-{away_total}'

            if match.has_penalty_shootout:
                score += f' (PK {match.home_pk}-{match.away_pk})'

            result.append({
                'type': stage_label,
                'home': home,
                'away': away,
                'score': score,
            })

        return result

    def _convert_awards_to_players_data(self, awards: List[TournamentAward]) -> List[Dict[str, Any]]:
        """表彰データを表示用に変換"""
        award_labels = {
            AwardType.mvp: '最優秀選手',
            AwardType.best_gk: '優秀GK',
            AwardType.top_scorer: '得点王',
            AwardType.fair_play: 'フェアプレー賞',
        }

        result = []
        for award in awards:
            player_name = ''
            team_name = ''

            if award.player:
                player_name = award.player.name
                if award.player.team:
                    team_name = award.player.team.name
            if award.team and not team_name:
                team_name = award.team.name

            result.append({
                'type': award_labels.get(award.award_type, '優秀選手'),
                'name': player_name,
                'team': team_name,
            })

        # MVPを先頭に
        result.sort(key=lambda x: 0 if x['type'] == '最優秀選手' else 1)

        return result

    def _convert_training_matches(self, matches: List[Match]) -> List[Dict[str, Any]]:
        """研修試合データを表示用に変換"""
        result = []
        for match in matches:
            venue_name = match.venue.name if match.venue else ''
            kickoff = match.match_time.strftime('%H:%M') if match.match_time else ''
            home = match.home_team.name if match.home_team else ''
            away = match.away_team.name if match.away_team else ''
            home_total = match.home_score_total or 0
            away_total = match.away_score_total or 0

            result.append({
                'venue': venue_name,
                'kickoff': kickoff,
                'home': home,
                'away': away,
                'score': f'{home_total}-{away_total}',
            })

        return result

    def _create_ranking_table(self, ranking: list) -> list:
        """最終順位表"""
        labels = ['優勝', '準優勝', '第3位', '第4位']

        data = [['順位', 'チーム名']]
        for r in ranking[:4]:
            rank = r.get('rank', 0)
            team = r.get('team', '---')
            label = labels[rank - 1] if 0 < rank <= 4 else f'{rank}位'
            data.append([label, team or '---'])

        table = Table(data, colWidths=[30 * mm, 70 * mm])

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

        table = Table(data, colWidths=[30 * mm, 45 * mm, 35 * mm, 45 * mm])

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

        table = Table(data, colWidths=[30 * mm, 50 * mm, 50 * mm])

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

        col_width = 42 * mm
        table = Table(data, colWidths=[12 * mm, col_width, col_width, col_width, col_width])

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
            topMargin=15 * mm,
            bottomMargin=15 * mm,
            leftMargin=15 * mm,
            rightMargin=15 * mm
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
        story.append(Spacer(1, 3 * mm))

        # 発信情報
        config = data.get('reportConfig', {})
        header_data = [
            ['日付', data.get('date', '')],
            ['発信元', config.get('sender', '')],
        ]
        header_table = Table(header_data, colWidths=[25 * mm, 80 * mm])
        header_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), FONT, 9),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 8 * mm))

        # 最終順位
        story.append(Paragraph("■ 最終順位", self.styles['section']))
        story.extend(self._create_ranking_table(data.get('ranking', [])))
        story.append(Spacer(1, 8 * mm))

        # 決勝トーナメント結果
        story.append(Paragraph("■ 決勝トーナメント結果", self.styles['section']))
        story.extend(self._create_tournament_table(data.get('tournament', [])))
        story.append(Spacer(1, 8 * mm))

        # 優秀選手
        story.append(Paragraph("■ 優秀選手", self.styles['section']))
        story.extend(self._create_players_table(data.get('players', [])))
        story.append(Spacer(1, 8 * mm))

        # 研修試合結果（全件）
        story.append(Paragraph("■ 研修試合結果", self.styles['section']))
        story.extend(self._create_training_summary(data.get('training', [])))

        doc.build(story)
