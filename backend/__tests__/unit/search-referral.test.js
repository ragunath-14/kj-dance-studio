'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const { escapeRegex, studentSearchClauses, studentMatcher } = require('../../utils/search');
const referral = require('../../utils/referral');

test.describe('safe search text', () => {
  test('escapeRegex neutralises every special character', () => {
    const special = '.*+?^${}()|[]\\';
    const re = new RegExp(escapeRegex(special));
    assert.ok(re.test(special));
    assert.equal(new RegExp(escapeRegex('a.b')).test('axb'), false);
  });
  test('typing symbols never throws', () => {
    for (const text of ['(', '+91', '[', '*', '\\', '?', '$', '^', 'a|b', '{', '}', ')']) {
      assert.doesNotThrow(() => studentSearchClauses(text), text);
      assert.doesNotThrow(() => studentMatcher(text)('x'), text);
    }
  });
  test('text that is not a phone number never matches phones loosely ("Ragu 8610" is a name)', () => {
    assert.equal(studentSearchClauses('Ragu 8610').length, 2);
    assert.equal(studentMatcher('Ragu 8610')({ studentName: 'Someone', phone: '9986107770' }), false);
    assert.equal(studentSearchClauses('+91 98765').length, 3);
  });
  test('empty or blank search adds no clauses', () => {
    assert.deepEqual(studentSearchClauses(''), []);
    assert.deepEqual(studentSearchClauses('   '), []);
    assert.deepEqual(studentSearchClauses(undefined), []);
  });
  test('searches name and phone', () => {
    const clauses = studentSearchClauses('ragu');
    assert.equal(clauses.length, 2);
    assert.ok(clauses[0].studentName && clauses[1].phone);
  });
  test('a typed phone number also matches however it was stored (spaces, dashes)', () => {
    const clauses = studentSearchClauses('98765 43210');
    assert.equal(clauses.length, 3);
    const loose = new RegExp(clauses[2].phone.$regex, 'i');
    assert.ok(loose.test('9876543210'));
    assert.ok(loose.test('98765-43210'));
    assert.ok(loose.test('+91 98765 43210'));
    assert.equal(loose.test('9876543211'), false);
  });
  test('studentMatcher: name, phone, case-insensitive, literal symbols', () => {
    const match = studentMatcher('(test)');
    assert.ok(match({ studentName: 'Plus (Test) [A]', phone: '1' }));
    assert.equal(match({ studentName: 'Test', phone: '1' }), false);
    assert.ok(studentMatcher('RAGU')({ studentName: 'ragu k', phone: '1' }));
    assert.ok(studentMatcher('98765')({ studentName: 'x', phone: '+91 98765 43210' }));
    assert.ok(studentMatcher('98 765')({ studentName: 'x', phone: '9876543210' }));
  });
  test('studentMatcher with no text matches everything', () => assert.ok(studentMatcher('')({ studentName: 'a' })));
  test('a dot is a literal dot', () => {
    assert.ok(studentMatcher('A.B')({ studentName: 'A.B Dotted', phone: '' }));
    assert.equal(studentMatcher('A.B')({ studentName: 'AxB Plain', phone: '' }), false);
  });
});

test.describe('referral helpers', () => {
  test('normalizeCode ignores case, spaces and dashes', () => {
    assert.equal(referral.normalizeCode('kj-ab 12cd'), 'KJAB12CD');
    assert.equal(referral.normalizeCode('  KJ7QH4MZ '), 'KJ7QH4MZ');
    assert.equal(referral.normalizeCode(null), '');
    assert.equal(referral.normalizeCode(undefined), '');
  });
  test('last10 keeps the last 10 digits', () => {
    assert.equal(referral.last10('+91 98765 43210'), '9876543210');
    assert.equal(referral.last10('098765-43210'), '9876543210');
    assert.equal(referral.last10('12345'), '12345');
    assert.equal(referral.last10(''), '');
  });
  test('samePhone compares formats, never short numbers', () => {
    assert.ok(referral.samePhone('9876543210', '+91 98765 43210'));
    assert.ok(referral.samePhone('098765 43210', '9876543210'));
    assert.equal(referral.samePhone('9876543210', '9876543211'), false);
    assert.equal(referral.samePhone('12345', '12345'), false);
    assert.equal(referral.samePhone('', ''), false);
    assert.equal(referral.samePhone(undefined, '9876543210'), false);
  });
  test('phoneRegex finds a stored number whatever its formatting', () => {
    const re = referral.phoneRegex('9876543210');
    for (const stored of ['9876543210', '+919876543210', '+91 98765 43210', '98765-43210', '(98765) 43210', '91 9876543210']) {
      assert.ok(re.test(stored), stored);
    }
    for (const other of ['9876543211', '19876543210', '98765432100', '']) assert.equal(re.test(other), false, other);
  });
  test('generateUniqueCode: KJ + 6 unambiguous characters', async () => {
    const Student = { exists: async () => false };
    for (let i = 0; i < 200; i++) assert.match(await referral.generateUniqueCode(Student), /^KJ[A-HJ-NP-Z2-9]{6}$/);
  });
  test('a new code never repeats a current OR an expired (history) code', async () => {
    let seenQuery = null;
    const Student = { exists: async (q) => { seenQuery = q; return false; } };
    await referral.generateUniqueCode(Student);
    const text = JSON.stringify(seenQuery);
    assert.match(text, /referralCode/);
    assert.match(text, /referralCodeHistory.code/);
  });
  test('generateUniqueCode retries on a collision', async () => {
    let calls = 0;
    const Student = { exists: async () => ++calls <= 3 };
    const code = await referral.generateUniqueCode(Student);
    assert.match(code, /^KJ/);
    assert.equal(calls, 4);
  });
  test('generateUniqueCode gives up after repeated collisions', async () => {
    await assert.rejects(() => referral.generateUniqueCode({ exists: async () => true }), /unique referral code/);
  });
  test('codes are random enough (no repeats in 500)', async () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) seen.add(await referral.generateUniqueCode({ exists: async () => false }));
    assert.equal(seen.size, 500);
  });
});
