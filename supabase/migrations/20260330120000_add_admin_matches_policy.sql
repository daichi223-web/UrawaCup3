-- matchesテーブルにAdmin full accessポリシーを追加（他テーブルと同様）
CREATE POLICY "Admin full access" ON matches FOR ALL USING (is_admin());
