import { test, expect } from '@playwright/test';

const base = process.env.DEKITA_TEST_URL || 'http://127.0.0.1:8525';

test('should evaluate ESM module content without syntax error', async ({ page }) => {
  const modules = [
    `${base}/src/modules/core/GameState.js`,
    `${base}/src/modules/core/AudioManager.js`,
    `${base}/src/modules/core/ScreenManager.js`,
    `${base}/src/modules/games/CountGame.js`,
    `${base}/src/modules/games/ColorGame.js`,
    `${base}/src/modules/games/AnimalGame.js`,
    `${base}/src/modules/games/MazeGame.js`,
    `${base}/src/modules/index.js`
  ];

  const errors = [];

  for (const url of modules) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (response?.status() !== 200) {
        errors.push({ url, status: response?.status(), error: 'Non-200 status' });
        continue;
      }

      const content = await page.content();
      if (content.includes('SyntaxError') || content.includes('Unexpected token')) {
        errors.push({ url, error: 'Syntax error in page content' });
      }
    } catch (e) {
      errors.push({ url, error: e.message });
    }
  }

  if (errors.length > 0) {
    console.log('Errors:', errors);
    throw new Error(`Failed to load ESM modules: ${JSON.stringify(errors)}`);
  }
});
