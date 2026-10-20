import { test, expect } from '@playwright/test';

const base = process.env.DEKITA_TEST_URL || 'http://127.0.0.1:8525';

test('should load ESM module without browser console error', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  await page.goto(`${base}/src/modules/core/GameState.js`);
  
  console.log('Errors:', errors);
  expect(errors.length).toBe(0);
});

test('should load main.js without browser console error', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  await page.goto(`${base}/src/main.js`);
  
  console.log('Errors:', errors);
  expect(errors.length).toBe(0);
});
