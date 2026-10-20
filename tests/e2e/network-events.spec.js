import { test, expect } from '@playwright/test';

const base = process.env.DEKITA_TEST_URL || 'http://127.0.0.1:8525';

test.use({
  launchOptions: {
    args: ['--disable-cache', '--disable-http-cache']
  }
});

test.describe('Dekita Game - Network Events', () => {
  test('should load index.html without ESM syntax error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => {
      errors.push({ message: err.message, stack: err.stack });
    });

    await page.goto(`${base}/index.html`);

    console.log('Errors during load:', errors);
    expect(errors.length).toBe(0);
  });
});
