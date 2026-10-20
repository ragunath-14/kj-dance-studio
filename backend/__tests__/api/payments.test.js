'use strict';
/**
 * Paid / Unpaid status, history, the Pay button, "Clear All" and the tab counts.
 * Runs the real server against a throwaway database.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, mongoAvailable, qs } = require('../helpers/testServer');
const F = require('../helpers/factory');

let srv; let api;
test.before(async () => {
  assert.ok(await mongoAvailable(), 'A local MongoDB must be running for the API tests (set TEST_MONGO_URL if it is not on 127.0.0.1:27017).');
  srv = await startTestServer(); api = srv.api;
});
test.after(async () => { if (srv) await srv.stop(); });

const joined4 = () => F.joinedMonthsAgo(3);   // 4 bills: this month and the 3 before

test.describe('unpaid status', () => {
  test('a student who joined today owes the first bill', async () => {
    const s = await F.addStudent(api, { createdAt: new Date().toISOString() });
    const row = await F.unpaidRow(api, s._id);
    assert.equal(row.totalDue, 1300);
    assert.equal(row.pendingMonths, 1);
  });

  test('4 unpaid months: due 5200, 4 pending, history lists 4 pending months', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const row = await F.unpaidRow(api, s._id);
    assert.equal(row.totalDue, 5200);
    assert.equal(row.pendingMonths, 4);
    const h = await F.history(api, s._id);
    assert.equal(h.monthHistory.length, 4);
    assert.ok(h.monthHistory.every(m => m.status === 'pending'));
  });

  test('joining later in the month than today: the current month is not billed yet', async (t) => {
    const { D } = F.todayParts();
    if (D >= 28) return t.skip('needs a day-of-month below 28');
    const { Y, M } = F.todayParts();
    const s = await F.addStudent(api, { createdAt: new Date(Y, M - 3, D + 1, 12).toISOString() });
    const row = await F.unpaidRow(api, s._id);
    assert.equal(row.totalDue, 3900);
    assert.equal(row.pendingMonths, 3);
    assert.equal((await F.history(api, s._id)).monthHistory.length, 3);
  });

  test('a student whose first bill is not due yet is not listed as unpaid', async (t) => {
    const { D, Y, M } = F.todayParts();
    if (D >= 28) return t.skip('needs a day-of-month below 28');
    const s = await F.addStudent(api, { createdAt: new Date(Y, M, D + 1, 12).toISOString() });
    assert.equal(await F.unpaidRow(api, s._id), undefined);
  });

  test('every month paid: not unpaid, every history month paid', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    for (let i = 3; i >= 0; i--) { const m = F.monthsAgo(i); await F.payMonth(api, s._id, 1300, m.month, m.year); }
    assert.equal(await F.unpaidRow(api, s._id), undefined);
    const h = await F.history(api, s._id);
    assert.ok(h.monthHistory.every(m => m.status === 'paid'));
    assert.equal(F.sumDue(h), 0);
  });

  test('inactive students never appear in the unpaid list', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    await api.patch(`/students/${s._id}/toggle-status`);
    assert.equal(await F.unpaidRow(api, s._id), undefined);
  });

  test('the unpaid list is sorted by the biggest balance first', async () => {
    const list = (await api.get('/students/unpaid?limit=1000')).body.data;
    for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].totalDue >= list[i].totalDue);
  });
});

test.describe('paid and unpaid always agree (money covers the oldest month first)', () => {
  test('one lump payment covers the OLDEST months — list and history match', async () => {
    // the live-data case: ₹2,600 paid at once on a ₹1,300/month student with 4 bills
    const s = await F.addStudent(api, { createdAt: joined4() });
    const m = F.monthsAgo(3);
    await F.payMonth(api, s._id, 2600, m.month, m.year);
    const row = await F.unpaidRow(api, s._id);
    assert.equal(row.totalDue, 2600);
    assert.equal(row.pendingMonths, 2);
    const h = await F.history(api, s._id);
    assert.equal(F.sumDue(h), 2600, 'history adds up to the same balance as the unpaid list');
    assert.deepEqual(h.monthHistory.map(x => x.status).reverse(), ['paid', 'paid', 'pending', 'pending']);
  });

  test('a payment tagged to the current month still clears the oldest bills first', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const cur = F.monthsAgo(0);
    await F.payMonth(api, s._id, 1300, cur.month, cur.year);
    const row = await F.unpaidRow(api, s._id);
    assert.equal(row.totalDue, 3900);
    const h = await F.history(api, s._id);
    assert.equal(F.sumDue(h), 3900);
    assert.equal(h.monthHistory[h.monthHistory.length - 1].status, 'paid', 'the oldest month is the one that got paid');
  });

  test('paid ahead: three bills due and three payments (one for next month) = fully paid everywhere', async (t) => {
    const { D, Y, M } = F.todayParts();
    if (D >= 28) return t.skip('needs a day-of-month below 28');
    // joined 3 months ago on a day later than today -> 3 bills; the 3rd payment is tagged to the current month
    const s = await F.addStudent(api, { createdAt: new Date(Y, M - 3, D + 1, 12).toISOString() });
    const m0 = F.monthsAgo(3), m1 = F.monthsAgo(2), cur = F.monthsAgo(0);
    await F.payMonth(api, s._id, 1300, m0.month, m0.year);
    await F.payMonth(api, s._id, 1300, m1.month, m1.year);
    await F.payMonth(api, s._id, 1300, cur.month, cur.year);
    assert.equal(await F.unpaidRow(api, s._id), undefined);
    const h = await F.history(api, s._id);
    assert.equal(F.sumDue(h), 0);
    assert.ok(h.monthHistory.every(m => m.status === 'paid'), JSON.stringify(h.monthHistory.map(m => m.status)));
  });

  test('over-paying leaves the student paid and the history clean', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const m = F.monthsAgo(3);
    await F.payMonth(api, s._id, 99999, m.month, m.year);
    assert.equal(await F.unpaidRow(api, s._id), undefined);
    assert.equal(F.sumDue(await F.history(api, s._id)), 0);
  });

  test('for many payment amounts, history due == unpaid-list due == dashboard overdue amount', async () => {
    for (const amount of [0, 400, 1300, 1800, 2600, 3900, 5200]) {
      const s = await F.addStudent(api, { createdAt: joined4() });
      if (amount) { const m = F.monthsAgo(3); await F.payMonth(api, s._id, amount, m.month, m.year); }
      const row = await F.unpaidRow(api, s._id);
      const listDue = row ? row.totalDue : 0;
      assert.equal(F.sumDue(await F.history(api, s._id)), listDue, `paid ${amount}`);
      assert.equal(listDue, Math.max(0, 5200 - amount), `paid ${amount}`);
    }
  });

  test('the dashboard overdue list matches the unpaid tab for every student', async () => {
    const unpaid = (await api.get('/students/unpaid?limit=5000')).body.data;
    const stats = (await api.get('/dashboard/stats')).body;
    assert.equal(stats.metrics.overdue, unpaid.length);
    const byId = new Map(stats.overdueStudents.map(s => [s._id, s.totalDue]));
    for (const u of unpaid) assert.equal(byId.get(u._id), u.totalDue, u.studentName);
  });

  test('the student list "totalPaid" matches the sum of that student\'s payments', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const m = F.monthsAgo(3);
    await F.payMonth(api, s._id, 1300, m.month, m.year);
    const m2 = F.monthsAgo(2);
    await F.payMonth(api, s._id, 700, m2.month, m2.year);
    assert.equal((await F.studentDoc(api, s._id)).totalPaid, 2000);
  });
});

test.describe('partial payments and the Pay button', () => {
  test('a part-payment leaves the oldest month partial and tells the Pay button what to collect next', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const cur = F.monthsAgo(0);
    await F.payMonth(api, s._id, 500, cur.month, cur.year);
    const row = await F.unpaidRow(api, s._id);
    assert.equal(row.totalDue, 4700);
    const oldest = F.monthsAgo(3);
    assert.deepEqual(row.oldestPending, { month: oldest.month, year: oldest.year, due: 800 });
  });

  test('the current bill reports "partial" only when the current bill itself is partly paid', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const m = F.monthsAgo(3), m1 = F.monthsAgo(2), m2 = F.monthsAgo(1), cur = F.monthsAgo(0);
    for (const x of [m, m1, m2]) await F.payMonth(api, s._id, 1300, x.month, x.year); // oldest three paid
    await F.payMonth(api, s._id, 500, cur.month, cur.year);                           // part of the current bill
    const row = await F.unpaidRow(api, s._id);
    assert.equal(row.totalDue, 800);
    assert.equal(row.currentMonthPaid, 500);
    assert.equal(row.currentMonthDue, 800);
    assert.equal(row.isPartialThisMonth, true);
  });

  test('a part-payment, then the balance for the SAME month, is accepted', async () => {
    const s = await F.addStudent(api, { createdAt: new Date().toISOString() });
    const cur = F.monthsAgo(0);
    assert.equal((await F.payMonth(api, s._id, 500, cur.month, cur.year)).status, 201);
    const second = await F.payMonth(api, s._id, 800, cur.month, cur.year);
    assert.equal(second.status, 201, JSON.stringify(second.body));
    assert.equal(await F.unpaidRow(api, s._id), undefined);
  });

  test('a month that is already paid in full cannot be paid again (409)', async () => {
    const s = await F.addStudent(api, { createdAt: new Date().toISOString() });
    const cur = F.monthsAgo(0);
    assert.equal((await F.payMonth(api, s._id, 1300, cur.month, cur.year)).status, 201);
    const again = await F.payMonth(api, s._id, 1300, cur.month, cur.year);
    assert.equal(again.status, 409);
    assert.match(again.body.message, /already paid in full/);
  });

  test('paying the month the Pay button suggests works, then the next one is suggested', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    let row = await F.unpaidRow(api, s._id);
    const first = row.oldestPending;
    assert.equal((await F.payMonth(api, s._id, first.due, first.month, first.year)).status, 201);
    row = await F.unpaidRow(api, s._id);
    assert.equal(row.totalDue, 3900);
    const expectedNext = F.monthsAgo(2);
    assert.deepEqual([row.oldestPending.month, row.oldestPending.year], [expectedNext.month, expectedNext.year]);
  });

  test('"Pay" works for a student whose current month is already paid but who still has older dues', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const cur = F.monthsAgo(0);
    await F.payMonth(api, s._id, 1300, cur.month, cur.year);
    const row = await F.unpaidRow(api, s._id);
    const res = await F.payMonth(api, s._id, row.oldestPending.due, row.oldestPending.month, row.oldestPending.year);
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });
});

test.describe('payment validation', () => {
  test('needs a student', async () => assert.equal((await api.post('/payments', { amount: 100, purpose: 'Monthly Fee' })).status, 400));
  test('an unknown student is 404', async () => assert.equal((await api.post('/payments', { studentId: '64b000000000000000000000', amount: 100, purpose: 'Monthly Fee' })).status, 404));
  test('a malformed student id is 400', async () => assert.equal((await api.post('/payments', { studentId: 'nope', amount: 100, purpose: 'Monthly Fee' })).status, 400));
  test('zero and negative amounts are refused', async () => {
    const s = await F.addStudent(api);
    assert.equal((await api.post('/payments', { studentId: s._id, amount: 0, purpose: 'Monthly Fee' })).status, 400);
    assert.equal((await api.post('/payments', { studentId: s._id, amount: -50, purpose: 'Monthly Fee' })).status, 400);
  });
  test('the same non-monthly payment twice on one day is refused', async () => {
    const s = await F.addStudent(api);
    const body = { studentId: s._id, amount: 500, purpose: 'Costume', method: 'Cash' };
    assert.equal((await api.post('/payments', body)).status, 201);
    assert.equal((await api.post('/payments', body)).status, 409);
  });
  test('payments need an admin login', async () => {
    assert.equal((await api.post('/payments', { studentId: 'x', amount: 1 }, { auth: false })).status, 401);
    assert.equal((await api.get('/payments/counts', { auth: false })).status, 401);
  });
  test('a payment can be edited and deleted', async () => {
    const s = await F.addStudent(api, { createdAt: new Date().toISOString() });
    const cur = F.monthsAgo(0);
    const p = (await F.payMonth(api, s._id, 1300, cur.month, cur.year)).body;
    assert.equal((await api.put(`/payments/${p._id}`, { amount: 1000 })).body.amount, 1000);
    assert.equal((await F.unpaidRow(api, s._id)).totalDue, 300);
    assert.equal((await api.del(`/payments/${p._id}`)).status, 200);
    assert.equal((await F.unpaidRow(api, s._id)).totalDue, 1300);
  });
});

test.describe('Clear All (clear-dues)', () => {
  test('settles the whole balance with one payment per unpaid month', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const res = await api.post(`/payments/clear-dues/${s._id}`, { method: 'Cash' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.totalCleared, 5200);
    assert.equal(res.body.months, 4);
    assert.equal(await F.unpaidRow(api, s._id), undefined);
    const h = await F.history(api, s._id);
    assert.ok(h.monthHistory.every(m => m.status === 'paid'));
    const months = h.payments.filter(p => p.purpose === 'Monthly Fee').map(p => `${p.forYear}-${p.forMonth}`).sort();
    assert.equal(new Set(months).size, 4, 'one payment record for each of the 4 months');
  });

  test('clears only what is still owing after a part-payment', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const m = F.monthsAgo(3);
    await F.payMonth(api, s._id, 500, m.month, m.year);
    const res = await api.post(`/payments/clear-dues/${s._id}`, {});
    assert.equal(res.body.totalCleared, 4700);
    assert.equal(await F.unpaidRow(api, s._id), undefined);
    assert.equal((await F.studentDoc(api, s._id)).totalPaid, 5200);
  });

  test('works when this month is already paid but older months are owed (this used to fail)', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const cur = F.monthsAgo(0);
    await F.payMonth(api, s._id, 1300, cur.month, cur.year);
    const res = await api.post(`/payments/clear-dues/${s._id}`, {});
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.totalCleared, 3900);
    assert.equal(await F.unpaidRow(api, s._id), undefined);
  });

  test('works for a student with a lump-sum payment (the live-data case)', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const m = F.monthsAgo(3);
    await F.payMonth(api, s._id, 2600, m.month, m.year);
    const res = await api.post(`/payments/clear-dues/${s._id}`, {});
    assert.equal(res.body.totalCleared, 2600);
    assert.equal(await F.unpaidRow(api, s._id), undefined);
  });

  test('clears the discounted amount when the student has an offer', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    await api.put(`/students/${s._id}/discount`, { discountPercent: 50, discountAmount: 0 }); // current bill only -> 650
    const res = await api.post(`/payments/clear-dues/${s._id}`, {});
    assert.equal(res.body.totalCleared, 1300 * 3 + 650);
    assert.equal(await F.unpaidRow(api, s._id), undefined);
  });

  test('clears a two-class student at the combined fee', async () => {
    const s = await F.addStudent(api, { createdAt: joined4(), extraClasses: [{ classType: 'Zumba Class', feePlan: '3 Class', batchTiming: 'Morning 6:00 AM – 7:00 AM' }] });
    const res = await api.post(`/payments/clear-dues/${s._id}`, {});
    assert.equal(res.body.totalCleared, 3100 * 4);
  });

  test('running it twice does not charge twice', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    assert.equal((await api.post(`/payments/clear-dues/${s._id}`, {})).status, 201);
    const second = await api.post(`/payments/clear-dues/${s._id}`, {});
    assert.equal(second.status, 400);
    assert.match(second.body.message, /no outstanding dues/i);
    assert.equal((await F.studentDoc(api, s._id)).totalPaid, 5200);
  });

  test('refuses an inactive student, an unknown student and a bad id', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    await api.patch(`/students/${s._id}/toggle-status`);
    assert.equal((await api.post(`/payments/clear-dues/${s._id}`, {})).status, 400);
    assert.equal((await api.post('/payments/clear-dues/64b000000000000000000000', {})).status, 404);
    assert.equal((await api.post('/payments/clear-dues/not-an-id', {})).status, 400);
  });

  test('needs an admin login', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    assert.equal((await api.post(`/payments/clear-dues/${s._id}`, {}, { auth: false })).status, 401);
    assert.ok(await F.unpaidRow(api, s._id), 'nothing was recorded');
  });

  test('the Paid tab shows the cleared months', async () => {
    const s = await F.addStudent(api, { studentName: 'Clearall Paidtab', createdAt: joined4() });
    await api.post(`/payments/clear-dues/${s._id}`, {});
    const list = (await api.get('/payments' + qs({ search: 'Clearall Paidtab', limit: 50 }))).body;
    assert.equal(list.total, 4);
  });
});

test.describe('Paid / Unpaid tab counts', () => {
  test('Unpaid button == unpaid list == dashboard overdue', async () => {
    const counts = (await api.get('/payments/counts')).body;
    const list = (await api.get('/students/unpaid?limit=1')).body.total;
    const dash = (await api.get('/dashboard/stats')).body.metrics.overdue;
    assert.equal(counts.unpaid, list);
    assert.equal(list, dash);
  });

  test('Paid button == Paid list, for a month and for all time', async () => {
    const { M, Y } = F.todayParts();
    const month = (await api.get(`/payments/counts?filterMonth=${M}&filterYear=${Y}`)).body.paid;
    assert.equal(month, (await api.get(`/payments?limit=1&filterMonth=${M}&filterYear=${Y}`)).body.total);
    const all = (await api.get('/payments/counts')).body.paid;
    assert.equal(all, (await api.get('/payments?limit=1')).body.total);
  });

  test('the counts do not depend on which tab is open — and follow search and Kids/Adults filters', async () => {
    const { M, Y } = F.todayParts();
    for (const f of [{ search: 'Clearall' }, { studentCategory: 'Kids' }, { studentCategory: 'Adults', search: 'Student' }]) {
      const c = (await api.get('/payments/counts' + qs({ ...f, filterMonth: M, filterYear: Y }))).body;
      assert.equal(c.unpaid, (await api.get('/students/unpaid' + qs({ ...f, limit: 1 }))).body.total, JSON.stringify(f));
      assert.equal(c.paid, (await api.get('/payments' + qs({ ...f, filterMonth: M, filterYear: Y, limit: 1 }))).body.total, JSON.stringify(f));
    }
  });

  test('settling a student moves the Unpaid count down by one', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const before = (await api.get('/payments/counts')).body.unpaid;
    await api.post(`/payments/clear-dues/${s._id}`, {});
    assert.equal((await api.get('/payments/counts')).body.unpaid, before - 1);
  });
});
