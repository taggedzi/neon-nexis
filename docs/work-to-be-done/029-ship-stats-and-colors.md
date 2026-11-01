# 029 — Give ships stats and decide what colors mean

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 13 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The player wants the hulls to play differently: a heavier ship, a faster small
ship, a fragile high-damage ship, and so on. They also floated color rules,
such as taking more damage from a color or ignoring a color, and they said that
part needs more thought. Colors might stay decorative.

## What exists today

[Issue 002](002-ship-selection.md) is explicit. The owner chose four cosmetic
hulls. The only mechanical difference is the hitbox, which follows the shape.
Speed, weapons, and stats are the same. The issue says mechanical differences
might come much later. That decision is still the current rule. This todo item
reopens it. It does not cancel it until the owner says so.

Hull drawing and hit tests live in `js/ships.js`. The shared pilot stats are
`N.BASE_STATS` in `js/content.js`. Colors are a palette on the hull. Enemy colors
are separate: each enemy role has a hue, and sectors shift that hue. Enemy hue
is not a damage type.

The selection screen's acceptance criteria already require that any gameplay
difference be described accurately before launch.

## Determine

- The four hulls and the six colors currently offered, from `js/ships.js`, so
  the plan names the real set.
- Which stats a player can feel in one sector: maximum health, shield, speed,
  damage done, damage taken. A longer list becomes a spreadsheet the player
  will not read.
- Whether enemy hues are stable enough to be "a color" for a resistance rule.
  They currently shift by sector, so a resistance to "red" would move under the
  player without a new art rule.

## Decide

The owner must supersede the issue 002 cosmetic decision in writing before any
stat change. If they do not, this issue closes with colors left decorative and
no code change.

If they want hull roles:

- One sentence per hull, and the stat deltas behind it.
- Whether weapons stay shared. The proposal should keep weapons shared so the
  hull is the role and the loadout is still the player's build.
- Old checkpoints keep the stats they were saved with, or adopt the new hull
  stats on load. Adopting on load changes a run the player already balanced.

If they want color rules, that is a second decision. It needs a stable meaning
for a color. Sector hue shift makes "impervious to red" a moving target.

Proposal, not approved:

- Do not implement color damage rules. Colors stay decorative.
- Do not implement hull stats until the owner replaces the issue 002 decision
  with a specific table.
- When that table exists, show it on the ship select screen, keep weapons
  shared, keep hitboxes on the collision outline, and apply the table only to
  new runs. An in-progress checkpoint keeps its saved numbers until the next
  new run.
- Default graphics and quality do not change. This is not
  [issue 036](036-graphics-polish.md).

No stat table is proposed here. Inventing one would pretend the design is done.

## Do

Only after a written table exists:

- Apply the deltas in one place used by both the local ship and the co-op
  mirror. A guest's hull must use the same numbers the host agreed.
- Describe the differences on the select screen, in the same words as the table.
- Checks: the four hulls differ only by the approved fields, hitboxes still
  match the outline, a legacy save does not change mid-run, and select-screen
  copy matches the table.
- Owner plays each hull. Feel is not marked done from the checks alone.

If the owner keeps issue 002 as-is, record that here and in the decision log,
and do not edit `js/ships.js`.

## Acceptance criteria

- [ ] The owner has either kept cosmetic hulls or approved a stat table.
- [ ] If a table was approved, the select screen states each difference.
- [ ] In-game numbers match that table and no other hidden difference.
- [ ] Existing runs keep their saved stats until a new run, if that was the rule.
- [ ] Color either stays decorative or follows a separate approved color rule.
- [ ] Co-op shows the same hull stats on host and guest.

## Open questions

- Should a saved loadout ([issue 024](024-named-ship-loadouts.md)) store the
  hull's stat snapshot, or always use the current table?
- Are enemy colors in scope at all?

## Dependencies

Blocked on an owner decision that supersedes
[issue 002](002-ship-selection.md). Do not start from this todo line alone.
[Issue 023](023-skill-levels.md) scales enemies, not hulls. Keep those systems
separate so a hard fight is not also a secretly weak hull.

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
