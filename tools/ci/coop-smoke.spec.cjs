const { test, expect } = require('@playwright/test');
const { expectRevival } = require('./coop-revival.cjs');

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

async function watchChannels(context) {
  await context.addInitScript(() => {
    const Native = window.RTCPeerConnection;
    function Wrapped(config) {
      const connection = new Native(config);
      const original = connection.createDataChannel.bind(connection);
      connection.createDataChannel = function () {
        const channel = original.apply(connection, arguments);
        window.__coopChannels = window.__coopChannels || [];
        window.__coopChannels.push(channel);
        return channel;
      };
      connection.addEventListener('datachannel', event => {
        window.__coopChannels = window.__coopChannels || [];
        window.__coopChannels.push(event.channel);
      });
      return connection;
    }
    Wrapped.prototype = Native.prototype;
    window.RTCPeerConnection = Wrapped;
  });
}

async function fillRoomCode(page, code) {
  await page.bringToFront();
  const input = page.locator('#coop-code-input');
  await input.click();
  // Firefox can drop locator.fill on a page that was just opened behind another
  // tab. Set the same input the join button reads, then require it to stick.
  await input.evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, code);
  await expect(input).toHaveValue(code);
}

async function startCoopRun(browser, delayInitialPause = false, skill = 'medium', savedShips = false) {
  const hostContext = trackContext(await browser.newContext());
  const host = await hostContext.newPage();
  const errors = [];
  watchPage(host, 'host', errors);

  await host.goto('/');
  await host.locator('#btn-boot').click();
  if (delayInitialPause) await host.evaluate(() => {
    const net=window.NEON.Net, receive=net.onMessage;
    let delayed=false;
    net.onMessage=(message,clientId)=>{
      if (!delayed&&message.t==='global_pause') {
        delayed=true;
        setTimeout(()=>receive(message,clientId),500);
      } else {receive(message,clientId);}
    };
  });
  if(savedShips) await host.evaluate(()=>{
    const N=window.NEON,G=N.Game;
    G.newRun();G.pauseGame();G.run.level=5;G.player.level=4;G.player.xpNext=G.xpForLevel(4);
    G.player.weapons[0].level=4;
    const result=N.Loadouts.save('Coop veteran');if(!result.ok)throw Error(result.error);
    G.completeToMenu();
  });
  await host.locator('#btn-coop').click();
  await host.evaluate(id => { window.NEON.Game.settings.skill = id; }, skill);
  await host.locator('#btn-coop-host').click();
  await expect.poll(() => host.evaluate(() => window.NEON.Net.code || ''), { timeout: ROOM_SETUP_TIMEOUT }).not.toBe('');
  const code = await host.evaluate(() => window.NEON.Net.code);

  // Open the guest only after the host has a code. Creating it earlier leaves
  // the host in the background, and Firefox may not apply a later peer message
  // until that page is in front again.
  const guestContext = trackContext(await browser.newContext());
  const guest = await guestContext.newPage();
  watchPage(guest, 'guest', errors);

  await guest.goto('/');
  await guest.locator('#btn-boot').click();
  if(savedShips) await guest.evaluate(()=>{
    const N=window.NEON,G=N.Game;
    G.newRun();G.pauseGame();G.run.level=5;G.player.level=4;G.player.xpNext=G.xpForLevel(4);
    G.player.weapons[0].level=4;
    const result=N.Loadouts.save('Coop veteran');if(!result.ok)throw Error(result.error);
    G.completeToMenu();
  });
  await guest.locator('#btn-coop').click();
  await expect(guest.locator('#btn-coop-join')).toBeEnabled();
  await fillRoomCode(guest, code);
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

      // A live negotiation needs its full setup budget. Restarting every three
      // seconds can abort healthy Firefox ICE gathering and create real errors.
      const down = (status) => status.state === 'idle' || status.state === 'error' || status.state === 'closed';
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
  if(savedShips){
    await host.locator('#coop-allow-loadouts').click();
    for(const page of [host,guest]){
      await expect(page.locator('#coop-loadouts').getByRole('button',{name:'Coop veteran',exact:false})).toBeEnabled();
      await page.locator('#coop-loadouts').getByRole('button',{name:'Coop veteran',exact:false}).click();
    }
    await expect.poll(()=>host.evaluate(()=>window.NEON.Coop.lobby.sectorCap)).toBe(5);
    await host.evaluate(()=>window.NEON.Net.sendControl({t:'lobby_sector',sector:4}));
    await expect.poll(()=>guest.evaluate(()=>window.NEON.Coop.lobby.startSector)).toBe(4);
    await expect(guest.locator('#coop-members')).toContainText('Coop veteran LV 4');
  }
  await expect(host.locator('#coop-skills [aria-pressed="true"]')).toHaveText(skill.toUpperCase());
  await expect(guest.locator('#coop-skills [aria-pressed="true"]')).toHaveText(skill.toUpperCase());
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
    // Neither peer may invoke the source console surface in a live co-op world.
    for (const page of [host, guest]) {
      expect(await page.evaluate(() => {
        const N = window.NEON, G = N.Game, run = G.run, player = G.player;
        const count = G.enemies.length, mode = G.mode;
        let refused = 0;
        for (const command of [() => N.Dev.setup(), () => N.Dev.spawn('dart'),
          () => N.Dev.invulnerable(true), () => N.Dev.killAll()]) {
          try { command(); } catch { refused++; }
        }
        return refused === 4 && G.run === run && G.player === player &&
          G.enemies.length === count && G.mode === mode;
      })).toBe(true);
    }
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

test('session survives a brief direct-link drop inside the grace window', async ({ browser }) => {
  test.setTimeout(120000);

  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  const errors = [];
  host.on('pageerror', error => errors.push('host pageerror: ' + error.message));
  host.on('console', message => {
    if (message.type() === 'error') errors.push('host console: ' + message.text());
  });

  let guestContext = null;
  let guest = null;
  try {
    await host.goto('/');
    await host.locator('#btn-boot').click();
    await host.locator('#btn-coop').click();
    await host.locator('#btn-coop-host').click();
    await expect.poll(() => host.evaluate(() => window.NEON.Net.code || ''), { timeout: ROOM_SETUP_TIMEOUT }).not.toBe('');
    const code = await host.evaluate(() => window.NEON.Net.code);

    // Open the guest after the host has a code. An earlier guest page leaves
    // Firefox's host tab in the background, where the peer message may not apply.
    guestContext = await browser.newContext();
    await watchChannels(guestContext);
    guest = await guestContext.newPage();
    guest.on('pageerror', error => errors.push('guest pageerror: ' + error.message));
    guest.on('console', message => {
      if (message.type() === 'error') errors.push('guest console: ' + message.text());
    });
    await guest.goto('/');
    await guest.locator('#btn-boot').click();
    await guest.locator('#btn-coop').click();
    await fillRoomCode(guest, code);
    await guest.locator('#btn-coop-join').click();

    await expect.poll(async () => {
      const linked = await host.evaluate(() => !!(window.NEON.Net.peer));
      if (!linked) await host.bringToFront();
      return linked;
    }, { timeout: ROOM_SETUP_TIMEOUT, intervals: [100, 250, 500] }).toBe(true);
    await expect.poll(async () => {
      const linked = await guest.evaluate(() => !!(window.NEON.Net.peer));
      if (!linked) await guest.bringToFront();
      return linked;
    }, { timeout: ROOM_SETUP_TIMEOUT, intervals: [100, 250, 500] }).toBe(true);

    await expect(host.locator('#btn-coop-start')).toBeVisible({ timeout: ROOM_SETUP_TIMEOUT });
    await host.locator('#btn-coop-start').click();
  await guest.locator('#btn-coop-start').click();
    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: ROOM_SETUP_TIMEOUT }).toBe('playing');
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: ROOM_SETUP_TIMEOUT }).toBe('playing');

    expect(await host.evaluate(() => window.NEON.Coop.active)).toBe(true);
    expect(await guest.evaluate(() => window.NEON.Coop.active)).toBe(true);

    const recoveryDeadline = Date.now() + 8000;
    const closed = await guest.evaluate(() => {
      const channel = (window.__coopChannels || []).find(item => item.readyState === 'open');
      if (!channel) return false;
      channel.close();
      return true;
    });
    expect(closed).toBe(true);

    await expect.poll(
      () => guest.evaluate(() => !!window.NEON.Net.peer),
      { timeout: 3000, intervals: [50, 100, 200] }
    ).toBe(false);

    await expect.poll(
      () => guest.evaluate(() => window.NEON.Net.state),
      { timeout: 5000, intervals: [100, 200, 300] }
    ).toMatch(/reconnecting|connecting|connected|waiting/);

    // Allow recovery within the host's 10s grace instead of assuming Firefox's
    // negotiation always finishes at the same fixed delay under parallel load.
    await expect.poll(async () => Promise.all([
      host.evaluate(() => window.NEON.Coop.active && !!window.NEON.Net.peer),
      guest.evaluate(() => window.NEON.Coop.active && !!window.NEON.Net.peer)
    ]), {
      timeout: Math.max(1, recoveryDeadline - Date.now()),
      intervals: [100, 250, 500]
    }).toEqual([true, true]);

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

test('guest focus loss uses the shared pause', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await startCoopRun(browser);
  const { host, guest, errors } = ctx;
  try {
    await guest.evaluate(() => window.dispatchEvent(new Event('blur')));
    await host.bringToFront();
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('paused');
    await expect.poll(() => host.evaluate(() => window.NEON.Game.mode), { timeout: 8000 }).toBe('paused');
    expect(await guest.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
    expect(await host.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
    expect(errors).toEqual([]);
  } finally {
    await closeAll(ctx);
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

test('pause and ready are retried after a direct-link outage', async ({ browser }) => {
  test.setTimeout(120000);
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guestContext = await browser.newContext();
  await watchChannels(guestContext);
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
    await fillRoomCode(guest, code);
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
      const channel = (window.__coopChannels || []).filter(item => item.readyState === 'open').pop();
      if (!channel) return false;
      channel.close();
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
      net.onMessage = function (message, clientId) {
        if (message && message.t === 'global_resume') return;
        if (typeof previous === 'function') {return previous(message, clientId);}
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
    await expect(guest.locator('#pause-micro')).toHaveText('WAITING FOR HOST CONFIRMATION');

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
  let last = null;
  try {
    await expect.poll(async () => {
      const [hostState, guestState] = await Promise.all([
        host.evaluate(() => ({ peer: window.NEON.Net.peerId, state: window.NEON.Net.state })),
        guest.evaluate(() => ({ id: window.NEON.Net.clientId, active: window.NEON.Coop.active,
          state: window.NEON.Net.state, role: window.NEON.Net.role, phase: window.NEON.Coop.lobby?.phase,
          detail: window.NEON.Coop.status?.detail, mode: window.NEON.Game.mode,
          code: document.querySelector('#coop-code-input')?.value || '',
          status: document.querySelector('#coop-status')?.textContent || '' }))
      ]);
      const hostLinked = hostState.peer === guestState.id;
      // Background browser pages may defer applying peer/setup messages in CI.
      // Use the same foreground handling and budget as the initial room setup.
      if (!hostLinked) await host.bringToFront();
      else if (!guestState.active) await guest.bringToFront();
      last = { hostLinked, guestActive: guestState.active,
        hostState: hostState.state, guestState: guestState.state,
        role: guestState.role, phase: guestState.phase, detail: guestState.detail,
        mode: guestState.mode, code: guestState.code, status: guestState.status };
      return last;
    }, { timeout: ROOM_SETUP_TIMEOUT, intervals: [100, 250, 500] })
      .toMatchObject({ hostLinked: true, guestActive: true });
  } catch (error) {
    throw new Error('Guest setup did not finish: ' + JSON.stringify(last) + '\n' + error.message);
  }
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
  test.setTimeout(120000);
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
  const revivalStarted = await host.evaluate(() => window.NEON.Game.level.elapsed);
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
  await expectRevival(host, guest, revivalStarted);
  await expect.poll(() => host.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
  const restored = await guest.evaluate(() => ({x:window.NEON.Game.player.x,y:window.NEON.Game.player.y,
    hp:window.NEON.Game.player.hp,max:window.NEON.Game.player.stats.maxHp,invuln:window.NEON.Game.player.invuln,
    storage:window.NEON.Rewards.state().pending.length,weapon:window.NEON.Game.player.weapons[0].id,
    level:window.NEON.Game.player.weapons[0].level,pool:window.NEON.Coop.remainingRespawns}));
  expect(restored).toMatchObject({...before,level:3,storage:0,pool:3});
  expect(restored.hp).toBe(restored.max);
  expect(restored.invuln).toBe(3);
  expect(await guest.evaluate(()=>window.NEON.PlayerStats.match.itemsLost)).toBe(1);
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
    window.NEON.Game.spawnBullet({damage:1,speed:0,life:10});
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
  await fillRoomCode(guest, code);
  await guest.locator('#btn-coop-join').click();
  await waitForGuestSetup(host, guest);
  expect(await guest.evaluate(() => window.NEON.Net.clientId)).toBe(id);
  expect(await guest.evaluate(() => window.NEON.Game.player.hp)).toBe(37);
  expect(await guest.evaluate(()=>window.NEON.PlayerStats.match.shotsFired)).toBe(1);
  expect(await guest.evaluate(()=>window.NEON.Profile.current().stats.shotsFired)).toBe(1);
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


test('028 locked roster preserves a dead returning guest and admits a fresh replacement between runs', async ({browser}) => {
  test.setTimeout(150000);
  const {host,guest,code,errors}=await startCoopRun(browser);
  await quietWorld(host);
  await host.evaluate(() => {window.NEON.Coop.remainingRespawns=0;});
  const originalId=await guest.evaluate(() => {
    window.NEON.Game.player.weapons[0].level=4;
    window.NEON.Game.gameOver();
    return window.NEON.Net.clientId;
  });
  await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers[0].dead)).toBe(true);
  await guest.evaluate(() => window.NEON.Coop.leaveToMenu());
  await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers.length)).toBe(0);
  expect(await host.evaluate(() => window.NEON.Net.code)).toBe(code);
  await guest.locator('#btn-coop').click();
  await fillRoomCode(guest, code);
  await guest.locator('#btn-coop-join').click();
  await waitForGuestSetup(host, guest);
  expect(await guest.evaluate(() => window.NEON.Net.clientId)).toBe(originalId);
  expect(await guest.evaluate(() => window.NEON.Game.player.dead)).toBe(true);
  expect(await guest.evaluate(() => window.NEON.Game.player.weapons[0].level)).toBe(4);
  expect(await host.evaluate(() => window.NEON.Coop.remainingRespawns)).toBe(0);
  await readyPair(host,guest);
  expect(await guest.evaluate(() => window.NEON.Game.player.dead)).toBe(true);
  await host.evaluate(()=>window.NEON.Game.gameOver());
  await expect.poll(()=>host.evaluate(()=>window.NEON.Coop.active),{timeout:15000}).toBe(false);
  await guest.evaluate(() => window.NEON.Coop.leaveToMenu());
  const replacementContext=trackContext(await browser.newContext());
  const replacement=await replacementContext.newPage();
  watchPage(replacement,'replacement',errors);
  await replacement.goto('/');
  await replacement.locator('#btn-boot').click();
  await replacement.locator('#btn-coop').click();
  await fillRoomCode(replacement, code);
  await replacement.locator('#btn-coop-join').click();
  await expect.poll(()=>host.evaluate(()=>window.NEON.Coop.lobby.members.length),{timeout:30000}).toBe(2);
  await host.locator('#btn-coop-start').click();
  await replacement.locator('#btn-coop-start').click();
  await expect.poll(()=>replacement.evaluate(()=>window.NEON.Game.mode),{timeout:30000}).toBe('playing');
  expect(await replacement.evaluate(() => window.NEON.Game.player.weapons[0].level)).toBe(1);
  expect(await replacement.evaluate(()=>window.NEON.PlayerStats.match.shipsDestroyed)).toBe(0);
  expect(await host.evaluate(() => window.NEON.Coop.remainingRespawns)).toBe(4);
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


test('028 a lone host locks its roster, admits guests between runs, and preserves completion on departure', async ({browser}) => {
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
  await fillRoomCode(guest, code);
  await guest.locator('#btn-coop-join').click();
  await expect(guest.locator('#coop-status')).toContainText('ROSTER LOCKED');
  expect(await host.evaluate(()=>window.NEON.Coop.remotePlayers.length)).toBe(0);
  await host.evaluate(()=>window.NEON.Coop.finishRun());
  await expect.poll(()=>host.evaluate(()=>window.NEON.Coop.lobby.phase)).toBe('lobby');
  await fillRoomCode(guest, code);
  await guest.locator('#btn-coop-join').click();
  await expect.poll(()=>host.evaluate(()=>window.NEON.Coop.lobby.members.length),{timeout:30000}).toBe(2);
  await host.locator('#btn-coop-start').click();
  await guest.locator('#btn-coop-start').click();
  await expect.poll(()=>guest.evaluate(()=>window.NEON.Game.mode),{timeout:30000}).toBe('playing');
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


test('014 launch tolerates setup acknowledgment before the host pause notification', async ({browser}) => {
  const {host,guest,errors}=await startCoopRun(browser,true);
  expect(await host.evaluate(()=>window.NEON.Game.mode)).toBe('playing');
  expect(await guest.evaluate(()=>window.NEON.Game.mode)).toBe('playing');
  expect(errors).toEqual([]);
});

test('sample config keeps CO-OP UPLINK visible and disabled while solo play works', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('http://127.0.0.1:4174/');
  await page.locator('#btn-boot').click();
  await expect(page.locator('#screen-menu')).toHaveClass(/active/);
  await expect(page.locator('#btn-coop')).toBeVisible();
  await expect(page.locator('#btn-coop')).toBeDisabled();
  await expect(page.locator('#coop-unavailable')).toContainText('Co-op is unavailable until the site admin enables it.');
  await expect(page.locator('#btn-new-run')).toBeEnabled();
  await page.locator('#btn-new-run').click();
  await expect(page.locator('#screen-ship')).toHaveClass(/active/);
  const fill = await page.evaluate(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    let painted = 0;
    const colors = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const px = Math.min(canvas.width - 1, Math.floor((x + 0.5) * canvas.width / 8));
        const py = Math.min(canvas.height - 1, Math.floor((y + 0.5) * canvas.height / 8));
        const data = ctx.getImageData(px, py, 1, 1).data;
        colors.push(data[0] + ',' + data[1] + ',' + data[2]);
        if (data[0] + data[1] + data[2] > 0) painted += 1;
      }
    }
    return { width: canvas.width, height: canvas.height, painted, distinct: new Set(colors).size };
  });
  expect(fill.width).toBe(1280);
  expect(fill.height).toBe(720);
  expect(fill.painted).toBeGreaterThanOrEqual(48);
  expect(fill.distinct).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test('a direct link that never opens stays on the co-op screen', async ({ browser }) => {
  test.setTimeout(60000);
  const script = () => {
    function FakePeer() { this.localDescription = null; this.connectionState = 'new'; }
    FakePeer.prototype.createDataChannel = function () {
      return { readyState: 'connecting', send() {}, close() {} };
    };
    FakePeer.prototype.createOffer = function () { return Promise.resolve({ type: 'offer', sdp: 'v=0\r\n' }); };
    FakePeer.prototype.createAnswer = function () { return Promise.resolve({ type: 'answer', sdp: 'v=0\r\n' }); };
    FakePeer.prototype.setLocalDescription = function (description) {
      this.localDescription = description;
      if (typeof this.onicecandidate === 'function') this.onicecandidate({ candidate: null });
      return Promise.resolve();
    };
    FakePeer.prototype.setRemoteDescription = function (description) {
      this.remoteDescription = description;
      return Promise.resolve();
    };
    FakePeer.prototype.addIceCandidate = function () { return Promise.resolve(); };
    FakePeer.prototype.close = function () {};
    window.RTCPeerConnection = FakePeer;
  };
  const hostContext = trackContext(await browser.newContext());
  await hostContext.addInitScript(script);
  const host = await hostContext.newPage();
  const guestContext = trackContext(await browser.newContext());
  await guestContext.addInitScript(script);
  const guest = await guestContext.newPage();
  const bodies = [];
  for (const page of [host, guest]) {
    page.on('response', async response => {
      if (!response.url().includes('coop.php')) return;
      try { bodies.push(await response.json()); } catch (error) { bodies.push(null); }
    });
  }
  await host.goto('/');
  await host.locator('#btn-boot').click();
  await host.locator('#btn-coop').click();
  await host.locator('#btn-coop-host').click();
  await expect.poll(() => host.evaluate(() => window.NEON.Net.code || '')).not.toBe('');
  const code = await host.evaluate(() => window.NEON.Net.code);
  await guest.goto('/');
  await guest.locator('#btn-boot').click();
  await guest.locator('#btn-coop').click();
  await fillRoomCode(guest, code);
  await guest.locator('#btn-coop-join').click();
  await guest.waitForTimeout(2500);
  await expect(host.locator('#screen-coop')).toHaveClass(/active/);
  await expect(guest.locator('#screen-coop')).toHaveClass(/active/);
  expect(await host.evaluate(() => window.NEON.Game.mode)).not.toBe('playing');
  expect(await guest.evaluate(() => window.NEON.Net.state)).toBe('connecting');
  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies) {
    expect(body).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain('global_pause');
    expect(JSON.stringify(body)).not.toContain('playerBullets');
  }
});


for (const victimRole of ['host','guest']) {
  test('023 hardcore '+victimRole+' death stays permanent across sectors and ends on team wipe', async ({browser}) => {
    test.setTimeout(90000);
    const {host,guest,errors}=await startCoopRun(browser,false,'hardcore');
    const victim=victimRole==='host'?host:guest;
    const survivor=victimRole==='host'?guest:host;
    await quietWorld(host);
    for(const page of [host,guest]){
      expect(await page.evaluate(()=>window.NEON.Game.run.skill)).toBe('hardcore');
      expect(await page.evaluate(()=>window.NEON.Coop.remainingRespawns)).toBe(0);
    }
    await victim.evaluate(()=>window.NEON.Game.gameOver());
    await expect.poll(()=>survivor.evaluate(()=>window.NEON.Coop.remotePlayers[0].dead)).toBe(true);
    await host.evaluate(()=>{
      const C=window.NEON.Coop;
      // Even a stale positive pool must not revive a Hardcore pilot.
      C.remainingRespawns=4;C.tickLives(10);
    });
    expect(await victim.evaluate(()=>window.NEON.Game.player.dead)).toBe(true);
    await host.evaluate(()=>window.NEON.Game.completeLevel('timer'));
    await expect.poll(()=>guest.evaluate(()=>window.NEON.Game.mode)).toBe('complete');
    await host.locator('#btn-advance').click();
    await expect.poll(()=>guest.evaluate(()=>window.NEON.Game.level.number)).toBe(2);
    expect(await victim.evaluate(()=>window.NEON.Game.player.dead)).toBe(true);
    await expect.poll(()=>survivor.evaluate(()=>window.NEON.Coop.remotePlayers[0].dead)).toBe(true);
    expect(await host.evaluate(()=>window.NEON.Coop.remainingRespawns)).toBe(0);
    await survivor.evaluate(()=>window.NEON.Game.gameOver());
    await expect.poll(()=>host.evaluate(()=>window.NEON.Coop.active)).toBe(false);
    await expect.poll(()=>guest.evaluate(()=>window.NEON.Coop.active)).toBe(false);
    expect(errors).toEqual([]);
  });
}

test('023 old wire versions fail closed with an update message', async ({browser}) => {
  test.setTimeout(90000);
  const {host,guest}=await startCoopRun(browser);
  await guest.evaluate(()=>{
    const W=window.NEON.Wire,encode=W.encode;
    W.encode=message=>{
      const data=encode(message);
      if(data){new Uint8Array(data)[0]=5;}
      return data;
    };
    window.NEON.Coop.sendState(true);
  });
  await expect.poll(()=>host.evaluate(()=>window.NEON.Net.state)).toBe('error');
  expect(await host.evaluate(()=>window.NEON.Coop.active)).toBe(false);
  await expect(host.locator('#coop-status')).toContainText('UPDATE ALL CLIENTS');
});


test('024 co-op host consents to saved pilots and both start at the approved sector',async({browser})=>{
  test.setTimeout(90000);
  const {host,guest,errors}=await startCoopRun(browser,false,'medium',true);
  for(const page of [host,guest]){
    const result=await page.evaluate(()=>{
      const G=window.NEON.Game;
      return [G.run.level,G.player.level,G.player.weapons[0].level,G.run.highestSector];
    });
    expect(result).toEqual([4,4,4,5]);
  }
  expect(errors).toEqual([]);
});


test('025 guest shot credit is confirmed once and final boards use both client rows',async({browser},info)=>{
  test.setTimeout(90000);
  const {host,guest,errors}=await startCoopRun(browser);
  await quietWorld(host);
  await host.evaluate(()=>{
    const N=window.NEON,G=N.Game,own=G.player,mirror=N.Coop.guestMirror();
    mirror.invuln=0;
    try{G.player=mirror;G.damagePlayer(1,mirror.x,mirror.y);}finally{G.player=own;}
  });
  expect(await host.evaluate(()=>window.NEON.PlayerStats.match.hitsTaken)).toBe(0);
  await guest.evaluate(()=>window.__coopFire());
  await expect.poll(()=>host.evaluate(()=>{
    const G=window.NEON.Game,C=window.NEON.Coop;
    return G.playerBullets.filter(b=>b.coopPlayer===C.guestMirror()).length;
  })).toBeGreaterThan(0);
  await host.evaluate(()=>{
    const N=window.NEON,G=N.Game,p=N.Coop.guestMirror();
    const bullet=G.playerBullets.find(b=>b.coopPlayer===p);
    const e=G.spawnEnemy(N.ENEMY_BY_ID.dart,p.x+100,p.y);e.hp=1;e.shield=0;
    G.damageEnemy(e,10,{player:p,shot:bullet.tallyShot});
    G.damageEnemy(e,10,{player:p,shot:bullet.tallyShot});
    const a=G.level.anchors[0];a.hp=1;
    G.damageAnchor(a,10,{player:p,shot:bullet.tallyShot});
    N.PlayerStats.sendRow(true);
  });
  await expect.poll(()=>guest.evaluate(()=>window.NEON.PlayerStats.match.shipsDestroyed)).toBe(1);
  await expect.poll(()=>guest.evaluate(()=>window.NEON.PlayerStats.match.objectivesDestroyed)).toBe(1);
  expect(await guest.evaluate(()=>window.NEON.PlayerStats.match.shotsFired)).toBe(2);
  expect(await guest.evaluate(()=>window.NEON.PlayerStats.match.shotsHit)).toBe(1);
  expect(await host.evaluate(()=>window.NEON.PlayerStats.match.shipsDestroyed)).toBe(0);
  await host.evaluate(()=>{for(let i=0;i<3;i++)window.NEON.PlayerStats.sendRow(true);});
  await guest.evaluate(()=>window.NEON.PlayerStats.sendRow(true));
  await expect.poll(()=>host.evaluate(()=>window.NEON.PlayerStats.remote.row.shipsDestroyed)).toBe(1);
  expect(await guest.evaluate(()=>window.NEON.PlayerStats.match.shipsDestroyed)).toBe(1);
  await host.evaluate(()=>window.NEON.Game.completeLevel('timer'));
  await expect.poll(()=>guest.evaluate(()=>window.NEON.Game.mode)).toBe('complete');
  await host.locator('#btn-advance').click();
  await expect.poll(()=>guest.evaluate(()=>window.NEON.Game.level.number)).toBe(2);
  await expect.poll(()=>guest.evaluate(()=>window.NEON.Game.mode)).toBe('playing');
  await host.evaluate(()=>window.NEON.PlayerStats.sendRow(true));
  expect(await guest.evaluate(()=>window.NEON.PlayerStats.match.shipsDestroyed)).toBe(1);
  await host.evaluate(()=>{window.NEON.Coop.remainingRespawns=0;window.NEON.Game.gameOver();});
  await guest.evaluate(()=>window.NEON.Game.gameOver());
  await expect.poll(()=>host.evaluate(()=>window.NEON.Coop.active)).toBe(false);
  await expect.poll(()=>guest.evaluate(()=>window.NEON.Coop.active)).toBe(false);
  for(const page of [host,guest]){
    await expect(page.locator('#coop-last-stats .tally-table')).toBeVisible();
    const rows=await page.evaluate(()=>window.NEON.PlayerStats.lastBoard.rows.map(p=>({name:p.name,row:p.row})));
    expect(rows).toHaveLength(2);
    expect(rows[0].row.shipsDestroyed).toBe(0);
    expect(rows[1].row.shipsDestroyed).toBe(1);
    expect(rows[1].row.shotsHit).toBe(1);
    expect(rows[1].row.itemsLost).toBe(0);
  }
  await host.locator('#coop-last-stats').scrollIntoViewIfNeeded();
  await host.screenshot({path:info.outputPath('coop-tally.png')});
  expect(errors).toEqual([]);
});


test('025 disabled guest ignores credits without later backfill and leaving keeps the latest peer row',async({browser})=>{
  test.setTimeout(90000);
  const {host,guest,errors}=await startCoopRun(browser);
  await quietWorld(host);
  await guest.evaluate(()=>{window.NEON.Game.settings.trackStats=false;});
  await host.evaluate(()=>{
    const N=window.NEON;
    N.PlayerStats.credit('shipsDestroyed',N.Coop.guestMirror());N.PlayerStats.sendRow(true);
  });
  await expect.poll(()=>guest.evaluate(()=>window.NEON.PlayerStats.received.shipsDestroyed)).toBe(1);
  expect(await guest.evaluate(()=>window.NEON.PlayerStats.match.shipsDestroyed)).toBe(0);
  await guest.evaluate(()=>{window.NEON.Game.settings.trackStats=true;window.NEON.PlayerStats.sendRow(true);});
  await host.evaluate(()=>window.NEON.PlayerStats.sendRow(true));
  expect(await guest.evaluate(()=>window.NEON.PlayerStats.match.shipsDestroyed)).toBe(0);
  await host.evaluate(()=>{
    const G=window.NEON.Game;
    G.spawnBullet({speed:0,damage:1});window.NEON.PlayerStats.sendRow(true);
  });
  await expect.poll(()=>guest.evaluate(()=>window.NEON.PlayerStats.remote.row.shotsFired)).toBe(1);
  await guest.evaluate(()=>window.NEON.Coop.leaveToMenu());
  await expect(guest.locator('#screen-menu.active')).toBeVisible();
  await expect(guest.locator('#menu-match-tally')).toHaveCount(0);
  const rows=await guest.evaluate(()=>window.NEON.PlayerStats.lastBoard.rows.map(p=>p.row));
  expect(rows).toHaveLength(2);expect(rows[0].shotsFired).toBe(1);expect(rows[1].shipsDestroyed).toBe(0);
  expect(errors).toEqual([]);
});

test('026 host confirms per-style guest kills and discoveries with stats disabled',async({browser})=>{
  test.setTimeout(90000);
  const {host,guest,errors}=await startCoopRun(browser);
  await quietWorld(host);
  await guest.evaluate(()=>{window.NEON.Game.settings.trackStats=false;});
  const before=await guest.evaluate(()=>window.NEON.Profile.current().book.ghost?.kills||0);
  await host.evaluate(()=>{
    const N=window.NEON,G=N.Game;
    G.settings.trackStats=false;
    const enemy=G.spawnEnemy(N.ENEMY_BY_ID.ghost,G.player.x+500,G.player.y);
    enemy.shield=0;enemy.hp=1;
    G.damageEnemy(enemy,10,{player:N.Coop.guestMirror()});
    G.killEnemy(enemy,{player:N.Coop.guestMirror()});
    for(let i=0;i<3;i++)N.Logbook.send(true);
  });
  await expect.poll(()=>guest.evaluate(()=>window.NEON.Profile.current().book.ghost?.kills||0)).toBe(before+1);
  expect(await host.evaluate(()=>window.NEON.Profile.current().book.ghost)).toEqual({seen:true,kills:0});
  expect(await guest.evaluate(()=>window.NEON.PlayerStats.match.shipsDestroyed)).toBe(0);
  await guest.evaluate(()=>{
    const N=window.NEON;
    N.Logbook.flush();N.Profile.reload();
    // Recover the receipt as after reconnecting the same run.
    N.Logbook.receive({book:{ghost:{seen:true,kills:1}}});
    N.Logbook.flush();
  });
  await host.evaluate(()=>window.NEON.Logbook.send(true));
  expect(await guest.evaluate(()=>window.NEON.Profile.current().book.ghost.kills)).toBe(before+1);
  await guest.evaluate(()=>window.NEON.Coop.leaveToMenu());
  await guest.locator('#btn-logbook').click();
  await expect(guest.locator('[data-enemy-style="ghost"]')).toContainText('DESTROYED: '+(before+1));
  expect(errors).toEqual([]);
});

test('a stalled introduction poll lets the next session poll without waiting out the timeout', async ({ browser }) => {
  test.setTimeout(60000);
  const context = trackContext(await browser.newContext());
  const page = await context.newPage();
  const errors = [];
  watchPage(page, 'stall', errors);
  let polls = 0;
  let releaseStall = () => {};
  const stalled = new Promise(resolve => { releaseStall = resolve; });
  await page.route('**/php/coop.php*', async route => {
    const request = route.request();
    const body = request.postData() || '';
    if (request.method() === 'POST' && body.includes('"action":"poll"')) {
      polls += 1;
      if (polls === 1) {
        await stalled;
        try { await route.abort(); } catch (error) { /* Leave already cancelled this request. */ }
        return;
      }
    }
    await route.continue();
  });
  try {
    await page.goto('/');
    await page.locator('#btn-boot').click();
    await page.locator('#btn-coop').click();
    await page.locator('#btn-coop-host').click();
    await expect.poll(() => polls, { timeout: 15000 }).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.NEON.Net.code || '')).not.toBe('');
    const hosted = await page.evaluate(() => {
      window.NEON.Net.leave(true);
      return window.NEON.Net.host({ name: 'RETRY', shipType: 'dart', shipColor: '#00f0ff' });
    });
    expect(hosted).toBe(true);
    await expect.poll(() => polls, { timeout: 3000 }).toBeGreaterThanOrEqual(2);
    const session = await page.evaluate(() => ({
      role: window.NEON.Net.role,
      code: window.NEON.Net.code,
      state: window.NEON.Net.state
    }));
    expect(session.role).toBe('host');
    expect(session.code).not.toBe('');
    expect(session.state).not.toBe('error');
    expect(errors).toEqual([]);
  } finally {
    releaseStall();
  }
});
