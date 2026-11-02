const fs = require('node:fs');
const { test, expect } = require('@playwright/test');

const checkpoint = {
  version: 1,
  run: { seed: 11, mapVersion: 1, level: 2, sectors: 1, kills: 0, totalTime: 0, damage: 0 },
  player: { level: 3, shipType: 'dart', shipColor: '#00f0ff' },
  level: { elapsed: 0, groundItems: [], destroyedAnchors: [], destroyedCaches: [] }
};
const other = {
  version: 1,
  run: { seed: 22, mapVersion: 1, level: 1, sectors: 0 },
  player: { level: 1, shipType: 'dart', shipColor: '#00f0ff' }
};
const settings = JSON.stringify({
  deadzone: 0.31,
  keyboard: { moveUp: 'KeyT', fire: 'KeyG' }
});

async function bootToData(page) {
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#btn-boot').click();
  await expect(page.locator('#screen-menu')).toHaveClass(/active/);
  await page.locator('#btn-settings').click();
  await page.locator('#screen-settings .tab[data-tab="data"]').click();
  await expect(page.locator('[data-action="export-save"]')).toBeEnabled();
}

test('export and import a backup in another browser profile', async ({ browser }) => {
  console.log('Browser: ' + browser.browserType().name() + ' ' + browser.version());
  const source = await browser.newContext();
  const target = await browser.newContext();
  const sourcePage = await source.newPage();
  const targetPage = await target.newPage();
  const errors = [];
  for (const page of [sourcePage, targetPage]) {
    page.on('pageerror', error => errors.push(error.message));
  }
  await sourcePage.addInitScript(value => {
    localStorage.setItem('neon_nexus_save_v1', value.save);
    localStorage.setItem('neon_nexus_settings_v1', value.settings);
    localStorage.setItem('neon-coop-identity-v1', 'nn_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    localStorage.setItem('unrelated-data', 'keep');
  }, { save: JSON.stringify(checkpoint), settings });
  await bootToData(sourcePage);
  const storedBefore = await sourcePage.evaluate(() => ({
    save: localStorage.getItem('neon_nexus_save_v1'),
    settings: localStorage.getItem('neon_nexus_settings_v1')
  }));
  const [download] = await Promise.all([
    sourcePage.waitForEvent('download'),
    sourcePage.locator('[data-action="export-save"]').click()
  ]);
  const exported = fs.readFileSync(await download.path(), 'utf8');
  const file = JSON.parse(exported);
  expect(file.fileVersion).toBe(2);
  expect(file.checkpoint.run.seed).toBe(11);
  expect(file.settings.deadzone).toBe(0.31);
  expect(file.settings.keyboard.moveUp).toBe('KeyT');
  expect(exported).not.toContain('neon-coop-identity');
  expect(await sourcePage.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBe(storedBefore.save);
  expect(await sourcePage.evaluate(() => localStorage.getItem('neon_nexus_settings_v1'))).toBe(storedBefore.settings);
  await expect(sourcePage.locator('#toasts')).toContainText('CANNOT CONFIRM THE FILE REACHED DISK');

  await targetPage.addInitScript(value => {
    localStorage.setItem('neon_nexus_save_v1', value.save);
    localStorage.setItem('neon_nexus_settings_v1', value.settings);
    localStorage.setItem('neon-coop-identity-v1', 'nn_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    localStorage.setItem('unrelated-data', 'keep');
  }, { save: JSON.stringify(other), settings: '{"deadzone":0.5}' });
  await bootToData(targetPage);
  await targetPage.locator('#save-import-file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{')
  });
  await expect(targetPage.locator('#toasts')).toContainText('CANNOT BE READ');
  expect(await targetPage.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBe(JSON.stringify(other));

  const badSector = {
    fileVersion: 1,
    checkpoint: { version: 1, run: { seed: 1, mapVersion: 1, level: -1 }, player: {} },
    settings: { deadzone: 0.2 }
  };
  await targetPage.locator('#save-import-file').setInputFiles({
    name: 'bad-sector.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(badSector))
  });
  await expect(targetPage.locator('#toasts')).toContainText('CANNOT BE LOADED');
  expect(await targetPage.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBe(JSON.stringify(other));
  expect(await targetPage.evaluate(() => localStorage.getItem('neon_nexus_settings_v1'))).toBe('{"deadzone":0.5}');

  await targetPage.locator('#save-import-file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exported)
  });
  await expect(targetPage.locator('#screen-confirm')).toHaveClass(/active/);
  await expect(targetPage.locator('#confirm-copy')).toContainText('sector 02');
  await expect(targetPage.locator('#confirm-copy')).toContainText('replaces the checkpoint');
  await targetPage.locator('#btn-confirm-no').click();
  await expect(targetPage.locator('#screen-settings')).toHaveClass(/active/);
  expect(await targetPage.evaluate(() => localStorage.getItem('neon_nexus_save_v1'))).toBe(JSON.stringify(other));

  await targetPage.locator('#save-import-file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exported)
  });
  await targetPage.locator('#btn-confirm-yes').click();
  await expect(targetPage.locator('#screen-settings')).toHaveClass(/active/);
  const imported = await targetPage.evaluate(() => ({
    save: JSON.parse(localStorage.getItem('neon_nexus_save_v1')),
    deadzone: window.NEON.Game.settings.deadzone,
    moveUp: window.NEON.Game.settings.keyboard.moveUp,
    identity: localStorage.getItem('neon-coop-identity-v1'),
    unrelated: localStorage.getItem('unrelated-data'),
    run: window.NEON.Game.run
  }));
  expect(imported.save.run.seed).toBe(11);
  expect(imported.deadzone).toBe(0.31);
  expect(imported.moveUp).toBe('KeyT');
  expect(imported.identity).toBe('nn_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  expect(imported.unrelated).toBe('keep');
  expect(imported.run).toBeNull();
  await targetPage.locator('#btn-settings-done').click();
  await targetPage.locator('#btn-continue').click();
  await expect.poll(() => targetPage.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  expect(await targetPage.evaluate(() => window.NEON.Game.run.seed)).toBe(11);
  expect(errors).toEqual([]);
  await source.close();
  await target.close();
});

test('pause can export the stored checkpoint and cannot import', async ({ page, browser }) => {
  console.log('Browser: ' + browser.browserType().name() + ' ' + browser.version());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#btn-boot').click();
  await page.locator('#btn-new-run').click();
  await page.locator('#btn-ship-launch').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  await page.keyboard.press('Escape');
  await page.locator('#btn-pause-settings').click();
  await page.locator('#screen-settings .tab[data-tab="data"]').click();
  await expect(page.locator('[data-action="import-save"]')).toBeDisabled();
  await expect(page.locator('[data-action="export-save"]')).toBeEnabled();
  const stored = await page.evaluate(() => localStorage.getItem(window.NEON.Storage.key));
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-action="export-save"]').click()
  ]);
  const file = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(file.checkpoint).toEqual(JSON.parse(stored));
  expect(errors).toEqual([]);
});
