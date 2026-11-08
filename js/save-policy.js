/* Incompatible checkpoints require an explicit export/remove decision. */
(function(){
'use strict';
const N = window.NEON;
const policy = N.SavePolicy = {};

policy.inspect = function() {
  try {
    const raw = localStorage.getItem(N.Storage.key);
    if (raw === null) return inspectShips();
    let save;
    try {
      save = JSON.parse(raw);
    } catch {
      return { incompatible: true, raw, key: N.Storage.key, kind: 'checkpoint' };
    }
    if (!N.Game.canLoadSave(save)) return { incompatible: true, raw, key: N.Storage.key, kind: 'checkpoint' };
    const ships = inspectShips();
    return ships.incompatible ? ships : { incompatible: false, raw, key: N.Storage.key, kind: 'checkpoint' };
  } catch {
    return { incompatible: false, unavailable: true };
  }
};

function inspectShips() {
  if (N.PROGRESSION_ENABLED === true && N.Loadouts) {
    const raw = localStorage.getItem(N.Loadouts.key);
    if (raw !== null && !N.Loadouts.read().ok) return { incompatible: true, raw, key: N.Loadouts.key, kind: 'loadouts' };
  }
  return { incompatible: false, raw: null, key: N.Storage.key, kind: 'checkpoint' };
}

policy.export = function(raw) {
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'neon-nexus-old-save-' + Date.now() + '.json';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
};

policy.resolve = function(raw, shouldExport, key = N.Storage.key) {
  try {
    // A different tab may have written a newer checkpoint while this dialog was open.
    if (![N.Storage.key, N.Loadouts?.key].includes(key) || localStorage.getItem(key) !== raw) {
      throw Error('The checkpoint changed. Open the menu again to review it.');
    }
    if (shouldExport) {
      policy.export(raw);
    }
    localStorage.removeItem(key);
    if (key === N.Storage.key) N.Game.lastCheckpoint = null;
    return true;
  } catch (error) {
    N.UI.toast('SAVE PRESERVED // ' + error.message, 'danger', 6000);
    return false;
  }
};
})();
