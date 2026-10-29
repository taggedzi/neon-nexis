# Work to be done

These Markdown documents are the authoritative local tracker. Numbers are local
tracking IDs; GitHub is not required.

| ID | Issue | Status |
| --- | --- | --- |
| 001 | [Improve overall performance, especially during large enemy waves](001-performance.md) | Implemented — needs validation |
| 002 | [Choose ship type and color before a run](002-ship-selection.md) | Implemented — needs validation |
| 003 | [Center the ship and improve camera tracking](003-camera-follow.md) | Implemented — needs validation |
| 004 | [Add ship-relative driving controls](004-control-options.md) | Implemented — needs validation |
| 005 | [Reduce enemy spawn frequency](005-enemy-spawning.md) | Implemented — needs validation |
| 006 | [Remove discarded items](006-discarded-items.md) | Implemented — needs validation |
| 007 | [Generate varied map sizes and shapes](007-procedural-maps.md) | Implemented — needs validation |
| 008 | [Add toggle and held-button firing modes](008-firing-options.md) | Implemented — needs validation |

## Implementation sequence and validation

Delivered in order: 001, 006, 003, 004, 002, 008, 005, 007. Ship selection proceeded
while firing decisions were pending. Performance baselines preceded balance and
map changes; 007 includes a separate final-map performance smoke check.

All eight issues have focused implementation commits and follow-up hash records
in their documents. None is Done: owner visual/handling/pacing review, physical
controller checks, and performance/memory acceptance remain where documented.
The software-rendered automated browser does not meet the agreed 16.7 ms p95
display target; accelerated 20-minute simulations are supplemental checks rather
than full-duration rendering or retained-memory validation.

## Scope and decisions

Acceptance criteria describe intended behavior, not a prescribed implementation.
Unchecked boxes are future validation tasks. Open questions should be resolved
before implementing the affected behavior; proposed defaults are not approved
design decisions. Reported symptoms come from the player's experience and have
not yet been verified through profiling or a code review.

GitHub distribution, licensing, website deployment, and broader code organization
remain separate planning topics. This backlog records the eight requested gameplay
changes without choosing a hosting setup or prescribing a rewrite.
