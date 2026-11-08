const { test, expect } = require('@playwright/test');

test('048 public shared rewards recover gaps, resource revisions and offline grants', async ({ browser }) => {
  test.setTimeout(150000);
  const contexts = [], pages = [], errors = [];
  try {
    for (let seat = 0; seat < 2; seat++) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      await page.locator('#btn-boot').click();
      await expect.poll(() => page.evaluate(() => window.NEON.Net.available), { timeout: 15000 }).toBe(true);
      if (seat === 0) {
        await page.evaluate(() => window.NEON.Coop.hostRoom({ shipType: 'kite' }));
        await expect.poll(() => page.evaluate(() => window.NEON.Net.code), { timeout: 30000 }).not.toBe('');
      } else {
        const code = await pages[0].evaluate(() => window.NEON.Net.code);
        await page.evaluate(code => window.NEON.Coop.joinRoom(code, { shipType: 'talon' }), code);
        await expect.poll(() => pages[0].evaluate(() => window.NEON.Coop.lobby?.members.length), { timeout: 30000 }).toBe(2);
      }
    }
    const [host, guest] = pages;
    await expect.poll(() => guest.evaluate(() => window.NEON.Coop.lobby?.members.length), { timeout: 30000 }).toBe(2);
    const revision = await host.evaluate(() => window.NEON.Coop.lobby.revision);
    await expect.poll(() => guest.evaluate(() => window.NEON.Coop.lobby.revision)).toBe(revision);
    for (const page of pages) await page.evaluate(() => window.NEON.Coop.readyLobby());
    for (const page of pages) await expect.poll(() => page.evaluate(() => window.NEON.Game.mode), { timeout: 30000 }).toBe('playing');
    await host.evaluate(() => {
      const N = window.NEON, original = N.Net.onMessage;
      window.__legacyActions = [];
      N.Net.onMessage = function (message, clientId) {
        const isLegacyAction = message.t === 'pause' || message.t === 'fire';
        const mirror = N.Coop.guestMirror(clientId);
        const before = isLegacyAction ? [N.Game.mode, N.Coop.pauseState, mirror.x, mirror.y] : null;
        original(message, clientId);
        if (isLegacyAction) window.__legacyActions.push({ type: message.t, before,
          after: [N.Game.mode, N.Coop.pauseState, mirror.x, mirror.y] });
      };
    });
    await guest.evaluate(() => {
      window.NEON.Net.send({ t: 'pause', paused: true });
      window.NEON.Net.send({ t: 'fire', x: 4321, y: 3123, a: 0, w: 'pulse' });
    });
    await expect.poll(() => host.evaluate(() => window.__legacyActions.length)).toBe(2);
    const ignoredLegacy = await host.evaluate(() => window.__legacyActions);
    expect(ignoredLegacy.map(item => item.type)).toEqual(['pause', 'fire']);
    for (const action of ignoredLegacy) {
      expect(action.after).toEqual(action.before);
      expect(action.after.slice(0, 2)).toEqual(['playing', 'PLAY']);
    }
    expect(await guest.evaluate(() => [window.NEON.Game.mode, window.NEON.Coop.pauseState])).toEqual(['playing', 'PLAY']);
    await host.evaluate(() => {
      const N = window.NEON, G = N.Game;
      G.enemies.length = G.enemyBullets.length = 0;
      G.updateSpawning = G.updateAnchors = () => {};
      G.nextSurge = G.nextWarden = G.nextBoss = 1e9;
      for (const p of N.Coop.players()) p.invuln = 999;
      const original = N.Coop.publishProgressionEvent;
      window.__events = [];
      N.Coop.publishProgressionEvent = event => {
        window.__events.push(event);
        if (event.sequence !== 1) original(event);
      };
      for (const category of ['primary', 'offensive']) {
        const item = G.spawnGroundLoot({ kind: 'equipment', id: category, color: '#b6ff2b' }, G.player.x, G.player.y, null, true);
        N.ProgressionRuntime.collect(G, item);
      }
    });
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.player.progression.appliedEventSequence)).toBe(2);
    const before = await guest.evaluate(() => {
      const p = window.NEON.Game.player;
      return [p.progression.offensive[0].level, p.progression.offensive[1].id];
    });
    expect(before[0]).toBe(2);
    await host.evaluate(() => window.NEON.Coop.publishProgressionEvent(window.__events[1]));
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.player.progression.offensive[0].level)).toBe(2);
    // A malformed newer resource result must not advance the accepted revision.
    const bad = await host.evaluate(() => {
      const N = window.NEON, p = N.Coop.remotePlayers[0];
      const event = N.ProgressionRewards.snapshot({ run: N.Game.run.progression }, p.clientId).resources;
      event.resourceRevision += 10; delete event.buffs;
      return event;
    });
    const unchanged = await guest.evaluate(event => {
      const N = window.NEON, p = N.Game.player, revision = p.resourceRevision;
      const result = N.ProgressionPersistence.applyResources(p, event, N.Game.run.progression.runToken);
      return !result.ok && revision === p.resourceRevision;
    }, bad);
    expect(unchanged).toBe(true);
    const identity = await guest.evaluate(() => window.NEON.Net.clientId);
    const code = await host.evaluate(() => window.NEON.Net.code);
    await guest.evaluate(() => window.NEON.Coop.leaveToMenu());
    await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers.length)).toBe(0);
    await host.evaluate(() => {
      const N = window.NEON, G = N.Game;
      const item = G.spawnGroundLoot({ kind: 'equipment', id: 'primary', color: '#b6ff2b' }, G.player.x, G.player.y, null, true);
      N.ProgressionRuntime.collect(G, item);
    });
    await guest.evaluate(code => window.NEON.Coop.joinRoom(code, { shipType: 'talon' }), code);
    await expect.poll(() => guest.evaluate(() => window.NEON.Coop.active), { timeout: 30000 }).toBe(true);
    await expect.poll(() => guest.evaluate(() => window.NEON.Game.player.progression.appliedEventSequence)).toBe(3);
    expect(await guest.evaluate(() => window.NEON.Net.clientId)).toBe(identity);
    expect(await guest.evaluate(() => window.NEON.Game.player.progression.offensive[0].level)).toBe(3);
    expect(await guest.evaluate(() => window.NEON.Game.player.progression.offensive[1].id)).toBe(before[1]);
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts.reverse()) await context.close();
  }
});

test('048 guest dash grants host immunity once and preserves recharge through rejoin', async ({ browser }) => {
  test.setTimeout(150000);
  const contexts = [], pages = [], errors = [];
  try {
    for (let seat = 0; seat < 2; seat++) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      await page.locator('#btn-boot').click();
      await expect.poll(() => page.evaluate(() => window.NEON.Net.available), { timeout: 30000 }).toBe(true);
      if (seat === 0) {
        await page.evaluate(() => {
          const N = window.NEON, G = N.Game;
          G.spawnInitialEnemies = G.updateSpawning = G.updateAnchors = () => {};
          N.Coop.hostRoom({ shipType: 'kite' });
        });
        await expect.poll(() => page.evaluate(() => window.NEON.Net.code), { timeout: 30000 }).not.toBe('');
      } else {
        const code = await pages[0].evaluate(() => window.NEON.Net.code);
        await page.evaluate(code => window.NEON.Coop.joinRoom(code, { shipType: 'talon' }), code);
        await expect.poll(() => pages[0].evaluate(() => window.NEON.Coop.lobby?.members.length), { timeout: 30000 }).toBe(2);
      }
    }
    const [host, guest] = pages;
    await expect.poll(() => guest.evaluate(() => window.NEON.Coop.lobby?.members.length), { timeout: 30000 }).toBe(2);
    const revision = await host.evaluate(() => window.NEON.Coop.lobby.revision);
    await expect.poll(() => guest.evaluate(() => window.NEON.Coop.lobby.revision)).toBe(revision);
    for (const page of pages) await page.evaluate(() => window.NEON.Coop.readyLobby());
    for (const page of pages) await expect.poll(() => page.evaluate(() => window.NEON.Game.mode), { timeout: 30000 }).toBe('playing');
    await host.evaluate(() => {
      const N = window.NEON, G = N.Game, original = N.Net.onMessage;
      G.enemies.length = G.enemyBullets.length = 0;
      G.nextSurge = G.nextWarden = G.nextBoss = 1e9;
      N.Coop.remotePlayers[0].invuln = 0;
      window.__dashAttempts = [];
      N.Net.onMessage = function (message, clientId) {
        const checking = message.t === 'progression_intent' && message.intent?.dash && G.mode === 'playing';
        const mirror = checking ? N.Coop.guestMirror(clientId) : null;
        const before = checking ? { charges: mirror.dashCharges, timer: mirror.dashTimer, hp: mirror.hp,
          shield: mirror.shield, invuln: mirror.invuln } : null;
        original(message, clientId);
        if (!checking) return;
        const first = window.__dashAttempts.length === 0;
        const blocked = first ? N.Coop.sendHit(mirror, 10, mirror.x, mirror.y, false) === false : null;
        window.__dashAttempts.push({ before, charges: mirror.dashCharges, timer: mirror.dashTimer,
          invuln: mirror.invuln, hp: mirror.hp, shield: mirror.shield, blocked });
        // Freeze the remaining simulation time for exact reconnect comparison.
        N.Coop.requestGlobalPause();
        N.Coop.applyGlobalPause(N.Net.clientId);
      };
    });
    await guest.evaluate(() => {
      const N = window.NEON, original = N.Input.actionPressed;
      let pressed = true;
      N.Input.actionPressed = action => action === 'dash' ? (pressed && (pressed = false, true)) : original(action);
      try { N.Game.updatePlayer(0); } finally { N.Input.actionPressed = original; }
    });
    await expect.poll(() => host.evaluate(() => window.__dashAttempts.length)).toBe(1);
    const first = await host.evaluate(() => window.__dashAttempts[0]);
    expect(first.before.charges).toBe(1);
    expect(first.charges).toBe(0);
    expect(first.invuln).toBe(.34);
    expect(first.blocked).toBe(true);
    expect([first.hp, first.shield]).toEqual([first.before.hp, first.before.shield]);
    for (const page of pages) await expect.poll(() => page.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
    for (const page of pages) await page.evaluate(() => window.NEON.Coop.sendReady());
    for (const page of pages) await expect.poll(() => page.evaluate(() => window.NEON.Game.mode), { timeout: 15000 }).toBe('playing');
    await host.evaluate(() => { window.NEON.Coop.remotePlayers[0].invuln = 0; });
    await guest.evaluate(() => window.NEON.Coop.sendProgressionIntent({ dash: true, dashDirection: 1 }));
    await expect.poll(() => host.evaluate(() => window.__dashAttempts.length)).toBe(2);
    const retry = await host.evaluate(() => window.__dashAttempts[1]);
    expect(retry.before.charges).toBe(0);
    expect(retry.charges).toBe(0);
    expect(retry.timer).toBe(retry.before.timer);
    expect(retry.timer).toBeGreaterThan(0);
    expect(retry.invuln).toBe(0);
    for (const page of pages) await expect.poll(() => page.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
    const held = await host.evaluate(() => {
      const p = window.NEON.Coop.remotePlayers[0];
      return [p.dashCharges, p.maxDashCharges, p.dashTimer, p.dashTime, p.dashDir];
    });
    const code = await host.evaluate(() => window.NEON.Net.code);
    await guest.evaluate(() => window.NEON.Coop.leaveToMenu());
    await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers.length)).toBe(0);
    await guest.evaluate(code => window.NEON.Coop.joinRoom(code, { shipType: 'talon' }), code);
    await expect.poll(() => guest.evaluate(() => window.NEON.Coop.active), { timeout: 30000 }).toBe(true);
    expect(await guest.evaluate(() => {
      const p = window.NEON.Game.player;
      return [p.dashCharges, p.maxDashCharges, p.dashTimer, p.dashTime, p.dashDir];
    })).toEqual(held);
    for (const page of pages) await page.evaluate(() => window.NEON.Coop.sendReady());
    for (const page of pages) await expect.poll(() => page.evaluate(() => window.NEON.Game.mode), { timeout: 15000 }).toBe('playing');
    await guest.evaluate(() => window.NEON.Coop.sendProgressionIntent({ dash: true, dashDirection: 0 }));
    await expect.poll(() => host.evaluate(() => window.__dashAttempts.length)).toBe(3);
    expect((await host.evaluate(() => window.__dashAttempts[2])).charges).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts.reverse()) await context.close();
  }
});
