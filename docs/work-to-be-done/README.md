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
| 009 | [Preserve auto-fire through item selection and interruptions](009-autofire-persistence.md) | Implemented — needs validation |
| 011 | [Controller parity and control reference](011-controller-parity.md) | Implemented — needs validation |
| 010 | [Pace equipment rewards and defer choices](010-reward-pacing.md) | Done |
| 012 | [Prepare GitHub community and release documentation](012-github-community.md) | Done |
| 013 | [Establish CI/CD and release policy](013-deployment-and-changelog.md) | Implemented — needs validation |

### 009 implementation and validation update

Auto-fire now preserves its session toggle through interruptions; mode changes
explicitly clear it. See [issue 009](009-autofire-persistence.md) for implementation
and evidence. The browser firing suite passed 53 assertions during issue 010 work,
following 40 earlier Node VM checks. Physical controller testing and owner review
specifically of firing persistence remain pending. Shared-folder access is fixed
and issue/index status is synchronized.

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

GitHub community documentation and MIT licensing are authorized under
[issue 012](012-github-community.md). Publishing, website deployment, and broader
code organization remain separate work. The gameplay issues do not choose a
hosting setup or prescribe a rewrite.

## 010 — Reward pacing and deferred choices

Status: Done. See [issue 010](010-reward-pacing.md) for
implementation decisions, acceptance evidence and the full validation record.

Paced equipment and player-opened rewards are implemented. Browser checks passed:
53 reward assertions, 39 discarded-item assertions and 53 firing assertions.
Shared-folder access is repaired, unused files are removed, and issue/index status
is synchronized. The owner confirmed validation passed on 2026-10-29. Physical
controller testing is not claimed; recorded controller checks use synthetic input.

## 011 — Controller parity and weapon visibility

Status: Implemented — needs validation. The owner approved the delivered changes
on 2026-10-29 (“I like the changes”). Physical-controller usability and remaining
menu-action validation are still pending; see [issue 011](011-controller-parity.md).
