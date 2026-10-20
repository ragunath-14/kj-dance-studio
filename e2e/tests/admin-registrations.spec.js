const { test, expect } = require('@playwright/test');
const { api, uniqueName, uniquePhone, register, addStudent, joinedMonthsAgo, signInAsAdmin } = require('../support/helpers');

const cardFor = (page, name) => page.locator('.registration-card').filter({ hasText: name });
const offerInputs = (card) => card.locator('.reg-offer-wrap input');

test.describe('new joiner requests', () => {
  test('a request shows the name, phone, classes and the monthly fee', async ({ page }) => {
    const name = uniqueName('Card Check'); const phone = uniquePhone();
    await register({ studentName: name, phone, classType: 'Karate Class', studentAge: '30' });
    await signInAsAdmin(page, '/admin/registrations');
    const card = cardFor(page, name);
    await expect(card).toContainText(phone);
    await expect(card).toContainText('Karate Class');
    await expect(card.locator('.reg-fee')).toContainText('₹1,300');
  });

  test('a multi-class request lists every class and the combined fee', async ({ page }) => {
    const name = uniqueName('Multi Card');
    await register({ studentName: name, classType: 'Karate Class', extraClasses: [{ classType: 'Zumba Class', feePlan: '3 Class', batchTiming: 'Morning 6:00 AM – 7:00 AM' }] });
    await signInAsAdmin(page, '/admin/registrations');
    const card = cardFor(page, name);
    await expect(card).toContainText('Karate Class');
    await expect(card).toContainText('Zumba Class · 3/wk');
    await expect(card.locator('.reg-fee')).toContainText('₹3,100');
    await expect(card.locator('.reg-fee')).toContainText('2 classes');
  });

  test('the offer fields work out the final fee as you type (10% + ₹100 off ₹3,100)', async ({ page }) => {
    const name = uniqueName('Offer Calc');
    await register({ studentName: name, classType: 'Karate Class', extraClasses: [{ classType: 'Zumba Class', feePlan: '3 Class', batchTiming: 'Morning 6:00 AM – 7:00 AM' }] });
    await signInAsAdmin(page, '/admin/registrations');
    const card = cardFor(page, name);
    await expect(card.locator('.reg-offer-result')).toHaveCount(0);       // nothing until an offer is typed
    await offerInputs(card).nth(0).fill('10');
    await expect(card.locator('.reg-offer-result')).toContainText('₹310');
    await offerInputs(card).nth(1).fill('100');
    await expect(card.locator('.reg-offer-result')).toContainText('− ₹410');
    await expect(card.locator('.reg-offer-result')).toContainText('₹2,690');
  });

  test('the percentage is capped at 100 and the amount at the fee', async ({ page }) => {
    const name = uniqueName('Offer Cap');
    await register({ studentName: name, classType: 'Silambam Class' });   // ₹800
    await signInAsAdmin(page, '/admin/registrations');
    const card = cardFor(page, name);
    await offerInputs(card).nth(0).fill('250');
    await expect(offerInputs(card).nth(0)).toHaveValue('100');
    await expect(card.locator('.reg-offer-result')).toContainText('₹0');
    await offerInputs(card).nth(0).fill('');
    await offerInputs(card).nth(1).fill('5000');
    await expect(card.locator('.reg-offer-result')).toContainText('− ₹800');
  });

  test('accepting with an offer creates the student at the discounted fee', async ({ page }) => {
    const name = uniqueName('Accept Offer');
    await register({ studentName: name, classType: 'Karate Class', studentAge: '30', extraClasses: [{ classType: 'Zumba Class', feePlan: '5 Class', batchTiming: 'Morning 6:00 AM – 7:00 AM' }] });
    await signInAsAdmin(page, '/admin/registrations');
    const card = cardFor(page, name);
    await offerInputs(card).nth(0).fill('10');
    await offerInputs(card).nth(1).fill('100');
    await expect(card.locator('.reg-offer-result')).toContainText('₹2,870');
    await card.locator('.btn-approve').click();
    await expect(cardFor(page, name)).toHaveCount(0);

    await page.goto('/admin/students');
    await page.getByPlaceholder('Search students...').fill(name);
    const row = page.locator('tbody tr').filter({ hasText: name });
    await expect(row).toContainText('+ Zumba');
    await expect(row).toContainText('Offer · ₹2,870');
  });

  test('accepting without an offer keeps the full fee and adds no offer badge', async ({ page }) => {
    const name = uniqueName('Accept Plain');
    await register({ studentName: name, classType: 'Silambam Class' });
    await signInAsAdmin(page, '/admin/registrations');
    await cardFor(page, name).locator('.btn-approve').click();
    await expect(cardFor(page, name)).toHaveCount(0);
    await page.goto('/admin/students');
    await page.getByPlaceholder('Search students...').fill(name);
    const row = page.locator('tbody tr').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row).not.toContainText('Offer');
  });

  test('rejecting asks first, and Cancel keeps the request', async ({ page }) => {
    const name = uniqueName('Reject Cancel');
    await register({ studentName: name });
    await signInAsAdmin(page, '/admin/registrations');
    await cardFor(page, name).locator('.btn-reject').click();
    await expect(page.getByRole('heading', { name: 'Reject Registration' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(cardFor(page, name)).toBeVisible();
  });

  test('confirming a reject removes the request and creates no student', async ({ page }) => {
    const name = uniqueName('Reject Yes');
    await register({ studentName: name });
    await signInAsAdmin(page, '/admin/registrations');
    await cardFor(page, name).locator('.btn-reject').click();
    await page.getByRole('button', { name: 'Yes, Reject' }).click();
    await expect(cardFor(page, name)).toHaveCount(0);
    expect((await api.get(`/students?search=${encodeURIComponent(name)}`)).body.total).toBe(0);
  });

  test('a request that used a referral code shows who referred and the reward', async ({ page }) => {
    const owner = await addStudent({ studentName: uniqueName('Banner Owner'), createdAt: joinedMonthsAgo(2) });
    const code = (await api.post('/referral/generate', { studentId: owner._id, phone: owner.phone }, { auth: false })).body.referralCode;
    const name = uniqueName('Banner Friend');
    await register({ studentName: name, referralCode: code });
    await signInAsAdmin(page, '/admin/registrations');
    const banner = cardFor(page, name).locator('.reg-referral');
    await expect(banner).toContainText(`Referred by ${owner.studentName}`);
    await expect(banner).toContainText(code);
    await expect(banner).toContainText('10% off a monthly bill');
  });

  test('if the code owner went inactive meanwhile the banner warns that no reward will be given', async ({ page }) => {
    const owner = await addStudent({ studentName: uniqueName('Banner Inactive'), createdAt: joinedMonthsAgo(2) });
    const code = (await api.post('/referral/generate', { studentId: owner._id, phone: owner.phone }, { auth: false })).body.referralCode;
    const name = uniqueName('Banner Late');
    await register({ studentName: name, referralCode: code });
    await api.patch(`/students/${owner._id}/toggle-status`);
    await signInAsAdmin(page, '/admin/registrations');
    await expect(cardFor(page, name).locator('.reg-referral--bad')).toContainText('inactive');
    await cardFor(page, name).locator('.btn-approve').click();
    await expect(page.getByText(/Accepted\. Referral: .* inactive/)).toBeVisible();
    // the student is still accepted
    expect((await api.get(`/students?search=${encodeURIComponent(name)}`)).body.total).toBe(1);
  });

  test('accepting a referred request rewards the referrer, who then shows a Referrals badge', async ({ page }) => {
    const owner = await addStudent({ studentName: uniqueName('Badge Owner'), createdAt: joinedMonthsAgo(2) });
    const code = (await api.post('/referral/generate', { studentId: owner._id, phone: owner.phone }, { auth: false })).body.referralCode;
    const name = uniqueName('Badge Friend');
    await register({ studentName: name, referralCode: code });
    await signInAsAdmin(page, '/admin/registrations');
    await cardFor(page, name).locator('.btn-approve').click();
    await expect(page.getByText(/Accepted\. Referral: .* gets 10% off/)).toBeVisible();
    await page.goto('/admin/students');
    await page.getByPlaceholder('Search students...').fill(owner.studentName);
    await expect(page.locator('tbody tr').filter({ hasText: owner.studentName })).toContainText('Referrals · 1');
  });
});
