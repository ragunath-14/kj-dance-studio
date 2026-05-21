const axios = require('axios');

// ── Global Message Queue ─────────────────────────────────────────────────────
// This ensures that even if many notifications are triggered, they are sent
// in a orderly sequence with a small delay between them.
let messageQueue = Promise.resolve();

/**
 * Sends a WhatsApp message via Meta Cloud API.
 */
const sendMessage = async (whatsappNumber, message, options = {}) => {
  // Add this message to the global queue
  messageQueue = messageQueue.then(async () => {
    // Small delay (500ms) between messages to keep calls orderly
    await new Promise(resolve => setTimeout(resolve, 500));

    const token = process.env.META_ACCESS_TOKEN;
    const phoneId = process.env.META_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_API_VERSION || 'v19.0';
    
    if (!token || !phoneId) {
      const errMsg = 'Meta Cloud API config missing. Please set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID in .env';
      console.error(`❌ ${errMsg}`);
      return { success: false, reason: errMsg };
    }

    // Clean number — digits only
    let cleanedNumber = whatsappNumber.replace(/\D/g, '');
    if (cleanedNumber.length === 10) cleanedNumber = '91' + cleanedNumber;

    const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    let payload = {
      messaging_product: 'whatsapp',
      to: cleanedNumber,
    };

    if (options.templateName) {
      payload.type = 'template';
      payload.template = {
        name: options.templateName,
        language: { code: options.languageCode || 'en' },
      };
      if (options.components) {
        payload.template.components = options.components;
      }
    } else {
      payload.type = 'text';
      payload.text = {
        body: message || options.textContent || "Hello!"
      };
    }

    try {
      const response = await axios.post(url, payload, { headers });
      const msgId = response.data.messages?.[0]?.id;
      console.log(`✅ Meta WhatsApp message sent to ${cleanedNumber}. Message ID: ${msgId}`);
      return { success: true, response: response.data };
    } catch (error) {
      const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      console.error(`❌ Meta WhatsApp Cloud API Error for ${cleanedNumber}:`, errorMsg);
      return { success: false, reason: errorMsg };
    }
  });

  return messageQueue;
};

// ──────────────────────────────────────────────────────────────────────────────
// Public helpers (Mapped to Meta Message Templates)
// ──────────────────────────────────────────────────────────────────────────────

exports.sendWelcomeMessage = async (whatsappNumber, studentName, classType, batchTiming) => {
  return sendMessage(whatsappNumber, null, {
    templateName: 'welcome_message_marketing',
    languageCode: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: studentName || 'Student' },
          { type: 'text', text: classType || 'Dance' },
          { type: 'text', text: batchTiming || 'TBA' }
        ]
      }
    ]
  });
};

exports.sendPendingFeesAlert = async (studentId, whatsappNumber, studentName, pendingMonths, totalDue) => {
  return sendMessage(whatsappNumber, null, {
    templateName: 'payment_remainder_marketing',
    languageCode: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: studentName || 'Student' },
          { type: 'text', text: String(totalDue) },
          { type: 'text', text: String(pendingMonths) }
        ]
      }
    ]
  });
};

exports.sendPaymentConfirmation = async (whatsappNumber, studentName, amount, purpose, date) => {
  const formattedDate = date || new Date().toLocaleDateString('en-IN');
  return sendMessage(whatsappNumber, null, {
    templateName: 'payment_completed_marketing',
    languageCode: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: studentName || 'Student' },
          { type: 'text', text: String(amount) },
          { type: 'text', text: purpose || 'Monthly Fee' },
          { type: 'text', text: formattedDate }
        ]
      }
    ]
  });
};

exports.sendMessage = sendMessage;
