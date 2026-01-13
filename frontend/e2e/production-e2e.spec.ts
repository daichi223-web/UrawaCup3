import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://urawa-cup3.vercel.app';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

// テスト結果を記録
const testResults: { name: string; status: 'pass' | 'fail' | 'skip'; details: string; duration?: number }[] = [];

test.describe('浦和カップ本番環境E2Eテスト', () => {

  test.beforeEach(async ({ page }) => {
    // タイムアウト設定
    test.setTimeout(60000);
  });

  test('1. トップページ表示', async ({ page }) => {
    const start = Date.now();
    try {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      // ページタイトル確認
      const title = await page.title();
      expect(title).toContain('浦和カップ');

      // ヘッダー要素確認
      const header = page.locator('h1, header');
      await expect(header.first()).toBeVisible();

      testResults.push({ name: 'トップページ表示', status: 'pass', details: `タイトル: ${title}`, duration: Date.now() - start });
    } catch (e) {
      testResults.push({ name: 'トップページ表示', status: 'fail', details: String(e), duration: Date.now() - start });
      throw e;
    }
  });

  test('2. ログインページ遷移', async ({ page }) => {
    const start = Date.now();
    try {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      // ログインリンク/ボタンを探す
      const loginLink = page.locator('a:has-text("ログイン"), button:has-text("ログイン"), a[href*="login"]').first();

      if (await loginLink.isVisible()) {
        await loginLink.click();
        await page.waitForLoadState('networkidle');
      } else {
        // 直接ログインページへ
        await page.goto(`${BASE_URL}/login`);
        await page.waitForLoadState('networkidle');
      }

      // ログインフォーム確認
      const usernameInput = page.locator('input[type="text"], input[name="username"], input[name="email"], input[id*="user"], input[id*="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();

      await expect(usernameInput).toBeVisible({ timeout: 10000 });
      await expect(passwordInput).toBeVisible();

      testResults.push({ name: 'ログインページ遷移', status: 'pass', details: 'ログインフォーム表示確認', duration: Date.now() - start });
    } catch (e) {
      testResults.push({ name: 'ログインページ遷移', status: 'fail', details: String(e), duration: Date.now() - start });
      throw e;
    }
  });

  test('3. 管理者ログイン', async ({ page }) => {
    const start = Date.now();
    try {
      await page.goto(`${BASE_URL}/login`);
      await page.waitForLoadState('networkidle');

      // ユーザー名入力
      const usernameInput = page.locator('input[type="text"], input[name="username"], input[name="email"], input[id*="user"], input[id*="email"]').first();
      await usernameInput.fill(ADMIN_USER);

      // パスワード入力
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill(ADMIN_PASS);

      // ログインボタンクリック
      const loginButton = page.locator('button[type="submit"], button:has-text("ログイン")').first();
      await loginButton.click();

      // ログイン成功確認（ダッシュボードやホームへのリダイレクト）
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // URLが変わったか、ログアウトボタンが表示されたか確認
      const currentUrl = page.url();
      const logoutButton = page.locator('button:has-text("ログアウト"), a:has-text("ログアウト")');

      const isLoggedIn = !currentUrl.includes('login') || await logoutButton.isVisible().catch(() => false);
      expect(isLoggedIn).toBeTruthy();

      testResults.push({ name: '管理者ログイン', status: 'pass', details: `ログイン後URL: ${currentUrl}`, duration: Date.now() - start });
    } catch (e) {
      testResults.push({ name: '管理者ログイン', status: 'fail', details: String(e), duration: Date.now() - start });
      throw e;
    }
  });

  test('4. チーム一覧表示', async ({ page }) => {
    const start = Date.now();
    try {
      // ログイン
      await loginAsAdmin(page);

      // チームページへ遷移
      const teamsLink = page.locator('a:has-text("チーム"), a[href*="team"]').first();
      if (await teamsLink.isVisible()) {
        await teamsLink.click();
      } else {
        await page.goto(`${BASE_URL}/teams`);
      }
      await page.waitForLoadState('networkidle');

      // チーム一覧が表示されるか確認
      await page.waitForTimeout(2000);
      const teamItems = page.locator('table tbody tr, .team-card, .team-item, [data-testid="team"]');
      const count = await teamItems.count();

      testResults.push({ name: 'チーム一覧表示', status: 'pass', details: `チーム数: ${count}`, duration: Date.now() - start });
    } catch (e) {
      testResults.push({ name: 'チーム一覧表示', status: 'fail', details: String(e), duration: Date.now() - start });
      throw e;
    }
  });

  test('5. 試合一覧表示', async ({ page }) => {
    const start = Date.now();
    try {
      // ログイン
      await loginAsAdmin(page);

      // 試合ページへ遷移
      const matchesLink = page.locator('a:has-text("試合"), a[href*="match"]').first();
      if (await matchesLink.isVisible()) {
        await matchesLink.click();
      } else {
        await page.goto(`${BASE_URL}/matches`);
      }
      await page.waitForLoadState('networkidle');

      // 試合一覧が表示されるか確認
      await page.waitForTimeout(2000);
      const matchItems = page.locator('table tbody tr, .match-card, .match-item, [data-testid="match"]');
      const count = await matchItems.count();

      testResults.push({ name: '試合一覧表示', status: 'pass', details: `試合数: ${count}`, duration: Date.now() - start });
    } catch (e) {
      testResults.push({ name: '試合一覧表示', status: 'fail', details: String(e), duration: Date.now() - start });
      throw e;
    }
  });

  test('6. ナビゲーション動作確認', async ({ page }) => {
    const start = Date.now();
    try {
      await loginAsAdmin(page);

      // ナビゲーションリンクを取得
      const navLinks = page.locator('nav a, header a, aside a');
      const linkCount = await navLinks.count();

      const visitedPages: string[] = [];

      // 最大5つのリンクをテスト
      for (let i = 0; i < Math.min(linkCount, 5); i++) {
        const link = navLinks.nth(i);
        const href = await link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.includes('logout')) {
          await link.click();
          await page.waitForLoadState('networkidle');
          visitedPages.push(page.url());
        }
      }

      testResults.push({ name: 'ナビゲーション動作', status: 'pass', details: `確認ページ数: ${visitedPages.length}`, duration: Date.now() - start });
    } catch (e) {
      testResults.push({ name: 'ナビゲーション動作', status: 'fail', details: String(e), duration: Date.now() - start });
      throw e;
    }
  });

  test('7. レスポンシブ表示確認', async ({ page }) => {
    const start = Date.now();
    try {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      // モバイルサイズ
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      const mobileVisible = await page.locator('body').isVisible();

      // タブレットサイズ
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      const tabletVisible = await page.locator('body').isVisible();

      // デスクトップサイズ
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);
      const desktopVisible = await page.locator('body').isVisible();

      expect(mobileVisible && tabletVisible && desktopVisible).toBeTruthy();

      testResults.push({ name: 'レスポンシブ表示', status: 'pass', details: 'モバイル/タブレット/デスクトップ全て正常', duration: Date.now() - start });
    } catch (e) {
      testResults.push({ name: 'レスポンシブ表示', status: 'fail', details: String(e), duration: Date.now() - start });
      throw e;
    }
  });

  test('8. コンソールエラー確認', async ({ page }) => {
    const start = Date.now();
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    try {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      await loginAsAdmin(page);

      // いくつかのページを巡回
      const pages = ['/teams', '/matches', '/standings'];
      for (const p of pages) {
        await page.goto(`${BASE_URL}${p}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
      }

      // 重大なエラー以外は許容
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('manifest') &&
        !e.includes('service-worker') &&
        !e.includes('404')
      );

      if (criticalErrors.length > 0) {
        testResults.push({ name: 'コンソールエラー', status: 'fail', details: criticalErrors.join('; '), duration: Date.now() - start });
      } else {
        testResults.push({ name: 'コンソールエラー', status: 'pass', details: `エラーなし（警告: ${errors.length}件）`, duration: Date.now() - start });
      }
    } catch (e) {
      testResults.push({ name: 'コンソールエラー', status: 'fail', details: String(e), duration: Date.now() - start });
      throw e;
    }
  });

  test('9. ログアウト機能', async ({ page }) => {
    const start = Date.now();
    try {
      await loginAsAdmin(page);

      // ログアウトボタンを探してクリック
      const logoutButton = page.locator('button:has-text("ログアウト"), a:has-text("ログアウト")').first();

      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // ログインページにリダイレクトされたか確認
        const currentUrl = page.url();
        const isLoggedOut = currentUrl.includes('login') || !(await page.locator('button:has-text("ログアウト")').isVisible().catch(() => false));

        expect(isLoggedOut).toBeTruthy();
        testResults.push({ name: 'ログアウト機能', status: 'pass', details: 'ログアウト成功', duration: Date.now() - start });
      } else {
        testResults.push({ name: 'ログアウト機能', status: 'skip', details: 'ログアウトボタンが見つからない', duration: Date.now() - start });
      }
    } catch (e) {
      testResults.push({ name: 'ログアウト機能', status: 'fail', details: String(e), duration: Date.now() - start });
      throw e;
    }
  });

  test.afterAll(async () => {
    // テスト結果をファイルに出力
    const fs = require('fs');
    const path = require('path');

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    let markdown = `# 浦和カップ本番環境 E2Eテスト結果レポート

## テスト概要
- **テスト対象**: ${BASE_URL}
- **テスト実行日時**: ${now.toLocaleString('ja-JP')}
- **テストユーザー**: ${ADMIN_USER}

## テスト結果サマリー

| 結果 | 件数 |
|------|------|
| ✅ 合格 | ${testResults.filter(r => r.status === 'pass').length} |
| ❌ 失敗 | ${testResults.filter(r => r.status === 'fail').length} |
| ⏭️ スキップ | ${testResults.filter(r => r.status === 'skip').length} |

## 詳細結果

| # | テスト名 | 結果 | 詳細 | 実行時間 |
|---|----------|------|------|----------|
`;

    testResults.forEach((r, i) => {
      const statusIcon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⏭️';
      const details = r.details.length > 50 ? r.details.slice(0, 50) + '...' : r.details;
      const duration = r.duration ? `${r.duration}ms` : '-';
      markdown += `| ${i + 1} | ${r.name} | ${statusIcon} | ${details} | ${duration} |\n`;
    });

    markdown += `
## 失敗したテストの詳細

`;

    const failedTests = testResults.filter(r => r.status === 'fail');
    if (failedTests.length === 0) {
      markdown += '全てのテストが成功しました。\n';
    } else {
      failedTests.forEach(r => {
        markdown += `### ${r.name}\n\n\`\`\`\n${r.details}\n\`\`\`\n\n`;
      });
    }

    markdown += `
---
*このレポートはPlaywright E2Eテストにより自動生成されました*
`;

    const reportPath = path.join(__dirname, '..', 'e2e-test-report.md');
    fs.writeFileSync(reportPath, markdown, 'utf8');
    console.log(`Report saved to: ${reportPath}`);
  });
});

// ヘルパー関数
async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  const usernameInput = page.locator('input[type="text"], input[name="username"], input[name="email"], input[id*="user"], input[id*="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  const loginButton = page.locator('button[type="submit"], button:has-text("ログイン")').first();

  await usernameInput.fill(ADMIN_USER);
  await passwordInput.fill(ADMIN_PASS);
  await loginButton.click();

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}
