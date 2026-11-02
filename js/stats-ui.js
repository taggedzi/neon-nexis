/* Local lifetime viewer and per-participant match boards. */
(function () {
  'use strict';
  const N=window.NEON,UI=N.UI,S=N.PlayerStats,P=N.Profile,G=N.Game;
  const V=N.StatsUI={};
  const $=id=>document.getElementById(id);
  let returnScreen='menu';
  V.open=function(from){returnScreen=from;S.flush();renderLifetime();UI.showScreen('playerstats');};
  V.close=function(){if(returnScreen==='menu')UI.showMenu();else UI.showScreen(returnScreen);};
  function cell(row,tag,text){
    const el=document.createElement(tag);el.textContent=String(text);
    if(tag==='td')el.tabIndex=0;
    row.append(el);return el;
  }
  function table(box,title,players){
    box.replaceChildren();
    const el=document.createElement('table');el.className='tally-table';
    const caption=document.createElement('caption');caption.textContent=title;el.append(caption);
    const head=document.createElement('thead'),heading=document.createElement('tr');
    cell(heading,'th','Counter').scope='col';
    for(const player of players)cell(heading,'th',player.name).scope='col';
    head.append(heading);el.append(head);
    const body=document.createElement('tbody');
    P.statKeys.forEach((key,index)=>{
      const row=document.createElement('tr');
      cell(row,'th',S.labels[index]).scope='row';
      for(const player of players){
        cell(row,'td',player.enabled===false?'Recording off':player.row?player.row[key].toLocaleString():'Unavailable');
      }
      body.append(row);
    });
    el.append(body);box.append(el);
  }
  function board(id,coopOnly=false){
    const box=$(id);if(!box)return;
    const data=S.lastBoard;
    const visible=S.enabled()&&!!data&&(!coopOnly||data.coop);
    box.hidden=!visible;
    if(visible){
      table(box,'MATCH TALLY',data.rows);
      if(coopOnly){
        const summary=document.createElement('p'),d=data.summary;
        summary.textContent='SECTOR '+d.sector+' // KILLS '+d.kills+' // PILOT LEVEL '+d.level;
        box.prepend(summary);
      }
    }
  }
  V.refresh=function(){
    const current=UI.currentScreen();
    if(current==='gameover'){
      board('gameover-tally');
    }
  };
  V.showEnd=function(where){
    board(where==='coop'?'coop-last-stats':'menu-match-tally',where==='coop');
  };
  function renderLifetime(){
    const profile=P.current();
    $('stats-toggle').setAttribute('aria-pressed',String(S.enabled()));
    $('stats-toggle').textContent='RECORD PLAYER STATS: '+(S.enabled()?'ON':'OFF');
    $('stats-storage-note').textContent=profile&&!P.lastWriteOk?'LIFETIME TOTALS ARE HELD IN MEMORY. THE LAST STORAGE WRITE FAILED.':profile?'LIFETIME TOTALS ARE LOCAL AND SHARED BY ALL SAVED SHIPS.':'PROFILE DATA COULD NOT BE READ. STORED BYTES WERE PRESERVED; MATCH COUNTS CAN STILL RUN.';
    table($('lifetime-tally'),'LIFETIME TOTALS',[{name:'LOCAL PLAYER',enabled:true,row:profile?.stats||null}]);
  }
  const init=UI.init;
  UI.init=function(){
    init();
    $('btn-player-stats').addEventListener('click',()=>V.open('menu'));
    $('btn-pause-stats').addEventListener('click',()=>V.open('pause'));
    $('stats-close').addEventListener('click',V.close);
    $('stats-toggle').addEventListener('click',()=>{
      S.flush();G.settings.trackStats=!S.enabled();N.saveSettings(G.settings);S.sendRow(true);renderLifetime();
    });
    $('btn-coop-stats').addEventListener('click',()=>{
      if(!$('coop-last-stats').hidden&&S.lastBoard?.coop)board('coop-last-stats',true);
    });
  };
  for(const [name,id,coopOnly] of [['showMenu','menu-match-tally',false],['showCoop','coop-last-stats',true],['showGameOver','gameover-tally',false]]){
    const original=UI[name];
    UI[name]=function(...args){const result=original(...args);board(id,coopOnly);return result;};
  }
})();
