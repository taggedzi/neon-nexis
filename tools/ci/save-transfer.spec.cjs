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
  expect(file.fileVersion).toBe(4);
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

test('quota exhaustion restores the four stored values', async ({ browser }) => {
  test.setTimeout(90000);
  console.log('Browser: ' + browser.browserType().name() + ' ' + browser.version());
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:4173/');
    await page.locator('#btn-boot').click();
    await expect(page.locator('#screen-menu')).toHaveClass(/active/);
    const outcome = await page.evaluate(() => {
      let step = 'start';
      try {
      const N = window.NEON;
      const saveKey = N.Storage.key;
      const settingsKey = N.Storage.settingsKey;
      const big = {
        version: 1,
        run: { seed: 11, mapVersion: 1, level: 2, sectors: 1 },
        player: { level: 3, shipType: 'dart', shipColor: '#00f0ff', pad: 'C'.repeat(120000) },
        level: { elapsed: 0, groundItems: [], destroyedAnchors: [], destroyedCaches: [] }
      };
      const small = {
        version: 1,
        run: { seed: 11, mapVersion: 1, level: 2, sectors: 1 },
        player: { level: 3, shipType: 'dart', shipColor: '#00f0ff', pad: 'c' },
        level: { elapsed: 0, groundItems: [], destroyedAnchors: [], destroyedCaches: [] }
      };
      if (!N.Game.canLoadSave(big) || !N.Game.canLoadSave(small)) {
        return { error: 'checkpoint rejected before quota setup' };
      }
      const bigText = JSON.stringify(big);
      const smallText = JSON.stringify(small);
      function shipList(padLength) {
        return {
          version: 1,
          ships: [{
            name: 'Quota',
            highestSector: 1,
            player: {
              shipType: 'dart', shipColor: '#00f0ff', level: 2, xp: 0, xpNext: 10,
              weapons: [{ id: 'pulse', level: 1, tier: 1 }], passives: [],
              core: ['x'.repeat(padLength)], weaponSlots: 1, passiveSlots: 1, activeWeapon: 0
            }
          }]
        };
      }
      let lowPad = 0;
      let highPad = bigText.length;
      let loadouts = null;
      let loadoutText = '';
      // Real quotas also charge the new key. Leave room for that, but less than the profile write.
      const limit = bigText.length - smallText.length - N.Loadouts.key.length - 80;
      while (lowPad <= highPad) {
        const mid = Math.floor((lowPad + highPad) / 2);
        const candidate = shipList(mid);
        const text = JSON.stringify(candidate);
        if (N.Loadouts.validate(candidate) && text.length <= limit) {
          loadouts = candidate;
          loadoutText = text;
          lowPad = mid + 1;
        } else {
          highPad = mid - 1;
        }
      }
      const book = {};
      for (const id of Object.keys(N.ENEMY_BY_ID)) book[id] = { seen: true, kills: 1 };
      const profile = { version: 2, stats: { shotsFired: 4 }, book };
      const writtenProfile = JSON.stringify({
        version: 2,
        stats: N.Profile.cleanStats(profile.stats),
        book: N.Profile.cleanBook(profile.book)
      });
      const headroom = 512;
      const leftover = bigText.length - smallText.length - N.Loadouts.key.length - loadoutText.length;
      const profileCost = writtenProfile.length + N.Profile.key.length;
      if (!loadouts || leftover < 32 || profileCost <= leftover + headroom) {
        return { error: 'fixture does not trap the profile write', leftover, profileLength: writtenProfile.length, headroom };
      }
      const settings = N.normalizeSettings({ deadzone: 0.31, keyboard: { moveUp: 'KeyT' } });
      step = 'probe';
      localStorage.clear();
      localStorage.setItem(saveKey, smallText);
      localStorage.setItem(settingsKey, JSON.stringify(settings));
      N.Game.mode = 'menu';
      const learned = N.SaveTransfer.apply({
        fileVersion: 4,
        checkpoint: small,
        settings,
        loadouts: shipList(1),
        profile: { version: 2, stats: { shotsFired: 1 } }
      });
      if (!learned.ok) return { error: 'settings probe failed', reason: learned.reason };
      const canonicalSettings = localStorage.getItem(settingsKey);
      step = 'origin';
      localStorage.clear();
      try {
        localStorage.setItem(saveKey, bigText);
        localStorage.setItem(settingsKey, canonicalSettings);
        localStorage.setItem('unrelated-data', 'keep');
      } catch (error) {
        return { error: 'origin setup exceeded quota', length: bigText.length, detail: String(error.message || error) };
      }
      localStorage.removeItem(N.Loadouts.key);
      localStorage.removeItem(N.Profile.key);
      const incoming = {
        fileVersion: 4,
        checkpoint: small,
        settings: JSON.parse(canonicalSettings),
        loadouts,
        profile
      };
      step = 'fill';
      const fillerKey = 'quota-filler-test';
      let size = 256;
      let filled = 0;
      while (size < 20000000) {
        try {
          localStorage.setItem(fillerKey, 'Q'.repeat(size));
          filled = size;
          size *= 2;
        } catch (error) {
          break;
        }
      }
      let low = filled;
      let high = size;
      while (low + 1 < high) {
        const mid = Math.floor((low + high) / 2);
        try {
          localStorage.setItem(fillerKey, 'Q'.repeat(mid));
          low = mid;
        } catch (error) {
          high = mid;
        }
      }
      // An exact fill makes Firefox refuse later storage access. Keep a small
      // gap that is still too small for the profile write.
      const kept = Math.max(0, low - headroom);
      try {
        localStorage.setItem(fillerKey, 'Q'.repeat(kept));
      } catch (error) {
        try { localStorage.removeItem(fillerKey); } catch (ignore) { /* The shorter write below is the recovery. */ }
        try {
          localStorage.setItem(fillerKey, 'Q'.repeat(kept));
        } catch (again) {
          return { error: 'could not leave quota headroom', detail: String(again && again.message ? again.message : again) };
        }
      }
      low = kept;
      step = 'snapshot';
      const proto = Object.getPrototypeOf(localStorage);
      const originalSet = proto.setItem;
      const committed = [];
      let rejected = 0;
      function recordSet(key, value) {
        try {
          originalSet.call(this, key, value);
          if (rejected === 0) committed.push(String(key));
        } catch (error) {
          rejected += 1;
          throw error;
        }
      }
      try { proto.setItem = recordSet; } catch (error) { /* Instance assignment below still covers Chromium. */ }
      try { localStorage.setItem = recordSet; } catch (error) { /* Firefox keeps the prototype method. */ }
      function readKey(key) {
        try { return localStorage.getItem(key); }
        catch (error) { return null; }
      }
      const before = {
        save: readKey(saveKey),
        settings: readKey(settingsKey),
        loadouts: readKey(N.Loadouts.key),
        profile: readKey(N.Profile.key),
        unrelated: readKey('unrelated-data'),
        fillerLength: low
      };
      step = 'apply';
      let applied;
      try {
        applied = N.SaveTransfer.apply(incoming);
      } catch (error) {
        return { error: 'apply-threw', detail: String(error && error.message ? error.message : error), rejected, committed };
      }
      step = 'after-apply';
      let fillerAfter = -1;
      try { fillerAfter = (localStorage.getItem(fillerKey) || '').length; }
      catch (error) { fillerAfter = -2; }
      const after = {
        save: readKey(saveKey),
        settings: readKey(settingsKey),
        loadouts: readKey(N.Loadouts.key),
        profile: readKey(N.Profile.key),
        unrelated: readKey('unrelated-data'),
        fillerLength: fillerAfter
      };
      return {
        ok: applied.ok,
        reason: applied.reason,
        text: N.SaveTransfer.failureText(applied.reason),
        rejected,
        committed,
        before,
        after
      };
      } catch (error) {
        return { error: step + ': ' + String(error && error.message ? error.message : error) };
      }
    });
    expect(outcome.error, JSON.stringify(outcome)).toBeUndefined();
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toBe('storage');
    expect(outcome.before && outcome.before.save && outcome.before.save.length, JSON.stringify({
      rejected: outcome.rejected,
      committed: outcome.committed,
      saveLength: outcome.before && outcome.before.save ? outcome.before.save.length : 0,
      fillerLength: outcome.before && outcome.before.fillerLength
    })).toBeGreaterThan(1000);
    expect(outcome.rejected).toBeGreaterThan(0);
    expect(outcome.committed).toContain('neon_nexus_loadouts_v1');
    expect(outcome.after).toEqual(outcome.before);
    expect(outcome.before.loadouts).toBeNull();
    expect(outcome.before.profile).toBeNull();
    expect(outcome.after.unrelated).toBe('keep');
    expect(outcome.after.fillerLength).toBe(outcome.before.fillerLength);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
