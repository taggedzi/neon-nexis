const { test, expect } = require('@playwright/test');

test('boot gesture unlocks audio after a pre-gesture resume remains pending', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext;
    window.audioStartup = { calls: 0, context: null };
    window.AudioContext = class extends NativeContext {
      constructor(options) {
        super(options);
        window.audioStartup.context = this;
      }
      resume() {
        window.audioStartup.calls++;
        // Model Firefox retaining a policy-blocked request before the click.
        if (window.audioStartup.calls === 1) return new Promise(() => {});
        return super.resume();
      }
    };
  });
  await page.goto('/');
  await page.evaluate(() => window.NEON.Audio.resume());
  await expect.poll(() => page.evaluate(() => window.audioStartup.calls)).toBe(1);
  await page.locator('#btn-boot').click();
  await expect.poll(() => page.evaluate(() => window.audioStartup.context.state)).toBe('running');
  await expect(page.locator('#screen-menu.active')).toBeVisible();
});

test('procedural score survives scene, mute and suspension transitions', async ({ page, browser }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.audioProbe = { starts: 0, invalidTimes: 0, contexts: [] };
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor(options) {
        super(options);
        window.audioProbe.contexts.push(this);
      }
      createOscillator() {
        const voice = super.createOscillator();
        const start = voice.start.bind(voice);
        voice.start = time => {
          window.audioProbe.starts++;
          if (!Number.isFinite(time) || time < this.currentTime - .01) {
            window.audioProbe.invalidTimes++;
          }
          start(time);
        };
        return voice;
      }
    };
  });
  await page.goto('/');
  await page.locator('#btn-boot').click();
  for (const scene of ['menu', 'game', 'paused', 'dead', 'complete']) {
    const before = await page.evaluate(scene => {
      window.NEON.Audio.setScene(scene);
      return window.audioProbe.starts;
    }, scene);
    await expect.poll(() => page.evaluate(() => window.audioProbe.starts), { timeout: 10000 }).toBeGreaterThan(before);
  }
  await page.evaluate(() => window.NEON.Audio.setSettings({ audio: { muted: true } }));
  await page.waitForTimeout(250);
  const muted = await page.evaluate(() => window.audioProbe.starts);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.audioProbe.starts)).toBe(muted);
  await page.evaluate(() => window.NEON.Audio.setSettings({ audio: { muted: false } }));
  await expect.poll(() => page.evaluate(() => window.audioProbe.starts)).toBeGreaterThan(muted);
  await page.evaluate(() => window.NEON.Audio.suspend());
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0].state)).toBe('suspended');
  await page.evaluate(() => window.NEON.Audio.resume());
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0].state)).toBe('running');
  expect(await page.evaluate(() => window.audioProbe.invalidTimes)).toBe(0);
  expect(errors).toEqual([]);
  console.log('Audio browser:', browser.version());
});

test('blocked audio still allows launching, moving and pausing', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.AudioContext = class { constructor() { throw new Error('Audio blocked for test'); } };
    window.webkitAudioContext = undefined;
  });
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await page.locator('#btn-new-run').click();
  await page.locator('#btn-ship-launch').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  const before = await page.evaluate(() => ({ x: window.NEON.Game.player.x, y: window.NEON.Game.player.y }));
  await page.keyboard.down('KeyW');
  await expect.poll(() => page.evaluate(start => {
    const player = window.NEON.Game.player;
    return Math.hypot(player.x - start.x, player.y - start.y);
  }, before)).toBeGreaterThan(2);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('paused');
  await page.locator('#btn-resume').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  expect(errors).toEqual([]);
});
