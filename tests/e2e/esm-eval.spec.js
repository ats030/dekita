import { test, expect } from '@playwright/test';

const base = process.env.DEKITA_TEST_URL || 'http://127.0.0.1:8525';

test('should evaluate ES module content without syntax error', async ({ page }) => {
  const url = `${base}/src/modules/index.js`;
  // fetch() and import() from about:blank are blocked, so start on the app origin.
  await page.goto(`${base}/`);
  
  const { content, error } = await page.evaluate(async (u) => {
    try {
      const response = await fetch(u);
      const text = await response.text();
      return { content: text, error: null };
    } catch (e) {
      return { content: null, error: e.message };
    }
  }, url);

  expect(error).toBeNull();
  expect(content).toContain('export function init');

  // Module source cannot run as a classic script; import it as a module instead.
  const exported = await page.evaluate(async (u) => Object.keys(await import(u)), url);
  expect(exported).toContain('init');
});
