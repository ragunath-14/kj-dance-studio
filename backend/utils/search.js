// Safe text search helpers. Anything an admin types in a search box is treated as plain text,
// never as a regular expression (typing "+91", "(" or "*" used to crash the search with a 500).

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Regex that matches a phone number however it was stored: digits are matched with optional
// spaces / dashes / brackets between them, so "98765 43210" finds "9876543210".
const looseDigitsRegex = (digits) => new RegExp(digits.split('').join('[\\s\\-()]*'), 'i');

// Does the text look like a phone number (digits, spaces, +, -, brackets only)? Only then do we also
// match phones with the digits spread across spaces/dashes. A name like "Ragu 8610" must not match phones.
const looksLikePhone = (s) => /^[\d\s+\-()]+$/.test(s);

// Mongo $or clauses: name contains the text, or phone contains it (as typed, or digits only)
const studentSearchClauses = (search) => {
  const s = String(search || '').trim();
  if (!s) return [];
  const clauses = [
    { studentName: { $regex: escapeRegex(s), $options: 'i' } },
    { phone:       { $regex: escapeRegex(s), $options: 'i' } }
  ];
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 3 && looksLikePhone(s) && digits !== s) clauses.push({ phone: { $regex: looseDigitsRegex(digits).source, $options: 'i' } });
  return clauses;
};

// Same rule for filtering an in-memory list
const studentMatcher = (search) => {
  const s = String(search || '').trim();
  if (!s) return () => true;
  const nameOrPhone = new RegExp(escapeRegex(s), 'i');
  const digits = s.replace(/\D/g, '');
  const loose = digits.length >= 3 && looksLikePhone(s) && digits !== s ? looseDigitsRegex(digits) : null;
  return (student) =>
    nameOrPhone.test(student.studentName || '') || nameOrPhone.test(student.phone || '') ||
    (loose ? loose.test(student.phone || '') : false);
};

module.exports = { escapeRegex, studentSearchClauses, studentMatcher };
