# 006 — Remove discarded items

Status: Implemented — needs validation

## Problem

Items left behind for possible reuse accumulate during long missions. Moving through
them repeatedly opens the pickup screen and interrupts travel.

## Work requested

Remove items that the player deliberately drops or discards instead of placing them
back into the world as collectible pickups. Ensure removed items cannot trigger
the pickup screen again.

## Associated information

Working interpretation: "dropped" means gear discarded by the player or replaced
during an equipment swap, rather than newly generated enemy loot. Confirm that
interpretation before implementation. Define how declining a new pickup should
work as part of that decision. Keep legitimate new loot available under the agreed rules.

## Acceptance criteria

- [x] Every agreed discard path removes the item from the world and pickup system.
- [x] Replacing equipped gear does not leave the old gear as a pickup, if swaps are included in the agreed scope.
- [x] Returning to a discard location never reopens the pickup screen for that item.
- [x] Removed items no longer render, collide, or participate in proximity checks.
- [x] Fresh loot can still be collected and equipped according to the agreed rules.
- [ ] A long-run playtest confirms discarded equipment no longer causes repeated travel interruptions.

## Open questions

Owner decision (2026-10-29): inventory discards, equipment replaced during swaps,
and declined incoming pickups are permanently removed. Fresh loot remains
available without expiry. Do not delete pre-existing ground loot from older saves:
its origin was not recorded and it cannot safely be classified as discarded gear.

## Implementation and validation

- Scope: remove the three equipment re-drop paths in `js/game.js`; update inventory
  and overflow wording in `index.html` and `js/ui.js` to say items are discarded.
- Changes: all three re-drop paths removed; discard and decline checkpoint the
  resulting inventory/world state. Swap retains its existing checkpoint. Last
  weapon protection and active weapon indices remain intact. Existing ground
  items and their save representation remain compatible.
- Automated browser checks: `tools/check-discarded-items.js`, loaded in a fresh
  isolated context at `/?test=discarded-items`, passed all 35 assertions. Covers
  weapon/module inventory discards, swaps and declines; checkpoint restoration;
  revisiting the pickup location; fresh loot preserved for ten simulated minutes;
  fresh repair collection and replacement equipment. Removed gear never enters
  `groundItems`, the shared source for rendering and proximity checks.
- Agent browser UI check: clicked DISCARD NEW ITEM at 640×720, returned to active
  gameplay with no pickup left; updated labels fit that viewport. No captured
  game errors. Initial regression attempt used a cached pre-change `game.js`;
  disabled browser cache, reloaded, and reran successfully.
- Syntax checks (`node --check` for changed JavaScript) and `git diff --check`
  passed. No graphics or fresh-loot expiry changes.
- Pending owner check: long-run travel without repeated discarded-item prompts.
- Implementation commit: pending.
