const crypto = require('crypto');

// Codes are case-insensitive and ignore spaces / dashes: "kj-ab 12cd" -> "KJAB12CD"
const normalizeCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Phone numbers are compared on their last 10 digits (ignores +91, spaces, dashes)
const last10 = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

// Regex that matches a stored phone string containing these 10 digits, however it was typed
const phoneRegex = (tenDigits) =>
  new RegExp(`(^|[^0-9])(91)?[\\s\\-()]*${tenDigits.split('').join('[\\s\\-()]*')}[\\s]*$`);

// Regex that matches stored phone strings that START with these digits (spaces, +91 and dashes ignored)
const phonePrefixRegex = (digits) =>
  new RegExp(`^[\\s+()-]*(91)?[\\s\\-()]*${digits.split('').join('[\\s\\-()]*')}`);

const samePhone = (a, b) => {
  const x = last10(a); const y = last10(b);
  return x.length === 10 && x === y;
};

// Easy-to-read codes: KJ + the first 4 letters of the student's name + 2 digits, e.g. "KJARUN47".
// Names that are short or not in English letters are filled up with random letters.
// Digits skip 0 and 1 so they cannot be mistaken for O and I.
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const pick = (chars) => chars[crypto.randomInt(chars.length)];

// "Arun Kumar" -> "ARUN", "Jo" -> "JO" + 2 random letters, a Tamil name -> 4 random letters
const nameLetters = (name) => {
  const words = String(name || '').toUpperCase().split(/\s+/).map(w => w.replace(/[^A-Z]/g, '')).filter(Boolean);
  let letters = (words[0] || '').slice(0, 4);
  for (let i = 1; i < words.length && letters.length < 4; i++) letters += words[i].slice(0, 4 - letters.length);
  while (letters.length < 4) letters += pick(LETTERS);
  return letters;
};

// Checked for uniqueness against every code in use now OR used before (expired codes stay reserved).
// Popular names collide, so later attempts change the last letter and finally use random letters.
const generateUniqueCode = async (Student, studentName) => {
  const stem = nameLetters(studentName);
  for (let attempt = 0; attempt < 40; attempt++) {
    let letters = stem;
    if (attempt >= 10 && attempt < 25) letters = stem.slice(0, 3) + pick(LETTERS);
    if (attempt >= 25) letters = Array.from({ length: 4 }, () => pick(LETTERS)).join('');
    const code = `KJ${letters}${pick(DIGITS)}${pick(DIGITS)}`;
    if (!(await Student.exists({ $or: [{ referralCode: code }, { 'referralCodeHistory.code': code }] }))) return code;
  }
  throw new Error('Could not generate a unique referral code. Please try again.');
};

// "9876543210" -> "98••••3210": enough to recognise your own number, not enough to copy it
const maskPhone = (phone) => {
  const d = last10(phone);
  return d.length === 10 ? `${d.slice(0, 2)}••••${d.slice(6)}` : '';
};

// "Arun Kumar Sharma" -> "Arun K. S."
const shortName = (name) => {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return w.length <= 1 ? (w[0] || '') : `${w[0]} ${w.slice(1).map(x => `${x[0].toUpperCase()}.`).join(' ')}`;
};

module.exports = { normalizeCode, last10, phoneRegex, phonePrefixRegex, samePhone, generateUniqueCode, nameLetters, maskPhone, shortName };
