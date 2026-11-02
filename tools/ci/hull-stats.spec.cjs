const { test, expect } = require('@playwright/test');

test('029 hull stats, legacy upgrades, named ships and selection copy', async ({ page, browser }, info) => {
  console.log('Browser: '+browser.browserType().name()+' '+browser.version());
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  await page.goto('/');
  await page.locator('#btn-boot').click();
  await page.locator('#btn-new-run').click();
  for(const [id,hp,shield,speed,damage] of [['dart',80,20,115,100],['delta',140,30,85,100],['kite',100,20,100,100],['talon',75,20,100,125]]){
    await page.locator('#ship-types [data-ship-type="'+id+'"]').click();
    await expect(page.locator('#ship-stats')).toContainText(`HEALTH ${hp} · SHIELD ${shield} · SPEED ${speed}% · DAMAGE ${damage}%`);
  }
  await page.setViewportSize({width:360,height:740});
  await expect(page.locator('#btn-ship-launch')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('hull-selection-narrow.png'),fullPage:true});
  await page.locator('#btn-ship-launch').scrollIntoViewIfNeeded();
  await expect(page.locator('#btn-ship-launch')).toBeInViewport();
  await page.screenshot({path:info.outputPath('hull-selection-narrow-footer.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:720});
  await page.screenshot({path:info.outputPath('hull-selection-desktop.png'),fullPage:true});
  const result=await page.evaluate(()=>{
    const N=window.NEON,G=N.Game;
    G.newRun({shipType:'talon'});G.pauseGame();
    const fresh=JSON.stringify(G.player.stats);
    G.rebuildStats(G.player);const stable=fresh===JSON.stringify(G.player.stats);
    G.player.passives=[];G.rebuildStats(G.player);
    const bare=[G.player.stats.maxHp,G.player.stats.maxShield,G.player.stats.moveSpeed,G.player.stats.damageMul];
    const legacy=N.deepClone(N.readSave());delete legacy.player.hullStatsVersion;
    legacy.player.passives=[];legacy.player.hp=100;
    G.loadFromSave(legacy);G.pauseGame();
    const old=[G.player.stats.maxHp,G.player.stats.maxShield,G.player.stats.moveSpeed,G.player.stats.damageMul];
    G.player.passives=[{id:'vector',stacks:1}];G.rebuildStats(G.player);
    const upgraded=G.player.stats.moveSpeed;
    G.saveCheckpoint(true,'old-upgraded');G.restoreCheckpoint();G.pauseGame();
    const retained=G.player.stats.moveSpeed===upgraded&&G.player.stats.maxHp===100;
    const captured=N.Loadouts.capture('Legacy Talon');
    G.newRun(null,{loadout:captured});G.pauseGame();
    const named=[G.player.shipType,G.player.stats.maxHp,G.player.stats.damageMul,G.player.hp===G.player.stats.maxHp];
    const invalid=N.deepClone(N.readSave());invalid.player.hullStatsVersion=2;
    const rejected=!G.canLoadSave(invalid);
    const unchanged=Object.keys(N.BASE_STATS).filter(key=>!['maxHp','maxShield','speed','damageMul'].includes(key)).every(key=>N.Ships.types.every(type=>N.Ships.baseStats({shipType:type.id,hullStatsVersion:1})[key]===N.BASE_STATS[key]));
    return {stable,bare,old,retained,named,rejected,unchanged};
  });
  expect(result).toEqual({stable:true,bare:[75,20,245,1.25],old:[100,20,245,1],retained:true,named:['talon',75,1.25,true],rejected:true,unchanged:true});
  expect(errors).toEqual([]);
});
