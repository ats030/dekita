import { test, expect } from '@playwright/test';

const base = process.env.DEKITA_TEST_URL || 'http://127.0.0.1:8525';

test('should load ES module content without syntax error', async ({ page }) => {
  // fetch() from about:blank is blocked, so start on the app origin.
  await page.goto(`${base}/`);
  const urls = [
    `${base}/src/modules/index.js`,
    `${base}/src/modules/core/GameState.js`,
    `${base}/src/modules/games/MazeGame.js`
  ];

  for (const url of urls) {
    const { content, error } = await page.evaluate(async (u) => {
      try {
        const response = await fetch(u);
        const text = await response.text();
        return { content: text, error: null };
      } catch (e) {
        return { content: null, error: e.message };
      }
    }, url);

    console.log(`URL: ${url}`);
    console.log(`Error: ${error}`);
    console.log(`Content preview: ${content ? content.substring(0, 100) : 'N/A'}`);

    if (error) {
      throw new Error(`Failed to load ${url}: ${error}`);
    }
  }
});
