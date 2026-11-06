const {test,expect}=require('@playwright/test');

async function deathFit(page){
  return page.locator('#screen-gameover').evaluate(root => {
    const scrolling = [root, document.documentElement, document.body, ...root.querySelectorAll('*')].filter(el => {
      if (!el.getClientRects().length) return false;
      const style = getComputedStyle(el);
      const vertical = ['auto', 'scroll'].includes(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
      const horizontal = ['auto', 'scroll'].includes(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
      return vertical || horizontal;
    }).map(el => el.id || String(el.className));
    const tables = [...root.querySelectorAll('.death-tally-table')];
    const rects = tables.map(el => el.getBoundingClientRect());
    const title = root.querySelector('.fatal-glitch').getBoundingClientRect();
    return {
      scrolling,
      tables: tables.length,
      sideBySide: rects.length === 2 && Math.abs(rects[0].top - rects[1].top) < 2 && rects[1].left > rects[0].right - 1,
      left: tables[0] ? tables[0].textContent : '',
      right: tables[1] ? tables[1].textContent : '',
      clipped: root.scrollHeight > root.clientHeight + 2 || root.scrollWidth > root.clientWidth + 2,
      titleInside: title.left >= 1 && title.right <= window.innerWidth - 1 && title.top >= 1 && title.bottom <= window.innerHeight - 1,
      title: {left: title.left, right: title.right, top: title.top, bottom: title.bottom},
      zoom: root.firstElementChild && root.firstElementChild.style.zoom || ''
    };
  });
}

test('025 combat counters count emitted shots once, including shields and persistent attacks',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.locator('#btn-boot').click();
  const result=await page.evaluate(()=>{
    const N=window.NEON,G=N.Game,S=N.PlayerStats;
    G.newRun();G.pauseGame();G.resetEntityArrays();
    const e=G.spawnEnemy(N.ENEMY_BY_ID.dart,G.player.x+100,G.player.y);e.hp=1;e.shield=0;
    const bullet=G.spawnBullet({x:e.x,y:e.y,angle:0,speed:0,damage:3,pierce:3,life:10});
    G.updatePlayerBullets(0);
    const first={...S.match};
    const second=G.spawnEnemy(N.ENEMY_BY_ID.dart,e.x,e.y);second.hp=100;second.shield=0;
    G.damageEnemy(second,1,{shot:bullet.tallyShot});
    G.damageEnemy(second,1,{shot:bullet.tallyShot});
    const anchor=G.level.anchors[0];anchor.hp=1;
    G.damageAnchor(anchor,2,{shot:bullet.tallyShot});
    const piercing={...S.match};
    const shieldShot=G.spawnBullet({x:second.x,y:second.y,speed:0,damage:1,life:10});
    second.shield=10;const hp=second.hp;
    G.damageEnemy(second,1,{shot:shieldShot.tallyShot});
    const shieldHit=S.match.shotsHit,shieldOnly=second.hp===hp&&second.shield===9;
    G.enemies=[];G.level.anchors=[];G.level.caches=[];
    G.spawnMine({x:G.player.x,y:G.player.y,owner:'player'});
    G.spawnStrike({x:G.player.x,y:G.player.y});
    G.spawnOrbital({count:2});G.beam(0,1,'#00f0ff',100,3);G.arcBolt(0,1,'#00f0ff',2,100);
    G.spawnBullet({coopCosmetic:true});
    G.player.invuln=0;G.player.shield=5;
    G.damagePlayer(2,G.player.x,G.player.y);
    G.damagePlayer(2,G.player.x,G.player.y);
    const item=G.spawnGroundLoot({kind:'consumable',id:'repair'},G.player.x,G.player.y);
    G.collectGroundItem(item);G.collectGroundItem(item);
    G.player.weapons.push(G.makeWeapon('scatter'));G.dropItem('weapon',1);G.dropItem('weapon',0);
    S.flush();
    return {first,piercing,shieldHit,shieldOnly,final:{...S.match},lifetime:{...N.Profile.current().stats}};
  });
  expect(result.first.shotsFired).toBe(1);expect(result.first.shotsHit).toBe(1);expect(result.first.shipsDestroyed).toBe(1);
  expect(result.piercing.shotsHit).toBe(1);expect(result.piercing.objectivesDestroyed).toBe(1);
  expect(result.shieldHit).toBe(2);expect(result.shieldOnly).toBe(true);
  expect(result.final).toEqual({shotsFired:8,shotsHit:2,shipsDestroyed:1,objectivesDestroyed:1,hitsTaken:1,itemsPickedUp:1,itemsDiscarded:1,itemsLost:0});
  expect(result.lifetime).toEqual(result.final);expect(errors).toEqual([]);
});

test('025 toggle, Hardcore loss, end board and lifetime backup preserve existing data',async({page},info)=>{
  await page.goto('/');await page.locator('#btn-boot').click();
  await page.evaluate(()=>{
    const N=window.NEON,G=N.Game;
    G.settings.skill='hardcore';G.newRun();G.pauseGame();
    G.player.weaponSlots=1;
    G.collectGroundItem({kind:'weapon',itemId:'scatter',tier:1,collected:false});
    G.player.invuln=0;G.damagePlayer(99999,G.player.x,G.player.y);
  });
  await expect(page.locator('#gameover-tally')).toBeVisible();
  await expect(page.locator('#gameover-stats')).toContainText('SECTOR');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const fit = await deathFit(page);
  expect(fit.scrolling).toEqual([]);
  expect(fit.tables).toBe(2);
  expect(fit.sideBySide).toBe(true);
  expect(fit.left).toContain('Shots fired');
  expect(fit.right).toContain('Items lost on death');
  expect(fit.clipped).toBe(false);
  expect(fit.titleInside).toBe(true);
  const before=await page.evaluate(()=>({match:{...window.NEON.PlayerStats.match},stats:{...window.NEON.Profile.current().stats},save:window.NEON.readSave()}));
  expect(before.match.itemsLost).toBe(3);expect(before.match.hitsTaken).toBe(1);expect(before.save).toBeNull();
  await page.locator('#gameover-tally').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('match-tally.png')});
  await page.locator('#btn-gameover-menu').click();
  await expect(page.locator('#screen-menu.active')).toBeVisible();
  await expect(page.locator('#screen-menu')).not.toContainText('MATCH TALLY');
  await expect(page.locator('#btn-player-stats')).toBeVisible();
  await page.locator('#btn-player-stats').click();
  await page.locator('#stats-toggle').click();await expect(page.locator('#stats-toggle')).toHaveAttribute('aria-pressed','false');
  const stopped=await page.evaluate(()=>{
    const N=window.NEON,G=N.Game,S=N.PlayerStats;
    const before=JSON.stringify(N.Profile.current().stats);
    G.newRun();G.pauseGame();G.spawnBullet({damage:10});G.gameOver();S.flush();
    return before===JSON.stringify(N.Profile.current().stats);
  });
  expect(stopped).toBe(true);await expect(page.locator('#gameover-tally')).toBeHidden();
  await page.locator('#btn-gameover-menu').click();
  const backup=await page.evaluate(()=>window.NEON.SaveTransfer.build().file);
  expect(backup.fileVersion).toBe(4);expect(backup.profile.stats.itemsLost).toBe(3);
  const restore=await page.evaluate(file=>{
    const N=window.NEON;
    const old={...file,fileVersion:2};delete old.profile;
    const existing=JSON.stringify(N.Profile.current().stats);
    const legacy=N.SaveTransfer.apply(old);
    const preserved=existing===JSON.stringify(N.Profile.current().stats);
    const invalid=JSON.parse(JSON.stringify(file));invalid.profile.stats.itemsLost=-1;
    const bad=N.SaveTransfer.apply(invalid);
    const applied=N.SaveTransfer.apply(file);
    return {legacy,preserved,bad,applied};
  },backup);
  expect(restore.legacy.ok).toBe(true);expect(restore.preserved).toBe(true);expect(restore.bad.ok).toBe(false);expect(restore.applied.ok).toBe(true);
  await page.reload();await page.locator('#btn-boot').click();await page.locator('#btn-player-stats').click();
  await expect(page.locator('#stats-toggle')).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>window.NEON.Profile.current().stats.itemsLost)).toBe(3);
});

for (const size of [{width:1280,height:720},{width:900,height:700},{width:1100,height:640},{width:360,height:640},{width:1280,height:720,fallback:true}]) {
  test.describe('death screen '+size.width+'x'+size.height+(size.fallback?' fallback fonts':''),()=>{
    test.use({viewport:{width:size.width,height:size.height}});
    test('solo tally is two tables and the screen fits',async({page})=>{
      await page.goto('/');await page.locator('#btn-boot').click();
      if (size.fallback) {
        await page.addStyleTag({content:':root{--display:sans-serif;--mono:monospace}'});
      }
      await page.evaluate(()=>{
        const G=window.NEON.Game;
        G.settings.skill='hardcore';G.newRun();G.pauseGame();
        G.player.invuln=0;G.damagePlayer(99999,G.player.x,G.player.y);
      });
      await expect(page.locator('#gameover-tally')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const fit = await deathFit(page);
      expect(fit.scrolling).toEqual([]);
      expect(fit.tables).toBe(2);
      expect(fit.sideBySide).toBe(true);
      expect(fit.left).toContain('Shots fired');
      expect(fit.right).toContain('Items lost on death');
      expect(fit.clipped).toBe(false);
      expect(fit.titleInside).toBe(true);
    });
  });
}


test('025 optional tally corruption preserves progress and memory checkpoints retain snapshots',async({page})=>{
  await page.goto('/');await page.locator('#btn-boot').click();
  const result=await page.evaluate(()=>{
    const N=window.NEON,G=N.Game,S=N.PlayerStats;
    G.newRun();G.pauseGame();G.spawnBullet({damage:1});G.saveCheckpoint(true,'manual');
    const snapshot=G.lastCheckpoint;G.spawnBullet({damage:1});
    const memorySnapshot=snapshot.run.tally.shotsFired;
    const lifetime=N.Profile.current().stats.shotsFired;
    const bad=JSON.parse(JSON.stringify(snapshot));bad.run.tally={shotsFired:-1};
    const loaded=G.loadFromSave(bad);
    const progress=G.run.seed===bad.run.seed&&G.player.level===bad.player.level;
    const ignored=S.match.shotsFired===0;
    const preserved=N.Profile.current().stats.shotsFired===lifetime;
    G.pauseGame();
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key===N.Profile.key)throw Error('quota');return set.call(this,key,value);};
    G.spawnBullet({damage:1});S.flush();
    const failed=N.Profile.lastWriteOk===false;
    Storage.prototype.setItem=set;S.flush();
    const retried=N.Profile.lastWriteOk===true;
    return {memorySnapshot,loaded,progress,ignored,preserved,failed,retried};
  });
  expect(result).toEqual({memorySnapshot:1,loaded:true,progress:true,ignored:true,preserved:true,failed:true,retried:true});
});
