const { test, expect } = require('@playwright/test');

test(process.env.SERVE_DIR ? 'public package excludes the source commands' :
  'source scenarios preserve storage, pause safely, and use normal combat', async ({ page, browser }) => {
  console.log('Dev mode: ' + browser.browserType().name() + ' ' + browser.version());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#btn-boot').click();
  if (process.env.SERVE_DIR) {
    expect(await page.evaluate(() => typeof window.NEON.Dev)).toBe('undefined');
    expect((await page.request.get('/js/dev.js')).status()).toBe(404);
    expect(errors).toEqual([]);
    return;
  }
  const result = await page.evaluate(() => {
    const N = window.NEON, G = N.Game, D = N.Dev;
    const stored = () => JSON.stringify(Object.entries(localStorage));
    const before = stored();
    D.setup({ hull: 'talon', color: '#ffd166', level: 5, sector: 3, seed: 42,
      weapons: D.catalog().weapons.slice(0, 2), defense: 'aegis_projector', invulnerable: true });
    const setup = [G.player.shipType, G.player.shipColor, G.player.level, G.run.level,
      G.player.weapons.length, G.mode];
    const hp = G.player.hp, shield = G.player.shield;
    G.damagePlayer(9999, G.player.x, G.player.y);
    const immune = G.player.hp === hp && G.player.shield === shield;
    N.Firing.configure('hold');
    N.Firing.set('regression', true, true);
    const id = D.spawn('dart');
    const released = !N.Firing.active(true);
    N.Firing.set('regression', false, false);
    const spawned = G.enemies.some(e => e.id === id && e.style === 'dart' &&
      N.World.free(G.level.layout, e.x, e.y, e.r));
    D.spawn('crawler');
    D.killAll();
    const killed = G.enemies.every(e => e.dead);
    const blocked = ['start', 'hidden', 'checkpoint', 'quit', 'levelup'].every(reason =>
      G.saveCheckpoint(false, reason) === false);
    const untouched = before === stored();
    const manual = G.saveCheckpoint(false, 'manual');
    const saved = N.readSave().player.snapshot.shipType === 'talon' &&
      G.player.progression.offensive[0].id === 'rail_lance' &&
      G.player.progression.defensive.id === 'aegis_projector' &&
      G.player.progression.passives.reinforced_hull === 1 && G.pendingLevelUps === 0;
    let invalid = false;
    try { D.setup({ sector: -1 }); } catch { invalid = true; }
    const run = G.run;
    const originalActive = N.Coop.isActive;
    const refused = [];
    N.Coop.isActive = () => true;
    for (const command of [() => D.setup(), () => D.spawn('dart'),
      () => D.invulnerable(false), () => D.killAll()]) {
      try { command(); refused.push(false); } catch { refused.push(true); }
    }
    N.Coop.isActive = originalActive;
    for (const role of ['host', 'guest']) {
      N.Net.role = role;
      try { D.setup(); refused.push(false); } catch { refused.push(true); }
    }
    N.Net.role = 'solo';
    const sameRun = run === G.run;
    G.pendingLevelUps = 0;
    G.resumeGame();
    const resumed = G.mode === 'playing';
    window.dispatchEvent(new Event('blur'));
    const focusPaused = G.mode === 'paused';
    window.dispatchEvent(new Event('focus'));
    const focusStayedPaused = G.mode === 'paused';
    G.resumeGame();
    G.newRun();
    const normalSave = G.saveCheckpoint(true, 'hidden');
    return { setup, immune, spawned, killed, blocked, untouched, manual, saved,
      invalid, refused, sameRun, resumed, released, focusPaused, focusStayedPaused, normalSave };
  });
  expect(result).toEqual({ setup: ['talon', '#ffd166', 5, 3, 3, 'paused'],
    immune: true, spawned: true, killed: true, blocked: true, untouched: true,
    manual: true, saved: true, invalid: true, refused: [true, true, true, true, true, true],
    sameRun: true, resumed: true, released: true, focusPaused: true,
    focusStayedPaused: true, normalSave: true });
  expect(errors).toEqual([]);
});

test('a release version cannot install the source commands', async ({ page }) => {
  await page.route('**/js/util.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      "N.RELEASE_VERSION = 'development';", "N.RELEASE_VERSION = '2026.11.01.0001';") });
  });
  await page.goto('/');
  expect(await page.evaluate(() => typeof window.NEON.Dev)).toBe('undefined');
});
