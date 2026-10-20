import { defineConfig } from '@playwright/test';

// DEKITA_TEST_URL points at a server the caller already runs; otherwise reuse
// the local dekita service on 8525, or start a throwaway http-server there.
const external = process.env.DEKITA_TEST_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: external || 'http://127.0.0.1:8525' },
  webServer: external ? undefined : {
    command: 'npx http-server -p 8525 -a 127.0.0.1 -c-1 -s',
    url: 'http://127.0.0.1:8525/',
    reuseExistingServer: true,
  },
});
