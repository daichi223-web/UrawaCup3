const fs = require('fs');
const path = require('path');

const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>浦和カップ - 最終日結果入力</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: #1a365d;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 20px;
        }

        /* セクション */
        .section {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #1a365d;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
        }

        /* ファイル読み込み */
        .file-input-area {
            border: 2px dashed #cbd5e0;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
        }
        .file-input-area:hover {
            border-color: #2b6cb0;
            background: #ebf8ff;
        }
        .file-input-area.loaded {
            border-color: #38a169;
            background: #f0fff4;
        }
        #fileInput {
            display: none;
        }

        /* 試合カード */
        .match-card {
            background: #f7fafc;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 15px;
            border-left: 4px solid #2b6cb0;
        }
        .match-card.final {
            border-left-color: #d69e2e;
            background: #fffff0;
        }
        .match-card.third {
            border-left-color: #805ad5;
            background: #faf5ff;
        }
        .match-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .match-type {
            font-weight: bold;
            color: #2b6cb0;
        }
        .match-card.final .match-type {
            color: #d69e2e;
        }
        .match-venue {
            font-size: 12px;
            color: #666;
        }

        /* スコア入力 */
        .score-section {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            flex-wrap: wrap;
        }
        .team-name {
            width: 150px;
            text-align: center;
            font-weight: bold;
            font-size: 14px;
        }
        .team-name.home { text-align: right; }
        .team-name.away { text-align: left; }
        .seed-badge {
            font-size: 10px;
            background: #e2e8f0;
            color: #4a5568;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 5px;
            font-weight: normal;
        }
        .score-inputs {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
        }
        .score-row {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .score-label {
            font-size: 11px;
            color: #666;
            width: 35px;
            text-align: right;
        }
        .score-input {
            width: 40px;
            height: 32px;
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            border: 2px solid #e2e8f0;
            border-radius: 5px;
        }
        .score-input:focus {
            outline: none;
            border-color: #2b6cb0;
        }
        .score-input.pk {
            background: #fef3c7;
            border-color: #d69e2e;
        }
        .score-input.validation-error {
            border-color: #e53e3e;
            background: #fff5f5;
        }
        .score-total {
            font-size: 28px;
            font-weight: bold;
            color: #1a365d;
            min-width: 35px;
            text-align: center;
        }
        .vs { color: #999; }

        /* PK入力 */
        .pk-section {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #e2e8f0;
        }
        .pk-toggle {
            display: flex;
            align-items: center;
            gap: 10px;
            justify-content: center;
            margin-bottom: 10px;
        }
        .pk-toggle label {
            font-size: 13px;
            color: #666;
        }
        .pk-inputs {
            display: none;
            justify-content: center;
            gap: 20px;
        }
        .pk-inputs.active {
            display: flex;
        }

        /* 得点者 */
        .scorers-section {
            margin-top: 15px;
            padding: 10px;
            background: white;
            border-radius: 8px;
        }
        .scorers-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .scorers-title {
            font-size: 13px;
            font-weight: bold;
            color: #4a5568;
        }
        .add-btn {
            padding: 5px 10px;
            background: #2b6cb0;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
        }
        .add-btn:hover {
            background: #2c5282;
        }
        .scorer-row {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
            align-items: center;
            flex-wrap: wrap;
        }
        .scorer-input {
            padding: 6px 10px;
            border: 1px solid #e2e8f0;
            border-radius: 5px;
            font-size: 13px;
        }
        .scorer-time { width: 50px; }
        .scorer-team { width: 120px; }
        .scorer-name { width: 150px; }
        .scorer-name-input { flex: 1; min-width: 100px; }
        .remove-btn {
            padding: 5px 8px;
            background: #e53e3e;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 11px;
        }
        .no-scorers {
            color: #999;
            font-size: 13px;
            text-align: center;
        }

        /* 会場グループ */
        .venue-group {
            margin-bottom: 25px;
        }
        .venue-title {
            font-size: 14px;
            font-weight: bold;
            color: #2b6cb0;
            margin-bottom: 10px;
            padding: 8px 12px;
            background: #ebf8ff;
            border-radius: 5px;
        }

        /* 最終順位 */
        .ranking-section {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            justify-content: center;
        }

        /* 得点ランキング */
        .scorer-ranking-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .scorer-ranking-table th,
        .scorer-ranking-table td {
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        .scorer-ranking-table th {
            background: #f7fafc;
            font-weight: bold;
            color: #4a5568;
            font-size: 13px;
        }
        .scorer-ranking-table tr:hover {
            background: #f7fafc;
        }
        .scorer-rank {
            width: 50px;
            font-weight: bold;
            color: #2b6cb0;
        }
        .scorer-rank.top-3 {
            color: #d69e2e;
            font-size: 16px;
        }
        .scorer-goals {
            width: 60px;
            font-weight: bold;
            font-size: 16px;
            color: #e53e3e;
            text-align: center;
        }
        .no-ranking {
            color: #999;
            font-size: 14px;
            text-align: center;
            padding: 20px;
        }
        .error-message {
            color: #e53e3e;
            font-size: 11px;
            margin-top: 3px;
        }
        .master-info {
            font-size: 12px;
            color: #38a169;
            margin-top: 10px;
            padding: 8px;
            background: #f0fff4;
            border-radius: 5px;
        }

        .ranking-card {
            padding: 20px 30px;
            border-radius: 10px;
            text-align: center;
            min-width: 150px;
        }
        .ranking-card.rank-1 {
            background: linear-gradient(135deg, #fef3c7, #f6e05e);
            border: 2px solid #d69e2e;
        }
        .ranking-card.rank-2 {
            background: linear-gradient(135deg, #e2e8f0, #cbd5e0);
            border: 2px solid #a0aec0;
        }
        .ranking-card.rank-3 {
            background: linear-gradient(135deg, #feebc8, #ed8936);
            border: 2px solid #c05621;
        }
        .ranking-card.rank-4 {
            background: #f7fafc;
            border: 2px solid #e2e8f0;
        }
        .ranking-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
        }
        .ranking-team {
            font-size: 16px;
            font-weight: bold;
            color: #1a365d;
        }

        /* 優秀選手 */
        .player-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .player-row {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        .player-row.mvp {
            background: #fef3c7;
            padding: 10px;
            border-radius: 8px;
            border: 2px solid #d69e2e;
        }
        .player-label {
            width: 100px;
            font-size: 13px;
            font-weight: bold;
            color: #4a5568;
        }
        .player-input {
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 5px;
            font-size: 14px;
        }
        .player-name { width: 150px; }
        .player-name-input { flex: 1; min-width: 100px; }
        .player-team { width: 150px; }

        /* ボタン */
        .actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        }
        .btn-primary {
            background: #2b6cb0;
            color: white;
        }
        .btn-primary:hover {
            background: #2c5282;
        }
        .btn-secondary {
            background: #e2e8f0;
            color: #1a365d;
        }
        .btn-secondary:hover {
            background: #cbd5e0;
        }
        .btn-success {
            background: #38a169;
            color: white;
        }
        .btn-success:hover {
            background: #2f855a;
        }

        /* タブ */
        .tabs {
            display: flex;
            gap: 5px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }
        .tab {
            padding: 10px 20px;
            background: #e2e8f0;
            border: none;
            border-radius: 8px 8px 0 0;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        }
        .tab.active {
            background: #2b6cb0;
            color: white;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }

        @media (max-width: 600px) {
            .score-section { flex-direction: column; }
            .team-name { width: 100%; text-align: center !important; }
            .ranking-section { flex-direction: column; align-items: center; }
            .tabs { flex-wrap: wrap; }
        }
    </style>
</head>
<body>
    <h1>🏆 浦和カップ - 最終日結果入力</h1>
    <p class="subtitle">第45回浦和カップ高校サッカーフェスティバル　3月31日（月）</p>

    <!-- ファイル読み込み -->
    <div class="section">
        <div class="section-title">📂 組み合わせデータを読み込む</div>
        <div class="file-input-area" id="fileInputArea" onclick="document.getElementById('fileInput').click()">
            <p>ここをクリックしてJSONファイルを選択</p>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">
                （final_day_schedule.html からエクスポートしたファイル）
            </p>
        </div>
        <input type="file" id="fileInput" accept=".json" onchange="loadJSON(this)">
        <div style="margin-top: 15px; text-align: center;">
            <button class="btn btn-secondary" onclick="loadSampleData()">サンプルデータで試す</button>
        </div>
    </div>

    <!-- メインコンテンツ -->
    <div id="mainContent" style="display: none;">

        <!-- タブ -->
        <div class="tabs">
            <button class="tab active" onclick="switchTab('tournament')">🏆 決勝トーナメント</button>
            <button class="tab" onclick="switchTab('training')">⚽ 研修試合</button>
            <button class="tab" onclick="switchTab('scorer-ranking')">📊 得点ランキング</button>
            <button class="tab" onclick="switchTab('awards')">🎖️ 優秀選手</button>
        </div>

        <!-- 決勝トーナメント -->
        <div class="tab-content active" id="tab-tournament">
            <div class="section">
                <div class="section-title">🏆 決勝トーナメント結果</div>
                <div id="tournamentMatches"></div>

                <div class="section-title" style="margin-top: 30px;">📊 最終順位</div>
                <div class="ranking-section" id="rankingSection"></div>
            </div>
        </div>

        <!-- 研修試合 -->
        <div class="tab-content" id="tab-training">
            <div class="section">
                <div class="section-title">⚽ 研修試合結果</div>
                <div id="trainingMatches"></div>
            </div>
        </div>

        <!-- 得点ランキング -->
        <div class="tab-content" id="tab-scorer-ranking">
            <div class="section">
                <div class="section-title">📊 得点ランキング</div>
                <p style="font-size: 12px; color: #666; margin-bottom: 15px;">
                    全試合（決勝トーナメント＋研修試合）の得点者を集計しています
                </p>
                <div id="scorerRankingContent"></div>
            </div>
        </div>

        <!-- 優秀選手 -->
        <div class="tab-content" id="tab-awards">
            <div class="section">
                <div class="section-title">🎖️ 優秀選手</div>
                <div id="masterInfo"></div>
                <div class="player-list" id="playerList"></div>
                <button class="add-btn" style="margin-top: 15px;" onclick="addPlayer()">+ 優秀選手を追加</button>
            </div>
        </div>

        <!-- アクション -->
        <div class="actions">
            <button class="btn btn-primary" onclick="saveData()">💾 保存</button>
            <button class="btn btn-secondary" onclick="loadSavedData()">📂 読み込み</button>
            <button class="btn btn-success" onclick="exportForPDF()">📄 最終結果PDF用エクスポート</button>
        </div>
    </div>

    <script>
        // =============================================================================
        // 状態
        // =============================================================================
        let scheduleData = null;
        let teamMaster = {};  // チーム名 -> { players: [{number, name}] }
        let results = {
            tournament: [],
            training: [],
            players: [
                { type: 'MVP', name: '', team: '' },
            ],
            ranking: [null, null, null, null],  // 1-4位
        };

        // =============================================================================
        // 読み込み
        // =============================================================================
        function loadJSON(input) {
            const file = input.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    processData(data);
                } catch (err) {
                    alert('JSONの読み込みに失敗しました: ' + err.message);
                }
            };
            reader.readAsText(file);
        }

        function loadSampleData() {
            const sample = {
                tournament: [
                    { id: 'sf1', type: '準決勝1', kickoff: '9:30', venue: '駒場スタジアム',
                      home: { id: 1, name: '浦和南', seed: 'A1' },
                      away: { id: 13, name: '浦和学院', seed: 'C1' }},
                    { id: 'sf2', type: '準決勝2', kickoff: '9:30', venue: '駒場スタジアム',
                      home: { id: 7, name: '市立浦和', seed: 'B1' },
                      away: { id: 19, name: '武南', seed: 'D1' }},
                    { id: '3rd', type: '3位決定戦', kickoff: '12:00', venue: '駒場スタジアム',
                      home: null, away: null, homeSeed: 'SF1敗者', awaySeed: 'SF2敗者' },
                    { id: 'final', type: '決勝', kickoff: '13:30', venue: '駒場スタジアム',
                      home: null, away: null, homeSeed: 'SF1勝者', awaySeed: 'SF2勝者' },
                ],
                training: [
                    { id: 't1', venue: '浦和南高G', kickoff: '9:30',
                      home: { name: '東海大相模', seed: 'A2' },
                      away: { name: '浦和レッズ', seed: 'C2' }},
                    { id: 't2', venue: '浦和南高G', kickoff: '10:35',
                      home: { name: '健大高崎', seed: 'A3' },
                      away: { name: '野辺地西', seed: 'C3' }},
                    { id: 't3', venue: '浦和南高G', kickoff: '11:40',
                      home: { name: '専大北上', seed: 'A4' },
                      away: { name: '磐田東', seed: 'C4' }},
                    { id: 't4', venue: '浦和南高G', kickoff: '12:45',
                      home: { name: '日本文理', seed: 'A5' },
                      away: { name: '浦和東', seed: 'C5' }},
                    { id: 't5', venue: '浦和南高G', kickoff: '13:50',
                      home: { name: '新潟西', seed: 'A6' },
                      away: { name: '浦和', seed: 'C6' }},
                    { id: 't6', venue: '市立浦和高G', kickoff: '9:30',
                      home: { name: '富士市立', seed: 'B2' },
                      away: { name: '佐野日大', seed: 'D2' }},
                    { id: 't7', venue: '市立浦和高G', kickoff: '10:35',
                      home: { name: '旭川実業', seed: 'B3' },
                      away: { name: '韮崎', seed: 'D3' }},
                    { id: 't8', venue: '市立浦和高G', kickoff: '11:40',
                      home: { name: 'RB大宮', seed: 'B4' },
                      away: { name: '國學院久我山', seed: 'D4' }},
                    { id: 't9', venue: '市立浦和高G', kickoff: '12:45',
                      home: { name: '聖和学園', seed: 'B5' },
                      away: { name: '日大明誠', seed: 'D5' }},
                    { id: 't10', venue: '市立浦和高G', kickoff: '13:50',
                      home: { name: '帝京大可児', seed: 'B6' },
                      away: { name: '浦和西', seed: 'D6' }},
                ],
                // サンプル選手マスタ
                teams: {
                    '浦和南': {
                        players: [
                            { number: 1, name: '田中 GK' },
                            { number: 10, name: '佐藤 翔太' },
                            { number: 11, name: '鈴木 健太' },
                            { number: 9, name: '高橋 大輔' }
                        ]
                    },
                    '浦和学院': {
                        players: [
                            { number: 10, name: '山田 太郎' },
                            { number: 11, name: '伊藤 次郎' },
                            { number: 7, name: '渡辺 三郎' }
                        ]
                    },
                    '市立浦和': {
                        players: [
                            { number: 10, name: '中村 一郎' },
                            { number: 9, name: '小林 二郎' },
                            { number: 8, name: '加藤 三郎' }
                        ]
                    },
                    '武南': {
                        players: [
                            { number: 10, name: '吉田 修' },
                            { number: 11, name: '山本 誠' },
                            { number: 7, name: '井上 剛' }
                        ]
                    }
                }
            };
            processData(sample);
        }

        function processData(data) {
            scheduleData = data;

            // 選手マスタを読み込み
            teamMaster = data.teams || {};
            const masterTeamCount = Object.keys(teamMaster).length;
            const masterPlayerCount = Object.values(teamMaster).reduce((sum, t) => sum + (t.players?.length || 0), 0);

            // 結果データ初期化
            results.tournament = (data.tournament || []).map(m => ({
                ...m,
                homeScore1H: '', homeScore2H: '',
                awayScore1H: '', awayScore2H: '',
                homePK: '', awayPK: '',
                hasPK: false,
                scorers: [],
            }));

            results.training = (data.training || []).map(m => ({
                ...m,
                homeScore1H: '', homeScore2H: '',
                awayScore1H: '', awayScore2H: '',
                homePK: '', awayPK: '',
                hasPK: false,
                scorers: [],
            }));

            // UI表示
            document.getElementById('fileInputArea').classList.add('loaded');
            let loadedMsg = '<p>✓ データを読み込みました</p>';
            if (masterTeamCount > 0) {
                loadedMsg += \`<p style="font-size:11px;color:#38a169;">選手マスタ: \${masterTeamCount}チーム / \${masterPlayerCount}名</p>\`;
            }
            document.getElementById('fileInputArea').innerHTML = loadedMsg;
            document.getElementById('mainContent').style.display = 'block';

            // マスタ情報表示
            updateMasterInfo();

            render();
        }

        function updateMasterInfo() {
            const container = document.getElementById('masterInfo');
            const masterTeamCount = Object.keys(teamMaster).length;
            if (masterTeamCount > 0) {
                const masterPlayerCount = Object.values(teamMaster).reduce((sum, t) => sum + (t.players?.length || 0), 0);
                container.innerHTML = \`
                    <div class="master-info">
                        ✓ 選手マスタ読み込み済み: \${masterTeamCount}チーム / \${masterPlayerCount}名
                    </div>
                \`;
            } else {
                container.innerHTML = \`
                    <div style="font-size: 12px; color: #999; margin-bottom: 10px;">
                        ※ 選手マスタが読み込まれていません（手入力のみ）
                    </div>
                \`;
            }
        }

        // =============================================================================
        // レンダリング
        // =============================================================================
        function render() {
            renderTournament();
            renderTraining();
            renderPlayers();
            renderScorerRanking();
            updateRanking();
        }

        function renderTournament() {
            const container = document.getElementById('tournamentMatches');
            container.innerHTML = results.tournament.map((m, idx) => {
                const isFinal = m.id === 'final';
                const isThird = m.id === '3rd';
                const cardClass = isFinal ? 'final' : (isThird ? 'third' : '');

                // 準決勝の結果から3位決定戦・決勝のチームを決定
                let homeTeam = m.home;
                let awayTeam = m.away;

                if (m.id === '3rd' || m.id === 'final') {
                    const sf1 = results.tournament.find(x => x.id === 'sf1');
                    const sf2 = results.tournament.find(x => x.id === 'sf2');

                    if (sf1 && sf2) {
                        const sf1Winner = getWinner(sf1);
                        const sf1Loser = getLoser(sf1);
                        const sf2Winner = getWinner(sf2);
                        const sf2Loser = getLoser(sf2);

                        if (m.id === '3rd') {
                            homeTeam = sf1Loser;
                            awayTeam = sf2Loser;
                        } else {
                            homeTeam = sf1Winner;
                            awayTeam = sf2Winner;
                        }
                    }
                }

                const homeName = homeTeam ? homeTeam.name : (m.homeSeed || '未定');
                const awayName = awayTeam ? awayTeam.name : (m.awaySeed || '未定');
                const homeSeed = homeTeam?.seed || null;
                const awaySeed = awayTeam?.seed || null;

                return createMatchCard(m, idx, 'tournament', homeName, awayName, cardClass, homeSeed, awaySeed);
            }).join('');
        }

        function renderTraining() {
            const container = document.getElementById('trainingMatches');

            // 会場ごとにグループ化
            const venues = ['浦和南高G', '市立浦和高G', '浦和学院高G', '武南高G'];
            const byVenue = {};
            venues.forEach(v => byVenue[v] = []);

            results.training.forEach((m, idx) => {
                if (byVenue[m.venue]) {
                    byVenue[m.venue].push({ match: m, index: idx });
                }
            });

            container.innerHTML = venues.map(venue => {
                const matches = byVenue[venue];
                if (matches.length === 0) return '';

                return \`
                    <div class="venue-group">
                        <div class="venue-title">📍 \${venue}（\${matches.length}試合）</div>
                        \${matches.map(({ match, index }) => {
                            const homeName = match.home ? match.home.name : '未定';
                            const awayName = match.away ? match.away.name : '未定';
                            const homeSeed = match.home?.seed || null;
                            const awaySeed = match.away?.seed || null;
                            return createMatchCard(match, index, 'training', homeName, awayName, '', homeSeed, awaySeed);
                        }).join('')}
                    </div>
                \`;
            }).join('');
        }

        function createMatchCard(match, idx, type, homeName, awayName, extraClass, homeSeed, awaySeed) {
            const prefix = \`\${type}-\${idx}\`;
            const homeTotal = calcTotal(match.homeScore1H, match.homeScore2H);
            const awayTotal = calcTotal(match.awayScore1H, match.awayScore2H);

            // シード情報バッジの生成
            const homeSeedBadge = homeSeed ? \`<span class="seed-badge">\${homeSeed}</span>\` : '';
            const awaySeedBadge = awaySeed ? \`<span class="seed-badge">\${awaySeed}</span>\` : '';

            return \`
                <div class="match-card \${extraClass}">
                    <div class="match-header">
                        <span class="match-type">\${match.type || \`第\${idx+1}試合\`}</span>
                        <span class="match-venue">\${match.kickoff} @ \${match.venue || ''}</span>
                    </div>

                    <div class="score-section">
                        <div class="team-name home">\${homeName}\${homeSeedBadge}</div>
                        <div class="score-total">\${homeTotal}</div>

                        <div class="score-inputs">
                            <div class="score-row">
                                <span class="score-label">前半</span>
                                <input type="number" class="score-input" min="0" max="99"
                                       value="\${match.homeScore1H}"
                                       onchange="updateScore('\${type}', \${idx}, 'homeScore1H', this.value)"
                                       oninput="validateScoreInput(this)">
                                <span class="vs">-</span>
                                <input type="number" class="score-input" min="0" max="99"
                                       value="\${match.awayScore1H}"
                                       onchange="updateScore('\${type}', \${idx}, 'awayScore1H', this.value)"
                                       oninput="validateScoreInput(this)">
                            </div>
                            <div class="score-row">
                                <span class="score-label">後半</span>
                                <input type="number" class="score-input" min="0" max="99"
                                       value="\${match.homeScore2H}"
                                       onchange="updateScore('\${type}', \${idx}, 'homeScore2H', this.value)"
                                       oninput="validateScoreInput(this)">
                                <span class="vs">-</span>
                                <input type="number" class="score-input" min="0" max="99"
                                       value="\${match.awayScore2H}"
                                       onchange="updateScore('\${type}', \${idx}, 'awayScore2H', this.value)"
                                       oninput="validateScoreInput(this)">
                            </div>
                        </div>

                        <div class="score-total">\${awayTotal}</div>
                        <div class="team-name away">\${awaySeedBadge}\${awayName}</div>
                    </div>

                    <div class="pk-section">
                        <div class="pk-toggle">
                            <label>
                                <input type="checkbox" \${match.hasPK ? 'checked' : ''}
                                       onchange="togglePK('\${type}', \${idx}, this.checked)">
                                PK戦
                            </label>
                        </div>
                        <div class="pk-inputs \${match.hasPK ? 'active' : ''}" id="pk-\${prefix}">
                            <div class="score-row">
                                <span class="score-label">PK</span>
                                <input type="number" class="score-input pk" min="0" max="99"
                                       value="\${match.homePK}"
                                       onchange="updateScore('\${type}', \${idx}, 'homePK', this.value)"
                                       oninput="validateScoreInput(this)">
                                <span class="vs">-</span>
                                <input type="number" class="score-input pk" min="0" max="99"
                                       value="\${match.awayPK}"
                                       onchange="updateScore('\${type}', \${idx}, 'awayPK', this.value)"
                                       oninput="validateScoreInput(this)">
                            </div>
                        </div>
                    </div>

                    <div class="scorers-section">
                        <div class="scorers-header">
                            <span class="scorers-title">⚽ 得点経過</span>
                            <button class="add-btn" onclick="addScorer('\${type}', \${idx})">+ 追加</button>
                        </div>
                        <div id="scorers-\${prefix}">
                            \${renderScorers(match, type, idx, homeName, awayName)}
                        </div>
                    </div>
                </div>
            \`;
        }

        function renderScorers(match, type, matchIdx, homeName, awayName) {
            if (!match.scorers || match.scorers.length === 0) {
                return '<div class="no-scorers">得点なし</div>';
            }
            return match.scorers.map((s, idx) => {
                // 選手プルダウンを生成
                const playerOptions = getPlayerOptions(s.team, s.name);

                return \`
                    <div class="scorer-row">
                        <input type="text" class="scorer-input scorer-time" placeholder="分"
                               value="\${s.time}"
                               onchange="updateScorer('\${type}', \${matchIdx}, \${idx}, 'time', this.value)"
                               oninput="validateTimeInput(this)">
                        <select class="scorer-input scorer-team"
                                onchange="onScorerTeamChange('\${type}', \${matchIdx}, \${idx}, this.value)">
                            <option value="\${homeName}" \${s.team === homeName ? 'selected' : ''}>\${homeName}</option>
                            <option value="\${awayName}" \${s.team === awayName ? 'selected' : ''}>\${awayName}</option>
                        </select>
                        \${playerOptions.length > 0 ? \`
                            <select class="scorer-input scorer-name"
                                    onchange="updateScorer('\${type}', \${matchIdx}, \${idx}, 'name', this.value)">
                                <option value="">選手を選択</option>
                                \${playerOptions}
                                <option value="__other__">その他（手入力）</option>
                            </select>
                        \` : ''}
                        <input type="text" class="scorer-input scorer-name-input" placeholder="選手名"
                               value="\${s.name}"
                               onchange="updateScorer('\${type}', \${matchIdx}, \${idx}, 'name', this.value)"
                               style="\${playerOptions.length > 0 && s.name && !isCustomName(s.team, s.name) ? 'display:none' : ''}">
                        <button class="remove-btn" onclick="removeScorer('\${type}', \${matchIdx}, \${idx})">✕</button>
                    </div>
                \`;
            }).join('');
        }

        function getPlayerOptions(teamName, selectedName) {
            const team = teamMaster[teamName];
            if (!team || !team.players || team.players.length === 0) {
                return '';
            }
            return team.players.map(p => {
                const displayName = p.number ? \`#\${p.number} \${p.name}\` : p.name;
                const isSelected = p.name === selectedName ? 'selected' : '';
                return \`<option value="\${p.name}" \${isSelected}>\${displayName}</option>\`;
            }).join('');
        }

        function isCustomName(teamName, name) {
            if (!name) return false;
            const team = teamMaster[teamName];
            if (!team || !team.players) return true;
            return !team.players.some(p => p.name === name);
        }

        function onScorerTeamChange(type, matchIdx, scorerIdx, newTeam) {
            const match = results[type][matchIdx];
            if (match && match.scorers[scorerIdx]) {
                match.scorers[scorerIdx].team = newTeam;
                match.scorers[scorerIdx].name = '';  // チーム変更時は選手をリセット
                render();
            }
        }

        function renderPlayers() {
            const container = document.getElementById('playerList');

            // チーム一覧を収集
            const teams = new Set();
            results.tournament.forEach(m => {
                if (m.home) teams.add(m.home.name);
                if (m.away) teams.add(m.away.name);
            });
            results.training.forEach(m => {
                if (m.home) teams.add(m.home.name);
                if (m.away) teams.add(m.away.name);
            });
            const teamList = Array.from(teams).sort();

            container.innerHTML = results.players.map((p, idx) => {
                const isMVP = p.type === 'MVP';
                const teamOptions = teamList.map(t =>
                    \`<option value="\${t}" \${p.team === t ? 'selected' : ''}>\${t}</option>\`
                ).join('');

                // 選手プルダウン
                const playerOptions = getPlayerOptions(p.team, p.name);

                return \`
                    <div class="player-row \${isMVP ? 'mvp' : ''}">
                        <span class="player-label">\${isMVP ? '🏆 最優秀選手' : '⭐ 優秀選手'}</span>
                        <select class="player-input player-team"
                                onchange="onPlayerTeamChange(\${idx}, this.value)">
                            <option value="">チームを選択</option>
                            \${teamOptions}
                        </select>
                        \${playerOptions ? \`
                            <select class="player-input player-name"
                                    onchange="onPlayerNameSelect(\${idx}, this.value)">
                                <option value="">選手を選択</option>
                                \${playerOptions}
                                <option value="__other__">その他（手入力）</option>
                            </select>
                        \` : ''}
                        <input type="text" class="player-input player-name-input" placeholder="選手名"
                               value="\${p.name}"
                               onchange="updatePlayer(\${idx}, 'name', this.value)"
                               style="\${playerOptions && p.name && !isCustomName(p.team, p.name) ? 'display:none' : ''}">
                        \${!isMVP ? \`<button class="remove-btn" onclick="removePlayer(\${idx})">✕</button>\` : ''}
                    </div>
                \`;
            }).join('');
        }

        function onPlayerTeamChange(idx, newTeam) {
            if (results.players[idx]) {
                results.players[idx].team = newTeam;
                results.players[idx].name = '';  // チーム変更時は選手をリセット
                renderPlayers();
            }
        }

        function onPlayerNameSelect(idx, value) {
            if (value === '__other__') {
                // 手入力モードに切り替え
                results.players[idx].name = '';
                renderPlayers();
                // 手入力欄にフォーカス
                setTimeout(() => {
                    const inputs = document.querySelectorAll('.player-name-input');
                    if (inputs[idx]) {
                        inputs[idx].style.display = '';
                        inputs[idx].focus();
                    }
                }, 0);
            } else {
                results.players[idx].name = value;
            }
        }

        // =============================================================================
        // 得点ランキング
        // =============================================================================
        function renderScorerRanking() {
            const container = document.getElementById('scorerRankingContent');

            // 全試合から得点者を集計
            const scorerMap = new Map();  // キー: "選手名|チーム名"

            const collectScorers = (matches) => {
                matches.forEach(match => {
                    if (match.scorers) {
                        match.scorers.forEach(scorer => {
                            if (scorer.name && scorer.name.trim()) {
                                const key = \`\${scorer.name.trim()}|\${scorer.team || ''}\`;
                                const existing = scorerMap.get(key);
                                if (existing) {
                                    existing.goals += 1;
                                } else {
                                    scorerMap.set(key, {
                                        name: scorer.name.trim(),
                                        team: scorer.team || '',
                                        goals: 1
                                    });
                                }
                            }
                        });
                    }
                });
            };

            collectScorers(results.tournament);
            collectScorers(results.training);

            // 得点数でソートしてランキング作成
            const scorers = Array.from(scorerMap.values())
                .sort((a, b) => b.goals - a.goals);

            if (scorers.length === 0) {
                container.innerHTML = '<div class="no-ranking">まだ得点者が登録されていません</div>';
                return;
            }

            // ランキング表を生成
            let currentRank = 0;
            let previousGoals = -1;
            let sameRankCount = 0;

            const rows = scorers.map((scorer, idx) => {
                if (scorer.goals !== previousGoals) {
                    currentRank = idx + 1;
                    sameRankCount = 1;
                } else {
                    sameRankCount++;
                }
                previousGoals = scorer.goals;

                const rankClass = currentRank <= 3 ? 'top-3' : '';
                const rankDisplay = currentRank <= 3 ? ['🥇', '🥈', '🥉'][currentRank - 1] : currentRank;

                return \`
                    <tr>
                        <td class="scorer-rank \${rankClass}">\${rankDisplay}</td>
                        <td>\${scorer.name}</td>
                        <td>\${scorer.team}</td>
                        <td class="scorer-goals">\${scorer.goals}</td>
                    </tr>
                \`;
            }).join('');

            container.innerHTML = \`
                <table class="scorer-ranking-table">
                    <thead>
                        <tr>
                            <th>順位</th>
                            <th>選手名</th>
                            <th>チーム</th>
                            <th>得点</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${rows}
                    </tbody>
                </table>
                <p style="font-size: 12px; color: #666; margin-top: 15px; text-align: right;">
                    合計: \${scorers.length}名 / \${scorers.reduce((sum, s) => sum + s.goals, 0)}得点
                </p>
            \`;
        }

        function updateRanking() {
            const container = document.getElementById('rankingSection');

            // 決勝の結果から順位を計算
            const final = results.tournament.find(m => m.id === 'final');
            const third = results.tournament.find(m => m.id === '3rd');
            const sf1 = results.tournament.find(m => m.id === 'sf1');
            const sf2 = results.tournament.find(m => m.id === 'sf2');

            let rank1 = null, rank2 = null, rank3 = null, rank4 = null;

            if (final) {
                rank1 = getWinner(final);
                rank2 = getLoser(final);
            }
            if (third) {
                rank3 = getWinner(third);
                rank4 = getLoser(third);
            }

            // 3位決定戦・決勝のチームを決定（準決勝結果から）
            if (!rank1 && sf1 && sf2) {
                const sf1Winner = getWinner(sf1);
                const sf2Winner = getWinner(sf2);
                if (sf1Winner) rank1 = { name: \`\${sf1Winner.name}?\`, pending: true };
            }

            results.ranking = [rank1, rank2, rank3, rank4];

            const ranks = [
                { label: '優勝', team: rank1, class: 'rank-1' },
                { label: '準優勝', team: rank2, class: 'rank-2' },
                { label: '第3位', team: rank3, class: 'rank-3' },
                { label: '第4位', team: rank4, class: 'rank-4' },
            ];

            container.innerHTML = ranks.map(r => \`
                <div class="ranking-card \${r.class}">
                    <div class="ranking-label">\${r.label}</div>
                    <div class="ranking-team">\${r.team ? r.team.name : '---'}</div>
                </div>
            \`).join('');
        }

        // =============================================================================
        // ユーティリティ
        // =============================================================================
        function calcTotal(s1, s2) {
            const v1 = s1 === '' ? 0 : parseInt(s1) || 0;
            const v2 = s2 === '' ? 0 : parseInt(s2) || 0;
            if (s1 === '' && s2 === '') return '-';
            return v1 + v2;
        }

        function getWinner(match) {
            if (!match) return null;

            const homeTotal = (parseInt(match.homeScore1H) || 0) + (parseInt(match.homeScore2H) || 0);
            const awayTotal = (parseInt(match.awayScore1H) || 0) + (parseInt(match.awayScore2H) || 0);

            if (homeTotal > awayTotal) return match.home;
            if (awayTotal > homeTotal) return match.away;

            // PK
            if (match.hasPK) {
                const homePK = parseInt(match.homePK) || 0;
                const awayPK = parseInt(match.awayPK) || 0;
                if (homePK > awayPK) return match.home;
                if (awayPK > homePK) return match.away;
            }

            return null;
        }

        function getLoser(match) {
            if (!match) return null;
            const winner = getWinner(match);
            if (!winner) return null;
            return winner === match.home ? match.away : match.home;
        }

        // =============================================================================
        // バリデーション
        // =============================================================================
        function validateScoreInput(input) {
            const value = input.value;
            if (value === '') {
                input.classList.remove('validation-error');
                return true;
            }
            const num = parseInt(value);
            if (isNaN(num) || num < 0 || num > 99) {
                input.classList.add('validation-error');
                return false;
            }
            input.classList.remove('validation-error');
            return true;
        }

        function validateTimeInput(input) {
            const value = input.value.trim();
            if (value === '') {
                input.classList.remove('validation-error');
                return true;
            }
            // 数字のみ、または "45+2" のような形式を許可
            const pattern = /^[0-9]+(\+[0-9]+)?$/;
            if (!pattern.test(value)) {
                input.classList.add('validation-error');
                return false;
            }
            input.classList.remove('validation-error');
            return true;
        }

        // =============================================================================
        // イベントハンドラ
        // =============================================================================
        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

            document.querySelector(\`.tab[onclick*="\${tabName}"]\`).classList.add('active');
            document.getElementById(\`tab-\${tabName}\`).classList.add('active');
        }

        function updateScore(type, idx, field, value) {
            const match = results[type][idx];
            if (match) {
                match[field] = value === '' ? '' : parseInt(value) || 0;
                render();
            }
        }

        function togglePK(type, idx, checked) {
            const match = results[type][idx];
            if (match) {
                match.hasPK = checked;
                const pkDiv = document.getElementById(\`pk-\${type}-\${idx}\`);
                if (pkDiv) pkDiv.classList.toggle('active', checked);
                render();
            }
        }

        function addScorer(type, matchIdx) {
            const match = results[type][matchIdx];
            if (match) {
                const homeName = match.home ? match.home.name : '';
                match.scorers.push({ time: '', team: homeName, name: '' });
                render();
            }
        }

        function updateScorer(type, matchIdx, scorerIdx, field, value) {
            const match = results[type][matchIdx];
            if (match && match.scorers[scorerIdx]) {
                if (value === '__other__') {
                    match.scorers[scorerIdx].name = '';
                    render();
                    return;
                }
                match.scorers[scorerIdx][field] = value;
                // 得点ランキングをリアルタイム更新
                renderScorerRanking();
            }
        }

        function removeScorer(type, matchIdx, scorerIdx) {
            const match = results[type][matchIdx];
            if (match) {
                match.scorers.splice(scorerIdx, 1);
                render();
            }
        }

        function addPlayer() {
            results.players.push({ type: 'excellent', name: '', team: '' });
            renderPlayers();
        }

        function updatePlayer(idx, field, value) {
            if (results.players[idx]) {
                results.players[idx][field] = value;
            }
        }

        function removePlayer(idx) {
            if (results.players[idx].type !== 'MVP') {
                results.players.splice(idx, 1);
                renderPlayers();
            }
        }

        // =============================================================================
        // 保存・エクスポート
        // =============================================================================
        function saveData() {
            localStorage.setItem('urawaCup_finalResults', JSON.stringify(results));
            alert('保存しました');
        }

        function loadSavedData() {
            const data = localStorage.getItem('urawaCup_finalResults');
            if (data) {
                results = JSON.parse(data);
                render();
                alert('読み込みました');
            } else {
                alert('保存データがありません');
            }
        }

        function exportForPDF() {
            // 得点ランキングを計算
            const scorerMap = new Map();
            const collectScorers = (matches) => {
                matches.forEach(match => {
                    if (match.scorers) {
                        match.scorers.forEach(scorer => {
                            if (scorer.name && scorer.name.trim()) {
                                const key = \`\${scorer.name.trim()}|\${scorer.team || ''}\`;
                                const existing = scorerMap.get(key);
                                if (existing) {
                                    existing.goals += 1;
                                } else {
                                    scorerMap.set(key, {
                                        name: scorer.name.trim(),
                                        team: scorer.team || '',
                                        goals: 1
                                    });
                                }
                            }
                        });
                    }
                });
            };
            collectScorers(results.tournament);
            collectScorers(results.training);
            const scorerRanking = Array.from(scorerMap.values())
                .sort((a, b) => b.goals - a.goals);

            const exportData = {
                date: '2025年3月31日（月）',
                ranking: results.ranking.map((r, idx) => ({
                    rank: idx + 1,
                    team: r ? r.name : null,
                })),
                scorerRanking: scorerRanking,
                tournament: results.tournament.map(m => {
                    const homeTotal = (parseInt(m.homeScore1H) || 0) + (parseInt(m.homeScore2H) || 0);
                    const awayTotal = (parseInt(m.awayScore1H) || 0) + (parseInt(m.awayScore2H) || 0);
                    let score = \`\${homeTotal}-\${awayTotal}\`;
                    if (m.hasPK) {
                        score += \` (PK \${m.homePK || 0}-\${m.awayPK || 0})\`;
                    }

                    // 3位決定戦・決勝のチーム名を取得
                    let homeName = m.home ? m.home.name : m.homeSeed;
                    let awayName = m.away ? m.away.name : m.awaySeed;

                    if (m.id === '3rd' || m.id === 'final') {
                        const sf1 = results.tournament.find(x => x.id === 'sf1');
                        const sf2 = results.tournament.find(x => x.id === 'sf2');
                        if (m.id === '3rd') {
                            homeName = getLoser(sf1)?.name || 'SF1敗者';
                            awayName = getLoser(sf2)?.name || 'SF2敗者';
                        } else {
                            homeName = getWinner(sf1)?.name || 'SF1勝者';
                            awayName = getWinner(sf2)?.name || 'SF2勝者';
                        }
                    }

                    return {
                        type: m.type,
                        home: homeName,
                        away: awayName,
                        score: score,
                        scorers: m.scorers,
                    };
                }),
                training: results.training.map(m => {
                    const homeTotal = (parseInt(m.homeScore1H) || 0) + (parseInt(m.homeScore2H) || 0);
                    const awayTotal = (parseInt(m.awayScore1H) || 0) + (parseInt(m.awayScore2H) || 0);
                    let score = \`\${homeTotal}-\${awayTotal}\`;
                    if (m.hasPK) {
                        score += \` (PK \${m.homePK || 0}-\${m.awayPK || 0})\`;
                    }
                    return {
                        venue: m.venue,
                        kickoff: m.kickoff,
                        home: m.home ? m.home.name : '',
                        away: m.away ? m.away.name : '',
                        score: score,
                    };
                }),
                players: results.players.filter(p => p.name).map(p => ({
                    type: p.type === 'MVP' ? '最優秀選手' : '優秀選手',
                    name: p.name,
                    team: p.team,
                })),
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'final_results_for_pdf.json';
            a.click();

            alert('JSONファイルをダウンロードしました。\\n\\nPDF生成:\\npython generate_final_result_pdf.py final_results_for_pdf.json');
        }
    </script>
</body>
</html>`;

const filePath = path.join(__dirname, 'final_day_results.html');
fs.writeFileSync(filePath, htmlContent, 'utf8');
console.log('Updated final_day_results.html with:');
console.log('- Scorer ranking tab (Issue #1)');
console.log('- Seed badge display (Issue #4)');
console.log('- Input validation (Issue #3)');
console.log('- Player master integration (Issue #2)');
console.log('  - Reads "teams" property from JSON');
console.log('  - Player dropdown for scorers');
console.log('  - Player dropdown for award selection');
console.log('  - Free text input fallback');
