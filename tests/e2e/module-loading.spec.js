import { test, expect } from '@playwright/test';

// The page loads ES modules through src/main.js; these checks pin the module
// files themselves so a serving or syntax problem is reported by file name.
const modules = [
  'src/modules/index.js',
  'src/modules/core/GameState.js',
  'src/modules/core/AudioManager.js',
  'src/modules/core/ScreenManager.js',
  'src/modules/games/CountGame.js',
  'src/modules/games/ColorGame.js',
  'src/modules/games/AnimalGame.js',
  'src/modules/games/MazeGame.js',
];
const markers = {
  'src/main.js': 'import { init }',
  'src/modules/index.js': 'export function init',
  'src/modules/core/GameState.js': 'export class GameState',
};

test('index loads its modules without console or page errors', async ({ page }) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  // Answer the LAN visit-log script locally; an abort would itself log a console error.
  await page.route('http://ubuntu-server-app:8526/**', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto('/index.html');
  await expect(page.locator('h1')).toHaveText('できた！');
  expect(errors).toEqual([]);
});

test('module files are served with their expected source', async ({ request }) => {
  for (const path of [...modules, 'src/main.js']) {
    const response = await request.get(`/${path}`);
    expect(response.status(), path).toBe(200);
    if (markers[path]) expect(await response.text(), path).toContain(markers[path]);
  }
});

test('each module imports as an ES module', async ({ page }) => {
  // import() needs the app origin. The page has already loaded these modules through
  // main.js, so this pins each module's exports by file name rather than re-evaluating it.
  await page.goto('/');
  for (const path of modules) {
    const exported = await page.evaluate(async url => Object.keys(await import(url)), `/${path}`);
    expect(exported.length, path).toBeGreaterThan(0);
    if (path === 'src/modules/index.js') expect(exported).toContain('init');
  }
});
