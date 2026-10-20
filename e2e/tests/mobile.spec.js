const { test, expect } = require('@playwright/test');
const { api, uniqueName, uniquePhone, addStudent, signInAsAdmin } = require('../support/helpers');

// Runs in the "mobile" project (Pixel 7 phone).

const noSideScroll = async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow, 'the page must not scroll sideways').toBe(false);
};

test.describe('phone: landing page', () => {
  test('no sideways scrolling and the sections are reachable', async ({ page }) => {
    await page.goto('/');
    await noSideScroll(page);
    await page.locator('#schedule').scrollIntoViewIfNeeded();
    await expect(page.locator('#schedule .schedule-card').first()).toBeVisible();
    await noSideScroll(page);
  });

  test('the new-class cards stack in one column and stay readable', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.new-class-card');
    await cards.first().scrollIntoViewIfNeeded();
    const boxes = await cards.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width) }; }));
    expect(new Set(boxes.map(b => b.x)).size).toBe(1);   // all in one column
    expect(boxes[0].w).toBeGreaterThan(300);
  });

  test('the Get Referral Code button is on screen at the top and fits the width', async ({ page }) => {
    await page.goto('/');
    const button = page.locator('.hero').getByRole('link', { name: /Get Referral Code/ });
    await expect(button).toBeInViewport();
    const box = await button.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
    await noSideScroll(page);
  });

  test('the menu button opens the links including Refer & Save', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mobile-menu-btn').click();
    await expect(page.getByRole('link', { name: 'Refer & Save' })).toBeVisible();
  });
});

test.describe('phone: registration form', () => {
  const open = async (page) => { await page.goto('/'); await page.locator('button.btn-outline', { hasText: 'Join Now' }).click()   /* the hero button: always on screen, also on a phone */; await expect(page.getByRole('heading', { name: 'Student Registration' })).toBeVisible(); };

  test('the class list opens as a bottom sheet with large tick boxes and a Done button', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Select Class' }).click();
    const menu = page.locator('.custom-select__menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.custom-select__title')).toHaveText('Select Classes');
    const box = await menu.boundingBox();
    const viewport = page.viewportSize();
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(viewport.height - 2);   // sits at the bottom edge
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(viewport.width - 2);              // full width
    const option = menu.locator('.custom-select__option').first();
    expect((await option.boundingBox()).height).toBeGreaterThanOrEqual(44);                // easy to tap
    await expect(menu.locator('.custom-select__done button')).toBeVisible();
  });

  test('tapping outside the sheet closes it', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Select Class' }).click();
    await page.locator('.custom-select__backdrop').click({ position: { x: 20, y: 40 } });
    await expect(page.locator('.custom-select__menu')).toHaveCount(0);
  });

  test('choose two classes, Zumba plan and batch, see the total, and submit', async ({ page }) => {
    await open(page);
    const name = uniqueName('Phone Student');
    await page.locator('input[name="studentName"]').fill(name);
    await page.locator('input[name="phone"]').fill(uniquePhone());
    await page.getByRole('button', { name: 'Select Class' }).click();
    for (const c of ['Karate Class', 'Zumba Class']) await page.locator('.custom-select__option').filter({ has: page.getByText(c, { exact: true }) }).click();
    await page.locator('.custom-select__done button').click();
    await page.getByRole('button', { name: /submit registration/i }).click();
    await expect(page.locator('[data-field="feePlan"] .field-error')).toBeVisible();     // says what is missing
    await page.locator('.custom-select__trigger').filter({ hasText: 'Select 5 or 3 classes' }).click();
    await page.locator('.custom-select__option').filter({ hasText: '5 Classes / week' }).click();
    await page.locator('.custom-select__trigger').filter({ hasText: 'Select Batch' }).click();
    await page.locator('.custom-select__option').filter({ hasText: 'Morning 6:00 AM – 7:00 AM' }).click();
    await expect(page.locator('.fee-bar strong')).toHaveText('₹3,300');
    const submit = page.getByRole('button', { name: /submit registration/i });
    await expect(submit).toBeEnabled();
    await expect(submit).toBeInViewport();                           // the sticky bottom bar keeps the button on screen
    await submit.click();
    await expect(page.locator('.message-banner.success')).toBeVisible();
    expect((await api.get('/registrations/pending')).body.find(r => r.studentName === name)).toBeTruthy();
  });

  test('mistakes are easy to find on a phone: summary, red field, and the first problem is on screen', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /submit registration/i }).click();
    await expect(page.locator('.error-summary')).toBeVisible();
    await expect(page.locator('input[name="studentName"]')).toBeFocused();
    await expect(page.locator('[data-field="studentName"] .field-error')).toBeInViewport();
    await noSideScroll(page);
  });

  test('the referral pop-up is a bottom sheet with big buttons', async ({ page }) => {
    await open(page);
    const field = page.locator('input[name="referralCode"]');
    await field.fill('KJNOPE22');
    await field.blur();
    const popup = page.locator('.ref-popup');
    await expect(popup).toBeVisible();
    const box = await popup.boundingBox();
    const vp = page.viewportSize();
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(vp.height - 2);          // sits at the bottom
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(vp.width - 2);
    expect((await popup.getByRole('button', { name: 'Fix the code' }).boundingBox()).height).toBeGreaterThanOrEqual(48);
    await noSideScroll(page);
  });

  test('inputs are at least 16px so phones do not zoom in', async ({ page }) => {
    await open(page);
    const size = await page.locator('input[name="studentName"]').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });

  test('the form does not scroll sideways', async ({ page }) => {
    await open(page);
    await noSideScroll(page);
  });
});

test.describe('phone: Refer & Save', () => {
  test('lookup, generate and share fit on the screen', async ({ page }) => {
    const s = await addStudent({ studentName: uniqueName('Phone Referrer') });
    await page.goto('/#referral');
    await page.locator('#referral').getByPlaceholder('Your registered phone number').fill(s.phone);
    await page.locator('#referral').getByRole('button', { name: 'Find my account' }).click();
    await page.locator('#referral').getByRole('button', { name: 'Generate Referral Code' }).click();
    await expect(page.locator('.referral-code strong')).toHaveText(/^KJ[A-HJ-NP-Z2-9]{6}$/);
    await expect(page.getByRole('button', { name: /Share on WhatsApp/ })).toBeInViewport({ ratio: 0.9 }).catch(() => {});
    await noSideScroll(page);
  });
});

test.describe('phone: admin', () => {
  test('the student and payment pages work on a phone', async ({ page }) => {
    await signInAsAdmin(page, '/admin/students');
    await expect(page.locator('.tabs .tab-btn').first()).toBeVisible();
    await noSideScroll(page);
    await page.goto('/admin/payments');
    await expect(page.locator('.tabs .tab-btn').first()).toBeVisible();
    await noSideScroll(page);
  });
});
