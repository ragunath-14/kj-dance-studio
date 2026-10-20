const { test, expect } = require('@playwright/test');
const { env, signInAsAdmin } = require('../support/helpers');

test.describe('admin login', () => {
  test('a wrong password shows an error and stays on the login page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByPlaceholder('Enter admin ID').fill(env.ADMIN.id);
    await page.getByPlaceholder('Enter password').fill('wrong-password');
    await page.getByRole('button', { name: /login to dashboard/i }).click();
    await expect(page.getByText(/invalid admin id or password/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });

  test('an unknown admin id is refused', async ({ page }) => {
    await page.goto('/admin');
    await page.getByPlaceholder('Enter admin ID').fill('nobody');
    await page.getByPlaceholder('Enter password').fill(env.ADMIN.password);
    await page.getByRole('button', { name: /login to dashboard/i }).click();
    await expect(page.getByText(/invalid admin id or password/i)).toBeVisible();
  });

  test('the right id and password open the dashboard, and logging out returns to the login page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByPlaceholder('Enter admin ID').fill(env.ADMIN.id);
    await page.getByPlaceholder('Enter password').fill(env.ADMIN.password);
    await page.getByRole('button', { name: /login to dashboard/i }).click();
    await expect(page.getByText('Class Distribution')).toBeVisible();
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });

  test('admin pages ask for a login when you are not signed in', async ({ page }) => {
    for (const path of ['/admin/students', '/admin/payments', '/admin/registrations']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Admin Login' }), path).toBeVisible();
    }
  });

  test('the dashboard shows the class distribution for every class', async ({ page }) => {
    await signInAsAdmin(page, '/admin');
    const dist = page.locator('.class-breakdown');
    for (const label of ['Regular', 'Fitness', 'Online', 'Karate', 'Zumba', 'Silambam', 'Art & Craft']) {
      await expect(dist.getByText(label, { exact: true }), label).toBeVisible();
    }
  });

  test('the sidebar reaches every admin page', async ({ page }) => {
    await signInAsAdmin(page, '/admin');
    for (const [path, marker] of [['/admin/students', 'Add Student'], ['/admin/payments', 'Record Payment'], ['/admin/registrations', null]]) {
      await page.goto(path);
      if (marker) await expect(page.getByRole('button', { name: marker }).first()).toBeVisible();
      await expect(page).toHaveURL(new RegExp(path));
    }
  });
});
