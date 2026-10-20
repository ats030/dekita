// Run unit, publication-audit and browser checks against a throwaway local server.
// DEKITA_PORT selects the port (default 8525); the run fails if the port is already in use.
// After every check passes, the counts are written to docs/check-report.json.
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import net from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.DEKITA_PORT || 8525);
const base = `http://127.0.0.1:${port}`;
const scratch = mkdtempSync(path.join(tmpdir(), 'dekita-checks-'));
process.on('exit', () => rmSync(scratch, {recursive: true, force: true}));
const readJson = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));

function run(command, args, env = process.env, stdio = 'inherit') {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {cwd: root, stdio, env, encoding: 'utf8'});
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
  return result;
}

function count(text, pattern, label) {
  const match = text.match(pattern);
  if (!match) throw new Error(`Could not read the ${label} test count`);
  return Number(match[1]);
}

function portIsFree() {
  return new Promise(resolve => {
    const probe = net.createServer().once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not start on ${base}`);
}

const unitTests = readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.js'))
  .map(name => path.join('tests', name));
const unitTap = path.join(scratch, 'unit.tap');
run(process.execPath, ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=tap', `--test-reporter-destination=${unitTap}`, ...unitTests]);
const unit = count(readFileSync(unitTap, 'utf8'), /^# pass (\d+)$/m, 'unit');
const audit = count(run('python3', ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'],
  process.env, ['inherit', 'inherit', 'pipe']).stderr, /^Ran (\d+) tests?/m, 'publication regression');

if (!(await portIsFree())) {
  console.error(`Port ${port} is already in use; set DEKITA_PORT to a free port.`);
  process.exit(1);
}
const server = spawn(path.join(root, 'node_modules/.bin/http-server'), ['-p', String(port), '-a', '127.0.0.1', '-c-1', '-s'],
  {cwd: root, stdio: ['ignore', 'ignore', 'inherit']});
const serverFailed = new Promise((_, reject) => {
  server.once('error', error => reject(new Error(`http-server failed to start (run npm ci): ${error.message}`)));
  server.once('exit', code => reject(new Error(`http-server exited with ${code}`)));
});
serverFailed.catch(() => {});
try {
  await Promise.race([waitForServer(), serverFailed]);
  const browserJson = path.join(scratch, 'browser.json');
  run(path.join(root, 'node_modules/.bin/playwright'), ['test', '--reporter=line,json'],
    {...process.env, DEKITA_TEST_URL: base, PLAYWRIGHT_JSON_OUTPUT_NAME: browserJson});
  const {stats} = JSON.parse(readFileSync(browserJson, 'utf8'));
  if (stats.unexpected || stats.flaky || stats.skipped) throw new Error(`Browser checks were not all clean: ${JSON.stringify(stats)}`);
  writeFileSync(path.join(root, 'docs/check-report.json'), JSON.stringify({
    checked_on: new Date().toLocaleDateString('sv-SE'),
    source_commit: readJson('docs/source-manifest.json').source_commit,
    environment: {node: process.versions.node, python: run('python3', ['-c', 'import platform; print(platform.python_version())'],
      process.env, ['ignore', 'pipe', 'pipe']).stdout.trim(), playwright: readJson('node_modules/playwright/package.json').version},
    passed: {unit_tests: unit, publication_regression_tests: audit, browser_tests: stats.expected},
  }, null, 2) + '\n');
  console.log('PASS: wrote docs/check-report.json');
} finally {
  server.kill();
}
