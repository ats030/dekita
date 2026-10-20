// Run against wrangler dev, or the deployed URL supplied as the first argument.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:8787';
const browser = await chromium.launch({headless: true});
try {
  const gameContext = await browser.newContext();
  const gamePage = await gameContext.newPage();
  const errors = [];
  gamePage.on('pageerror', error => errors.push(error.message));
  // Existing local-only analytics must not trigger LAN requests in this check.
  await gameContext.route('http://ubuntu-server-app:8526/**', route => route.abort());
  const games = [
    ['start-btn', 'game-screen'], ['color-start-btn', 'color-game-screen'],
    ['animal-start-btn', 'animal-game-screen'], ['maze-start-btn', 'maze-play-screen'],
    ['match-start-btn', 'match-game-screen'], ['puzzle-start-btn', 'puzzle-game-screen'],
    ['shiritori-start-btn', 'shiritori-game-screen'], ['moji-start-btn', 'moji-game-screen'],
    ['block-start-btn', 'block-game-screen'],
  ];
  await gamePage.goto(base);
  // Every title-screen game button must be covered so a newly added game cannot be skipped silently.
  assert.deepEqual(
    (await gamePage.locator('#title-screen .game-btn').evaluateAll(buttons => buttons.map(b => b.id))).sort(),
    games.map(([button]) => button).sort(), 'check must cover every title-screen game');
  for (const [button, screen] of games) {
    await gamePage.goto(base);
    await gamePage.click(`#${button}`);
    await gamePage.waitForSelector(`#${screen}:not(.hidden)`);
  }
  assert.deepEqual(errors, [], 'game scripts must execute without page errors');
  for (const path of ['/audio/correct.mp3', '/src/main.js']) {
    const response = await gameContext.request.get(base + path);
    assert.equal(response.status(), 200, path);
    assert.equal(response.headers()['x-content-type-options'], 'nosniff');
  }
  for (const path of ['/migration.html', '/migration.js', '/package.json', '/Dockerfile', '/.env', '/src/tests/setup.js', '/tests/e2e/game.spec.js']) {
    assert.equal((await gameContext.request.get(base + path)).status(), 404, path);
  }
  const scoreContext = await browser.newContext();
  await scoreContext.route('http://ubuntu-server-app:8526/**', route => route.abort());
  const scorePage = await scoreContext.newPage();
  await scorePage.goto(base);
  await scorePage.evaluate(() => localStorage.setItem('gakushuGameHighScore', '123'));
  await scorePage.reload();
  await scorePage.waitForFunction(() => window.gameApp?.gameState);
  assert.equal(await scorePage.evaluate(() => window.gameApp.gameState.highScore), 123);
  // Count, Animal and Maze all call this completion method. A lower result
  // must not overwrite the saved score; a better result must replace it.
  await scorePage.evaluate(() => {
    window.gameApp.gameState.score = 10;
    window.gameApp.gameState.saveScore();
  });
  await scorePage.reload();
  await scorePage.waitForFunction(() => window.gameApp?.gameState);
  assert.equal(await scorePage.evaluate(() => window.gameApp.gameState.highScore), 123);
  await scorePage.evaluate(() => {
    window.gameApp.gameState.score = 150;
    window.gameApp.gameState.saveScore();
  });
  await scorePage.reload();
  await scorePage.waitForFunction(() => window.gameApp?.gameState);
  assert.equal(await scorePage.evaluate(() => window.gameApp.gameState.highScore), 150);
  await scorePage.evaluate(() => localStorage.setItem('gakushuGameHighScore', 'not-a-score'));
  await scorePage.reload();
  await scorePage.waitForFunction(() => window.gameApp?.gameState);
  assert.equal(await scorePage.evaluate(() => window.gameApp.gameState.highScore), 0);
  await scorePage.evaluate(() => {
    window.gameApp.gameState.score = 20;
    window.gameApp.gameState.saveScore();
  });
  await scorePage.reload();
  await scorePage.waitForFunction(() => window.gameApp?.gameState);
  assert.equal(await scorePage.evaluate(() => window.gameApp.gameState.highScore), 20);
  console.log('PASS: nine game screens, audio delivery, headers, private-file exclusion, retired migration page removal and score preservation after completion');
} finally {
  await browser.close();
}
