const { test, expect } = require('@playwright/test');
const { installMetrics, measureFight, captureHudComparison } = require('./coop-four-metrics.cjs');

for (const count of [3, 4]) {
  test(`028 ${count} players launch, see every ship, pause, revive, leave and rejoin`, async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const contexts = [], pages = [], errors = [];
    try {
      for (let seat = 0; seat < count; seat++) {
        const context = await browser.newContext();
        contexts.push(context);
        if (process.env.NEON_COOP_MEASURE === '1') {await installMetrics(context);}
        const page = await context.newPage();
        pages.push(page);
        page.on('pageerror', error => errors.push(`seat ${seat}: ${error.message}`));
        await page.goto('/');
        await page.locator('#btn-boot').click();
        if (count === 4 && seat === 1) {
          await page.evaluate(() => {
            const N = window.NEON, G = N.Game;
            G.newRun(); G.pauseGame();
            G.player.weapons[0].level = 3;
            const saved = N.Loadouts.save('Optional veteran');
            if (!saved.ok) {throw new Error(saved.error);}
            G.completeToMenu();
          });
        }
        await page.locator('#btn-coop').click();
        if (seat === 0) {
          await page.locator('#btn-coop-host').click();
          await expect.poll(() => page.evaluate(() => window.NEON.Net.code), { timeout: 30000 }).not.toBe('');
        } else {
          const code = await pages[0].evaluate(() => window.NEON.Net.code);
          await page.locator('#coop-code-input').evaluate((input, value) => { input.value = value; }, code);
          await page.locator('#btn-coop-join').click();
          await expect.poll(() => pages[0].evaluate(() => window.NEON.Net.peers.size), { timeout: 30000 }).toBe(seat);
          await expect.poll(() => page.evaluate(() => window.NEON.Coop.lobby?.members.length), { timeout: 30000 }).toBe(seat + 1);
        }
      }
      const host = pages[0];
      if (count === 4) {
        await host.setViewportSize({ width: 960, height: 720 });
        await host.screenshot({ animations: 'disabled', path: testInfo.outputPath('four-player-lobby.png') });
        expect(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await host.locator('#coop-respawns').scrollIntoViewIfNeeded();
        await expect(host.locator('#coop-respawns')).toBeInViewport();
        await host.screenshot({ animations: 'disabled', path: testInfo.outputPath('four-player-lobby-controls.png') });
        await host.setViewportSize({ width: 1280, height: 720 });
      }
      expect(await host.evaluate(() => window.NEON.Coop.lobby.allowLoadouts)).toBe(false);
      if (count === 4) {
        const choose = pages[1].locator('#coop-loadouts').getByRole('button', { name: 'Optional veteran', exact: false });
        await expect(choose).toBeDisabled();
        await host.locator('#coop-allow-loadouts').click();
        await choose.click();
        await expect.poll(() => host.evaluate(() => !!window.NEON.Coop.lobby.members.find(member => member.seat === 1).profile.loadout)).toBe(true);
        await host.locator('#coop-allow-loadouts').click();
        await expect.poll(() => host.evaluate(() => window.NEON.Coop.lobby.members.every(member => member.profile.loadout === null))).toBe(true);
        await host.locator('#coop-allow-loadouts').click();
        await expect.poll(() => pages[1].evaluate(() => window.NEON.Coop.localProfile.loadout)).toBe(null);
        await choose.click();
        await expect.poll(() => host.evaluate(() => !!window.NEON.Coop.lobby.members.find(member => member.seat === 1).profile.loadout)).toBe(true);
      }
      const revision = await host.evaluate(() => window.NEON.Coop.lobby.revision);
      for (const page of pages) {
        await expect.poll(() => page.evaluate(() => window.NEON.Coop.lobby?.members.length)).toBe(count);
        await expect.poll(() => page.evaluate(() => window.NEON.Coop.lobby.revision)).toBe(revision);
        await page.evaluate(() => window.NEON.Coop.readyLobby());
      }
      for (const page of pages) {
        await expect.poll(() => page.evaluate(() => window.NEON.Game.mode), { timeout: 30000 }).toBe('playing');
        await expect.poll(() => page.evaluate(() => window.NEON.Coop.remotePlayers.length)).toBe(count - 1);
      }
      for (let seat = 0; seat < count; seat++) {
        expect(await pages[seat].evaluate(() => window.NEON.Game.player.weapons[0].level)).toBe(count === 4 && seat === 1 ? 3 : 1);
      }
      expect(await host.evaluate(() => Array.from(window.NEON.Net.peers.values(), peer => peer.seat).sort())).toEqual(Array.from({ length: count - 1 }, (_, index) => index + 1));
      await host.evaluate(() => {
        const N = window.NEON, G = N.Game;
        G.enemies.length = 0;
        G.nextSurge = G.nextWarden = G.nextBoss = 1e9;
        G.spawnWave = () => {};
        for (const player of N.Coop.players()) {player.invuln = 999;}
      });
      // Every guest's fire and confirmed kills must stay attached to that seat.
      await host.evaluate(() => {
        const C = window.NEON.Coop, original = C.fireForPlayer;
        window.__firedSeats = [];
        C.fireForPlayer = function (player, ...args) {
          window.__firedSeats.push(player.seat);
          return original(player, ...args);
        };
      });
      for (let seat = 1; seat < count; seat++) {
        await pages[seat].evaluate(() => {
          const G = window.NEON.Game;
          G.fireWeapon(G.player.weapons[G.player.activeWeapon]);
        });
        await expect.poll(() => host.evaluate(value => window.__firedSeats.includes(value), seat)).toBe(true);
        await host.evaluate(value => {
          const N = window.NEON, G = N.Game;
          const player = N.Coop.remotePlayers.find(item => item.seat === value);
          const enemy = G.spawnEnemy(N.ENEMY_BY_ID.dart, player.x + 400, player.y);
          enemy.xp = 0;
          G.killEnemy(enemy, { player });
          N.PlayerStats.sendRow(true);
          N.Logbook.send(true);
        }, seat);
        await expect.poll(() => pages[seat].evaluate(() => window.NEON.PlayerStats.match.shipsDestroyed)).toBe(1);
        await expect.poll(() => pages[seat].evaluate(() => window.NEON.Profile.current().book.dart?.kills || 0)).toBe(1);
        for (let other = seat + 1; other < count; other++) {
          expect(await pages[other].evaluate(() => window.NEON.PlayerStats.match.shipsDestroyed)).toBe(0);
          expect(await pages[other].evaluate(() => window.NEON.Profile.current().book.dart?.kills || 0)).toBe(0);
        }
      }
      const last = pages.at(-1);
      await last.evaluate(() => { window.NEON.Game.player.invuln = 0; });
      await host.evaluate(() => {
        const C = window.NEON.Coop, player = C.remotePlayers.reduce((a, b) => a.seat > b.seat ? a : b);
        C.sendHit(player, 1, player.x, player.y, false);
      });
      await expect.poll(() => last.evaluate(() => window.NEON.PlayerStats.match.hitsTaken)).toBe(1);
      for (const page of pages.slice(0, -1)) {expect(await page.evaluate(() => window.NEON.PlayerStats.match.hitsTaken)).toBe(0);}
      await last.evaluate(() => window.NEON.Coop.requestGlobalPause());
      for (const page of pages) {await expect.poll(() => page.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');}
      await expect(host.locator('#screen-pause.active')).toBeVisible();
      await expect(host.locator('#pause-coop-status span')).toHaveCount(count);
      if (count === 4) {
        await host.screenshot({ animations: 'disabled', path: testInfo.outputPath('four-player-pause.png') });
        if (process.env.NEON_COOP_VISUAL_COMPARE === '1') {await captureHudComparison(host, testInfo);}
      }
      for (const page of pages.slice(0, -1)) {await page.evaluate(() => window.NEON.Coop.sendReady());}
      expect(await host.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
      await last.evaluate(() => window.NEON.Coop.sendReady());
      for (const page of pages) {await expect.poll(() => page.evaluate(() => window.NEON.Game.mode), { timeout: 15000 }).toBe('playing');}
      await last.evaluate(() => {
        window.NEON.Game.player.weapons[0].level = 3;
        window.NEON.Game.gameOver();
      });
      await expect.poll(() => last.evaluate(() => window.NEON.Game.player.dead), { timeout: 15000 }).toBe(false);
      expect(await last.evaluate(() => window.NEON.Game.player.weapons[0].level)).toBe(3);
      expect(await host.evaluate(() => window.NEON.Coop.remainingRespawns)).toBe(3);
      for (const page of pages) {
        await expect.poll(() => page.evaluate(() => window.NEON.Coop.pauseState)).toBe('PAUSED');
        await page.evaluate(() => window.NEON.Coop.sendReady());
      }
      for (const page of pages) {await expect.poll(() => page.evaluate(() => window.NEON.Game.mode), { timeout: 15000 }).toBe('playing');}
      if (count === 4) {
        await host.screenshot({ animations: 'disabled', path: testInfo.outputPath('four-player-hud.png') });
        if (process.env.NEON_COOP_MEASURE === '1') {await measureFight(pages, testInfo, browser);}
      }
      const identity = await last.evaluate(() => window.NEON.Net.clientId);
      const code = await host.evaluate(() => window.NEON.Net.code);
      await last.evaluate(() => window.NEON.Coop.leaveToMenu());
      await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers.length)).toBe(count - 2);
      // A new identity cannot fill a starting player's reserved seat.
      const rejected = await host.request.post('/php/coop.php', { data: { action: 'join', protocol: 2, code, clientId: 'nn_uninvited' } });
      expect((await rejected.json()).error).toBe('locked');
      await last.evaluate(roomCode => window.NEON.Coop.joinRoom(roomCode, window.NEON.Ships.selection({})), code);
      await expect.poll(() => last.evaluate(() => window.NEON.Coop.active), { timeout: 30000 }).toBe(true);
      expect(await last.evaluate(() => window.NEON.Net.clientId)).toBe(identity);
      expect(await last.evaluate(() => window.NEON.Net.seat)).toBe(count - 1);
      expect(await last.evaluate(() => window.NEON.Game.player.weapons[0].level)).toBe(3);
      expect(await host.evaluate(() => window.NEON.Coop.remainingRespawns)).toBe(3);
      await expect.poll(() => host.evaluate(() => window.NEON.Coop.remotePlayers.length)).toBe(count - 1);
      for (const page of pages) {await page.evaluate(() => window.NEON.Coop.sendReady());}
      for (const page of pages) {await expect.poll(() => page.evaluate(() => window.NEON.Game.mode), { timeout: 15000 }).toBe('playing');}
      await host.evaluate(() => {
        for (const player of window.NEON.Coop.remotePlayers) {player.dead = true;}
        window.NEON.Game.gameOver();
      });
      for (const page of pages) {
        await expect.poll(() => page.evaluate(() => window.NEON.Coop.active), { timeout: 15000 }).toBe(false);
        expect(await page.evaluate(() => window.NEON.PlayerStats.lastBoard.rows.length)).toBe(count);
      }
      expect(errors).toEqual([]);
    } finally {
      for (const context of contexts.reverse()) {await context.close();}
    }
  });
}
