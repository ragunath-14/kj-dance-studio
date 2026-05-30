/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  KJ Dance Studio – WhatsApp Service  (whatsapp-web.js)
 * ─────────────────────────────────────────────────────────────────────────────
 *  STABILITY DESIGN PRINCIPLES:
 *  ① Session is NEVER deleted automatically — only cleared on confirmed
 *    LOGOUT events (not on crashes, not on transient errors).
 *  ② webVersionCache is set to 'none' → uses the version bundled with the
 *    installed whatsapp-web.js package, which is the most stable option.
 *  ③ Exponential back-off on transient errors (max 5 retries, caps at 5 min).
 *  ④ Error classification: only TRANSIENT errors trigger a retry; AUTH errors
 *    stop retrying and alert the operator.
 *  ⑤ Graceful SIGINT/SIGTERM hooks ensure the Chromium process is always
 *    closed cleanly so the session file is written correctly.
 *  ⑥ Anti-ban: random 2-5 s gap, daily cap, message-text variation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs     = require('fs');
const path   = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────
const AUTH_PATH  = path.resolve(__dirname, '../.wwebjs_auth');
const CACHE_PATH = path.resolve(__dirname, '../.wwebjs_cache');

// ── Singleton state ───────────────────────────────────────────────────────────
let client        = null;
let isReady       = false;
let isInitializing = false;

// ── Retry state (exponential back-off) ────────────────────────────────────────
const MAX_RETRIES       = 5;
const BASE_RETRY_MS     = 15_000;   // 15 s  (× 2 each time → 15, 30, 60, 120, 300)
const MAX_RETRY_MS      = 300_000;  // 5 min cap
let   retryCount        = 0;
let   retryTimer        = null;

// ── Anti-ban: rate-limiting state ─────────────────────────────────────────────
const DAILY_LIMIT     = parseInt(process.env.WHATSAPP_DAILY_LIMIT) || 50;
let   messagesSentToday = 0;
let   lastResetDate     = new Date().toDateString();
let   lastSendTimestamp = 0;

const resetDailyCounterIfNeeded = () => {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
        messagesSentToday = 0;
        lastResetDate = today;
    }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep        = (ms) => new Promise((r) => setTimeout(r, ms));
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick          = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── Anti-ban: message variation pools ─────────────────────────────────────────
const GREETINGS = ['Hello', 'Hi', 'Hey', 'Dear'];
const THANKS    = ['Thank you!', 'Thanks!', 'Thank you so much!', 'We appreciate it!'];
const CLOSINGS  = [
    'For any queries, feel free to reach out.',
    'Please contact us if you have questions.',
    'Reach out to us anytime for help.',
    'Feel free to contact us for any details.',
];

// ── Helper: format Indian phone number to WhatsApp chat ID ───────────────────
const formatChatId = (rawNumber) => {
    let cleaned = String(rawNumber).replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned + '@c.us';
};

// ── Error classifier ──────────────────────────────────────────────────────────
//  Returns 'transient' | 'auth' | 'unknown'
const classifyError = (msg = '') => {
    if (
        msg.includes('context was destroyed') ||
        msg.includes('Protocol error') ||
        msg.includes('Target closed') ||
        msg.includes('Session closed') ||
        msg.includes('net::ERR') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT')
    ) return 'transient';

    if (
        msg.includes('auth_failure') ||
        msg.includes('LOGOUT') ||
        msg.includes('401')
    ) return 'auth';

    return 'unknown';
};

// ── Compute next retry delay (exponential back-off with jitter) ───────────────
const nextRetryDelay = () => {
    const exp   = Math.min(BASE_RETRY_MS * Math.pow(2, retryCount), MAX_RETRY_MS);
    const jitter = randomBetween(0, 5000);   // up to 5 s jitter
    return exp + jitter;
};

// ── Schedule a retry (never deletes the session) ──────────────────────────────
const scheduleRetry = (reason = '') => {
    if (retryCount >= MAX_RETRIES) {
        console.error(
            `🚫 [WhatsApp] Max retries (${MAX_RETRIES}) reached. ` +
            'Operator must restart the server manually.'
        );
        return;
    }

    const delay = nextRetryDelay();
    retryCount++;
    console.log(
        `🔄 [WhatsApp] Retry ${retryCount}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s` +
        (reason ? ` (reason: ${reason})` : '')
    );

    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
        isInitializing = false;
        client         = null;
        initWhatsApp();
    }, delay);
};

// ─────────────────────────────────────────────────────────────────────────────
//  initWhatsApp — safe to call multiple times (singleton guard)
// ─────────────────────────────────────────────────────────────────────────────
const initWhatsApp = () => {
    if (isInitializing || client) {
        console.log('ℹ️  [WhatsApp] Already initializing/initialized. Skipping.');
        return;
    }
    isInitializing = true;
    console.log('🚀 [WhatsApp] Initializing client…');

    // ── Create client ─────────────────────────────────────────────────────
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: AUTH_PATH,
            // clientId keeps sessions isolated if you ever run multiple clients
            clientId: 'kj-dance-studio',
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--window-size=1280,720',
            ],
        },
        // 'none' → use the WA Web version bundled with the installed
        //  whatsapp-web.js package. This is the most stable option because
        //  the library maintainers test against this exact version.
        //  Never point to a remote URL — WA updates that URL and it causes
        //  the "execution context destroyed" crash you just experienced.
        webVersionCache: { type: 'none' },
        restartOnAuthFail: false,   // we handle restarts ourselves
    });

    // ── QR Code ──────────────────────────────────────────────────────────
    client.on('qr', (qr) => {
        console.log('\n📱 [WhatsApp] Scan QR below in WhatsApp → Linked Devices:');
        qrcode.generate(qr, { small: true });
    });

    // ── Auth success ──────────────────────────────────────────────────────
    client.on('authenticated', () => {
        console.log('🔐 [WhatsApp] Authenticated — session saved.');
        retryCount = 0;   // reset back-off counter on successful auth
    });

    // ── Ready ─────────────────────────────────────────────────────────────
    client.on('ready', () => {
        console.log('✅ [WhatsApp] Client READY. Messages will now be delivered.');
        isReady        = true;
        isInitializing = false;
        retryCount     = 0;
        clearTimeout(retryTimer);
    });

    // ── Auth failure ──────────────────────────────────────────────────────
    //  Happens when WhatsApp invalidates the session (e.g., user removed
    //  the linked device from their phone). DO NOT auto-retry — the operator
    //  must open WhatsApp, remove the old linked device, and restart the
    //  server to get a fresh QR.
    client.on('auth_failure', (msg) => {
        console.error('❌ [WhatsApp] Auth failure:', msg);
        console.error(
            '⚠️  The WhatsApp session has been invalidated.\n' +
            '   ▸ On your phone: WhatsApp → Linked Devices → Remove this device\n' +
            '   ▸ Then restart the server to scan a new QR code.'
        );
        isReady        = false;
        isInitializing = false;
        client         = null;
        // NOTE: we do NOT delete .wwebjs_auth here. LocalAuth will handle
        // re-auth automatically on the next server start.
    });

    // ── Disconnected ──────────────────────────────────────────────────────
    //  'LOGOUT' means the user removed the device from their phone.
    //  Any other reason (network blip, WA server hiccup) is transient.
    client.on('disconnected', (reason) => {
        console.warn('⚡ [WhatsApp] Disconnected:', reason);
        isReady = false;

        if (reason === 'LOGOUT') {
            console.error(
                '🚫 [WhatsApp] LOGOUT detected — session invalidated by phone.\n' +
                '   ▸ Remove the linked device in WhatsApp on your phone.\n' +
                '   ▸ Restart the server to re-scan QR.'
            );
            isInitializing = false;
            client         = null;
            // DO NOT delete .wwebjs_auth — let operator restart manually
            return;
        }

        // Transient disconnect — retry with back-off
        client = null;
        scheduleRetry(reason);
    });

    // ── Initialize (catch transient startup errors) ───────────────────────
    client.initialize().catch((err) => {
        console.error('❌ [WhatsApp] Initialization error:', err.message);
        isReady        = false;
        isInitializing = false;

        const kind = classifyError(err.message);

        if (kind === 'transient') {
            console.log('🔁 [WhatsApp] Transient startup error — will retry with back-off.');
            client = null;
            scheduleRetry(err.message);
        } else if (kind === 'auth') {
            console.error(
                '❌ [WhatsApp] Auth error during init — restart required after relinking device.'
            );
            client = null;
        } else {
            // Unknown error — still retry but warn operator
            console.warn('⚠️  [WhatsApp] Unknown init error. Retrying cautiously.');
            client = null;
            scheduleRetry(err.message);
        }
    });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Graceful shutdown (called on SIGINT / SIGTERM from index.js)
// ─────────────────────────────────────────────────────────────────────────────
const destroyWhatsApp = async () => {
    clearTimeout(retryTimer);
    if (client) {
        console.log('🛑 [WhatsApp] Shutting down client gracefully…');
        try { await client.destroy(); } catch (_) {}
        client = null;
        isReady = false;
        console.log('✅ [WhatsApp] Client destroyed. Session saved.');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Core send  (anti-ban throttle + daily cap)
// ─────────────────────────────────────────────────────────────────────────────
const sendMessage = async (recipientData, text) => {
    if (!isReady || !client) {
        console.warn('⚠️  [WhatsApp] Client not ready. Message queued as NOT sent.');
        return { success: false, reason: 'client_not_ready' };
    }

    // Daily cap
    resetDailyCounterIfNeeded();
    if (messagesSentToday >= DAILY_LIMIT) {
        console.warn(`⚠️  [WhatsApp] Daily limit (${DAILY_LIMIT}) reached.`);
        return { success: false, reason: 'daily_limit_reached' };
    }

    const rawNumber = recipientData?.whatsappNumber || recipientData?.phone;
    if (!rawNumber) {
        console.warn('⚠️  [WhatsApp] No phone number on recipient.');
        return { success: false, reason: 'missing_number' };
    }

    const chatId = formatChatId(rawNumber);

    try {
        // Enforce random gap between messages (2–5 s anti-ban)
        const elapsed = Date.now() - lastSendTimestamp;
        const minGap  = randomBetween(2000, 5000);
        if (elapsed < minGap) await sleep(minGap - elapsed);

        console.log(`📡 [WhatsApp] Sending to ${chatId}…`);
        await client.sendMessage(chatId, text);
        lastSendTimestamp = Date.now();
        messagesSentToday++;
        console.log(`✅ [WhatsApp] Sent → ${chatId} (${messagesSentToday}/${DAILY_LIMIT} today)`);
        return { success: true };
    } catch (err) {
        console.error(`❌ [WhatsApp] Send failed → ${chatId}:`, err.message);
        return { success: false, reason: err.message };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Public messaging helpers  (with text variation to avoid spam detection)
// ─────────────────────────────────────────────────────────────────────────────

/** 1. Welcome Message — sent when a student is enrolled */
exports.sendWelcomeMessage = async (recipientData, studentName, classType) => {
    console.log(`📝 [WhatsApp] Preparing Welcome for ${studentName}…`);
    const text =
        `🎉 ${pick(GREETINGS)} ${studentName},\n\n` +
        `Welcome to KJ Dance Studio!\n` +
        `You have been enrolled in *${classType || 'Dance Class'}*.\n` +
        `We're thrilled to have you join us! 💃\n\n` +
        `${pick(CLOSINGS)}`;
    return sendMessage(recipientData, text);
};

/** 2. Pending Fees Alert — sent by scheduler or manually */
exports.sendPendingFeesAlert = async (recipientData, studentName, pendingMonths, totalDue) => {
    console.log(`📝 [WhatsApp] Preparing Fee Alert for ${studentName} (₹${totalDue})…`);
    const text =
        `💸 *Fee Reminder – KJ Dance Studio*\n\n` +
        `${pick(GREETINGS)} ${studentName},\n\n` +
        `This is a gentle reminder that your fee of *₹${totalDue}* ` +
        `is pending for *${pendingMonths} month(s)*.\n\n` +
        `Kindly clear the dues at the earliest. ${pick(THANKS)} 🙏`;
    return sendMessage(recipientData, text);
};

/** 3. Payment Receipt — sent after a payment is recorded */
exports.sendPaymentReceipt = async (recipientData, studentName, amount, purpose, paymentDate, balance) => {
    console.log(`📝 [WhatsApp] Preparing Receipt for ${studentName} (₹${amount})…`);
    let balanceText = '';
    if (balance !== undefined && balance > 0) {
        balanceText = `• *Balance Remaining:* ₹${balance}\n`;
    } else if (balance === 0) {
        balanceText = `• *Balance Remaining:* Nil (Full Payment) ✅\n`;
    }
    const text =
        `✅ *Payment Received – KJ Dance Studio*\n\n` +
        `${pick(GREETINGS)} ${studentName},\n\n` +
        `We have successfully received your payment:\n` +
        `• *Amount:* ₹${amount}\n` +
        `• *Purpose:* ${purpose}\n` +
        `• *Date:* ${paymentDate}\n` +
        balanceText +
        `\n${pick(THANKS)} 🙏`;
    return sendMessage(recipientData, text);
};

/** 4. Rejoin Invitation — sent when a student is marked Inactive */
exports.sendRejoinMessage = async (recipientData, studentName, classType) => {
    console.log(`📝 [WhatsApp] Preparing Rejoin for ${studentName}…`);
    const text =
        `💃 *We Miss You at KJ Dance Studio!*\n\n` +
        `${pick(GREETINGS)} ${studentName}! We hope you're doing well.\n\n` +
        `Our new batches for *${classType || 'Dance'}* have started and we'd love to have you back on the floor with us. ✨\n\n` +
        `Come visit us soon! 🙏\n\n${pick(CLOSINGS)}`;
    return sendMessage(recipientData, text);
};

/** 5. Welcome Back — sent when a student is reactivated */
exports.sendWelcomeBackMessage = async (recipientData, studentName, classType) => {
    console.log(`📝 [WhatsApp] Preparing Welcome Back for ${studentName}…`);
    const text =
        `🎊 *Welcome Back to KJ Dance Studio!*\n\n` +
        `${pick(GREETINGS)} ${studentName}, we're so happy to have you back!\n\n` +
        `Your status has been reactivated for *${classType || 'Dance Class'}*.\n` +
        `Get ready to dance! 💃✨\n\n${pick(THANKS)}`;
    return sendMessage(recipientData, text);
};

/** 6. Generic Notification — for custom/manual messages */
exports.sendNotification = async (recipientData, studentName, customText) => {
    console.log(`📝 [WhatsApp] Preparing Notification for ${studentName}…`);
    const text = `📢 *KJ Dance Studio*\n\n${pick(GREETINGS)} ${studentName},\n\n${customText}`;
    return sendMessage(recipientData, text);
};

// ── Status helpers ────────────────────────────────────────────────────────────
exports.getStatus = () => ({
    isReady,
    isInitializing,
    hasClient:        !!client,
    messagesSentToday,
    dailyLimit:       DAILY_LIMIT,
    retryCount,
    maxRetries:       MAX_RETRIES,
});

exports.initWhatsApp    = initWhatsApp;
exports.destroyWhatsApp = destroyWhatsApp;
