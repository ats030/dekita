import { test, expect } from '@playwright/test';

const games = [
  ['start-btn', 'game-screen', 4],
  ['color-start-btn', 'color-game-screen', 6],
  ['animal-start-btn', 'animal-game-screen', 4],
  ['maze-start-btn', 'maze-play-screen'],
  ['match-start-btn', 'match-game-screen', 16],
  ['puzzle-start-btn', 'puzzle-game-screen', 9],
  ['shiritori-start-btn', 'shiritori-game-screen', 4],
  ['block-start-btn', 'block-game-screen'],
];

async function checkFit(page) {
  const problems = await page.evaluate(() => {
    const problems = [];
    const width = innerWidth, height = innerHeight;
    for (const element of document.querySelectorAll('header, .screen:not(.hidden), .screen:not(.hidden) *')) {
      if (!element.checkVisibility()) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const name = element.id || element.className || element.tagName;
      if (rect.left < -1 || rect.top < -1 || rect.right > width + 1 || rect.bottom > height + 1) problems.push(`${name}: outside viewport`);
      if (element.matches('button, canvas, .picture-item, .feedback-text')) {
        const area = element.closest('.question-area, .feedback-area');
        if (area) {
          const bounds = area.getBoundingClientRect();
          if (rect.left < bounds.left - 1 || rect.top < bounds.top - 1 || rect.right > bounds.right + 1 || rect.bottom > bounds.bottom + 1) problems.push(`${name}: outside its play/feedback area`);
        }
      }
      if (element instanceof HTMLButtonElement) {
        if (rect.width < 48 || rect.height < 48) problems.push(`${name}: small tap target ${rect.width}×${rect.height}`);
        if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) problems.push(`${name}: clipped content`);
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        if (!element.contains(hit)) problems.push(`${name}: tap target covered`);
      }
    }
    const pictureArea = document.getElementById('picture-area');
    if (pictureArea.checkVisibility()) {
      const bounds = pictureArea.getBoundingClientRect();
      const pictures = [...pictureArea.children].map(item => item.getBoundingClientRect());
      for (const [index, rect] of pictures.entries()) {
        if (rect.left < bounds.left - .1 || rect.top < bounds.top - .1 || rect.right > bounds.right + .1 || rect.bottom > bounds.bottom + .1) problems.push('picture outside counting area');
        if (Math.abs(rect.width - pictures[0].width) > .1 || Math.abs(rect.height - pictures[0].height) > .1) problems.push('unequal picture sizes');
        for (const other of pictures.slice(index + 1)) {
          if (rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top) problems.push('overlapping pictures');
        }
      }
    }
    for (const root of [document.documentElement, document.body]) {
      if (root.scrollHeight > height + 1 || root.scrollWidth > width + 1) problems.push(`${root.tagName}: scroll required`);
    }
    const screen = document.querySelector('.screen:not(.hidden)');
    const feedback = screen.querySelector('.feedback-area');
    if (feedback?.checkVisibility()) {
      const feedbackRect = feedback.getBoundingClientRect();
      for (const area of screen.querySelectorAll('.question-area, .puzzle-emoji-area')) {
        const rect = area.getBoundingClientRect();
        if (rect.bottom > feedbackRect.top + 1) problems.push('feedback overlaps play area');
      }
    }
    return problems;
  });
  expect(problems).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route('http://ubuntu-server-app:8526/**', route => route.abort());
});

for (const [width, height] of [[320, 568], [375, 667], [390, 600], [414, 736], [768, 600], [1024, 600], [1024, 768], [1280, 800]]) {
  test(`all screens and feedback fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await checkFit(page);
    await expect(page.locator('.mode-buttons button')).toHaveCount(9);
    if (width === 375 || (width === 1024 && height === 768)) await page.screenshot({ path: `test-results/layout-${width}-home.png` });
    for (const [button, screen, count] of games) {
      await page.goto('/');
      await page.locator(`#${button}`).click();
      await expect(page.locator(`#${screen}`)).toBeVisible();
      if (count) await expect(page.locator(`#${screen} .answer-btn, #${screen} .match-card, #${screen} .puzzle-silhouette`)).toHaveCount(count);
      if (screen === 'block-game-screen') await page.evaluate(() => {
        const game = window.gameApp.blockGame;
        game.state.questionsAnswered = 2;
        game.beginRound();
      });
      // Exercise the largest counting question, not a random smaller sample.
      if (screen === 'game-screen') await page.evaluate(() => window.gameApp.countGame.generateQuestionForNumber(10));
      await checkFit(page);
      if (screen === 'shiritori-game-screen') {
        const play = await page.locator('.shiritori-question-area').boundingBox();
        const answers = await page.locator('#shiritori-answers').boundingBox();
        const columns = width >= 700 && width > height ? 2 : 1;
        expect(answers.width).toBeGreaterThan((play.width / columns) * .85);
      }
      if (screen === 'block-game-screen') {
        const play = await page.locator('.block-play').boundingBox();
        const board = await page.locator('#block-board').boundingBox();
        expect(board.width).toBeGreaterThan(Math.min(play.width, play.height) * .6);
        // All rotated shapes and their labels must remain inside the tray cards.
        for (let turn = 0; turn < 4; turn++) {
          expect(await page.locator('#block-tray .block-piece').evaluateAll(buttons => buttons.flatMap(button => {
            const bounds = button.getBoundingClientRect();
            return [...button.querySelectorAll('.preview-tile'), button.lastElementChild].filter(item => {
              const box = item.getBoundingClientRect();
              return box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom;
            }).map(() => 'piece content outside card');
          }))).toEqual([]);
          for (const piece of await page.locator('#block-tray .block-piece').all()) await piece.click();
        }
      }
      if (width === 375 || (width === 1024 && height === 768)) await page.screenshot({ path: `test-results/layout-${width}-${screen}.png` });
      if (screen === 'maze-play-screen') {
        await page.evaluate(() => window.gameApp.mazeGame.failMaze());
      } else if (screen === 'match-game-screen') {
        // Finish by tapping every actual pair.
        const pairs = await page.evaluate(() => {
          const pairs = {};
          for (const row of window.gameApp.matchGame.grid) for (const cell of row) (pairs[cell.value] ||= []).push([cell.x, cell.y]);
          return Object.values(pairs);
        });
        for (const pair of pairs) for (const [x, y] of pair) await page.locator(`.match-card[data-x="${x}"][data-y="${y}"]`).click();
        await expect(page.locator('#result-screen')).toBeVisible();
      } else if (screen === 'block-game-screen') {
        await page.locator('#block-tray .block-piece').first().click();
        const box = await page.locator('#block-tray .block-piece').first().boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
        await page.mouse.down(); await page.mouse.move(5,5,{steps:5}); await page.mouse.up();
      } else if (screen === 'puzzle-game-screen') {
        const index = await page.evaluate(() => window.gameApp.puzzleGame.correctIndex);
        await page.locator('.puzzle-silhouette').nth(index).click();
      } else {
        await page.locator(`#${screen} .answer-btn`).first().click();
      }
      if (screen !== 'match-game-screen') await expect(page.locator(`#${screen} .feedback-area`)).toBeVisible();
      if (width === 320 && screen === 'maze-play-screen') await page.screenshot({ path: 'test-results/maze-feedback-320.png' });
      await checkFit(page);
    }
    await page.evaluate(() => window.gameApp.screenManager.showResult());
    await checkFit(page);
    expect(errors).toEqual([]);
  });
}

test('feedback repeats on the right screen without moving answers', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.install();
  for (const [button, screen] of games.slice(0, 3)) {
    await page.goto('/');
    await page.locator(`#${button}`).click();
    const answers = page.locator(`#${screen} .answer-buttons`);
    const bounds = await answers.boundingBox();
    await answers.locator('button').first().click();
    const feedback = page.locator(`#${screen} .feedback-area`);
    await expect(feedback).toBeVisible();
    expect(await answers.boundingBox()).toEqual(bounds);
    await checkFit(page);
    await page.clock.runFor(3400);
    await expect(feedback).toBeHidden();
    await answers.locator('button').first().click();
    await expect(feedback).toBeVisible();
    expect(await answers.boundingBox()).toEqual(bounds);
    await checkFit(page);
  }
});

test('layout adapts during a game and sound replay is keyboard accessible', async ({ page }) => {
  await page.goto('/');
  await page.locator('#animal-start-btn').click();
  for (const viewport of [{ width: 375, height: 667 }, { width: 1024, height: 768 }, { width: 375, height: 600 }]) {
    await page.setViewportSize(viewport);
    await checkFit(page);
  }
  const replay = page.getByRole('button', { name: 'もういちど きく' });
  await replay.focus();
  await expect(replay).toBeFocused();
  await replay.press('Enter');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await replay.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
});


test('number questions cover 1–10 with four distinct valid choices', async ({ page }) => {
  await page.goto('/');
  await page.locator('#start-btn').click();
  const questions = await page.evaluate(() => {
    const game = window.gameApp.countGame;
    const originalRandom = Math.random;
    const results = [];
    try {
      // Force both ends of the generator range; avoid stubbing the answer
      // generation loop, which needs fresh random values to avoid duplicates.
      for (const count of Array.from({ length: 10 }, (_, i) => i + 1)) {
        let calls = 0;
        Math.random = () => ++calls === 2 ? (count - .5) / 10 : originalRandom();
        game.generateQuestion();
        results.push({
          count: game.state.currentAnswer,
          pictures: document.querySelectorAll('#picture-area .picture-item').length,
          choices: [...document.querySelectorAll('#answer-buttons button')].map(button => Number(button.textContent)),
        });
      }
    } finally {
      Math.random = originalRandom;
    }
    return results;
  });
  for (let i = 0; i < 10; i++) {
    const question = questions[i];
    expect(question.count).toBe(i + 1);
    expect(question.pictures).toBe(i + 1);
    expect(question.choices).toHaveLength(4);
    expect(new Set(question.choices).size).toBe(4);
    expect(question.choices).toContain(i + 1);
    expect(question.choices.every(value => value >= 1 && value <= 10)).toBe(true);
  }
  await page.getByRole('button', { name: '10', exact: true }).click();
  await expect(page.locator('#feedback-text')).toHaveText('やったー！');
  await expect(page.locator('#progress-text')).toHaveAttribute('aria-valuenow', '1');
  expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(10);
});


test('random pictures stay still while answering and fit after resize', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.locator('#start-btn').click();
  const positions = () => page.locator('#picture-area .picture-item').evaluateAll(items => items.map(item => ({ left: item.style.left, top: item.style.top, size: getComputedStyle(item).fontSize })));
  let previous;
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 600 }, { width: 414, height: 736 }, { width: 768, height: 600 }, { width: 1024, height: 600 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.clock.runFor(50);
    for (let count = 1; count <= 10; count++) {
      await page.evaluate(count => window.gameApp.countGame.generateQuestionForNumber(count), count);
      await page.clock.runFor(50);
      await expect(page.locator('#picture-area .picture-item')).toHaveCount(count);
      await checkFit(page);
    }
    previous = await positions();
    await page.getByRole('button', { name: '10', exact: true }).click();
    await page.clock.runFor(500);
    expect(await positions()).toEqual(previous);
    await checkFit(page);
    await page.clock.runFor(1600);
  }
  await page.setViewportSize({ width: 375, height: 667 });
  for (let round = 0; round < 8; round++) {
    await page.evaluate(() => window.gameApp.countGame.generateQuestionForNumber(10));
    await page.clock.runFor(50);
    const current = await positions();
    expect(current).not.toEqual(previous);
    await checkFit(page);
    previous = current;
  }
  for (const viewport of [{ width: 320, height: 568 }, { width: 1024, height: 768 }, { width: 375, height: 600 }]) {
    await page.setViewportSize(viewport);
    await page.clock.runFor(50);
    await expect.poll(() => page.evaluate(() => {
      const area = document.getElementById('picture-area').getBoundingClientRect();
      const game = window.gameApp.countGame;
      return area.width === game.pictureWidth && area.height === game.pictureHeight;
    })).toBe(true);
    await checkFit(page);
    await expect(page.locator('#picture-area .picture-item')).toHaveCount(10);
  }
});

for (const [width, height] of [[667, 375], [844, 390]]) {
  test(`word and block play surfaces fit short landscape ${width}×${height}`, async ({page}) => {
    await page.setViewportSize({width,height});
    for (const game of ['shiritori', 'block']) {
      await page.goto('/');
      await page.locator(`#${game}-start-btn`).click();
      if (game === 'block') await page.evaluate(() => {
        const g=window.gameApp.blockGame;g.state.questionsAnswered=2;g.beginRound();
      });
      await checkFit(page);
      const control=page.locator(game==='block' ? '#block-board .block-cell' : '#shiritori-answers button').first();
      const box=await control.boundingBox();
      await control.click();
      await checkFit(page);
      await expect(control).toHaveCSS('min-height', '48px');
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
  });
}
