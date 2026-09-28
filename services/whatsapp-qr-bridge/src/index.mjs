import { mkdir } from 'node:fs/promises';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const enabled = process.env.BRIDGE_ENABLED === 'true';
const riskAccepted = process.env.BRIDGE_ACKNOWLEDGE_UNOFFICIAL_RISK === 'true';
const assistantUrl = process.env.SUPABASE_ASSISTANT_URL || '';
const bridgeSecret = process.env.QR_BRIDGE_SECRET || '';
const authDir = process.env.WA_AUTH_DIR || './data/auth';
const debounceMs = Math.max(500, Number(process.env.MESSAGE_DEBOUNCE_MS || 1400));
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const pending = new Map();
const seen = new Set();
let socket;
let reconnectTimer;

if (!enabled || !riskAccepted) {
  logger.error(
    'Ponte QR desativada. Defina BRIDGE_ENABLED=true e BRIDGE_ACKNOWLEDGE_UNOFFICIAL_RISK=true depois de aceitar o risco de bloqueio/desconexão.',
  );
  process.exit(1);
}

if (!assistantUrl || !bridgeSecret || bridgeSecret.length < 32) {
  logger.error('SUPABASE_ASSISTANT_URL e QR_BRIDGE_SECRET (mínimo 32 caracteres) são obrigatórios.');
  process.exit(1);
}

await mkdir(authDir, { recursive: true });

function messageText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.buttonsResponseMessage?.selectedDisplayText ||
    message?.listResponseMessage?.title ||
    ''
  ).trim();
}

function disconnectCode(error) {
  return error?.output?.statusCode || error?.data?.statusCode || error?.statusCode;
}

async function callAssistant(sessionId, payload) {
  const response = await fetch(assistantUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bridge-secret': bridgeSecret,
    },
    body: JSON.stringify({ channel: 'whatsapp-qr', sessionId, ...payload }),
    signal: AbortSignal.timeout(35_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Assistente respondeu HTTP ${response.status}`);
  return data;
}

async function handleHumanCommand(remoteJid, text) {
  if (text !== '!bot on' && text !== '!bot off') return false;
  const action = text === '!bot on' ? 'resume' : 'pause';
  await callAssistant(remoteJid, { action });
  logger.info({ remoteJid, action }, 'Estado do bot alterado pelo atendente');
  return true;
}

async function answer(remoteJid, combinedText) {
  try {
    await socket.sendPresenceUpdate('composing', remoteJid);
    const result = await callAssistant(remoteJid, { message: combinedText });
    if (result.paused || !result.reply) return;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await socket.sendMessage(remoteJid, { text: result.reply });
  } catch (error) {
    logger.error({ remoteJid, error: error.message }, 'Falha ao responder mensagem');
  } finally {
    await socket.sendPresenceUpdate('paused', remoteJid).catch(() => undefined);
  }
}

function enqueue(remoteJid, text) {
  const current = pending.get(remoteJid);
  if (current) clearTimeout(current.timer);
  const messages = [...(current?.messages || []), text];
  const timer = setTimeout(() => {
    pending.delete(remoteJid);
    void answer(remoteJid, messages.join('\n'));
  }, debounceMs);
  pending.set(remoteJid, { messages, timer });
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();
  socket = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  socket.ev.on('creds.update', saveCreds);
  socket.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      process.stdout.write('\nEscaneie este QR no WhatsApp da loja: Aparelhos conectados → Conectar aparelho.\n\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') logger.info('WhatsApp conectado. Ponte reativa pronta.');
    if (connection !== 'close') return;

    const code = disconnectCode(lastDisconnect?.error);
    if (code === DisconnectReason.loggedOut) {
      logger.error('Sessão removida pelo WhatsApp. Apague o volume de autenticação e escaneie outro QR.');
      return;
    }
    logger.warn({ code }, 'Conexão encerrada; tentando reconectar');
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => void connect(), 2500);
  });

  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const item of messages) {
      const remoteJid = item.key.remoteJid || '';
      const id = item.key.id || '';
      if (!remoteJid || !id || seen.has(id) || remoteJid === 'status@broadcast') continue;
      if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@newsletter')) continue;
      seen.add(id);
      if (seen.size > 2000) seen.clear();

      const text = messageText(item.message);
      if (!text) continue;

      if (item.key.fromMe) {
        await handleHumanCommand(remoteJid, text).catch((error) =>
          logger.error({ remoteJid, error: error.message }, 'Falha no comando do atendente'),
        );
        continue;
      }

      await socket.readMessages([item.key]).catch(() => undefined);
      enqueue(remoteJid, text);
    }
  });
}

process.on('SIGTERM', () => {
  clearTimeout(reconnectTimer);
  socket?.end(undefined);
  process.exit(0);
});

process.on('SIGINT', () => {
  clearTimeout(reconnectTimer);
  socket?.end(undefined);
  process.exit(0);
});

logger.warn('Integração WhatsApp Web não oficial: use apenas atendimento reativo e por sua conta e risco.');
await connect();
