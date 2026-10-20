const { test, expect } = require('@playwright/test');
const { api, uniqueName, addStudent, payMonth, joinedMonthsAgo, monthsAgo, signInAsAdmin } = require('../support/helpers');

const tabBtn = (page, label) => page.locator('.tabs .tab-btn').filter({ hasText: new RegExp(`^${label} \\(`) });
// the number inside "Unpaid (12)"; -1 while it still shows the loading dots
const countOf = async (page, label) => { const m = ((await tabBtn(page, label).textContent()) || '').match(/\((\d+)\)/); return m ? Number(m[1]) : -1; };
const searchBox = (page) => page.getByPlaceholder(/^Search (unpaid|paid)\.\.\./);
const unpaidRow = (page, name) => page.locator('tbody tr').filter({ hasText: name });
const unpaidTotal = async (id) => ((await api.get('/students/unpaid?limit=2000')).body.data.find(s => s._id === id) || { totalDue: 0 }).totalDue;
const owing4 = () => joinedMonthsAgo(3);     // 4 bills

test.describe.configure({ mode: 'serial' });

test.describe('Paid and Unpaid buttons', () => {
  test('show the same numbers on both tabs and match the server', async ({ page }) => {
    await addStudent({ studentName: uniqueName('Count Owes'), createdAt: owing4() });
    await signInAsAdmin(page, '/admin/payments');
    const server = (await api.get(`/payments/counts?filterMonth=${new Date().getMonth()}&filterYear=${new Date().getFullYear()}`)).body;
    await expect.poll(() => countOf(page, 'Unpaid')).toBe(server.unpaid);
    await expect.poll(() => countOf(page, 'Paid')).toBe(server.paid);
    await tabBtn(page, 'Paid').click();
    await page.waitForTimeout(600);
    expect(await countOf(page, 'Unpaid')).toBe(server.unpaid);
    expect(await countOf(page, 'Paid')).toBe(server.paid);
    await tabBtn(page, 'Unpaid').click();
    await page.waitForTimeout(600);
    expect(await countOf(page, 'Unpaid')).toBe(server.unpaid);
  });

  test('Unpaid equals the number of rows on the Unpaid tab and the dashboard overdue figure', async ({ page }) => {
    await addStudent({ studentName: uniqueName('Rows Owes'), createdAt: owing4() });   // make sure at least one student owes
    await signInAsAdmin(page, '/admin/payments');
    const unpaid = (await api.get('/students/unpaid?limit=1')).body.total;
    await expect.poll(() => countOf(page, 'Unpaid')).toBe(unpaid);
    expect((await api.get('/dashboard/stats')).body.metrics.overdue).toBe(unpaid);
    await expect(page.locator('tbody tr')).toHaveCount(Math.min(unpaid, 50));
  });

  test('the numbers follow the search box and do not depend on the open tab', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Searchable Owes'), createdAt: owing4() });
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await expect.poll(() => countOf(page, 'Unpaid')).toBe(1);
    await expect.poll(() => countOf(page, 'Paid')).toBe(0);
    await tabBtn(page, 'Paid').click();
    await expect.poll(() => countOf(page, 'Unpaid')).toBe(1);
  });

  test('settling a student lowers Unpaid by one and raises Paid by their months', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Settle Counts'), createdAt: owing4() });
    await signInAsAdmin(page, '/admin/payments');
    await expect(unpaidRow(page, s.studentName)).toBeVisible().catch(() => {});
    const before = { unpaid: (await api.get('/payments/counts')).body.unpaid };
    await api.post(`/payments/clear-dues/${s._id}`, {});
    await page.reload();
    await expect.poll(() => countOf(page, 'Unpaid')).toBe(before.unpaid - 1);
  });

  test('the Paid count follows the month filter: This Month vs All Time', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Month Filter'), createdAt: owing4() });
    await api.post(`/payments/clear-dues/${s._id}`, {});             // 4 payments, one for each of the 4 months
    await signInAsAdmin(page, '/admin/payments');
    await tabBtn(page, 'Paid').click();
    const now = new Date();
    const thisMonth = (await api.get(`/payments/counts?filterMonth=${now.getMonth()}&filterYear=${now.getFullYear()}`)).body.paid;
    await expect.poll(() => countOf(page, 'Paid')).toBe(thisMonth);
    await page.getByRole('button', { name: 'This Month' }).click();         // switches to All Time
    const allTime = (await api.get('/payments/counts')).body.paid;
    await expect.poll(() => countOf(page, 'Paid')).toBe(allTime);
    expect(allTime).toBeGreaterThan(thisMonth);
  });

  for (const term of ['(', '+91', '[', '*']) {
    test(`typing "${term}" in the search box does not cause server errors`, async ({ page }) => {
      const bad = [];
      page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) bad.push(`${r.status()} ${r.url()}`); });
      await signInAsAdmin(page, '/admin/payments');
      await searchBox(page).fill(term);
      await page.waitForTimeout(900);
      expect(bad).toEqual([]);
      await expect(tabBtn(page, 'Unpaid')).toBeVisible();
    });
  }
});

test.describe('unpaid list', () => {
  test('a row shows the months owing and the total due', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Row Owes'), createdAt: owing4() });
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    const row = unpaidRow(page, s.studentName);
    await expect(row).toContainText('4 months');
    await expect(row).toContainText('₹5200');
    await expect(row.getByRole('button', { name: 'Pay', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: /Clear All/ })).toBeVisible();
  });

  test('a lump-sum payer shows the real balance (₹2,600 of ₹5,200), the same as the history', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Lump Sum'), createdAt: owing4() });
    const m = monthsAgo(3);
    await payMonth(s._id, 2600, m.month, m.year);
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await expect(unpaidRow(page, s.studentName)).toContainText('₹2600');
    await expect(unpaidRow(page, s.studentName)).toContainText('2 months');
    const hist = (await api.get(`/payments/student/${s._id}`)).body.monthHistory;
    expect(hist.reduce((a, x) => a + x.due, 0)).toBe(2600);
  });

  test('a fully paid student is not in the unpaid list', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('All Square'), createdAt: owing4() });
    await api.post(`/payments/clear-dues/${s._id}`, {});
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await expect(page.getByText('All students have paid!')).toBeVisible();
  });

  test('inactive students are not listed', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Not Active'), createdAt: owing4() });
    await api.patch(`/students/${s._id}/toggle-status`);
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await expect(unpaidRow(page, s.studentName)).toHaveCount(0);
  });
});

test.describe('Clear All', () => {
  test('asks first; Cancel changes nothing', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Clear Cancel'), createdAt: owing4() });
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await unpaidRow(page, s.studentName).getByRole('button', { name: /Clear All/ }).click();
    const dialog = page.locator('#confirm-dialog');
    await expect(dialog).toContainText('Clear All Dues');
    await expect(dialog).toContainText('₹5200');
    await expect(dialog).toContainText('4 unpaid months');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(unpaidRow(page, s.studentName)).toBeVisible();
    expect(await unpaidTotal(s._id)).toBe(5200);
  });

  test('clears the whole balance, moves to the Paid tab, and the student is no longer unpaid', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Clear Full'), createdAt: owing4() });
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await unpaidRow(page, s.studentName).getByRole('button', { name: /Clear All/ }).click();
    await page.locator('#confirm-dialog').getByRole('button', { name: 'Yes, Clear All' }).click();
    await expect(tabBtn(page, 'Paid')).toHaveClass(/active/);
    expect(await unpaidTotal(s._id)).toBe(0);
    const history = (await api.get(`/payments/student/${s._id}`)).body;
    expect(history.monthHistory.every(m => m.status === 'paid')).toBe(true);
    expect(history.payments.filter(p => p.purpose === 'Monthly Fee')).toHaveLength(4);
    await searchBox(page).fill(s.studentName);
    await expect(page.locator('tbody tr').filter({ hasText: s.studentName })).toHaveCount(4);
  });

  test('works for a student whose current month is already paid but who still owes older months', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Clear Arrears'), createdAt: owing4() });
    const cur = monthsAgo(0);
    await payMonth(s._id, 1300, cur.month, cur.year);
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await expect(unpaidRow(page, s.studentName)).toContainText('₹3900');
    await unpaidRow(page, s.studentName).getByRole('button', { name: /Clear All/ }).click();
    await page.locator('#confirm-dialog').getByRole('button', { name: 'Yes, Clear All' }).click();
    await expect(tabBtn(page, 'Paid')).toHaveClass(/active/);
    expect(await unpaidTotal(s._id)).toBe(0);
  });

  test('works after a part-payment and clears only what is left', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Clear Partial'), createdAt: owing4() });
    const m = monthsAgo(3);
    await payMonth(s._id, 500, m.month, m.year);
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await expect(unpaidRow(page, s.studentName)).toContainText('₹4700');
    await unpaidRow(page, s.studentName).getByRole('button', { name: /Clear All/ }).click();
    await expect(page.locator('#confirm-dialog')).toContainText('₹4700');
    await page.locator('#confirm-dialog').getByRole('button', { name: 'Yes, Clear All' }).click();
    await expect(tabBtn(page, 'Paid')).toHaveClass(/active/);
    expect(await unpaidTotal(s._id)).toBe(0);
  });

  test('clears the discounted amount for a student with an offer', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Clear Offer'), createdAt: owing4() });
    await api.put(`/students/${s._id}/discount`, { discountPercent: 50, discountAmount: 0 });
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await expect(unpaidRow(page, s.studentName)).toContainText('₹4550');      // 3 x 1300 + 650
    await unpaidRow(page, s.studentName).getByRole('button', { name: /Clear All/ }).click();
    await page.locator('#confirm-dialog').getByRole('button', { name: 'Yes, Clear All' }).click();
    await expect(tabBtn(page, 'Paid')).toHaveClass(/active/);
    expect(await unpaidTotal(s._id)).toBe(0);
  });

  test('the Unpaid number goes down by one after Clear All', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Clear Count'), createdAt: owing4() });
    await signInAsAdmin(page, '/admin/payments');
    await expect.poll(() => countOf(page, 'Unpaid')).toBeGreaterThan(0);
    const before = await countOf(page, 'Unpaid');
    await searchBox(page).fill(s.studentName);
    await unpaidRow(page, s.studentName).getByRole('button', { name: /Clear All/ }).click();
    await page.locator('#confirm-dialog').getByRole('button', { name: 'Yes, Clear All' }).click();
    await searchBox(page).fill('');
    await expect.poll(() => countOf(page, 'Unpaid')).toBe(before - 1);
  });
});

test.describe('Pay button', () => {
  test('opens pre-filled with the oldest unpaid month and what is owed for it', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Pay Prefill'), createdAt: owing4() });
    const m = monthsAgo(3);
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await unpaidRow(page, s.studentName).getByRole('button', { name: 'Pay', exact: true }).click();
    const form = page.locator('.modal');
    await expect(form.getByRole('heading', { name: 'Record New Payment' })).toBeVisible();
    await expect(form.locator('input[type="number"]').first()).toHaveValue('1300');
    await expect(form.locator('select').first()).toHaveValue(String(m.month));
  });

  test('recording it lowers the balance and suggests the next month', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Pay Record'), createdAt: owing4() });
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await unpaidRow(page, s.studentName).getByRole('button', { name: 'Pay', exact: true }).click();
    await page.locator('.modal').getByRole('button', { name: /record payment|save|submit/i }).last().click();
    await expect(page.locator('.modal')).toBeHidden();
    await expect.poll(() => unpaidTotal(s._id)).toBe(3900);
  });

  test('works for a student whose current month is already paid but who still owes older months', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Pay Arrears'), createdAt: owing4() });
    const cur = monthsAgo(0);
    await payMonth(s._id, 1300, cur.month, cur.year);
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await unpaidRow(page, s.studentName).getByRole('button', { name: 'Pay', exact: true }).click();
    await page.locator('.modal').getByRole('button', { name: /record payment|save|submit/i }).last().click();
    await expect(page.locator('.modal')).toBeHidden();
    await expect.poll(() => unpaidTotal(s._id)).toBe(2600);
  });

  test('paying part of a month, then the rest of that month, is accepted', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Pay Split'), createdAt: new Date().toISOString() });
    const cur = monthsAgo(0);
    await payMonth(s._id, 500, cur.month, cur.year);
    await signInAsAdmin(page, '/admin/payments');
    await searchBox(page).fill(s.studentName);
    await unpaidRow(page, s.studentName).getByRole('button', { name: 'Pay', exact: true }).click();
    await expect(page.locator('.modal').locator('input[type="number"]').first()).toHaveValue('800');
    await page.locator('.modal').getByRole('button', { name: /record payment|save|submit/i }).last().click();
    await expect(page.locator('.modal')).toBeHidden();
    await expect.poll(() => unpaidTotal(s._id)).toBe(0);
  });
});

test.describe('Paid tab', () => {
  test('lists payments, and "Mark as Unpaid" (delete) puts the student back in Unpaid', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Undo Payment'), createdAt: new Date().toISOString() });
    const cur = monthsAgo(0);
    await payMonth(s._id, 1300, cur.month, cur.year);
    await signInAsAdmin(page, '/admin/payments');
    await tabBtn(page, 'Paid').click();
    await searchBox(page).fill(s.studentName);
    const row = page.locator('tbody tr').filter({ hasText: s.studentName });
    await expect(row).toContainText('₹1,300');   // the Paid tab writes amounts with a thousands separator
    await row.locator('button[title="Mark as Unpaid"]').click();
    await page.locator('#confirm-dialog').getByRole('button', { name: 'Yes, Mark Unpaid' }).click();
    await expect(row).toHaveCount(0);
    expect(await unpaidTotal(s._id)).toBe(1300);
  });

  test('the history button shows every month and a total that matches the unpaid list', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('History Total'), createdAt: owing4() });
    const m = monthsAgo(3);
    await payMonth(s._id, 2600, m.month, m.year);          // lump sum: should cover the two OLDEST months
    await signInAsAdmin(page, '/admin/payments');
    await tabBtn(page, 'Paid').click();
    await page.getByRole('button', { name: 'This Month' }).click();      // All Time
    await searchBox(page).fill(s.studentName);
    await page.locator('tbody tr').filter({ hasText: s.studentName }).first().locator('button[title="View Payment History"]').click();
    const modal = page.locator('.history-modal');
    await expect(modal).toContainText('₹2,600');                       // pending dues = 2,600 (not 3,900)
    expect(await unpaidTotal(s._id)).toBe(2600);
  });
});
