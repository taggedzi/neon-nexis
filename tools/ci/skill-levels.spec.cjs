const { test, expect } = require('@playwright/test');

test('023 skill selection persists; Medium baseline, multipliers and Hardcore saves', async ({page,browser},testInfo) => {
  console.log('Skills: '+browser.browserType().name()+' '+browser.version());
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await page.locator('#btn-new-run').click();
  await page.locator('#ship-skills [data-skill="hard"]').click();
  await expect(page.locator('#ship-skills [data-skill="hard"]')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:testInfo.outputPath('skill-selection.png')});
  await page.reload();
  await page.locator('#btn-boot').click();
  await page.locator('#btn-new-run').click();
  await expect(page.locator('#ship-skills [data-skill="hard"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#btn-ship-launch').click();
  const result=await page.evaluate(()=>{
    const N=window.NEON,G=N.Game;
    G.pauseGame();
    const selected=G.run.skill;
    const originalRandom=Math.random;
    const rows=[];
    Math.random=()=>.5;
    try{
      for(const sector of [1,10]){
        for(const skill of ['medium','easy','hard','hardcore']){
          G.run.skill=skill;G.run.level=sector;G.level.elapsed=0;
          G.enemies=[];
          const e=G.spawnEnemy(N.ENEMY_BY_ID.dart,G.player.x+500,G.player.y);
          const bullet=G.spawnEnemyBullet({damage:10,speed:200,life:1});
          const copy=G.spawnEnemyBullet({damage:bullet.damage,speed:200,life:1,coopCosmetic:true});
          const shielded=G.spawnEnemy(N.ENEMY_STYLES.find(style=>style.role==='aegis'),G.player.x+500,G.player.y);
          const cap=G.enemyPopulationCap();
          G.enemies=[];G.spawnInitialEnemies();
          rows.push({sector,skill,hp:e.hp,speed:e.speed,contact:e.contact,
            bullet:bullet.damage,cosmetic:copy.damage,projectileSpeed:bullet.speed,
            interval:G.routineSpawnInterval(0,sector),group:G.routineSpawnGroup(0,sector),
            cap,initial:G.enemies.length,shield:shielded.shield});
          G.enemies=[];G.level.spawnTimer=0;G.mode='playing';
          G.updateSpawning(.01);G.pauseGame();
          rows.at(-1).wave=G.enemies.length;
        }
      }
    }finally{Math.random=originalRandom;}
    const legacy={version:1,run:{seed:42,level:1,mapVersion:1},player:{}};
    const oldLoaded=G.loadFromSave(legacy)&&G.run.skill==='medium';
    G.pauseGame();
    const invalid=G.canLoadSave({...legacy,run:{...legacy.run,skill:'impossible'}});
    G.settings.skill='hardcore';G.newRun();G.pauseGame();
    const checkpoint=N.readSave();
    const settings=localStorage.getItem(N.Storage.settingsKey);
    // Other profile data must survive a one-life run.
    localStorage.setItem('skill-test-profile','preserve');
    G.gameOver();
    const death={dead:G.player.dead,stored:N.readSave(),memory:G.lastCheckpoint,
      restore:G.restoreCheckpoint(),fromDeath:G.loadFromSave(checkpoint,true),
      hasCheckpoint:G.getGameOverData().hasCheckpoint,
      settings:settings===localStorage.getItem(N.Storage.settingsKey),
      profile:localStorage.getItem('skill-test-profile')};
    G.settings.skill='medium';G.newRun();G.pauseGame();
    const previous=localStorage.getItem(N.Storage.key);
    const write=N.writeSave;N.writeSave=()=>false;
    G.settings.skill='hardcore';G.newRun();G.pauseGame();
    N.writeSave=write;G.gameOver();
    const preservesOtherRun=previous===localStorage.getItem(N.Storage.key);
    return {selected,rows,oldLoaded,invalid,death,preservesOtherRun};
  });
  expect(result.selected).toBe('hard');
  expect(result.oldLoaded).toBe(true);
  expect(result.invalid).toBe(false);
  expect(result.preservesOtherRun).toBe(true);
  for(const sector of [1,10]){
    const rows=result.rows.filter(row=>row.sector===sector);
    const medium=rows[0];
    expect(medium.hp).toBeCloseTo(17*(1+(sector-1)*.18));
    expect(medium.speed).toBeCloseTo(136*(1+(sector-1)*.018));
    expect(medium.contact).toBeCloseTo(11*(1+(sector-1)*.12));
    expect(medium.interval).toBeCloseTo(sector===1?5:1.4125);
    expect(medium.group).toBe(sector===1?2:5);
    expect(medium.cap).toBe(sector===1?15:120);
    expect(medium.initial).toBe(sector===1?5:14);
    for(const row of rows){
      const easy=row.skill==='easy',normal=row.skill==='medium';
      const strength=normal?1:easy?.8:1.25;
      expect(row.hp/medium.hp).toBeCloseTo(strength);
      expect(row.shield/medium.shield).toBeCloseTo(strength);
      expect(row.contact/medium.contact).toBeCloseTo(strength);
      expect(row.bullet).toBeCloseTo(10*strength);
      expect(row.cosmetic).toBeCloseTo(row.bullet);
      expect(row.projectileSpeed).toBe(200);
      expect(row.speed/medium.speed).toBeCloseTo(normal?1:easy?.9:1.1);
      expect(row.interval/medium.interval).toBeCloseTo(1/(normal?1:easy?.8:1.2));
      expect(row.wave).toBe(row.group);
      expect(row.group).toBe(Math.round(medium.group*(normal?1:easy?.75:1.25)));
      expect(row.initial).toBe(Math.round(medium.initial*(normal?1:easy?.75:1.25)));
    }
  }
  expect(result.death).toEqual({dead:true,stored:null,memory:null,restore:false,
    fromDeath:false,hasCheckpoint:false,settings:true,profile:'preserve'});
  await expect(page.locator('#btn-restore')).toBeDisabled();
  expect(errors).toEqual([]);
});


test('023 skill choices remain keyboard accessible in a compact viewport', async ({page},testInfo) => {
  await page.setViewportSize({width:640,height:600});
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await page.locator('#btn-new-run').click();
  await page.bringToFront();
  // The menu places initial focus on a short timer; settle it before moving.
  await expect(page.locator('#ship-types button').first()).toBeFocused();
  const hardcore=page.locator('#ship-skills [data-skill="hardcore"]');
  await hardcore.focus();
  await expect(hardcore).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#ship-skills [data-skill="hardcore"]')).toBeFocused();
  await expect(page.locator('#ship-skill-note')).toContainText('ONE LIFE');
  await page.locator('#btn-ship-launch').scrollIntoViewIfNeeded();
  await expect(page.locator('#btn-ship-launch')).toBeInViewport();
  await page.screenshot({path:testInfo.outputPath('compact-skills.png')});
  await page.locator('#btn-ship-launch').click();
  expect(await page.evaluate(()=>window.NEON.Game.run.skill)).toBe('hardcore');
});
