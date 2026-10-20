import { test, expect } from '@playwright/test';

const base = process.env.DEKITA_TEST_URL || 'http://127.0.0.1:8525';
test.use({ hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.route('http://ubuntu-server-app:8526/**', route => route.abort());
  await page.goto(base);
  await page.locator('#maze-start-btn').click();
});

async function gesture(page, input, points) {
  const coords = await page.locator('#maze-canvas').evaluate((canvas, points) => {
    const rect = canvas.getBoundingClientRect();
    return points.map(point => ({
      x: rect.left + canvas.clientLeft + point.x * (rect.width - canvas.clientLeft * 2) / canvas.width,
      y: rect.top + canvas.clientTop + point.y * (rect.height - canvas.clientTop * 2) / canvas.height,
    }));
  }, points);
  if (input === 'mouse') {
    await page.mouse.move(coords[0].x, coords[0].y);
    await page.mouse.down();
    for (const point of coords.slice(1)) await page.mouse.move(point.x, point.y, { steps: 8 });
    await page.mouse.up();
  } else {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [coords[0]] });
    for (const point of coords.slice(1)) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  }
}

async function solve(page, input) {
  const route = await page.evaluate(() => window.gameApp.gameState.mazePath);
  await gesture(page, input, route);
}
for (const input of ['mouse', 'touch']) {
  test(`${input}: all five rounds remain playable after a correct answer`, async ({ page }) => {
    await page.setViewportSize(input === 'touch' ? { width: 375, height: 667 } : { width: 1024, height: 768 });
    for (let round = 1; round <= 5; round++) {
      await solve(page, input);
      expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(round * 10);
      await expect(page.locator('#maze-progress-text')).toHaveAttribute('aria-valuenow', String(round));
      await expect(page.locator('#maze-progress-text .complete')).toHaveCount(round);
      await page.clock.runFor(1500);
      if (round < 5) {
        expect(await page.evaluate(() => window.gameApp.gameState.isAnswering)).toBe(false);
        await expect(page.locator('#maze-feedback-area')).toBeHidden();
      }
    }
    await expect(page.locator('#result-screen')).toBeVisible();
    await expect(page.locator('.completion-star')).toBeVisible();
    expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(50);
  });
}

test('manual next after a win cancels auto-next; leaving cancels pending next', async ({ page }) => {
  await solve(page, 'mouse');
  await page.locator('#maze-next-btn').click();
  await page.clock.runFor(1600);
  expect(await page.evaluate(() => window.gameApp.gameState.questionsAnswered)).toBe(1);
  await expect(page.locator('#maze-feedback-area')).toBeHidden();
  await solve(page, 'mouse');
  expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(20);
  await page.locator('#maze-reset-btn').click();
  await page.locator('#maze-start-btn').click();
  await page.clock.runFor(1600);
  expect(await page.evaluate(() => window.gameApp.gameState.questionsAnswered)).toBe(0);
  await solve(page, 'mouse');
  expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(10);
});

test('manual retry still starts a playable new maze', async ({ page }) => {
  await page.evaluate(() => window.gameApp.mazeGame.failMaze());
  await expect(page.locator('#maze-feedback-text')).toHaveText('おしい！もういっかい やってみよう！');
  await expect(page.locator('#maze-progress-text')).toHaveAttribute('aria-valuenow', '1');
  await page.locator('#maze-next-btn').click();
  await expect(page.locator('#maze-progress-text')).toHaveAttribute('aria-valuenow', '1');
  await expect(page.locator('#maze-feedback-area')).toBeHidden();
  await solve(page, 'touch');
  expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(10);
});

for (const input of ['mouse', 'touch']) {
  test(`${input}: goal taps and a direct shortcut cannot finish the maze`, async ({ page }) => {
    const { start, goal } = await page.evaluate(() => ({ start: window.gameApp.gameState.mazePlayer, goal: window.gameApp.gameState.mazeGoal }));
    await gesture(page, input, [goal]);
    expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(0);
    expect(await page.evaluate(() => window.gameApp.gameState.mazePlayer)).toEqual(start);
    await gesture(page, input, [start, goal]);
    expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(0);
    // Restart so solving begins at the displayed player again.
    await page.locator('#maze-reset-btn').click();
    await page.locator('#maze-start-btn').click();
    await solve(page, input);
    expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(10);
  });
}

test('a reachable dead end can be explored and retraced without failure', async ({ page }) => {
  const detour = await page.evaluate(() => {
    const maze = window.gameApp.mazeGame.maze;
    const end = maze.cells.findIndex((neighbors, cell) => neighbors.length === 1 && cell !== 0 && cell !== 35);
    const queue = [0], parents = new Map([[0, null]]);
    for (const cell of queue) for (const next of maze.cells[cell]) {
      if (!parents.has(next)) { parents.set(next, cell); queue.push(next); }
    }
    const cells = [];
    for (let cell = end; cell !== null; cell = parents.get(cell)) cells.push(cell);
    return cells.reverse().map(cell => ({
      x: maze.padding + (cell % maze.columns + .5) * maze.cellWidth,
      y: maze.padding + (Math.floor(cell / maze.columns) + .5) * maze.cellHeight,
    }));
  });
  await gesture(page, 'touch', detour);
  await expect(page.locator('#maze-feedback-area')).toBeHidden();
  expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(0);
  await gesture(page, 'touch', [...detour].reverse());
  await solve(page, 'touch');
  expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(10);
});


for (const input of ['mouse', 'touch']) {
  test(`${input}: finger drift is corrected to the road and can resume after release`, async ({ page }) => {
    const { start, drift } = await page.evaluate(() => {
      const [start, next] = window.gameApp.gameState.mazePath;
      const vertical = start.x === next.x;
      return { start, drift: { x: (start.x + next.x) / 2 + (vertical ? 12 : 0), y: (start.y + next.y) / 2 + (vertical ? 0 : 12) } };
    });
    await gesture(page, input, [start, drift]);
    const player = await page.evaluate(() => window.gameApp.gameState.mazePlayer);
    expect(player).not.toEqual(drift);
    const road = await page.evaluate(() => {
      const player = window.gameApp.gameState.mazePlayer;
      return window.gameApp.mazeGame.maze.passages.some(({ start, end }) =>
        player.x >= Math.min(start.x, end.x) - 1e-6 && player.x <= Math.max(start.x, end.x) + 1e-6 &&
        player.y >= Math.min(start.y, end.y) - 1e-6 && player.y <= Math.max(start.y, end.y) + 1e-6);
    });
    expect(road).toBe(true);
    await expect(page.locator('#maze-feedback-area')).toBeHidden();
    const route = await page.evaluate(() => [window.gameApp.gameState.mazePlayer, ...window.gameApp.gameState.mazePath.slice(1)]);
    await gesture(page, input, route);
    expect(await page.evaluate(() => window.gameApp.gameState.score)).toBe(10);
  });
}

test('maze win plays the mapped celebration voice', async ({ page }) => {
  await page.evaluate(() => {
    window.celebrationPaths = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      window.celebrationPaths.push(new URL(this.src).pathname);
      return original.apply(this, args);
    };
  });
  await solve(page, 'mouse');
  const paths = await page.evaluate(() => window.celebrationPaths);
  expect(paths.filter(path => path === '/audio/correct.mp3')).toHaveLength(1);
  expect(paths).not.toContain('/audio/maze-win10.mp3');
});
