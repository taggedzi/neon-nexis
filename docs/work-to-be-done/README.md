# Work to be done

These Markdown documents are the authoritative local tracker. Numbers are local
tracking IDs; GitHub is not required.

| ID | Issue | Status |
| --- | --- | --- |
| 001 | [Improve overall performance, especially during large enemy waves](001-performance.md) | Implemented — needs validation |
| 002 | [Choose ship type and color before a run](002-ship-selection.md) | Planned |
| 003 | [Center the ship and improve camera tracking](003-camera-follow.md) | Planned |
| 004 | [Add ship-relative driving controls](004-control-options.md) | Planned |
| 005 | [Reduce enemy spawn frequency](005-enemy-spawning.md) | Planned |
| 006 | [Remove discarded items](006-discarded-items.md) | Implemented — needs validation |
| 007 | [Generate varied map sizes and shapes](007-procedural-maps.md) | Planned |
| 008 | [Add toggle and held-button firing modes](008-firing-options.md) | Planned |

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
