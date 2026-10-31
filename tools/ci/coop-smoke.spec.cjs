const { test, expect } = require('@playwright/test');

const ROOM_SETUP_TIMEOUT = 30000;
const openContexts = [];

function watchPage(page, label, errors) {
  page.on('pageerror', error => errors.push(label + ' pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(label + ' console: ' + message.text());
  });
}

function trackContext(context) {
  openContexts.push(context);
  return context;
}

async function forceRelay(context) {
  await context.addInitScript(() => {
    window.RTCPeerConnection = class {
      createDataChannel() { return { readyState: 'connecting', close() {} }; }
      createOffer() { return Promise.reject(new Error('Test: direct transport unavailable')); }
      close() {}
    };
  });
}

async function startCoopRun(browser, relay = false, delayInitialPause = false) {
  const hostContext = trackContext(await browser.newContext());
  if (relay) await forceRelay(hostContext);
  const host = await hostContext.newPage();
  const errors = [];
  watchPage(host, 'host', errors);

  await host.goto('/');
  await host.locator('#btn-boot').click();
  if (delayInitialPause) await host.evaluate(() => {
    const net=window.NEON.Net, receive=net.onMessage;
    let delayed=false;
    net.onMessage=message=>{
      if (!delayed&&message.t==='global_pause') {
        delayed=true;
        setTimeout(()=>receive(message),500);
      } else receive(message);
    };
  });
  await host.locator('#btn-coop').click();
  await host.locator('#btn-coop-host').click();
  await expect.poll(() => host.evaluate(() => window.NEON.Net.code || ''), { timeout: ROOM_SETUP_TIMEOUT }).not.toBe('');
  const code = await host.evaluate(() => window.NEON.Net.code);

  // Open the guest only after the host has a code. Creating it earlier leaves
  // the host in the background, and Firefox may not apply a later peer message
  // until that page is in front again.
  const guestContext = trackContext(await browser.newContext());
  if (relay) await forceRelay(guestContext);
  const guest = await guestContext.newPage();
  watchPage(guest, 'guest', errors);

  await guest.goto('/');
  await guest.locator('#btn-boot').click();
  await guest.locator('#btn-coop').click();
  await expect(guest.locator('#btn-coop-join')).toBeEnabled();
  await guest.locator('#coop-code-input').fill(code);
  await guest.locator('#btn-coop-join').click();

  let lastNudge = Date.now();
  let lastStatus = null;
  try {
    await expect.poll(async () => {
      const [hostStatus, guestStatus] = await Promise.all([
        host.evaluate(() => ({ peer: !!window.NEON.Net.peer, state: window.NEON.Net.state })),
        guest.evaluate(() => ({ peer: !!window.NEON.Net.peer, state: window.NEON.Net.state }))
      ]);
      lastStatus = { host: hostStatus, guest: guestStatus };
      if (hostStatus.peer && guestStatus.peer) return true;

      // Foreground whichever page has not applied its peer message yet.
      if (!hostStatus.peer) await host.bringToFront();
      if (!guestStatus.peer) await guest.bringToFront();
      if (Date.now() - lastNudge < 3000) return false;
      lastNudge = Date.now();

      const down = (status) => status.state === 'idle' || status.state === 'error' || status.state === 'closed' || status.state === 'connecting' || status.state === 'reconnecting';
      if (!hostStatus.peer && down(hostStatus)) await host.evaluate(() => window.NEON.Net.reconnect());
      if (!guestStatus.peer && down(guestStatus)) {
        await guest.evaluate((roomCode) => {
          const net = window.NEON.Net;
          if (net.state !== 'idle' && net.state !== 'closed') net.leave(true);
          window.NEON.Coop.joinRoom(roomCode, window.NEON.Ships.selection({}));
        }, code);
      }
      return false;
    }, { timeout: ROOM_SETUP_TIMEOUT, intervals: [100, 250, 500] }).toBe(true);
  } catch (error) {
    throw new Error('Co-op peer link did not open: ' + JSON.stringify(lastStatus) + '\n' + error.message);
  }

  await expect(host.locator('#btn-coop-start')).toBeVisible({ timeout: ROOM_SETUP_TIMEOUT });
  await host.locator('#btn-coop-start').click();
  await guest.locator('#btn-coop-start').click();

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

async function closeContext(context) {
  if (!context) return;
  const index = openContexts.indexOf(context);
  if (index >= 0) openContexts.splice(index, 1);
  try { await context.close(); } catch (error) { /* ignore */ }
}

async function closeAll(ctx) {
  await closeContext(ctx && ctx.guestContext);
  await closeContext(ctx && ctx.hostContext);
}

test.afterEach(async () => {
  while (openContexts.length) await closeContext(openContexts[openContexts.length - 1]);
});

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
  await guest.locator('#btn-coop-start').click();
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
        _run: window.NEON.Coop.runId, _sector: window.NEON.Game.level.number,
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
  await guest.locator('#btn-coop-start').click();
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


async function waitForGuestSetup(host, guest) {
  await expect.poll(async () => {
    const [hostState, guestState] = await Promise.all([
      host.evaluate(() => ({ peer: window.NEON.Net.peerId, state: window.NEON.Net.state })),
      guest.evaluate(() => ({ id: window.NEON.Net.clientId, active: window.NEON.Coop.active,
        state: window.NEON.Net.state, role: window.NEON.Net.role, phase: window.NEON.Coop.lobby?.phase,
        detail: window.NEON.Coop.status?.detail, mode: window.NEON.Game.mode,
        status: document.querySelector('#coop-status')?.textContent || '' }))
    ]);
    const hostLinked = hostState.peer === guestState.id;
    // Background browser pages may defer applying peer/setup messages in CI.
    // Use the same foreground handling and budget as the initial room setup.
    if (!hostLinked) await host.bringToFront();
    else if (!guestState.active) await guest.bringToFront();
    return { hostLinked, guestActive: guestState.active,
      hostState: hostState.state, guestState: guestState.state,
      role: guestState.role, phase: guestState.phase, detail: guestState.detail,
      mode: guestState.mode, status: guestState.status };
  }, { timeout: ROOM_SETUP_TIMEOUT, intervals: [100, 250, 500] })
    .toMatchObject({ hostLinked: true, guestActive: true });
}

async function readyPair(host, guest) {
  await expect.poll(() => host.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
  await expect.poll(() => guest.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
  await host.evaluate(() => window.NEON.Coop.sendReady());
  await guest.evaluate(() => window.NEON.Coop.sendReady());
  await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 10000 }).toBe('playing');
  await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 10000 }).toBe('playing');
}

async function quietWorld(host) {
  await host.evaluate(() => {
    const G = window.NEON.Game;
    G.enemies.length = 0;
    G.enemyBullets.length = 0;
    G.updateSpawning = () => {};
    G.updateAnchors = () => {};
    G.player.invuln = 999;
  });
}

test('014 guest death drops storage once, revives with protection, and preserves the lobby across runs', async ({ browser }) => {
  test.setTimeout(90000);
  const { host, guest, code, errors } = await startCoopRun(browser);
  await quietWorld(host);
  // Random death drops may land within the survivor's normal pickup radius.
  // Keep them on the floor until the drop assertion, then verify collection.
  const pickupRadius = await host.evaluate(() => {
    const player = window.NEON.Game.player;
    const radius = player.stats.pickupRadius;
    player.stats.pickupRadius = 0;
    player.buffs.magnet = 0;
    return radius;
  });
  const before = await guest.evaluate(() => {
    const G = window.NEON.Game;
    G.player.invuln = 999;
    G.player.weapons[0].level = 3;
    window.NEON.Rewards.bank({kind:'mod',itemId:'vector',tier:1});
    const before = {x:G.player.x,y:G.player.y,weapon:G.player.weapons[0].id};
    G.gameOver();
    return before;
  });
  await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers[0].dead)).toBe(true);
  await expect.poll(() => host.evaluate(() => window.NEON.Game.groundItems.filter(i=>i.itemId==='vector').length)).toBe(1);
  await expect.poll(() => guest.evaluate(() => window.NEON.Game.player.dead), {timeout:12000}).toBe(false);
  await expect.poll(() => host.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
  const restored = await guest.evaluate(() => ({x:window.NEON.Game.player.x,y:window.NEON.Game.player.y,
    hp:window.NEON.Game.player.hp,max:window.NEON.Game.player.stats.maxHp,invuln:window.NEON.Game.player.invuln,
    storage:window.NEON.Rewards.state().pending.length,weapon:window.NEON.Game.player.weapons[0].id,
    level:window.NEON.Game.player.weapons[0].level,pool:window.NEON.Coop.remainingRespawns}));
  expect(restored).toMatchObject({...before,level:3,storage:0,pool:3});
  expect(restored.hp).toBe(restored.max);
  expect(restored.invuln).toBe(3);
  await host.evaluate(radius => {
    const G = window.NEON.Game;
    const item = G.groundItems.find(item => item.itemId === 'vector');
    G.player.stats.pickupRadius = radius;
    G.player.x = item.x;
    G.player.y = item.y;
    G.updateGroundItems(0);
  }, pickupRadius);
  expect(await host.evaluate(() => window.NEON.Game.groundItems.filter(item => item.itemId === 'vector').length)).toBe(0);
  expect(await host.evaluate(() => window.NEON.Rewards.state().pending.filter(item => item.itemId === 'vector').length)).toBe(1);
  await readyPair(host,guest);
  // End both lives in the same simulation batch, before any replacement timer.
  await host.evaluate(() => {
    window.NEON.Coop.remotePlayers[0].dead=true;
    window.NEON.Game.gameOver();
    window.NEON.Game.completeLevel('timer');
  });
  await expect(host.locator('#screen-coop')).toHaveClass(/active/);
  await expect(guest.locator('#screen-coop')).toHaveClass(/active/);
  expect(await host.evaluate(() => window.NEON.Net.code)).toBe(code);
  expect(await guest.evaluate(() => window.NEON.Net.code)).toBe(code);
  await host.locator('#btn-coop-stats').click();
  await expect(host.locator('#coop-last-stats')).toContainText('KILLS');
  const runId = await host.evaluate(() => window.NEON.Coop.runId);
  await host.locator('#btn-coop-start').click();
  await guest.locator('#btn-coop-start').click();
  await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), {timeout:15000}).toBe('playing');
  expect(await host.evaluate(() => window.NEON.Coop.runId)).toBe(runId+1);
  expect(await guest.evaluate(() => window.NEON.Game.player.weapons[0].level)).toBe(1);
  expect(errors).toEqual([]);
});

test('014 host death keeps simulation running; sector advancement revives spectators and resets the pool', async ({ browser }) => {
  test.setTimeout(60000);
  const {host,guest,errors}=await startCoopRun(browser);
  await quietWorld(host);
  await host.evaluate(() => {window.NEON.Coop.remainingRespawns=0;window.NEON.Game.gameOver();});
  const elapsed=await host.evaluate(() => window.NEON.Game.level.elapsed);
  await expect.poll(() => host.evaluate(() => window.NEON.Game.level.elapsed)).toBeGreaterThan(elapsed+0.2);
  expect(await host.evaluate(() => window.NEON.Coop.cameraTarget()===window.NEON.Coop.remotePlayers[0])).toBe(true);
  await host.evaluate(() => window.NEON.Game.completeLevel('timer'));
  await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode)).toBe('complete');
  await host.locator('#btn-advance').click();
  await expect.poll(() => guest.evaluate(() => window.NEON.Game.level.number)).toBe(2);
  expect(await host.evaluate(() => window.NEON.Game.player.dead)).toBe(false);
  expect(await host.evaluate(() => window.NEON.Coop.remainingRespawns)).toBe(4);
  expect(await host.evaluate(() => window.NEON.Game.groundItems.length)).toBe(0);
  expect(errors).toEqual([]);
});

test('014 page reload restores participant equipment and health; both players must ready', async ({browser}) => {
  test.setTimeout(90000);
  const {host,guest,code,errors}=await startCoopRun(browser);
  await quietWorld(host);
  await guest.evaluate(() => {
    const send=window.NEON.Net.send;
    window.NEON.Net.send=message=>message.t==='event_ack'?false:send(message);
  });
  await host.evaluate(() => window.NEON.Net.send({t:'xp',amount:7}));
  await expect.poll(() => guest.evaluate(() => window.NEON.Game.player.xp)).toBe(7);
  const id=await guest.evaluate(() => {
    window.NEON.Game.player.hp=37;
    window.NEON.Game.player.invuln=999;
    window.NEON.Game.player.weapons[0].level=4;
    window.NEON.Game.saveCheckpoint();
    return window.NEON.Net.clientId;
  });
  await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers[0].weapons[0].level)).toBe(4);
  await host.evaluate(() => {
    const G=window.NEON.Game;
    G.pauseGame();
    G.spawnEnemyBullet({x:G.player.x+300,y:G.player.y,angle:0,speed:40,size:5,life:20,color:'#ff335c',damage:1});
  });
  await guest.reload();
  await guest.locator('#btn-boot').click();
  await guest.locator('#btn-coop').click();
  await guest.locator('#coop-code-input').fill(code);
  await guest.locator('#btn-coop-join').click();
  await expect.poll(() => guest.evaluate(() => window.NEON.Coop.active)).toBe(true);
  expect(await guest.evaluate(() => window.NEON.Net.clientId)).toBe(id);
  expect(await guest.evaluate(() => window.NEON.Game.player.hp)).toBe(37);
  expect(await guest.evaluate(() => window.NEON.Game.player.xp)).toBe(7);
  await expect.poll(() => guest.evaluate(() => window.NEON.Game.enemyBullets.some(b=>b.life===20))).toBe(true);
  expect(await guest.evaluate(() => window.NEON.Game.player.weapons[0].level)).toBe(4);
  await guest.evaluate(() => window.NEON.Coop.sendReady());
  expect(await host.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
  await host.evaluate(() => window.NEON.Coop.sendReady());
  await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode),{timeout:10000}).toBe('playing');
  expect(await guest.evaluate(() => window.NEON.Game.player.xp)).toBe(7);
  expect(errors).toEqual([]);
});

test('014 lone host starts and death ends the mission despite spare respawns', async ({browser}) => {
  const context=trackContext(await browser.newContext());
  const page=await context.newPage();
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await page.locator('#btn-coop').click();
  await page.locator('#btn-coop-stats').click();
  await expect(page.locator('#coop-last-stats')).toContainText('NO GAMES');
  await page.locator('#btn-coop-host').click();
  await expect(page.locator('#btn-coop-start')).toBeVisible();
  await page.locator('#btn-coop-start').click();
  await expect.poll(() => page.evaluate(() => window.NEON.Game.mode),{timeout:10000}).toBe('playing');
  const code=await page.evaluate(() => window.NEON.Net.code);
  await page.evaluate(() => window.NEON.Game.gameOver());
  await expect(page.locator('#screen-coop')).toHaveClass(/active/);
  expect(await page.evaluate(() => window.NEON.Net.code)).toBe(code);
  expect(await page.evaluate(() => window.NEON.Coop.remainingRespawns)).toBe(4);
});


test('014 relay replacement retains separate records and a dead return does not refill respawns', async ({browser}) => {
  test.setTimeout(150000);
  const {host,guest,code,errors}=await startCoopRun(browser,true);
  await quietWorld(host);
  expect(await guest.evaluate(() => window.NEON.Net.label())).toBe('RELAY');
  await host.evaluate(() => {window.NEON.Coop.remainingRespawns=0;});
  const originalId=await guest.evaluate(() => {
    window.NEON.Game.player.weapons[0].level=4;
    window.NEON.Game.gameOver();
    return window.NEON.Net.clientId;
  });
  await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers[0].dead)).toBe(true);
  await guest.evaluate(() => window.NEON.Coop.leaveToMenu());
  await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers.length)).toBe(0);
  expect(await host.evaluate(() => window.NEON.Game.mode)).toBe('playing');
  const replacementContext=trackContext(await browser.newContext());
  await forceRelay(replacementContext);
  const replacement=await replacementContext.newPage();
  watchPage(replacement,'replacement',errors);
  await replacement.goto('/');
  await replacement.locator('#btn-boot').click();
  await replacement.locator('#btn-coop').click();
  await replacement.locator('#coop-code-input').fill(code);
  await replacement.locator('#btn-coop-join').click();
  await waitForGuestSetup(host, replacement);
  expect(await replacement.evaluate(() => window.NEON.Game.player.weapons[0].level)).toBe(1);
  await readyPair(host,replacement);
  await replacement.evaluate(() => window.NEON.Coop.leaveToMenu());
  await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers.length)).toBe(0);
  await guest.locator('#btn-coop').click();
  await guest.locator('#coop-code-input').fill(code);
  await guest.locator('#btn-coop-join').click();
  await waitForGuestSetup(host, guest);
  expect(await guest.evaluate(() => window.NEON.Net.clientId)).toBe(originalId);
  expect(await guest.evaluate(() => window.NEON.Game.player.dead)).toBe(true);
  expect(await guest.evaluate(() => window.NEON.Game.player.weapons[0].level)).toBe(4);
  expect(await host.evaluate(() => window.NEON.Coop.remainingRespawns)).toBe(0);
  expect(await host.evaluate(() => window.NEON.Coop.records.size)).toBe(2);
  await readyPair(host,guest);
  expect(await guest.evaluate(() => window.NEON.Game.player.dead)).toBe(true);
  expect(errors).toEqual([]);
});

test('014 lobby selections invalidate readiness and controls fit a compact viewport', async ({browser},testInfo) => {
  const context=trackContext(await browser.newContext({viewport:{width:960,height:720}}));
  const page=await context.newPage();
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await page.locator('#btn-coop').click();
  await page.locator('#btn-coop-host').click();
  await expect(page.locator('#btn-coop-start')).toBeVisible();
  await page.locator('#btn-coop-start').click();
  await expect(page.locator('#btn-coop-start')).toContainText('CANCEL');
  await page.locator('#coop-ship-types [data-ship-type="kite"]').click();
  await expect(page.locator('#btn-coop-start')).toHaveText('READY');
  await page.locator('#coop-respawns').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('#coop-respawn-count')).toHaveText('0');
  await page.locator('#btn-coop-stats').click();
  await expect(page.locator('#coop-last-stats')).toContainText('NO GAMES');
  await page.screenshot({path:testInfo.outputPath('lobby.png')});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const priority=await page.evaluate(() => {
    const choose=window.NEON.Coop.chooseRespawn;
    const p=[{level:2,id:1},{level:8,id:2},{level:8,id:3}];
    return [choose(p,()=>0).id,choose(p,()=>0.99).id];
  });
  expect(priority).toEqual([2,3]);
});


test('014 a lone host admits a guest with manual readiness and guest departure preserves sector completion', async ({browser}) => {
  test.setTimeout(60000);
  const hostContext=trackContext(await browser.newContext());
  const host=await hostContext.newPage();
  const errors=[];
  watchPage(host,'host',errors);
  await host.goto('/');
  await host.locator('#btn-boot').click();
  await host.locator('#btn-coop').click();
  await host.locator('#btn-coop-host').click();
  await expect(host.locator('#btn-coop-start')).toBeVisible();
  await host.locator('#btn-coop-start').click();
  await expect.poll(()=>host.evaluate(()=>window.NEON.Game.mode),{timeout:10000}).toBe('playing');
  await quietWorld(host);
  const code=await host.evaluate(()=>window.NEON.Net.code);
  const guestContext=trackContext(await browser.newContext());
  const guest=await guestContext.newPage();
  watchPage(guest,'guest',errors);
  await guest.goto('/');
  await guest.locator('#btn-boot').click();
  await guest.locator('#btn-coop').click();
  await guest.locator('#coop-code-input').fill(code);
  await guest.locator('#btn-coop-join').click();
  await expect.poll(()=>guest.evaluate(()=>window.NEON.Coop.active)).toBe(true);
  await expect.poll(()=>host.evaluate(()=>window.NEON.Coop.pauseState)).toBe('PAUSED');
  await expect(host.locator('#btn-resume')).toHaveText('READY');
  await expect(guest.locator('#btn-resume')).toHaveText('READY');
  await readyPair(host,guest);
  await host.evaluate(()=>window.NEON.Game.completeLevel('timer'));
  await expect.poll(()=>guest.evaluate(()=>window.NEON.Game.mode)).toBe('complete');
  await guest.evaluate(()=>window.NEON.Coop.leaveToMenu());
  await expect.poll(()=>host.evaluate(()=>window.NEON.Coop.remotePlayers.length)).toBe(0);
  expect(await host.evaluate(()=>window.NEON.Game.mode)).toBe('complete');
  await host.locator('#btn-advance').click();
  await expect.poll(()=>host.evaluate(()=>window.NEON.Game.mode)).toBe('playing');
  expect(await host.evaluate(()=>window.NEON.Coop.remainingRespawns)).toBe(4);
  expect(errors).toEqual([]);
});


test('014 launch tolerates setup acknowledgment before the server pause notification', async ({browser}) => {
  const {host,guest,errors}=await startCoopRun(browser,false,true);
  expect(await host.evaluate(()=>window.NEON.Game.mode)).toBe('playing');
  expect(await guest.evaluate(()=>window.NEON.Game.mode)).toBe('playing');
  expect(errors).toEqual([]);
});
