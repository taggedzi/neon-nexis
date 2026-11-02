/* global window, requestAnimationFrame, innerWidth, innerHeight */
'use strict';

async function installMetrics(context) {
  await context.addInitScript(() => {
    const Native = window.RTCPeerConnection;
    const channels = [];
    window.__coopMetrics = { enabled: false, frames: [], bytes: [], buffered: 0, channels };
    const instrument = channel => {
      const id = channels.length;
      channels.push(channel);
      const send = channel.send.bind(channel);
      channel.send = data => {
        const metrics = window.__coopMetrics;
        if (metrics.enabled) {
          const bytes = typeof data === 'string' ? new TextEncoder().encode(data).byteLength : data.byteLength ?? data.size ?? 0;
          metrics.bytes[id] = (metrics.bytes[id] || 0) + bytes;
          metrics.buffered = Math.max(metrics.buffered, channel.bufferedAmount);
        }
        return send(data);
      };
    };
    function Peer(config) {
      const connection = new Native(config);
      const create = connection.createDataChannel.bind(connection);
      connection.createDataChannel = (...args) => { const channel = create(...args); instrument(channel); return channel; };
      connection.addEventListener('datachannel', event => instrument(event.channel));
      return connection;
    }
    Peer.prototype = Native.prototype;
    window.RTCPeerConnection = Peer;
    let previous = null;
    function frame(now) {
      const metrics = window.__coopMetrics;
      if (metrics.enabled && previous !== null) {metrics.frames.push(now - previous);}
      previous = now;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

async function measureFight(pages, testInfo, browser) {
  const samples = [];
  for (const enemyCount of [20, 80]) {
    await pages[0].evaluate(count => {
      const N = window.NEON, G = N.Game;
      G.enemies.length = 0;
      for (let index = 0; index < count; index++) {
        const angle = index * Math.PI * 2 / count;
        const styles = ['dart', 'eye', 'prism', 'flower', 'gyro', 'seeder'];
        const enemy = G.spawnEnemy(N.ENEMY_BY_ID[styles[index % styles.length]], G.player.x + Math.cos(angle) * 500, G.player.y + Math.sin(angle) * 500, { requiredEncounter: true });
        enemy.hp = enemy.maxHp = 1e6;
      }
    }, enemyCount);
    await Promise.all(pages.map(page => page.evaluate(() => {
      const N = window.NEON, metrics = window.__coopMetrics;
      metrics.frames = []; metrics.bytes = []; metrics.buffered = 0;
      metrics.startedAt = performance.now();
      metrics.heapBefore = performance.memory?.usedJSHeapSize ?? null;
      metrics.enabled = true;
      N.Game.player.invuln = 300;
      window.__coopFireTimer = setInterval(() => {
        const G = N.Game;
        if (G.mode === 'playing') {G.fireWeapon(G.player.weapons[G.player.activeWeapon]);}
      }, 150);
    })));
    await new Promise(resolve => setTimeout(resolve, 20000));
    const players = await Promise.all(pages.map(page => page.evaluate(() => {
      const N = window.NEON, G = N.Game, metrics = window.__coopMetrics;
      clearInterval(window.__coopFireTimer);
      metrics.enabled = false;
      const frames = metrics.frames.slice().sort((a, b) => a - b);
      const durationSeconds = (performance.now() - metrics.startedAt) / 1000;
      return { seat: N.Net.seat, durationSeconds, frameCount: frames.length,
        frameMedianMs: frames[Math.floor(frames.length * 0.5)] ?? null,
        frameP95Ms: frames[Math.floor(frames.length * 0.95)] ?? null,
        payloadBytesPerSecondByLink: metrics.bytes.map(bytes => bytes / durationSeconds),
        maxBufferedBytes: metrics.buffered, heapBefore: metrics.heapBefore,
        heapAfter: performance.memory?.usedJSHeapSize ?? null,
        enemies: G.enemies.filter(enemy => !enemy.dead).length,
        playerBullets: G.playerBullets.length, enemyBullets: G.enemyBullets.length,
        mode: G.mode, quality: G.settings.graphics, seed: G.run.seed,
        viewport: { width: innerWidth, height: innerHeight }, userAgent: navigator.userAgent };
    })));
    samples.push({ requestedEnemies: enemyCount, players });
  }
  const os = require('node:os');
  const result = { browser: browser.version(), platform: os.platform(), cpu: os.cpus()[0]?.model,
    hardwareConcurrency: os.availableParallelism(), totalMemoryBytes: os.totalmem(),
    note: 'Headless, four local contexts; payload excludes network framing; short heap samples do not establish retained-memory behavior.', samples };
  await testInfo.attach('four-player-fight-metrics', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  require('node:fs').writeFileSync(testInfo.outputPath('four-player-fight-metrics.json'), JSON.stringify(result, null, 2));
  console.log('COOP_METRICS ' + JSON.stringify(result));
}

async function captureHudComparison(page, testInfo) {
  const fs = require('node:fs');
  const { execFileSync } = require('node:child_process');
  const before = execFileSync('git', ['show', 'origin/main:js/render.js'], { encoding: 'utf8' });
  const after = fs.readFileSync('js/render.js', 'utf8');
  await page.evaluate(() => window.NEON.UI.hideAll());
  await page.evaluate(source => (0, eval)(source), before);
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('hud-baseline-same-scene.png') });
  await page.evaluate(source => (0, eval)(source), after);
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('hud-four-players-same-scene.png') });
}

module.exports = { installMetrics, measureFight, captureHudComparison };
