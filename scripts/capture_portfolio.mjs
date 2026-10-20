// Capture the actual static game from this checkout with zero external requests.
// Files are served from disk through a routed placeholder origin; no server is started.
// Media is written to a scratch folder and copied into docs/media only after every check passes.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const media = path.join(root, 'docs/media');
const origin = 'http://portfolio.invalid';
const viewport = {width: 1024, height: 768};
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.json': 'application/json'};

const scratch = mkdtempSync(path.join(tmpdir(), 'dekita-capture-'));
const videoDir = path.join(scratch, 'video');
const staged = path.join(scratch, 'media');
mkdirSync(staged);
const requests = [];
const errors = [];
const browser = await chromium.launch({headless: true});
try {
  const context = await browser.newContext({viewport, locale: 'ja-JP', colorScheme: 'light',
    recordVideo: {dir: videoDir, size: viewport}});
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      errors.push(`Unexpected external request: ${url.host}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).slice(1);
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || relative.split('/').some(part => part.startsWith('.'))) {
      return route.fulfill({status: 404, body: ''});
    }
    let body;
    try {
      body = readFileSync(file);
    } catch {
      errors.push(`Missing local file: ${url.pathname}`);
      return route.fulfill({status: 404, body: ''});
    }
    requests.push(url.pathname);
    await route.fulfill({status: 200, body, contentType: types[path.extname(file)] || 'application/octet-stream'});
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const shot = name => page.screenshot({path: path.join(staged, name)});
  const pause = ms => page.waitForTimeout(ms);
  const home = async screen => {
    await page.locator(`#${screen} .reset-btn`).click();
    await page.locator('#title-screen').waitFor();
    await pause(500);
  };

  await page.goto(origin + '/');
  await page.locator('#title-screen').waitFor();
  await assert.doesNotReject(page.getByText('VOICEVOX:ずんだもん').waitFor());
  await pause(800);
  await shot('01-home.png');

  await page.locator('#start-btn').click();
  await page.locator('#game-screen').waitFor();
  await pause(900);
  await shot('02-count.png');
  const answer = await page.evaluate(() => window.gameApp.countGame.state.currentAnswer);
  await page.locator('#game-screen .answer-btn', {hasText: new RegExp(`^${answer}$`)}).click();
  await pause(1200);
  await home('game-screen');

  await page.locator('#color-start-btn').click();
  await page.locator('#color-game-screen').waitFor();
  await pause(900);
  await shot('03-color.png');
  await home('color-game-screen');

  await page.locator('#shiritori-start-btn').click();
  await page.locator('#shiritori-game-screen').waitFor();
  await pause(900);
  await shot('04-shiritori.png');
  await home('shiritori-game-screen');

  await page.locator('#block-start-btn').click();
  await page.locator('#block-game-screen').waitFor();
  await pause(900);
  await shot('05-block.png');
  await page.evaluate(() => {
    const app = window.gameApp;
    app.gameState.score = 50;
    app.gameState.questionsAnswered = app.gameState.questionsTotal;
    app.blockGame.endGame();
  });
  await page.locator('#result-screen').waitFor();
  await pause(1200);
  await shot('06-result.png');
  await page.locator('#result-home-btn').click();
  await page.locator('#title-screen').waitFor();
  await pause(800);

  await context.close();
  assert.deepEqual(errors, []);
  const [video] = readdirSync(videoDir).filter(name => name.endsWith('.webm'));
  copyFileSync(path.join(videoDir, video), path.join(staged, 'walkthrough.webm'));
  const ffmpeg = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(staged, 'walkthrough.webm'),
    '-vf', 'fps=6,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer',
    path.join(staged, 'walkthrough.gif')], {stdio: 'inherit'});
  assert.equal(ffmpeg.status, 0, 'ffmpeg GIF conversion failed');
  writeFileSync(path.join(staged, 'capture-report.json'), JSON.stringify({
    profile: 'actual static game from this checkout; files served through a routed placeholder origin',
    viewport,
    screenshots: 6,
    assertions: ['title screen shows the VOICEVOX:ずんだもん credit', 'count game accepts the correct answer',
      'color, shiritori and block games open and return home', 'result screen returns home',
      'no external requests', 'no page errors'],
    staged_state: 'The result screen is reached by calling endGame() with a preset score; it does not show a played-through block round.',
    requests: [...new Set(requests)].sort(),
  }, null, 2) + '\n');
  mkdirSync(media, {recursive: true});
  for (const name of readdirSync(staged)) copyFileSync(path.join(staged, name), path.join(media, name));
  console.log(`PASS: captured 6 screenshots and walkthrough from ${new Set(requests).size} local files`);
} finally {
  await browser.close();
  rmSync(scratch, {recursive: true, force: true});
}
