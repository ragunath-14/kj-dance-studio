const { test, expect } = require('@playwright/test');
const { api, uniqueName, uniquePhone, addStudent, joinedMonthsAgo } = require('../support/helpers');

const openForm = async (page, url = '/') => {
  await page.goto(url);
  if (!(await page.getByRole('heading', { name: 'Student Registration' }).isVisible())) {
    await page.locator('button.btn-outline', { hasText: 'Join Now' }).click();   // the hero button: always on screen, also on a phone
  }
  await expect(page.getByRole('heading', { name: 'Student Registration' })).toBeVisible();
};
const submit = (page) => page.getByRole('button', { name: /submit registration/i });
const fillBasics = async (page, { name = uniqueName('Form student'), phone = uniquePhone(), age = '' } = {}) => {
  await page.locator('input[name="studentName"]').fill(name);
  await page.locator('input[name="phone"]').fill(phone);
  if (age) await page.locator('input[name="studentAge"]').fill(age);
  return { name, phone };
};
/** Ticks the classes in the multi-select dropdown, then closes it with Done. */
const pickClasses = async (page, classes) => {
  await page.locator('.custom-select__trigger').filter({ hasText: /Select Class|Class/ }).first().click();
  for (const c of classes) await page.locator('.custom-select__option').filter({ has: page.getByText(c, { exact: true }) }).first().click();
  await page.locator('.custom-select__done button').click();
};
const chooseOption = async (page, triggerText, optionText) => {
  await page.locator('.custom-select__trigger').filter({ hasText: triggerText }).click();
  await page.locator('.custom-select__option').filter({ hasText: optionText }).first().click();
};
const fieldError = (page, field) => page.locator(`[data-field="${field}"] .field-error`);
const referralPopup = (page) => page.locator('.ref-popup');
const codeFor = async (name) => {
  const owner = await addStudent({ studentName: uniqueName(name), createdAt: joinedMonthsAgo(2) });
  const code = (await api.post('/referral/generate', { studentId: owner._id, phone: owner.phone }, { auth: false })).body.referralCode;
  return { owner, code };
};

test.describe('registration form: basics', () => {
  test('the submit button is always clickable (it tells you what is missing instead of staying grey)', async ({ page }) => {
    await openForm(page);
    await expect(submit(page)).toBeEnabled();
    await submit(page).click();
    await expect(page.locator('.error-summary')).toBeVisible();
    await expect(submit(page)).toBeEnabled();
  });

  test('a form with a name, a phone and a class goes through', async ({ page }) => {
    await openForm(page);
    await fillBasics(page);
    await pickClasses(page, ['Karate Class']);
    await submit(page).click();
    await expect(page.locator('.message-banner.success')).toBeVisible();
    await expect(page.locator('.error-summary')).toHaveCount(0);
  });

  test('the WhatsApp "same as phone" box copies the phone number', async ({ page }) => {
    await openForm(page);
    await page.locator('input[name="phone"]').fill('9876500001');
    await page.getByText('Same as phone').click();
    await expect(page.locator('input[name="whatsappNumber"]')).toHaveValue('9876500001');
    await expect(page.locator('input[name="whatsappNumber"]')).toBeDisabled();
  });

  test('the age shows a Kids / Adults badge', async ({ page }) => {
    await openForm(page);
    await pickClasses(page, ['Karate Class']);
    await page.locator('input[name="studentAge"]').fill('8');
    await expect(page.locator('.category-auto-badge')).toHaveText('Kids');
    await page.locator('input[name="studentAge"]').fill('10');
    await expect(page.locator('.category-auto-badge')).toHaveText('Adults');
  });

  test('letters cannot be typed into a phone box', async ({ page }) => {
    await openForm(page);
    await page.locator('input[name="phone"]').pressSequentially('98a76b54-3210x');
    await expect(page.locator('input[name="phone"]')).toHaveValue('9876' + '54-3210');
  });
});

test.describe('registration form: choosing classes', () => {
  test('more than one class can be ticked and the box shows them all with a count', async ({ page }) => {
    await openForm(page);
    await pickClasses(page, ['Karate Class', 'Silambam Class']);
    const trigger = page.locator('.custom-select__trigger').filter({ hasText: 'Karate Class, Silambam Class' });
    await expect(trigger).toBeVisible();
    await expect(trigger.locator('.custom-select__count')).toHaveText('2');
  });

  test('a class can be un-ticked again', async ({ page }) => {
    await openForm(page);
    await pickClasses(page, ['Karate Class', 'Silambam Class']);
    await page.locator('.custom-select__trigger').filter({ hasText: 'Karate Class, Silambam Class' }).click();
    await page.locator('.custom-select__option').filter({ has: page.getByText('Karate Class', { exact: true }) }).first().click();
    await page.locator('.custom-select__done button').click();
    await expect(page.locator('.custom-select__trigger').filter({ hasText: /^Silambam Class$/ })).toBeVisible();
  });

  test('every option shows its fee, days and timing', async ({ page }) => {
    await openForm(page);
    await page.getByRole('button', { name: 'Select Class' }).click();
    const options = page.locator('.custom-select__option');
    await expect(options.filter({ hasText: 'Karate Class' })).toContainText('₹1300');
    await expect(options.filter({ hasText: 'Karate Class' })).toContainText('Mon · Wed · Fri · 5:00 PM – 7:00 PM');
    await expect(options.filter({ hasText: 'Zumba Class' })).toContainText('₹1800 – ₹2000');
    await expect(options.filter({ hasText: 'Silambam Class' })).toContainText('₹800');
    await expect(options.filter({ hasText: 'Art & Craft Class' })).toContainText('₹1000');
    await expect(options.filter({ hasText: 'Fitness Class' })).toContainText('Adults only');
    await expect(options.filter({ hasText: 'Online Class' })).toContainText('Virtual');
  });

  test('each special class shows a details card with its days, timing and fee', async ({ page }) => {
    await openForm(page);
    await pickClasses(page, ['Karate Class', 'Silambam Class', 'Art & Craft Class']);
    const cards = page.locator('.class-info-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText('Monday · Wednesday · Friday');
    await expect(cards.nth(0)).toContainText('5:00 PM to 7:00 PM');
    await expect(cards.nth(1)).toContainText('Tuesday · Wednesday');
    await expect(cards.nth(2)).toContainText('Drawing · Painting · Handwriting · Art & Craft');
  });

  test('the Weekday/Weekend choice appears only for regular, fitness and online classes', async ({ page }) => {
    await openForm(page);
    await pickClasses(page, ['Karate Class']);
    await expect(page.getByText('Class Schedule *')).toHaveCount(0);
    await pickClasses(page, ['Regular Class']);
    await expect(page.getByText('Class Schedule *')).toBeVisible();
  });
});

test.describe('registration form: Zumba plan is mandatory', () => {
  test('Zumba asks for a plan and a batch; sending without them says exactly what is missing', async ({ page }) => {
    await openForm(page);
    await fillBasics(page);
    await pickClasses(page, ['Zumba Class']);
    await expect(page.getByText('Zumba Plan *')).toBeVisible();
    await expect(page.getByText('Zumba Batch *')).toBeVisible();

    await submit(page).click();
    await expect(fieldError(page, 'feePlan')).toContainText('5 or 3');
    await expect(fieldError(page, 'zumbaBatch')).toContainText('batch');
    await expect(page.locator('.error-summary')).toContainText('Zumba plan');
    await expect(page.locator('.error-summary')).toContainText('Zumba batch');

    await chooseOption(page, 'Select 5 or 3 classes', '5 Classes / week');
    await expect(fieldError(page, 'feePlan')).toHaveCount(0);
    await expect(fieldError(page, 'zumbaBatch')).toBeVisible();
    await chooseOption(page, 'Select Batch', 'Morning 6:00 AM – 7:00 AM');
    await expect(page.locator('.error-summary')).toHaveCount(0);
    await submit(page).click();
    await expect(page.locator('.message-banner.success')).toBeVisible();
  });

  test('the plan options show their price', async ({ page }) => {
    await openForm(page);
    await pickClasses(page, ['Zumba Class']);
    await page.locator('.custom-select__trigger').filter({ hasText: 'Select 5 or 3 classes' }).click();
    await expect(page.locator('.custom-select__option').filter({ hasText: '5 Classes / week' })).toContainText('₹2,000');
    await expect(page.locator('.custom-select__option').filter({ hasText: '3 Classes / week' })).toContainText('₹1,800');
  });

  test('Zumba as the SECOND class also needs a plan', async ({ page }) => {
    await openForm(page);
    await fillBasics(page);
    await pickClasses(page, ['Karate Class', 'Zumba Class']);
    await submit(page).click();
    await expect(fieldError(page, 'feePlan')).toBeVisible();
    await chooseOption(page, 'Select 5 or 3 classes', '3 Classes / week');
    await chooseOption(page, 'Select Batch', 'Morning 10:30 AM – 11:30 AM');
    await submit(page).click();
    await expect(page.locator('.message-banner.success')).toBeVisible();
  });

  test('removing Zumba clears the requirement', async ({ page }) => {
    await openForm(page);
    await fillBasics(page);
    await pickClasses(page, ['Karate Class', 'Zumba Class']);
    await submit(page).click();
    await expect(fieldError(page, 'feePlan')).toBeVisible();
    await page.locator('.custom-select__trigger').filter({ hasText: 'Karate Class, Zumba Class' }).click();
    await page.locator('.custom-select__option').filter({ has: page.getByText('Zumba Class', { exact: true }) }).first().click();
    await page.locator('.custom-select__done button').click();
    await expect(fieldError(page, 'feePlan')).toHaveCount(0);
    await expect(page.locator('.error-summary')).toHaveCount(0);
  });
});

test.describe('registration form: fees at the bottom', () => {
  test('one class shows its fee in the summary and in the bottom bar', async ({ page }) => {
    await openForm(page);
    await pickClasses(page, ['Karate Class']);
    await expect(page.locator('.fee-summary__total')).toContainText('₹1,300');
    await expect(page.locator('.fee-bar strong')).toHaveText('₹1,300');
  });

  test('two classes add up and the offer note appears', async ({ page }) => {
    await openForm(page);
    await pickClasses(page, ['Karate Class', 'Zumba Class']);
    await chooseOption(page, 'Select 5 or 3 classes', '5 Classes / week');
    const summary = page.locator('.fee-summary');
    await expect(summary).toContainText('Karate Class');
    await expect(summary).toContainText('₹1,300');
    await expect(summary).toContainText('5 classes / week');
    await expect(summary).toContainText('₹2,000');
    await expect(page.locator('.fee-summary__total')).toContainText('₹3,300');
    await expect(page.locator('.fee-bar strong')).toHaveText('₹3,300');
    await expect(summary).toContainText('special offer');
    await expect(page.locator('.fee-bar span')).toContainText('2 classes');
  });

  test('the 3-class Zumba plan costs ₹1,800', async ({ page }) => {
    await openForm(page);
    await pickClasses(page, ['Zumba Class']);
    await chooseOption(page, 'Select 5 or 3 classes', '3 Classes / week');
    await expect(page.locator('.fee-bar strong')).toHaveText('₹1,800');
  });

  test('the regular class fee follows the age (Kids ₹1,000, Adults ₹1,300) and Online Kids is ₹1,600', async ({ page }) => {
    await openForm(page);
    await pickClasses(page, ['Regular Class']);
    await page.locator('input[name="studentAge"]').fill('8');
    await expect(page.locator('.fee-bar strong')).toHaveText('₹1,000');
    await page.locator('input[name="studentAge"]').fill('30');
    await expect(page.locator('.fee-bar strong')).toHaveText('₹1,300');
    await pickClasses(page, ['Online Class']);   // ticks Online as a second class (Regular stays ticked)
    await page.locator('input[name="studentAge"]').fill('8');
    await expect(page.locator('.fee-bar strong')).toHaveText('₹2,600');   // 1000 + 1600
  });

  test('the bottom bar shows a dash until a class is chosen', async ({ page }) => {
    await openForm(page);
    await expect(page.locator('.fee-bar strong')).toHaveText('—');
  });
});

test.describe('registration form: referral code', () => {
  test('only a code that works shows "Code accepted"', async ({ page }) => {
    const { code } = await codeFor('Priya Owner');
    await openForm(page);
    await page.locator('input[name="referralCode"]').fill(code);
    await expect(page.locator('.ref-status--valid')).toContainText('Code accepted — referred by Priya');
    await expect(page.locator('.ref-status--invalid')).toHaveCount(0);
  });

  test('a code with a typing mistake is not accepted and explained in a pop-up when you leave the box', async ({ page }) => {
    await openForm(page);
    const field = page.locator('input[name="referralCode"]');
    await field.fill('KJNOPE22');
    await expect(page.locator('.ref-status--invalid')).toContainText('could not find this code');
    await field.blur();
    await expect(referralPopup(page)).toBeVisible();
    await expect(referralPopup(page)).toContainText('We could not find this code');
    await expect(referralPopup(page)).toContainText('What you can do');
    await expect(referralPopup(page)).toContainText('typing mistakes');
    await expect(page.locator('.ref-status--valid')).toHaveCount(0);
  });

  test('"Fix the code" closes the pop-up and puts you back in the code box; "Continue without a code" clears it', async ({ page }) => {
    await openForm(page);
    const field = page.locator('input[name="referralCode"]');
    await field.fill('KJNOPE22');
    await field.blur();
    await referralPopup(page).getByRole('button', { name: 'Fix the code' }).click();
    await expect(referralPopup(page)).toHaveCount(0);
    await expect(field).toBeFocused();
    await field.fill('KJNOPE23');
    await page.locator('input[name="studentName"]').click();           // leave the box again
    await referralPopup(page).getByRole('button', { name: 'Continue without a code' }).click();
    await expect(referralPopup(page)).toHaveCount(0);
    await expect(field).toHaveValue('');
  });

  test('an EXPIRED code says it has expired and to ask the friend for their new code', async ({ page }) => {
    const { owner, code } = await codeFor('Expiry Owner');
    await api.post('/referral/regenerate', { studentId: owner._id, phone: owner.phone }, { auth: false });
    await openForm(page);
    const field = page.locator('input[name="referralCode"]');
    await field.fill(code);
    await expect(page.locator('.ref-status--invalid')).toContainText('This code has expired');
    await field.blur();
    await expect(referralPopup(page)).toContainText('This code has expired');
    await expect(referralPopup(page)).toContainText('NEW code');
    await expect(page.locator('.ref-status--valid')).toHaveCount(0);
  });

  test('a half-typed code is flagged as incomplete when you leave the box', async ({ page }) => {
    await openForm(page);
    const field = page.locator('input[name="referralCode"]');
    await field.fill('KJ7Q');
    await expect(page.locator('.ref-status--checking')).toContainText('8 characters');
    await field.blur();
    await expect(referralPopup(page)).toContainText('not complete');
    await expect(referralPopup(page)).toContainText('You typed 4');
  });

  test('the pop-up is not shown again for the same code once you closed it, but can be opened on request', async ({ page }) => {
    await openForm(page);
    const field = page.locator('input[name="referralCode"]');
    await field.fill('KJNOPE22');
    await field.blur();
    await referralPopup(page).getByRole('button', { name: 'Fix the code' }).click();
    await page.locator('input[name="studentName"]').click();           // leave the box with the same code
    await page.waitForTimeout(400);
    await expect(referralPopup(page)).toHaveCount(0);
    await page.locator('.ref-why').click();
    await expect(referralPopup(page)).toBeVisible();
  });

  test('sending the form with a code that cannot be used shows the pop-up and saves nothing', async ({ page }) => {
    await openForm(page);
    const { name } = await fillBasics(page);
    await pickClasses(page, ['Karate Class']);
    await page.locator('input[name="referralCode"]').fill('KJNOPE22');
    await submit(page).click();
    await expect(referralPopup(page)).toContainText('We could not find this code');
    expect((await api.get('/registrations/pending')).body.find(r => r.studentName === name)).toBeUndefined();
  });

  test('after fixing the code the registration goes through', async ({ page }) => {
    const { code } = await codeFor('Fix Owner');
    await openForm(page);
    const { name } = await fillBasics(page);
    await pickClasses(page, ['Karate Class']);
    const field = page.locator('input[name="referralCode"]');
    await field.fill('KJNOPE22');
    await submit(page).click();
    await referralPopup(page).getByRole('button', { name: 'Fix the code' }).click();
    await field.fill(code);
    await expect(page.locator('.ref-status--valid')).toBeVisible();
    await submit(page).click();
    await expect(page.locator('.message-banner.success')).toContainText('referral code');
    expect((await api.get('/registrations/pending')).body.find(r => r.studentName === name).referralCode).toBe(code);
  });

  test('your own phone number with your own code is explained', async ({ page }) => {
    const { owner, code } = await codeFor('Self Owner');
    await openForm(page);
    await fillBasics(page, { phone: owner.phone });
    await pickClasses(page, ['Karate Class']);
    await page.locator('input[name="referralCode"]').fill(code);
    await expect(page.locator('.ref-status--valid')).toBeVisible();       // the code itself is fine…
    await submit(page).click();                                           // …but not with this phone number
    await expect(referralPopup(page)).toContainText('cannot use your own code');
    await expect(referralPopup(page)).toContainText('same phone number');
  });

  test('a shared link (?ref=CODE) opens the form with the code filled in and accepted', async ({ page }) => {
    const { code } = await codeFor('Link Owner');
    await page.goto(`/?ref=${code.toLowerCase()}`);
    await expect(page.getByRole('heading', { name: 'Student Registration' })).toBeVisible();
    await expect(page.locator('input[name="referralCode"]')).toHaveValue(code);
    await expect(page.locator('.ref-status--valid')).toBeVisible();
  });

  test('the code box upper-cases what you type', async ({ page }) => {
    await openForm(page);
    const field = page.locator('input[name="referralCode"]');
    await field.fill('kj');
    await expect(field).toHaveValue('KJ');
  });
});

test.describe('registration form: submitting', () => {
  test('a single class registration is saved as pending with its fee', async ({ page }) => {
    await openForm(page);
    const { name, phone } = await fillBasics(page, { age: '25' });
    await pickClasses(page, ['Silambam Class']);
    await submit(page).click();
    await expect(page.locator('.message-banner.success')).toContainText('Registration submitted');
    const reg = (await api.get('/registrations/pending')).body.find(r => r.studentName === name);
    expect(reg).toBeTruthy();
    expect(reg.phone).toBe(phone);
    expect(reg.classType).toBe('Silambam Class');
    expect(reg.baseFee).toBe(800);
    expect(reg.status).toBe('pending');
  });

  test('a multi-class registration with Zumba saves every class, the plan and the batch', async ({ page }) => {
    await openForm(page);
    const { name } = await fillBasics(page, { age: '30' });
    await pickClasses(page, ['Karate Class', 'Zumba Class']);
    await chooseOption(page, 'Select 5 or 3 classes', '5 Classes / week');
    await chooseOption(page, 'Select Batch', 'Morning 6:00 AM – 7:00 AM');
    await submit(page).click();
    await expect(page.locator('.message-banner.success')).toBeVisible();
    const reg = (await api.get('/registrations/pending')).body.find(r => r.studentName === name);
    expect(reg.classType).toBe('Karate Class');
    expect(reg.extraClasses).toHaveLength(1);
    expect(reg.extraClasses[0]).toMatchObject({ classType: 'Zumba Class', feePlan: '5 Class', batchTiming: 'Morning 6:00 AM – 7:00 AM' });
    expect(reg.baseFee).toBe(3300);
  });

  test('a registration with a valid code is saved with the code', async ({ page }) => {
    const { owner, code } = await codeFor('Code Giver');
    await openForm(page);
    const { name } = await fillBasics(page);
    await pickClasses(page, ['Karate Class']);
    await page.locator('input[name="referralCode"]').fill(code);
    await expect(page.locator('.ref-status--valid')).toBeVisible();
    await submit(page).click();
    await expect(page.locator('.message-banner.success')).toContainText('referral code');
    const reg = (await api.get('/registrations/pending')).body.find(r => r.studentName === name);
    expect(reg.referralCode).toBe(code);
    expect(reg.referral.referrerName).toBe(owner.studentName);
  });

  test('registering twice says you are already registered and need not do it again (not a red error)', async ({ page }) => {
    const name = uniqueName('Twice'); const phone = uniquePhone();
    await api.post('/register', { studentName: name, phone, classType: 'Karate Class', classSchedule: 'NA' }, { auth: false });
    await openForm(page);
    await fillBasics(page, { name, phone });
    await pickClasses(page, ['Karate Class']);
    await submit(page).click();
    await expect(page.locator('.message-banner.warning')).toContainText('already registered');
    await expect(page.locator('.message-banner.warning')).toContainText('no need to register again');
    await expect(fieldError(page, 'phone')).toContainText('already registered');
  });

  test('the form empties itself after a successful submit', async ({ page }) => {
    await openForm(page);
    await fillBasics(page);
    await pickClasses(page, ['Karate Class']);
    await submit(page).click();
    await expect(page.locator('.message-banner.success')).toBeVisible();
    await expect(page.locator('input[name="studentName"]')).toHaveValue('');
  });
});
