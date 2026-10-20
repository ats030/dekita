import { test, expect } from '@playwright/test';
const games = [
  ['countGame', 'start-btn', 'game-screen', 10],
  ['colorGame', 'color-start-btn', 'color-game-screen', 10],
  ['animalGame', 'animal-start-btn', 'animal-game-screen', 8],
  ['mazeGame', 'maze-start-btn', 'maze-play-screen', 5],
  ['matchGame', 'match-start-btn', 'match-game-screen', null],
  ['puzzleGame', 'puzzle-start-btn', 'puzzle-game-screen', 5],
  ['shiritoriGame', 'shiritori-start-btn', 'shiritori-game-screen', 9],
  ['blockGame', 'block-start-btn', 'block-game-screen', 5],
];
for (const [width, height] of [[320, 568], [1024, 768]]) {
  for (const [game, start, screen, total] of games) {
    test(`${game} completion replays itself and returns to all games ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.clock.install({ time: new Date('2026-01-01') });
      await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
      await page.route('http://ubuntu-server-app:8526/**', route => route.abort());
      await page.addInitScript(() => {
        window.playedAudio = [];
        const original = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function (...args) {
          window.playedAudio.push(this);
          return original.apply(this, args);
        };
      });
      await page.goto('/');
      // Finish a different game first to exercise shared state and replay history.
      await page.locator('#puzzle-start-btn').click();
      await page.evaluate(() => window.gameApp.puzzleGame.endGame());
      await page.locator('#result-home-btn').click();
      await page.locator(`#${start}`).click();
      await page.evaluate(game => {
        const app = window.gameApp;
        app.gameState.score = 30;
        app.gameState.questionsAnswered = app.gameState.questionsTotal;
        if (game === 'matchGame') app.matchGame.score = 80;
        app[game].endGame();
      }, game);
      await expect(page.locator('#result-screen')).toBeVisible();
      await expect(page.locator('.completion-star')).toBeVisible();
      await expect(page.locator('#final-score')).toHaveCount(0);
      for (const id of ['replay-btn', 'result-home-btn']) {
        const box = await page.locator(`#${id}`).boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(48);
        expect(box.height).toBeGreaterThanOrEqual(48);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      await page.evaluate(() => { window.completionAudio = [...window.playedAudio]; });
      await page.locator('#replay-btn').click();
      expect(await page.evaluate(() => window.completionAudio.every(audio => audio.paused))).toBe(true);
      await expect(page.locator(`#${screen}`)).toBeVisible();
      await expect(page.locator(`#${screen} .progress-dots`)).toHaveAttribute('aria-valuenow', game === 'shiritoriGame' ? '1' : '0');
      await expect(page.locator(`#${screen} .progress-dot`)).toHaveCount(game === 'shiritoriGame' ? 10 : (total ?? 8));
      if (total !== null) {
        expect(await page.evaluate(() => [window.gameApp.gameState.score, window.gameApp.gameState.questionsAnswered, window.gameApp.gameState.questionsTotal])).toEqual([0, 0, total]);
      } else {
        expect(await page.evaluate(() => window.gameApp.matchGame.score)).toBe(0);
        await expect(page.locator('#match-progress-text')).toHaveAttribute('aria-valuenow', '0');
      }
      await page.evaluate(game => window.gameApp[game].endGame(), game);
      await page.locator('#result-home-btn').click();
      expect(await page.evaluate(() => window.playedAudio.every(audio => audio.paused))).toBe(true);
      await page.clock.runFor(5000);
      await expect(page.locator('#title-screen')).toBeVisible();
      for (const [, button] of games) await expect(page.locator(`#${button}`)).toBeVisible();
      expect(await page.evaluate(() => window.gameApp.audioManager.currentAudio)).toBeNull();
    });
  }
}
