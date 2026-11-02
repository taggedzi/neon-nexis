/* Enemy catalog using native disclosure controls and existing menu focus. */
(function () {
  'use strict';
  const N = window.NEON, UI = N.UI, V = N.LogbookUI = {};
  const $ = id => document.getElementById(id);
  let returnScreen = 'menu';
  V.open = function(from) {
    returnScreen = from;
    N.Logbook.flush();
    const profile = N.Profile.current(), book = profile?.book || {}, box = $('logbook-entries');
    box.replaceChildren();
    const discovered = N.ENEMY_STYLES.filter(style => book[style.id]?.seen).length;
    $('logbook-note').textContent = profile
      ? discovered + ' / ' + N.ENEMY_STYLES.length + ' DISCOVERED' + (N.Profile.bookSanitized ? ' // INVALID OR UNKNOWN RECORDS WERE IGNORED.' : '')
      : 'PROFILE DATA COULD NOT BE READ. STORED BYTES WERE PRESERVED.';
    for (const role of N.ROLE_LIST) {
      const styles = N.ENEMY_STYLES.filter(style => style.role === role);
      const group = document.createElement('details');
      group.className = 'settings-section';
      const known = styles.filter(style => book[style.id]?.seen).length;
      group.open = known > 0;
      const summary = document.createElement('summary');
      summary.tabIndex = 0;
      summary.textContent = N.ROLES[role].name + ' // ' + known + ' / ' + styles.length;
      group.append(summary);
      for (const style of styles) {
        const entry = document.createElement('article');
        entry.tabIndex = 0;
        entry.dataset.enemyStyle = style.id;
        const seen = book[style.id]?.seen;
        const name = document.createElement('h3');
        name.textContent = seen ? style.name : 'Unknown';
        const description = document.createElement('p');
        description.textContent = seen ? N.ENEMY_DESCRIPTIONS[style.id] : 'Encounter this style to reveal its name and behavior.';
        const count = document.createElement('p');
        count.className = 'micro';
        count.textContent = 'DESTROYED: ' + (book[style.id]?.kills || 0).toLocaleString();
        entry.append(name, description, count);
        group.append(entry);
      }
      box.append(group);
    }
    UI.showScreen('logbook');
  };
  V.close = function() {
    if (returnScreen === 'menu') { UI.showMenu(); }
    else { UI.showScreen(returnScreen); }
  };
  const init = UI.init;
  UI.init = function() {
    init();
    $('btn-logbook').addEventListener('click', () => V.open('menu'));
    $('btn-pause-logbook').addEventListener('click', () => V.open('pause'));
    $('logbook-close').addEventListener('click', V.close);
  };
})();
