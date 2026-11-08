const {test,expect}=require('@playwright/test');

test('026 encounters, kills and menu copy work independently of stats and survive Hardcore',async({page},info)=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await page.locator('#btn-logbook').click();
  await expect(page.locator('#logbook-note')).toContainText('0 / 32');
  expect(await page.locator('#logbook-entries h3').allTextContents()).toEqual(Array(32).fill('Unknown'));
  await page.locator('#logbook-close').click();
  const result=await page.evaluate(()=>{
    const N=window.NEON,G=N.Game;
    G.settings.trackStats=false;G.settings.skill='hardcore';
    G.newRun();G.pauseGame();G.resetEntityArrays();
    const before={...N.Profile.current().stats};
    const enemy=G.spawnEnemy(N.ENEMY_BY_ID.fractal,G.player.x+100,G.player.y);
    enemy.hp=1;enemy.shield=0;
    const seen=N.Profile.current().book.fractal.seen;
    G.damageEnemy(enemy,100);G.killEnemy(enemy);
    const children=G.enemies.filter(e=>e!==enemy&&!e.dead);
    const childSeen=children.every(e=>N.Profile.current().book[e.style]?.seen);
    G.player.invuln=0;G.damagePlayer(999999,G.player.x,G.player.y);
    N.Logbook.flush();
    return {seen,childSeen,children:children.length,kills:N.Profile.current().book.fractal.kills,
      unchanged:JSON.stringify(before)===JSON.stringify(N.Profile.current().stats),save:N.readSave()};
  });
  expect(result).toEqual({seen:true,childSeen:true,children:2,kills:1,unchanged:true,save:null});
  await page.locator('#btn-gameover-menu').click();
  await page.locator('#btn-logbook').click();
  const entry=page.locator('[data-enemy-style="fractal"]');
  await expect(entry).toContainText('DESTROYED: 1');
  const expected=await page.evaluate(()=>({name:window.NEON.ENEMY_BY_ID.fractal.name,copy:window.NEON.ENEMY_DESCRIPTIONS.fractal}));
  await expect(entry).toContainText(expected.name);
  await expect(entry).toContainText(expected.copy);
  // Screen entry assigns focus asynchronously. Wait for that assignment before
  // moving it ourselves, so it cannot overwrite the keyboard-navigation check.
  await expect(page.locator('#logbook-entries summary').first()).toBeFocused();
  await entry.focus();await expect(entry).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-enemy-style="crawler"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(entry).toBeFocused();
  await page.setViewportSize({width:640,height:720});
  await entry.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('enemy-logbook.png')});
  await page.keyboard.press('Escape');
  await expect(page.locator('#screen-menu')).toBeVisible();
  await page.locator('#btn-logbook').click();
  await page.evaluate(()=>{
    const N=window.NEON,input=N.Input,consume=input.consumePad;
    input.consumePad=button=>button===1;
    try { N.UI.handleGamepad(); } finally { input.consumePad=consume; }
  });
  await expect(page.locator('#screen-menu')).toBeVisible();
  await page.reload();await page.locator('#btn-boot').click();
  await page.locator('#btn-logbook').click();
  await expect(page.locator('[data-enemy-style="fractal"]')).toContainText('DESTROYED: 1');
  expect(errors).toEqual([]);
});

test('026 backup migration and corrupt optional books preserve checkpoints and stats',async({page})=>{
  await page.goto('/');await page.locator('#btn-boot').click();
  const result=await page.evaluate(()=>{
    const N=window.NEON,G=N.Game,P=N.Profile,T=N.SaveTransfer;
    G.newRun();G.pauseGame();
    const enemy=G.spawnEnemy(N.ENEMY_BY_ID.dart,G.player.x+100,G.player.y);
    G.killEnemy(enemy);G.saveCheckpoint(true,'manual');
    const save=N.readSave(),seed=G.run.seed;
    G.completeToMenu();
    const file=T.build().file;
    const original=JSON.stringify(file.profile.book),stats=JSON.stringify(file.profile.stats);
    const older=JSON.parse(JSON.stringify(file));older.fileVersion=3;older.profile.version=1;delete older.profile.book;
    const legacy=T.apply(older).ok&&JSON.stringify(P.current().book)===original;
    P.current().book={};P.flush();
    const restored=T.apply(file).ok&&JSON.stringify(P.current().book)===original;
    const corrupt=JSON.parse(JSON.stringify(file));
    corrupt.profile.book={dart:{seen:true,kills:-1},future:{seen:true,kills:4},needle:{seen:true,kills:2}};
    const accepted=T.apply(corrupt).ok;
    const clean=JSON.stringify(P.current().book)===JSON.stringify({needle:{seen:true,kills:2}});
    const sameStats=JSON.stringify(P.current().stats)===stats;
    const loaded=G.loadFromSave(save)&&G.run.seed===seed;
    G.pauseGame();N.LogbookUI.open('pause');
    return {version:file.fileVersion,legacy,restored,accepted,clean,sameStats,loaded};
  });
  expect(result).toEqual({version:5,legacy:true,restored:true,accepted:true,clean:true,sameStats:true,loaded:true});
  await expect(page.locator('#screen-logbook')).toBeVisible();
  await page.locator('#logbook-close').click();
  await expect(page.locator('#screen-pause')).toBeVisible();
});
