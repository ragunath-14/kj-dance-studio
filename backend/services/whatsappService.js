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
 * Core send function. Tries a template first; if the template is PENDING or
 * not found (Meta error 132001/132000), it automatically retries with the
 * provided plain-text fallback so the student still receives a message.
 *
 * @param {string}  whatsappNumber  - Recipient's phone number (any format)
 * @param {string|null} fallbackText - Plain text to send if template fails
 * @param {object}  options         - { templateName, languageCode, components }
 */
const sendMessage = async (whatsappNumber, fallbackText, options = {}) => {
  messageQueue = messageQueue.then(async () => {
    // Small delay (500ms) between messages to keep calls orderly
    await new Promise(resolve => setTimeout(resolve, 500));

    // ── WhatsApp kill-switch: set USE_META_API=false to disable all sends ────
    if (process.env.USE_META_API !== 'true') {
      console.log(`⏭️  [WhatsApp disabled] Skipping message to ${whatsappNumber}. Set USE_META_API=true to enable.`);
      return { success: false, reason: 'WhatsApp disabled via USE_META_API env flag' };
    }

    const token      = process.env.META_ACCESS_TOKEN;
    const phoneId    = process.env.META_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_API_VERSION || 'v19.0';

    if (!token || !phoneId) {
      const errMsg = 'Meta Cloud API config missing. Please set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID in .env';
      console.error(`❌ ${errMsg}`);
      return { success: false, reason: errMsg };
    }

    // Clean number — digits only, prepend India country code if 10 digits
    let cleanedNumber = whatsappNumber.replace(/\D/g, '');
    if (cleanedNumber.length === 10) cleanedNumber = '91' + cleanedNumber;

    const url     = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // ── Helper: build payload ────────────────────────────────────────────────
    const buildPayload = (useTemplate) => {
      const payload = { messaging_product: 'whatsapp', to: cleanedNumber };
      if (useTemplate && options.templateName) {
        payload.type = 'template';
        payload.template = {
          name: options.templateName,
          language: { code: options.languageCode || 'en' },
        };
        if (options.components) payload.template.components = options.components;
      } else {
        payload.type = 'text';
        payload.text = { body: fallbackText || options.textContent || 'Hello from Expressionz Dance Studio!' };
      }
      return payload;
    };

    // ── Attempt 1: Send via approved template ────────────────────────────────
    if (options.templateName) {
      try {
        const response = await axios.post(url, buildPayload(true), { headers });
        const msgId = response.data.messages?.[0]?.id;
        console.log(`✅ [Template: ${options.templateName}] WhatsApp sent to ${cleanedNumber}. ID: ${msgId}`);
        return { success: true, response: response.data };
      } catch (error) {
        const errData  = error.response?.data?.error;
        const errCode  = errData?.code;
        const errMsg   = error.response ? JSON.stringify(error.response.data) : error.message;

        if (TEMPLATE_UNAVAILABLE_CODES.includes(errCode) && fallbackText) {
          // Template is still PENDING approval — fall through to plain text
          console.warn(
            `⚠️ Template "${options.templateName}" is not yet approved by Meta (code ${errCode}).` +
            ` Sending plain-text fallback to ${cleanedNumber}...`
          );
        } else {
          // Any other error — log and return failure
          console.error(`❌ Meta WhatsApp Cloud API Error for ${cleanedNumber}:`, errMsg);
          return { success: false, reason: errMsg };
        }
      }
    }

    // ── Attempt 2: Plain-text fallback ───────────────────────────────────────
    try {
      const response = await axios.post(url, buildPayload(false), { headers });
      const msgId = response.data.messages?.[0]?.id;
      console.log(`✅ [Plain-text fallback] WhatsApp sent to ${cleanedNumber}. ID: ${msgId}`);
      return { success: true, response: response.data, usedFallback: true };
    } catch (error) {
      const errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      console.error(`❌ Meta WhatsApp plain-text fallback also failed for ${cleanedNumber}:`, errMsg);
      return { success: false, reason: errMsg };
    }
  });

  return messageQueue;
};

// ── Public helpers ────────────────────────────────────────────────────────────
// Each helper provides a rich plain-text fallback so messages still go through
// while Meta templates are in PENDING state.
// Once templates are APPROVED, they will be used automatically — no code change needed.
// ─────────────────────────────────────────────────────────────────────────────

exports.sendWelcomeMessage = async (whatsappNumber, studentName, classType, batchTiming) => {
  const name   = studentName || 'Student';
  const cls    = classType   || 'Dance';
  const timing = batchTiming || 'TBA';

  const fallback =
    `Hi ${name}, welcome to Expressionz Dance Studio! ` +
    `You are enrolled in ${cls} class. Batch timing: ${timing}. We are excited to have you!`;

  // Tries 'welcome_student' (PENDING — freshly submitted).
  // Falls back to hello_world (APPROVED) if still pending,
  // which will be caught by TEMPLATE_UNAVAILABLE_CODES and use the plain-text fallback.
  return sendMessage(whatsappNumber, fallback, {
    templateName : 'welcome_student',
    languageCode : 'en',
    components   : [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: name   },
          { type: 'text', text: cls    },
          { type: 'text', text: timing }
        ]
      }
    ]
  });
};

exports.sendPendingFeesAlert = async (studentId, whatsappNumber, studentName, pendingMonths, totalDue) => {
  const name   = studentName  || 'Student';
  const due    = String(totalDue);
  const months = String(pendingMonths);

  const fallback =
    `Hi ${name}, this is a reminder that your fee of Rs.${due} is pending for ${months} month(s) ` +
    `at Expressionz Dance Studio. Please clear it soon.`;

  return sendMessage(whatsappNumber, fallback, {
    templateName : 'fee_reminder',
    languageCode : 'en',
    components   : [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: name   },
          { type: 'text', text: due    },
          { type: 'text', text: months }
        ]
      }
    ]
  });
};

exports.sendPaymentConfirmation = async (whatsappNumber, studentName, amount, purpose, date) => {
  const name          = studentName || 'Student';
  const formattedDate = date || new Date().toLocaleDateString('en-IN');
  const amt           = String(amount);
  const purp          = purpose || 'Monthly Fee';

  const fallback =
    `Hi ${name}, we received your payment of Rs.${amt} for ${purp} on ${formattedDate} ` +
    `at Expressionz Dance Studio. Thank you!`;

  return sendMessage(whatsappNumber, fallback, {
    templateName : 'payment_receipt',
    languageCode : 'en',
    components   : [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: name          },
          { type: 'text', text: amt           },
          { type: 'text', text: purp          },
          { type: 'text', text: formattedDate }
        ]
      }
    ]
  });
};

exports.sendRegistrationConfirmation = async (whatsappNumber, studentName, classType) => {
  const name = studentName || 'Student';
  const cls  = classType   || 'Dance';

  const fallback =
    `Hi ${name}, thank you for registering with Expressionz Dance Studio! ` +
    `Your request to join the ${cls} class has been received and is pending approval. We will contact you soon!`;

  return sendMessage(whatsappNumber, fallback, {
    templateName : 'registration_received',
    languageCode : 'en',
    components   : [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: cls  }
        ]
      }
    ]
  });
};

exports.sendMessage = sendMessage;
