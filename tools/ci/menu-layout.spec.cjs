const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.goto('/');
  await page.locator('#btn-boot').click();
}

async function pause(page) {
  await page.locator('#btn-new-run').click();
  await page.locator('#btn-ship-launch').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-resume')).toBeFocused();
}

async function padPress(page, button) {
  await page.evaluate(button => {
    const N = window.NEON;
    const pad = { id: 'Menu test controller', axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
    const frame = () => { N.Input.update(); N.UI.handleGamepad(); N.Input.endFrame(); };
    frame();
    pad.buttons[button] = { pressed: true, value: 1 };
    frame();
    pad.buttons[button] = { pressed: false, value: 0 };
    frame();
  }, button);
}

test('pause destinations restore focus for mouse, keyboard and synthetic controller', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page);
  await pause(page);
  const routes = [
    ['btn-pause-rewards', 'rewards', 'btn-rewards-close'],
    ['btn-inventory', 'inventory', 'btn-inventory-done'],
    ['btn-pause-loadouts', 'loadouts', 'loadout-close'],
    ['btn-pause-logbook', 'logbook', 'logbook-close'],
    ['btn-pause-stats', 'playerstats', 'stats-close'],
    ['btn-pause-settings', 'settings', 'btn-settings-done']
  ];
  for (const [origin, screen, close] of routes) {
    await page.locator('#' + origin).click();
    await expect(page.locator('#screen-' + screen)).toHaveClass(/active/);
    await page.locator('#' + close).click();
    await expect(page.locator('#' + origin)).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('paused');
    await page.keyboard.press('Enter');
    await expect(page.locator('#screen-' + screen)).toHaveClass(/active/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#' + origin)).toBeFocused();
  }
  // The previous screen restores focus after 30 ms. Let that browser timer
  // settle before assigning the synthetic controller phase's starting focus.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  await page.locator('#btn-resume').focus();
  for (const [origin, screen] of routes) {
    await padPress(page, 13);
    await expect(page.locator('#' + origin)).toBeFocused();
    await padPress(page, 0);
    await expect(page.locator('#screen-' + screen)).toHaveClass(/active/);
    await padPress(page, 1);
    await expect(page.locator('#' + origin)).toBeFocused();
  }
  await page.locator('#btn-resume').click();
  // Rewards opened during combat still returns to combat.
  await page.evaluate(() => window.NEON.Game.openRewards());
  await expect(page.locator('#btn-rewards-close')).toHaveText('RETURN TO COMBAT');
  await page.locator('#btn-rewards-close').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-resume')).toBeFocused();
  expect(errors).toEqual([]);
});

async function checkLayout(page, screen, scrollBody, fixedControls) {
  await expect(page.locator('#screen-' + screen)).toHaveClass(/active/);
  // Wait for the existing entrance transform before measuring edges.
  await page.waitForTimeout(300);
  const overflow = await page.locator('#screen-' + screen).evaluate(root => {
    return [root, ...root.querySelectorAll('*')].filter(el => {
      const style = getComputedStyle(el);
      return el.getClientRects().length && ['auto', 'scroll'].includes(style.overflowX)
        && el.scrollWidth > el.clientWidth + 1;
    }).map(el => el.id || el.className);
  });
  expect(overflow).toEqual([]);
  const scrollers = await page.locator('#screen-' + screen).evaluate(root => {
    const vertical = [root, ...root.querySelectorAll('*')].filter(el => {
      return el.getClientRects().length && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)
        && el.scrollHeight > el.clientHeight + 1;
    }).map(el => el.id || el.className);
    return {
      vertical,
      clipped: root.scrollHeight > root.clientHeight + 2 || root.scrollWidth > root.clientWidth + 2
    };
  });
  if (screen === 'settings') {
    expect(scrollers.vertical.filter(id => id !== 'settings-body')).toEqual([]);
    await expect(page.locator('.settings-panel')).toHaveCSS('zoom', '1');
  } else {
    expect(scrollers.vertical).toEqual([]);
  }
  expect(scrollers.clipped).toBe(false);
  if (!scrollBody) return;
  for (const control of fixedControls) await expect(page.locator(control)).toBeInViewport({ ratio: 1 });
}

for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 600 },
  { width: 640, height: 480 }, { width: 360, height: 640 }, { width: 320, height: 480 }]) {
  test.describe('viewport ' + size.width + 'x' + size.height, () => {
    test.use({ viewport: size });
    test('four layouts stay reachable', async ({ page, browser }, info) => {
      console.log('Menu layout: ' + browser.browserType().name() + ' ' + browser.version());
      await boot(page);
      await page.evaluate(() => window.NEON.UI.showMenu());
      await checkLayout(page, 'menu');
      await page.screenshot({ path: info.outputPath('menu-' + size.width + '.png') });
      await page.locator('#btn-credits').scrollIntoViewIfNeeded();
      await expect(page.locator('#btn-credits')).toBeInViewport();
      await expect(page.locator('.holo-panel')).toBeVisible();
      await page.locator('#btn-new-run').click();
      if (await page.locator('#screen-confirm').evaluate(el => el.classList.contains('active'))) {
        await page.locator('#btn-confirm-yes').click();
      }
      await checkLayout(page, 'ship', '.ship-body', ['#btn-ship-cancel', '#btn-ship-launch']);
      for (const summary of await page.locator('.ship-body summary').all()) await summary.click();
      await checkLayout(page, 'ship', '.ship-body', ['#btn-ship-cancel', '#btn-ship-launch']);
      await page.screenshot({ path: info.outputPath('ship-' + size.width + '.png') });
      await page.locator('#btn-ship-launch').click();
      await page.keyboard.press('Escape');
      await checkLayout(page, 'pause');
      await page.locator('#btn-save-quit').scrollIntoViewIfNeeded();
      await expect(page.locator('#btn-save-quit')).toBeInViewport();
      await page.screenshot({ path: info.outputPath('pause-' + size.width + '.png') });
      await page.locator('#btn-pause-settings').click();
      for (const tab of ['controls', 'audio', 'visual', 'data']) {
        await page.locator('[data-tab="' + tab + '"]').click();
        await checkLayout(page, 'settings', '#settings-body', ['.settings-tabs', '#btn-settings-done', '#btn-settings-reset']);
      }
      await page.locator('[data-tab="controls"]').click();
      const lastBinding = page.locator('[data-bind-pad]').last();
      await lastBinding.focus();
      await expect(lastBinding).toBeInViewport({ ratio: 1 });
      await expect(lastBinding).toHaveCSS('font-size', '14px');
      await page.locator('[data-help="controller"] summary').click();
      await checkLayout(page, 'settings', '#settings-body', ['.settings-tabs', '#btn-settings-done']);
      await page.screenshot({ path: info.outputPath('settings-' + size.width + '.png') });
      await page.locator('#btn-settings-done').click();
      await page.locator('#btn-save-quit').click();
    });
  });
}

test('disclosures and settings groups preserve selection, help state and controller access', async ({ page }) => {
  await boot(page);
  await page.locator('#btn-settings').click();
  const shared = page.locator('.control-group').filter({ has: page.locator('#controls-shared-title') });
  const keyboard = page.locator('.control-group').filter({ has: page.locator('#controls-keyboard-title') });
  const controller = page.locator('.control-group').filter({ has: page.locator('#controls-controller-title') });
  await expect(shared.locator('[data-movement-mode]')).toHaveCount(2);
  await expect(shared.locator('[data-firing-mode]')).toHaveCount(2);
  await expect(keyboard.locator('[data-toggle="capturePointer"]')).toHaveCount(1);
  await expect(controller.locator('[data-toggle="rightStickFire"]')).toHaveCount(1);
  await expect(controller.locator('[data-setting="deadzone"]')).toHaveCount(1);
  await page.locator('[data-help="movement"] summary').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-movement-mode="driving"]').click();
  await expect(page.locator('[data-help="movement"]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-movement-mode="driving"]')).toBeFocused();
  await page.locator('[data-help="controller"] summary').focus();
  await padPress(page, 0);
  await expect(page.locator('[data-help="controller"]')).toHaveAttribute('open', '');
  await expect(page.locator('#controller-monitor')).toContainText('Menu test controller');
  await page.locator('#btn-settings-done').click();
  await expect(page.locator('#btn-settings')).toBeFocused();
});

test('long saved ships and hardcore keep launch rules and return focus', async ({ page }) => {
  await boot(page);
  await pause(page);
  const name = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';
  await page.evaluate(name => {
    const N = window.NEON;
    N.Loadouts.save(name);
    N.Game.saveAndQuit();
  }, name);
  await page.locator('#btn-new-run').click();
  await page.locator('#btn-confirm-yes').click();
  await page.getByRole('button', { name: name + ' // LV 1', exact: true }).click();
  await expect(page.locator('#ship-types button').first()).toBeDisabled();
  await expect(page.locator('#solo-loadout-note')).toContainText('EARNED EQUIPMENT KEPT');
  await page.locator('#solo-manage-loadouts').click();
  await page.locator('#loadout-close').click();
  await expect(page.locator('#solo-manage-loadouts')).toBeFocused();
  await page.locator('[data-skill="hardcore"]').click();
  await expect(page.getByRole('button', { name: name + ' // LV 1', exact: true })).toBeDisabled();
  await expect(page.locator('#ship-types button').first()).toBeEnabled();
  await expect(page.locator('#ship-skill-note')).toContainText('ONE LIFE');
  await page.locator('#btn-ship-launch').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.run.skill)).toBe('hardcore');
});
