# 002 — Choose ship type and color before a run

Status: Planned

## Problem

The player wants to choose a ship type and color when starting a new run.

## Work requested

Add ship and color selection to the new-run flow, with a visible preview and clear
selected state. Apply the choices when the run begins.

## Associated information

Decide whether ship types differ only in appearance or also in stats, handling,
weapons, or abilities. If differences affect gameplay, explain them in the selection
screen. Keep preview and in-game appearance consistent.

## Acceptance criteria

- [ ] Before starting a run, the player can choose from the agreed ship types and colors.
- [ ] The selected ship and color are visible in a preview before confirmation.
- [ ] Starting the run uses exactly the confirmed ship type and color.
- [ ] Any gameplay differences between ships are accurately described.
- [ ] Starting another run allows the player to make a new selection.
- [ ] Selection works with each supported menu input method and at supported viewport sizes.

## Open questions

Which ship types and color palette should be available? Are ship differences
cosmetic or mechanical? Should the last selection persist across page reloads?
