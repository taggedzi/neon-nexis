const { test, expect } = require('@playwright/test');

async function watch(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function boot(page) {
  const errors = await watch(page);
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await expect(page.locator('#screen-menu')).toHaveClass(/active/);
  return errors;
}

async function startRun(page) {
  const errors = await boot(page);
  await page.locator('#btn-new-run').click();
  await page.locator('#btn-ship-launch').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  return errors;
}

test('a settings blob without capture stays valid and defaults on', async ({ page }) => {
  const raw = JSON.stringify({ deadzone: 0.28 });
  await page.addInitScript(value => {
    localStorage.setItem('neon_nexus_settings_v1', value);
  }, raw);
  const errors = await boot(page);
  expect(await page.evaluate(() => window.NEON.Game.settings.capturePointer)).toBe(true);
  expect(await page.evaluate(() => window.NEON.Game.settings.deadzone)).toBe(0.28);
  expect(await page.evaluate(() => localStorage.getItem('neon_nexus_settings_v1'))).toBe(raw);
  expect(errors).toEqual([]);
});

test('pointer capture can be turned off and stays off', async ({ page }) => {
  const errors = await boot(page);
  expect(await page.evaluate(() => window.NEON.Game.settings.capturePointer)).toBe(true);
  await page.locator('#btn-settings').click();
  await page.locator('[data-toggle="capturePointer"]').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.settings.capturePointer)).toBe(false);
  await page.reload();
  await expect(page.locator('#btn-boot')).toBeEnabled();
  expect(await page.evaluate(() => window.NEON.Game.settings.capturePointer)).toBe(false);
  expect(errors).toEqual([]);
});

test('playfield click locks the pointer and pause releases it', async ({ page, browser }) => {
  console.log('Pointer lock browser: ' + browser.browserType().name() + ' ' + browser.version());
  const errors = await startRun(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('paused');
  await page.locator('#btn-resume').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');

  await page.mouse.click(400, 420);
  await expect.poll(() => page.evaluate(() => document.pointerLockElement && document.pointerLockElement.id)).toBe('game');
  await expect(page.locator('#toasts')).toContainText('POINTER CAPTURED');
  const before = await page.evaluate(() => window.NEON.Input.getMouse());
  await page.mouse.move(480, 360);
  const delta = await page.evaluate(start => {
    const after = window.NEON.Input.getMouse();
    return { x: after.x - start.x, y: after.y - start.y };
  }, before);
  expect(Math.abs(delta.x)).toBeGreaterThan(10);
  expect(Math.abs(delta.y)).toBeGreaterThan(10);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('paused');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  await expect(page.locator('#pause-pointer-hint')).toHaveText('PAUSE OR ESC RELEASES THE POINTER.');
  await expect(page.locator('#screen-pause')).toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test('repeated firing preserves the aim reached while locked', async ({ page }) => {
  const errors = await startRun(page);
  await page.mouse.click(400, 420);
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe('game');
  await page.mouse.move(560, 300);
  const aim = await page.evaluate(() => {
    const { x, y } = window.NEON.Input.getMouse();
    return { x, y };
  });
  expect(Math.abs(aim.x - 400) + Math.abs(aim.y - 420)).toBeGreaterThan(20);

  for (let press = 0; press < 3; press++) {
    await page.mouse.down();
    expect(await page.evaluate(() => {
      const { x, y, down } = window.NEON.Input.getMouse();
      return { x, y, down };
    })).toEqual({ ...aim, down: true });
    await page.mouse.up();
    expect(await page.evaluate(() => {
      const { x, y, down } = window.NEON.Input.getMouse();
      return { x, y, down };
    })).toEqual({ ...aim, down: false });
  }
  expect(errors).toEqual([]);
});

test('turning capture off still pauses when focus leaves', async ({ page }) => {
  const errors = await startRun(page);
  await page.evaluate(() => {
    window.NEON.Game.settings.capturePointer = false;
    window.NEON.Game.applySettings(false);
  });
  await page.mouse.click(400, 420);
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.keyboard.down('KeyF');
  await expect.poll(() => page.evaluate(() => {
    const G = window.NEON.Game;
    return window.NEON.Input.getAim(G.player, { x: G.player.x, y: G.player.y }).fire;
  })).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('paused');
  expect(await page.evaluate(() => {
    const G = window.NEON.Game;
    return window.NEON.Input.getAim(G.player, { x: G.player.x, y: G.player.y }).fire;
  })).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await page.evaluate(() => window.NEON.Game.mode)).toBe('paused');
  await page.locator('#btn-resume').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  expect(await page.evaluate(() => {
    const G = window.NEON.Game;
    return window.NEON.Input.getAim(G.player, { x: G.player.x, y: G.player.y }).fire;
  })).toBe(false);
  await page.keyboard.up('KeyF');
  expect(errors).toEqual([]);
});

test('a denied lock is explained once and focus loss still pauses', async ({ page }) => {
  const errors = await startRun(page);
  await page.evaluate(() => {
    document.getElementById('game').requestPointerLock = () => Promise.reject(new Error('denied'));
  });
  await page.mouse.click(400, 420);
  await page.mouse.click(430, 440);
  await expect(page.locator('#toasts .toast', { hasText: 'POINTER CAPTURE DENIED' })).toHaveCount(1);
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('paused');
  expect(errors).toEqual([]);
});

test('a hidden document pauses single-player play', async ({ page }) => {
  const errors = await startRun(page);
  const hidden = await page.evaluate(() => {
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    } catch (error) {
      return 'failed';
    }
    document.dispatchEvent(new Event('visibilitychange'));
    return document.hidden ? 'hidden' : 'visible';
  });
  expect(hidden).toBe('hidden');
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('paused');
  expect(errors).toEqual([]);
});
