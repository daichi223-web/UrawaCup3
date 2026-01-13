const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'final_day_results.html');
let content = fs.readFileSync(filePath, 'utf8');

// 旧コード
const oldSaveData = `function saveData() {
            localStorage.setItem('urawaCup_finalResults', JSON.stringify(results));
            alert('保存しました');
        }`;

const oldLoadData = `function loadSavedData() {
            const data = localStorage.getItem('urawaCup_finalResults');
            if (data) {
                results = JSON.parse(data);
                render();
                alert('読み込みました');
            } else {
                alert('保存データがありません');
            }
        }`;

// 新コード
const newSaveData = `function saveData() {
            const savePayload = {
                results: results,
                teamMaster: teamMaster,
                scheduleData: scheduleData
            };
            localStorage.setItem('urawaCup_finalResults', JSON.stringify(savePayload));
            alert('保存しました（選手マスタ含む）');
        }`;

const newLoadData = `function loadSavedData() {
            const data = localStorage.getItem('urawaCup_finalResults');
            if (data) {
                const parsed = JSON.parse(data);
                // 新形式（teamMaster含む）と旧形式（results のみ）の両方に対応
                if (parsed.results) {
                    results = parsed.results;
                    teamMaster = parsed.teamMaster || {};
                    scheduleData = parsed.scheduleData || null;
                } else {
                    // 旧形式: results のみ保存されていた場合
                    results = parsed;
                }
                updateMasterInfo();
                render();
                const masterCount = Object.keys(teamMaster).length;
                if (masterCount > 0) {
                    alert(\`読み込みました（選手マスタ: \${masterCount}チーム）\`);
                } else {
                    alert('読み込みました（選手マスタなし - JSONファイルを再読込してください）');
                }
            } else {
                alert('保存データがありません');
            }
        }`;

let updated = false;

if (content.includes(oldSaveData)) {
    content = content.replace(oldSaveData, newSaveData);
    console.log('Updated saveData()');
    updated = true;
}

if (content.includes(oldLoadData)) {
    content = content.replace(oldLoadData, newLoadData);
    console.log('Updated loadSavedData()');
    updated = true;
}

if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('File saved successfully');
} else {
    console.log('No changes needed or patterns not found');
}
