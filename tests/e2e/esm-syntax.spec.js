import { test, expect } from '@playwright/test';

const base = process.env.DEKITA_TEST_URL || 'http://127.0.0.1:8525';

test('should load ESM module without syntax error', async ({ page }) => {
  await page.goto(`${base}/src/modules/core/GameState.js`);
  const content = await page.textContent('body');
  expect(content).toContain('export class GameState');
});

test('should load main.js without syntax error', async ({ page }) => {
  await page.goto(`${base}/src/main.js`);
  const content = await page.textContent('body');
  expect(content).toContain('import { init }');
});
