/* Event-based match tallies and local lifetime totals. */
(function () {
  'use strict';
  const N = window.NEON, G = N.Game, P = N.Profile;
  const S = N.PlayerStats = {};
  S.labels = ['Shots fired', 'Shots hit', 'Ships destroyed', 'Objectives destroyed',
    'Hits taken', 'Items picked up', 'Items discarded', 'Items lost on death'];
  S.match = P.emptyStats();
  S.remote = null;
  S.fire = null;
  S.activeShot = null;
  S.remoteFire = null;
  let serial = 0, flushTimer = null, dirty = false, rowSequence = 0, sentAt = 0, currentRun = '', dirtyRun = null, warnedStorage = false;
  const authorityKeys = ['shotsFired','shotsHit','shipsDestroyed','objectivesDestroyed','itemsPickedUp','hitsTaken'];
  S.received = P.emptyStats();
  S.authority = P.emptyStats();
  S.lastBoard = null;
  S.peers = new Map();
  const authorities = new Map();
  const peerId = () => N.Net.peerId || N.Coop._peerId || '';
  S.peerRow = id => S.peers.get(id) || null;
  S.selectPeer = function(id){
    S.remote=S.peerRow(id);
    if(!authorities.has(id))authorities.set(id,P.emptyStats());
    S.authority=authorities.get(id);
  };
  const runKey = () => String(G.run?.seed)+'|'+String(G.run?.startedAt);
  function retain() {
    if(N.Dev?.isScenario())return;
    const profile=P.current();
    // Keep references to validated active counters; serialize them atomically with
    // lifetime totals on flush, rather than allocating copies for every shot.
    if(profile) profile.session={id:currentRun,match:S.match,received:S.received,authority:S.authority};
    dirty=true;dirtyRun=G.run;
    if(!flushTimer) flushTimer=setTimeout(S.flush,2000);
  }
  S.enabled = () => G.settings.trackStats !== false;
  S.isRemote = player => !!N.Coop?.isHost() && !!player?.remote;
  S.record = function (key, count = 1) {
    if (!S.enabled() || !P.statKeys.includes(key) || !Number.isSafeInteger(count) || count < 1) return;
    S.match[key] = Math.min(Number.MAX_SAFE_INTEGER, S.match[key] + count);
    if (G.run) G.run.tally = S.match;
    if(!N.Dev?.isScenario())P.addStat(key, count);
    retain();
    N.StatsUI?.refresh();
  };
  S.flush = function (manual = false) {
    clearTimeout(flushTimer); flushTimer = null;
    if(N.Dev?.isScenario(dirtyRun) && manual!==true)return;
    if(dirty){
      if(P.flush()){dirty=false;warnedStorage=false;}
      else if(!warnedStorage){
        warnedStorage=true;
        N.UI?.toast('LIFETIME TOTALS COULD NOT BE SAVED. EXISTING PROFILE DATA WAS PRESERVED.','warn');
      }
    }
  };
  S.begin = function (saved) {
    S.flush(); S.match = P.validStats(saved) ? P.cleanStats(saved) : P.emptyStats();
    S.remote = null; S.peers.clear();authorities.clear();rowSequence = 0; sentAt = 0; currentRun=runKey();
    S.received=P.emptyStats(); S.authority=P.emptyStats(); S.lastBoard=null;
    if (G.run) G.run.tally = S.match;
    retain();
  };
  S.recoverGuest = function (peer) {
    if(currentRun===runKey()){G.run.tally=S.match;return;}
    S.flush();
    const saved=P.current()?.session;
    const state=saved?.id===runKey()?saved:null;
    S.match=P.cleanStats(state?.match||peer?.row);
    const received=state?.received||peer?.received;
    S.received=P.validStats(received)?P.cleanStats(received):P.emptyStats();
    S.authority=P.emptyStats(); currentRun=runKey();
    S.remote=null;S.peers.clear();S.lastBoard=null;
    rowSequence=Math.max(rowSequence,peer?.sequence||0);sentAt=0;
    G.run.tally=S.match;retain();
  };
  S.emit = function (entity) {
    if (entity.coopCosmetic || entity.owner === 'enemy') return null;
    const player = entity.coopPlayer || (typeof entity.owner === 'object' ? entity.owner : G.player);
    const remote = S.isRemote(player);
    const progression = player?.progressionMode === 'shared_v1' && typeof entity.activationId === 'string';
    const fire = S.fire || { id: progression ? entity.activationId : remote ? 0 : ++serial, index: 0 };
    const shot = { fire: fire.id, index: ++fire.index, player, remote,
      eligible: remote ? progression || fire.id > 0 : S.enabled(), hit: false };
    entity.tallyShot = shot;
    if (remote && progression) S.credit('shotsFired', player);
    else if (!remote) S.record('shotsFired');
    return shot;
  };
  S.credit = function (key, player) {
    if (S.isRemote(player)) {
      const id=player.statsPeerId||peerId();
      if(!authorities.has(id))authorities.set(id,P.emptyStats());
      const totals=authorities.get(id);
      totals[key]=Math.min(Number.MAX_SAFE_INTEGER,totals[key]+1);
      if(id===peerId())S.authority=totals;
      retain();
    } else S.record(key);
  };
  S.hit = function (shot) {
    if (!shot || !shot.eligible || shot.hit) return;
    shot.hit = true;
    S.credit('shotsHit', shot.player, shot);
  };
  S.receiveAuthority = function (totals) {
    if(!N.Coop.isGuest() || !P.validStats(totals)) return;
    for(const key of authorityKeys){
      const next=totals[key]||0;
      if(next<=S.received[key]) continue;
      const delta=next-S.received[key]; S.received[key]=next;
      S.record(key,delta);
    }
    retain();
  };
  S.sendRow = function (force = false) {
    if (!N.Coop?.isActive()) return;
    const now = performance.now();
    if (!force && now - sentAt < 250) return;
    sentAt = now;
    const sequence = ++rowSequence;
    const body = { t: 'stats_row', sequence, enabled: S.enabled(), row: { ...S.match }, received: { ...S.received } };
    if (N.Coop.isHost()) {
      const peers = Array.from(S.peers.values());
      for (const player of N.Coop.remotePlayers) {
        const id = player.clientId || player.statsPeerId || peerId();
        N.Net.send({ ...body, authority: { ...(authorities.get(id) || P.emptyStats()) }, peers }, id);
      }
    } else {N.Net.send({ ...body, authority: null });}
  };
  S.receiveRow = function (message, senderId) {
    if (N.Coop.isGuest()) {S.receiveAuthority(message.authority);}
    if (!Number.isSafeInteger(message.sequence) || message.sequence < 1 || !P.validStats(message.row) || !P.validStats(message.received)) return;
    const id = senderId || peerId(), previous = S.peerRow(id);
    if (previous && message.sequence <= previous.sequence) return;
    const profile = N.Coop.lobby?.members.find(member => member.clientId === id)?.profile;
    S.remote = { name: profile?.name || N.Coop.peerProfile?.name || 'TEAMMATE', id,
      sequence: message.sequence, enabled: message.enabled !== false,
      row: P.cleanStats(message.row), received: P.cleanStats(message.received) };
    S.peers.set(id, S.remote);
    if (N.Coop.isGuest() && Array.isArray(message.peers)) {
      for (const peer of message.peers.slice(0, 64)) {
        if (!peer || typeof peer.id !== 'string' || peer.id === N.Net.clientId || peer.id === id ||
            !P.validStats(peer.row) || !P.validStats(peer.received) || !Number.isSafeInteger(peer.sequence)) {continue;}
        const old = S.peers.get(peer.id);
        if (!old || peer.sequence > old.sequence) {S.peers.set(peer.id, {
          id: peer.id, name: String(peer.name || 'TEAMMATE').slice(0, 20), sequence: peer.sequence,
          enabled: peer.enabled !== false, row: P.cleanStats(peer.row), received: P.cleanStats(peer.received)
        });}
      }
    }
  };
  function wrap(object, name, action) {
    const original = object[name];
    object[name] = function (...args) { return action(original, args); };
  }
  wrap(G, 'fireWeapon', (original, args) => {
    const previous = S.fire;
    const remote = S.isRemote(G.coopFiringPlayer || G.player);
    S.fire = { id: remote ? (S.remoteFire || 0) : (S.enabled() ? ++serial : 0), index: 0 };
    try { return original(...args); } finally { S.fire = previous; }
  });
  for (const name of ['beam','arcBolt']) {
    wrap(G, name, (original, args) => {
      const previous = S.activeShot;
      S.activeShot = S.emit({ coopPlayer: G.coopFiringPlayer || G.player });
      try { return original(...args); } finally { S.activeShot = previous; }
    });
  }
  wrap(G, 'explode', (original, args) => {
    const previous = S.activeShot;
    S.activeShot = args[6]?.shot || previous;
    try { return original(...args); } finally { S.activeShot = previous; }
  });
  for (const [name, hpKey, aliveKey] of [['damageEnemy','hp','dead'],['damageAnchor','hp','alive']]) {
    wrap(G, name, (original, args) => {
      const target = args[0], opts = args[2] || {};
      const before = target ? target[hpKey] + (target.shield || 0) : 0;
      const wasAlive = target && (aliveKey === 'dead' ? !target.dead : target.alive);
      const previous = S.activeShot;
      const shot = opts.shot || previous;
      S.activeShot = shot;
      try {
        const result = original(...args);
        if (target && target[hpKey] + (target.shield || 0) < before) S.hit(shot);
        if (name === 'damageAnchor' && wasAlive && !target.alive && !N.Coop?.blocksLocalDamage()) {
          S.credit('objectivesDestroyed', opts.player || shot?.player || G.player);
        }
        return result;
      } finally { S.activeShot = previous; }
    });
  }
  wrap(G, 'killEnemy', (original, args) => {
    const alive = args[0] && !args[0].dead;
    const player = args[1]?.player || S.activeShot?.player || G.player;
    const result = original(...args);
    if (alive && args[0].dead && !args[1]?.exploded) S.credit('shipsDestroyed', player);
    return result;
  });
  wrap(G, 'damagePlayer', (original, args) => {
    const player = G.player;
    const total = item => item.hp + item.shield +
      (item.progressionMode === 'shared_v1' && item.barrier?.windowSeconds > 0 ? item.barrier.capacity : 0);
    const before = player ? total(player) : 0;
    const result = original(...args);
    if (player && !S.isRemote(player) && total(player) < before){S.record('hitsTaken');if(player.dead)S.flush();}
    return result;
  });
  wrap(N.Coop, 'sendHit', (original, args) => {
    const player = args[0];
    if (player?.progressionMode !== 'shared_v1' || !S.isRemote(player)) return original(...args);
    const total = () => player.hp + player.shield +
      (player.barrier?.windowSeconds > 0 ? player.barrier.capacity : 0);
    const before = total();
    const result = original(...args);
    if (result && total() < before) S.credit('hitsTaken', player);
    return result;
  });
  wrap(G, 'collectGroundItem', (original, args) => {
    const item = args[0], already = item?.collected;
    const banked = N.Rewards.state().pending.includes(item);
    const result = original(...args);
    if (item && !already && item.collected && !args[2] && !banked) S.record('itemsPickedUp');
    return result;
  });
  wrap(G, 'dropItem', (original, args) => {
    const result = original(...args);
    if (result) S.record('itemsDiscarded');
    return result;
  });
  wrap(G, 'discardReward', (original, args) => {
    const before = N.Rewards.state().pending.length;
    const result = original(...args);
    if (N.Rewards.state().pending.length < before) S.record('itemsDiscarded');
    return result;
  });
  wrap(G, 'swapOverflow', (original, args) => {
    const pending = G.overflow;
    const result = original(...args);
    if (pending && !G.overflow) S.record('itemsDiscarded');
    return result;
  });
  wrap(G, 'newRun', (original, args) => {
    const before = G.run, result = original(...args);
    if (G.run !== before) S.begin();
    return result;
  });
  wrap(G, 'loadFromSave', (original, args) => {
    const result = original(...args);
    if (result) S.begin(args[0].run.tally);
    return result;
  });
  wrap(G, 'saveCheckpoint', (original, args) => { S.flush(args[1]==='manual'); return original(...args); });
  wrap(N.Coop, 'onGuestFire', (original, args) => {
    S.remoteFire = Number.isSafeInteger(args[0].statsFire)&&args[0].statsFire>=0?args[0].statsFire:0;
    try { return original(...args); } finally { S.remoteFire = null; }
  });
  function inventoryKeys(player, rewards) {
    const progression = player?.progression || player?.snapshot?.progression;
    if (progression) {
      return [...progression.offensive.filter(Boolean).map(item => 'weapon:' + item.id),
        ...(progression.defensive ? ['defense:' + progression.defensive.id] : []),
        ...Object.keys(progression.passives).map(id => 'mod:' + id)];
    }
    return [...(player?.weapons||[]).map(item=>'weapon:'+item.id),
      ...(player?.passives||[]).map(item=>'mod:'+item.id),
      ...(rewards?.pending||[]).map(item=>item.kind+':'+item.itemId)];
  }
  function soloLosses() {
    const stored=N.readSave()||G.lastCheckpoint;
    const protectedSave=G.run?.skill!=='hardcore'&&G.canLoadSave(stored)?stored:null;
    const protectedItems=inventoryKeys(protectedSave?.player,protectedSave?.rewards);
    let lost=0;
    for(const key of inventoryKeys(G.player,N.Rewards.snapshot())){
      const index=protectedItems.indexOf(key);
      if(index>=0) protectedItems.splice(index,1); else lost++;
    }
    return lost;
  }
  S.endLocal = function () {
    if(!G.run||!G.player) return;
    S.sendRow(true); S.flush();
    const coop=N.Coop.isActive();
    const own={name:coop?N.Coop.localProfile.name:'PLAYER',enabled:S.enabled(),row:S.match};
    const peers=coop?Array.from(S.peers.values()).map(peer=>({name:peer.name,enabled:peer.enabled,row:peer.row})):[];
    if(coop&&N.Coop.remotePlayers.length&&!S.peerRow(peerId())){
      peers.push({name:N.Coop.peerProfile?.name||'TEAMMATE',enabled:true,row:null});
    }
    const names=peers.map(peer=>peer.name);
    peers.forEach((peer,index)=>{if(names.filter(name=>name===peer.name).length>1)peer.name+=' (participant '+(index+1)+')';});
    const rows=N.Coop.isGuest()?[...peers,own]:[own,...peers];
    S.lastBoard={rows,coop,summary:G.getGameOverData()};
  };
  wrap(G,'gameOver',(original,args)=>{
    if(!N.Coop.isActive()&&G.player&&!G.player.dead&&G.mode!=='gameover'&&G.mode!=='complete'){
      S.record('itemsLost',soloLosses());S.endLocal();
    }
    return original(...args);
  });
  wrap(N.Coop,'onLocalDeath',(original,args)=>{
    if(N.Coop.active&&G.player&&!G.player.dead) S.record('itemsLost',N.Rewards.state().pending.length);
    const result=original(...args);S.sendRow(true);S.flush();return result;
  });
  wrap(G,'leaveOverflow',(original,args)=>{
    const pending=G.overflow;const result=original(...args);
    if(pending&&!G.overflow)S.record('itemsDiscarded');
    return result;
  });
  let ending=null,endTimer=null,endSentAt=0;
  const endWaiting = new Set();
  const finishRun=N.Coop.finishRun;
  function completeEnd() {
    if(!ending)return;
    const args=ending;ending=null;clearTimeout(endTimer);endTimer=null;
    S.endLocal();finishRun(...args);
  }
  function requestEnd() {
    endSentAt=performance.now();S.sendRow(true);
    for (const id of endWaiting) {
      N.Net.send({t:'stats_end_request',authority:{...(authorities.get(id) || P.emptyStats())}}, id);
    }
  }
  N.Coop.finishRun=function(...args){
    if(!N.Coop.isHost()||ending)return;
    if(!N.Coop.remotePlayers.length){S.endLocal();return finishRun(...args);}
    endWaiting.clear();
    for (const player of N.Coop.remotePlayers) {endWaiting.add(player.clientId || player.statsPeerId || peerId());}
    ending=args;G.setMode('gameover');requestEnd();endTimer=setTimeout(completeEnd,2000);
  };
  S.answerEnd=function(message){
    if(!N.Coop.isGuest())return;
    S.receiveAuthority(message.authority);S.sendRow(true);S.flush();
    N.Net.send({t:'stats_end_ack'});
  };
  S.finishEnd=function(id){
    if (!N.Coop.isHost()) {return;}
    endWaiting.delete(id || peerId());
    if (!endWaiting.size) {completeEnd();}
  };
  wrap(N.Coop,'tickSession',(original,args)=>{
    const result=original(...args);S.sendRow();
    if(ending&&performance.now()-endSentAt>300)requestEnd();
    return result;
  });
  for(const name of ['leaveToMenu','endSession']){
    wrap(N.Coop,name,(original,args)=>{
      const active=N.Coop.isActive();
      if(active)S.endLocal();
      ending=null;clearTimeout(endTimer);endTimer=null;
      const result=original(...args);
      if(active&&S.enabled()&&name!=='leaveToMenu')N.StatsUI?.showEnd('coop');
      return result;
    });
  }
  for(const name of ['saveAndQuit','completeToMenu']){
    wrap(G,name,(original,args)=>{
      const solo=!N.Coop.isActive()&&G.run&&G.player;
      if(solo)S.endLocal();
      return original(...args);
    });
  }
  window.addEventListener('pagehide', S.flush);
})();
