import { createHash, randomBytes } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Use the host user's standard paths even when setup runs from the Flatpak app.
const dataRoot = process.env.BRIDGE_DATA_ROOT || join(homedir(), '.local', 'share');
const configRoot = process.env.BRIDGE_CONFIG_ROOT || join(homedir(), '.config');
const dataDir = join(dataRoot, 'daniel-bike-shop-whatsapp-bridge');
const authDir = join(dataDir, 'auth');
const envPath = join(dataDir, 'bridge.env');
const localNodePath = join(dataDir, 'node');
const qrImagePath = join(dataDir, 'latest-qr.svg');
const qrPngPath = join(dataDir, 'latest-qr.png');
const logPath = join(dataDir, 'bridge.log');
const autostartDir = join(configRoot, 'autostart');
const autostartPath = join(autostartDir, 'daniel-bike-shop-whatsapp-bridge.desktop');
const rotate = process.argv.includes('--rotate');

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

await mkdir(authDir, { recursive: true, mode: 0o700 });
await mkdir(autostartDir, { recursive: true, mode: 0o700 });
await chmod(dataDir, 0o700);
await chmod(authDir, 0o700);

let secret = '';
if (!rotate) {
  try {
    secret = parseEnv(await readFile(envPath, 'utf8')).QR_BRIDGE_SECRET || '';
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
if (secret.length < 32) secret = randomBytes(48).toString('base64url');

const envFile = [
  'BRIDGE_ENABLED=true',
  'BRIDGE_ACKNOWLEDGE_UNOFFICIAL_RISK=true',
  'SUPABASE_ASSISTANT_URL=https://tswnprstidgeojdovsuz.supabase.co/functions/v1/store-assistant',
  `QR_BRIDGE_SECRET=${secret}`,
  `WA_AUTH_DIR=${authDir}`,
  `QR_IMAGE_PATH=${qrImagePath}`,
  `QR_PNG_PATH=${qrPngPath}`,
  'MESSAGE_DEBOUNCE_MS=1400',
  'LOG_LEVEL=info',
  '',
].join('\n');
const temporaryEnvPath = `${envPath}.${process.pid}.tmp`;
await writeFile(temporaryEnvPath, envFile, { mode: 0o600 });
await rename(temporaryEnvPath, envPath);
await chmod(envPath, 0o600);
if (resolve(process.execPath) !== resolve(localNodePath)) {
  await copyFile(process.execPath, localNodePath);
}
await chmod(localNodePath, 0o700);

const runnerPath = join(serviceDir, 'src', 'run-local.mjs');
const desktopEntry = [
  '[Desktop Entry]',
  'Type=Application',
  'Version=1.0',
  'Name=Daniel Bike Shop — Ponte WhatsApp',
  'Comment=Atendimento reativo do WhatsApp da loja',
  `Exec=${localNodePath} ${runnerPath}`,
  `Path=${serviceDir}`,
  'Terminal=false',
  'X-GNOME-Autostart-enabled=true',
  '',
].join('\n');
await writeFile(autostartPath, desktopEntry, { mode: 0o600 });

const secretHash = createHash('sha256').update(secret).digest('hex');
process.stdout.write(
  `${JSON.stringify({ secretHash, dataDir, envPath, qrImagePath, qrPngPath, logPath, autostartPath, localNodePath })}\n`,
);
