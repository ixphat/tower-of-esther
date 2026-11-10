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
  while (!(await fightOnce())) {
    await go('Village Square');
    await go('Fields, monsters here');
  }

  await expect(page.getByRole('heading', { name: "Keeper's House" })).toBeFocused();
  expect(await hp()).toBe(full);

  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: "Keeper's House" })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/memor/i);
});

test('items, drops, respawn, stall and comparing gear', async ({ page }) => {
  const status = page.getByRole('status', { name: 'Climber' });
  const coins = async () => Number(/Coins (\d+)/.exec(await status.innerText())![1]);
  const go = (name: string) => page.getByRole('navigation', { name: 'Go to' }).getByRole('button', { name }).click();
  const fight = page.getByRole('button', { name: 'Fight Straw Remnant' });
  const attack = page.getByRole('button', { name: 'Weapon attack' });
  const back = page.getByRole('button', { name: 'Return' });

  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await go('Fields, monsters here');
  await fight.click();

  const salve = page.getByRole('button', { name: /Basic Salve/ });
  await salve.click();
  await salve.click();
  await expect(salve).toBeDisabled();
  await expect(page.getByText('Healing items used up')).toBeVisible();
  while (!(await back.isVisible())) await attack.click();
  await expect(page.getByRole('log', { name: 'Combat log' })).toContainText('Straw Thread ×1');
  await back.click();
  await expect(fight).toHaveCount(0); // beaten until re-entry

  await go('Village Square');
  await go("Keeper's House");
  const before = await coins();
  await page.getByRole('button', { name: 'Stall' }).click();
  await page.getByRole('button', { name: 'Buy Plain Coat' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  expect(await coins()).toBe(before - 50);

  await page.getByRole('button', { name: 'Bag' }).click();
  const bag = page.getByRole('dialog', { name: 'Bag' });
  await expect(bag).toContainText('+2 Guard, +2 Ward');
  await bag.getByRole('button', { name: 'Equip Plain Coat' }).click();
  await expect(bag).toContainText('body: Plain Coat');
  await bag.getByRole('button', { name: 'Items', exact: true }).click();
  await expect(bag).toContainText('Basic Salve ×1');
  await bag.getByRole('button', { name: 'Materials' }).click();
  await expect(bag).toContainText('Straw Thread ×');
});

test('pinned skills, cooldown reason, tag slots and the Skills window', async ({ page }) => {
  const go = (name: string) => page.getByRole('navigation', { name: 'Go to' }).getByRole('button', { name }).click();
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();

  await page.getByRole('button', { name: 'Skills' }).click();
  const window = page.getByRole('dialog', { name: 'Skills' });
  await expect(window).toContainText('Novice Lv 1');
  await window.getByRole('searchbox').fill('lean');
  await expect(window.getByRole('button', { name: 'Unpin Straw Toss' })).toHaveCount(0);
  await window.getByRole('searchbox').fill('');
  await window.getByRole('button', { name: 'Unpin Whistle' }).click();
  await expect(window.getByRole('button', { name: 'Pin Whistle' })).toBeVisible();
  await window.getByRole('button', { name: 'Close' }).click();

  await go('Fields, monsters here');
  await page.getByRole('button', { name: 'Fight Straw Remnant' }).click();
  await expect(page.getByRole('list', { name: 'Tag slots' }).getByRole('listitem')).toHaveCount(4);

  const pins = page.getByRole('group', { name: 'Pinned skills' });
  await expect(pins.getByRole('button', { name: 'Whistle' })).toHaveCount(0);
  await expect(pins.getByRole('button', { name: 'Sweep Up (No status to remove)' })).toBeDisabled();
  await pins.getByRole('button', { name: 'Straw Toss' }).click();
  await expect(pins.getByRole('button', { name: 'Straw Toss (Cooldown 1)' })).toBeDisabled();
  await expect(page.getByRole('log', { name: 'Combat log' })).toContainText('uses Straw Toss');

  await pins.getByRole('button', { name: 'Stubborn Lean' }).click();
  await expect(page.getByRole('list', { name: 'Tag slots' })).toContainText('Stance: Stubborn Lean');

  const back = page.getByRole('button', { name: 'Return' });
  while (!(await back.isVisible())) await page.getByRole('button', { name: 'Weapon attack' }).click();
  await back.click();

  await page.getByRole('button', { name: 'Skills' }).click();
  await expect(window.locator('li', { hasText: 'Straw Toss' })).toContainText('Novice Lv 1');
});

test('groups, targets, fleeing and the mini-boss', async ({ page }) => {
  const go = (name: string) => page.getByRole('navigation', { name: 'Go to' }).getByRole('button', { name }).click();
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();

  await go('Riverbank, monsters here');
  await page.getByRole('button', { name: 'Fight Crow ×3' }).click();
  await expect(page.getByRole('button', { name: /^Target Crow/ })).toHaveCount(3);
  await page.getByRole('button', { name: 'Target Crow 3' }).click();
  await expect(page.getByRole('button', { name: 'Target Crow 3' })).toHaveAttribute('aria-pressed', 'true');

  const back = page.getByRole('button', { name: 'Return' });
  while (!(await back.isVisible())) await page.getByRole('button', { name: 'Flee' }).click();
  await expect(page.getByRole('log', { name: 'Combat log' })).toContainText(/Fled\.|Defeated\./);
  await back.click();

  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await go('Village Gate, monsters here');
  await page.getByRole('button', { name: 'Fight Gate Scarecrow' }).click();
  await expect(page.getByRole('button', { name: 'Flee (Cannot flee this fight)' })).toBeDisabled();
});

test('talking, liked choices, bonds, gifts, text speed and skip', async ({ page }) => {
  const go = (name: string) => page.getByRole('navigation', { name: 'Go to' }).getByRole('button', { name }).click();
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Instant' }).check();
  await page.getByRole('button', { name: 'Close' }).click();

  await go("Keeper's House");
  const talk = page.getByRole('navigation', { name: 'Talk to' });
  await expect(talk.getByRole('img', { name: 'Bond Stranger' })).toBeVisible();
  await talk.getByRole('button', { name: /The Keeper/ }).click();

  const box = page.getByRole('region', { name: 'Talking with The Keeper' });
  await expect(box).toContainText('Oh. A guest.');
  await expect(box.getByRole('button', { name: 'Skip' })).toBeDisabled();
  await box.getByRole('button', { name: 'Next' }).click();
  await box.getByRole('button', { name: 'Next' }).click();
  await expect(box.getByRole('button', { name: "It's a good house." })).toBeVisible();
  await expect(box).not.toContainText(/liked/i);
  await box.getByRole('button', { name: "It's a good house." }).click();
  await expect(box.getByRole('status')).toContainText('The Keeper: bond +5');
  await box.getByRole('button', { name: 'Next' }).click();
  await expect(box.getByRole('status')).toContainText('bond +10, now Acquaintance');

  await box.getByRole('button', { name: 'Give gift' }).click();
  await box.getByRole('button', { name: /Give Basic Salve/ }).click();
  await expect(box.getByRole('button', { name: 'Give gift (gift limit reached)' })).toBeDisabled();
  await box.getByRole('button', { name: 'Leave' }).click();

  await talk.getByRole('button', { name: /The Keeper/ }).click();
  await expect(box).toContainText('That chair? Leave it, please.');
  await box.getByRole('button', { name: 'Next' }).click();
  await expect(box.getByRole('button', { name: 'Skip' })).toHaveCount(0); // a choice line has no skip
  await expect(box.getByRole('button', { name: 'Ready for whom?' })).toBeFocused();
  await box.getByRole('button', { name: 'Leave now' }).click();

  await page.getByRole('button', { name: 'Status' }).click();
  await page.getByRole('dialog', { name: 'Status' }).getByRole('button', { name: 'Bonds' }).click();
  await expect(page.getByRole('dialog', { name: 'Status' }).getByRole('img', { name: 'Bond Acquaintance' })).toBeVisible();
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
