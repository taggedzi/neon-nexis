const { test, expect } = require('@playwright/test');

test('malformed settings groups still reach the menu', async ({ page }) => {
  const raw = JSON.stringify({
    audio: null,
    graphics: 1,
    keyboard: [],
    gamepad: 'no',
    accessibility: null,
    deadzone: 0.41,
    movementMode: 'driving'
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(value => {
    localStorage.setItem('neon_nexus_settings_v1', value);
    localStorage.setItem('unrelated-data', 'keep');
  }, raw);
  await page.goto('/');
  expect(await page.locator('#boot-log').textContent()).not.toContain('BOOT FAILURE');
  await page.locator('#btn-boot').click();
  await expect(page.locator('#screen-menu')).toHaveClass(/active/);
  expect(await page.evaluate(() => window.NEON.Game.settings.audio.master)).toBe(0.7);
  expect(await page.evaluate(() => window.NEON.Game.settings.graphics.quality)).toBe('high');
  expect(await page.evaluate(() => window.NEON.Game.settings.deadzone)).toBe(0.41);
  expect(await page.evaluate(() => window.NEON.Game.settings.movementMode)).toBe('driving');
  expect(await page.evaluate(() => localStorage.getItem('neon_nexus_settings_v1'))).toBe(raw);
  expect(await page.evaluate(() => localStorage.getItem('unrelated-data'))).toBe('keep');
  expect(errors).toEqual([]);
});

test('missing reward bindings migrate without rewriting storage', async ({ page }) => {
  const raw = JSON.stringify({
    deadzone: 0.33,
    keyboard: {
      moveUp: 'ArrowUp', moveDown: 'ArrowDown', moveLeft: 'ArrowLeft', moveRight: 'ArrowRight',
      dash: 'ShiftLeft', pause: 'Escape', weaponNext: 'KeyE', weaponPrev: 'KeyQ', inventory: 'KeyI'
    },
    gamepad: { fire: 7, dash: 0, pause: 9, weaponNext: 5, weaponPrev: 4, inventory: 3 }
  });
  await page.addInitScript(value => localStorage.setItem('neon_nexus_settings_v1', value), raw);
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await expect(page.locator('#screen-menu')).toHaveClass(/active/);
  const settings = await page.evaluate(() => window.NEON.Game.settings);
  expect(settings.keyboard.moveUp).toBe('ArrowUp');
  expect(settings.keyboard.fire).toBe('KeyF');
  expect(settings.keyboard.rewards).toBe('KeyR');
  expect(settings.gamepad.rewards).toBe(2);
  expect(settings.deadzone).toBe(0.33);
  expect(await page.evaluate(() => localStorage.getItem('neon_nexus_settings_v1'))).toBe(raw);
});

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
