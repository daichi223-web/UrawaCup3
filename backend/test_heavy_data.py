#!/usr/bin/env python3
"""6試合・7試合・大量得点テスト"""

import sys
sys.path.insert(0, '.')
from generate_daily_report_pdf import DailyReportGenerator

# 6試合会場と7試合会場、大量得点のテストデータ
test_data = {
    'day': 1,
    'dateStr': '2025年3月29日（土）',
    'reportConfig': {
        'recipient': '埼玉県サッカー協会 御中',
        'sender': '県立浦和高校　森川大地',
        'contact': '090-8519-7032',
    },
    'matchData': {
        '浦和南高G（6試合）': [
            {
                'homeTeam': {'name': '浦和南'},
                'awayTeam': {'name': '専大北上'},
                'kickoff': '9:00',
                'homeScore1H': 4, 'homeScore2H': 3,
                'awayScore1H': 3, 'awayScore2H': 5,
                'scorers': [
                    {'time': '3', 'team': '浦和南', 'name': '山田 太郎'},
                    {'time': '8', 'team': '専大北上', 'name': '佐藤 次郎'},
                    {'time': '12', 'team': '浦和南', 'name': '鈴木 三郎'},
                    {'time': '18', 'team': '専大北上', 'name': '田中 四郎'},
                    {'time': '25', 'team': '浦和南', 'name': '高橋 五郎'},
                    {'time': '30', 'team': '専大北上', 'name': '伊藤 六郎'},
                    {'time': '35', 'team': '浦和南', 'name': '渡辺 七郎'},
                    {'time': '42', 'team': '専大北上', 'name': '山本 八郎'},
                    {'time': '48', 'team': '専大北上', 'name': '中村 九郎'},
                    {'time': '52', 'team': '専大北上', 'name': '小林 十郎'},
                    {'time': '55', 'team': '専大北上', 'name': '加藤 十一郎'},
                    {'time': '58', 'team': '専大北上', 'name': '吉田 十二郎'},
                    {'time': '60', 'team': '浦和南', 'name': '山田 十三郎'},
                    {'time': '62', 'team': '浦和南', 'name': '佐藤 十四郎'},
                    {'time': '65', 'team': '浦和南', 'name': '鈴木 十五郎'},
                ]
            },
            {
                'homeTeam': {'name': '東海大相模'},
                'awayTeam': {'name': '健大高崎'},
                'kickoff': '10:05',
                'homeScore1H': 2, 'homeScore2H': 1,
                'awayScore1H': 1, 'awayScore2H': 2,
                'scorers': [
                    {'time': '5', 'team': '東海大相模', 'name': '戸川 昌也'},
                    {'time': '15', 'team': '健大高崎', 'name': '野口 健'},
                    {'time': '28', 'team': '東海大相模', 'name': '川島 誠'},
                    {'time': '38', 'team': '健大高崎', 'name': '森田 勇'},
                    {'time': '50', 'team': '東海大相模', 'name': '岡田 翔'},
                    {'time': '55', 'team': '健大高崎', 'name': '松本 大'},
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
            {
                'homeTeam': {'name': '浦和南'},
                'awayTeam': {'name': '健大高崎'},
                'kickoff': '13:20',
                'homeScore1H': 2, 'homeScore2H': 2,
                'awayScore1H': 1, 'awayScore2H': 1,
                'scorers': [
                    {'time': '10', 'team': '浦和南', 'name': '山田 太郎'},
                    {'time': '20', 'team': '健大高崎', 'name': '野口 健'},
                    {'time': '35', 'team': '浦和南', 'name': '鈴木 三郎'},
                    {'time': '45', 'team': '健大高崎', 'name': '松本 大'},
                    {'time': '55', 'team': '浦和南', 'name': '高橋 五郎'},
                    {'time': '60', 'team': '浦和南', 'name': '渡辺 七郎'},
                ]
            },
            {
                'homeTeam': {'name': '専大北上'},
                'awayTeam': {'name': '東海大相模'},
                'kickoff': '14:25',
                'homeScore1H': 3, 'homeScore2H': 2,
                'awayScore1H': 2, 'awayScore2H': 3,
                'scorers': [
                    {'time': '5', 'team': '専大北上', 'name': '佐藤 次郎'},
                    {'time': '12', 'team': '東海大相模', 'name': '戸川 昌也'},
                    {'time': '22', 'team': '専大北上', 'name': '田中 四郎'},
                    {'time': '30', 'team': '東海大相模', 'name': '川島 誠'},
                    {'time': '40', 'team': '専大北上', 'name': '伊藤 六郎'},
                    {'time': '48', 'team': '東海大相模', 'name': '岡田 翔'},
                    {'time': '52', 'team': '専大北上', 'name': '山本 八郎'},
                    {'time': '58', 'team': '東海大相模', 'name': '森田 勇'},
                    {'time': '62', 'team': '専大北上', 'name': '中村 九郎'},
                    {'time': '65', 'team': '東海大相模', 'name': '松本 大'},
                ]
            },
        ],
        '市立浦和高G（7試合）': [
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
            {
                'homeTeam': {'name': '市立浦和'},
                'awayTeam': {'name': '富士市立'},
                'kickoff': '13:20',
                'homeScore1H': 1, 'homeScore2H': 1,
                'awayScore1H': 1, 'awayScore2H': 0,
                'scorers': [
                    {'time': '15', 'team': '市立浦和', 'name': '嶋田 秀太朗'},
                    {'time': '25', 'team': '富士市立', 'name': '遠藤 壮大'},
                    {'time': '55', 'team': '市立浦和', 'name': '川津 創史'},
                ]
            },
            {
                'homeTeam': {'name': '新潟西'},
                'awayTeam': {'name': '旭川実業'},
                'kickoff': '14:25',
                'homeScore1H': 2, 'homeScore2H': 1,
                'awayScore1H': 0, 'awayScore2H': 1,
                'scorers': [
                    {'time': '8', 'team': '新潟西', 'name': '木村 健太'},
                    {'time': '22', 'team': '新潟西', 'name': '林 大輔'},
                    {'time': '48', 'team': '旭川実業', 'name': '森 悠斗'},
                    {'time': '58', 'team': '新潟西', 'name': '木村 健太'},
                ]
            },
            {
                'homeTeam': {'name': '富士市立'},
                'awayTeam': {'name': '新潟西'},
                'kickoff': '15:30',
                'homeScore1H': 3, 'homeScore2H': 4,
                'awayScore1H': 4, 'awayScore2H': 4,
                'scorers': [
                    {'time': '2', 'team': '富士市立', 'name': '遠藤 壮大'},
                    {'time': '5', 'team': '新潟西', 'name': '木村 健太'},
                    {'time': '10', 'team': '富士市立', 'name': '小山 慶'},
                    {'time': '15', 'team': '新潟西', 'name': '林 大輔'},
                    {'time': '20', 'team': '新潟西', 'name': '斎藤 拓'},
                    {'time': '25', 'team': '富士市立', 'name': '青木 翔'},
                    {'time': '30', 'team': '新潟西', 'name': '木村 健太'},
                    {'time': '35', 'team': '富士市立', 'name': '遠藤 壮大'},
                    {'time': '40', 'team': '新潟西', 'name': '林 大輔'},
                    {'time': '45', 'team': '富士市立', 'name': '小山 慶'},
                    {'time': '50', 'team': '新潟西', 'name': '斎藤 拓'},
                    {'time': '55', 'team': '富士市立', 'name': '青木 翔'},
                    {'time': '58', 'team': '新潟西', 'name': '木村 健太'},
                    {'time': '60', 'team': '富士市立', 'name': '遠藤 壮大'},
                    {'time': '62', 'team': '新潟西', 'name': '林 大輔'},
                ]
            },
        ],
    }
}

if __name__ == '__main__':
    generator = DailyReportGenerator()
    generator.generate(test_data, 'D:/report/test_6and7_matches.pdf')
    print('Done!')
