/* Incompatible checkpoints require an explicit export/remove decision. */
(function(){
'use strict';
const N = window.NEON;
const policy = N.SavePolicy = {};

policy.inspect = function() {
  try {
    const raw = localStorage.getItem(N.Storage.key);
    if (raw === null) {
      return { incompatible: false, raw: null };
    }
    let save;
    try {
      save = JSON.parse(raw);
    } catch {
      return { incompatible: true, raw };
    }
    return { incompatible: !N.Game.canLoadSave(save), raw };
  } catch {
    return { incompatible: false, unavailable: true };
  }
};

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

policy.resolve = function(raw, shouldExport) {
  try {
    // A different tab may have written a newer checkpoint while this dialog was open.
    if (localStorage.getItem(N.Storage.key) !== raw) {
      throw Error('The checkpoint changed. Open the menu again to review it.');
    }
    if (shouldExport) {
      policy.export(raw);
    }
    localStorage.removeItem(N.Storage.key);
    N.Game.lastCheckpoint = null;
    return true;
  } catch (error) {
    N.UI.toast('SAVE PRESERVED // ' + error.message, 'danger', 6000);
    return false;
  }
};
})();
