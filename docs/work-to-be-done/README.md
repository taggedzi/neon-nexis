# Work to be done

These local issue documents record requested changes. All issues are **Planned**;
none are implemented by this documentation commit. They can later be copied into
GitHub Issues. Numbers are local tracking IDs, not GitHub issue numbers.

| ID | Issue |
| --- | --- |
| 001 | [Improve overall performance, especially during large enemy waves](001-performance.md) |
| 002 | [Choose ship type and color before a run](002-ship-selection.md) |
| 003 | [Center the ship and improve camera tracking](003-camera-follow.md) |
| 004 | [Add ship-relative driving controls](004-control-options.md) |
| 005 | [Reduce enemy spawn frequency](005-enemy-spawning.md) |
| 006 | [Remove discarded items](006-discarded-items.md) |
| 007 | [Generate varied map sizes and shapes](007-procedural-maps.md) |
| 008 | [Add toggle and held-button firing modes](008-firing-options.md) |

## Suggested implementation order

Establish a performance baseline first (001), before changing spawn frequency
(005), so reduced enemy counts do not hide underlying performance problems.
Controls, camera, and firing (004, 003, 008) form a related play-feel milestone.
Ship selection and discarded-item cleanup (002, 006) can be delivered independently.
Procedural maps (007) should follow the performance baseline and include another
performance check with obstacles and bosses.

## Scope and decisions

Acceptance criteria describe intended behavior, not a prescribed implementation.
Unchecked boxes are future validation tasks. Open questions should be resolved
before implementing the affected behavior; proposed defaults are not approved
design decisions. Reported symptoms come from the player's experience and have
not yet been verified through profiling or a code review.

GitHub distribution, licensing, website deployment, and broader code organization
remain separate planning topics. This backlog records the eight requested gameplay
changes without choosing a hosting setup or prescribing a rewrite.
