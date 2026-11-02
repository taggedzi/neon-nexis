/* Voluntary backup of the stored checkpoint and settings. */
(function(){
'use strict';
const N = window.NEON;
const transfer = N.SaveTransfer = {};
const FILE_VERSION = 3;

// A backup is one sector of checkpoint data plus settings. One million
// characters is far above that and rejects a huge file before it is applied.
transfer.maxBytes = 1000000;

const FAILURE = {
  invalid: 'THAT FILE CANNOT BE READ. STORED DATA WAS NOT CHANGED.',
  version: 'THAT FILE VERSION IS NOT SUPPORTED. STORED DATA WAS NOT CHANGED.',
  settings: 'THAT FILE HAS NO USABLE SETTINGS. STORED DATA WAS NOT CHANGED.',
  settingsStored: 'STORED SETTINGS COULD NOT BE READ. NOTHING WAS EXPORTED.',
  checkpoint: 'THAT CHECKPOINT CANNOT BE LOADED. STORED DATA WAS NOT CHANGED.',
  incompatible: 'THIS CHECKPOINT CANNOT BE EXPORTED HERE. USE THE RECOVERY SCREEN.',
  unavailable: 'LOCAL STORAGE IS OFFLINE.',
  storage: 'IMPORT FAILED. STORED DATA WAS LEFT UNCHANGED.',
  size: 'THAT FILE IS TOO LARGE. STORED DATA WAS NOT CHANGED.',
  profile: 'THAT PROFILE CANNOT BE READ. STORED DATA WAS NOT CHANGED.',
  loadouts: 'THAT SHIP LIST CANNOT BE READ. STORED DATA WAS NOT CHANGED.',
  live: 'QUIT TO THE MAIN MENU BEFORE IMPORTING.'
};

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function knownSettings(raw) {
  const picked = {};
  const defaults = N.SETTINGS_DEFAULT;
  for (const key of Object.keys(defaults)) {
    if (!Object.hasOwn(raw, key)) continue;
    const baseline = defaults[key];
    const incoming = raw[key];
    if (plainObject(baseline)) {
      if (!plainObject(incoming)) continue;
      const group = {};
      for (const child of Object.keys(baseline)) {
        if (Object.hasOwn(incoming, child)) group[child] = incoming[child];
      }
      picked[key] = group;
    } else {
      picked[key] = incoming;
    }
  }
  return picked;
}

function readSettingsForExport() {
  const raw = localStorage.getItem(N.Storage.settingsKey);
  if (raw == null) return N.normalizeSettings(null);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return null;
  }
  if (!plainObject(parsed)) return null;
  return N.normalizeSettings(knownSettings(parsed));
}

function putBack(key, raw) {
  if (raw === null) localStorage.removeItem(key);
  else localStorage.setItem(key, raw);
}

transfer.failureText = function(reason) {
  return FAILURE[reason] || 'IMPORT FAILED. STORED DATA WAS NOT CHANGED.';
};

transfer.build = function() {
  try {
    if (!N.Storage.available) return { ok: false, reason: 'unavailable' };
    const found = N.SavePolicy.inspect();
    if (found.unavailable) return { ok: false, reason: 'unavailable' };
    if (found.incompatible) return { ok: false, reason: 'incompatible' };
    N.PlayerStats?.flush();
    const profile=N.Profile.current();
    if(!profile) return {ok:false,reason:'profile'};
    const ships = N.Loadouts.read();
    if (!ships.ok) return { ok: false, reason: 'loadouts' };
    const settings = readSettingsForExport();
    if (!settings) return { ok: false, reason: 'settingsStored' };
    return {
      ok: true,
      file: {
        fileVersion: FILE_VERSION,
        exportedAt: Date.now(),
        release: String(N.RELEASE_VERSION || ''),
        checkpoint: found.raw == null ? null : JSON.parse(found.raw),
        settings,
        loadouts: ships.data,
        profile: {version:1,stats:{...profile.stats}}
      }
    };
  } catch (error) {
    return { ok: false, reason: 'unavailable' };
  }
};

transfer.validate = function(file) {
  if (!plainObject(file) || ![1, 2, FILE_VERSION].includes(file.fileVersion)) {
    return { ok: false, reason: plainObject(file) ? 'version' : 'invalid' };
  }
  if (!Object.hasOwn(file, 'settings') || !plainObject(file.settings)) {
    return { ok: false, reason: 'settings' };
  }
  if (!Object.hasOwn(file, 'checkpoint')) return { ok: false, reason: 'checkpoint' };
  if (file.checkpoint != null && !N.Game.canLoadSave(file.checkpoint)) {
    return { ok: false, reason: 'checkpoint' };
  }
  if(file.fileVersion>=2 && !N.Loadouts.validate(file.loadouts)){
    return { ok: false, reason: 'loadouts' };
  }
  if(file.fileVersion===3 && !N.Profile.validate(file.profile)){
    return {ok:false,reason:'profile'};
  }
  return { ok: true, file };
};

transfer.parse = function(text) {
  if (typeof text !== 'string' || text.length === 0) return { ok: false, reason: 'invalid' };
  if (text.length > transfer.maxBytes) return { ok: false, reason: 'size' };
  try {
    return transfer.validate(JSON.parse(text));
  } catch (error) {
    return { ok: false, reason: 'invalid' };
  }
};

transfer.summary = function(file) {
  const sentences = [];
  const existing = N.readSave();
  const hasExisting = !!(existing && N.Game.canLoadSave(existing));
  if (file.checkpoint == null) {
    sentences.push(hasExisting
      ? 'This file has no checkpoint. Importing it removes the checkpoint stored in this browser.'
      : 'This file has no checkpoint.');
  } else {
    const sector = (file.checkpoint.run && file.checkpoint.run.level) || 1;
    const pilot = (file.checkpoint.player && file.checkpoint.player.level) || 1;
    sentences.push('Checkpoint: sector ' + String(sector).padStart(2, '0') + ', pilot level ' + pilot + '.');
    if (hasExisting) sentences.push('This replaces the checkpoint already stored in this browser.');
  }
  sentences.push(file.fileVersion>=2?'Saved ships in the file replace this browser’s saved ship list.':'This older backup preserves the saved ships already in this browser.');
  sentences.push(file.fileVersion===3?'Lifetime profile totals in the file replace this browser’s totals.':'This older backup preserves lifetime profile totals already in this browser.');
  sentences.push('Settings in the file replace settings in this browser, including controls, audio, and graphics.');
  return sentences.join(' ');
};

transfer.apply = function(file) {
  if (!N.Game || N.Game.mode !== 'menu') return { ok: false, reason: 'live' };
  if (!N.Storage.available) return { ok: false, reason: 'unavailable' };
  const checked = transfer.validate(file);
  if (!checked.ok) return checked;
  const saveKey = N.Storage.key;
  const settingsKey = N.Storage.settingsKey;
  let previousSave = null;
  let previousSettings = null;
  let previousLoadouts = null;
  let previousProfile = null;
  let captured = false;
  let normalized;
  try {
    N.PlayerStats?.flush();
    previousSave = localStorage.getItem(saveKey);
    previousSettings = localStorage.getItem(settingsKey);
    previousLoadouts = localStorage.getItem(N.Loadouts.key);
    previousProfile = localStorage.getItem(N.Profile.key);
    captured = true;
    normalized = N.normalizeSettings(knownSettings(file.settings));
    if (file.checkpoint == null) localStorage.removeItem(saveKey);
    else localStorage.setItem(saveKey, JSON.stringify(file.checkpoint));
    localStorage.setItem(settingsKey, JSON.stringify(normalized));
    if(file.fileVersion>=2) localStorage.setItem(N.Loadouts.key,JSON.stringify(file.loadouts));
    if(file.fileVersion===3) localStorage.setItem(N.Profile.key,JSON.stringify({version:1,stats:N.Profile.cleanStats(file.profile.stats)}));
  } catch (error) {
    if (captured) {
      try {
        putBack(saveKey, previousSave);
        putBack(settingsKey, previousSettings);
        putBack(N.Loadouts.key, previousLoadouts);
        putBack(N.Profile.key, previousProfile);
      } catch (restoreError) {
        return { ok: false, reason: 'storage' };
      }
    }
    return { ok: false, reason: 'storage' };
  }
  N.Profile.reload();
  if(N.PlayerStats){N.PlayerStats.lastBoard=null;}
  N.Game.settings = N.loadSettings();
  try {
    if (typeof N.Game.applySettings === 'function') N.Game.applySettings(false);
  } catch (error) {
    // The stored file is already in place. Live audio and input refresh on the next open.
  }
  N.Game.lastCheckpoint = file.checkpoint == null ? null : N.readSave();
  return { ok: true };
};

// A click starts a browser download. The page cannot tell whether the file reached disk.
transfer.download = function(file) {
  const blob = new Blob([JSON.stringify(file, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'neon-nexus-backup-' + Date.now() + '.json';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
};
})();
