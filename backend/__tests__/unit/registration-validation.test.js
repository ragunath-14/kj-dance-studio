'use strict';
/** The registration form's rules and error messages (frontend/src/registrationValidation.js). */
const test   = require('node:test');
const assert = require('node:assert/strict');
const path   = require('path');
const { pathToFileURL } = require('url');

let V;
test.before(async () => {
  V = await import(pathToFileURL(path.resolve(__dirname, '../../../frontend/src/registrationValidation.js')).href);
});

const good = { studentName: 'Asha Kumar', phone: '98765 43210', whatsappNumber: '', studentAge: '12', classTypes: ['Karate Class'], classSchedule: '', feePlan: '', zumbaBatch: '' };
const errorsOf = (data, ctx = {}) => Object.fromEntries(V.validateRegistration(data, ctx).map(e => [e.field, e.message]));

test.describe('a valid form', () => {
  test('has no problems', () => assert.deepEqual(V.validateRegistration(good, {}), []));
  test('optional fields may stay empty', () => assert.deepEqual(V.validateRegistration({ ...good, studentAge: '', whatsappNumber: '' }, {}), []));
  test('Tamil and other non-English names are accepted', () => assert.deepEqual(V.validateRegistration({ ...good, studentName: 'அருண் குமார்' }, {}), []));
  test('+91 and international phone numbers are accepted', () => {
    for (const phone of ['+91 98765 43210', '9876543210', '098765-43210', '(98765) 43210', '+65 9868 0813']) assert.deepEqual(V.validateRegistration({ ...good, phone }, {}), [], phone);
  });
});

test.describe('name', () => {
  test('required', () => assert.match(errorsOf({ ...good, studentName: '' }).studentName, /enter the student/i));
  test('spaces only count as empty', () => assert.ok(errorsOf({ ...good, studentName: '   ' }).studentName));
  test('too short', () => assert.match(errorsOf({ ...good, studentName: 'A' }).studentName, /at least 2 letters/));
  test('must contain letters', () => assert.match(errorsOf({ ...good, studentName: '12345' }).studentName, /letters/));
});

test.describe('phone and WhatsApp', () => {
  test('phone is required', () => assert.match(errorsOf({ ...good, phone: '' }).phone, /phone number/));
  test('says how many digits were typed', () => assert.match(errorsOf({ ...good, phone: '98765' }).phone, /you typed 5/));
  test('gives an example', () => assert.match(errorsOf({ ...good, phone: '123' }).phone, /98765 43210/));
  test('letters are explained', () => assert.match(errorsOf({ ...good, phone: '98765abcde' }).phone, /only have digits/));
  test('too long', () => assert.match(errorsOf({ ...good, phone: '1234567890123456' }).phone, /too long/));
  test('WhatsApp is optional but checked when given', () => {
    assert.equal(errorsOf({ ...good, whatsappNumber: '' }).whatsappNumber, undefined);
    assert.ok(errorsOf({ ...good, whatsappNumber: '123' }).whatsappNumber);
  });
});

test.describe('age', () => {
  for (const age of ['0', '100', '-3', '12.5', 'abc']) test(`"${age}" is refused`, () => assert.match(errorsOf({ ...good, studentAge: age }).studentAge, /between 1 and 99/));
  for (const age of ['1', '9', '10', '99']) test(`"${age}" is accepted`, () => assert.equal(errorsOf({ ...good, studentAge: age }).studentAge, undefined));
});

test.describe('classes', () => {
  test('at least one class', () => assert.match(errorsOf({ ...good, classTypes: [] }).classTypes, /at least one class/));
  test('camp sign-ups need no class', () => assert.deepEqual(V.validateRegistration({ ...good, classTypes: [] }, { isCamp: true }), []));
  test('weekday / weekend is needed for the regular, fitness and online classes', () => {
    assert.match(errorsOf({ ...good, classTypes: ['Regular Class'] }, { needsSchedule: true }).classSchedule, /Weekday or Weekend/);
    assert.equal(errorsOf({ ...good, classTypes: ['Regular Class'], classSchedule: 'Weekday' }, { needsSchedule: true }).classSchedule, undefined);
    assert.equal(errorsOf(good, { needsSchedule: false }).classSchedule, undefined);
  });
  test('Zumba needs a plan and a batch, each with its own message', () => {
    const e = errorsOf({ ...good, classTypes: ['Zumba Class'] }, { hasZumba: true });
    assert.match(e.feePlan, /5 or 3/);
    assert.match(e.zumbaBatch, /batch/);
    const onlyBatch = errorsOf({ ...good, classTypes: ['Zumba Class'], feePlan: '5 Class' }, { hasZumba: true });
    assert.equal(onlyBatch.feePlan, undefined);
    assert.ok(onlyBatch.zumbaBatch);
  });
});

test.describe('order and multiple mistakes', () => {
  test('every mistake is reported, in the order the fields appear', () => {
    const list = V.validateRegistration({ studentName: '', phone: '12', whatsappNumber: 'x', studentAge: '200', classTypes: [], classSchedule: '' }, {});
    assert.deepEqual(list.map(e => e.field), ['studentName', 'phone', 'whatsappNumber', 'studentAge', 'classTypes']);
  });
});

test.describe('referral code typed but not complete', () => {
  test('nothing typed = nothing to say', () => assert.equal(V.incompleteReferralProblem(''), null));
  test('a complete code is fine here (the server decides if it works)', () => assert.equal(V.incompleteReferralProblem('KJ7QH4MZ'), null));
  test('a short code says how many characters were typed and gives an example', () => {
    const p = V.incompleteReferralProblem('KJ7QH');
    assert.equal(p.reason, 'incomplete');
    assert.match(p.message, /8 letters and numbers/);
    assert.match(p.message, /you typed 5/i);
    assert.ok(p.steps.length >= 2);
    assert.match(p.steps.join(' '), /KJ7QH4MZ/);
  });
  test('dashes and spaces do not count as characters', () => assert.equal(V.incompleteReferralProblem('KJ-7QH4 MZ'), null));
});

test.describe('server errors in plain words', () => {
  const failure = (status, data) => ({ response: { status, data } });
  test('no connection', () => {
    const d = V.describeSubmitError(new Error('Network Error'));
    assert.equal(d.banner.type, 'error');
    assert.match(d.banner.text, /internet connection/);
  });
  test('too many attempts', () => assert.match(V.describeSubmitError(failure(429, {})).banner.text, /wait a few minutes/));
  test('a server fault never shows technical text', () => {
    const d = V.describeSubmitError(failure(500, {}));
    assert.match(d.banner.text, /something went wrong on our side/i);
    assert.doesNotMatch(d.banner.text, /undefined|stack|Mongo|Error:/);
  });
  test('already registered is a friendly warning, not an error', () => {
    const d = V.describeSubmitError(failure(409, { reason: 'already_pending', message: 'You have already registered. No need to register again.' }));
    assert.equal(d.banner.type, 'warning');
    assert.match(d.banner.text, /already registered/);
    assert.ok(d.fieldErrors.phone);
  });
  test('a referral problem opens the pop-up content and marks the code field', () => {
    const d = V.describeSubmitError(failure(400, { field: 'referralCode', title: 'This code has expired', message: 'The owner made a new code.', steps: ['Ask for the NEW code'], reason: 'expired' }));
    assert.equal(d.referral.title, 'This code has expired');
    assert.deepEqual(d.referral.steps, ['Ask for the NEW code']);
    assert.ok(d.fieldErrors.referralCode);
  });
  test('field messages from the server land on the right form field', () => {
    const d = V.describeSubmitError(failure(400, { fieldErrors: { phone: 'Bad phone', classType: 'Pick a class', feePlan: 'Pick a plan' }, field: 'phone' }));
    assert.equal(d.fieldErrors.phone, 'Bad phone');
    assert.ok(d.fieldErrors.classTypes, 'class and Zumba-plan problems both show on the class box');
    assert.match(d.banner.text, /highlighted fields/);
  });
  test('a single field problem says "field", several say "fields"', () => {
    assert.match(V.describeSubmitError(failure(400, { fieldErrors: { phone: 'x' } })).banner.text, /highlighted field\b/);
    assert.match(V.describeSubmitError(failure(400, { fieldErrors: { phone: 'x', studentName: 'y' } })).banner.text, /highlighted fields/);
  });
  test('an unknown 400 still shows the server message', () => {
    assert.equal(V.describeSubmitError(failure(400, { message: 'Something specific' })).banner.text, 'Something specific');
  });
});
