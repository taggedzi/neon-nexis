const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const N = {TAU:Math.PI * 2, clamp:(value, min, max) => Math.max(min, Math.min(max, value))};
const context = vm.createContext({window:{NEON:N}});
for (const file of ['content', 'progression-content', 'progression-stats', 'progression-offense',
  'progression-defense', 'progression-equipment', 'progression-rewards', 'progression-persistence']) {
  vm.runInContext(readFileSync('js/' + file + '.js', 'utf8'), context);
}
const R = N.ProgressionRewards;
N.Game = {};
vm.runInContext(readFileSync('js/progression-runtime.js', 'utf8'), context);
const clone = value => JSON.parse(JSON.stringify(value));
function player(id) {
  const progression = N.Equipment.create('kite');
  return {clientId:id, shipType:'kite', shipColor:'#00f0ff', progressionMode:'shared_v1', progression,
    stats:N.ProgressionStats.derive('kite', progression), hp:100, shield:20, dead:false,
    dashCharges:1, maxDashCharges:1, dashTimer:0, dashTime:0, dashDir:0,
    connected:true, invuln:0, shieldDelay:0, buffs:{overclock:0, speed:0, magnet:0}, resourceRevision:0};
}
function setup(count = 4) {
  const players = Array.from({length:count}, (_, index) => player('p' + index));
  const run = R.createRun(players, 'a'.repeat(32));
  const sources = {};
  const ctx = {run, pickups:[], collectorId:'p0', sources, resolveSource:id => sources[id]};
  return {players, run, ctx};
}
function pickup(ctx, id, category) {
  ctx.pickups.push({id, kind:'equipment', itemId:category});
  return R.collect(ctx, id);
}

const {players, run, ctx} = setup();
players[2].connected = false;
players[3].dead = true;
players[3].hp = 0;
const rolls = [0, .3, 0, .9];
ctx.random = () => rolls.shift();
const installed = pickup(ctx, 'first', 'offensive');
assert.equal(installed.ok, true);
assert.deepEqual(players.map(p => p.progression.offensive[1].id),
  ['seeker_missiles', 'arc_projector', 'seeker_missiles', 'plasma_mortar']);
assert.equal(R.collect(ctx, 'first').ok, false);
assert.equal(run.nextEventSequence, 2);
assert.equal(players[3].hp, 0);
assert.equal(players[3].dead, true);
assert.equal(players.every(p => p.progression.selectedOffensiveSlot === 0), true);

ctx.random = () => 0;
for (const p of players) {
  p.progression.offensive[0].level = 5;
  p.hp = p.dead ? 0 : 96;
}
const fallback = pickup(ctx, 'capped', 'primary');
assert.deepEqual(clone(fallback.event.outcomes.map(o => [o.result.repair, o.result.salvage])), [[4,6], [4,6], [0,10], [0,10]]);
players[0].hp = 50;
assert.equal(R.collect(ctx, 'capped').ok, false);
assert.equal(players[0].hp, 50);
assert.equal(players[0].progression.salvage, 6);

const receiver = player('p0');
assert.equal(R.applyCommitted(receiver, fallback.event).reason, 'sequence-gap');
assert.equal(R.applyCommitted(receiver, installed.event).ok, true);
assert.equal(R.applyCommitted(receiver, installed.event).duplicate, true);
assert.equal(R.applyCommitted(receiver, fallback.event).ok, true);
assert.equal(receiver.progression.salvage, 6);
assert.equal(receiver.hp, 100);
receiver.hp = 40;
assert.equal(R.applyCommitted(receiver, fallback.event).duplicate, true);
assert.equal(receiver.hp, 40);

// Accepting a newer complete resource revision does not suppress an older
// progression event's salvage. Its repair remains an absolute earlier state.
const reordered = player('p0');
R.applyCommitted(reordered, installed.event);
reordered.resourceRevision = fallback.event.outcomes[0].resources.resourceRevision + 1;
reordered.hp = 70;
reordered.barrier = {capacity:25, windowSeconds:3, lockoutSeconds:2};
assert.equal(R.applyCommitted(reordered, fallback.event).ok, true);
assert.equal(reordered.hp, 70);
assert.equal(reordered.barrier.capacity, 25);
assert.equal(reordered.progression.salvage, 6);

ctx.pickups.push({id:'repair', kind:'consumable', itemId:'repair'});
const repaired = R.collect(ctx, 'repair');
assert.deepEqual(clone(repaired.event.outcomes.map(o => o.result.type)), ['repair','no-change','ineligible','ineligible']);
assert.equal(players[0].hp, 78);
assert.equal(players[2].hp, 96);
assert.equal(players[3].dead, true);

const delivery = setup(1);
delivery.ctx.publish = () => { throw Error('Disconnected transport'); };
const committed = pickup(delivery.ctx, 'committed', 'primary');
assert.equal(committed.ok, true);
assert.equal(committed.deliveryPending, true);
assert.equal(delivery.ctx.pickups[0].collected, true);
assert.equal(R.collect(delivery.ctx, 'committed').ok, false);
assert.equal(delivery.players[0].progression.offensive[0].level, 2);

const xp = setup(1);
xp.players[0].progression.xp = 37;
xp.ctx.source = {id:'kill1'};
xp.ctx.sources.kill1 = xp.ctx.source;
const leveled = R.addXp(xp.ctx, 'kill1', 2);
assert.equal(leveled.ok, true);
assert.equal(xp.players[0].progression.level, 2);
assert.equal(xp.players[0].progression.xp, 1);
assert.equal(xp.players[0].progression.nextPassiveIndex, 1);
assert.equal(xp.players[0].progression.passives.reinforced_hull, 1);
assert.equal(xp.players[0].hp, 110);
assert.equal(R.addXp(xp.ctx, 'kill1', 2).ok, false);
xp.ctx.source = {id:'kill1'};
assert.equal(R.addXp(xp.ctx, 'kill1', 2).ok, false);
assert.equal(xp.players[0].progression.xp, 1);
delete xp.ctx.sources.kill1;
assert.equal(R.addXp(xp.ctx, 'kill1', 2).reason, 'invalid-xp-source');
xp.ctx.source = {id:'many'};
xp.ctx.sources.many = xp.ctx.source;
R.addXp(xp.ctx, 'many', 1000);
assert.equal(xp.players[0].progression.level > 7, true);

const saved = R.snapshot(ctx, 'p2');
const rejoined = player('p2');
assert.equal(R.restoreSnapshot(rejoined, saved).ok, true);
assert.equal(rejoined.progression.salvage, 10);
assert.equal(rejoined.progression.offensive[1].id, 'seeker_missiles');
const invalid = clone(saved);
delete invalid.resources.buffs;
assert.equal(R.restoreSnapshot(rejoined, invalid).ok, false);

const compact = setup(1);
for (let i = 0; i < 300; i++) {
  compact.ctx.source = {id:'xp' + i};
  compact.ctx.sources[compact.ctx.source.id] = compact.ctx.source;
  assert.equal(R.addXp(compact.ctx, 'xp' + i, 0).ok, true);
}
assert.equal(compact.run.journal.length, 256);
assert.equal(R.replaySince(compact.ctx, 0).reason, 'snapshot-required');
assert.equal(R.replaySince(compact.ctx, 299).events.length, 1);
assert.equal(R.runSnapshot(compact.ctx).participants.p0.sequence, 300);

const world = setup(1);
const enemy = {id:'enemy1'};
const game = {player:world.players[0], run:{progression:world.run}, enemies:[enemy], groundItems:[]};
const firstKill = N.ProgressionRuntime.addXp(game, 1, enemy);
assert.equal(firstKill.ok, true);
assert.equal(N.ProgressionRuntime.addXp(game, 1, {id:'enemy1'}).reason, 'invalid-xp-source');
assert.equal(N.ProgressionRuntime.addXp(game, 1, enemy).reason, 'source-consumed');
game.enemies = [];
assert.equal(N.ProgressionRuntime.addXp(game, 1, enemy).reason, 'invalid-xp-source');
// Restoring a world can reuse its local enemy label, but the persisted source
// serial gives that new physical enemy a different authoritative XP identity.
const respawned = {id:'enemy1'};
game.enemies = [respawned];
const afterRestore = N.ProgressionRuntime.addXp(game, 1, respawned);
assert.equal(afterRestore.ok, true);
assert.notEqual(afterRestore.event.sourceId, firstKill.event.sourceId);
assert.equal(world.players[0].progression.xp, 2);

const joining = setup(2);
const savedRun = R.runSnapshot(joining.ctx);
const guestGame = {player:joining.players[0], run:{progression:clone(savedRun)},
  makePlayer:options => Object.assign(player('constructing'), options, {x:0, y:0, radius:13})};
assert.equal(N.ProgressionRuntime.restoreRun(guestGame, savedRun, 'p0').ok, true);
const remote = guestGame.run.progression.participants.p1;
assert.equal(remote.progressionMode, 'shared_v1');
assert.equal(remote.x, 0);
assert.equal(remote.radius, 13);
assert.equal(remote.clientId, 'p1');
const liveContext = {run:guestGame.run.progression, pickups:[]};
pickup(liveContext, 'join-reward1', 'primary');
pickup(liveContext, 'join-reward2', 'primary');
assert.equal(N.ProgressionRuntime.restoreRun(guestGame, savedRun, 'p0').ok, true);
assert.equal(guestGame.run.progression.participants.p1, remote);
assert.equal(remote.progression.offensive[0].level, 3);
assert.equal(guestGame.run.progression.nextEventSequence, 3);

for (const count of [1, 2, 3, 4]) {
  const pace = setup(count).run;
  const drops = [];
  for (let second = 1; second <= 180; second++) {
    R.tickPacing(pace, 1, true);
    if (second % 4 === 0) {
      const drop = R.equipmentSource(pace, true, false, () => 0);
      if (drop) drops.push([second, drop.id]);
    }
  }
  assert.deepEqual(drops, [[20,'offensive'],[56,'primary'],[92,'primary'],[128,'primary'],[164,'primary']]);
  const before = clone(pace.pacing);
  assert.equal(R.equipmentSource(pace, false, true, () => .9).id, 'passive');
  assert.deepEqual(clone(pace.pacing), before);
  console.log('Pacing fixture:', count, 'players, 180 combat seconds, 45 kills,', drops.length, 'ordinary + 1 boss bonus');
}
console.log('Shared rewards: independent outcomes, once-only replay, fallback, offline recovery, levels and bounded pacing passed');
