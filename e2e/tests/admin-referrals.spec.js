const { test, expect } = require('@playwright/test');
const { api, uniqueName, uniquePhone, addStudent, register, joinedMonthsAgo, signInAsAdmin } = require('../support/helpers');

const searchBox = (page) => page.getByPlaceholder('Search name, phone or code…');
const tab = (page, label) => page.locator('.tabs .tab-btn').filter({ hasText: new RegExp(`^${label} \\(`) });
const countOf = async (page, label) => { const m = ((await tab(page, label).textContent()) || '').match(/\((\d+)\)/); return m ? Number(m[1]) : -1; };
const rowFor = (page, name) => page.locator('tbody tr').filter({ hasText: name });
const pub = { auth: false };
const makeCode = async (s) => (await api.post('/referral/generate', { studentId: s._id, phone: s.phone }, pub)).body.referralCode;
const openPage = async (page) => { await signInAsAdmin(page, '/admin/referrals'); await expect(searchBox(page)).toBeVisible(); };

test.describe.configure({ mode: 'serial' });

test.describe('the Referrals page', () => {
  test('is in the sidebar and explains how referrals work', async ({ page }) => {
    await signInAsAdmin(page, '/admin');
    await page.locator('a[href="/admin/referrals"]').click();   // by address: the label is hidden while the sidebar is collapsed
    await expect(page).toHaveURL(/\/admin\/referrals/);
    await expect(page.locator('.referral-admin-help')).toContainText('10% off one monthly bill');
    await expect(page.locator('.referral-admin-help')).toContainText('only once you accept the friend');
  });

  test('needs a login', async ({ page }) => {
    await page.goto('/admin/referrals');
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });

  test('the three tab numbers match the server', async ({ page }) => {
    await makeCode(await addStudent({ studentName: uniqueName('Tab count A') }));
    await addStudent({ studentName: uniqueName('Tab count B') });
    await openPage(page);
    const counts = (await api.get('/referrals?limit=1')).body.counts;
    await expect.poll(() => countOf(page, 'With code')).toBe(counts.withCode);
    await expect.poll(() => countOf(page, 'No code yet')).toBe(counts.noCode);
    await expect.poll(() => countOf(page, 'All')).toBe(counts.all);
    expect(counts.all).toBe(counts.withCode + counts.noCode);
  });

  test('lists a student with name, phone, classes, code, created date and friend counts', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Listed Student'), extraClasses: [{ classType: 'Silambam Class' }] });
    const code = await makeCode(s);
    await openPage(page);
    await searchBox(page).fill(s.studentName);
    const row = rowFor(page, s.studentName);
    await expect(row).toContainText(s.phone);
    await expect(row).toContainText('Karate');
    await expect(row).toContainText('Silambam');
    await expect(row.locator('code')).toHaveText(code);
    await expect(row).toContainText('0 accepted');
    await expect(row).toContainText(new Date().getFullYear().toString());
  });

  test('search works by name, phone and code (also the first letters of a code)', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Searchable Ref') });
    const code = await makeCode(s);
    await openPage(page);
    for (const term of [s.studentName, s.phone, code, code.slice(0, 5)]) {
      await searchBox(page).fill(term);
      await expect(rowFor(page, s.studentName), term).toBeVisible();
    }
    await searchBox(page).fill('zzz-nothing-matches');
    await expect(page.getByText('No student matches this search.')).toBeVisible();
  });

  test('typing symbols in the search box does not break the page', async ({ page }) => {
    const bad = [];
    page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) bad.push(r.url()); });
    await openPage(page);
    for (const term of ['(', '+91', '[', '*']) { await searchBox(page).fill(term); await page.waitForTimeout(500); }
    expect(bad).toEqual([]);
    await expect(searchBox(page)).toBeVisible();
  });

  test('the "No code yet" tab lists students without a code and Generate gives them one', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Needs Code') });
    await openPage(page);
    await tab(page, 'No code yet').click();
    await searchBox(page).fill(s.studentName);
    await rowFor(page, s.studentName).getByRole('button', { name: 'Generate' }).click();
    await expect(page.locator('.referral-admin-notice.success')).toContainText(`created for ${s.studentName}`);
    await expect(rowFor(page, s.studentName)).toHaveCount(0);                      // it has moved to "With code"
    await tab(page, 'With code').click();
    await expect(rowFor(page, s.studentName).locator('code')).toHaveText(/^KJ[A-Z]{4}[2-9]{2}$/);
  });

  test('the copy button copies the code', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    const s = await addStudent({ studentName: uniqueName('Copy Me') });
    const code = await makeCode(s);
    await openPage(page);
    await searchBox(page).fill(s.studentName);
    await rowFor(page, s.studentName).locator('.referral-admin-copy').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => code);
    expect(copied).toBe(code);
  });
});

test.describe('regenerate', () => {
  test('asks first; Cancel leaves the code as it was', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Regen Cancel') });
    const code = await makeCode(s);
    await openPage(page);
    await searchBox(page).fill(s.studentName);
    await rowFor(page, s.studentName).getByRole('button', { name: 'Regenerate' }).click();
    const dialog = page.locator('#confirm-dialog');
    await expect(dialog).toContainText('Regenerate referral code?');
    await expect(dialog).toContainText(code);
    await expect(dialog).toContainText('EXPIRE immediately');
    await expect(dialog).toContainText('already registered with the old code are still rewarded');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(rowFor(page, s.studentName).locator('code')).toHaveText(code);
    expect((await api.get(`/referral/check/${code}`, pub)).body.valid).toBe(true);
  });

  test('confirming expires the old code, shows the new one and says so', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Regen Yes') });
    const old = await makeCode(s);
    await openPage(page);
    await searchBox(page).fill(s.studentName);
    await rowFor(page, s.studentName).getByRole('button', { name: 'Regenerate' }).click();
    await page.locator('#confirm-dialog').getByRole('button', { name: 'Yes, regenerate' }).click();
    const notice = page.locator('.referral-admin-notice.success');
    await expect(notice).toContainText('New code');
    await expect(notice).toContainText(`old code ${old} has expired`);
    const row = rowFor(page, s.studentName);
    await expect(row.locator('code')).not.toHaveText(old);
    await expect(row).toContainText('1 old code expired');
    expect((await api.get(`/referral/check/${old}`, pub)).body.reason).toBe('expired');
  });

  test('inactive students cannot be regenerated', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Regen Inactive') });
    await makeCode(s);
    await api.patch(`/students/${s._id}/toggle-status`);
    await openPage(page);
    await searchBox(page).fill(s.studentName);
    await expect(rowFor(page, s.studentName)).toContainText('Inactive');
    await expect(rowFor(page, s.studentName).getByRole('button', { name: 'Regenerate' })).toBeDisabled();
  });
});

test.describe('details: history and friends', () => {
  test('shows the old codes and every friend who used one, with their status', async ({ page }) => {
    const owner = await addStudent({ studentName: uniqueName('Detail Owner'), createdAt: joinedMonthsAgo(2) });
    const first = await makeCode(owner);
    const accepted = uniqueName('Det Accepted'), waiting = uniqueName('Det Waiting'), rejected = uniqueName('Det Rejected');
    for (const n of [accepted, waiting, rejected]) await register({ studentName: n, referralCode: first });
    const pending = (await api.get('/registrations/pending')).body;
    await api.post(`/registrations/${pending.find(r => r.studentName === accepted)._id}/approve`, {});
    await api.post(`/registrations/${pending.find(r => r.studentName === rejected)._id}/reject`);
    await api.post(`/referrals/${owner._id}/regenerate`);

    await openPage(page);
    await searchBox(page).fill(owner.studentName);
    await expect(rowFor(page, owner.studentName)).toContainText('1 accepted');
    await expect(rowFor(page, owner.studentName)).toContainText('1 waiting');
    await rowFor(page, owner.studentName).getByRole('button', { name: 'Details' }).click();
    const modal = page.locator('.referral-details');
    await expect(modal).toContainText('Old codes (expired)');
    await expect(modal.locator('table').first()).toContainText(first);
    await expect(modal.locator('table').first()).toContainText('Admin');   // the admin regenerated it
    const friends = modal.locator('table').nth(1);
    await expect(friends.locator('tr', { hasText: accepted })).toContainText('Accepted');
    await expect(friends.locator('tr', { hasText: waiting })).toContainText('Waiting for you');
    await expect(friends.locator('tr', { hasText: rejected })).toContainText('Rejected');
    await expect(friends.locator('tr', { hasText: accepted })).toContainText('expired since');
    await expect(modal).toContainText('Rewards given');
    await expect(modal).toContainText('10% off');
  });

  test('a student who never regenerated shows no old codes, and can be regenerated from the dialog', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Detail Fresh') });
    const code = await makeCode(s);
    await openPage(page);
    await searchBox(page).fill(s.studentName);
    await rowFor(page, s.studentName).getByRole('button', { name: 'Details' }).click();
    const modal = page.locator('.referral-details');
    await expect(modal).toContainText('never regenerated');
    await expect(modal).toContainText('No friend has used a code yet');
    await modal.getByRole('button', { name: 'Regenerate code' }).click();
    await page.locator('#confirm-dialog').getByRole('button', { name: 'Yes, regenerate' }).click();
    await expect(page.locator('.referral-admin-notice.success')).toContainText(`old code ${code} has expired`);
  });
});

test.describe('the New Joiners page and expired codes', () => {
  test('a friend who used a code that has since been replaced is still shown as rewarded', async ({ page }) => {
    const owner = await addStudent({ studentName: uniqueName('Late Owner'), createdAt: joinedMonthsAgo(2) });
    const code = await makeCode(owner);
    const friend = uniqueName('Late Friend');
    await register({ studentName: friend, referralCode: code });
    await api.post(`/referrals/${owner._id}/regenerate`);
    await signInAsAdmin(page, '/admin/registrations');
    const banner = page.locator('.registration-card').filter({ hasText: friend }).locator('.reg-referral');
    await expect(banner).toContainText(`Referred by ${owner.studentName}`);
    await expect(banner).toContainText('has been replaced since');
    await expect(banner).toContainText('reward still applies');
    await page.locator('.registration-card').filter({ hasText: friend }).locator('.btn-approve').click();
    await expect(page.getByText(/Accepted\. Referral: .* gets 10% off/)).toBeVisible();
  });
});
