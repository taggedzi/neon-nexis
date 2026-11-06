# 041 — Approve progression rules and define integration contracts

Status: Done

## Problem or player need

Independent agents need one agreed equipment/reward model before changing combat.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 040 completed and handed off as a planning document. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Resolve the parent spec's open gameplay decisions with the owner: proposed numeric tables/caps; launch defense and replacement policy; reward weights/pacing/fallback including full health; repair/buff sharing; XP ownership/sequence/catch-up; retained versus retired cores/modifiers/rarity/protocols; boss/field stacking and simultaneous firing; saved-loadout compatibility.
- Inventory current equipment, input, save/loadout, co-op binary/grant and reward paths through the knowledge graph. Record actual symbols/files and existing regression coverage.
- Specify stable equipment IDs, offensive slots (primary + two), separate defensive slot, levels/stacks/cooldowns, selected slot, reward event/participant IDs, authoritative random outcomes, and versioned serialization boundaries.
- Define API ownership for activation, switching, stat rebuilding, reward resolution, persistence and UI notifications. Child implementations must consume these contracts rather than invent parallel state.
- Record owner-approved decisions and superseded rules; do not interpret proposed numbers as approved. Define an inactive integration boundary and explicit final cutover owner.

Discovery starting points (verify against actual code): Content, ships, simulation, input, game, UI, save/loadout and co-op modules; verify locations first.

## Alternatives and tradeoffs

More up-front design prevents agents implementing mutually incompatible defaults. Keep this focused on contracts, not a framework rewrite.

## Acceptance criteria

- [x] Every material open rule has an owner answer or a precisely identified blocked child; dependent implementation does not proceed through an unresolved gate.
- [x] Contract examples cover fresh solo, four players, full/maxed inventory, defense, downed/rejoining players and legacy saved ships.
- [x] Map every existing equipment/reward kind to retained behavior, migration, or explicit incompatibility; no silent losses.
- [x] Document measurable performance/playtest acceptance goals for 049 without inventing benchmark results.
- [x] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

These checked criteria describe the documented design deliverable only. The
owner supplied a clean follow-up review on 2026-11-06, resolving the sole P2;
this design issue is Done. No subjective gameplay criterion or child
implementation criterion is checked by this record. Branch delivery remains
owner-managed and has not occurred.

## Implementation and validation

Design/contracts work started 2026-11-06. No gameplay implementation is authorized.
Branch: `codex/58-progression-contracts`. Base:
`f5f4591cf4e1b36f8ab15d1c778fc63ceffed996`. Commit: none for this task.

- Preflight: clean primary checkout on `main`; fetched origin; local main equals
  origin/main. GitHub CLI reports no open PRs. Planning prerequisite 040 was
  delivered by [PR #67](https://github.com/taggedzi/neon-nexis/pull/67), merged
  2026-11-06 at the base commit above. Its gameplay epic remains Planned;
  completion of that epic is not a prerequisite for this design task.
- Current-source discovery uses the indexed root
  `E:/Home/Documents/Programming/tz-rootish`. Historical validation claims are
  not treated as current test results.
- Changed/new files: `docs/progression-contracts.md` (new contract), this issue
  (approvals, inventory and evidence), `docs/work-to-be-done/README.md` (041
  status only), `docs/work-to-be-done/040-uninterrupted-coop-progression.md`
  (supersession/handoff pointers), `docs/decisions.md` (project-wide decision).
- Implementation: D1–D12 record explicit owner answers. The contract specifies
  stable IDs, fixed slots, canonical state, APIs/ownership, authoritative reward
  and resource ordering, version boundaries, recovery and inactive cutover.
  It includes the requested scenario matrix and measurable 049 validation gates.
- Automated document checks on 2026-11-06: all five changed/new Markdown files
  passed strict UTF-8/no-BOM, LF/final-newline, trailing-whitespace and local link
  path checks (106 local links). A read-only Node VM loaded current content and
  confirmed disposition coverage for all 16 weapons, 26 modules, 22 protocols
  and 6 consumables. `git diff --check` passed.
- Agent manual checks: inspected current source and regression registration,
  compared D1–D12 with owner answers, reviewed contract examples/formulas and
  checked parent/decision-log precedence. These are source/document reviews,
  not browser gameplay checks or evidence of future behavior.
- Not run: `npm run check`, browser/manual gameplay, benchmarks, real WAN or
  physical-controller checks. This changes documentation only, so gameplay
  checks are not proportional; no test result from an older task is claimed.
  Owner approval covers starting design values, not subjective feel/balance.
- Remaining work: owner-managed commit and branch/PR delivery. Independent
  design review is complete with no actionable findings remaining. No known
  material design question is intentionally deferred.
  042–049 implementation/validation remains separate and has not started.
  All five files remain uncommitted; no push, PR, merge or deployment performed.

### Independent review and correction — 2026-11-06

- Review source: Owner supplied the separate review chat's findings. It reviewed
  all five documents against current code and reported one actionable P2:
  rejecting older resource revisions could lose unrelated changes when ordinary
  transactions contained partial results. It reported no other actionable findings.
- Decision: Every resource revision carries complete cumulative resource state,
  not changed fields or deltas. This is an agent implementation decision under
  the authorized review follow-up; it changes no D1–D12 gameplay rule.
- Rationale: A later barrier result must retain an earlier repair even if packets
  arrive out of order. Complete state makes superseding older revisions safe.
- Consequences: 044/046/048 must validate and atomically apply complete state,
  recover missing progression dependencies before using derived capacities, and
  keep progression acknowledgements/outcomes separate from resource revisions.
  The contract now requires reordered repair/barrier, duplicate delivery and
  partial-payload rejection checks; the later result must include earlier HP.
- Supersedes: The contract's ambiguous permission for HP/shield/buff **or**
  barrier results under one resource revision. Changed files for this correction:
  `docs/progression-contracts.md` and this issue only; other task changes preserved.
- Preflight: refreshed origin; no open PRs; HEAD and origin/main still equal the
  recorded base. Continue the same task branch with its existing uncommitted work.
- Validation: all five task documents passed encoding/formatting and 106 local
  link-path checks; issue/backlog status matches; `git diff --check` passed.
  Agent document review checked full-state replacement, progression/resource
  separation and the reordered example. No gameplay tests run; the new
  reordered-delivery case is a required future check, not an executed regression.
- Follow-up review: The owner supplied the separate review chat's result on
  2026-11-06: no actionable findings; the previous P2 is resolved. The reviewer
  confirmed cumulative resource state, progression dependencies, separate reward
  processing, and reordered/duplicate/salvage/partial-payload scenarios. It also
  reported passing formatting, 106 local links and `git diff --check`; no files
  changed and no runtime validation was claimed.
- Status: Done for the design/contracts deliverable, synchronized with the
  backlog. No commit, push or PR is authorized by the clean review. Runtime
  implementation, benchmarks and owner playtesting remain in 042–049.

### Independent-review handoff (completed)

Review the uncommitted issue #58 documentation in the primary checkout on
`codex/58-progression-contracts`, based on
`f5f4591cf4e1b36f8ab15d1c778fc63ceffed996`. Include the new, untracked
`docs/progression-contracts.md`; ordinary `git diff` does not include its content.
Read AGENTS.md, parent 040, this issue's D1–D12 and the contract. Treat D1–D12 as
owner-approved starting rules, then check for contradictions, missing integration
contracts, unsupported approval claims, save loss, duplicate grants, resource
ordering races and sibling scope. Compare against current code; report actionable
findings with file/line references. Do not edit, commit, start another issue,
push, create a PR, merge, deploy or launch agents. Gameplay and balance acceptance
remain future child work. This handoff is retained for the delivery record;
the first review's sole finding was corrected and follow-up review is complete.

Suggested PR title: `docs: approve progression rules and integration contracts (#58)`.
Suggested description: Record owner-approved progression rules, stable state/API
and reward/save compatibility contracts, and child validation gates. Documentation
format/link/catalog checks and `git diff --check` pass; no gameplay code changed.

## Decisions — 2026-11-06

### D1 — Empty defense at launch; installed equipment stays for the run

- Decision: A fresh ship starts with an empty defensive slot. Once installed,
  additional offensive weapons and defense remain for that run; later eligible
  pickups upgrade them. No replacement between sectors or during combat.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Introduce defense through a pickup and avoid replacement decisions
  interrupting combat.
- Consequences: 042, 044, 046 and 047 must preserve slot identity and selection
  during rewards. Saved-ship launch policy is a separate compatibility decision.
- Supersedes: The open launch-defense and in-run replacement questions in 040.

### D2 — Bounded new catalog and explicit old-build incompatibility

- Decision: New progression uses only 040's four hull primaries, four additional
  offensive weapons, two defenses and seven passives. Old equipment, rarity
  tiers, cores/protocols and slot expansion do not enter the new reward pool.
  Catalog approval does not approve numeric tuning.
- Decision: Old checkpoints and named ships are incompatible with new
  progression. Offer export before removal or explicit removal without export;
  never silently convert, trim or clear them. No playable legacy mode is planned.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Keep the first version bounded; the owner selected incompatibility
  instead of maintaining legacy play or inventing equivalent conversions.
- Consequences: 048 must handle old checkpoints, named ships and backups before
  049 activates the feature. Preserve compatible settings/remaps, profile stats
  and logbook data. Export must include the original unsupported build data;
  removal must be explicit and scoped to the affected data. Merely detecting
  incompatibility must not write or remove anything.
- Supersedes: 040's unresolved old-build migration policy. Existing compatible
  saves remain supported until cutover; this decision changes no data now.

### D3 — Shared XP gains, individual earned levels and capped-reward fallback

- Decision: Each starting participant receives the same XP gain, including
  downed and disconnected original participants. Each ship retains its earned
  level and XP; saved ships can therefore level at different times. Each earned
  level grants the next passive in a visible repeating sequence automatically.
  The exact sequence and XP curve still require approval.
- Decision: A capped reward converts to 10 HP of repair. Unused repair adds
  the same amount to a visible salvage tally with no combat benefit. Downed or
  offline recipients receive 10 salvage instead of healing. No reward revives a
  player or changes the existing respawn rules.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Share progression without erasing saved-ship advancement; give
  capped rewards an explicit outcome without recursive XP/level rewards.
- Consequences: 045/046 must resolve cap fallback once; 048 must persist it.
  Rejoin restores concrete outcomes rather than replaying healing or rerolling.
- Supersedes: Team-versus-individual XP ambiguity and the unspecified small
  repair/full-health fallback in 040. No XP salvage loop is permitted.

### D4 — Primary values, weapon levels and switching

- Decision: Approve 040's primary starting values: Pulse Repeater 10 / 0.20 s;
  Needle Blaster 6 / 0.12 s; Scatter Cannon 5 pellets of 5 / 0.55 s; Rail Lance
  28 per target / 0.70 s, at most 3 distinct enemies. Talon's existing hull
  multiplier makes its level-one rail damage 35. Approved hull stats stay intact.
- Decision: Offensive weapon levels 1–5 multiply level-one damage by
  1.00/1.15/1.30/1.45/1.60. No level-based extra shots or rate bonuses. Switching
  imposes 0.15 s before offensive firing; holstered cooldowns keep advancing and
  switching never resets them.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Establish predictable starting numbers for implementation.
- Consequences: 042/043/045 use these formulas; 049 still requires owner balance
  and switching-pressure review. Numeric approval is not playtest acceptance.
- Supersedes: The corresponding proposed primary/level/switch values in 040.

### D5 — Passive values and automatic level sequence

- Decision: Approve the seven passive values/caps below. Bonuses add against
  their stated base; maximum health/shield changes fill only added capacity.
  Cooling affects offensive weapon recharge only, never defense or dash.

| Passive | Per stack | Maximum stacks |
| --- | --- | --- |
| Reinforced Hull | +10 maximum HP | 10 |
| Shield Capacitor | +5 maximum shield | 10 |
| Thruster Tuning | +3% hull-adjusted base movement speed | 5 |
| Weapon Amplifier | +4% weapon damage | 10 |
| Cooling System | +5% offensive recharge rate | 6 |
| Reactive Plating | −3 percentage points damage taken | 5 |
| Recovery Circuit | +10% base shield regeneration rate | 5 |

- Decision: Starting at level 2, repeat Hull → Amplifier → Shield → Cooling →
  Thrusters → Plating → Recovery. A capped result uses D3 fallback and advances
  the sequence; drops do not advance it. Retain current XP requirement
  `38 + 11 * (currentLevel - 1)`. Saved ships retain sequence position.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Predictable automatic advancement and bounded defense uptime.
- Consequences: 045/046 derive stats once, avoid compounding or XP salvage
  loops, and apply XP to each participant's own saved level/XP. 048 stores the
  sequence position. Subjective balance remains pending for 049.
- Supersedes: The corresponding passive/XP proposals and open sequence in 040.

### D6 — Additional offense and effect stacking

- Decision: Approve these level-one effects before hull/passive multipliers:
  Seeker Missiles fires two 16-damage missiles / 0.90 s; Arc Projector deals
  18/12/8 to three distinct enemies / 0.80 s; Gravity Bomb deals 45 in radius 110,
  with 25% slow for 1.5 s / 3.0 s; Plasma Mortar deals 12 damage/s for 3 s in
  radius 90 / 3.5 s. Distances are world units.
- Decision: Bosses ignore slow and displacement. Ordinary enemies take the
  strongest slow, not additive slows. Different owners' plasma damage stacks;
  each owner contributes only their strongest overlapping field. One arc cannot
  hit an enemy twice. No allied damage or recursive on-hit effects.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Establish distinct weapon roles and predictable, bounded effects.
- Consequences: 043 must track per-effect owner/targets and 049 must validate
  four-player overlap without changing quality. Balance approval remains pending.
- Supersedes: The corresponding proposed offensive values and boss/field rules
  in 040. This does not alter existing enemy behavior during the design task.

### D7 — Projectile bounds and controller-friendly targeting

- Decision: Pulse speed 900 units/s, lifetime 0.8 s; Needle 1200 / 0.6 s;
  Scatter 700 / 0.35 s with a 0.62-radian cone; Rail 1800 / 0.6 s. All collide
  with solid walls; Rail ends after its third distinct enemy.
- Decision: Missiles select the nearest visible enemy within 600 units and
  45 degrees of aim; they may reacquire within that cone, move at 500 units/s,
  turn at most 4 radians/s and expire after 2 s. Arc starts at the nearest visible
  enemy within 500 units and 45 degrees of aim, then chains to the nearest unhit
  enemy within 180 units. Bomb/mortar travel 360 units along aim at 600 units/s
  and detonate early on a solid wall.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Bound effects and make aim-direction targeting work on controllers.
- Consequences: 042/043 use world coordinates and line-of-sight/collision checks.
  Owner feel/readability checks remain in 049.
- Supersedes: Unspecified projectile ranges, lifetimes and targeting in 040.

### D8 — Reusable defenses and bounded Aegis uptime

- Decision: Repulsor radius 125, fixed 12 damage, nonboss displacement up to
  60 world units without crossing walls. Clear ordinary enemy bullets only;
  boss projectiles, beams, mines and hazards remain. Cooldown is
  `5 - 0.4 * (level - 1)` seconds, reaching 3.4 at level 5. Hull/passive damage
  and cooling bonuses do not modify it.
- Decision: Aegis grants self/allies within 140 units 25 barrier points plus
  5 per level above one; cooldown 7 s. Reapplications keep the greater remaining
  capacity but never extend a fixed 3 s protection window. Each recipient then
  has a 2 s Aegis lockout. The window/lockout belongs to the recipient, shared
  across casters. Barrier is separate from ordinary shields.
- Decision: Both defenses are reusable and may activate alongside offensive
  firing, but require a fresh press; hold or offensive auto-fire never repeats
  defense. Neither selects a different offensive weapon.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Deliberate protection without permanent four-player barrier chains.
- Consequences: 044 owns recipient windows/cooldowns and 047 the press edge.
  048 preserves timers across supported restoration. 049 must test four Aegis
  users and obtain player acceptance; none has been playtested here.
- Supersedes: 040's proposed repeat-application duration refresh and unspecified
  projectile eligibility, displacement, uptime and simultaneous firing rules.

### D9 — Team pacing and deterministic reward selection

- Decision: First additional-weapon drop after both 18 combat seconds and 4 team
  kills; later ordinary equipment drops after both 36 seconds and 8 team kills.
  Later category weights: primary 30%, additional offense 30%, defense 15%,
  passive 25%. Each boss grants one extra equipment event. Caches and wardens
  use the ordinary budget. Player count and luck do not multiply the budget.
- Decision: For each participant, uniformly choose an unowned additional weapon
  for the first empty additional slot; uniformly choose defense when empty.
  Otherwise upgrade the lowest-level eligible installed item in that category,
  ties by slot order. A passive pickup rolls one uniformly chosen type for the
  whole team. Exclude maxed items from upgrade eligibility; if none qualify use
  D3 fallback. A capped passive result is not rerolled.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Predictable per-team progression with independent random builds,
  while avoiding loot competition and automatic replacement.
- Consequences: 046 owns one budget and resolves participant-specific results;
  bonus boss equipment does not justify restoring old tier/mod cascades. Solo
  uses the same rules. 049 must validate actual pacing and saved-ship balance.
- Supersedes: 040's open timing, weights, boss/cache exceptions, luck and
  full-slot selection proposals. Historical issue 010 evidence is unchanged.

### D10 — Consumables and modifier boundaries

- Decision: Consumables grant all living, connected players repair +28 HP,
  shield `max(18, 0.65 * maxShield)` capped at capacity, overclock +35%
  offensive recharge for 12 s, speed +42% movement for 12 s, or magnet for 9 s.
  Buff reapplication uses the greater remaining duration, not stacking strength.
  Downed/offline players do not bank these effects. Data shards grant all
  original participants 22 XP under D3, including downed/offline members.
- Decision: Hull and Amplifier multiply every offensive damage component once,
  including blast/field damage, never defense. Primary, missile and arc hits
  have 5% critical chance at 1.75 damage; blast/field/defense cannot crit. Plating
  reduces damage before barrier, then shield, then HP. Keep base movement, dash,
  shield regeneration and hit-invulnerability rules.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Preserve familiar consumable and baseline mechanics while giving
  new stat sources explicit boundaries and removing pickup competition.
- Consequences: 043–046 share one modifier calculation; no old tier, core or
  starting vector bonus leaks into new state. Ordinary full-health consumables
  simply cap; D3 salvage is the fallback for capped progression, not a conversion
  of every unused consumable. Defense cooldowns/barriers remain unaffected by
  offensive overclock, Cooling, hull damage or Amplifier.
- Supersedes: 040's unresolved repair/buff sharing and passive-effect boundaries.

### D11 — Launch, continuation and simulation timing

- Decision: Fresh and new-format saved-ship launches start with full HP/shields,
  ready weapons/defense and no temporary buffs/barriers. Saved ships keep their
  installed equipment. Fresh ships follow D1's empty defense rule.
- Decision: Checkpoint/rejoin restores remaining timers without refilling.
  Cooldowns freeze while paused, downed or disconnected. Already-created attacks
  finish on the world's simulation clock; pause freezes that clock too.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Separate new-run setup from continuation and prevent timer resets.
- Consequences: 042/044/046/048 must distinguish launch from hydrate/rejoin.
  Preserve existing revival HP/respawn rules; do not treat revival as launch.
- Supersedes: Unspecified lifecycle timing in 040; no permission to reset saved
  cooldowns when continuing or rejoining.

### D12 — Performance and owner-playtest gates

- Decision: For 049, target 1920×1080, existing default quality and p95 frame
  time ≤16.7 ms on the owner's actual test machine. Check normal play, heavy
  waves and a full 20-minute run with recorded hardware/browser/rendering mode
  and matched before/after workloads. Headless evidence alone cannot pass.
- Decision: Owner review must cover primary-only viability, switching pressure,
  pacing and four-player readability, alongside the parent's accessibility,
  hull-role, defensive and friendly co-op goals.
- Approval source: Explicit owner answers in the issue #58 design chat.
- Rationale: Preserve visual quality and actual playability, not just correctness.
- Consequences: 049 records actual environments and results, including memory
  behavior and unperformed checks. No benchmark or subjective acceptance is
  claimed by this design approval. The detailed matrix is in the contract.
- Supersedes: Unspecified 049 targets; does not rewrite issue 001's historical
  environment or imply its VM measurements passed.

## Integration contract and technical decisions

The companion [integration contract](../progression-contracts.md) defines stable
IDs, canonical state, API ownership, resource ordering, reliable outcomes,
serialization boundaries, old-content disposition, required scenarios and the
inactive cutover boundary. It is part of this issue's deliverable.

Agent implementation decisions, 2026-11-06, authorized by the owner's request:

- Use distinct new catalog IDs, schema/catalog versioning and a single canonical
  participant state. Reason: prevent old IDs or duplicate arrays from acquiring
  conflicting meanings. Consequence: explicit adapters and version checks.
- Let the host commit new-mode progression and related HP/shield/barrier changes
  in authoritative order; guests submit intent and receive revisions. Reason:
  stale guest snapshots must not undo rewards or barrier consumption. Consequence:
  044/046/048 integrate current guest resource paths without changing movement
  controls or adding host migration. This is a new-mode contract, not current code.
- Use run-scoped sequences and bounded replay plus cumulative participant
  snapshots. Reason: once-only rewards and offline recovery without an unbounded
  event list. Consequence: consume source identity and snapshot watermarks together.
- Keep new subsystems inactive until 049. Reason: prevent a partial public reward,
  input, network or save cutover. Consequence: isolated fixtures exercise child
  implementations; old public behavior stays intact until final activation.
- Use the contract's deterministic targeting, ordering and validation details
  where D1–D12 leave routine implementation mechanics open. These decisions do
  not authorize different tuning or any sibling gameplay work in this task.
- Superseded technical contracts: none; these define the first shared interface.

## Current integration inventory

Verified against base `f5f4591` on 2026-11-06. These are current implementations,
not claims that the new progression exists. Graph discovery identified the
modules and functions; text/source reads filled property-assigned-function gaps.

| Responsibility | Current symbols/files | Required integration consequence |
| --- | --- | --- |
| Content and hull bases | `N.WEAPONS`, `N.MODS`, `N.CONSUMABLES`, `N.PROTOCOLS`, `N.SLOT_MILESTONES`, `N.HULL_STATS`, `N.BASE_STATS` in `js/content.js`; `N.Ships.baseStats` in `js/ships.js` | Keep approved hull bases; use a separately versioned catalog, not reinterpreted old IDs. |
| Player construction and stats | `makePlayer`, `makeWeapon`, `G.rebuildStats`, `hydratePlayer` in `js/game.js` | Current launch has pulse + vector, expandable weapon/passive slots, tier multipliers and cores. New construction and stat calculation need an explicit mode boundary. |
| Rewards and XP | `G.collectGroundItem`, `G.addXp`, `G.applyProtocol`, `G.dropForEnemy`, `G.spawnGroundLoot`, `N.Rewards` closure in `js/game.js` | Existing tray, pending protocols and cap-to-XP fallback are not the new rules. Current pacing uses 18/36 combat seconds and 8 kills with luck adjustment and boss bypass; none is automatically approved for shared rewards. |
| Collection and firing | `G.updateGroundItems`, player update/fire paths in `js/sim.js`; weapon callbacks in `js/content.js` | Collection currently chooses one collector; effect ownership must survive offensive switching. |
| Input and presentation | `N.Input` in `js/input.js`, `N.Firing` in `js/firing.js`, UI in `js/ui.js`, HUD in `js/render.js` | Reuse remapping, hold/toggle and release handling. New-mode rewards must not enter choice/overflow modes. |
| Named ships | `N.Loadouts.validateShip`, `capture`, `apply` in `js/loadouts.js` | Version 1 stores earned weapons/tiers, passives, core, level/XP and slot counts; all old builds require explicit incompatibility handling under D2. |
| Checkpoints and backup | `G.canLoadSave`, `G.loadFromSave`, `hydratePlayer` in `js/game.js`; `js/save-policy.js`, `js/save-transfer.js` | Checkpoint version 1; backup file version 4 accepts file versions 1–4. New validation must not let old hydration silently filter unsupported equipment. |
| Per-collector grants | `N.Coop.grantToGuest`, `applyGrant`, `applyGrantAck` in `js/coop.js`, wrapped in `js/coop-session.js` | Existing grant IDs and accepted-grant set are insufficient for a durable team outcome ledger; retain retry/ack discipline. |
| Roster and recovery | `createAuthority` in `js/coop-host.js`; `N.Coop.records`, participant snapshots, restore and rejoin in `js/coop-session.js` | Preserve locked starting identities, life epochs, host-approved loadouts and respawn policy. Prevent old guest snapshots overwriting newer authoritative progression. |
| Binary protocol | `N.Wire.VERSION`, `writeGrant/readGrant`, `writeLoadout/readLoadout`, participant codecs in `js/coop-wire.js` | Current wire version 6; catalogs encode array indexes. New schema requires explicit compatibility/version checks and fixed catalog order. |

### Existing regression coverage inspected

- `tools/check-grants.cjs`: lost acknowledgements, retained reservations,
  repeat delivery and collector-specific pickup range.
- `tools/check-coop-wire.cjs`: version 6 encode/decode, malformed/mismatched
  messages, catalog indexes, participant snapshots and payload bounds.
- `tools/check-discarded-items.js`: tray, auto-attach, duplicates and full
  inventory; registered with the `rewards` and `discarded-items` cases in
  `tools/ci/regression.spec.cjs`.
- `tools/check-firing.js`, `tools/check-controller.js`: held/toggled fire,
  interruption and synthetic controller/remapping paths; also registered.
- `tools/ci/coop-four.spec.cjs`: 2–4-player launch, pause, revival and rejoin.
- `tools/ci/unit.cjs` discovers root `tools/check-*.cjs`; package `check` runs
  syntax, lint, unit and browser suites. Existing checks do not prove the new
  contracts. None of these tests has been executed for this documentation task.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/58
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/57
Local source: `docs/work-to-be-done/041-progression-contracts.md`.
The planning handoff is merged through PR #67 at the base recorded above.
The earlier unmerged-planning note is superseded by this verified history.

