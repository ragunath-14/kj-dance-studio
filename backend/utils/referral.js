const crypto = require('crypto');

// Unambiguous characters only (no I, L, O, 0, 1) so a code is easy to read out and type
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

// Codes are case-insensitive and ignore spaces / dashes: "kj-ab 12cd" -> "KJAB12CD"
const normalizeCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Phone numbers are compared on their last 10 digits (ignores +91, spaces, dashes)
const last10 = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

// Regex that matches a stored phone string containing these 10 digits, however it was typed
const phoneRegex = (tenDigits) =>
  new RegExp(`(^|[^0-9])(91)?[\\s\\-()]*${tenDigits.split('').join('[\\s\\-()]*')}[\\s]*$`);

const samePhone = (a, b) => {
  const x = last10(a); const y = last10(b);
  return x.length === 10 && x === y;
};

// KJ + 6 random characters, checked for uniqueness against existing students
const generateUniqueCode = async (Student) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = 'KJ';
    for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
    // never reuse a code that exists now OR that was used before (expired codes stay reserved)
    if (!(await Student.exists({ $or: [{ referralCode: code }, { 'referralCodeHistory.code': code }] }))) return code;
  }
  throw new Error('Could not generate a unique referral code. Please try again.');
};

module.exports = { normalizeCode, last10, phoneRegex, samePhone, generateUniqueCode };
