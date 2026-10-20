const { test, expect } = require('@playwright/test');

test.describe('landing page', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('loads with the studio sections and no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.reload();
    for (const id of ['#classes', '#schedule', '#referral', '#facilities', '#services', '#contact']) {
      await expect(page.locator(id)).toBeAttached();
    }
    expect(errors).toEqual([]);
  });

  test('the top of the page has a "Get Referral Code" button that takes students to the generator', async ({ page }) => {
    const button = page.locator('.hero').getByRole('link', { name: /Get Referral Code/ });
    await expect(button).toBeVisible();
    await expect(page.locator('.hero-referral-note')).toContainText('10% off');
    await button.click();
    await expect(page).toHaveURL(/#referral$/);
    await expect(page.locator('#referral').getByPlaceholder('Your registered phone number')).toBeInViewport();
  });

  test('the top menu links to Refer & Save', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Refer & Save' }).first()).toHaveAttribute('href', '#referral');
  });

  test('the Schedule section lists Karate, Zumba, Silambam and Art & Craft with timings and fees', async ({ page }) => {
    const schedule = page.locator('#schedule');
    await schedule.scrollIntoViewIfNeeded();
    for (const text of ['Karate Class', 'Zumba Class', 'Silambam Class', 'Drawing & Art and Craft', '5:00 PM – 7:00 PM', '6:00 AM – 7:00 AM', '10:30 AM – 11:30 AM', '7:00 PM – 8:00 PM', '₹1300 / month', '₹800 / month', '₹1000 / month', '₹1800 – ₹2000 / month']) {
      await expect(schedule.getByText(text).first(), text).toBeVisible();
    }
    await expect(schedule.getByText('5 Classes: ₹2000 · 3 Classes: ₹1800')).toBeVisible();
  });

  test('the Weekly Overview includes the new classes', async ({ page }) => {
    const weekly = page.locator('.weekly-strip');
    for (const text of ['Karate 5–7 PM', 'Zumba 6–7 AM', 'Zumba 10:30–11:30 AM', 'Silambam 7–8 PM', 'Art 6–7 PM']) {
      await expect(weekly.getByText(text).first(), text).toBeVisible();
    }
  });

  test('the Classes section has a detail card for each new class', async ({ page }) => {
    const cards = page.locator('.new-class-card');
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(0)).toContainText('Monday · Wednesday · Friday');
    await expect(cards.nth(1)).toContainText('5 classes ₹2000 · 3 classes ₹1800');
    await expect(cards.nth(2)).toContainText('Tuesday · Wednesday');
    await expect(cards.nth(3)).toContainText('Drawing · Painting · Handwriting · Art & Craft');
  });

  for (const [card, cls] of [['Karate', 'Karate Class'], ['Silambam', 'Silambam Class'], ['Art', 'Art & Craft Class'], ['Zumba', 'Zumba Class']]) {
    test(`"Join This Class" on the ${card} card opens the form with ${cls} already chosen`, async ({ page }) => {
      await page.locator('.new-class-card').filter({ has: page.getByRole('heading', { name: cls, exact: true }) }).getByRole('button', { name: 'Join This Class' }).click();
      await expect(page.getByRole('heading', { name: 'Student Registration' })).toBeVisible();
      await expect(page.locator('.custom-select__trigger').filter({ hasText: cls })).toBeVisible();
    });
  }

  test('"Join Now" opens an empty registration form that closes again', async ({ page }) => {
    await page.getByRole('button', { name: 'Join Now' }).first().click();
    await expect(page.getByRole('heading', { name: 'Student Registration' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Class' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('heading', { name: 'Student Registration' })).toBeHidden();
  });

  test('the admin button goes to the login page', async ({ page }) => {
    await page.getByRole('link', { name: 'Admin' }).or(page.getByRole('button', { name: 'Admin' })).first().click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });
});
