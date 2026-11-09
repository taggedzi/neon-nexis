// A lost grant acknowledgement must not let the host collect the guest's item.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const box = {
  window: { NEON: {} },
  location: { search: '' },
  console,
  document: {
    body: { classList: { add() {}, remove() {}, toggle() {} } },
    getElementById() { return null; },
    hidden: false,
    hasFocus() { return true; }
  }
};
box.window.addEventListener = () => {};
vm.createContext(box);
for (const file of ['util', 'content', 'ships', 'world', 'game', 'coop', 'sim']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), box);
}

const N = box.window.NEON;
const G = N.Game;
const Coop = N.Coop;
const sent = [];
N.Net = {
  send(message) {
    sent.push(message);
    return true;
  }
};
N.UI = { toast() {} };
N.Audio = { pickup() {}, setScene() {} };
N.Rewards.reset();

const mod = N.MODS.find((item) => item.type !== 'curse');
const player = {
  x: 400,
  y: 0,
  buffs: { magnet: 0 },
  stats: { pickupRadius: 95 },
  weapons: [],
  passives: [],
  core: [],
  weaponSlots: 2,
  passiveSlots: 4,
  activeWeapon: 0,
  dead: false
};
const guest = {
  clientId: 'guest',
  x: 0,
  y: 0,
  dead: false,
  magnet: false,
  stats: { pickupRadius: 95 }
};
G.player = player;
G.level = { layout: null };
G.mode = 'playing';
G.groundItems = [{
  id: 'grant-lost-ack',
  kind: 'mod',
  itemId: mod.id,
  x: 0,
  y: 0,
  tier: 1,
  color: mod.color,
  angle: 0,
  phase: 0,
  pickupDelay: 0,
  label: null
}];
Coop.active = true;
Coop.host = true;
Coop.guest = false;
Coop.remotePlayers = [guest];

G.updateGroundItems(0.05);
const reserved = G.groundItems[0];
assert.equal(reserved.collected, undefined);
assert.equal(reserved.grantPending, true);
assert.equal(sent.filter((message) => message.t === 'grant').length, 1);
const grantId = reserved.grantId;
assert.ok(grantId);

Coop.host = false;
Coop.guest = true;
Coop.applyGrant(sent.find((message) => message.t === 'grant'));
assert.equal(N.Rewards.state().pending.length, 1);
assert.equal(Coop._acceptedGrants.has(grantId), true);

Coop.host = true;
Coop.guest = false;
player.x = 0;
player.y = 0;
guest.x = 5000;
guest.y = 5000;
G.updateGroundItems(1.2);
G.updateGroundItems(0.2);
const stillThere = G.groundItems.find((item) => item.grantId === grantId);
assert.ok(stillThere, 'host does not collect an item with a lost acknowledgement');
assert.notEqual(stillThere.collected, true);
assert.equal(stillThere.grantPending, true);
assert.equal(N.Rewards.state().pending.length, 1);
assert.ok(sent.filter((message) => message.t === 'grant' && message.grantId === grantId).length >= 2);

Coop.applyGrantAck({ t: 'grant_ack', grantId: grantId, ok: true });
assert.equal(G.groundItems.some((item) => item.grantId === grantId), false);
assert.equal(N.Rewards.state().pending.length, 1);

console.log('Grant ownership checks passed.');

// A nearer ship outside its own range cannot block a farther eligible ship.
const destinations = [];
N.Net.send = (message, targetId) => { sent.push(message); destinations.push(targetId); return true; };
player.x = 100; player.y = 0; player.stats.pickupRadius = 95;
const eligible = { clientId: 'long-range', x: 120, y: 0, dead: false, magnet: false,
  pickupRadius: 150, stats: { pickupRadius: 150 } };
const ineligible = { clientId: 'short-range', x: 110, y: 0, dead: false, magnet: false,
  pickupRadius: 90, stats: { pickupRadius: 90 } };
const farther = { clientId: 'farther-range', x: 140, y: 0, dead: false, magnet: false,
  pickupRadius: 200, stats: { pickupRadius: 200 } };
Coop.remotePlayers = [ineligible, farther, eligible];
G.groundItems = [{ id: 'different-ranges', kind: 'mod', itemId: mod.id, x: 0, y: 0,
  tier: 1, color: mod.color, angle: 0, phase: 0, pickupDelay: 0 }];
G.updateGroundItems(0);
assert.equal(G.groundItems[0].grantOwner, 'long-range');
assert.equal(destinations.at(-1), 'long-range');
// With no eligible guest, the host still pulls loot in the outer magnet band.
player.buffs.magnet = 1;
player.x = 600;
Coop.remotePlayers = [];
G.groundItems = [{ id: 'outer-magnet', kind: 'mod', itemId: mod.id, x: 0, y: 0,
  tier: 1, color: mod.color, angle: 0, phase: 0, pickupDelay: 0 }];
G.updateGroundItems(0.1);
assert.ok(G.groundItems[0].x > 0);
assert.notEqual(G.groundItems[0].collected, true);
guest.x = 200;
guest.y = 0;
guest.magnet = true;
Coop.remotePlayers = [guest];
G.updateGroundItems(0);
assert.equal(G.groundItems[0].grantOwner, 'guest', 'legacy guest Magnet still expands the range');
guest.magnet = false;
console.log('Pickup eligibility: different ship ranges and outer magnet attraction passed.');

const sharedGuest = { ...guest, progressionMode: 'shared_v1', shipType: 'kite',
  x: 50, y: 50, buffs: { magnet: 9 }, pickupRadius: 50 };
player.progressionMode = 'shared_v1';
player.buffs.magnet = 0;
player.x = 1000;
player.y = 50;
Coop.remotePlayers = [sharedGuest];
const awards = [], credits = [];
N.ProgressionRuntime = { collect(game, item, collector) {
  awards.push(collector.clientId);
  item.collected = true;
  return { ok: true };
} };
N.PlayerStats = { credit(key, collector) { credits.push([key, collector.clientId]); } };

function sharedPickup(x) {
  G.groundItems = [{ x, y: 50, pickupDelay: 0 }];
  G.updateGroundItems(0);
  return G.groundItems.length === 0;
}

assert.equal(sharedPickup(250), true, 'the active host-owned timer expands guest range');
assert.deepEqual(awards, ['guest']);
assert.deepEqual(credits, [['itemsPickedUp', 'guest']]);
assert.equal(sharedPickup(600), false, 'pickup beyond expanded range stays on the ground');
G.level.layout = { cols: 3, rows: 1, floor: [1, 0, 1] };
assert.equal(sharedPickup(250), false, 'expanded range does not bypass walls');
G.level.layout = null;
sharedGuest.buffs.magnet = 0;
Coop.applyRemoteState({ magnet: true, pickupRadius: 1000, buffs: { magnet: 99 } }, 'guest');
assert.equal(sharedGuest.buffs.magnet, 0, 'guest state cannot refresh an expired buff');
assert.equal(sharedPickup(250), false, 'expired guest falls back to ordinary range');
assert.equal(sharedPickup(125), true, 'ordinary range uses the derived stats');
assert.deepEqual(awards, ['guest', 'guest']);
sharedGuest.buffs.magnet = 9;
player.x = 300;
let hostPickup = 0;
G.collectGroundItem = item => { hostPickup++; item.collected = true; };
assert.equal(sharedPickup(250), true, 'nearer eligible host wins against the magnetized guest');
assert.equal(hostPickup, 1);
assert.equal(awards.length, 2);
assert.equal(credits.length, 2);
console.log('Shared guest pickup: authoritative Magnet, expiry, wall, and derived range passed.');
