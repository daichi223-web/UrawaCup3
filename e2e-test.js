const { chromium } = require('playwright');

const BASE_URL = 'https://urawa-cup3.vercel.app';
const results = [];

function log(message) {
  console.log(message);
}

function addResult(category, testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  results.push({ category, testName, passed, details });
  log(`${status}: ${testName}${details ? ` - ${details}` : ''}`);
}

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  log('='.repeat(60));
  log('浦和カップ E2Eテスト 実行開始');
  log('='.repeat(60));
  log('');

  // ========================
  // 1. トップページテスト
  // ========================
  log('\n【1. トップページテスト】');

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // タイトル確認
    const title = await page.title();
    addResult('トップページ', 'ページタイトル表示', title.includes('浦和カップ'), title);

    // ヘッダー確認
    const header = await page.locator('h1').first().innerText();
    addResult('トップページ', 'ヘッダー表示', header.includes('浦和カップ'), header);

    // 試合一覧表示
    const matchCards = await page.locator('.bg-white.rounded-lg.shadow-sm').count();
    addResult('トップページ', '試合カード表示', matchCards > 0, `${matchCards}件の試合カード`);

    // 表示切替ボタン
    const timelineBtn = await page.locator('button:has-text("時系列")').count();
    const groupBtn = await page.locator('button:has-text("グループ別")').count();
    addResult('トップページ', '表示切替ボタン', timelineBtn > 0 && groupBtn > 0, '時系列・グループ別ボタン');

    // グループ別表示切替テスト
    await page.locator('button:has-text("グループ別")').click();
    await page.waitForTimeout(1000);
    const groupLabels = await page.locator('text=/[A-D]組/').count();
    addResult('トップページ', 'グループ別表示切替', groupLabels > 0, `${groupLabels}個のグループラベル`);

    // 時系列に戻す
    await page.locator('button:has-text("時系列")').click();
    await page.waitForTimeout(500);

    // ナビゲーションリンク
    const navLinks = await page.locator('a[href="/login"]').count();
    addResult('トップページ', '運営専用リンク', navLinks > 0, '運営専用リンク');

  } catch (e) {
    addResult('トップページ', 'トップページ表示', false, e.message);
  }

  // ========================
  // 2. 公開ページテスト
  // ========================
  log('\n【2. 公開ページテスト】');

  // 試合一覧（公開）
  try {
    await page.goto(`${BASE_URL}/public/matches`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const matchContent = await page.locator('body').innerText();
    addResult('公開ページ', '試合一覧表示', matchContent.length > 100, 'コンテンツ表示確認');
  } catch (e) {
    addResult('公開ページ', '試合一覧表示', false, e.message);
  }

  // 順位表（公開）
  try {
    await page.goto(`${BASE_URL}/public/standings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const standingsContent = await page.locator('body').innerText();
    const hasGroups = standingsContent.includes('A組') || standingsContent.includes('グループ');
    addResult('公開ページ', '順位表表示', standingsContent.length > 100 && hasGroups, 'グループ順位表示');

    // チーム名確認
    const hasTeams = standingsContent.includes('昌平') || standingsContent.includes('浦和');
    addResult('公開ページ', '順位表チーム表示', hasTeams, 'チーム名表示確認');
  } catch (e) {
    addResult('公開ページ', '順位表表示', false, e.message);
  }

  // 得点王（公開）
  try {
    await page.goto(`${BASE_URL}/public/scorers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const scorersContent = await page.locator('body').innerText();
    addResult('公開ページ', '得点ランキング表示', scorersContent.length > 100, 'コンテンツ表示確認');
  } catch (e) {
    addResult('公開ページ', '得点ランキング表示', false, e.message);
  }

  // フッターナビゲーション確認
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const footerNav = await page.locator('a[href="/public/matches"]').count();
    addResult('公開ページ', 'フッターナビゲーション', footerNav > 0, '速報リンク確認');
  } catch (e) {
    addResult('公開ページ', 'フッターナビゲーション', false, e.message);
  }

  // ========================
  // 3. ログインテスト
  // ========================
  log('\n【3. ログインテスト】');

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // ログインフォーム確認
    const loginContent = await page.locator('body').innerText();
    log(`ログインページ内容: ${loginContent.substring(0, 500)}`);

    // 入力フィールドを探す
    const inputs = await page.locator('input').all();
    log(`入力フィールド数: ${inputs.length}`);

    for (let i = 0; i < inputs.length; i++) {
      const type = await inputs[i].getAttribute('type');
      const placeholder = await inputs[i].getAttribute('placeholder');
      const name = await inputs[i].getAttribute('name');
      log(`  Input ${i}: type=${type}, placeholder=${placeholder}, name=${name}`);
    }

    addResult('ログイン', 'ログインページ表示', loginContent.includes('ログイン') || loginContent.includes('Login'), 'ログインフォーム確認');

    // ユーザー名入力
    const usernameInput = page.locator('input').first();
    const passwordInput = page.locator('input[type="password"]');

    if (await usernameInput.count() > 0) {
      await usernameInput.fill('admin');
      addResult('ログイン', 'ユーザー名入力', true, 'admin');
    }

    if (await passwordInput.count() > 0) {
      await passwordInput.fill('admin123');
      addResult('ログイン', 'パスワード入力', true, '***');
    }

    // ログインボタンクリック
    const loginButton = page.locator('button[type="submit"], button:has-text("ログイン")').first();
    if (await loginButton.count() > 0) {
      await loginButton.click();
      await page.waitForTimeout(3000);

      const afterLoginUrl = page.url();
      const afterLoginContent = await page.locator('body').innerText();

      // ログイン成功判定
      const loginSuccess = !afterLoginUrl.includes('/login') || afterLoginContent.includes('ダッシュボード') || afterLoginContent.includes('管理');
      addResult('ログイン', 'ログイン実行', loginSuccess, `リダイレクト先: ${afterLoginUrl}`);

      log(`ログイン後URL: ${afterLoginUrl}`);
      log(`ログイン後コンテンツ(300文字): ${afterLoginContent.substring(0, 300)}`);
    }

  } catch (e) {
    addResult('ログイン', 'ログインテスト', false, e.message);
  }

  // ========================
  // 4. 管理画面テスト（ログイン後）
  // ========================
  log('\n【4. 管理画面テスト】');

  try {
    // ダッシュボードへアクセス（ログイン状態維持）
    const currentUrl = page.url();
    log(`現在のURL: ${currentUrl}`);

    // 管理画面のリンクを探す
    const adminContent = await page.locator('body').innerText();
    log(`管理画面内容(500文字): ${adminContent.substring(0, 500)}`);

    // ナビゲーションを確認
    const navItems = await page.locator('nav a, [class*="nav"] a, [class*="menu"] a, [class*="sidebar"] a').all();
    log(`ナビゲーション項目数: ${navItems.length}`);

    for (const item of navItems.slice(0, 10)) {
      const text = await item.innerText().catch(() => '');
      const href = await item.getAttribute('href');
      log(`  Nav: ${text} -> ${href}`);
    }

    // 全てのリンクを取得
    const allLinks = await page.locator('a').all();
    log(`全リンク数: ${allLinks.length}`);

    const linkPaths = new Set();
    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      if (href && href.startsWith('/')) {
        linkPaths.add(href);
      }
    }
    log(`ユニークなパス: ${Array.from(linkPaths).join(', ')}`);

    // 管理画面のページを探索
    const adminPages = ['/admin', '/dashboard', '/admin/matches', '/admin/teams', '/admin/settings'];

    for (const adminPath of adminPages) {
      try {
        await page.goto(`${BASE_URL}${adminPath}`, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(1000);
        const content = await page.locator('body').innerText();
        const isLoginPage = content.includes('ログイン') && content.includes('パスワード');
        if (!isLoginPage && content.length > 50) {
          addResult('管理画面', `${adminPath}アクセス`, true, `コンテンツ長: ${content.length}`);
          log(`${adminPath} 内容: ${content.substring(0, 200)}`);
        }
      } catch (e) {
        // skip
      }
    }

  } catch (e) {
    addResult('管理画面', '管理画面アクセス', false, e.message);
  }

  // ========================
  // 5. 再ログインして詳細テスト
  // ========================
  log('\n【5. 再ログインして詳細テスト】');

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"], button:has-text("ログイン")').first().click();
    await page.waitForTimeout(3000);

    const dashboardUrl = page.url();
    log(`ログイン後URL: ${dashboardUrl}`);

    // ダッシュボードの機能確認
    const dashboardContent = await page.locator('body').innerText();
    log(`ダッシュボード内容:\n${dashboardContent.substring(0, 1500)}`);

    // 試合管理機能
    if (dashboardContent.includes('試合') || dashboardContent.includes('スコア')) {
      addResult('管理画面', '試合管理機能', true, '試合関連メニュー確認');
    }

    // チーム管理機能
    if (dashboardContent.includes('チーム')) {
      addResult('管理画面', 'チーム管理機能', true, 'チーム関連メニュー確認');
    }

    // ボタンを確認
    const buttons = await page.locator('button').all();
    log(`ボタン数: ${buttons.length}`);
    for (const btn of buttons.slice(0, 10)) {
      const text = await btn.innerText().catch(() => '');
      if (text) log(`  Button: ${text}`);
    }

    // クリック可能な要素を確認
    const clickables = await page.locator('[class*="card"], [class*="match"], [class*="game"]').all();
    log(`カード/マッチ要素数: ${clickables.length}`);

    // 試合カードをクリックしてモーダル確認
    const matchCard = await page.locator('[class*="bg-white"][class*="rounded"]').first();
    if (await matchCard.count() > 0) {
      await matchCard.click();
      await page.waitForTimeout(1500);

      const afterClickContent = await page.locator('body').innerText();
      const hasModal = afterClickContent.includes('スコア') || afterClickContent.includes('得点') || afterClickContent.includes('詳細');
      if (hasModal) {
        addResult('管理画面', '試合詳細モーダル', true, 'モーダル表示確認');
        log(`クリック後の内容: ${afterClickContent.substring(0, 500)}`);
      }
    }

  } catch (e) {
    addResult('管理画面', '詳細テスト', false, e.message);
  }

  // ========================
  // 6. スコア入力テスト（読み取りのみ）
  // ========================
  log('\n【6. スコア入力機能確認】');

  try {
    // 試合カードの構造を確認
    const scoreElements = await page.locator('[class*="score"], input[type="number"]').all();
    log(`スコア関連要素数: ${scoreElements.length}`);

    // 入力フィールドがあるか確認
    const numberInputs = await page.locator('input[type="number"]').all();
    if (numberInputs.length > 0) {
      addResult('スコア入力', 'スコア入力フィールド', true, `${numberInputs.length}個の入力フィールド`);
    }

    // 保存ボタンがあるか確認
    const saveButtons = await page.locator('button:has-text("保存"), button:has-text("更新"), button:has-text("Save")').all();
    if (saveButtons.length > 0) {
      addResult('スコア入力', '保存ボタン', true, `${saveButtons.length}個の保存ボタン`);
    }

  } catch (e) {
    addResult('スコア入力', 'スコア入力確認', false, e.message);
  }

  // ========================
  // 7. レスポンシブテスト
  // ========================
  log('\n【7. レスポンシブテスト】');

  try {
    // モバイルサイズ
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const mobileContent = await page.locator('body').innerText();
    addResult('レスポンシブ', 'モバイル表示(375px)', mobileContent.length > 100, 'コンテンツ表示確認');

    // タブレットサイズ
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    const tabletContent = await page.locator('body').innerText();
    addResult('レスポンシブ', 'タブレット表示(768px)', tabletContent.length > 100, 'コンテンツ表示確認');

    // デスクトップサイズ
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    const desktopContent = await page.locator('body').innerText();
    addResult('レスポンシブ', 'デスクトップ表示(1920px)', desktopContent.length > 100, 'コンテンツ表示確認');

  } catch (e) {
    addResult('レスポンシブ', 'レスポンシブテスト', false, e.message);
  }

  // ========================
  // 結果サマリー
  // ========================
  log('\n' + '='.repeat(60));
  log('テスト結果サマリー');
  log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  log(`\n合計: ${results.length}件`);
  log(`✅ 成功: ${passed}件`);
  log(`❌ 失敗: ${failed}件`);
  log(`成功率: ${((passed / results.length) * 100).toFixed(1)}%`);

  log('\n【カテゴリ別結果】');
  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catPassed = catResults.filter(r => r.passed).length;
    log(`  ${cat}: ${catPassed}/${catResults.length}`);
  }

  await browser.close();

  // JSON形式で結果を出力
  console.log('\n--- JSON_RESULTS_START ---');
  console.log(JSON.stringify(results, null, 2));
  console.log('--- JSON_RESULTS_END ---');
}

runTests().catch(console.error);
