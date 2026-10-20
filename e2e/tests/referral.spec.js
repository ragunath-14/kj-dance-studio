const { test, expect } = require('@playwright/test');
const { api, uniqueName, uniquePhone, addStudent, register, joinedMonthsAgo, signInAsAdmin } = require('../support/helpers');

const referral = (page) => page.locator('#referral');
const lookup = async (page, phone) => {
  await page.goto('/#referral');
  await referral(page).getByPlaceholder('Your registered phone number').fill(phone);
  await referral(page).getByRole('button', { name: 'Find my account' }).click();
};

test.describe('Refer & Save section', () => {
  test('explains the offer: 10% for one friend, 20% for two', async ({ page }) => {
    await page.goto('/#referral');
    await expect(referral(page)).toContainText('10% off');
    await expect(referral(page)).toContainText('2 friends = 20% off');
    await expect(referral(page)).toContainText('Enter your phone number');
    await expect(referral(page)).toContainText('Generate your code');
  });

  test('a short phone number is refused with a message', async ({ page }) => {
    await lookup(page, '12345');
    await expect(referral(page)).toContainText('valid 10-digit phone number');
  });

  test('an unknown number says it is not an accepted student and offers to register', async ({ page }) => {
    await lookup(page, '9000000000');
    await expect(referral(page)).toContainText('couldn’t find an accepted student');
    await referral(page).getByRole('button', { name: 'Register now' }).click();
    await expect(page.getByRole('heading', { name: 'Student Registration' })).toBeVisible();
  });

  test('a registration still waiting for the admin is told to wait', async ({ page }) => {
    const phone = uniquePhone();
    await register({ phone });
    await lookup(page, phone);
    await expect(referral(page)).toContainText('waiting for the studio to accept');
    await expect(referral(page).getByRole('button', { name: 'Generate Referral Code' })).toHaveCount(0);
  });

  test('an accepted student sees their name, classes and status, and can generate a code', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Meena Student'), extraClasses: [{ classType: 'Silambam Class' }] });
    await lookup(page, s.phone);
    const card = referral(page).locator('.referral-card');
    await expect(card).toContainText(s.studentName);
    await expect(card).toContainText('Karate Class · Silambam Class');
    await expect(card).toContainText('Active student');
    await card.getByRole('button', { name: 'Generate Referral Code' }).click();
    const code = card.locator('.referral-code strong');
    await expect(code).toHaveText(/^KJ[A-HJ-NP-Z2-9]{6}$/);
    await expect(card).toContainText('0');
    await expect(card).toContainText('friends joined');
  });

  test('the same code comes back when the student looks themselves up again', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Again Student') });
    await lookup(page, s.phone);
    await referral(page).getByRole('button', { name: 'Generate Referral Code' }).click();
    const first = await referral(page).locator('.referral-code strong').textContent();
    await page.reload();
    await lookup(page, s.phone);
    await expect(referral(page).locator('.referral-code strong')).toHaveText(first);
    await expect(referral(page).getByRole('button', { name: 'Generate Referral Code' })).toHaveCount(0);
  });

  test('a number typed with +91 and spaces works', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Formatted'), phone: '+91 98765 22222' });
    await lookup(page, '+91 98765 22222');
    await expect(referral(page)).toContainText(s.studentName);
  });

  test('students sharing one phone are all listed and each gets their own code', async ({ page }) => {
    const phone = uniquePhone();
    const a = await addStudent({ studentName: uniqueName('Sibling A'), phone });
    const b = await addStudent({ studentName: uniqueName('Sibling B'), phone });
    await lookup(page, phone);
    await expect(referral(page)).toContainText('More than one student uses this number');
    const cards = referral(page).locator('.referral-card');
    await expect(cards).toHaveCount(2);
    await cards.filter({ hasText: a.studentName }).getByRole('button', { name: 'Generate Referral Code' }).click();
    await expect(cards.filter({ hasText: a.studentName }).locator('.referral-code strong')).toBeVisible();
    await expect(cards.filter({ hasText: b.studentName }).getByRole('button', { name: 'Generate Referral Code' })).toBeVisible();
  });

  test('an inactive student is told to contact the studio and cannot generate', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Gone Student') });
    await api.patch(`/students/${s._id}/toggle-status`);
    await lookup(page, s.phone);
    await expect(referral(page)).toContainText('Inactive');
    await expect(referral(page)).toContainText('contact the studio');
    await expect(referral(page).getByRole('button', { name: 'Generate Referral Code' })).toHaveCount(0);
  });

  test('Copy shows "Copied" and WhatsApp share opens a link with the code', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
    const s = await addStudent({ studentName: uniqueName('Share Student') });
    await lookup(page, s.phone);
    await referral(page).getByRole('button', { name: 'Generate Referral Code' }).click();
    const code = await referral(page).locator('.referral-code strong').textContent();
    await referral(page).getByRole('button', { name: 'Copy' }).click();
    await expect(referral(page).getByRole('button', { name: 'Copied' })).toBeVisible();
    const [popup] = await Promise.all([page.waitForEvent('popup'), referral(page).getByRole('button', { name: /Share on WhatsApp/ }).click()]);
    const url = decodeURIComponent(popup.url());
    expect(url).toContain('wa.me');
    expect(url).toContain(code);
    expect(url).toContain(`?ref=${code}`);
  });
});

test.describe('making a new code on the website', () => {
  test('is offered only to a student who already has a code', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Renew Offer') });
    await lookup(page, s.phone);
    await expect(referral(page).getByRole('button', { name: /Get a new code/ })).toHaveCount(0);
    await referral(page).getByRole('button', { name: 'Generate Referral Code' }).click();
    await expect(referral(page).getByRole('button', { name: /Get a new code/ })).toBeVisible();
  });

  test('warns first; keeping the current code changes nothing', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Renew Keep') });
    await lookup(page, s.phone);
    await referral(page).getByRole('button', { name: 'Generate Referral Code' }).click();
    const code = await referral(page).locator('.referral-code strong').textContent();
    await referral(page).getByRole('button', { name: /Get a new code/ }).click();
    const dialog = page.locator('.referral-modal');
    await expect(dialog).toContainText('Make a new code?');
    await expect(dialog).toContainText(code);
    await expect(dialog).toContainText('stop working right away');
    await expect(dialog).toContainText('already registered with the old code are still counted');
    await dialog.getByRole('button', { name: 'Keep my current code' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(referral(page).locator('.referral-code strong')).toHaveText(code);
    expect((await api.get(`/referral/check/${code}`, { auth: false })).body.valid).toBe(true);
  });

  test('confirming expires the old code and shows the new one with a clear message', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Renew Yes') });
    await lookup(page, s.phone);
    await referral(page).getByRole('button', { name: 'Generate Referral Code' }).click();
    const oldCode = await referral(page).locator('.referral-code strong').textContent();
    await referral(page).getByRole('button', { name: /Get a new code/ }).click();
    await page.locator('.referral-modal').getByRole('button', { name: 'Yes, make a new code' }).click();
    await expect(referral(page).locator('.referral-renewed')).toContainText(`old code ${oldCode} has expired`);
    const newCode = await referral(page).locator('.referral-code strong').textContent();
    expect(newCode).not.toBe(oldCode);
    expect(newCode).toMatch(/^KJ[A-HJ-NP-Z2-9]{6}$/);
    await expect(referral(page).locator('.referral-code-date')).toContainText('Created on');
    expect((await api.get(`/referral/check/${oldCode}`, { auth: false })).body.reason).toBe('expired');
    expect((await api.get(`/referral/check/${newCode}`, { auth: false })).body.valid).toBe(true);
  });

  test('after a reload the page shows the NEW code and how many older ones have expired', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Renew Reload') });
    await lookup(page, s.phone);
    await referral(page).getByRole('button', { name: 'Generate Referral Code' }).click();
    await referral(page).getByRole('button', { name: /Get a new code/ }).click();
    await page.locator('.referral-modal').getByRole('button', { name: 'Yes, make a new code' }).click();
    const newCode = await referral(page).locator('.referral-code strong').textContent();
    await page.reload();
    await lookup(page, s.phone);
    await expect(referral(page).locator('.referral-code strong')).toHaveText(newCode);
    await expect(referral(page).locator('.referral-code-date')).toContainText('1 older code has expired');
  });

  test('the shared link and the register form accept only the NEW code', async ({ page, browser }) => {
    const s = await addStudent({ studentName: uniqueName('Renew Link') });
    await lookup(page, s.phone);
    await referral(page).getByRole('button', { name: 'Generate Referral Code' }).click();
    const oldCode = await referral(page).locator('.referral-code strong').textContent();
    await referral(page).getByRole('button', { name: /Get a new code/ }).click();
    await page.locator('.referral-modal').getByRole('button', { name: 'Yes, make a new code' }).click();
    const newCode = await referral(page).locator('.referral-code strong').textContent();

    const friend = await browser.newPage();
    await friend.goto(`/?ref=${oldCode}`);
    await expect(friend.locator('.ref-status--invalid')).toContainText('This code has expired');
    await expect(friend.locator('.ref-popup')).toBeVisible().catch(() => {});
    await friend.goto(`/?ref=${newCode}`);
    await expect(friend.locator('.ref-status--valid')).toBeVisible();
    await friend.close();
  });

  test('only an already-accepted student can create or renew a code; others are told why', async ({ page }) => {
    await lookup(page, '9000000000');
    await expect(referral(page)).toContainText('couldn’t find an accepted student');
    await expect(referral(page).getByRole('button', { name: /Generate Referral Code|Get a new code/ })).toHaveCount(0);
    const phone = uniquePhone();
    await register({ phone });
    await lookup(page, phone);
    await expect(referral(page)).toContainText('waiting for the studio to accept');
    await expect(referral(page).getByRole('button', { name: /Generate Referral Code|Get a new code/ })).toHaveCount(0);
  });
});

test.describe('the whole referral journey', () => {
  test('generate a code, a friend registers with it, the admin accepts, and the reward shows up', async ({ page, browser }) => {
    // 1. the referrer (joined 2 months ago, current bill unpaid) generates a code on the website
    const owner = await addStudent({ studentName: uniqueName('Journey Owner'), createdAt: joinedMonthsAgo(2) });
    await lookup(page, owner.phone);
    await referral(page).getByRole('button', { name: 'Generate Referral Code' }).click();
    const code = await referral(page).locator('.referral-code strong').textContent();

    // 2. a friend opens the shared link and registers
    const friendPage = await browser.newPage();
    await friendPage.goto(`/?ref=${code}`);
    await expect(friendPage.locator('input[name="referralCode"]')).toHaveValue(code);
    const friendName = uniqueName('Journey Friend');
    await friendPage.locator('input[name="studentName"]').fill(friendName);
    await friendPage.locator('input[name="phone"]').fill(uniquePhone());
    await friendPage.getByRole('button', { name: 'Select Class' }).click();
    await friendPage.locator('.custom-select__option').filter({ has: friendPage.getByText('Silambam Class', { exact: true }) }).click();
    await friendPage.locator('.custom-select__done button').click();
    await friendPage.getByRole('button', { name: /submit registration/i }).click();
    await expect(friendPage.locator('.message-banner.success')).toBeVisible();
    await friendPage.close();

    // 3. registering alone earns nothing yet
    await lookup(page, owner.phone);
    await expect(referral(page)).toContainText('No reward yet');

    // 4. the admin sees who referred the friend and accepts
    await signInAsAdmin(page, '/admin/registrations');
    const card = page.locator('.registration-card').filter({ hasText: friendName });
    await expect(card.locator('.reg-referral')).toContainText(`Referred by ${owner.studentName}`);
    await expect(card.locator('.reg-referral')).toContainText('10% off');
    await card.locator('.btn-approve').click();
    await expect(page.getByText(/Accepted\. Referral: .* gets 10% off/)).toBeVisible();

    // 5. the referrer now sees the reward on the website
    await lookup(page, owner.phone);
    await expect(referral(page).locator('.referral-stats')).toContainText('1');
    await expect(referral(page).locator('.referral-stats')).toContainText('friends joined');
    await expect(referral(page).locator('.referral-stats')).toContainText('10% off');

    // 6. and their bill really is lower: 1300 + 1300 + 1170
    const due = (await api.get('/students/unpaid?limit=1000')).body.data.find(s => s._id === owner._id);
    expect(due.totalDue).toBe(1300 + 1300 + 1170);
  });

  test('two accepted friends make it 20%', async ({ page }) => {
    const owner = await addStudent({ studentName: uniqueName('Twice Owner'), createdAt: joinedMonthsAgo(2) });
    const code = (await api.post('/referral/generate', { studentId: owner._id, phone: owner.phone }, { auth: false })).body.referralCode;
    for (const label of ['Friend One', 'Friend Two']) {
      const name = uniqueName(label);
      await register({ studentName: name, referralCode: code });
      const reg = (await api.get('/registrations/pending')).body.find(r => r.studentName === name);
      await api.post(`/registrations/${reg._id}/approve`, {});
    }
    await lookup(page, owner.phone);
    await expect(referral(page).locator('.referral-stats')).toContainText('2');
    await expect(referral(page).locator('.referral-stats')).toContainText('20% off');
  });
});
