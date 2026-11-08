'use strict';
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#btn-boot')).toBeEnabled();
  await page.evaluate(() => {
    const N=window.NEON,G=N.Game;
    N.UI.hideAll();G.newRun();
    G.enemies=[];G.enemyBullets=[];G.settings.capturePointer=false;G.applySettings(false);
    // Keep controlled scenarios deterministic while preserving the real update/input paths.
    G.updateSpawning=()=>{};
  });
});

test('new progression controls preserve firing, selection and deliberate defense', async ({page,browser}) => {
  console.log('Progression controls: '+browser.browserType().name()+' '+browser.version());
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.evaluate(() => {
    const N=window.NEON,p=N.Game.player;
    if(p.progressionMode!=='shared_v1')throw Error('Public launch did not activate shared progression');
    p.progression.offensive[1]={id:'arc_projector',level:1,cooldownSeconds:0};
    p.progression.offensive[2]={id:'gravity_bomb',level:1,cooldownSeconds:0};
    p.progression.defensive={id:'repulsor_pulse',level:1,cooldownSeconds:0};
    N.Game.settings.firingMode='toggle';N.Game.applySettings(false);
  });
  await page.keyboard.press('Digit2');
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(1);
  await page.keyboard.press('KeyF');
  await expect.poll(()=>page.evaluate(()=>window.NEON.Firing.toggled())).toBe(true);
  await page.keyboard.down('KeyR');
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds>0)).toBe(true);
  await page.evaluate(()=>{window.NEON.Game.player.progression.defensive.cooldownSeconds=0;});
  await page.waitForTimeout(150);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds)).toBe(0);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(1);
  expect(await page.evaluate(()=>window.NEON.Firing.toggled())).toBe(true);
  await page.keyboard.up('KeyR');await page.keyboard.press('KeyR');
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds>0)).toBe(true);
  await page.keyboard.press('Digit1');
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(0);
  await page.evaluate(()=>{const N=window.NEON;N.Game.settings.keyboard.defense='KeyT';N.Game.applySettings(false);N.Game.player.progression.defensive.cooldownSeconds=0;});
  await page.keyboard.press('KeyR');await page.waitForTimeout(80);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds)).toBe(0);
  await page.keyboard.press('KeyT');
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds>0)).toBe(true);
  await page.evaluate(()=>{const N=window.NEON;N.Game.pauseGame();N.Game.player.progression.defensive.cooldownSeconds=0;});
  await page.keyboard.down('KeyT');
  await page.evaluate(()=>window.NEON.Game.resumeGame());
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds)).toBe(0);
  await page.keyboard.up('KeyT');await page.keyboard.press('KeyT');
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds>0)).toBe(true);
  expect(errors).toEqual([]);
});

test('synthetic controller requires release after interruption and skips defense when cycling',async ({page})=>{
  await page.evaluate(()=>{
    const N=window.NEON,G=N.Game;
    const pad={id:'Progression test pad',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
    window.progressionPad=pad;
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
    G.player.progression.offensive[2]={id:'plasma_mortar',level:1,cooldownSeconds:0};
    G.player.progression.defensive={id:'repulsor_pulse',level:1,cooldownSeconds:0};
    N.Input.update();
  });
  const press=async index=>{
    await page.evaluate(index=>{window.progressionPad.buttons[index]={pressed:true,value:1};},index);
    await page.waitForTimeout(80);
    await page.evaluate(index=>{window.progressionPad.buttons[index]={pressed:false,value:0};},index);
    await page.waitForTimeout(80);
  };
  await press(5);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(2);
  await press(5);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(0);
  await press(15);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(2);
  await page.evaluate(()=>{window.NEON.Game.pauseGame();window.progressionPad.buttons[2]={pressed:true,value:1};window.NEON.Game.resumeGame();});
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds)).toBe(0);
  await page.evaluate(()=>{window.progressionPad.buttons[2]={pressed:false,value:0};});
  await page.waitForTimeout(80);await press(2);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds>0)).toBe(true);
});

test('reward feedback is bounded and inventory is read only',async ({page})=>{
  await page.evaluate(()=>{
    const N=window.NEON,p=N.Game.player;
    for(let i=1;i<=30;i++)N.ProgressionControls.notify(p,'Reward '+i,i);
    N.ProgressionControls.notify(p,'Duplicate',30);
  });
  expect(await page.evaluate(()=>window.NEON.ProgressionControls.view(window.NEON.Game.player).history.length)).toBe(12);
  expect(await page.evaluate(()=>window.NEON.Game.mode)).toBe('playing');
  await expect(page.locator('#btn-rewards-hud')).toBeHidden();
  await page.keyboard.press('KeyI');
  await expect(page.locator('#screen-inventory')).toHaveClass(/active/);
  await expect(page.locator('#inv-weapons .item-drop')).toHaveCount(0);
  await expect(page.locator('#inv-passives')).toContainText('Reward 30');
});

test('focus and controller reconnect discard held progression actions',async ({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.evaluate(()=>{
    const N=window.NEON,p=N.Game.player;
    window.progressionPad={id:'Release test pad',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
    window.progressionPadConnected=true;
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.progressionPadConnected?[window.progressionPad]:[]});
    p.progression.offensive[1]={id:'seeker_missiles',level:1,cooldownSeconds:0};
    p.progression.defensive={id:'repulsor_pulse',level:1,cooldownSeconds:0};
  });
  await page.waitForTimeout(80);
  await page.evaluate(()=>{
    window.progressionPad.buttons[5]={pressed:true,value:1};
    window.progressionPad.buttons[2]={pressed:true,value:1};
  });
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds>0)).toBe(true);
  await page.evaluate(()=>{
    window.NEON.Game.player.progression.defensive.cooldownSeconds=0;
    window.progressionPadConnected=false;
  });
  await expect.poll(()=>page.evaluate(()=>window.NEON.Input.isPadConnected())).toBe(false);
  await page.evaluate(()=>{window.progressionPadConnected=true;});
  await expect.poll(()=>page.evaluate(()=>window.NEON.Input.isPadConnected())).toBe(true);
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(1);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds)).toBe(0);
  await page.evaluate(()=>{
    window.progressionPad.buttons[5]={pressed:false,value:0};
    window.progressionPad.buttons[2]={pressed:false,value:0};
  });
  await page.waitForTimeout(80);
  await page.evaluate(()=>{
    window.progressionPad.buttons[5]={pressed:true,value:1};
    window.progressionPad.buttons[2]={pressed:true,value:1};
  });
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds>0)).toBe(true);
  await page.evaluate(()=>{
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    window.NEON.Game.resumeGame();
    window.NEON.Game.player.progression.defensive.cooldownSeconds=0;
  });
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(0);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds)).toBe(0);
  // Releasing defense arms that button independently of a still-held bumper.
  await page.evaluate(()=>{window.progressionPad.buttons[2]={pressed:false,value:0};});
  await page.waitForTimeout(80);
  await page.evaluate(()=>{window.progressionPad.buttons[2]={pressed:true,value:1};});
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds>0)).toBe(true);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(0);
  await page.evaluate(()=>{
    window.progressionPad.buttons[5]={pressed:false,value:0};
    window.progressionPad.buttons[2]={pressed:false,value:0};
    window.NEON.Game.player.progression.defensive.cooldownSeconds=0;
  });
  await page.waitForTimeout(80);
  // Deliberate duplicate gameplay bindings must preserve both independent intents.
  await page.evaluate(()=>{
    const N=window.NEON;
    N.Game.settings.gamepad.defense=14;N.Game.applySettings(false);
    N.Game.player.progression.selectedOffensiveSlot=1;
  });
  await page.waitForTimeout(80);
  await page.evaluate(()=>{window.progressionPad.buttons[14]={pressed:true,value:1};});
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.selectedOffensiveSlot)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds>0)).toBe(true);
  expect(errors).toEqual([]);
});

test('reward summary expires on simulation time while history and barriers remain inspectable',async ({page})=>{
  const result=await page.evaluate(()=>{
    const N=window.NEON,G=N.Game,p=G.player;
    G.pauseGame();
    N.ProgressionControls.notify(p,'Hull installed',1);
    N.ProgressionControls.notify(p,'Amplifier installed',2);
    p.barrier={capacity:20,windowSeconds:2,lockoutSeconds:2};
    const current=N.ProgressionControls.view(p);
    current.barrier.capacity=0;
    G.time+=4;
    const later=N.ProgressionControls.view(p);
    return {currentSummary:current.recentSummary,laterSummary:later.recentSummary,
      historyCount:later.history.length,capacity:p.barrier.capacity,windowSeconds:later.barrier.windowSeconds};
  });
  expect(result.currentSummary).toEqual({message:'Amplifier installed',count:2});
  expect(result.laterSummary).toBe(null);
  expect(result.historyCount).toBe(2);
  expect(result.capacity).toBe(20);
  expect(result.windowSeconds).toBe(2);
});

test('solo Aegis commits resources and keyboard focus never manufactures a defense press',async ({page})=>{
  const initialRevision=await page.evaluate(()=>{
    const p=window.NEON.Game.player;
    p.progression.defensive={id:'aegis_projector',level:1,cooldownSeconds:0};
    return p.resourceRevision;
  });
  await page.keyboard.down('KeyR');
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.resourceRevision)).toBe(initialRevision+1);
  expect(await page.evaluate(()=>window.NEON.Game.player.barrier.capacity)).toBe(25);
  await page.evaluate(()=>{
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    window.NEON.Game.resumeGame();
    window.NEON.Game.player.progression.defensive.cooldownSeconds=0;
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyR',repeat:true,bubbles:true}));
  });
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>window.NEON.Game.player.resourceRevision)).toBe(initialRevision+1);
  expect(await page.evaluate(()=>window.NEON.Game.player.progression.defensive.cooldownSeconds)).toBe(0);
  await page.keyboard.up('KeyR');
  await page.keyboard.press('KeyR');
  await expect.poll(()=>page.evaluate(()=>window.NEON.Game.player.resourceRevision)).toBe(initialRevision+2);
});
