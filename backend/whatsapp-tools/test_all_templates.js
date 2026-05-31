'use strict';

require('dotenv').config();
const axios = require('axios');

const token =
  process.env.META_ACCESS_TOKEN ||
  process.env.WHATSAPP_ACCESS_TOKEN;

const phoneId =
  process.env.META_PHONE_NUMBER_ID ||
  process.env.WHATSAPP_PHONE_NUMBER_ID;

const wabaId =
  process.env.META_WABA_ID ||
  process.env.WHATSAPP_WABA_ID;

const version =
  process.env.META_API_VERSION ||
  process.env.WHATSAPP_VERSION ||
  'v19.0';

const testPhone = process.argv[2] || process.env.TEST_PHONE;

const targetTemplates = [
  'rejoin_message',
  'welcome_message',
  'payment_remainder_r',
  'payment_received',
  'fee_remainder',
  'hello_world',
];

const normalizePhone = (raw) => {
  let cleaned = String(raw || '').replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = `91${cleaned}`;
  return cleaned;
};

const findPlaceholderCount = (text = '') => {
  const matches = [...String(text).matchAll(/\{\{\s*(\d+)\s*\}\}/g)];
  if (!matches.length) return 0;
  return Math.max(...matches.map((match) => Number(match[1])));
};

const sampleValue = (index) => {
  const values = [
    'Praveen',
    '3500',
    'Dance Class',
    '31/05/2026',
    'KJ Dance Studio',
    '1',
  ];
  return values[index - 1] || `Test ${index}`;
};

const buildComponents = (template) => {
  const components = [];

  for (const component of template.components || []) {
    const type = component.type;

    if (type === 'HEADER') {
      const count = findPlaceholderCount(component.text);
      if (count > 0) {
        components.push({
          type: 'header',
          parameters: Array.from({ length: count }, (_, i) => ({
            type: 'text',
            text: sampleValue(i + 1),
          })),
        });
      }
    }

    if (type === 'BODY') {
      const count = findPlaceholderCount(component.text);
      if (count > 0) {
        components.push({
          type: 'body',
          parameters: Array.from({ length: count }, (_, i) => ({
            type: 'text',
            text: sampleValue(i + 1),
          })),
        });
      }
    }

    if (type === 'BUTTONS') {
      component.buttons?.forEach((button, index) => {
        const count = findPlaceholderCount(button.url || button.text);
        if (button.type === 'URL' && count > 0) {
          components.push({
            type: 'button',
            sub_type: 'url',
            index: String(index),
            parameters: [{ type: 'text', text: 'test' }],
          });
        }
      });
    }
  }

  return components;
};

const requireEnv = () => {
  const missing = [];
  if (!token) missing.push('META_ACCESS_TOKEN or WHATSAPP_ACCESS_TOKEN');
  if (!phoneId) missing.push('META_PHONE_NUMBER_ID or WHATSAPP_PHONE_NUMBER_ID');
  if (!wabaId) missing.push('META_WABA_ID or WHATSAPP_WABA_ID');
  if (!testPhone) missing.push('TEST_PHONE or CLI phone argument');

  if (missing.length) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }
};

const fetchTemplates = async () => {
  const url = `https://graph.facebook.com/${version}/${wabaId}/message_templates`;
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    params: { fields: 'name,status,language,category,components' },
  });

  return response.data.data || [];
};

const sendTemplate = async (template, to) => {
  const components = buildComponents(template);
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.language },
      ...(components.length ? { components } : {}),
    },
  };

  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    id: response.data.messages?.[0]?.id,
    payload,
  };
};

const main = async () => {
  requireEnv();

  const to = normalizePhone(testPhone);
  const templates = await fetchTemplates();
  const byName = new Map(templates.map((template) => [template.name, template]));

  console.log(`Testing ${targetTemplates.length} templates to ${to}`);
  console.log('');

  for (const name of targetTemplates) {
    const template = byName.get(name);

    if (!template) {
      console.log(`MISSING  ${name}`);
      continue;
    }

    if (template.status !== 'APPROVED') {
      console.log(`SKIP     ${name} (${template.status})`);
      continue;
    }

    try {
      const result = await sendTemplate(template, to);
      console.log(`OK       ${name} (${template.language}) -> ${result.id}`);
    } catch (err) {
      const error = err.response?.data?.error;
      const detail = error
        ? `${error.message} | code=${error.code || '-'} subcode=${error.error_subcode || '-'}`
        : err.message;
      console.log(`FAILED   ${name} -> ${detail}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }
};

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
