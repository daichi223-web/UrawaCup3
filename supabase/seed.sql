-- =====================================================
-- 浦和カップ サンプルデータ
-- 既存テーブルに対応（カラムがない場合はスキップ）
-- =====================================================

-- 既存のデータを削除
DELETE FROM goals;
DELETE FROM standings;
DELETE FROM matches;
DELETE FROM teams;
DELETE FROM venues;
DELETE FROM groups;
DELETE FROM tournaments;

-- サンプル大会データ（基本カラムのみ）
INSERT INTO tournaments (id, name, year, start_date, end_date)
VALUES (1, '浦和カップ高校サッカーフェスティバル 2026', 2026, '2026-03-20', '2026-03-22');

-- グループデータ
INSERT INTO groups (tournament_id, id, name) VALUES
(1, 'A', 'Aグループ'),
(1, 'B', 'Bグループ'),
(1, 'C', 'Cグループ'),
(1, 'D', 'Dグループ');

-- 会場データ（基本カラムのみ）
INSERT INTO venues (id, tournament_id, name) VALUES
(1, 1, '浦和南高校グラウンド'),
(2, 1, '市立浦和高校グラウンド'),
(3, 1, '浦和学院グラウンド'),
(4, 1, '武南高校グラウンド');

-- チームデータ
INSERT INTO teams (id, tournament_id, name, short_name, group_id, group_order) VALUES
-- Aグループ
(1, 1, '浦和南高校', '浦和南', 'A', 1),
(2, 1, '青森山田高校', '青森山田', 'A', 2),
(3, 1, '前橋育英高校', '前橋育', 'A', 3),
(4, 1, '國學院久我山高校', '久我山', 'A', 4),
(5, 1, '鹿島学園高校', '鹿島学園', 'A', 5),
(6, 1, '昌平高校', '昌平', 'A', 6),
-- Bグループ
(7, 1, '市立浦和高校', '市浦和', 'B', 1),
(8, 1, '流通経済大柏高校', '流経柏', 'B', 2),
(9, 1, '静岡学園高校', '静岡学園', 'B', 3),
(10, 1, '帝京高校', '帝京', 'B', 4),
(11, 1, '桐光学園高校', '桐光', 'B', 5),
(12, 1, '大宮アルディージャU18', '大宮U18', 'B', 6),
-- Cグループ
(13, 1, '浦和学院高校', '浦和学院', 'C', 1),
(14, 1, '東福岡高校', '東福岡', 'C', 2),
(15, 1, '大津高校', '大津', 'C', 3),
(16, 1, '市立船橋高校', '市船', 'C', 4),
(17, 1, '西武台高校', '西武台', 'C', 5),
(18, 1, '浦和レッズユース', '浦和U18', 'C', 6),
-- Dグループ
(19, 1, '武南高校', '武南', 'D', 1),
(20, 1, '長崎総合科学大附高校', '長崎総科大', 'D', 2),
(21, 1, '尚志高校', '尚志', 'D', 3),
(22, 1, '正智深谷高校', '正智深谷', 'D', 4),
(23, 1, '立正大淞南高校', '立正淞南', 'D', 5),
(24, 1, '浦和東高校', '浦和東', 'D', 6);

-- 順位表初期データ（基本カラムのみ）
INSERT INTO standings (tournament_id, group_id, team_id, points) VALUES
(1, 'A', 1, 0),
(1, 'A', 2, 0),
(1, 'A', 3, 0),
(1, 'A', 4, 0),
(1, 'A', 5, 0),
(1, 'A', 6, 0),
(1, 'B', 7, 0),
(1, 'B', 8, 0),
(1, 'B', 9, 0),
(1, 'B', 10, 0),
(1, 'B', 11, 0),
(1, 'B', 12, 0),
(1, 'C', 13, 0),
(1, 'C', 14, 0),
(1, 'C', 15, 0),
(1, 'C', 16, 0),
(1, 'C', 17, 0),
(1, 'C', 18, 0),
(1, 'D', 19, 0),
(1, 'D', 20, 0),
(1, 'D', 21, 0),
(1, 'D', 22, 0),
(1, 'D', 23, 0),
(1, 'D', 24, 0);

-- サンプル試合データ
INSERT INTO matches (id, tournament_id, group_id, match_order, home_team_id, away_team_id, venue_id, match_date, match_time, status, home_score_total, away_score_total) VALUES
(1, 1, 'A', 1, 1, 2, 1, '2026-03-20', '09:30:00', 'completed', 2, 1),
(2, 1, 'A', 2, 3, 4, 1, '2026-03-20', '10:45:00', 'completed', 0, 0),
(3, 1, 'A', 3, 5, 6, 1, '2026-03-20', '12:00:00', 'completed', 3, 1),
(4, 1, 'B', 1, 7, 8, 2, '2026-03-20', '09:30:00', 'completed', 1, 2),
(5, 1, 'B', 2, 9, 10, 2, '2026-03-20', '10:45:00', 'completed', 3, 1),
(6, 1, 'B', 3, 11, 12, 2, '2026-03-20', '12:00:00', 'completed', 2, 2),
(7, 1, 'C', 1, 13, 14, 3, '2026-03-20', '09:30:00', 'completed', 2, 2),
(8, 1, 'C', 2, 15, 16, 3, '2026-03-20', '10:45:00', 'scheduled', 0, 0),
(9, 1, 'C', 3, 17, 18, 3, '2026-03-20', '12:00:00', 'scheduled', 0, 0),
(10, 1, 'D', 1, 19, 20, 4, '2026-03-20', '09:30:00', 'scheduled', 0, 0),
(11, 1, 'D', 2, 21, 22, 4, '2026-03-20', '10:45:00', 'scheduled', 0, 0),
(12, 1, 'D', 3, 23, 24, 4, '2026-03-20', '12:00:00', 'scheduled', 0, 0);

-- サンプル得点データ
INSERT INTO goals (id, match_id, team_id, player_name, half, minute, is_own_goal) VALUES
(1, 1, 1, '田中太郎', 1, 15, false),
(2, 1, 1, '鈴木一郎', 2, 30, false),
(3, 1, 2, '佐藤健', 2, 45, false),
(4, 3, 5, '山田花子', 1, 10, false),
(5, 3, 5, '高橋翔', 1, 35, false),
(6, 3, 5, '山田花子', 2, 35, false),
(7, 3, 6, '伊藤拓海', 1, 25, false),
(8, 4, 8, '渡辺裕太', 1, 20, false),
(9, 4, 8, '中村光', 1, 40, false),
(10, 4, 7, '小林誠', 2, 25, false),
(11, 5, 9, '木村達也', 1, 5, false),
(12, 5, 9, '加藤俊介', 1, 30, false),
(13, 5, 9, '木村達也', 1, 45, false),
(14, 5, 10, '吉田健太', 2, 50, false),
(15, 6, 11, '山本陸', 1, 22, false),
(16, 6, 11, '斎藤遼', 2, 30, false),
(17, 6, 12, '松本大地', 1, 35, false),
(18, 6, 12, '松本大地', 2, 55, false),
(19, 7, 13, '井上凌', 2, 27, false),
(20, 7, 13, '清水翔太', 2, 53, false),
(21, 7, 14, '森田圭吾', 1, 18, false),
(22, 7, 14, '石井隼人', 2, 40, false);

-- RLSポリシー（存在しない場合のみ作成）
DO $$ BEGIN
    ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN null; END $$;

-- 匿名読み取りポリシー（存在しない場合のみ）
DO $$ BEGIN
    CREATE POLICY "anon_read_tournaments" ON tournaments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_read_groups" ON groups FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_read_teams" ON teams FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_read_venues" ON venues FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_read_matches" ON matches FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_read_goals" ON goals FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_read_standings" ON standings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
