const { test, expect } = require('@playwright/test');

test('settings update and persist while malicious DOM paths are rejected', async ({ page, browser }) => {
  console.log('Settings browser: ' + browser.browserType().name() + ' ' + browser.version());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await page.locator('#btn-settings').click();
  await page.evaluate(() => window.NEON.UI.switchSettingsTab('audio'));
  const volume = page.locator('#settings-body input[type="range"]').first();
  await volume.evaluate(el => {
    el.value = '37';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => window.NEON.Game.settings.audio.master)).toBe(0.37);
  await page.locator('[data-toggle="audio.muted"]').click();
  expect(await page.evaluate(() => window.NEON.Game.settings.audio.muted)).toBe(true);
  for (const path of ['__proto__.polluted', 'constructor.prototype.polluted', 'audio.unknown']) {
    await volume.evaluate((el, path) => {
      el.dataset.setting = path;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, path);
    expect(await page.evaluate(() => Object.hasOwn(Object.prototype, 'polluted'))).toBe(false);
    expect(await page.evaluate(() => Object.hasOwn(window.NEON.Game.settings.audio, 'unknown'))).toBe(false);
  }
  await page.reload();
  expect(await page.evaluate(() => window.NEON.Game.settings.audio.master)).toBe(0.37);
  expect(await page.evaluate(() => window.NEON.Game.settings.audio.muted)).toBe(true);
  expect(errors).toEqual([]);
});
