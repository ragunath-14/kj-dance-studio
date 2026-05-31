'use strict';

const axios = require('axios');

// Meta error codes that mean the template is not yet usable
const TEMPLATE_UNAVAILABLE = [132001, 132000];

// ── Extract phone number from a student/registration object or a plain string ──
const extractPhone = (recipientOrPhone) => {
  if (!recipientOrPhone) return null;
  if (typeof recipientOrPhone === 'string') return recipientOrPhone;
  return recipientOrPhone.whatsappNumber || recipientOrPhone.phone || null;
};

// ── Normalize to E.164 without '+' — prepend 91 for 10-digit Indian numbers ───
const normalizePhone = (raw) => {
  let cleaned = String(raw).replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
};

// ── Serial message queue — prevents simultaneous API calls ───────────────────
let messageQueue = Promise.resolve();

/**
 * Core send: tries a named template first; falls back to plain text if the
 * template is still PENDING (Meta error 132001/132000) and fallbackText is set.
 *
 * @param {string}      phone        Recipient phone (any format)
 * @param {string|null} fallbackText Plain text used when template unavailable
 * @param {object}      opts         { templateName, languageCode, components }
 */
const sendMessage = (phone, fallbackText, opts = {}) => {
  messageQueue = messageQueue.then(async () => {
    await new Promise(r => setTimeout(r, 500)); // 500 ms between calls

    if (process.env.USE_META_API !== 'true') {
      console.log(`⏭️  [WhatsApp disabled] Skipping message to ${phone}. Set USE_META_API=true to enable.`);
      return { success: false, reason: 'WhatsApp disabled' };
    }

    const token   = process.env.META_ACCESS_TOKEN;
    const phoneId = process.env.META_PHONE_NUMBER_ID;
    const version = process.env.META_API_VERSION || 'v19.0';

    if (!token || !phoneId) {
      console.error('❌ Meta Cloud API config missing. Set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID in .env');
      return { success: false, reason: 'Missing Meta API credentials' };
    }

    const to      = normalizePhone(phone);
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
        console.log(`✅ [Template: ${opts.templateName}] Sent to ${to}. ID: ${res.data.messages?.[0]?.id}`);
        return { success: true, response: res.data };
      } catch (err) {
        const code   = err.response?.data?.error?.code;
        const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
        if (TEMPLATE_UNAVAILABLE.includes(code) && fallbackText) {
          console.warn(`⚠️  Template "${opts.templateName}" pending (code ${code}). Sending plain-text fallback to ${to}…`);
        } else {
          console.error(`❌ Meta API error for ${to}:`, errMsg);
          return { success: false, reason: errMsg };
        }
      }
    }

    // Attempt 2: plain-text fallback
    try {
      const res = await axios.post(url, buildPayload(false), { headers });
      console.log(`✅ [Plain-text fallback] Sent to ${to}. ID: ${res.data.messages?.[0]?.id}`);
      return { success: true, response: res.data, usedFallback: true };
    } catch (err) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      console.error(`❌ Plain-text fallback failed for ${to}:`, errMsg);
      return { success: false, reason: errMsg };
    }
  });

  return messageQueue;
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

  const fallback =
    `Hi ${name}, welcome to KJ Dance Studio! ` +
    `You have been enrolled in ${cls}. We are excited to have you! 💃`;

  return sendMessage(phone, fallback, {
    templateName: 'welcome_message',
    languageCode: 'en',
    components  : [{ type: 'body', parameters: [
      { type: 'text', text: name },
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
    templateName: 'payment_remainder_r',
    languageCode: 'en',
    components  : [{ type: 'body', parameters: [
      { type: 'text', text: name },
      { type: 'text', text: due  },
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
  else if (balance === 0)                     balanceLine = ' Balance: Nil (Full Payment) ✅';

  const fallback =
    `Hi ${name}, we received your payment of Rs.${amt} for ${purp} on ${date} ` +
    `at KJ Dance Studio.${balanceLine} Thank you! 🎉`;

  return sendMessage(phone, fallback, {
    templateName: 'payment_received',
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
  const cls  = classType   || 'Dance';

  const fallback =
    `Hi ${name}, we miss you at KJ Dance Studio! 💃 ` +
    `Our new batches for ${cls} have started and we'd love to have you back. ` +
    `Come visit us soon! 🙏`;

  return sendMessage(phone, fallback, {
    templateName: 'rejoin_message',
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
              !!process.env.META_ACCESS_TOKEN &&
              !!process.env.META_PHONE_NUMBER_ID,
  apiEnabled: process.env.USE_META_API === 'true',
});

// ── No-ops — kept so index.js doesn't crash ───────────────────────────────────
exports.initWhatsApp    = () => {};
exports.destroyWhatsApp = () => Promise.resolve();
