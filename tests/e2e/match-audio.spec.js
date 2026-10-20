import { test, expect } from '@playwright/test';

const base = process.env.DEKITA_TEST_URL || 'http://127.0.0.1:8525';
const instruction = '/audio/match-instruction.mp3';
const correct = '/audio/correct.mp3';
const retry = '/audio/retry.mp3';
const complete = '/audio/game-over.mp3';

const card = (page, cell) => page.locator(`.match-card[data-x="${cell.x}"][data-y="${cell.y}"]`);
const voices = page => page.evaluate(() => window.audioEvents.filter(event => event.type === 'play' && event.path !== '/audio/pop.mp3').map(event => event.path));
const cells = page => page.evaluate(() => window.gameApp.matchGame.grid.flat().map(({ x, y, value }) => ({ x, y, value })));
async function playing(page, path) {
  await expect.poll(() => page.evaluate(() => {
    const audio = window.gameApp.audioManager.currentAudio;
    return audio && !audio.paused ? new URL(audio.src).pathname : null;
  })).toBe(path);
}

test.beforeEach(async ({ page }) => {
  await page.route('http://ubuntu-server-app:8526/**', route => route.abort());
  // Observe real media calls, retaining browser playback and its errors.
  await page.addInitScript(() => {
    window.audioEvents = [];
    for (const method of ['play', 'pause']) {
      const original = HTMLMediaElement.prototype[method];
      HTMLMediaElement.prototype[method] = function (...args) {
        window.audioEvents.push({ type: method, path: new URL(this.src).pathname });
        return original.apply(this, args);
      };
    }
  });
  await page.goto(base);
  await page.locator('#match-start-btn').click();
  await playing(page, instruction);
});

test('a pair speaks once; the last pair speaks only completion', async ({ page }) => {
  const all = await cells(page);
  const pairs = [...new Set(all.map(cell => cell.value))].map(value => all.filter(cell => cell.value === value));
  await card(page, pairs[0][0]).click();
  expect(await voices(page)).toEqual([instruction]);
  await card(page, pairs[0][1]).click();
  await playing(page, correct);
  expect(await voices(page)).toEqual([instruction, correct]);
  await card(page, pairs[0][1]).click();
  expect(await voices(page)).toEqual([instruction, correct]);
  for (const pair of pairs.slice(1)) for (const cell of pair) await card(page, cell).click();
  await expect(page.locator('#result-screen')).toBeVisible();
  await playing(page, complete);
  expect(await voices(page)).toEqual([instruction, ...Array(7).fill(correct), complete]);
});

test('a mismatch speaks once, ignores a third card, then allows retry', async ({ page }) => {
  const anchor = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time: anchor });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  const all = await cells(page);
  const first = all[0];
  const second = all.find(cell => cell.value !== first.value);
  const third = all.find(cell => cell !== first && cell !== second);
  await card(page, first).click();
  await card(page, second).click();
  await playing(page, retry);
  await card(page, third).click();
  await expect(page.locator('.match-card.revealed')).toHaveCount(2);
  expect(await voices(page)).toEqual([instruction, retry]);
  await page.clock.runFor(800);
  await expect(page.locator('.match-card.revealed')).toHaveCount(0);
  const mate = all.find(cell => cell.value === first.value && cell !== first);
  await card(page, first).click();
  await card(page, mate).click();
  await playing(page, correct);
  expect(await voices(page)).toEqual([instruction, retry, correct]);
  expect(await page.evaluate(() => window.audioEvents.some(event => event.type === 'pause' && event.path === '/audio/retry.mp3'))).toBe(true);
});

test('leaving cancels speech and a pending mismatch, including after restart', async ({ page }) => {
  const anchor = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time: anchor });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  const all = await cells(page);
  await card(page, all[0]).click();
  await card(page, all.find(cell => cell.value !== all[0].value)).click();
  await playing(page, retry);
  await page.locator('#match-reset-btn').click();
  expect(await page.evaluate(() => window.gameApp.audioManager.currentAudio)).toBeNull();
  await page.locator('#match-start-btn').click();
  const restarted = await cells(page);
  await card(page, restarted[0]).click();
  await page.clock.runFor(1000);
  await expect(card(page, restarted[0])).toHaveClass(/revealed/);
  expect(await page.evaluate(() => window.gameApp.matchGame.selectedCells.length)).toBe(1);
  expect(await voices(page)).toEqual([instruction, retry, instruction]);
  await page.locator('#match-reset-btn').click();
  await page.locator('#animal-start-btn').click();
  await expect.poll(() => voices(page)).toContain('/audio/sound-question.mp3');
  for (const path of [instruction, correct, retry, complete]) {
    const response = await page.request.get(base + path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('audio/');
  }
});
