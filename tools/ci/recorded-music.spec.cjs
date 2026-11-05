const { test, expect } = require('@playwright/test');

const paths = ['a', 'b', 'c'].map(letter => 'assets/music/' + letter.repeat(64) + '.mp3');

function tone() {
  const sampleRate = 8000;
  const samples = sampleRate * 3;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
  bytes.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++) {
    bytes.writeInt16LE(Math.round(Math.sin(index * 2 * Math.PI * 220 / sampleRate) * 1000), 44 + index * 2);
  }
  return bytes;
}

async function observe(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = function() {
      const media = new NativeAudio();
      window.soundtrackElement = media;
      return media;
    };
  });
  return errors;
}

async function fixture(page, tracks = paths, rejectPlay = false) {
  const errors = await observe(page);
  await page.route('**/js/music-library.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'window.NEON.MUSIC_TRACKS = ' + JSON.stringify(tracks) + ';'
  }));
  // Generate a local PCM tone in memory. These fixture paths exercise playlist
  // transport; the optional staged-site check below verifies actual MP3 decode.
  await page.route('**/assets/music/*.mp3', route => route.fulfill({
    contentType: 'audio/wav', body: tone()
  }));
  if (rejectPlay) {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
    });
  }
  await page.goto('/');
  await page.locator('#btn-boot').click();
  return errors;
}

const status = page => page.evaluate(() => window.NEON.Audio.getMusicStatus());

test('recorded playlist shuffles without repeats and respects audio lifecycle', async ({ page, browser }) => {
  const errors = await fixture(page);
  await expect.poll(async () => (await status(page)).mode).toBe('recorded');
  const visited = [];
  for (let index = 0; index < paths.length; index++) {
    const current = (await status(page)).track;
    visited.push(current);
    await page.evaluate(() => { window.soundtrackElement.currentTime = 2.95; });
    await expect.poll(async () => (await status(page)).track).not.toBe(current);
    await expect.poll(async () => (await status(page)).mode).toBe('recorded');
  }
  expect(new Set(visited).size).toBe(paths.length);
  expect((await status(page)).track).not.toBe(visited[visited.length - 1]);
  await page.evaluate(() => window.NEON.Audio.setSettings({ audio: { muted: true } }));
  await expect.poll(() => page.evaluate(() => window.soundtrackElement.paused)).toBe(true);
  const pausedTime = await page.evaluate(() => window.soundtrackElement.currentTime);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.soundtrackElement.currentTime)).toBe(pausedTime);
  await page.evaluate(() => window.NEON.Audio.setSettings({ audio: { muted: false } }));
  await expect.poll(async () => (await status(page)).mode).toBe('recorded');
  await page.evaluate(() => window.NEON.Audio.suspend());
  await expect.poll(() => page.evaluate(() => window.soundtrackElement.paused)).toBe(true);
  await page.evaluate(() => window.NEON.Audio.resume());
  await expect.poll(async () => (await status(page)).mode).toBe('recorded');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => window.soundtrackElement.paused)).toBe(true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await status(page)).mode).toBe('recorded');
  expect(errors).toEqual([]);
  console.log('Recorded music browser:', browser.version());
});

test('missing or invalid tracks fall back without breaking play', async ({ page }) => {
  await page.route('**/assets/music/*.mp3', route => route.abort());
  const errors = await observe(page);
  await page.route('**/js/music-library.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'window.NEON.MUSIC_TRACKS = ' + JSON.stringify(paths) + ';'
  }));
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await expect.poll(async () => (await status(page)).available).toBe(0);
  expect((await status(page)).mode).toBe('procedural');
  await page.locator('#btn-new-run').click();
  await page.locator('#btn-ship-launch').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('paused');
  expect(errors).toEqual([]);
});

test('empty library makes no media requests', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (request.url().includes('/assets/')) requests.push(request.url()); });
  const errors = await fixture(page, []);
  expect((await status(page)).mode).toBe('procedural');
  expect(await page.evaluate(() => !!window.soundtrackElement)).toBe(false);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('media autoplay rejection keeps procedural fallback and menus usable', async ({ page }) => {
  const errors = await fixture(page, paths, true);
  await page.waitForTimeout(200);
  expect((await status(page)).mode).toBe('procedural');
  await page.locator('#btn-new-run').click();
  await page.locator('#btn-ship-launch').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  expect(errors).toEqual([]);
});

if (process.env.MUSIC_SITE_TEST === '1') {
  test('local staged soundtrack decodes every converted MP3', async ({ page, browser }) => {
    const errors = await observe(page);
    await page.goto('/');
    await page.locator('#btn-boot').click();
    const count = await page.evaluate(() => window.NEON.MUSIC_TRACKS.length);
    expect(count).toBeGreaterThan(0);
    const visited = new Set();
    for (let index = 0; index < count; index++) {
      await expect.poll(async () => (await status(page)).mode, { timeout: 15000 }).toBe('recorded');
      await expect.poll(() => page.evaluate(() => window.soundtrackElement.currentTime)).toBeGreaterThan(.05);
      const current = (await status(page)).track;
      visited.add(current);
      if (index + 1 < count) {
        // PHP's fixture server does not promise HTTP byte-range seeking. Real
        // end-of-track behavior is exercised by the short fixture above; here
        // advance synthetically after decoding actual MP3 samples.
        await page.evaluate(() => window.soundtrackElement.dispatchEvent(new Event('ended')));
        await expect.poll(async () => (await status(page)).track).not.toBe(current);
      }
    }
    expect(visited.size).toBe(count);
    expect(errors).toEqual([]);
    console.log('Decoded ' + count + ' staged MP3 tracks in ' + browser.version());
  });
}
