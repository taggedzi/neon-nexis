/* Local lifetime records, independent of checkpoints and named pilots. */
(function () {
  'use strict';
  const N = window.NEON;
  const P = N.Profile = {};
  P.key = 'neon_nexus_profile_v1';
  P.statKeys = ['shotsFired', 'shotsHit', 'shipsDestroyed', 'objectivesDestroyed',
    'hitsTaken', 'itemsPickedUp', 'itemsDiscarded', 'itemsLost'];
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
  P.emptyStats = () => Object.fromEntries(P.statKeys.map(key => [key, 0]));
  P.validStats = function (value) {
    return plain(value) && P.statKeys.every(key => value[key] === undefined ||
      (Number.isSafeInteger(value[key]) && value[key] >= 0));
  };
  P.cleanStats = value => Object.fromEntries(P.statKeys.map(key => [key, value?.[key] || 0]));
  P.cleanBook = function(value) {
    const result = {};
    if (!plain(value)) { return result; }
    for (const [id, entry] of Object.entries(value)) {
      if (!Object.hasOwn(N.ENEMY_BY_ID || {}, id) || !plain(entry) ||
          typeof entry.seen !== 'boolean' || !Number.isSafeInteger(entry.kills) || entry.kills < 0) {
        continue;
      }
      result[id] = {seen: entry.seen || entry.kills > 0, kills: entry.kills};
    }
    return result;
  };
  P.validSession = value => value == null || (plain(value) && typeof value.id === 'string' && value.id.length <= 100 &&
    P.validStats(value.match) && P.validStats(value.received) && P.validStats(value.authority));
  P.validate = value => plain(value) && [1, 2].includes(value.version) && P.validStats(value.stats) && P.validSession(value.session);
  let cached = null;
  let loaded = false;
  let writable = true;
  P.reload = function () {
    loaded=true;
    try {
      const raw = localStorage.getItem(P.key);
      if (raw === null) {
        writable = true;
        cached = { version: 2, stats: P.emptyStats(), book: {} };
        P.bookSanitized = false;
      } else {
        const parsed = JSON.parse(raw);
        writable = P.validate(parsed);
        cached = writable ? { version: 2, stats: P.cleanStats(parsed.stats), session: parsed.session || null,
          book: P.cleanBook(parsed.book), bookSession: plain(parsed.bookSession) && typeof parsed.bookSession.id === 'string'
            ? {id: parsed.bookSession.id, received: P.cleanBook(parsed.bookSession.received)} : null } : null;
        P.bookSanitized = writable && parsed.book !== undefined && JSON.stringify(cached.book) !== JSON.stringify(parsed.book);
      }
    } catch (error) {
      writable = false;
      cached = null;
    }
    P.lastWriteOk=writable;
    return cached;
  };
  P.current = function () {
    return loaded?cached:P.reload();
  };
  P.addStat = function (key, count) {
    const profile = P.current();
    if (!profile || !P.statKeys.includes(key)) return;
    profile.stats[key] = Math.min(Number.MAX_SAFE_INTEGER, profile.stats[key] + count);
  };
  P.lastWriteOk=true;
  P.flush = function () {
    P.lastWriteOk=writable && !!P.current() && N.Storage.write(P.key, cached);
    return P.lastWriteOk;
  };
})();
