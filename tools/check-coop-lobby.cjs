'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { setTimeout: delay } = require('node:timers/promises');

const sandbox = { setTimeout, clearTimeout, location: {search:''} };
sandbox.window = sandbox;
sandbox.NEON = {};
vm.createContext(sandbox);
for(const file of ['util','content','game','ships','loadouts']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',file+'.js'),'utf8'),sandbox);
}
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'coop-host.js'), 'utf8'), sandbox, { filename: 'js/coop-host.js' });

const CoopHost = sandbox.NEON.CoopHost;
assert.equal(typeof CoopHost.createAuthority, 'function');

function harness(graceMs) {
  const messages = [];
  const authority = CoopHost.createAuthority({ peerOfflineGraceMs: graceMs });
  authority.setDeliver((member, message) => messages.push({ clientId: member.clientId, message }));
  return { authority, messages, room: authority.room };
}

async function until(predicate) {
  for (let i = 0; i < 250; i++) {
    if (predicate()) return;
    await delay(20);
  }
  assert.fail('Lobby transition timed out');
}

(async () => {
  const { authority, messages, room } = harness(20);
  try {
    authority.setHost('host', { shipType: 'dart' });
    assert.equal(room.respawns, 4);
    assert.equal(room.host.clientId, 'host');
    authority.handle('host', { t: 'lobby_respawns', count: 8 });
    await until(() => room.respawns === 8);
    for (const count of [-1, 9, 1.5, '4']) authority.handle('host', { t: 'lobby_respawns', count });
    await delay(50);
    assert.equal(room.respawns, 8);

    authority.handle('host', { t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => !!room.launchTimer);
    const revision = room.lobbyRevision;
    authority.handle('host', { t: 'lobby_profile', profile: { shipType: 'kite' } });
    await until(() => !room.launchTimer);
    authority.handle('host', { t: 'lobby_ready', revision });
    await delay(50);
    assert.equal(room.lobbyReady.size, 0);
    assert.equal(room.phase, 'lobby');

    assert.equal(authority.setGuest('guest', {}), true);
    await until(() => room.guest && room.guest.clientId === 'guest');
    authority.handle('guest', { t: 'lobby_respawns', count: 0 });
    authority.handle('host', { t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => room.lobbyReady.size === 1);
    assert.equal(room.launchTimer, null);
    assert.equal(room.respawns, 8);
    authority.handle('guest', { t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => room.phase === 'run');
    assert.equal(room.runId, 1);
    assert.equal(messages.filter(entry => entry.clientId === 'host' && entry.message.t === 'launch').length, 1);
    assert.equal(authority.setGuest('guest', {}), false);
    assert.equal(room.guest.clientId, 'guest');

    authority.handle('host', { t: 'pause_request', runId: room.runId });
    assert.equal(room.pauseState, 'PAUSED');
    const epoch = room.pauseEpoch;
    authority.handle('guest', { t: 'ready_signal', runId: 0, epoch });
    await delay(50);
    assert.equal(room.readyPeers.size, 0);
    authority.handle('guest', { t: 'ready_signal', runId: room.runId, epoch });
    await until(() => room.readyPeers.size === 1);
    assert.equal(room.pauseState, 'PAUSED');
    authority.handle('host', { t: 'ready_signal', runId: room.runId, epoch });
    assert.equal(room.pauseState, 'COUNTDOWN');
    assert.equal(messages.filter(entry => entry.clientId === 'host' && entry.message.t === 'countdown_start').length, 1);
    await until(() => room.pauseState === 'PLAY');
    assert.ok(messages.some(entry => entry.clientId === 'host' && entry.message.t === 'global_resume'));

    authority.markOffline('guest');
    assert.equal(room.guest.online, false);
    assert.equal(room.pauseState, 'PLAY');
    assert.equal(authority.setGuest('guest', { shipType: 'kite' }), true);
    assert.equal(room.pauseState, 'PAUSED');
    assert.equal(room.guest.online, true);

    authority.handle('guest', { t: 'leave' });
    await until(() => !room.guest);
    assert.equal(room.host.clientId, 'host');
    assert.equal(room.pauseState, 'PLAY');
    assert.equal(authority.setGuest('replacement', {}), false, 'run roster excludes replacements');
    assert.equal(authority.setGuest('guest', {}), true, 'starting player can return');
    authority.markOffline('guest');
    await until(() => !room.guest);
    assert.equal(room.host.clientId, 'host');

    authority.handle('host', { t: 'return_lobby', runId: 1 });
    await until(() => room.phase === 'lobby');
    assert.equal(room.lobbyReady.size, 0);
    authority.handle('host', { t: 'lobby_respawns', count: 0 });
    await until(() => room.respawns === 0);
    authority.handle('host', { t: 'lobby_ready', revision: room.lobbyRevision });
    await until(() => room.runId === 2);
    assert.equal(room.phase, 'run');
    authority.handle('host', { t: 'return_lobby', runId: 1 });
    await delay(50);
    assert.equal(room.phase, 'run');

    const four = harness(40);
    try {
      four.authority.setHost('host', {});
      for (let seat = 1; seat <= 3; seat++) {
        assert.equal(four.authority.setGuest('guest' + seat, {}, seat), true);
      }
      assert.equal(four.authority.setGuest('overflow', {}), false);
      assert.deepEqual(Array.from(four.room.guests.values(), member => member.seat), [1, 2, 3]);
      assert.equal(four.messages.at(-1).message.members.length, 4);
      for (const id of ['host', 'guest1', 'guest2']) {
        four.authority.handle(id, { t: 'lobby_ready', revision: four.room.lobbyRevision });
      }
      assert.equal(four.room.launchTimer, null, 'fourth player must ready');
      four.authority.handle('guest3', { t: 'lobby_ready', revision: four.room.lobbyRevision });
      await until(() => four.room.phase === 'run');
      assert.equal(four.room.roster.size, 4);
      four.authority.handle('guest2', { t: 'pause_request', runId: 1 });
      for (const id of ['host', 'guest1', 'guest2']) {
        four.authority.handle(id, { t: 'ready_signal', runId: 1, epoch: four.room.pauseEpoch });
      }
      assert.equal(four.room.pauseState, 'PAUSED');
      four.authority.handle('guest3', { t: 'ready_signal', runId: 1, epoch: four.room.pauseEpoch });
      assert.equal(four.room.pauseState, 'COUNTDOWN');
      four.authority.markOffline('guest2');
      assert.equal(four.room.pauseState, 'PAUSED', 'disconnect cancels countdown');
      await until(() => !four.room.guests.has('guest2'));
      assert.equal(four.room.guests.size, 2, 'only departing seat is removed');
      assert.equal(four.authority.setGuest('stranger', {}, 2), false);
      assert.equal(four.authority.setGuest('guest2', {}, 2), true);
      four.authority.handle('host', { t: 'return_lobby', runId: 1 });
      four.authority.clearGuest('guest2');
      assert.equal(four.authority.setGuest('stranger', {}, 2), true, 'new players join between runs');
    } finally { four.authority.close(); }

    const hung = harness(80);
    hung.authority.setHost('host', {});
    assert.equal(hung.authority.setGuest('guest', {}), true);
    hung.authority.holdOfflineGrace('guest');
    await delay(120);
    assert.equal(hung.room.guest && hung.room.guest.online, true);
    hung.authority.markOffline('guest');
    await delay(50);
    hung.authority.holdOfflineGrace('guest');
    await delay(40);
    assert.ok(hung.room.guest && hung.room.guest.online === false);
    await until(() => !hung.room.guest);

    const linked = harness(40);
    linked.authority.setHost('host', {});
    assert.equal(linked.authority.setGuest('guest', {}), true);
    linked.authority.markOffline('guest');
    linked.authority.holdOfflineGrace('guest');
    assert.equal(linked.authority.setGuest('guest', {}), true);
    await delay(80);
    assert.equal(linked.room.guest && linked.room.guest.clientId, 'guest');
    assert.equal(linked.room.guest.online, true);

    const skills = harness(40);
    try {
      skills.authority.setHost('host', {});
      skills.authority.setGuest('guest', {});
      skills.authority.handle('guest', { t: 'lobby_skill', skill: 'hard' });
      assert.equal(skills.room.skill, 'medium');
      skills.authority.handle('host', { t: 'lobby_ready', revision: skills.room.lobbyRevision });
      assert.equal(skills.room.lobbyReady.size, 1);
      skills.authority.handle('host', { t: 'lobby_skill', skill: 'hardcore' });
      assert.equal(skills.room.skill, 'hardcore');
      assert.equal(skills.room.lobbyReady.size, 0);
      assert.equal(skills.messages.at(-1).message.respawns, 0);
      skills.authority.handle('host', { t: 'lobby_respawns', count: 8 });
      assert.equal(skills.messages.at(-1).message.respawns, 0);
      skills.authority.handle('host', { t: 'lobby_skill', skill: 'invalid' });
      assert.equal(skills.room.skill, 'hardcore');
      skills.authority.handle('host', { t: 'lobby_skill', skill: 'easy' });
      assert.equal(skills.messages.at(-1).message.respawns, 4);
    } finally { skills.authority.close(); }

    const pilots=harness(40),N=sandbox.NEON,G=N.Game;
    G.run={level:7};G.player=G.makePlayer();G.mode='paused';
    const ship=N.Loadouts.capture('Earned');
    try{
      pilots.authority.setHost('host',{});pilots.authority.setGuest('guest',{});
      pilots.authority.handle('host',{t:'lobby_profile',profile:{loadout:ship}});
      pilots.authority.handle('host',{t:'lobby_ready',revision:pilots.room.lobbyRevision});
      assert.equal(pilots.room.lobbyReady.size,0,'saved pilots need host permission');
      pilots.authority.handle('guest',{t:'lobby_loadouts',allow:true});
      assert.equal(pilots.room.allowLoadouts,false);
      pilots.authority.handle('host',{t:'lobby_loadouts',allow:true});
      pilots.authority.handle('host',{t:'lobby_sector',sector:4});
      assert.equal(pilots.room.startSector,1,'fresh guest limits start to sector one');
      const guestShip=JSON.parse(JSON.stringify(ship));guestShip.highestSector=5;
      pilots.authority.handle('guest',{t:'lobby_profile',profile:{loadout:guestShip}});
      pilots.authority.handle('guest',{t:'lobby_sector',sector:5});
      assert.equal(pilots.room.startSector,1,'guest cannot choose the sector');
      pilots.authority.handle('host',{t:'lobby_sector',sector:6});
      assert.equal(pilots.room.startSector,1,'locked sector refused');
      pilots.authority.handle('host',{t:'lobby_sector',sector:5});
      assert.equal(pilots.room.startSector,5);
      pilots.authority.handle('host',{t:'lobby_ready',revision:pilots.room.lobbyRevision});
      pilots.authority.handle('guest',{t:'lobby_profile',profile:{}});
      assert.equal(pilots.room.lobbyReady.size,0);
      assert.equal(pilots.room.startSector,1);
      pilots.authority.handle('host',{t:'lobby_skill',skill:'hardcore'});
      assert.equal(pilots.room.allowLoadouts,false);
      assert.equal(pilots.room.host.profile.loadout,null);
    }finally{pilots.authority.close();}

    console.log('Lobby checks passed: readiness revisions, count bounds, repeated runs, stale controls, replacement, duplicate identity, hosted lifetime, and a hung re-offer.');
  } finally {
    authority.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
