const { test, expect } = require('@playwright/test');
const { api, uniqueName, uniquePhone } = require('../support/helpers');

// How the registration form tells people what is wrong — before sending, and when the server says no.

const openForm = async (page) => {
  await page.goto('/');
  await page.locator('button.btn-outline', { hasText: 'Join Now' }).click();
  await expect(page.getByRole('heading', { name: 'Student Registration' })).toBeVisible();
};
const submit = (page) => page.getByRole('button', { name: /submit registration/i });
const field = (page, name) => page.locator(`input[name="${name}"]`);
const fieldError = (page, f) => page.locator(`[data-field="${f}"] .field-error`);
const pickClasses = async (page, classes) => {
  await page.locator('.custom-select__trigger').filter({ hasText: /Select Class|Class/ }).first().click();
  for (const c of classes) await page.locator('.custom-select__option').filter({ has: page.getByText(c, { exact: true }) }).first().click();
  await page.locator('.custom-select__done button').click();
};
const fillValid = async (page) => {
  await field(page, 'studentName').fill(uniqueName('Error test'));
  await field(page, 'phone').fill(uniquePhone());
  await pickClasses(page, ['Karate Class']);
};

test.describe('before sending: what is missing is shown on the field and in a summary', () => {
  test('an empty form lists every missing item, with a message under each field', async ({ page }) => {
    await openForm(page);
    await submit(page).click();
    const summary = page.locator('.error-summary');
    await expect(summary).toContainText('3 things need your attention');
    await expect(summary).toContainText('Full name');
    await expect(summary).toContainText('Phone number');
    await expect(summary).toContainText('Class');
    await expect(fieldError(page, 'studentName')).toContainText('full name');
    await expect(fieldError(page, 'phone')).toContainText('phone number');
    await expect(fieldError(page, 'classTypes')).toContainText('at least one class');
    await expect(field(page, 'studentName')).toHaveAttribute('aria-invalid', 'true');
  });

  test('nothing is sent while something is wrong', async ({ page }) => {
    let sent = 0;
    await page.route('**/api/register', (route) => { sent++; route.continue(); });
    await openForm(page);
    await submit(page).click();
    await page.waitForTimeout(500);
    expect(sent).toBe(0);
  });

  test('the cursor jumps to the first thing to fix', async ({ page }) => {
    await openForm(page);
    await submit(page).click();
    await expect(field(page, 'studentName')).toBeFocused();
  });

  test('clicking a line in the summary takes you to that field', async ({ page }) => {
    await openForm(page);
    await field(page, 'studentName').fill(uniqueName('Jump'));
    await submit(page).click();
    await expect(field(page, 'phone')).toBeFocused();
    await page.locator('.error-summary button', { hasText: 'Class' }).click();
    await expect(page.locator('[data-field="classTypes"] .custom-select__trigger')).toBeFocused();
  });

  test('the bottom of the form also says how many things are left, and tapping it jumps to the first', async ({ page }) => {
    await openForm(page);
    await submit(page).click();
    const hint = page.locator('.form-hint--button');
    await expect(hint).toContainText('3 things to fix');
    await field(page, 'studentName').fill(uniqueName('Hint'));
    await expect(hint).toContainText('2 things to fix');
    await hint.click();
    await expect(field(page, 'phone')).toBeFocused();
  });

  test('messages disappear as soon as each problem is fixed, and the summary goes when all are fixed', async ({ page }) => {
    await openForm(page);
    await submit(page).click();
    await field(page, 'studentName').fill(uniqueName('Fixing'));
    await expect(fieldError(page, 'studentName')).toHaveCount(0);
    await field(page, 'phone').fill(uniquePhone());
    await expect(fieldError(page, 'phone')).toHaveCount(0);
    await expect(page.locator('.error-summary')).toContainText('One thing needs your attention');
    await pickClasses(page, ['Karate Class']);
    await expect(page.locator('.error-summary')).toHaveCount(0);
    await expect(page.locator('.form-hint--button')).toHaveCount(0);
  });

  test('a field is checked when you leave it, without waiting for the submit button', async ({ page }) => {
    await openForm(page);
    await field(page, 'studentName').fill('A');
    await field(page, 'phone').click();
    await expect(fieldError(page, 'studentName')).toContainText('at least 2 letters');
    await expect(fieldError(page, 'phone')).toHaveCount(0);               // not touched yet: no scolding
  });
});

test.describe('each field says what a good answer looks like', () => {
  test('name: only numbers', async ({ page }) => {
    await openForm(page);
    await field(page, 'studentName').fill('12345');
    await field(page, 'studentName').blur();
    await expect(fieldError(page, 'studentName')).toContainText('letters');
  });

  test('name: Tamil letters are fine', async ({ page }) => {
    await openForm(page);
    await field(page, 'studentName').fill('அருண் குமார்');
    await field(page, 'studentName').blur();
    await expect(fieldError(page, 'studentName')).toHaveCount(0);
  });

  test('phone: too short says how many digits you typed and gives an example', async ({ page }) => {
    await openForm(page);
    await field(page, 'phone').fill('98765');
    await field(page, 'phone').blur();
    await expect(fieldError(page, 'phone')).toContainText('you typed 5');
    await expect(fieldError(page, 'phone')).toContainText('98765 43210');
    await field(page, 'phone').fill('9876543210');
    await expect(fieldError(page, 'phone')).toHaveCount(0);
  });

  test('phone: +91 and spaced numbers are fine', async ({ page }) => {
    await openForm(page);
    await field(page, 'phone').fill('+91 98765 43210');
    await field(page, 'phone').blur();
    await expect(fieldError(page, 'phone')).toHaveCount(0);
  });

  test('WhatsApp number: optional, but checked when typed', async ({ page }) => {
    await openForm(page);
    await field(page, 'whatsappNumber').fill('123');
    await field(page, 'whatsappNumber').blur();
    await expect(fieldError(page, 'whatsappNumber')).toContainText('at least 10 digits');
    await field(page, 'whatsappNumber').fill('');
    await expect(fieldError(page, 'whatsappNumber')).toHaveCount(0);
  });

  for (const age of ['0', '100', '-4']) {
    test(`age "${age}" is explained`, async ({ page }) => {
      await openForm(page);
      await field(page, 'studentAge').fill(age);
      await field(page, 'studentAge').blur();
      await expect(fieldError(page, 'studentAge')).toContainText('between 1 and 99');
    });
  }

  test('class: regular classes need Weekday or Weekend', async ({ page }) => {
    await openForm(page);
    await field(page, 'studentName').fill(uniqueName('Sched'));
    await field(page, 'phone').fill(uniquePhone());
    await pickClasses(page, ['Regular Class']);
    await submit(page).click();
    await expect(fieldError(page, 'classSchedule')).toContainText('Weekday or Weekend');
    await page.locator('[data-field="classSchedule"] .custom-select__trigger').click();
    await page.locator('.custom-select__option', { hasText: 'Weekday' }).click();
    await expect(fieldError(page, 'classSchedule')).toHaveCount(0);
  });

  test('the red outline appears on the field that needs fixing', async ({ page }) => {
    await openForm(page);
    await submit(page).click();
    await expect(page.locator('[data-field="studentName"]')).toHaveClass(/has-error/);
    await field(page, 'studentName').fill(uniqueName('Outline'));
    await expect(page.locator('[data-field="studentName"]')).not.toHaveClass(/has-error/);
  });
});

test.describe('when the server says no, the message is plain and tells you what to do', () => {
  test('no internet', async ({ page }) => {
    await openForm(page);
    await fillValid(page);
    await page.route('**/api/register', (route) => route.abort('failed'));
    await submit(page).click();
    await expect(page.locator('.message-banner.error')).toContainText('check your internet connection');
    await expect(page.locator('.message-banner.error')).not.toContainText(/Network Error|axios|undefined/);
    await expect(field(page, 'studentName')).not.toHaveValue('');          // what you typed is kept
  });

  test('a server fault', async ({ page }) => {
    await openForm(page);
    await fillValid(page);
    await page.route('**/api/register', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false }) }));
    await submit(page).click();
    await expect(page.locator('.message-banner.error')).toContainText('Something went wrong on our side');
    await expect(page.locator('.message-banner.error')).toContainText('call the studio');
  });

  test('too many attempts', async ({ page }) => {
    await openForm(page);
    await fillValid(page);
    await page.route('**/api/register', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ message: 'Too many registration attempts.' }) }));
    await submit(page).click();
    await expect(page.locator('.message-banner.error')).toContainText('wait a few minutes');
  });

  test('the server points at a field: it is highlighted, we jump to it, and typing clears the complaint', async ({ page }) => {
    await openForm(page);
    await fillValid(page);
    await page.route('**/api/register', (route) => route.fulfill({
      status: 400, contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'x', field: 'phone', fieldErrors: { phone: 'Please enter a valid phone number with at least 10 digits, for example 98765 43210.' } })
    }));
    await submit(page).click();
    await expect(page.locator('.message-banner.error')).toContainText('highlighted field');
    await expect(fieldError(page, 'phone')).toContainText('valid phone number');
    await expect(field(page, 'phone')).toBeFocused();
    await field(page, 'phone').press('End');
    await field(page, 'phone').pressSequentially('1');
    await expect(fieldError(page, 'phone')).toHaveCount(0);
  });

  test('several server complaints are all shown', async ({ page }) => {
    await openForm(page);
    await fillValid(page);
    await page.route('**/api/register', (route) => route.fulfill({
      status: 400, contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'x', fieldErrors: { phone: 'Phone problem', studentName: 'Name problem' } })
    }));
    await submit(page).click();
    await expect(page.locator('.message-banner.error')).toContainText('highlighted fields');
    await expect(fieldError(page, 'phone')).toContainText('Phone problem');
    await expect(fieldError(page, 'studentName')).toContainText('Name problem');
  });

  test('a real "already registered" answer from the server is friendly', async ({ page }) => {
    const name = uniqueName('Dup real'); const phone = uniquePhone();
    await api.post('/register', { studentName: name, phone, classType: 'Karate Class', classSchedule: 'NA' }, { auth: false });
    await openForm(page);
    await field(page, 'studentName').fill(name);
    await field(page, 'phone').fill(phone);
    await pickClasses(page, ['Karate Class']);
    await submit(page).click();
    await expect(page.locator('.message-banner.warning')).toContainText('We have your request and will contact you soon');
  });

  test('after a failure you can fix things and send again', async ({ page }) => {
    await openForm(page);
    await fillValid(page);
    let first = true;
    await page.route('**/api/register', (route) => { if (first) { first = false; route.abort('failed'); } else route.continue(); });
    await submit(page).click();
    await expect(page.locator('.message-banner.error')).toBeVisible();
    await submit(page).click();
    await expect(page.locator('.message-banner.success')).toBeVisible();
  });

  test('the submit button shows it is working and cannot be double-clicked', async ({ page }) => {
    await openForm(page);
    await fillValid(page);
    let calls = 0;
    await page.route('**/api/register', async (route) => { calls++; await new Promise(r => setTimeout(r, 700)); route.continue(); });
    await submit(page).click();
    await expect(page.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
    await expect(page.locator('.message-banner.success')).toBeVisible();
    expect(calls).toBe(1);
  });
});
