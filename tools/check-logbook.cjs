const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const memory=new Map();
const box={window:{NEON:{}},localStorage:{
  getItem:key=>memory.get(key)??null,
  setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)
}};
vm.createContext(box);
for(const name of ['util','content','profile'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),box);
const N=box.window.NEON,P=N.Profile;
assert.equal(N.ENEMY_STYLES.length,32);
assert.deepEqual(Object.keys(N.ENEMY_DESCRIPTIONS).sort(),Array.from(N.ENEMY_STYLES,s=>s.id).sort());
for(const style of N.ENEMY_STYLES){
  assert.ok(N.ROLES[style.role]);
  assert.equal(typeof N.ENEMY_DESCRIPTIONS[style.id],'string');
  assert.match(N.ENEMY_DESCRIPTIONS[style.id],/\.$/);
  assert.ok(N.ENEMY_DESCRIPTIONS[style.id].length>30,style.id+' needs factual copy');
}
memory.set(P.key,JSON.stringify({version:1,stats:{shotsFired:17,shipsDestroyed:4}}));
const migrated=P.reload();
assert.equal(migrated.version,2);
assert.equal(migrated.stats.shotsFired,17);
assert.deepEqual(Object.keys(migrated.book),[]);
memory.set(P.key,JSON.stringify({version:2,stats:{shotsFired:17},book:{
  dart:{seen:true,kills:3},needle:{seen:true,kills:-1},future:{seen:true,kills:9},
  cube:{seen:true,kills:Number.MAX_SAFE_INTEGER+1}
}}));
const cleaned=P.reload();
assert.equal(cleaned.stats.shotsFired,17);
assert.deepEqual(JSON.parse(JSON.stringify(cleaned.book)),{dart:{seen:true,kills:3}});
assert.equal(P.bookSanitized,true);
memory.set(P.key,JSON.stringify({version:2,stats:{shotsFired:17},book:'corrupt'}));
assert.equal(P.reload().stats.shotsFired,17);
assert.deepEqual(Object.keys(P.current().book),[]);
console.log('Logbook: every style has copy; profile migration, unknown IDs and invalid counts passed.');

// Restart the guest's recorder against the same persisted receipt, as a page
// reload/rejoin does. Replayed cumulative confirmation must not become a new kill.
box.setTimeout=()=>1;
box.clearTimeout=()=>{};
box.window.addEventListener=()=>{};
const noop=()=>{};
N.Game={run:{seed:42,startedAt:100},enemies:[],spawnEnemy:noop,killEnemy:noop,
  newRun:noop,saveCheckpoint:noop,gameOver:noop};
N.Coop={isHost:()=>false,isGuest:()=>true,tickSession:noop,finishRun:noop,
  leaveToMenu:noop,endSession:noop};
N.Net={};N.PlayerStats={selectPeer:noop,answerEnd:noop};
const recorder=fs.readFileSync('js/logbook.js','utf8');
vm.runInContext(recorder,box);
N.Logbook.receive({book:{dart:{seen:true,kills:1}}});
N.Logbook.receive({book:{dart:{seen:true,kills:1}}});
N.Logbook.flush();
assert.equal(P.current().book.dart.kills,1);
P.reload();
vm.runInContext(recorder,box);
N.Logbook.receive({book:{dart:{seen:true,kills:1}}});
assert.equal(P.current().book.dart.kills,1);
N.Logbook.receive({book:{dart:{seen:true,kills:2}}});
assert.equal(P.current().book.dart.kills,2);
N.Logbook.flush();
assert.equal(JSON.parse(memory.get(P.key)).bookSession.received.dart.kills,2);
assert.equal(P.current().stats.shotsFired,17);
delete P.current().bookSession;
N.Logbook.receive({book:{dart:{seen:true,kills:2}}});
N.Logbook.flush();
assert.equal(JSON.parse(memory.get(P.key)).bookSession.received.dart.kills,2);
console.log('Logbook guest: repeated confirmations and recorder restart preserve once-only kill credit.');

N.Coop.isHost=()=>true;N.Coop.isGuest=()=>false;
N.Net.peerId='returning';
box.performance={now:()=>1000};
let sent;
N.Net.send=value=>{sent=value;};
N.Game.enemies=[{style:'dart',dead:false}];
N.Logbook.selectPeer('returning',true);
N.Game.enemies=[{style:'needle',dead:false},{style:'ghost',dead:true}];
N.Logbook.selectPeer('returning',true);
N.Logbook.send(true);
assert.equal(sent.book.dart.seen,true);
assert.equal(sent.book.needle.seen,true);
assert.equal(sent.book.ghost,undefined);
console.log('Logbook host: returning participants discover current survivors while keeping earlier discoveries.');
