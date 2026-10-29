const { test, expect } = require('@playwright/test');

test('start, move, pause, save, reload and continue', async ({ page, browser }) => {
  console.log('Browser: ' + browser.browserType().name() + ' ' + browser.version());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await expect(page.locator('#menu-version')).toContainText(await page.evaluate(() => window.NEON.RELEASE_VERSION));
  await page.locator('#btn-new-run').click();
  await page.locator('#btn-ship-launch').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  const before = await page.evaluate(() => window.NEON.Game.player.y);
  await page.keyboard.down('KeyW');
  await expect.poll(() => page.evaluate(() => window.NEON.Game.player.y)).not.toBe(before);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Escape');
  await expect(page.locator('#screen-pause')).toHaveClass(/active/);
  await page.locator('#btn-save-quit').click();
  const saved = await page.evaluate(() => localStorage.getItem(window.NEON.Storage.key));
  expect(JSON.parse(saved).version).toBe(1);
  await page.reload();
  await page.locator('#btn-boot').click();
  await page.locator('#btn-continue').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  expect(await page.evaluate(() => window.NEON.Game.run.seed)).toBe(JSON.parse(saved).run.seed);
  expect(errors).toEqual([]);
});
