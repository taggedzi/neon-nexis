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
  P.validSession = value => value == null || (plain(value) && typeof value.id === 'string' && value.id.length <= 100 &&
    P.validStats(value.match) && P.validStats(value.received) && P.validStats(value.authority));
  P.validate = value => plain(value) && value.version === 1 && P.validStats(value.stats) && P.validSession(value.session);
  let cached = null;
  let loaded = false;
  let writable = true;
  P.reload = function () {
    loaded=true;
    try {
      const raw = localStorage.getItem(P.key);
      if (raw === null) {
        writable = true;
        cached = { version: 1, stats: P.emptyStats() };
      } else {
        const parsed = JSON.parse(raw);
        writable = P.validate(parsed);
        cached = writable ? { version: 1, stats: P.cleanStats(parsed.stats), session: parsed.session || null } : null;
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
