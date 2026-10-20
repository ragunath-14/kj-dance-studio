// Rules and plain-language messages for the registration form.
// Kept free of React so they can be tested on their own.

const DIGITS = (s) => String(s || '').replace(/\D/g, '');
const PHONE_CHARS = /^[\d\s+\-()]+$/;

export const REFERRAL_CODE_LENGTH = 8;   // "KJ" + 6 characters

/** Phone / WhatsApp: at least 10 digits, only digits, spaces, + - ( ) */
export function phoneProblem(value, { required }) {
  const v = String(value || '').trim();
  if (!v) return required ? 'Please enter a phone number so we can contact you.' : '';
  if (!PHONE_CHARS.test(v)) return 'A phone number can only have digits, spaces and + - ( ). Please remove any letters.';
  const n = DIGITS(v).length;
  if (n < 10) return `A phone number needs at least 10 digits — you typed ${n}. For example 98765 43210.`;
  if (n > 15) return 'This phone number is too long. Please check it.';
  return '';
}

/**
 * Checks the whole form. Returns [{ field, message }] in the order the fields appear on screen.
 * `ctx` = { isCamp, needsSchedule, hasZumba }
 */
export function validateRegistration(data, ctx = {}) {
  const errors = [];
  const add = (field, message) => { if (message) errors.push({ field, message }); };

  const name = String(data.studentName || '').trim();
  if (!name) add('studentName', 'Please enter the student’s full name.');
  else if (name.length < 2) add('studentName', 'The name is too short — please enter at least 2 letters.');
  else if (!/\p{L}/u.test(name)) add('studentName', 'The name should have letters in it, not only numbers or symbols.');

  add('phone', phoneProblem(data.phone, { required: true }));
  add('whatsappNumber', phoneProblem(data.whatsappNumber, { required: false }));

  const age = String(data.studentAge ?? '').trim();
  if (age) {
    const n = Number(age);
    if (!Number.isInteger(n) || n < 1 || n > 99) add('studentAge', 'Please enter the age as a whole number between 1 and 99.');
  }

  if (!ctx.isCamp) {
    if (!data.classTypes || data.classTypes.length === 0) add('classTypes', 'Please choose at least one class.');
    if (ctx.needsSchedule && !data.classSchedule) add('classSchedule', 'Please choose Weekday or Weekend for your class.');
    if (ctx.hasZumba && !data.feePlan) add('feePlan', 'Please choose how many Zumba classes you want each week: 5 or 3.');
    if (ctx.hasZumba && !data.zumbaBatch) add('zumbaBatch', 'Please choose a Zumba batch (morning time).');
  }
  return errors;
}

/** A code that is typed but not 8 characters long can never be right — say so without asking the server. */
export function incompleteReferralProblem(code) {
  const cleaned = String(code || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned || cleaned.length === REFERRAL_CODE_LENGTH) return null;
  return {
    reason: 'incomplete',
    title: 'The code is not complete',
    message: `A referral code has ${REFERRAL_CODE_LENGTH} letters and numbers and starts with KJ. You typed ${cleaned.length}.`,
    steps: ['Type the whole code, for example KJARUN47.', 'Ask your friend to send it again with the Copy or WhatsApp button on our website.', 'No code? You can leave the box empty and register without it.']
  };
}

/**
 * Turns a failed request into something a visitor can act on.
 * Returns { banner: { type, text } | null, fieldErrors: {field: message}, referral: { title, message, steps } | null }
 */
export function describeSubmitError(err) {
  const res = err && err.response;
  if (!res) {
    return { banner: { type: 'error', text: 'We could not reach the studio’s server. Please check your internet connection and try again.' }, fieldErrors: {}, referral: null };
  }
  const data = res.data || {};

  if (res.status === 429) {
    return { banner: { type: 'error', text: 'Too many attempts in a short time. Please wait a few minutes and try again.' }, fieldErrors: {}, referral: null };
  }

  // a problem with the referral code → explained in a pop-up, plus a message on the field
  if (data.field === 'referralCode' && data.title) {
    return {
      banner: { type: 'error', text: 'Your referral code could not be used. See the message below the code box.' },
      fieldErrors: { referralCode: data.message },
      referral: { title: data.title, message: data.message, steps: data.steps || [] }
    };
  }

  // already registered: friendly, and it is good news rather than an error
  if (data.reason === 'already_pending') {
    return { banner: { type: 'warning', text: data.message }, fieldErrors: { phone: 'This name and phone number are already registered.' }, referral: null };
  }

  if (res.status >= 500) {
    return { banner: { type: 'error', text: data.message || 'Something went wrong on our side. Please try again in a moment, or call the studio.' }, fieldErrors: {}, referral: null };
  }

  // field by field messages from the server
  const fieldErrors = {};
  for (const [field, message] of Object.entries(data.fieldErrors || {})) {
    fieldErrors[field === 'classType' || field === 'feePlan' ? 'classTypes' : field] = message;
  }
  if (data.field && data.message && !Object.keys(fieldErrors).length) {
    fieldErrors[data.field === 'classType' ? 'classTypes' : data.field] = data.message;
  }
  const count = Object.keys(fieldErrors).length;
  return {
    banner: { type: 'error', text: count ? `Please check the ${count > 1 ? 'highlighted fields' : 'highlighted field'} below.` : (data.message || 'We could not save your registration. Please try again.') },
    fieldErrors,
    referral: null
  };
}
