import { expect, test } from '@playwright/test';

test('climber moves by keyboard, autosaves and continues after reload', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);

  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByRole('heading', { name: 'Village Square' })).toBeVisible();

  const goTo = page.getByRole('navigation', { name: 'Go to' });
  await goTo.getByRole('button', { name: 'Riverbank' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Riverbank' })).toBeFocused();
  await expect(goTo.getByRole('button', { name: 'Schoolhouse' })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Riverbank' })).toBeVisible();

  // starting a new game does not touch the save until the climber moves
  await page.reload();
  await page.getByRole('button', { name: 'New game' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Riverbank' })).toBeVisible();
});

test('a window opens over the scene and closes back to it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();

  await page.getByRole('button', { name: 'Status' }).click();
  await expect(page.getByRole('dialog', { name: 'Status' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Village Square' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Status' })).toBeFocused();
});
