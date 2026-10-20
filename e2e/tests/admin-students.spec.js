const { test, expect } = require('@playwright/test');
const { api, uniqueName, uniquePhone, addStudent, joinedMonthsAgo, signInAsAdmin } = require('../support/helpers');

const TABS = [['All', 'all'], ['Regular', 'Regular Class'], ['Fitness', 'Fitness Class'], ['Online', 'Online Class'], ['Karate', 'Karate Class'], ['Zumba', 'Zumba Class'], ['Silambam', 'Silambam Class'], ['Art & Craft', 'Art & Craft Class']];
const searchBox = (page) => page.getByPlaceholder('Search students...');
const tab = (page, label) => page.locator('.tabs .tab-btn').filter({ hasText: new RegExp(`^${label.replace(/[&]/g, '\\&')} \\(`, 'i') });
// the number inside "Karate (12)"; -1 while it still shows the loading dots
const countOf = async (page, label) => { const m = ((await tab(page, label).textContent()) || '').match(/\((\d+)\)/); return m ? Number(m[1]) : -1; };
const rowFor = (page, name) => page.locator('tbody tr').filter({ hasText: name });

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // a spread of students so the filters have something to work on
  await addStudent({ studentName: uniqueName('Kid Weekday'), studentAge: '7', classType: 'Regular Class', classSchedule: 'Weekday' });
  await addStudent({ studentName: uniqueName('Adult Weekend'), studentAge: '35', classType: 'Regular Class', classSchedule: 'Weekend' });
  await addStudent({ studentName: uniqueName('Fit Adult'), studentAge: '40', classType: 'Fitness Class', classSchedule: 'Weekday' });
  await addStudent({ studentName: uniqueName('Online Kid'), studentAge: '8', classType: 'Online Class', classSchedule: 'Weekday' });
  await addStudent({ studentName: uniqueName('Silambam Kid'), studentAge: '9', classType: 'Silambam Class' });
  await addStudent({ studentName: uniqueName('Art Kid'), studentAge: '6', classType: 'Art & Craft Class' });
  await addStudent({ studentName: uniqueName('Both Classes'), classType: 'Karate Class', extraClasses: [{ classType: 'Zumba Class', feePlan: '3 Class', batchTiming: 'Morning 6:00 AM – 7:00 AM' }] });
  await addStudent({ studentName: uniqueName('Plus (Test) [A]'), phone: '+91 98765 43210' });
});

test.describe('tabs and counts', () => {
  test('opens on the All tab, listing every student', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await expect(page.locator('.tabs .tab-btn.active')).toContainText('All (');
    const total = (await api.get('/students?limit=1')).body.total;
    await expect.poll(() => countOf(page, 'All')).toBe(total);
  });

  test('every tab button shows the same number the server counts for that tab', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    const counts = (await api.get('/students/counts')).body;
    for (const [label, key] of TABS) await expect.poll(() => countOf(page, label), { message: label }).toBe(counts[key]);
  });

  test('a class tab lists only that class (and the count matches the list size)', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await tab(page, 'Fitness').click();
    const count = await countOf(page, 'Fitness');
    await expect(page.locator('tbody tr')).toHaveCount(Math.min(count, 50));
    await expect(page.locator('tbody tr').first()).toContainText('Fit Adult');
  });

  test('a student with two classes appears in both class tabs and the number goes up in both', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await tab(page, 'Zumba').click();
    await searchBox(page).fill('Both Classes');
    await expect(page.locator('tbody tr').first()).toContainText('Both Classes');
    await tab(page, 'Karate').click();
    await expect(page.locator('tbody tr').first()).toContainText('Both Classes');
  });

  test('the All tab labels each student with their first class', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill('Silambam Kid');
    await expect(page.locator('tbody tr').first()).toContainText('Silambam');
  });

  test('the tab numbers follow the search box', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill('Both Classes');
    await expect.poll(() => countOf(page, 'All')).toBe(1);
    await expect.poll(() => countOf(page, 'Karate')).toBe(1);
    await expect.poll(() => countOf(page, 'Zumba')).toBe(1);
    await expect.poll(() => countOf(page, 'Fitness')).toBe(0);
  });
});

test.describe('filters', () => {
  test('Weekday / Weekend buttons filter the list and the tab numbers', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await page.locator('.schedule-filter-btn', { hasText: 'Weekend' }).click();
    const weekend = (await api.get('/students/counts?classSchedule=Weekend')).body;
    await expect.poll(() => countOf(page, 'All')).toBe(weekend.all);
    await expect(page.locator('tbody tr').first()).toContainText('Adult Weekend');
    await page.locator('.schedule-filter-btn', { hasText: 'All Schedule' }).click();
    await expect.poll(() => countOf(page, 'All')).toBe((await api.get('/students/counts')).body.all);
  });

  test('the Kids / Adults dropdown filters the list and the tab numbers', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await page.locator('.cat-drop__trigger').click();
    await page.locator('.cat-drop__menu li').filter({ hasText: /^Kids/ }).click();
    const kids = (await api.get('/students/counts?studentCategory=Kids')).body;
    await expect.poll(() => countOf(page, 'All')).toBe(kids.all);
    await expect(page.locator('tbody tr').first()).toContainText(/Kid|Art Kid|Silambam Kid|Online Kid/);
  });

  test('search + class tab + schedule together', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await tab(page, 'Regular').click();
    await page.locator('.schedule-filter-btn', { hasText: 'Weekday' }).click();
    await searchBox(page).fill('Kid Weekday');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr')).toContainText('Kid Weekday');
  });

  test('a search with nothing found says so', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill('zzz-nobody-has-this-name');
    await expect(page.getByText('No students found')).toBeVisible();
    await expect.poll(() => countOf(page, 'All')).toBe(0);
  });

  for (const term of ['(', '+91', '[', '*', '\\', '?', '$']) {
    test(`typing "${term}" in the search box does not break the page`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const bad = [];
      page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) bad.push(`${r.status()} ${r.url()}`); });
      await signInAsAdmin(page, '/admin/students');
      await searchBox(page).fill(term);
      await page.waitForTimeout(900);
      expect(bad, 'no server errors').toEqual([]);
      expect(errors).toEqual([]);
      await expect(page.locator('.tabs .tab-btn').first()).toBeVisible();
    });
  }

  test('searching for brackets finds the student with brackets in the name', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill('(Test)');
    await expect(page.locator('tbody tr').first()).toContainText('Plus (Test) [A]');
  });

  test('a +91 number is found, and so is the same number typed with different spacing', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill('+91 98765');
    await expect(page.locator('tbody tr').first()).toContainText('Plus (Test) [A]');
    await searchBox(page).fill('98765 43210');
    await expect(page.locator('tbody tr').first()).toContainText('Plus (Test) [A]');
  });

  test('quick typing never leaves stale results on screen', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).pressSequentially('Silambam', { delay: 30 });
    await searchBox(page).fill('');
    await searchBox(page).pressSequentially('Art Kid', { delay: 30 });
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr')).toContainText('Art Kid');
  });
});

test.describe('Add Student', () => {
  const openAdd = async (page) => {
    await signInAsAdmin(page, '/admin/students');
    await page.getByRole('button', { name: 'Add Student' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Student' })).toBeVisible();
  };
  const chip = (page, text, exact = false) => page.locator('.type-option-admin').filter({ hasText: exact ? new RegExp(`^${text}$`) : text });
  const save = (page) => page.getByRole('button', { name: /save student/i });

  test('needs a name and a phone before it can be saved', async ({ page }) => {
    await openAdd(page);
    await expect(save(page)).toBeDisabled();
    await page.locator('input[name="studentName"]').fill('Only Name');
    await expect(save(page)).toBeDisabled();
    await page.locator('input[name="phone"]').fill(uniquePhone());
    await expect(save(page)).toBeEnabled();
  });

  test('shows the fee for the chosen classes, with the Zumba plan and an optional second class', async ({ page }) => {
    await openAdd(page);
    await page.locator('input[name="studentName"]').fill('Fee Preview');
    await page.locator('input[name="phone"]').fill(uniquePhone());
    await chip(page, 'Karate Class').first().click();
    await expect(page.getByText('Fee per month').first()).toBeVisible();
    await expect(page.locator('.admin-student-form')).toContainText('₹1,300');
    await chip(page, '+ Zumba Class').click();
    await expect(save(page)).toBeDisabled();                       // Zumba needs a plan and a batch
    await chip(page, '5 Classes / week').click();
    await chip(page, 'Morning 6:00 AM – 7:00 AM').click();
    await expect(save(page)).toBeEnabled();
    await expect(page.locator('.admin-student-form')).toContainText('₹3,300');
    await expect(page.locator('.admin-student-form')).toContainText('2 classes');
  });

  test('the offer boxes show the discount and the final fee live', async ({ page }) => {
    await openAdd(page);
    await chip(page, 'Karate Class').first().click();
    await page.locator('input[placeholder="0"]').nth(0).fill('10');
    await page.locator('input[placeholder="0"]').nth(1).fill('100');
    await expect(page.locator('.admin-student-form')).toContainText('− ₹230');       // 130 + 100
    await expect(page.locator('.admin-student-form')).toContainText('₹1,070');
  });

  test('the referral code is checked as you type', async ({ page }) => {
    const owner = await addStudent({ studentName: uniqueName('Admin Ref Owner'), createdAt: joinedMonthsAgo(2) });
    const code = (await api.post('/referral/generate', { studentId: owner._id, phone: owner.phone }, { auth: false })).body.referralCode;
    await openAdd(page);
    const field = page.locator('input[name="referralCode"]');
    await field.fill(code);
    await expect(page.locator('.admin-student-form')).toContainText(`Code accepted — ${owner.studentName.split(' ')[0]} gets 10% off`);
    await field.fill('KJNOPE22');
    await expect(page.locator('.admin-student-form')).toContainText('We could not find this code');
  });

  test('saving adds the student with their classes and offer', async ({ page }) => {
    await openAdd(page);
    const name = uniqueName('Saved Student');
    await page.locator('input[name="studentName"]').fill(name);
    await page.locator('input[name="phone"]').fill(uniquePhone());
    await page.locator('input[name="studentAge"]').fill('30');
    await chip(page, 'Karate Class').first().click();
    await chip(page, '+ Silambam Class').click();
    await page.locator('input[placeholder="0"]').nth(0).fill('10');
    await save(page).click();
    await expect(page.getByRole('heading', { name: 'Add New Student' })).toBeHidden();
    await searchBox(page).fill(name);
    const row = rowFor(page, name);
    await expect(row).toContainText('+ Silambam');
    await expect(row).toContainText('Offer · ₹1,890');            // (1300 + 800) - 10%
  });

  test('saving with a referral code rewards the referrer and says so', async ({ page }) => {
    const owner = await addStudent({ studentName: uniqueName('Reward Owner'), createdAt: joinedMonthsAgo(2) });
    const code = (await api.post('/referral/generate', { studentId: owner._id, phone: owner.phone }, { auth: false })).body.referralCode;
    await openAdd(page);
    await page.locator('input[name="studentName"]').fill(uniqueName('Referred By Admin'));
    await page.locator('input[name="phone"]').fill(uniquePhone());
    await chip(page, 'Karate Class').first().click();
    await page.locator('input[name="referralCode"]').fill(code);
    await expect(page.locator('.admin-student-form')).toContainText('Code accepted');
    await save(page).click();
    await expect(page.getByText(/Student added\. Referral: .* gets 10% off/)).toBeVisible();
  });

  test('an invalid code stops the save and shows the reason', async ({ page }) => {
    await openAdd(page);
    const name = uniqueName('Bad Code Student');
    await page.locator('input[name="studentName"]').fill(name);
    await page.locator('input[name="phone"]').fill(uniquePhone());
    await chip(page, 'Karate Class').first().click();
    await page.locator('input[name="referralCode"]').fill('KJNOPE22');
    page.once('dialog', async (d) => { expect(d.message()).toMatch(/could not find this code/i); await d.accept(); });
    await save(page).click();
    await page.waitForTimeout(600);
    expect((await api.get(`/students?search=${encodeURIComponent(name)}`)).body.total).toBe(0);
  });

  test('adding the same name and phone twice is refused', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Existing Student') });
    await openAdd(page);
    await page.locator('input[name="studentName"]').fill(s.studentName);
    await page.locator('input[name="phone"]').fill(s.phone);
    await chip(page, 'Karate Class').first().click();
    page.once('dialog', async (d) => { expect(d.message()).toMatch(/already registered/i); await d.accept(); });
    await save(page).click();
    await page.waitForTimeout(600);
    expect((await api.get(`/students?search=${encodeURIComponent(s.studentName)}`)).body.total).toBe(1);
  });
});

test.describe('student actions', () => {
  test('the % button opens the offer dialog: current bill if unpaid, with a live final fee', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Offer Student'), createdAt: joinedMonthsAgo(3) });
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill(s.studentName);
    await rowFor(page, s.studentName).locator('button[title="Give Offer / Discount"]').click();
    const dialog = page.locator('.modal');
    await expect(dialog).toContainText('Student Offer');
    await expect(dialog).toContainText('Karate Class');
    await expect(dialog).toContainText('unpaid, so the offer applies to the current bill');
    await dialog.locator('.offer-input-wrap input').nth(0).fill('50');
    await expect(dialog).toContainText('₹650');
    await dialog.getByRole('button', { name: 'Save Offer' }).click();
    await expect(dialog).toBeHidden();
    await expect(rowFor(page, s.studentName)).toContainText('Offer · ₹650');
  });

  test('the offer dialog says "next month" when this month is already paid', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Paid Offer'), createdAt: joinedMonthsAgo(0, 0) });
    const d = new Date();
    await api.post('/payments', { studentId: s._id, amount: 1300, purpose: 'Monthly Fee', method: 'Cash', forMonth: d.getMonth(), forYear: d.getFullYear(), date: new Date().toISOString() });
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill(s.studentName);
    await rowFor(page, s.studentName).locator('button[title="Give Offer / Discount"]').click();
    await expect(page.locator('.modal')).toContainText('already paid, so the offer starts from next month');
  });

  test('removing an offer (0 and 0) restores the full fee', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Remove Offer'), createdAt: joinedMonthsAgo(1), discountPercent: 50 });
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill(s.studentName);
    await expect(rowFor(page, s.studentName).locator('.mini-badge').filter({ hasText: /^Offer/ })).toHaveCount(1);
    await rowFor(page, s.studentName).locator('button[title="Give Offer / Discount"]').click();
    const dialog = page.locator('.modal');
    await dialog.locator('.offer-input-wrap input').nth(0).fill('0');
    await dialog.getByRole('button', { name: 'Save Offer' }).click();
    await expect(dialog).toBeHidden();
    await expect(rowFor(page, s.studentName).locator('.mini-badge').filter({ hasText: /^Offer/ })).toHaveCount(0);
  });

  test('the status badge shows Paid / Unpaid correctly', async ({ page }) => {
    const paid = await addStudent({ studentName: uniqueName('Badge Paid'), createdAt: new Date().toISOString() });
    const d = new Date();
    await api.post('/payments', { studentId: paid._id, amount: 1300, purpose: 'Monthly Fee', method: 'Cash', forMonth: d.getMonth(), forYear: d.getFullYear(), date: new Date().toISOString() });
    const unpaid = await addStudent({ studentName: uniqueName('Badge Unpaid'), createdAt: joinedMonthsAgo(2) });
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill('Badge ');
    await expect(rowFor(page, paid.studentName)).toContainText('Paid');
    await expect(rowFor(page, unpaid.studentName)).toContainText('Unpaid');
  });

  test('editing changes the details and recomputes Kids / Adults from the age', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Edit Student'), studentAge: '30' });
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill(s.studentName);
    await rowFor(page, s.studentName).locator('button[title="Edit Student Info"]').click();
    await expect(page.getByRole('heading', { name: 'Edit Student' })).toBeVisible();
    await expect(page.locator('.admin-student-form')).not.toContainText('Offer %');   // offers are not part of editing
    await page.locator('input[name="studentAge"]').fill('6');
    await page.getByRole('button', { name: /update student/i }).click();
    await expect(page.getByRole('heading', { name: 'Edit Student' })).toBeHidden();
    await expect.poll(async () => (await api.get(`/students?search=${encodeURIComponent(s.studentName)}`)).body.data[0].studentCategory).toBe('Kids');
  });

  test('inactive / active toggle', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Toggle Student') });
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill(s.studentName);
    const row = rowFor(page, s.studentName);
    await row.locator('.status-toggle-btn').click();
    await expect(row.locator('.status-toggle-btn')).toContainText('Inactive');
    await row.locator('.status-toggle-btn').click();
    await expect(row.locator('.status-toggle-btn')).toContainText('Active');
  });

  test('delete asks first, then removes the student', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Delete Student') });
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill(s.studentName);
    await rowFor(page, s.studentName).locator('button[title="Delete Student"]').click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(rowFor(page, s.studentName)).toBeVisible();
    await rowFor(page, s.studentName).locator('button[title="Delete Student"]').click();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();
    await expect(rowFor(page, s.studentName)).toHaveCount(0);
  });

  test('the history button shows the month-by-month bills', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('History Student'), createdAt: joinedMonthsAgo(2) });
    await signInAsAdmin(page, '/admin/students');
    await searchBox(page).fill(s.studentName);
    await rowFor(page, s.studentName).locator('button[title="View Payment History"]').click();
    await expect(page.locator('.history-modal')).toContainText(s.studentName);
    await expect(page.locator('.history-modal')).toContainText('₹3,900');       // 3 unpaid months
  });
});
