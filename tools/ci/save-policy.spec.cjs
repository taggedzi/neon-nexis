const { test, expect } = require('@playwright/test');

async function openOldSave(page, raw) {
  await page.addInitScript(value => {
    localStorage.setItem('neon_nexus_save_v1', value);
    localStorage.setItem('unrelated-data', 'keep');
    localStorage.setItem('neon_nexus_settings_v1', '{"version":1,"deadzone":0.31}');
  }, raw);
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await expect(page.locator('#screen-oldsave')).toHaveClass(/active/);
}

for (const raw of [
  '{"version":0,"run":{},"player":{}}',
  '{broken json',
  '{"version":1,"run":{"mapVersion":999},"player":{}}',
  '{"version":1,"run":{"seed":1,"mapVersion":1,"level":1},"player":{"weapons":{}},"level":{}}',
  '{"version":1,"run":{"seed":1,"mapVersion":1,"level":1},"player":{},"level":{"groundItems":{},"destroyedAnchors":{}}}'
]) {
  test('decline export removes only incompatible checkpoint: ' + raw, async ({ page }) => {
    await openOldSave(page, raw);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBe(raw);
    await page.locator('#btn-old-save-remove').click();
    expect(await page.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('unrelated-data'))).toBe('keep');
    expect(await page.evaluate(() => localStorage.getItem('neon_nexus_settings_v1'))).toBe('{"version":1,"deadzone":0.31}');
    await expect(page.locator('#screen-menu')).toHaveClass(/active/);
  });
}

test('export downloads original bytes before removal', async ({ page }, testInfo) => {
  const raw = '{"version":0,"extra":"preserve this"}';
  await openOldSave(page, raw);
  await page.screenshot({ path: testInfo.outputPath('old-save-prompt.png'), animations: 'disabled' });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#btn-old-save-export').click();
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(Buffer.concat(chunks).toString()).toBe(raw);
  expect(await page.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBeNull();
});

test('export failure and changed checkpoint preserve data', async ({ page }) => {
  const raw = '{"version":0}';
  await openOldSave(page, raw);
  await page.evaluate(() => {
    window.NEON.SavePolicy.export = () => { throw Error('Download failed'); };
  });
  await page.locator('#btn-old-save-export').click();
  expect(await page.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBe(raw);
  await page.evaluate(() => localStorage.setItem('neon_nexus_save_v1', 'newer checkpoint'));
  await page.locator('#btn-old-save-remove').click();
  expect(await page.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBe('newer checkpoint');
});

test('automatic checkpoint cannot overwrite an incompatible save', async ({ page }) => {
  const raw = '{"version":0}';
  await openOldSave(page, raw);
  await page.evaluate(() => window.NEON.Game.newRun());
  expect(await page.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBe(raw);
});

test('legacy current-version checkpoint continues', async ({ page }) => {
  const raw = JSON.stringify({ version: 1, run: { seed: 3, mapVersion: 0, level: 2 }, player: { level: 4, hp: 20 } });
  await page.addInitScript(value => {
    localStorage.setItem('neon_nexus_save_v1', value);
    localStorage.setItem('unrelated-data', 'keep');
  }, raw);
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await expect(page.locator('#screen-menu')).toHaveClass(/active/);
  await page.locator('#btn-continue').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  expect(await page.evaluate(() => window.NEON.Game.run.level)).toBe(2);
  expect(await page.evaluate(() => window.NEON.Game.run.mapVersion)).toBe(0);
  expect(await page.evaluate(() => window.NEON.Game.player.level)).toBe(4);
  expect(await page.evaluate(() => window.NEON.Game.player.weapons.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBe(raw);
  expect(await page.evaluate(() => localStorage.getItem('unrelated-data'))).toBe('keep');
});

test('storage removal failure preserves checkpoint and reports failure', async ({ page }) => {
  const raw = '{"version":0}';
  await openOldSave(page, raw);
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(key) {
      if (key === 'neon_nexus_save_v1') {
        throw Error('Storage denied');
      }
      return original.call(this, key);
    };
  });
  await page.locator('#btn-old-save-remove').click();
  expect(await page.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBe(raw);
  await expect(page.locator('#toasts')).toContainText('SAVE PRESERVED');
});
