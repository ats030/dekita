import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.route('http://ubuntu-server-app:8526/**', route => route.abort());
  await page.goto('/');
});
async function progress(page, screen, completed, total) {
  const indicator = page.locator(`#${screen} .progress-dots`);
  await expect(indicator).toHaveAttribute('role', 'progressbar');
  await expect(indicator).toHaveAttribute('aria-valuenow', String(completed));
  await expect(indicator).toHaveAttribute('aria-valuemax', String(total));
  await expect(indicator.locator('.progress-dot')).toHaveCount(total);
  await expect(indicator.locator('.complete')).toHaveCount(completed);
  await expect(indicator).toHaveText('');
}
for (const [start, screen, answers, total] of [
  ['start-btn', 'game-screen', 'answer-buttons', 10],
  ['color-start-btn', 'color-game-screen', 'color-answer-buttons', 10],
  ['animal-start-btn', 'animal-game-screen', 'animal-answer-buttons', 8],
]) {
  test(`${screen}: every answer fills one dot and replay resets all dots`, async ({ page }) => {
    await page.locator(`#${start}`).click();
    await progress(page, screen, 0, total);
    for (let i = 0; i < total; i++) {
      if (screen === 'game-screen') {
        const answer = await page.evaluate(() => window.gameApp.gameState.currentAnswer);
        const buttons = page.locator(`#${answers} button`);
        if (i === 0) {
          const values = await buttons.allTextContents();
          await buttons.nth(values.findIndex(value => Number(value) !== answer)).click();
          expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(0);
        } else await page.getByRole('button', { name: String(answer), exact: true }).click();
      } else await page.locator(`#${answers} button`).first().click();
      await progress(page, screen, i + 1, total);
      // Repeated answers during feedback must not add progress.
      await page.locator(`#${answers} button`).first().click();
      await progress(page, screen, i + 1, total);
      await page.clock.runFor(3300);
      if (i + 1 < total) await progress(page, screen, i + 1, total);
    }
    await expect(page.locator('#result-screen')).toBeVisible();
    await expect(page.locator('.completion-star')).toBeVisible();
    await expect(page.locator('#result-screen')).not.toContainText('とくてん');
    await page.locator('#replay-btn').click();
    await progress(page, screen, 0, total);
  });
}
test('silhouettes: a wrong choice stays on the same dot; each solved round fills one', async ({ page }) => {
  await page.locator('#puzzle-start-btn').click();
  for (let i = 0; i < 5; i++) {
    await progress(page, 'puzzle-game-screen', i, 5);
    const correct = await page.evaluate(() => window.gameApp.puzzleGame.correctIndex);
    await page.locator('.puzzle-silhouette').nth((correct + 1) % 9).click();
    await progress(page, 'puzzle-game-screen', i, 5);
    await page.locator('.puzzle-silhouette').nth(correct).click();
    await progress(page, 'puzzle-game-screen', i + 1, 5);
    await page.clock.runFor(2000);
  }
  await expect(page.locator('.completion-star')).toBeVisible();
});
test('matching: mismatch does not advance; each pair fills exactly one dot', async ({ page }) => {
  await page.locator('#match-start-btn').click();
  const cells = await page.evaluate(() => window.gameApp.matchGame.grid.flat().map(({x,y,value}) => ({x,y,value})));
  const card = cell => page.locator(`.match-card[data-x="${cell.x}"][data-y="${cell.y}"]`);
  await card(cells[0]).click();
  await card(cells.find(cell => cell.value !== cells[0].value)).click();
  await progress(page, 'match-game-screen', 0, 8);
  await page.clock.runFor(800);
  let done = 0;
  for (const value of new Set(cells.map(cell => cell.value))) {
    for (const cell of cells.filter(cell => cell.value === value)) await card(cell).click();
    await progress(page, 'match-game-screen', ++done, 8);
  }
  await expect(page.locator('.completion-star')).toBeVisible();
});
