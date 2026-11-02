/* Lifetime enemy encounters and host-confirmed per-style destruction counts. */
(function () {
  'use strict';
  const N = window.NEON, G = N.Game, P = N.Profile, C = N.Coop;
  const B = N.Logbook = {};
  const peers = new Map();
  let received = {}, activeRun = '', timer = null, dirty = false;
  let dirtyRun = null, lastSend = 0, warned = false;
  const runKey = () => String(G.run?.seed) + '|' + String(G.run?.startedAt);
  const peerId = () => N.Net.peerId || C._peerId || '';
  const excluded = () => G.devScenarioLoading || N.Dev?.isScenario();
  function changed() {
    dirty = true;
    dirtyRun = G.run;
    if (!timer) { timer = setTimeout(B.flush, 2000); }
  }
  B.flush = function(manual = false) {
    clearTimeout(timer);
    timer = null;
    if (!dirty || (N.Dev?.isScenario(dirtyRun) && manual !== true)) { return; }
    if (P.flush()) {
      dirty = false;
      warned = false;
    } else if (!warned) {
      warned = true;
      N.UI?.toast('LOGBOOK COULD NOT BE SAVED. EXISTING PROFILE DATA WAS PRESERVED.', 'warn');
    }
  };
  function entry(book, id) {
    if (!book[id]) { book[id] = {seen: true, kills: 0}; }
    return book[id];
  }
  function own(id, count = 0) {
    if (excluded() || !Object.hasOwn(N.ENEMY_BY_ID, id)) { return; }
    const profile = P.current();
    if (!profile) { return; }
    const old = profile.book[id];
    if (old?.seen && count === 0) { return; }
    const item = entry(profile.book, id);
    item.seen = true;
    item.kills = Math.min(Number.MAX_SAFE_INTEGER, item.kills + count);
    changed();
  }
  B.selectPeer = function(id, discoverCurrent = false) {
    if (!C.isHost() || !id || (peers.has(id) && !discoverCurrent)) { return; }
    const book = peers.get(id) || {};
    for (const enemy of G.enemies) {
      if (!enemy.dead && Object.hasOwn(N.ENEMY_BY_ID, enemy.style)) {
        entry(book, enemy.style);
      }
    }
    peers.set(id, book);
  };
  B.spawned = function(enemy) {
    if (!enemy || C.isGuest() || excluded()) { return; }
    own(enemy.style);
    if (C.isHost()) {
      for (const player of C.remotePlayers) {
        const id = player.clientId || player.statsPeerId || peerId();
        B.selectPeer(id);
        if (peers.has(id)) {entry(peers.get(id), enemy.style);}
      }
    }
  };
  B.destroyed = function(enemy, player) {
    if (C.isGuest() || excluded()) { return; }
    if (C.isHost() && player?.remote) {
      const id = player.statsPeerId || peerId();
      B.selectPeer(id);
      if (!peers.has(id)) { return; }
      const item = entry(peers.get(id), enemy.style);
      item.kills = Math.min(Number.MAX_SAFE_INTEGER, item.kills + 1);
    } else {
      own(enemy.style, 1);
    }
  };
  B.receive = function(message) {
    if (!C.isGuest()) { return; }
    const book = P.cleanBook(message.book), profile = P.current();
    if (!profile) { return; }
    let updated = false;
    if (activeRun !== runKey()) {
      B.flush();
      received = profile.bookSession?.id === runKey() ? P.cleanBook(profile.bookSession.received) : {};
      activeRun = runKey();
      updated = true;
    }
    // Import can replace the profile while this recorder remains in memory.
    if (profile.bookSession?.id !== activeRun) { updated = true; }
    for (const [id, item] of Object.entries(book)) {
      if (!item.seen && item.kills === 0) { continue; }
      const previous = received[id]?.kills || 0;
      if (!received[id] || item.kills > previous) { updated = true; }
      own(id, Math.max(0, item.kills - previous));
      const known = entry(received, id);
      known.kills = Math.max(previous, item.kills);
    }
    // Receipt and lifetime increments share one atomic profile write.
    if (updated) {
      profile.bookSession = {id: activeRun, received};
      changed();
    }
  };
  B.send = function(force = false) {
    if (!C.isHost()) { return; }
    const now = performance.now();
    if (!force && now - lastSend < 500) { return; }
    lastSend = now;
    for (const player of C.remotePlayers) {
      const id = player.clientId || player.statsPeerId || peerId();
      B.selectPeer(id);
      N.Net.send({t: 'book_sync', book: peers.get(id) || {}}, id);
    }
  };
  function wrap(object, name, action) {
    const original = object[name];
    object[name] = function(...args) { return action(original, args); };
  }
  wrap(G, 'spawnEnemy', (original, args) => {
    const enemy = original(...args);
    B.spawned(enemy);
    return enemy;
  });
  wrap(G, 'killEnemy', (original, args) => {
    const enemy = args[0], alive = enemy && !enemy.dead;
    const killer = args[1]?.player || N.PlayerStats.activeShot?.player || G.player;
    const result = original(...args);
    if (alive && enemy.dead && !args[1]?.exploded) { B.destroyed(enemy, killer); }
    return result;
  });
  wrap(G, 'newRun', (original, args) => {
    B.flush();
    const before = G.run, result = original(...args);
    if (G.run !== before) {
      peers.clear();
      received = {};
      activeRun = '';
      lastSend = 0;
    }
    return result;
  });
  wrap(C, 'tickSession', (original, args) => {
    const result = original(...args);
    B.send();
    return result;
  });
  wrap(N.PlayerStats, 'answerEnd', (original, args) => {
    B.flush();
    return original(...args);
  });
  wrap(C, 'finishRun', (original, args) => {
    B.send(true);
    B.flush();
    return original(...args);
  });
  for (const name of ['leaveToMenu', 'endSession']) {
    wrap(C, name, (original, args) => {
      B.send(true);
      B.flush();
      return original(...args);
    });
  }
  wrap(G, 'saveCheckpoint', (original, args) => {
    B.flush(args[1] === 'manual');
    return original(...args);
  });
  wrap(G, 'gameOver', (original, args) => {
    const result = original(...args);
    B.flush();
    return result;
  });
  window.addEventListener('pagehide', () => B.flush());
})();
