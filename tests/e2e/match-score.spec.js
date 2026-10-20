import { test, expect } from '@playwright/test';
for (const sharedScore of [0, 17]) {
  test(`matching all pairs preserves its internal score with shared score ${sharedScore}`, async ({ page }) => {
    await page.route('http://ubuntu-server-app:8526/**', route => route.abort());
    await page.goto('/');
    await page.locator('#match-start-btn').click();
    await page.evaluate(value => { window.gameApp.gameState.score = value; }, sharedScore);
    const cells = await page.evaluate(() => window.gameApp.matchGame.grid.flat().map(({x, y, value}) => ({x, y, value})));
    for (const value of new Set(cells.map(cell => cell.value))) {
      for (const cell of cells.filter(cell => cell.value === value)) {
        await page.locator(`.match-card[data-x="${cell.x}"][data-y="${cell.y}"]`).click();
      }
    }
    await expect(page.locator('#result-screen')).toBeVisible();
    expect(await page.evaluate(() => window.gameApp.matchGame.score)).toBe(80);
    await expect(page.locator('.completion-star')).toBeVisible();
    await expect(page.locator('#match-progress-text .complete')).toHaveCount(8);
  });
}
