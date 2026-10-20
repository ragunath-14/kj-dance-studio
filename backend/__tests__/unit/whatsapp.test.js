'use strict';
/**
 * WhatsApp message code. The network call to Meta is replaced by a recorder, so nothing is ever sent.
 * Template names and the number of placeholders must match the templates approved on Meta:
 *   kj_welcome 2 ({{1}} name, {{2}} classes)   fee_remainder 3 (name, amount, months)
 *   kj_payment 2 (name, amount)                kj_rejoin 1 (name)
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const axios  = require('axios');

process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = '111';
process.env.WHATSAPP_VERSION = 'v19.0';
const whatsapp = require('../../services/whatsappService');

const realPost = axios.post;
const sent = [];
let failWith = null; // e.g. { code: 132001 } to simulate "template not approved"

test.beforeEach(() => {
  sent.length = 0; failWith = null;
  process.env.USE_META_API = 'true';
  axios.post = async (url, payload) => {
    sent.push({ url, payload });
    if (failWith && payload.type === 'template') { const e = new Error('meta'); e.response = { data: { error: { code: failWith.code, message: 'template' } } }; throw e; }
    return { data: { messages: [{ id: 'wamid.TEST' }] } };
  };
});
test.after(() => { axios.post = realPost; });

const params = (call) => call.payload.template.components[0].parameters.map(p => p.text);

test.describe('templates', () => {
  test('welcome: kj_welcome with name and class names', async () => {
    const r = await whatsapp.sendWelcomeMessage('9876543210', 'Asha', 'Karate Class + Zumba Class', 'Mon 5 PM');
    assert.equal(r.success, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].payload.template.name, 'kj_welcome');
    assert.deepEqual(params(sent[0]), ['Asha', 'Karate Class (join your class WhatsApp group: https://chat.whatsapp.com/Bcpoq6CxodK8blwdQ9FS3o) + Zumba Class (join your class WhatsApp group: https://chat.whatsapp.com/KrSaMAfrTOT8ulC4zM4zKq)']);
  });
  test('welcome: each class gets its own group link, classes without a group stay as they are', async () => {
    await whatsapp.sendWelcomeMessage('9876543210', 'Asha', 'Silambam Class + Art & Craft Class + Regular Class');
    const cls = params(sent[0])[1];
    assert.ok(cls.includes('Silambam Class (join your class WhatsApp group: https://chat.whatsapp.com/JXcZmiSn7cC2RqNNNBGs4h)'));
    assert.ok(cls.includes('Art & Craft Class (join your class WhatsApp group: https://chat.whatsapp.com/KVBcH5NPqv7L5VT7GKNiro)'));
    assert.ok(cls.endsWith(' + Regular Class'));
    assert.equal(sent[0].payload.template.name, 'kj_welcome');          // still the same approved template
    assert.equal(sent[0].payload.template.components[0].parameters.length, 2);
  });
  test('welcome text is one line (WhatsApp rejects line breaks inside a template variable)', async () => {
    await whatsapp.sendWelcomeMessage('9876543210', 'Asha', 'Karate Class + Zumba Class + Silambam Class + Art & Craft Class');
    assert.ok(!params(sent[0])[1].includes(String.fromCharCode(10)) && !params(sent[0])[1].includes(String.fromCharCode(9)));
    assert.ok(!/ {4,}/.test(params(sent[0])[1]));
  });
  test('welcome falls back to sensible defaults', async () => {
    await whatsapp.sendWelcomeMessage('9876543210');
    assert.deepEqual(params(sent[0]), ['Student', 'Dance']);
  });
  test('fee reminder: fee_remainder with name, amount and months', async () => {
    await whatsapp.sendPendingFeesAlert(null, '9876543210', 'Asha', 3, 3900);
    assert.equal(sent[0].payload.template.name, 'fee_remainder');
    assert.deepEqual(params(sent[0]), ['Asha', '3900', '3']);
  });
  test('payment confirmation: kj_payment with name and amount', async () => {
    await whatsapp.sendPaymentConfirmation('9876543210', 'Asha', 1300, 'Monthly Fee', '20/10/2026');
    assert.equal(sent[0].payload.template.name, 'kj_payment');
    assert.deepEqual(params(sent[0]), ['Asha', '1300']);
  });
  test('payment receipt is the same message', () => assert.equal(whatsapp.sendPaymentReceipt, whatsapp.sendPaymentConfirmation));
  test('rejoin invite: kj_rejoin with the name only', async () => {
    await whatsapp.sendRejoinMessage('9876543210', 'Asha', 'Karate Class');
    assert.equal(sent[0].payload.template.name, 'kj_rejoin');
    assert.deepEqual(params(sent[0]), ['Asha']);
  });
  test('registration confirmation and camp confirmation reuse the welcome template', async () => {
    await whatsapp.sendRegistrationConfirmation('9876543210', 'Asha', 'Regular Class');
    await whatsapp.sendCampConfirmation('9876543210', 'Asha');
    assert.deepEqual(sent.map(s => s.payload.template.name), ['kj_welcome', 'kj_welcome']);
    assert.deepEqual(params(sent[1]), ['Asha', 'Summer Camp']);
  });
  test('templates are sent in English', async () => {
    await whatsapp.sendWelcomeMessage('9876543210', 'Asha', 'Karate Class');
    assert.equal(sent[0].payload.template.language.code, 'en');
    assert.equal(sent[0].payload.messaging_product, 'whatsapp');
  });
});

test.describe('phone numbers and the on/off switch', () => {
  test('a 10-digit number gets the +91 prefix', async () => {
    await whatsapp.sendWelcomeMessage('9876543210', 'A', 'C');
    assert.equal(sent[0].payload.to, '919876543210');
  });
  test('spaces, dashes and + are removed; a full international number is kept', async () => {
    await whatsapp.sendWelcomeMessage('+91 98765-43210', 'A', 'C');
    await whatsapp.sendWelcomeMessage('+65 9868 0813', 'A', 'C');
    assert.equal(sent[0].payload.to, '919876543210');
    assert.equal(sent[1].payload.to, '6598680813');
  });
  test('normalizeNumber: India, international, 00 and trunk-0 forms', () => {
    const n = whatsapp.normalizeNumber;
    assert.equal(n('9876543210'), '919876543210');
    assert.equal(n('098765 43210'), '919876543210');
    assert.equal(n('+91 98765 43210'), '919876543210');
    assert.equal(n('+919876543210'), '919876543210');
    assert.equal(n('919876543210'), '919876543210');
    assert.equal(n('+6598680813'), '6598680813');        // Singapore: 10 digits but NOT an Indian number
    assert.equal(n('+65 9868 0813'), '6598680813');
    assert.equal(n('006598680813'), '6598680813');
    assert.equal(n('+1 (415) 555-2671'), '14155552671');
    assert.equal(n(''), '');
    assert.equal(n(undefined), '');
  });
  test('USE_META_API=false sends nothing', async () => {
    process.env.USE_META_API = 'false';
    const r = await whatsapp.sendWelcomeMessage('9876543210', 'Asha', 'Karate Class');
    assert.equal(r.success, false);
    assert.equal(sent.length, 0);
  });
  test('missing credentials send nothing and say why', async () => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const r = await whatsapp.sendWelcomeMessage('9876543210', 'Asha', 'Karate Class');
    process.env.WHATSAPP_ACCESS_TOKEN = token;
    assert.equal(r.success, false);
    assert.match(r.reason, /config missing/i);
    assert.equal(sent.length, 0);
  });
  test('the request goes to the configured phone number id', async () => {
    await whatsapp.sendWelcomeMessage('9876543210', 'A', 'C');
    assert.match(sent[0].url, /\/v19\.0\/111\/messages$/);
  });
  test('status reports ready only when enabled and configured', () => {
    assert.equal(whatsapp.getStatus().isReady, true);
    process.env.USE_META_API = 'false';
    assert.equal(whatsapp.getStatus().isReady, false);
    assert.equal(whatsapp.getStatus().apiEnabled, false);
  });
});

test.describe('failures', () => {
  test('a template that is not approved yet falls back to a plain-text message', async () => {
    failWith = { code: 132001 };
    const r = await whatsapp.sendWelcomeMessage('9876543210', 'Asha', 'Karate Class');
    assert.equal(r.success, true);
    assert.equal(r.usedFallback, true);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].payload.type, 'text');
    assert.match(sent[1].payload.text.body, /Asha/);
    assert.match(sent[1].payload.text.body, /KJ Dance Studio/);
  });
  test('the plain-text fallbacks use the KJ name (not an old studio name)', async () => {
    failWith = { code: 132001 };
    await whatsapp.sendPendingFeesAlert(null, '9876543210', 'Asha', 2, 2600);
    assert.match(sent[1].payload.text.body, /KJ Dance Studio/);
    assert.doesNotMatch(sent[1].payload.text.body, /Expressionz/);
    assert.match(sent[1].payload.text.body, /Rs\.2600/);
  });
  test('any other error is reported, not swallowed', async () => {
    axios.post = async () => { const e = new Error('bad'); e.response = { data: { error: { code: 131030, message: 'recipient not allowed' } } }; throw e; };
    const r = await whatsapp.sendWelcomeMessage('9876543210', 'Asha', 'Karate Class');
    assert.equal(r.success, false);
    assert.match(r.reason, /131030/);
  });
  test('a failing message does not block the next one in the queue', async () => {
    axios.post = async () => { throw new Error('network down'); };
    const first = await whatsapp.sendWelcomeMessage('9876543210', 'A', 'C');
    assert.equal(first.success, false);
    axios.post = async (url, payload) => { sent.push({ url, payload }); return { data: { messages: [{ id: 'ok' }] } }; };
    const second = await whatsapp.sendWelcomeMessage('9876543210', 'B', 'C');
    assert.equal(second.success, true);
  });
});
