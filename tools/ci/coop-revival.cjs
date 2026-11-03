/* global window */
'use strict';

const { expect } = require('@playwright/test');

async function expectRevival(host, victim, startedAt) {
  try {
    // Three simulation seconds can exceed short wall-clock waits on a busy
    // runner. Preserve a bounded wait and verify the actual simulation clock.
    await expect.poll(() => victim.evaluate(() => window.NEON.Game.player.dead),
      { timeout: 60000 }).toBe(false);
  } catch (error) {
    console.log('Revival diagnostic:', await host.evaluate(start => {
      const N = window.NEON, G = N.Game, C = N.Coop;
      return { simulationSeconds: G.level.elapsed - start, fps: G.fps, mode: G.mode,
        pause: C.pauseState, pool: C.remainingRespawns,
        players: C.players().map(player => ({ seat: player.seat, dead: player.dead,
          seconds: player.respawnSeconds })) };
    }, startedAt));
    throw error;
  }
  expect(await host.evaluate(start => window.NEON.Game.level.elapsed - start,
    startedAt)).toBeGreaterThanOrEqual(2.9);
}

module.exports = { expectRevival };
