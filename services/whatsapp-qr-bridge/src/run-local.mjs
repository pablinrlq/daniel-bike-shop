import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serviceDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = process.env.BRIDGE_DATA_ROOT || join(homedir(), '.local', 'share');
const dataDir = join(dataRoot, 'daniel-bike-shop-whatsapp-bridge');
const envPath = join(dataDir, 'bridge.env');
const logPath = join(dataDir, 'bridge.log');
const pidPath = join(dataDir, 'bridge.pid');
const bridgePath = join(serviceDir, 'src', 'index.mjs');

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return separator < 0 ? [line, ''] : [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

async function acquirePidFile() {
  try {
    const existingPid = Number((await readFile(pidPath, 'utf8')).trim());
    if (Number.isInteger(existingPid) && existingPid > 1) {
      try {
        process.kill(existingPid, 0);
        process.exit(0);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    await rm(pidPath, { force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await writeFile(pidPath, `${process.pid}\n`, { flag: 'wx', mode: 0o600 });
}

await mkdir(dataDir, { recursive: true, mode: 0o700 });
await acquirePidFile();
const localEnv = parseEnv(await readFile(envPath, 'utf8'));
const log = createWriteStream(logPath, { flags: 'a', mode: 0o600 });
let child;
let stopping = false;

async function cleanUp() {
  await rm(pidPath, { force: true }).catch(() => undefined);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    child?.kill(signal);
  });
}

try {
  while (!stopping) {
    log.write(`${new Date().toISOString()} iniciando ponte local\n`);
    child = spawn(process.execPath, [bridgePath], {
      cwd: serviceDir,
      env: { ...process.env, ...localEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    const exitCode = await new Promise((resolveExit) => child.once('exit', resolveExit));
    child = undefined;
    if (stopping) break;
    log.write(`${new Date().toISOString()} ponte encerrou (${exitCode}); reiniciando em 5s\n`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5000));
  }
} finally {
  await cleanUp();
  log.end();
}
