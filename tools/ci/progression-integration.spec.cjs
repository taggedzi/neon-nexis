'use strict';
const {test,expect}=require('@playwright/test');

test('all hulls progress without choice screens and checkpoint without duplicate healing',async({page,browser},info)=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/');await page.locator('#btn-boot').click();
  const result=await page.evaluate(()=>{
    const N=window.NEON,G=N.Game;
    const rows=[];
    for(const hull of ['kite','dart','delta','talon']){
      G.newRun({shipType:hull});G.player.invuln=1e9;
      const give=category=>{
        const item=G.spawnGroundLoot({kind:'equipment',id:category,color:'#b6ff2b'},G.player.x,G.player.y,'TEST');
        const result=N.ProgressionRuntime.collect(G,item);
        if(!result.ok)throw Error(result.reason);
      };
      for(const category of ['offensive','offensive','defensive',...Array(5).fill('primary'),...Array(20).fill('passive')])give(category);
      const source=G.spawnEnemy(N.ENEMY_BY_ID.dart,G.player.x+300,G.player.y);
      G.addXp(1800,source);
      if(G.mode!=='playing'||G.pendingLevelUps!==0||N.Rewards.count()!==0)throw Error('Progression opened a choice screen');
      const p=G.player;
      p.hp=Math.min(30,p.stats.maxHp);p.shield=3;
      p.progression.offensive[1].cooldownSeconds=.65;
      p.progression.defensive.cooldownSeconds=2;
      const before={state:N.deepClone(p.progression),hp:p.hp,shield:p.shield,stats:N.deepClone(p.stats)};
      if(!G.saveCheckpoint(true,'integration'))throw Error('Checkpoint rejected');
      const stored=N.readSave();
      if(!G.loadFromSave(stored)||!G.loadFromSave(stored))throw Error('Checkpoint could not continue twice');
      const next=G.player;
      if(!G.enemies.length)throw Error('Continuation lost the established initial encounter policy');
      rows.push({hull,primary:next.progression.offensive[0].id,slots:next.progression.offensive.filter(Boolean).length,
        defense:!!next.progression.defensive,level:next.level,mode:G.mode,
        equivalent:JSON.stringify(before.state)===JSON.stringify(next.progression)&&before.hp===next.hp&&before.shield===next.shield&&JSON.stringify(before.stats)===JSON.stringify(next.stats)});
    }
    G.player.progression.selectedOffensiveSlot=1;
    G.player.progression.defensive.cooldownSeconds=0;
    G.player.barrier={capacity:25,windowSeconds:2,lockoutSeconds:0};
    G.render(0);
    return rows;
  });
  expect(result.map(row=>row.primary)).toEqual(['pulse_repeater','needle_blaster','scatter_cannon','rail_lance']);
  for(const row of result){expect(row.slots).toBe(3);expect(row.defense).toBe(true);expect(row.level).toBeGreaterThan(1);expect(row.equivalent).toBe(true);expect(row.mode).toBe('playing');}
  await page.screenshot({path:info.outputPath('progression-hud-desktop.png')});
  await page.setViewportSize({width:640,height:600});
  await page.screenshot({path:info.outputPath('progression-hud-compact.png')});
  expect(errors).toEqual([]);
  console.log('Integrated hulls: '+browser.browserType().name()+' '+browser.version()+' '+JSON.stringify(result));
});

// Explicit measurement run: does not turn software/headless observations into
// real-player performance acceptance, and is not part of routine short checks.
test('scripted normal, heavy and accelerated retention measurements',async({page,browser},info)=>{
  test.skip(process.env.NEON_PROGRESSION_MEASURE!=='1','Opt-in performance evidence');
  test.setTimeout(300000);
  await page.addInitScript(()=>{
    window.__benchmarkRAF=window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame=()=>0;
  });
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('/');
  await page.addScriptTag({url:'/tools/performance/benchmark.js'});
  const rows=[];
  for(const options of [{scenario:'normal',frames:600},{scenario:'large-wave',frames:600},
    {scenario:'normal',frames:72000,renderEvery:60}]){
    await page.evaluate(options=>window.NeonBenchmark.start(options),options);
    await expect.poll(()=>page.evaluate(()=>window.NeonBenchmark.running===null),{timeout:240000,intervals:[500]}).toBe(true);
    rows.push(await page.evaluate(()=>window.NeonBenchmark.result));
  }
  expect(rows[1].samples[0].counts.enemies).toBeGreaterThanOrEqual(80);
  const os=require('node:os');
  const rendering=await page.evaluate(()=>{
    const gl=document.createElement('canvas').getContext('webgl');
    const extension=gl?.getExtension('WEBGL_debug_renderer_info');
    return extension?{vendor:gl.getParameter(extension.UNMASKED_VENDOR_WEBGL),renderer:gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)}:null;
  });
  const result={browser:browser.browserType().name(),version:browser.version(),os:os.platform(),cpu:os.cpus()[0]?.model,
    rendering,
    note:'Headless scripted solo; reported WebGL renderer does not establish Canvas/compositor performance. Accelerated20min samples do not establish continuous rendering or retained memory; no audio gesture.',rows};
  await info.attach('progression-measurements',{body:JSON.stringify(result,null,2),contentType:'application/json'});
  require('node:fs').writeFileSync(info.outputPath('progression-measurements.json'),JSON.stringify(result,null,2));
  console.log('PROGRESSION_MEASUREMENTS '+JSON.stringify(rows.map(row=>({scenario:row.scenario,simulatedSeconds:row.simulatedSeconds,renderEvery:row.renderEvery,
    updateP95Ms:row.timing.update.p95Ms,renderP95Ms:row.timing.render.p95Ms,rafP95Ms:row.timing.raf.p95Ms,final:row.final}))));
});
