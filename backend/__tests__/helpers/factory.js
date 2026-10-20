'use strict';
/** Small builders shared by the API tests. Dates are relative to "now" so the suites run on any day. */

const now = () => new Date();
const todayParts = () => { const d = now(); return { Y: d.getFullYear(), M: d.getMonth(), D: d.getDate() }; };

/** Join date `n` months ago, on a day that has already passed this month (so every month so far is billed). */
const joinedMonthsAgo = (n, daysBefore = 5) => {
  const { Y, M, D } = todayParts();
  return new Date(Y, M - n, Math.max(1, D - daysBefore), 12).toISOString();
};

/** Calendar month (0-11) and year `n` months before the current one. */
const monthsAgo = (n) => { const { Y, M } = todayParts(); const d = new Date(Y, M - n, 1); return { month: d.getMonth(), year: d.getFullYear() }; };

let seq = 0;
const tag = String(Date.now()).slice(-5);
const uniquePhone = () => `9${tag}${String(++seq).padStart(4, '0')}`;

/** Adds a student through the real admin endpoint. Defaults to an adult Karate student (fee 1300). */
async function addStudent(api, overrides = {}) {
  const res = await api.post('/students', {
    studentName: `Student ${tag}-${seq + 1}`,
    phone: uniquePhone(),
    studentAge: '30',
    classType: 'Karate Class',
    classSchedule: 'NA',
    ...overrides
  });
  if (res.status !== 201) throw new Error(`addStudent failed (${res.status}): ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Records a monthly-fee payment for a calendar month (0-based month). */
const payMonth = (api, studentId, amount, month, year, extra = {}) =>
  api.post('/payments', { studentId, amount, purpose: 'Monthly Fee', method: 'Cash', forMonth: month, forYear: year, date: new Date().toISOString(), ...extra });

const unpaidRow  = async (api, id) => (await api.get('/students/unpaid?limit=1000')).body.data.find(s => s._id === id);
const history    = async (api, id) => (await api.get(`/payments/student/${id}`)).body;
const studentDoc = async (api, id) => (await api.get('/students?limit=1000')).body.data.find(s => s._id === id);
const sumDue     = (hist) => hist.monthHistory.reduce((a, m) => a + m.due, 0);

module.exports = { now, todayParts, joinedMonthsAgo, monthsAgo, uniquePhone, addStudent, payMonth, unpaidRow, history, studentDoc, sumDue, tag };
