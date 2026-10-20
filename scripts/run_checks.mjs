// Run unit, publication-audit and browser checks against a throwaway local server.
// DEKITA_PORT selects the port (default 8525); the run fails if the port is already in use.
import {spawn, spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.DEKITA_PORT || 8525);
const base = `http://127.0.0.1:${port}`;

function run(command, args, env = process.env) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {cwd: root, stdio: 'inherit', env});
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
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
run(process.execPath, ['--test', ...unitTests]);
run('python3', ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py']);

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
  run(path.join(root, 'node_modules/.bin/playwright'), ['test', 'tests/e2e', '--reporter=line'],
    {...process.env, DEKITA_TEST_URL: base});
} finally {
  server.kill();
}
