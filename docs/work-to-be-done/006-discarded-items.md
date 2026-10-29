# 006 — Remove discarded items

Status: Planned

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

- [ ] Every agreed discard path removes the item from the world and pickup system.
- [ ] Replacing equipped gear does not leave the old gear as a pickup, if swaps are included in the agreed scope.
- [ ] Returning to a discard location never reopens the pickup screen for that item.
- [ ] Removed items no longer render, collide, or participate in proximity checks.
- [ ] Fresh loot can still be collected and equipped according to the agreed rules.
- [ ] A long-run playtest confirms discarded equipment no longer causes repeated travel interruptions.

## Open questions

Does removal apply only to discarded/replaced gear, or should fresh loot also expire?
Should declining a pickup remove it permanently? If fresh loot expires, after what
duration and with what visual warning?
