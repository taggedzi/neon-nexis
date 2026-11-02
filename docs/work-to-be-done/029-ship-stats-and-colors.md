# 029 — Give ships stats and decide what colors mean

Status: Done

## Approved scope — 2026-11-02

Owner approval: voice-chat approval relayed in the implementation request explicitly
supersedes issue 002's cosmetic-only stats. Colors remain cosmetic; weapons and
upgrades remain shared; hull shapes and outline hitboxes remain unchanged.

| Hull | Role | Health | Shield | Speed | Damage |
| --- | --- | --- | --- | --- | --- |
| Dart | Fast scout | 80 | 20 | 115% | 100% |
| Delta | Heavy | 140 | 30 | 85% | 100% |
| Kite | Balanced | 100 | 20 | 100% | 100% |
| Talon | Glass cannon | 75 | 20 | 100% | 125% |

Percentages apply to the shared base before upgrades (base speed currently 245).
Only new runs adopt these stats. Existing checkpoints retain their original bases
and upgrades. Rationale: distinct hull roles without changing an existing run.
Named ships launch new runs and therefore use current hull bases with their saved
equipment/upgrades (agent implementation choice consistent with new-run rule).
Host and guests use the same initialization; no color mechanics are added.
See [decision log](../decisions.md#2026-11-02--hull-roles-for-new-runs-issue-029).

## Acceptance criteria

- [x] The owner approved the stat table above.
- [x] The select screen states each difference.
- [x] In-game numbers match that table and no other hidden difference.
- [x] Existing runs retain their saved stats until a new run.
- [x] Colors stay decorative under the owner-approved rule.
- [x] Co-op shows the same hull stats on host and guest.
- [x] Owner accepts hull handling and balance after playtesting (2026-11-02).

## Scope and related decisions

This replaces the equal-stat decision in [issue 002](002-ship-selection.md).
Its shape-matched hitboxes and other selection requirements remain in force.
The six existing colors (cyan, magenta, lime, amber, violet and ice) stay cosmetic.
Enemy hue changes and color resistances are outside scope.
[Issue 023](023-skill-levels.md) continues to scale enemies independently.
[Issue 024](024-named-ship-loadouts.md) continues to share equipment and upgrades.
No graphics or quality changes are part of this issue.

## Implementation and validation

- Implementation commit: `e31b0b9` (`feat(ships): apply approved hull stats to new runs`).
- Delivery branch: `codex/029-ship-stats`. Owner authorized commit, push, PR creation
  and rebase merge on 2026-11-02; website publishing/deployment remains separate.
- `js/content.js`: approved hull base table, before upgrades.
- `js/ships.js`: shared base-stat calculation and selection descriptions; hull
  points, drawing and collision algorithms are unchanged.
- `js/game.js`: selection-aware player creation and stat rebuilding. Checkpoints
  save `hullStatsVersion`: absent/0 keeps original shared bases, 1 uses this table.
  Unknown revisions are refused by the existing incompatible-save recovery gate.
  This preserves old runs through upgrades and repeated checkpoint cycles without
  clearing stored data or changing the overall checkpoint format version.
- `js/coop.js`: local guest and host-owned remote pilots use the same constructor
  with the selected hull. Existing stat synchronization remains authoritative.
- `js/loadouts.js`: new named-ship runs use current hull bases and fully refill
  health/shield, retaining saved equipment and upgrades.
- `index.html`, `js/ui.js`, `js/loadouts-ui.js`: solo/co-op selection descriptions
  show role, health, shield, speed and damage; named selection shows its saved hull.
- `tools/check-ships.js`: all hull/color combinations, host remote parity,
  checkpoint revision persistence, legacy rebuilds and existing hitbox checks.
- `tools/ci/hull-stats.spec.cjs`: selection copy, narrow/desktop captures,
  before-upgrade values, repeat rebuilding, legacy upgrades/checkpoint cycles,
  named-ship adoption, unknown revision refusal and unchanged remaining bases.
- `tools/ci/coop-four.spec.cjs`: distinct hull choices and host/guest stat checks
  in the existing three/four-player launch, recovery and combat scenarios.
### Checks and results — 2026-11-02

- Windows, Node v24.14.1, PHP 8.4.13; Playwright Chromium 156.0.8078.4 and
  Firefox 157.0. These are headless automated browser checks, not physical-device
  or real-player performance evidence. Google Chrome was not checked separately.
- `npm run check` passed: syntax, ESLint, all registered unit suites, and 150
  browser tests (7.4 minutes). This includes the expanded ship regression's 170
  assertions per browser; distinct hulls in three/four-player host/guest launch,
  combat, pause, recovery and rejoin scenarios; and start/move/save/continue smoke.
- Final `npx playwright test tools/ci/hull-stats.spec.cjs` passed both tests after
  adding explicit narrow-screen Launch-button scrolling/reachability coverage.
- Final syntax and lint checks passed after the last source edits.
- Agent inspected selection captures at 1280×720 and 360×740, including the narrow
  footer in both browsers. Stat copy wraps, no horizontal overflow was detected,
  and the Launch control is reachable through the existing panel scroll.
- Agent compared original and updated Talon/cyan selection at 1280×720 using the
  original files served by request interception in a separate isolated context.
  Hull geometry, preview and styling are preserved; the added description shifts
  later controls downward. Animated attract backgrounds vary between captures.
- `git diff --check` passed. No owner browser storage was accessed or cleared;
  tests used isolated browser contexts. Captures remain ignored test artifacts.
- Initial sandboxed `npm run check` stopped at PHP server startup after passing
  syntax/lint. Running with permitted local-server/browser access resolved it.
- Owner playtest approval — 2026-11-02: the owner played the game and said they
  like the changes. The follow-up instruction explicitly accepts this as approval
  of hull handling/balance. Together with the automated evidence above, this
  completes issue 029's acceptance criteria. No per-hull, input-device or WAN
  playtest protocol was supplied, so no such detailed owner test is claimed.
- Limitations: agent checks did not use physical controls or real multiplayer/WAN;
  automated co-op used local headless browser contexts. No performance improvement
  or new cross-browser support guarantee is claimed. These are broader validation
  limits, not remaining issue 029 acceptance work.
