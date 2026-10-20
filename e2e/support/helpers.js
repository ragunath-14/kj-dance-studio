// Helpers shared by the e2e specs: seed data through the real API, sign in to the admin site quickly, build dates.
const env = require('./env');

let token = '';
async function adminToken() {
  if (token) return token;
  const res = await fetch(`${env.API_URL}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId: env.ADMIN.id, password: env.ADMIN.password }),
  });
  token = (await res.json()).token;
  if (!token) throw new Error('e2e admin login failed');
  return token;
}

/** Calls the backend API. `auth:false` = public endpoint (like the website visitors use). */
async function call(method, url, body, { auth = true } = {}) {
  const res = await fetch(`${env.API_URL}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${await adminToken()}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: data };
}
const api = {
  get: (u, o) => call('GET', u, undefined, o),
  post: (u, b, o) => call('POST', u, b, o),
  put: (u, b, o) => call('PUT', u, b, o),
  patch: (u, b, o) => call('PATCH', u, b, o),
  del: (u, o) => call('DELETE', u, undefined, o),
};

// ── unique names / phones so tests never collide, even when run twice
const run = Date.now().toString(36).slice(-4).toUpperCase();
let seq = 0;
const uniqueName = (label) => `${label} ${run}${++seq}`;
const uniquePhone = () => `9${String(Date.now()).slice(-5)}${String(++seq).padStart(4, '0')}`;

// ── dates (relative to today so the suite works on any day)
const joinedMonthsAgo = (n, daysBefore = 5) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - n, Math.max(1, d.getDate() - daysBefore), 12).toISOString();
};
const monthsAgo = (n) => { const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth() - n, 1); return { month: x.getMonth(), year: x.getFullYear() }; };

/** Adds a student through the admin API (default: adult Karate student, ₹1300/month). */
async function addStudent(over = {}) {
  const res = await api.post('/students', {
    studentName: uniqueName('Student'), phone: uniquePhone(), studentAge: '30',
    classType: 'Karate Class', classSchedule: 'NA', ...over,
  });
  if (res.status !== 201) throw new Error(`addStudent failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}
const payMonth = (studentId, amount, month, year, extra = {}) =>
  api.post('/payments', { studentId, amount, purpose: 'Monthly Fee', method: 'Cash', forMonth: month, forYear: year, date: new Date().toISOString(), ...extra });

/** A public registration, exactly as the website form would send it. */
const register = (over = {}) => api.post('/register', {
  studentName: uniqueName('Walkin'), phone: uniquePhone(), studentAge: '20', classType: 'Silambam Class', classSchedule: 'NA', ...over,
}, { auth: false });

/** Opens the admin site already signed in (the real login screen has its own spec). */
async function signInAsAdmin(page, path = '/admin') {
  const t = await adminToken();
  await page.addInitScript((tkn) => {
    localStorage.setItem('adminToken', tkn);
    localStorage.setItem('isAdminAuth', 'true');
  }, t);
  await page.goto(path);
}

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

module.exports = { env, api, call, uniqueName, uniquePhone, joinedMonthsAgo, monthsAgo, addStudent, payMonth, register, signInAsAdmin, rupees, adminToken };
