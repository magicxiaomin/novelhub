import { expect, test } from '@playwright/test';

test('visitor can sign up and keep the session after reload', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'password123';

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('dialog', { name: 'Sign in to NovelHub' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page.getByRole('dialog', { name: 'Create your account' })).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeHidden();

  await page.reload();
  await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeHidden();
});
