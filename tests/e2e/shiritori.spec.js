import { test, expect } from '@playwright/test';
import { SHIRITORI_AUDIO, SHIRITORI_COURSES } from '../../src/modules/data/ShiritoriWords.js';
test.beforeEach(async ({ page }) => {
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
});
const correctId = page => page.evaluate(() => {
  const game = window.gameApp.shiritoriGame;
  return game.course[game.chain.length].id;
});
async function fit(page) {
  expect(await page.evaluate(() => {
    const visible = document.querySelector('#shiritori-game-screen:not(.hidden)');
    const issues = [];
    for (const element of visible.querySelectorAll('*')) {
      if (!element.checkVisibility()) continue;
      const box = element.getBoundingClientRect();
      if (box.left < 0 || box.top < 0 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1) issues.push(element.id || element.className);
    }
    if (document.documentElement.scrollHeight > innerHeight) issues.push('scroll');
    return issues;
  })).toEqual([]);
}
const sampleCourseIndices = [0, SHIRITORI_COURSES.findIndex(course => course[0].id === 'inu')];
for (const [width, height] of [[320, 568], [1024, 768]]) {
  for (const courseIndex of sampleCourseIndices) {
    const course = SHIRITORI_COURSES[courseIndex];
    test(`ten words, one correct choice, retry and replay: course ${courseIndex} at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.evaluate(({index, total}) => {
        const random = Math.random;
        let first = true;
        Math.random = () => {
          if (first) { first = false; return (index + .5) / total; }
          return random();
        };
      }, {index: courseIndex, total: SHIRITORI_COURSES.length});
      await page.locator('#shiritori-start-btn').click();
      await expect(page.locator('#shiritori-current-name')).toHaveText(course[0].name);
      await expect(page.locator('#shiritori-progress')).toHaveAttribute('aria-valuenow', '1');
      await expect(page.locator('#shiritori-chain li')).toHaveCount(10);
      await fit(page);
      for (let i = 1; i < 10; i++) {
        const current = course[i - 1];
        await expect(page.locator('.shiritori-tail')).toHaveText(current.name.at(-1));
        await expect(page.locator('#shiritori-prompt')).toHaveText(`「${current.name.at(-1)}」から はじまるのは？`);
        const choices = page.locator('#shiritori-answers button');
        await expect(choices).toHaveCount(4);
        const names = await choices.locator('.animal-name').allTextContents();
        expect(names.filter(name => name[0] === current.name.at(-1))).toEqual([course[i].name]);
        expect(new Set(names).size).toBe(4);
        expect(names.every(name => !course.slice(0, i).some(word => word.name === name))).toBe(true);
        if (i === 1) {
          // Choose by ID so the incorrect option is independent of shuffle order.
          const id = await choices.evaluateAll((buttons, correct) => buttons.find(button => button.dataset.word !== correct).dataset.word, course[i].id);
          await page.locator(`[data-word="${id}"]`).click();
          await expect(page.locator('#shiritori-feedback-text')).toHaveText('おしい！もういっかい やってみよう！');
          await expect(page.locator('#shiritori-progress')).toHaveAttribute('aria-valuenow', '1');
          await page.locator(`[data-word="${course[i].id}"]`).click();
          await expect(page.locator('#shiritori-progress')).toHaveAttribute('aria-valuenow', '1');
          await page.clock.runFor(800);
        }
        await page.locator(`[data-word="${course[i].id}"]`).click();
        await expect(page.locator('#shiritori-feedback-text')).toHaveText('つながった！');
        await expect(page.locator('#shiritori-progress')).toHaveAttribute('aria-valuenow', String(i + 1));
        await expect(page.locator('#shiritori-chain .filled')).toHaveCount(i + 1);
        // The chosen picture cannot be counted twice during its feedback.
        await page.locator(`[data-word="${course[i].id}"]`).click();
        await expect(page.locator('#shiritori-chain .filled')).toHaveCount(i + 1);
        await fit(page);
        await page.clock.runFor(3000);
      }
      await expect(page.locator('#result-screen')).toBeVisible();
      await expect(page.locator('.completion-star')).toBeVisible();
      expect(await page.evaluate(() => window.gameApp.gameState.questionsAnswered)).toBe(9);
      await page.evaluate(() => { window.previousCourse = window.gameApp.shiritoriGame.course; });
      await page.locator('#replay-btn').click();
      expect(await page.evaluate(() => window.previousCourse === window.gameApp.shiritoriGame.course)).toBe(false);
      await expect(page.locator('#shiritori-game-screen')).toBeVisible();
      await expect(page.locator('#shiritori-progress')).toHaveAttribute('aria-valuenow', '1');
      await expect(page.locator('#shiritori-chain .filled')).toHaveCount(1);
      await fit(page);
    });
  }
}

test('leaving during a correct answer cancels its timer and all speech', async ({ page }) => {
  await page.locator('#shiritori-start-btn').click();
  await page.locator(`[data-word="${await correctId(page)}"]`).click();
  await page.locator('#shiritori-reset-btn').click();
  expect(await page.evaluate(() => window.playedAudio.every(audio => audio.paused))).toBe(true);
  await page.locator('#color-start-btn').click();
  await page.clock.runFor(5000);
  await expect(page.locator('#color-game-screen')).toBeVisible();
  expect(await page.evaluate(() => window.gameApp.gameState.questionsAnswered)).toBe(0);
  await page.locator('#color-reset-btn').click();
  await page.locator('#shiritori-start-btn').click();
  await expect(page.locator('#shiritori-progress')).toHaveAttribute('aria-valuenow', '1');
});

test('static voices are playable and the current word can be heard again with keyboard', async ({ page }) => {
  for (const line of SHIRITORI_AUDIO) {
    const response = await page.request.get(`/audio/${line.filename}`);
    expect(response.status(), line.filename).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(1000);
  }
  await page.locator('#shiritori-start-btn').click();
  await expect.poll(() => page.evaluate(() => {
    const audio = window.gameApp.audioManager.currentAudio;
    return audio && !audio.paused;
  })).toBe(true);
  const current = await page.evaluate(() => window.gameApp.shiritoriGame.chain[0]);
  await page.locator('#shiritori-current').focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => new URL(window.gameApp.audioManager.currentAudio.src).pathname)).toBe(`/audio/shiritori-word-${current.id}.mp3`);
  await page.evaluate(() => { window.replayedWord = window.gameApp.audioManager.currentAudio; });
  await expect.poll(() => page.evaluate(() => window.replayedWord.ended)).toBe(true);
  await page.clock.runFor(250);
  const soundPath = `/audio/shiritori-sound-${current.name.at(-1).codePointAt(0)}.mp3`;
  expect(await page.evaluate(() => new URL(window.gameApp.audioManager.currentAudio.src).pathname)).toBe(soundPath);
  await page.locator('#shiritori-reset-btn').click();
  expect(await page.evaluate(() => window.playedAudio.every(audio => audio.paused))).toBe(true);
  await page.clock.runFor(5000);
  expect(await page.evaluate(() => window.gameApp.audioManager.currentAudio)).toBeNull();
});
