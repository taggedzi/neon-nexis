# Source scenario commands

Boot to the main menu in a source checkout, then open the browser console.
`NEON.Dev.catalog()` lists hull, color, primary, additional weapon, defense,
passive, and enemy IDs.

```js
NEON.Dev.setup({ hull: 'talon', color: '#ffd166', level: 5, sector: 3,
  weapons: ['seeker_missiles', 'arc_projector'], defense: 'aegis_projector',
  seed: 42, invulnerable: true });
NEON.Dev.spawn('dart');
```

`setup` starts a fresh scenario, replacing the live run, without changing the
stored checkpoint. Optional `weapons` is an array of 0–2 distinct additional
weapon IDs; the primary remains fixed to the hull. Optional `defense` is one
defensive ID or `null`. Equipment starts at weapon level 1. Player level and
sector accept 1–100. The player starts healthy and automatically earns the
normal passive sequence up to the requested level, without protocol choices.
The map seed defaults to 1. Initial enemies use the normal spawn path.

`NEON.Dev.invulnerable(true)` enables damage immunity; pass `false` to disable it.
`NEON.Dev.killAll()` kills current enemies, including splitter children, through
normal reward and effect paths. `spawn` respects the normal population cap.

Mutating commands pause through the normal pause path and clear held input.
Resume from the pause menu. Commands accept only the main menu or living
single-player play/pause state; commands other than setup need a living run.
No commands work in co-op. There is no password or on-screen panel.

Once a run uses a mutating command, automatic saves and Save & Quit cannot
write its checkpoint. Use Settings → Data's normal manual checkpoint action to
save deliberately. Starting a normal new run or continuing a stored checkpoint
restores ordinary saving. Invulnerability is session-only and is never saved.
Save & Quit can report a failed save for a dev run because that write is blocked.

The staging tool omits both the script tag and `js/dev.js` from every production
package, including locally staged packages. The source script also refuses to
install commands when the release version differs from `development`.
This is an accidental-use guard, not protection against someone editing client JS.
Save-file import remains the feature documented in issue 020.
