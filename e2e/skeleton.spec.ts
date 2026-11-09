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

test('climber fights a marked location and returns to the scene', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Fields, monsters here' }).click();
  await page.getByRole('button', { name: 'Fight Straw Remnant' }).click();

  await expect(page.getByRole('list', { name: 'Turn order' })).toContainText('Straw Remnant');
  const attack = page.getByRole('button', { name: 'Weapon attack' });
  const back = page.getByRole('button', { name: 'Return' });
  while (!(await back.isVisible())) await attack.click();

  await expect(page.getByRole('log', { name: 'Combat log' })).toContainText(/Victory|Defeated/);
  await back.click();
  await expect(page.getByRole('heading', { name: 'Fields' })).toBeFocused();
  await expect(page.getByRole('status', { name: 'Climber' })).toContainText('EXP 1 / 100');
});

test('HP carries, Rest restores it, and defeat returns to the resting place', async ({ page }) => {
  const hp = async () => Number(/HP (\d+) \//.exec(await page.getByRole('status', { name: 'Climber' }).innerText())![1]);
  const go = (name: string) => page.getByRole('navigation', { name: 'Go to' }).getByRole('button', { name }).click();
  const fightOnce = async () => {
    await page.getByRole('button', { name: 'Fight Straw Remnant' }).click();
    const attack = page.getByRole('button', { name: 'Weapon attack' });
    const back = page.getByRole('button', { name: 'Return' });
    while (!(await back.isVisible())) await attack.click();
    const defeated = (await page.getByRole('log', { name: 'Combat log' }).innerText()).includes('Defeated');
    await back.click();
    return defeated;
  };

  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  const full = await hp();
  await expect(page.getByRole('button', { name: 'Rest' })).toHaveCount(0);

  await go("Keeper's House");
  await go('Village Square');
  await go('Fields, monsters here');
  await fightOnce();
  const hurt = await hp();
  expect(hurt).toBeLessThan(full);

  await go('Village Square');
  expect(await hp()).toBe(hurt);
  await go("Keeper's House");
  await page.getByRole('button', { name: 'Rest' }).click();
  expect(await hp()).toBe(full);

  await go('Village Square');
  await go('Fields, monsters here');
  while (!(await fightOnce()));

  await expect(page.getByRole('heading', { name: "Keeper's House" })).toBeFocused();
  expect(await hp()).toBe(full);

  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: "Keeper's House" })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/memor/i);
});

test('reloading mid-fight counts as a defeat', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Fields, monsters here' }).click();
  await page.getByRole('button', { name: 'Fight Straw Remnant' }).click();
  await page.getByRole('button', { name: 'Weapon attack' }).click();

  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Village Square' })).toBeFocused();
});

test('a window opens over the scene and closes back to it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();

  await page.getByRole('button', { name: 'Status' }).click();
  const status = page.getByRole('dialog', { name: 'Status' });
  await expect(status).toBeVisible();
  await expect(status).toContainText('Vitality 8');
  await expect(status).toContainText('Hero power F');
  for (const tab of ['Titles', 'Bonds', 'Floor clears', 'Overview']) {
    await status.getByRole('button', { name: tab }).click();
    await expect(status.getByRole('button', { name: tab })).toHaveAttribute('aria-pressed', 'true');
  }

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Village Square' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Status' })).toBeFocused();
});
