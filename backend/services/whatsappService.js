'use strict';

const axios = require('axios');

// Meta error codes that mean the template is not available for this account/language.
const TEMPLATE_UNAVAILABLE = [132001];

// ── Extract phone number from a student/registration object or a plain string ──
const extractPhone = (recipientOrPhone) => {
  if (!recipientOrPhone) return null;
  if (typeof recipientOrPhone === 'string') return recipientOrPhone;
  return recipientOrPhone.whatsappNumber || recipientOrPhone.phone || null;
};

// ── Normalize to E.164 without '+' — prepend 91 for 10-digit Indian numbers ───
// Handles: 10-digit, +91 prefix, 91 prefix, leading-0 (07xxx → strip 0 → 91xxx)
const normalizePhone = (raw) => {
  let cleaned = String(raw).replace(/\D/g, '');
  // Strip a leading 0 that sometimes appears (e.g. 07339180919 → 7339180919)
  if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  // Prepend India country code for bare 10-digit numbers
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
};

// ── Serial message queue — prevents simultaneous API calls ───────────────────
let messageQueue = Promise.resolve();
const messageTracker = new Map();

const rememberMessage = (messageId, meta = {}) => {
  if (!messageId) return;
  messageTracker.set(messageId, {
    ...meta,
    status: 'accepted',
    acceptedAt: new Date().toISOString(),
  });
};

const updateTrackedMessage = (messageId, update = {}) => {
  if (!messageId) return null;
  const next = {
    ...(messageTracker.get(messageId) || {}),
    ...update,
    updatedAt: new Date().toISOString(),
  };
  messageTracker.set(messageId, next);
  return next;
};

/**
 * Core send: tries a named template first; falls back to plain text if the
 * template is unavailable (Meta error 132001) and fallbackText is set.
 *
 * @param {string}      phone        Recipient phone (any format)
 * @param {string|null} fallbackText Plain text used when template unavailable
 * @param {object}      opts         { templateName, languageCode, components }
 */
const sendMessage = (phone, fallbackText, opts = {}) => {
  // Each call captures its own result via a dedicated promise
  let resolveResult, rejectResult;
  const resultPromise = new Promise((res, rej) => {
    resolveResult = res;
    rejectResult  = rej;
  });

  messageQueue = messageQueue.then(async () => {
    await new Promise(r => setTimeout(r, 500)); // 500 ms between calls

    if (process.env.USE_META_API !== 'true') {
      const r = { success: false, reason: 'WhatsApp disabled' };
      console.log(`⏭️  [WhatsApp disabled] Skipping message to ${phone}. Set USE_META_API=true to enable.`);
      resolveResult(r);
      return;
    }

    const token   = process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const version = process.env.META_API_VERSION || process.env.WHATSAPP_VERSION || 'v19.0';

    if (!token || !phoneId) {
      const r = { success: false, reason: 'Missing Meta API credentials' };
      console.error('❌ Meta Cloud API config missing. Set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID in .env');
      resolveResult(r);
      return;
    }

    const to = normalizePhone(phone);

    // Guard: Reject obviously invalid numbers
    if (to.length < 10) {
      const r = { success: false, reason: 'Invalid phone number (too short)' };
      console.warn(`⚠️  [WhatsApp skipped] Phone "${phone}" → "${to}" is too short/invalid.`);
      resolveResult(r);
      return;
    }

    const url     = `https://graph.facebook.com/${version}/${phoneId}/messages`;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const buildPayload = (useTemplate) => {
      const payload = { messaging_product: 'whatsapp', to };
      if (useTemplate && opts.templateName) {
        payload.type     = 'template';
        payload.template = {
          name    : opts.templateName,
          language: { code: opts.languageCode || 'en' },
        };
        if (opts.components) payload.template.components = opts.components;
      } else {
        payload.type = 'text';
        payload.text = { body: fallbackText || 'Hello from KJ Dance Studio!' };
      }
      return payload;
    };

    // Attempt 1: template
    if (opts.templateName) {
      try {
        const res = await axios.post(url, buildPayload(true), { headers });
        const messageId = res.data.messages?.[0]?.id;
        rememberMessage(messageId, { to, templateName: opts.templateName, type: 'template' });
        console.log(`✅ [WhatsApp sent] Template "${opts.templateName}" → ${to} | ID: ${messageId}`);
        resolveResult({ success: true, accepted: true, messageId, to, response: res.data });
        return;
      } catch (err) {
        const code   = err.response?.data?.error?.code;
        const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
        if (TEMPLATE_UNAVAILABLE.includes(code) && fallbackText) {
          console.warn(`⚠️  Template "${opts.templateName}" unavailable (${code}). Trying plain-text fallback...`);
        } else {
          console.error(`❌ [WhatsApp failed] Template "${opts.templateName}" → ${to}:`, errMsg);
          resolveResult({ success: false, reason: errMsg });
          return;
        }
      }
    }

    // Attempt 2: plain-text fallback
    try {
      const res = await axios.post(url, buildPayload(false), { headers });
      const messageId = res.data.messages?.[0]?.id;
      rememberMessage(messageId, { to, type: 'text', usedFallback: true });
      console.log(`✅ [WhatsApp sent] Plain-text fallback → ${to} | ID: ${messageId}`);
      resolveResult({ success: true, accepted: true, messageId, to, response: res.data, usedFallback: true });
    } catch (err) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      console.error(`❌ [WhatsApp failed] Plain-text fallback → ${to}:`, errMsg);
      resolveResult({ success: false, reason: errMsg });
    }
  }).catch(err => {
    // Prevent queue from breaking on unexpected errors
    console.error(`❌ [WhatsApp queue error] for ${phone}:`, err.message);
    resolveResult({ success: false, reason: err.message });
    return Promise.resolve(); // keep queue alive
  });

  return resultPromise;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Public helpers — first arg accepts a student/registration object OR a
//  plain phone-number string (backwards-compatible with all controllers).
// ─────────────────────────────────────────────────────────────────────────────

exports.sendWelcomeMessage = (recipientOrPhone, studentName, classType) => {
  const phone = extractPhone(recipientOrPhone);
  if (!phone) return Promise.resolve({ success: false, reason: 'No phone number' });

  const name = studentName || 'Student';
  const cls  = classType   || 'Dance Class';

  // Template: kj_welcome (Utility)
  // Body: "Your enrollment at KJ Dance Studio is confirmed, {{1}}. You have been registered for {{2}}. Contact us for any queries."
  // {{1}} = name, {{2}} = classType
  const fallback =
    `Your enrollment at KJ Dance Studio is confirmed, ${name}. ` +
    `You have been registered for ${cls}. Contact us for any queries.`;

  return sendMessage(phone, fallback, {
    templateName: 'kj_welcome',
    languageCode: 'en',
    components  : [{ type: 'body', parameters: [
      { type: 'text', text: name },
      { type: 'text', text: cls  },
    ]}]
  });
};

exports.sendPendingFeesAlert = (recipientOrPhone, studentName, pendingMonths, totalDue) => {
  const phone = extractPhone(recipientOrPhone);
  if (!phone) return Promise.resolve({ success: false, reason: 'No phone number' });

  const name   = studentName   || 'Student';
  const due    = String(totalDue);
  const months = String(pendingMonths);

  const fallback =
    `Hi ${name}, this is a reminder that your fee of Rs.${due} is pending ` +
    `for ${months} month(s) at KJ Dance Studio. Please clear it soon. 🙏`;

  return sendMessage(phone, fallback, {
    templateName: 'fee_remainder',
    languageCode: 'en',
    components  : [{ type: 'body', parameters: [
      { type: 'text', text: name },
      { type: 'text', text: due  },
      { type: 'text', text: months },
    ]}]
  });
};

exports.sendPaymentReceipt = (recipientOrPhone, studentName, amount, purpose, paymentDate, balance) => {
  const phone = extractPhone(recipientOrPhone);
  if (!phone) return Promise.resolve({ success: false, reason: 'No phone number' });

  const name = studentName || 'Student';
  const amt  = String(amount);
  const purp = purpose     || 'Monthly Fee';
  const date = paymentDate || new Date().toLocaleDateString('en-IN');

  let balanceLine = '';
  if (balance !== undefined && balance > 0)  balanceLine = ` Balance remaining: Rs.${balance}.`;
  else if (balance === 0)                     balanceLine = ' Balance: Nil (Full Payment).';

  // Template: kj_payment (Utility)
  // Body: "Payment confirmation: Rs.{{2}} has been received from {{1}} at KJ Dance Studio. This serves as your official payment receipt. Please retain this for your records."
  // {{1}} = name, {{2}} = amount
  const fallback =
    `Payment confirmation: Rs.${amt} has been received from ${name} at KJ Dance Studio. ` +
    `Purpose: ${purp}. Date: ${date}.${balanceLine} Please retain this for your records.`;

  return sendMessage(phone, fallback, {
    templateName: 'kj_payment',
    languageCode: 'en',
    components  : [{ type: 'body', parameters: [
      { type: 'text', text: name },
      { type: 'text', text: amt  },
    ]}]
  });
};

exports.sendRejoinMessage = (recipientOrPhone, studentName, classType) => {
  const phone = extractPhone(recipientOrPhone);
  if (!phone) return Promise.resolve({ success: false, reason: 'No phone number' });

  const name = studentName || 'Student';

  // Template: kj_rejoin (Utility)
  // Body: "Hi {{1}}, your account status at KJ Dance Studio has been updated. Please contact the studio for more information."
  // {{1}} = name only
  const fallback =
    `Hi ${name}, your account status at KJ Dance Studio has been updated. ` +
    `Please contact the studio for more information.`;

  return sendMessage(phone, fallback, {
    templateName: 'kj_rejoin',
    languageCode: 'en',
    components  : [{ type: 'body', parameters: [
      { type: 'text', text: name },
    ]}]
  });
};

exports.sendRegistrationConfirmation = (recipientOrPhone, studentName, classType) => {
  const phone = extractPhone(recipientOrPhone);
  if (!phone) return Promise.resolve({ success: false, reason: 'No phone number' });

  const name = studentName || 'Student';
  const cls  = classType   || 'Dance';

  const fallback =
    `Hi ${name}, thank you for registering with KJ Dance Studio! ` +
    `Your request to join the ${cls} class is pending approval. We will contact you soon! 🎉`;

  return sendMessage(phone, fallback, {
    templateName: 'registration_received',
    languageCode: 'en',
    components  : [{ type: 'body', parameters: [
      { type: 'text', text: name },
      { type: 'text', text: cls  },
    ]}]
  });
};

// ── Status (used by /health endpoint) ────────────────────────────────────────
exports.getStatus = () => ({
  provider  : 'Meta Cloud API',
  isReady   : process.env.USE_META_API === 'true' &&
              !!(process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN) &&
              !!(process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID),
  apiEnabled: process.env.USE_META_API === 'true',
  trackedMessages: messageTracker.size,
});

exports.getMessageStatus = (messageId) => messageTracker.get(messageId) || null;

exports.handleWebhook = (body) => {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const statuses = value?.statuses || [];

  for (const status of statuses) {
    const messageId = status.id;
    const errors = status.errors || [];
    const tracked = updateTrackedMessage(messageId, {
      status: status.status,
      recipient: status.recipient_id,
      timestamp: status.timestamp,
      conversation: status.conversation,
      pricing: status.pricing,
      errors,
    });

    const recipient = status.recipient_id || tracked?.to || 'unknown';
    if (status.status === 'failed') {
      console.error(`[WhatsApp delivery failed] ${messageId} to ${recipient}: ${JSON.stringify(errors)}`);
    } else {
      console.log(`[WhatsApp delivery ${status.status}] ${messageId} to ${recipient}`);
    }
  }

  return { statuses: statuses.length };
};

// ── No-ops — kept so index.js doesn't crash ───────────────────────────────────
exports.initWhatsApp    = () => {};
exports.destroyWhatsApp = () => Promise.resolve();
