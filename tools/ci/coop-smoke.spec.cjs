const { test, expect } = require('@playwright/test');

const ROOM_SETUP_TIMEOUT = 30000;

async function startCoopRun(browser) {
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();

  const errors = [];
  for (const [label, page] of [['host', host], ['guest', guest]]) {
    page.on('pageerror', error => errors.push(label + ' pageerror: ' + error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(label + ' console: ' + message.text());
    });
  }

  await host.goto('/');
  await host.locator('#btn-boot').click();
  await host.locator('#btn-coop').click();
  await host.locator('#btn-coop-host').click();
  await expect.poll(() => host.evaluate(() => window.NEON.Net.code || ''), { timeout: ROOM_SETUP_TIMEOUT }).not.toBe('');
  const code = await host.evaluate(() => window.NEON.Net.code);

  await guest.goto('/');
  await guest.locator('#btn-boot').click();
  await guest.locator('#btn-coop').click();
  await guest.locator('#coop-code-input').fill(code);
  await guest.locator('#btn-coop-join').click();

  await expect.poll(() => host.evaluate(() => !!(window.NEON.Net.peer)), { timeout: ROOM_SETUP_TIMEOUT }).toBe(true);
  await expect.poll(() => guest.evaluate(() => !!(window.NEON.Net.peer)), { timeout: ROOM_SETUP_TIMEOUT }).toBe(true);

  await expect(host.locator('#btn-coop-start')).toBeVisible({ timeout: ROOM_SETUP_TIMEOUT });
  await host.locator('#btn-coop-start').click();

  await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: ROOM_SETUP_TIMEOUT }).toBe('playing');
  await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: ROOM_SETUP_TIMEOUT }).toBe('playing');
  await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers.length), { timeout: ROOM_SETUP_TIMEOUT }).toBeGreaterThan(0);
  await expect.poll(() => guest.evaluate(() => window.NEON.Coop.remotePlayers.length), { timeout: ROOM_SETUP_TIMEOUT }).toBeGreaterThan(0);

  // A second browser context steals OS keyboard focus from the first page, and
  // background tabs throttle input/render loops. Fire through the game API so
  // the tests exercise the same sync path without depending on window focus.
  const installFireHelper = async (page) => {
    await page.evaluate(() => {
      window.__coopFire = function () {
        const G = window.NEON.Game;
        const player = G.player;
        if (!player) return false;
        const weapon = player.weapons[player.activeWeapon];
        if (!weapon) return false;
        G.fireWeapon(weapon);
        return true;
      };
    });
  };
  await installFireHelper(host);
  await installFireHelper(guest);

  return { host, guest, hostContext, guestContext, errors, code };
}

async function closeAll(ctx) {
  try { await ctx.guestContext.close(); } catch (error) { /* ignore */ }
  try { await ctx.hostContext.close(); } catch (error) { /* ignore */ }
}

test('host fires and guest sees the authoritative bullets', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await startCoopRun(browser);
  const { host, guest, errors } = ctx;
  try {
    const guestBefore = await guest.evaluate(() => window.NEON.Game.playerBullets.length);
    await host.evaluate(() => window.__coopFire());
    await expect.poll(
      () => guest.evaluate(() => window.NEON.Game.playerBullets.length),
      { timeout: 8000, intervals: [50, 100, 200] }
    ).toBeGreaterThan(guestBefore);

    const hostBullets = await host.evaluate(() => window.NEON.Game.playerBullets.length);
    expect(hostBullets).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  } finally {
    await closeAll(ctx);
  }
});

test('guest fires and host spawns a bullet owned by the guest mirror', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await startCoopRun(browser);
  const { host, guest, errors } = ctx;
  try {
    const hostBefore = await host.evaluate(() => window.NEON.Game.playerBullets.length);
    await guest.evaluate(() => window.__coopFire());

    await expect.poll(
      () => host.evaluate(() => {
        const mirror = window.NEON.Coop.remotePlayers[0];
        return window.NEON.Game.playerBullets.some(b => b.coopPlayer && b.coopPlayer === mirror);
      }),
      { timeout: 8000, intervals: [50, 100, 200] }
    ).toBe(true);

    const hostAfter = await host.evaluate(() => window.NEON.Game.playerBullets.length);
    expect(hostAfter).toBeGreaterThanOrEqual(hostBefore);

    expect(errors).toEqual([]);
  } finally {
    await closeAll(ctx);
  }
});

test('session survives a brief signaling drop inside the grace window', async ({ browser }) => {
  test.setTimeout(120000);

  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guestContext = await browser.newContext();
  await guestContext.addInitScript(() => {
    const Original = window.WebSocket;
    window.__coopSockets = [];
    const Wrapped = function (...args) {
      const socket = new Original(...args);
      window.__coopSockets.push(socket);
      return socket;
    };
    Wrapped.prototype = Original.prototype;
    for (const key of Object.getOwnPropertyNames(Original)) {
      if (key === 'prototype' || key === 'length' || key === 'name') continue;
      try { Wrapped[key] = Original[key]; } catch (error) { /* ignore */ }
    }
    window.WebSocket = Wrapped;
  });
  const guest = await guestContext.newPage();

  const errors = [];
  for (const [label, page] of [['host', host], ['guest', guest]]) {
    page.on('pageerror', error => errors.push(label + ' pageerror: ' + error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(label + ' console: ' + message.text());
    });
  }

  try {
    await host.goto('/');
    await host.locator('#btn-boot').click();
    await host.locator('#btn-coop').click();
    await host.locator('#btn-coop-host').click();
    await expect.poll(() => host.evaluate(() => window.NEON.Net.code || ''), { timeout: ROOM_SETUP_TIMEOUT }).not.toBe('');
    const code = await host.evaluate(() => window.NEON.Net.code);

    await guest.goto('/');
    await guest.locator('#btn-boot').click();
    await guest.locator('#btn-coop').click();
    await guest.locator('#coop-code-input').fill(code);
    await guest.locator('#btn-coop-join').click();

    await expect.poll(() => host.evaluate(() => !!(window.NEON.Net.peer)), { timeout: ROOM_SETUP_TIMEOUT }).toBe(true);
    await expect.poll(() => guest.evaluate(() => !!(window.NEON.Net.peer)), { timeout: ROOM_SETUP_TIMEOUT }).toBe(true);

    await expect(host.locator('#btn-coop-start')).toBeVisible({ timeout: ROOM_SETUP_TIMEOUT });
    await host.locator('#btn-coop-start').click();
    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: ROOM_SETUP_TIMEOUT }).toBe('playing');
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: ROOM_SETUP_TIMEOUT }).toBe('playing');

    expect(await host.evaluate(() => window.NEON.Coop.active)).toBe(true);
    expect(await guest.evaluate(() => window.NEON.Coop.active)).toBe(true);

    const closed = await guest.evaluate(() => {
      const socket = (window.__coopSockets || []).find(item => String(item.url || '').includes('8787'));
      if (!socket) return false;
      socket.close();
      return true;
    });
    expect(closed).toBe(true);

    await expect.poll(
      () => guest.evaluate(() => window.NEON.Net.state),
      { timeout: 5000, intervals: [100, 200, 300] }
    ).toMatch(/reconnecting|connecting|connected|waiting/);

    // The server delays peer-left by 10s; Net retries after 1.8s. Give the retry
    // time to land, then confirm neither side dropped the session.
    await guest.waitForTimeout(4000);

    expect(await guest.evaluate(() => window.NEON.Coop.active)).toBe(true);
    expect(await host.evaluate(() => window.NEON.Coop.active)).toBe(true);
    expect(await guest.evaluate(() => !!(window.NEON.Net.peer))).toBe(true);
    expect(await host.evaluate(() => !!(window.NEON.Net.peer))).toBe(true);
    expect(await guest.evaluate(() => window.NEON.Net.state)).not.toBe('error');
    expect(await host.evaluate(() => window.NEON.Net.state)).not.toBe('error');

    expect(errors).toEqual([]);
  } finally {
    try { await guestContext.close(); } catch (error) { /* ignore */ }
    try { await hostContext.close(); } catch (error) { /* ignore */ }
  }
});

test('global pause waits for both players to ready up, then counts down and resumes', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await startCoopRun(browser);
  const { host, guest, errors } = ctx;
  try {
    await host.evaluate(() => window.NEON.Game.pauseGame());

    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('paused');
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('paused');
    await expect(host.locator('#screen-pause')).toHaveClass(/active/);
    await expect(guest.locator('#screen-pause')).toHaveClass(/active/);
    await expect(host.locator('#btn-resume')).toHaveText('READY');

    await host.locator('#btn-resume').click();
    await expect(host.locator('#btn-resume')).toHaveText('WAITING FOR PLAYERS');
    expect(await host.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');

    await guest.locator('#btn-resume').click();

    await expect.poll(() => host.evaluate(() => window.NEON.Coop.pauseState), { timeout: 8000 }).toBe('COUNTDOWN');
    await expect.poll(() => guest.evaluate(() => window.NEON.Coop.pauseState), { timeout: 8000 }).toBe('COUNTDOWN');
    await expect(host.locator('#pause-coop-countdown')).toBeVisible();
    await expect(guest.locator('#pause-coop-countdown')).toBeVisible();

    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('playing');
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('playing');
    expect(await host.evaluate(() => window.NEON.Coop.pauseState)).toBe('PLAY');
    expect(await guest.evaluate(() => window.NEON.Coop.pauseState)).toBe('PLAY');

    expect(errors).toEqual([]);
  } finally {
    await closeAll(ctx);
  }
});

test('opening inventory pauses the peer and closing it shows the ready screen', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await startCoopRun(browser);
  const { host, guest, errors } = ctx;
  try {
    await host.evaluate(() => window.NEON.Game.openInventory());

    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('inventory');
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('paused');
    await expect(guest.locator('#screen-pause')).toHaveClass(/active/);
    await expect(guest.locator('#btn-resume')).toHaveText('READY');

    await host.evaluate(() => window.NEON.Game.closeInventory());
    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('paused');
    await expect(host.locator('#screen-pause')).toHaveClass(/active/);
    await expect(host.locator('#btn-resume')).toHaveText('READY');

    await host.locator('#btn-resume').click();
    await expect(host.locator('#btn-resume')).toHaveText('WAITING FOR PLAYERS');
    await guest.locator('#btn-resume').click();

    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 12000 }).toBe('playing');
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 12000 }).toBe('playing');

    expect(errors).toEqual([]);
  } finally {
    await closeAll(ctx);
  }
});

test('opening rewards pauses the peer and closing it shows the ready screen', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await startCoopRun(browser);
  const { host, guest, errors } = ctx;
  try {
    await host.evaluate(() => window.NEON.Game.openRewards());

    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('rewards');
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('paused');
    await expect(guest.locator('#screen-pause')).toHaveClass(/active/);
    await expect(host.locator('#btn-rewards-close')).toHaveText('RETURN TO READY');

    await host.locator('#btn-rewards-close').click();
    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('paused');
    await expect(host.locator('#screen-pause')).toHaveClass(/active/);
    await expect(host.locator('#btn-resume')).toHaveText('READY');
    expect(await host.evaluate(() => window.NEON.Coop._readySent)).toBe(false);

    await host.locator('#btn-resume').click();
    await expect(host.locator('#btn-resume')).toHaveText('WAITING FOR PLAYERS');
    await guest.locator('#btn-resume').click();

    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 12000 }).toBe('playing');
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 12000 }).toBe('playing');

    expect(errors).toEqual([]);
  } finally {
    await closeAll(ctx);
  }
});

test('peer completion summary is shown as text', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await startCoopRun(browser);
  const { host, guest, errors } = ctx;
  const marker = 'coopSummaryMarker';
  const payload = '<img src=x onerror="window.' + marker + '=true">';
  try {
    const direct = await guest.evaluate((kills) => {
      window.coopSummaryMarker = false;
      window.NEON.Coop.onMessage({
        t: 'complete',
        summary: {
          sector: 1,
          reason: 'timer',
          time: 12,
          kills: kills,
          damage: 4,
          level: 2,
          anchors: 1,
          anchorsTotal: 6,
          nextLevel: 2,
          sectors: 1
        }
      });
      const stats = document.getElementById('complete-stats');
      return {
        marker: window.coopSummaryMarker,
        images: stats.querySelectorAll('img').length,
        text: stats.textContent
      };
    }, payload);
    await guest.waitForTimeout(400);
    expect(direct.images).toBe(0);
    expect(direct.text).not.toContain('onerror');
    expect(direct.text).toContain('KILLS');
    expect(await guest.evaluate(() => window.coopSummaryMarker)).toBe(false);

    await host.evaluate((kills) => {
      window.NEON.Net.send({
        t: 'complete',
        summary: {
          sector: 3,
          reason: 'anchors',
          time: 40,
          kills: kills,
          damage: 9,
          level: 4,
          anchors: 0,
          anchorsTotal: 6,
          nextLevel: 4,
          sectors: 2
        }
      });
    }, payload);
    await guest.waitForTimeout(500);
    const transported = await guest.evaluate(() => ({
      marker: window.coopSummaryMarker,
      images: document.querySelectorAll('#complete-stats img').length,
      html: document.getElementById('complete-stats').innerHTML
    }));
    expect(transported.marker).toBe(false);
    expect(transported.images).toBe(0);
    expect(transported.html).not.toContain('<img');

    await host.evaluate(() => window.NEON.Game.completeLevel('anchors'));
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('complete');
    await expect(guest.locator('#complete-title')).toHaveText('SECTOR CLEARED');
    await expect(host.locator('#complete-title')).toHaveText('SECTOR CLEARED');
    await host.locator('#btn-advance').click();
    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('playing');
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('playing');
    expect(errors).toEqual([]);
  } finally {
    await closeAll(ctx);
  }
});

test('pause and ready are retried after a signaling outage', async ({ browser }) => {
  test.setTimeout(120000);
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guestContext = await browser.newContext();
  await guestContext.addInitScript(() => {
    const Original = window.WebSocket;
    window.__coopSockets = [];
    const Wrapped = function (...args) {
      const socket = new Original(...args);
      window.__coopSockets.push(socket);
      return socket;
    };
    Wrapped.prototype = Original.prototype;
    for (const key of Object.getOwnPropertyNames(Original)) {
      if (key === 'prototype' || key === 'length' || key === 'name') continue;
      try { Wrapped[key] = Original[key]; } catch (error) { /* ignore */ }
    }
    window.WebSocket = Wrapped;
  });
  const guest = await guestContext.newPage();
  const errors = [];
  for (const [label, page] of [['host', host], ['guest', guest]]) {
    page.on('pageerror', error => errors.push(label + ' pageerror: ' + error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(label + ' console: ' + message.text());
    });
  }
  try {
    await host.goto('/');
    await host.locator('#btn-boot').click();
    await host.locator('#btn-coop').click();
    await host.locator('#btn-coop-host').click();
    await expect.poll(() => host.evaluate(() => window.NEON.Net.code || ''), { timeout: ROOM_SETUP_TIMEOUT }).not.toBe('');
    const code = await host.evaluate(() => window.NEON.Net.code);
    await guest.goto('/');
    await guest.locator('#btn-boot').click();
    await guest.locator('#btn-coop').click();
    await guest.locator('#coop-code-input').fill(code);
    await guest.locator('#btn-coop-join').click();
    await expect.poll(() => host.evaluate(() => !!(window.NEON.Net.peer)), { timeout: ROOM_SETUP_TIMEOUT }).toBe(true);
    await expect(host.locator('#btn-coop-start')).toBeVisible({ timeout: ROOM_SETUP_TIMEOUT });
    await host.locator('#btn-coop-start').click();
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: ROOM_SETUP_TIMEOUT }).toBe('playing');

    await guest.evaluate(() => {
      const net = window.NEON.Net;
      net.__sendControl = net.sendControl.bind(net);
      net.sendControl = () => false;
    });
    await guest.evaluate(() => window.NEON.Game.pauseGame());
    expect(await guest.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
    expect(await guest.evaluate(() => window.NEON.Coop._pendingPause)).toBe(true);
    expect(await guest.evaluate(() => window.NEON.Game.mode)).toBe('paused');
    await expect(guest.locator('#screen-pause')).toHaveClass(/active/);
    expect(await host.evaluate(() => window.NEON.Game.mode)).toBe('playing');

    const closed = await guest.evaluate(() => {
      const net = window.NEON.Net;
      net.sendControl = net.__sendControl;
      const socket = (window.__coopSockets || []).filter((item) => item.readyState === 1).pop();
      if (!socket) return false;
      socket.close();
      return true;
    });
    expect(closed).toBe(true);
    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 10000 }).toBe('paused');
    await expect.poll(() => guest.evaluate(() => window.NEON.Coop._pendingPause), { timeout: 10000 }).toBe(false);
    await expect(guest.locator('#screen-pause')).toHaveClass(/active/);

    const failedReady = await guest.evaluate(() => {
      const net = window.NEON.Net;
      const original = net.sendControl.bind(net);
      net.sendControl = () => false;
      const accepted = window.NEON.Coop.sendReady();
      const pending = window.NEON.Coop._pendingReady;
      const marked = window.NEON.Coop._readySent;
      net.sendControl = original;
      const retried = window.NEON.Coop.sendReady();
      return { accepted, pending, marked, retried, ready: window.NEON.Coop._readySent };
    });
    expect(failedReady.accepted).toBe(false);
    expect(failedReady.pending).toBe(true);
    expect(failedReady.marked).toBe(false);
    expect(failedReady.retried).toBe(true);
    expect(failedReady.ready).toBe(true);

    await host.locator('#btn-resume').click();
    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 12000 }).toBe('playing');
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 12000 }).toBe('playing');
    expect(errors).toEqual([]);
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});

test('countdown fallback waits for the server before resuming', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await startCoopRun(browser);
  const { host, guest, errors } = ctx;
  try {
    await guest.evaluate(() => {
      const net = window.NEON.Net;
      const previous = net.onMessage;
      net.onMessage = function (message) {
        if (message && message.t === 'global_resume') return;
        if (typeof previous === 'function') return previous(message);
      };
      net.__resumeHandler = previous;
    });

    await host.evaluate(() => window.NEON.Game.pauseGame());
    await expect.poll(() => guest.evaluate(() => window.NEON.Coop.pauseState), { timeout: 8000 }).toBe('PAUSED');
    await expect.poll(() => host.evaluate(() => window.NEON.Coop.pauseState), { timeout: 8000 }).toBe('PAUSED');
    await host.evaluate(() => window.NEON.Coop.sendReady());
    await guest.evaluate(() => window.NEON.Coop.sendReady());
    await expect.poll(() => guest.evaluate(() => window.NEON.Coop.pauseState), { timeout: 8000 }).toBe('COUNTDOWN');

    await guest.waitForTimeout(5500);
    expect(await guest.evaluate(() => window.NEON.Game.mode)).not.toBe('playing');
    expect(await guest.evaluate(() => window.NEON.Coop.pauseState)).toBe('COUNTDOWN');
    await expect(guest.locator('#pause-micro')).toHaveText('WAITING FOR SIGNAL CONFIRMATION');

    await guest.evaluate(() => {
      window.NEON.Net.onMessage = window.NEON.Net.__resumeHandler;
      window.NEON.Coop.requestPauseSync();
    });
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('playing');
    expect(await guest.evaluate(() => window.NEON.Coop.pauseState)).toBe('PLAY');
    expect(await host.evaluate(() => window.NEON.Game.mode)).toBe('playing');
    expect(errors).toEqual([]);
  } finally {
    await closeAll(ctx);
  }
});

test('guest pickups stay until the grant is accepted', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await startCoopRun(browser);
  const { host, guest, errors } = ctx;
  try {
    const modId = await host.evaluate(() => {
      const mod = window.NEON.MODS.find((item) => item.type !== 'curse') || window.NEON.MODS[0];
      return mod.id;
    });

    const blocked = await host.evaluate((itemId) => {
      const net = window.NEON.Net;
      const G = window.NEON.Game;
      const remote = window.NEON.Coop.remotePlayers[0];
      net.__send = net.send.bind(net);
      net.send = (message) => {
        if (message && message.t === 'grant') return false;
        return net.__send(message);
      };
      G.enemies.forEach((enemy) => { enemy.dead = true; });
      G.player.vx = 0;
      G.player.vy = 0;
      G.player.x = remote.x + 2500;
      G.player.y = remote.y + 2500;
      G.groundItems.length = 0;
      G.groundItems.push({
        id: 'grant-blocked',
        kind: 'mod',
        itemId: itemId,
        x: remote.x,
        y: remote.y,
        tier: 1,
        color: '#00f0ff',
        angle: 0,
        phase: 0,
        pickupDelay: 0,
        label: null
      });
      G.updateGroundItems(0.05);
      const item = G.groundItems.find((entry) => entry.id === 'grant-blocked');
      return {
        present: !!item,
        collected: !!(item && item.collected),
        pending: !!(item && item.grantPending),
        grantId: item ? item.grantId : ''
      };
    }, modId);
    expect(blocked.present).toBe(true);
    expect(blocked.collected).toBe(false);
    expect(blocked.pending).toBe(false);
    expect(blocked.grantId).not.toBe('');

    await host.waitForTimeout(700);
    expect(await host.evaluate(() => window.NEON.Game.groundItems.some((entry) => entry.id === 'grant-blocked' && !entry.collected))).toBe(true);
    const before = await guest.evaluate(() => window.NEON.Rewards.state().pending.length);

    await host.evaluate(() => {
      const net = window.NEON.Net;
      net.send = net.__send;
      const item = window.NEON.Game.groundItems.find((entry) => entry.id === 'grant-blocked');
      if (item) item.grantHold = 0;
    });
    await expect.poll(() => host.evaluate(() => window.NEON.Game.groundItems.some((entry) => entry.id === 'grant-blocked')), { timeout: 8000 }).toBe(false);
    await expect.poll(() => guest.evaluate(() => window.NEON.Rewards.state().pending.length), { timeout: 8000 }).toBe(before + 1);

    const duplicated = await guest.evaluate((itemId) => {
      const grants = window.NEON.Coop._acceptedGrants;
      const grantId = Array.from(grants || [])[0];
      const count = window.NEON.Rewards.state().pending.length;
      window.NEON.Coop.applyGrant({
        t: 'grant',
        grantId: grantId,
        item: { id: 'grant-blocked', kind: 'mod', itemId: itemId, tier: 1, color: '#00f0ff' }
      });
      return {
        grantId: grantId || '',
        count: count,
        after: window.NEON.Rewards.state().pending.length
      };
    }, modId);
    expect(duplicated.grantId).not.toBe('');
    expect(duplicated.after).toBe(duplicated.count);

    await guest.evaluate((itemId) => {
      const rewards = window.NEON.Rewards;
      const mod = window.NEON.MOD_BY_ID[itemId];
      const row = { kind: 'mod', itemId: itemId, tier: 1, color: mod.color };
      rewards.state().pending = Array.from({ length: rewards.CAPACITY }, () => Object.assign({}, row));
    }, modId);
    await host.evaluate((itemId) => {
      const G = window.NEON.Game;
      const remote = window.NEON.Coop.remotePlayers[0];
      G.player.x = remote.x + 2500;
      G.player.y = remote.y + 2500;
      G.groundItems.length = 0;
      G.groundItems.push({
        id: 'grant-full',
        kind: 'mod',
        itemId: itemId,
        x: remote.x,
        y: remote.y,
        tier: 1,
        color: '#00f0ff',
        angle: 0,
        phase: 0,
        pickupDelay: 0,
        label: null
      });
      G.updateGroundItems(0.05);
    }, modId);

    await expect.poll(() => guest.evaluate(() => window.NEON.Game.groundItems.some((entry) => entry.id === 'grant-full')), { timeout: 8000 }).toBe(true);
    await host.waitForTimeout(1000);
    const held = await host.evaluate(() => {
      const item = window.NEON.Game.groundItems.find((entry) => entry.id === 'grant-full');
      return { present: !!item && !item.collected, grantId: item ? item.grantId : '' };
    });
    expect(held.present).toBe(true);
    expect(held.grantId).not.toBe('');
    expect(await guest.evaluate(() => window.NEON.Rewards.state().pending.length)).toBe(4);

    await guest.evaluate(() => { window.NEON.Rewards.state().pending.pop(); });
    await host.evaluate(() => {
      const item = window.NEON.Game.groundItems.find((entry) => entry.id === 'grant-full');
      if (item) item.grantHold = 0;
    });
    await expect.poll(() => host.evaluate(() => window.NEON.Game.groundItems.some((entry) => entry.id === 'grant-full')), { timeout: 8000 }).toBe(false);
    await expect.poll(() => guest.evaluate(() => window.NEON.Rewards.state().pending.length), { timeout: 8000 }).toBe(4);
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.groundItems.some((entry) => entry.id === 'grant-full')), { timeout: 8000 }).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await closeAll(ctx);
  }
});
