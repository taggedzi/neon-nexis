/* Saved-ship management and new-run selection using normal menu focus. */
(function () {
  'use strict';
  const N = window.NEON, G = N.Game, UI = N.UI, L = N.Loadouts;
  const V = N.LoadoutUI = {};
  const $ = id => document.getElementById(id);
  let returnScreen = 'ship', chosen = null, sector = 1, renameFrom = null;
  function button(text, action) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'neon-btn subtle'; el.textContent = text;
    el.addEventListener('click', action);
    return el;
  }
  function report(result) {
    $('loadout-message').textContent = result.ok ? 'SAVED SHIPS UPDATED.' : result.error;
    if (result.ok) render();
  }
  function render() {
    const found = L.read(), box = $('loadout-list');
    box.replaceChildren();
    $('loadout-save').disabled = !renameFrom && (!G.player || G.player.dead || !['paused','complete','inventory'].includes(G.mode));
    $('loadout-save').textContent = renameFrom ? 'RENAME SHIP' : 'SAVE CURRENT SHIP';
    if (!found.ok) { $('loadout-message').textContent = found.error; return; }
    if (!found.data.ships.length) { box.textContent = 'NO SAVED SHIPS. PAUSE A RUN TO SAVE YOUR PILOT.'; }
    for (const ship of found.data.ships) {
      const row = document.createElement('div'); row.className = 'settings-section';
      const text = document.createElement('p');
      text.textContent = ship.name + ' // PILOT ' + ship.player.level + ' // SECTOR ' + ship.highestSector + (L.validateShip(ship) ? '' : ' // INCOMPATIBLE EQUIPMENT: CANNOT LAUNCH');
      row.append(text, button('RENAME', () => {
        renameFrom = ship.name; $('loadout-name').value = ship.name; render(); $('loadout-name').focus();
      }), button('UPDATE FROM CURRENT PILOT', () => {
        UI.confirm('UPDATE SAVED SHIP?', 'Replace '+ship.name+' with the current earned pilot?', () => report(L.save(ship.name, true)), 'UPDATE');
      }), button('DELETE', () => {
        UI.confirm('DELETE SAVED SHIP?', 'Permanently remove '+ship.name+' from the list? The checkpoint stays.', () => report(L.remove(ship.name)), 'DELETE');
      }));
      box.append(row);
    }
  }
  V.open = function (from) {
    returnScreen = from; renameFrom = null; $('loadout-name').value = ''; $('loadout-message').textContent = '';
    render(); UI.showScreen('loadouts');
  };
  V.close = function () {
    if (returnScreen === 'ship') UI.showShipSelection();
    else UI.showScreen(returnScreen);
  };
  V.buildSolo = function () {
    const box = $('solo-loadouts'), found = L.read();
    const focused=box.contains(document.activeElement)?document.activeElement.textContent:null;
    box.replaceChildren();
    if (G.settings.skill === 'hardcore') { chosen = null; sector = 1; }
    const fresh = button('FRESH PILOT', () => { chosen = null; sector = 1; V.buildSolo(); });
    fresh.setAttribute('aria-pressed', String(!chosen)); box.append(fresh);
    if (found.ok) {
      if (chosen && !found.data.ships.some(ship => ship.name === chosen)) { chosen = null; sector = 1; }
      for (const ship of found.data.ships) {
        const el = button(ship.name+' // LV '+ship.player.level, () => { chosen = ship.name; sector = 1; V.buildSolo(); });
        el.disabled = G.settings.skill === 'hardcore' || !L.validateShip(ship);
        el.setAttribute('aria-pressed', String(chosen === ship.name)); box.append(el);
      }
    }
    const ship = chosen ? L.find(chosen) : null;
    const max = ship?.highestSector || 1; sector = Math.min(sector, max);
    $('solo-sector-label').textContent = 'SECTOR '+sector+' / '+max;
    $('solo-sector-down').disabled = sector <= 1; $('solo-sector-up').disabled = sector >= max;
    $('solo-loadout-note').textContent = !found.ok ? found.error : ship ? 'EARNED EQUIPMENT KEPT. HULL AND COLOR COME FROM THE SAVED SHIP.' : 'A FRESH PILOT STARTS AT SECTOR 1.';
    for (const el of document.querySelectorAll('#ship-types button,#ship-colors button')) el.disabled = !!ship;
    if (ship) {
      N.Ships.preview($('ship-preview'), ship.player);
      $('ship-stats').textContent=N.Ships.description(ship.player.shipType);
    } else {
      const hull=document.querySelector('#ship-types [aria-pressed="true"]');
      const color=document.querySelector('#ship-colors [aria-pressed="true"]');
      $('ship-stats').textContent=N.Ships.description(hull?.dataset.shipType);
      N.Ships.preview($('ship-preview'),N.Ships.selection({shipType:hull?.dataset.shipType,shipColor:color?.dataset.shipColor}));
    }
    if(focused) Array.from(box.children).find(el=>el.textContent===focused&&!el.disabled)?.focus();
  };
  V.launch = function (selection) {
    const ship = chosen ? L.find(chosen) : null;
    if (chosen && !ship) { UI.toast('SAVED SHIP NOT FOUND. CHOOSE AGAIN.','danger'); return; }
    G.newRun(selection, { loadout: ship, sector });
  };
  let coopSignature = '';
  V.updateCoop = function (lobby) {
    const host=N.Net.role==='host', editable=lobby.phase==='lobby';
    const allow=$('coop-allow-loadouts');
    allow.disabled=!host||!editable||lobby.skill==='hardcore';
    allow.setAttribute('aria-pressed',String(lobby.allowLoadouts));
    allow.textContent='ALLOW SAVED SHIPS: '+(lobby.allowLoadouts?'ON':'OFF');
    $('coop-sector-label').textContent='SECTOR '+lobby.startSector+' / '+lobby.sectorCap;
    $('coop-sector-down').disabled=!host||!editable||lobby.startSector<=1;
    $('coop-sector-up').disabled=!host||!editable||lobby.startSector>=lobby.sectorCap;
    const selected=lobby.members.find(member=>member.clientId===N.Net.clientId)?.profile.loadout;
    $('coop-ship-stats').textContent=N.Ships.description(selected?.player.shipType||N.Coop.localProfile.shipType);
    const found=L.read();
    const signature=JSON.stringify([lobby.allowLoadouts,lobby.skill,lobby.phase,selected?.name,found]);
    if(signature===coopSignature) return;
    coopSignature=signature;
    const box=$('coop-loadouts'),focused=box.contains(document.activeElement)?document.activeElement.textContent:null;
    box.replaceChildren();
    const choose=ship=>N.Coop.setLobbyProfile(Object.assign({},ship?.player||N.Coop.localProfile,{loadout:ship}));
    const fresh=button('FRESH PILOT',()=>choose(null));
    fresh.disabled=!editable;fresh.setAttribute('aria-pressed',String(!selected));box.append(fresh);
    if(found.ok){
      for(const ship of found.data.ships){
        const el=button(ship.name+' // LV '+ship.player.level,()=>choose(ship));
        el.disabled=!editable||!lobby.allowLoadouts||lobby.skill==='hardcore'||!L.validateShip(ship);
        el.setAttribute('aria-pressed',String(selected?.name===ship.name));box.append(el);
      }
    }
    $('coop-loadout-note').textContent=!found.ok?found.error:lobby.allowLoadouts?'ALL PILOTS MUST READY AFTER CHANGING SHIPS OR STARTING SECTOR.':'HOST MUST ALLOW SAVED SHIPS. FRESH PILOTS START AT SECTOR 1.';
    if(focused) Array.from(box.children).find(el=>el.textContent===focused&&!el.disabled)?.focus();
  };
  V.init = function () {
    $('coop-allow-loadouts').addEventListener('click',()=>N.Net.sendControl({t:'lobby_loadouts',allow:!N.Coop.lobby.allowLoadouts}));
    for(const [id,delta] of [['coop-sector-down',-1],['coop-sector-up',1]]){
      $(id).addEventListener('click',()=>N.Net.sendControl({t:'lobby_sector',sector:N.Coop.lobby.startSector+delta}));
    }

    $('btn-pause-loadouts').addEventListener('click', () => V.open('pause'));
    $('solo-manage-loadouts').addEventListener('click', () => V.open('ship'));
    $('loadout-close').addEventListener('click', V.close);
    $('loadout-save').addEventListener('click', () => {
      const name = $('loadout-name').value;
      const result = renameFrom ? L.rename(renameFrom, name) : L.save(name);
      if (result.ok) renameFrom = null;
      report(result);
    });
    $('solo-sector-down').addEventListener('click', () => { sector--; V.buildSolo(); });
    $('solo-sector-up').addEventListener('click', () => { sector++; V.buildSolo(); });
  };
})();
