import { test, expect } from '@playwright/test';

const base = process.env.DEKITA_TEST_URL || 'http://127.0.0.1:8525';

for (const [width, height] of [[320, 568], [1024, 768]]) {
  test(`silhouettes reveal only the correct picture and reset next round ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.route('http://ubuntu-server-app:8526/**', route => route.abort());
    await page.goto(base);
    await page.locator('#puzzle-start-btn').click();
    const shapes = page.locator('.puzzle-shape');
    await expect(shapes).toHaveCount(9);
    await expect(page.locator('#puzzle-drag-emoji')).toHaveCSS('filter', 'none');
    for (const shape of await shapes.all()) await expect(shape).toHaveCSS('filter', 'brightness(0)');
    const correct = await page.evaluate(() => window.gameApp.puzzleGame.correctIndex);
    await expect(shapes.nth(correct)).toHaveText(await page.locator('#puzzle-drag-emoji').textContent());
    const wrong = (correct + 1) % 9;
    await page.locator('.puzzle-silhouette').nth(wrong).click();
    await expect(shapes.nth(wrong)).toHaveCSS('filter', 'brightness(0)');
    await expect(page.locator('.puzzle-silhouette.revealed')).toHaveCount(0);
    await expect(page.locator('#puzzle-progress-text')).toHaveAttribute('aria-valuenow', '0');
    await page.clock.runFor(800);
    await page.screenshot({ path: `test-results/puzzle-silhouettes-${width}.png` });
    await page.locator('.puzzle-silhouette').nth(correct).click();
    await expect(shapes.nth(correct)).toHaveCSS('filter', 'none');
    await expect(page.locator('.puzzle-silhouette.revealed')).toHaveCount(1);
    await expect(page.locator('#puzzle-progress-text')).toHaveAttribute('aria-valuenow', '1');
    expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(20);
    for (let i = 0; i < 9; i++) if (i !== correct) await expect(shapes.nth(i)).toHaveCSS('filter', 'brightness(0)');
    await page.screenshot({ path: `test-results/puzzle-revealed-${width}.png` });
    await page.clock.runFor(2000);
    await expect(page.locator('#puzzle-progress-text')).toHaveAttribute('aria-valuenow', '1');
    await expect(page.locator('.puzzle-silhouette.revealed')).toHaveCount(0);
    for (const shape of await shapes.all()) await expect(shape).toHaveCSS('filter', 'brightness(0)');
  });
}
