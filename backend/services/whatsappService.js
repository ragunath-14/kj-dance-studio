const axios = require('axios');

// ── Global Message Queue ─────────────────────────────────────────────────────
// Ensures all notifications are sent in an orderly sequence with a small
// delay between them, even if many are triggered simultaneously.
let messageQueue = Promise.resolve();

// ── Meta error codes that mean "template not usable right now" ───────────────
// 132001 = template name doesn't exist / still PENDING approval
// 132000 = template paused / rejected
const TEMPLATE_UNAVAILABLE_CODES = [132001, 132000];

/**
 * Core send function — Meta Cloud API only.
 *
 * Tries an approved template first. If the template is PENDING or not found
 * (Meta error 132001/132000) AND a fallbackText is provided, it automatically
 * retries with a plain-text message so the student still receives something.
 *
 * @param {string}      whatsappNumber  Recipient phone number (any format)
 * @param {string|null} fallbackText    Plain text sent if template is unavailable
 * @param {object}      options         { templateName, languageCode, components }
 */
const sendMessage = async (whatsappNumber, fallbackText, options = {}) => {
  messageQueue = messageQueue.then(async () => {
    // Small delay (500 ms) between messages to keep calls orderly
    await new Promise(resolve => setTimeout(resolve, 500));

    // ── Kill-switch: set USE_META_API=false to disable all sends ─────────
    if (process.env.USE_META_API !== 'true') {
      console.log(`⏭️  [WhatsApp disabled] Skipping message to ${whatsappNumber}. Set USE_META_API=true to enable.`);
      return { success: false, reason: 'WhatsApp disabled via USE_META_API env flag' };
    }

    const token      = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId    = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_VERSION || 'v19.0';

    if (!token || !phoneId) {
      const errMsg = 'WhatsApp API config missing. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment variables.';
      console.error(`❌ ${errMsg}`);
      return { success: false, reason: errMsg };
    }

    // Normalise number — digits only; prepend India (+91) for 10-digit numbers
    let cleanedNumber = whatsappNumber.replace(/\D/g, '');
    if (cleanedNumber.length === 10) cleanedNumber = '91' + cleanedNumber;

    const url     = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // ── Helper: build request payload ────────────────────────────────────
    const buildPayload = (useTemplate) => {
      const payload = { messaging_product: 'whatsapp', to: cleanedNumber };
      if (useTemplate && options.templateName) {
        payload.type = 'template';
        payload.template = {
          name    : options.templateName,
          language: { code: options.languageCode || 'en' },
        };
        if (options.components) payload.template.components = options.components;
      } else {
        payload.type = 'text';
        payload.text = { body: fallbackText || 'Hello from Expressionz Dance Studio!' };
      }
      return payload;
    };

    // ── Attempt 1: Send via approved template ────────────────────────────
    if (options.templateName) {
      try {
        const response = await axios.post(url, buildPayload(true), { headers });
        const msgId = response.data.messages?.[0]?.id;
        console.log(`✅ [Template: ${options.templateName}] Sent to ${cleanedNumber}. ID: ${msgId}`);
        return { success: true, response: response.data };
      } catch (error) {
        const errData = error.response?.data?.error;
        const errCode = errData?.code;
        const errMsg  = error.response ? JSON.stringify(error.response.data) : error.message;

        if (TEMPLATE_UNAVAILABLE_CODES.includes(errCode) && fallbackText) {
          // Template still PENDING — fall through to plain-text fallback
          console.warn(
            `⚠️  Template "${options.templateName}" not yet approved (code ${errCode}).` +
            ` Sending plain-text fallback to ${cleanedNumber}...`
          );
        } else {
          console.error(`❌ Meta API error for ${cleanedNumber}:`, errMsg);
          return { success: false, reason: errMsg };
        }
      }
    }

    // ── Attempt 2: Plain-text fallback ───────────────────────────────────
    try {
      const response = await axios.post(url, buildPayload(false), { headers });
      const msgId = response.data.messages?.[0]?.id;
      console.log(`✅ [Plain-text fallback] Sent to ${cleanedNumber}. ID: ${msgId}`);
      return { success: true, response: response.data, usedFallback: true };
    } catch (error) {
      const errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      console.error(`❌ Plain-text fallback also failed for ${cleanedNumber}:`, errMsg);
      return { success: false, reason: errMsg };
    }
  });

  return messageQueue;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Public messaging helpers
//  Each helper provides a rich plain-text fallback so messages still go through
//  while Meta templates are in PENDING review state.
//  Once templates are APPROVED, they are used automatically — no code changes needed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sent when a student is enrolled or a registration is approved.
 * Template body: "Your enrollment at KJ Dance Studio is confirmed, {{1}}.
 *                 You have been registered for {{2}}. Contact us for any queries."
 * Params: {{1}} = name, {{2}} = classType
 */
exports.sendWelcomeMessage = async (whatsappNumber, studentName, classType, batchTiming) => {
  const name   = studentName || 'Student';
  const cls    = classType   || 'Dance';
  const timing = batchTiming || 'TBA'; // kept for callers; not in template

  const fallback =
    `Your enrollment at KJ Dance Studio is confirmed, ${name}. ` +
    `You have been registered for ${cls}. ` +
    (timing !== 'TBA' ? `Batch timing: ${timing}. ` : '') +
    `Contact us for any queries. 💃`;

  return sendMessage(whatsappNumber, fallback, {
    templateName: 'kj_welcome',
    languageCode: 'en',
    components  : [{
      type      : 'body',
      parameters: [
        { type: 'text', text: name },
        { type: 'text', text: cls  }
      ]
    }]
  });
};

/**
 * Fee due alert — sent by the daily scheduler and manual reminder routes.
 * NOTE: studentId parameter is accepted but intentionally unused here;
 * it is passed by some callers for logging convenience only.
 */
exports.sendPendingFeesAlert = async (studentId, whatsappNumber, studentName, pendingMonths, totalDue) => {
  const name   = studentName   || 'Student';
  const due    = String(totalDue);
  const months = String(pendingMonths);

  const fallback =
    `Hi ${name}, this is a reminder that your fee of Rs.${due} is pending ` +
    `for ${months} month(s) at Expressionz Dance Studio. Please clear it soon. 🙏`;

  return sendMessage(whatsappNumber, fallback, {
    templateName: 'fee_remainder',
    languageCode: 'en',
    components  : [{
      type      : 'body',
      parameters: [
        { type: 'text', text: name   },
        { type: 'text', text: due    },
        { type: 'text', text: months }
      ]
    }]
  });
};

/**
 * Payment confirmation — sent immediately after a payment is recorded.
 * Template body: "Payment confirmation: Rs.{{2}} has been received from {{1}} at KJ Dance
 *                 Studio. This serves as your official payment receipt."
 * Params: {{1}} = name, {{2}} = amount
 */
exports.sendPaymentConfirmation = async (whatsappNumber, studentName, amount, purpose, date) => {
  const name          = studentName || 'Student';
  const formattedDate = date || new Date().toLocaleDateString('en-IN');
  const amt           = String(amount);
  const purp          = purpose || 'Monthly Fee';

  const fallback =
    `Payment confirmation: Rs.${amt} has been received from ${name} at KJ Dance Studio ` +
    `for ${purp} on ${formattedDate}. This serves as your official payment receipt. 🎉`;

  return sendMessage(whatsappNumber, fallback, {
    templateName: 'kj_payment',
    languageCode: 'en',
    components  : [{
      type      : 'body',
      parameters: [
        { type: 'text', text: name },
        { type: 'text', text: amt  }
      ]
    }]
  });
};

/**
 * Alias for sendPaymentConfirmation — used by controllers that call sendPaymentReceipt.
 */
exports.sendPaymentReceipt = exports.sendPaymentConfirmation;

/**
 * Sent when a public registration form is submitted (pending approval).
 * Uses kj_welcome template: {{1}} = name, {{2}} = classType
 */
exports.sendRegistrationConfirmation = async (whatsappNumber, studentName, classType) => {
  const name = studentName || 'Student';
  const cls  = classType   || 'Dance';

  const fallback =
    `Your enrollment at KJ Dance Studio is confirmed, ${name}. ` +
    `You have been registered for ${cls}. Contact us for any queries. 🎉`;

  return sendMessage(whatsappNumber, fallback, {
    templateName: 'kj_welcome',
    languageCode: 'en',
    components  : [{
      type      : 'body',
      parameters: [
        { type: 'text', text: name },
        { type: 'text', text: cls  }
      ]
    }]
  });
};

/**
 * Rejoin invitation — sent to inactive students on their monthly anniversary.
 * Template body: "Hi {{1}}, your account status at KJ Dance Studio has been updated.
 *                 Please contact the studio for more information."
 * Params: {{1}} = name only
 */
exports.sendRejoinMessage = async (whatsappNumber, studentName, classType) => {
  const name = studentName || 'Student';
  const cls  = classType   || 'Dance'; // kept for callers; not in template

  const fallback =
    `Hi ${name}, your account status at KJ Dance Studio has been updated. ` +
    `We'd love to have you back in ${cls} class! Please contact the studio for more information. 💃`;

  return sendMessage(whatsappNumber, fallback, {
    templateName: 'kj_rejoin',
    languageCode: 'en',
    components  : [{
      type      : 'body',
      parameters: [
        { type: 'text', text: name }
      ]
    }]
  });
};

/**
 * Returns the current WhatsApp service status (used by /health endpoint).
 */
exports.getStatus = () => ({
  provider  : 'Meta Cloud API',
  isReady   : process.env.USE_META_API === 'true' &&
              !!process.env.WHATSAPP_ACCESS_TOKEN &&
              !!process.env.WHATSAPP_PHONE_NUMBER_ID,
  apiEnabled: process.env.USE_META_API === 'true',
  dailyLimit: null, // Meta Cloud API manages its own rate limits
});
