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
for (const file of ['util', 'content', 'world', 'game', 'coop', 'sim']) {
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
