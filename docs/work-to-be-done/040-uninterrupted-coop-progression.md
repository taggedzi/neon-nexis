# 040 — Uninterrupted cooperative progression

Status: Implemented — needs validation

## Problem or player need

Equipment installation and level-up choices interrupt combat, especially when
co-op players wait for someone to compare rewards. Replace those decisions with
immediate shared progression and meaningful weapon choices during combat.

This is the parent specification, not an implementation claim. Child issues
041–049 partition the work. Completing the planning document does not complete
this feature. All numeric tuning below is proposed unless explicitly identified
as existing approved hull stats.

Design follow-up: [041](041-progression-contracts.md) records the owner's
2026-11-06 answers D1–D12. Its approved rules and the
[integration contract](../progression-contracts.md) supersede corresponding
proposals below, including legacy-build incompatibility and fixed Aegis windows.
These are implementation starting values, not gameplay/playtest acceptance.
The planning handoff was merged through PR #67 at `f5f4591`; the historical
uncommitted planning notes below describe the original handoff only.

## Decisions and approval — 2026-11-06

- Owner approved retaining Kite, Dart, Delta, and Talon with distinct primary
  weapons supporting their roles; three carried offensive weapon types total;
  immediate equipment/passives; predictable duplicate upgrades; and individual
  random additional weapons from a shared pickup.
- Owner explicitly selected **three weapon slots plus a separate defensive slot**.
  This means one permanent primary, two additional offensive weapons, and one
  defensive quick-use item. Defense never requires selecting another weapon.
  This supersedes the draft's proposal that defense consumes one of three slots.
- Owner authorized this spec, local tracker entries, and GitHub implementation
  tickets. No gameplay implementation, commit, push, PR, merge, or publication is
  part of this planning task.
- Proposed defaults below are design candidates, not blanket approval of stats,
  balance, migration, or random-reward rules. Issue 041 resolves material open
  decisions before dependent implementation.
- Rationale: retain tactical agency and ship identity while removing loot
  competition and menu waiting. Consequence: four equipment slots overall, but
  only three selectable offensive weapons.
- Historical issue 010 records the previously accepted deferred reward tray.
  This proposal replaces that experience only when implemented and validated;
  do not rewrite its historical acceptance evidence.

## Core rules

- Solo uses the same progression model as co-op.
- Any participant collecting progression equipment grants one reward to every
  run participant. No proximity or last-hit requirement.
- Additional offensive weapons roll separately for each player; results may
  coincide. Shared does not mean guaranteed different weapons.
- Equipment installs or upgrades immediately without replacing the selected
  weapon, opening a modal, or requiring confirmation.
- Passives remain active without consuming equipment slots.
- One offensive weapon is selected at a time. Existing projectiles/fields finish
  after switching. Defense has its own deliberate quick-use action.
- Preserve held/toggled firing, remapping, controllers, pause/focus handling,
  procedural assets, neon presentation, and current co-op participation rules.

## Hulls and primaries

Hull stats below reproduce the approved table in issue 029, not new balance.
Primary names and behavior are proposals. Verify actual code before implementing.

| Hull | Role | Health | Shield | Base speed scale | Damage scale | Proposed primary |
| --- | --- | --- | --- | --- | --- | --- |
| Kite | Versatile all-rounder | 100 | 20 | 100% | 100% | Pulse Repeater |
| Dart | Mobile skirmisher | 80 | 20 | 115% | 100% | Needle Blaster |
| Delta | Durable frontline | 140 | 30 | 85% | 100% | Scatter Cannon |
| Talon | Fragile precision attacker | 75 | 20 | 100% | 125% | Rail Lance |

Kite offers reliable medium-range fire; Dart rewards tracking while moving;
Delta rewards close positioning; Talon rewards lining up piercing shots. Roles
must remain solo-viable, with no required healer/tank composition. Delta's role
does not authorize new aggro behavior. Hull geometry and cosmetic colors remain.

Proposed level-one weapon values are before hull/passive modifiers:

| Primary | Damage | Interval | Behavior |
| --- | --- | --- | --- |
| Pulse Repeater | 10 | 0.20 s | Straight medium-range projectile |
| Needle Blaster | 6 | 0.12 s | Fast, narrow projectile |
| Scatter Cannon | 5 per pellet, 5 pellets | 0.55 s | Short-range cone |
| Rail Lance | 28 per target | 0.70 s | Pierces up to 3 distinct enemies |

Primaries require no finite ammunition. Rail Lance deals 35 per target on Talon
before upgrades; nominal single-target damage is not a crowd-damage comparison.

## Offensive additional weapons

All hulls may receive all offensive weapons. Initial pool:

| Weapon | Role | Proposed level-one effect | Cooldown |
| --- | --- | --- | --- |
| Seeker Missiles | Accessible offense | 2 missiles, 16 damage each; seek near aim direction | 0.90 s |
| Arc Projector | Lightning crowd attack | 18 damage, then 12 and 8 to distinct nearby enemies | 0.80 s |
| Gravity Bomb | Burst area damage | 45 damage in 110 world units; 25% slow for 1.5 s | 3.0 s |
| Plasma Mortar | Area denial | 90-unit field, 12 damage/s for 3 s | 3.5 s |

Bomb/mortar aiming uses bounded aim-direction projectile travel and must work
with controllers without pixel-precise ground selection. Same-owner overlapping
plasma fields do not stack damage. Boss slow/displacement resistance, different
owners' stacking, projectile lifetimes/ranges, and target selection details must
be fixed in 041. One arc cannot hit the same enemy repeatedly. No recursive
on-hit effects in the initial design. No allied damage or allied knockback.

## Separate defensive slot

One reusable defensive item, activated without changing the offensive weapon.
It has its own cooldown, not consumable charges, as a proposed default.

| Item | Proposed level-one effect | Cooldown |
| --- | --- | --- |
| Repulsor Pulse | Clear eligible enemy projectiles within 125 world units; push ordinary enemies; deal 12 damage | 5.0 s |
| Aegis Projector | Grant self/allies within 140 units a 25-point barrier for up to 3 s | 7.0 s |

Aegis barriers are separate from shields. Proposed repeat applications retain
the greater remaining capacity and refresh duration, rather than adding capacity.
Repulsor cannot erase every boss attack, beam, or environmental hazard. Bosses
resist displacement. Eligibility and bounded group barrier uptime require tests.

Proposed defensive-module rule: fill an empty defensive slot with a random item;
otherwise upgrade the installed item. Never replace automatically. Whether an
initial defense is supplied at launch, and whether later swapping is possible,
are explicit 041 decisions. No upgrade-menu replacement mechanic is authorized.

## Switching and duplicate upgrades

Proposed switching delay: 0.15 s. Support remappable direct slot selection and
next/previous cycling, skipping empty slots and excluding the defensive slot.
Weapon cooldowns persist and advance while holstered; switching cannot reset
them. Test whether cycling cooldowns becomes mandatory optimal play.

Defense is deliberate quick-use, independent of offensive auto-fire. One press
must not repeatedly activate from a held input or fire on focus restoration.
Resolve simultaneous defense/offense behavior in 041.

Proposed weapon maximum: level 5. Damage multipliers relative to level-one base
are 1.00, 1.15, 1.30, 1.45, 1.60. They do not compound per level.
Aegis gains 5 barrier points per level. Repulsor instead loses 0.4 s cooldown per
level (3.4 s at level 5), with fixed damage. No random mutation, extra projectile,
or targeting change on duplicates in the first version.

## Shared reward resolution

Proposed categories:

| Pickup | Per-participant result |
| --- | --- |
| Primary upgrade | Upgrade that hull's permanent primary |
| Offensive module | Fill an empty additional slot with a random unowned weapon; otherwise upgrade an installed additional weapon |
| Defensive module | Fill empty defense slot randomly; otherwise upgrade its item |
| Passive module | Same passive type and one stack for everyone |
| Repair / temporary buff | Immediate effect; sharing and duration policy needs approval |

Proposed full-slot rule: upgrade the lowest-level eligible item, breaking ties
by stable slot order. Maxed items are excluded. If nothing is eligible, proposed
fallback is a small repair, whose value and full-health behavior remain open.

Authoritative rewards record unique event IDs and each participant's concrete
outcome. Retransmission, reconnect, and simultaneous collection cannot duplicate
rewards or reroll them. Downed participants receive progression; original roster
members recover missed rewards on rejoin. Preserve issue 028's locked starting
roster, host-approved saved ships, and existing respawn rules; do not introduce
mid-run newcomers or change respawns through this feature.

Use a team-wide equipment budget so enemy/player count does not multiply shared
progression. Give an early additional weapon opportunity. Exact pacing, drop
weights, boss/cache exceptions, and luck interaction need approval and testing.
Do not assume the old tray's drop budget is balanced for shared grants.

## Stackable passives

No slots; one copy adds one stack immediately.

| Passive | Per-stack proposal | Proposed stack cap |
| --- | --- | --- |
| Reinforced Hull | +10 maximum health | 10 |
| Shield Capacitor | +5 maximum shield | 10 |
| Thruster Tuning | +3% base movement speed | 5 |
| Weapon Amplifier | +4% weapon damage | 10 |
| Cooling System | +5% recharge rate | 6 |
| Reactive Plating | +3 percentage points damage reduction | 5 |
| Recovery Circuit | +10% base shield regeneration rate | 5 |

Maximum-health/shield increases add only the capacity increment to the current
value, not a full refill. Cooling uses baseCooldown / (1 + 0.05 * stacks);
six stacks shorten cooldown by about 23%. Damage applies hull, weapon-level,
and passive multipliers once each. Each passive adds against its defined base.
Caps convert to the approved fallback, never silently waste a reward.

Reconcile existing cores, modifiers, rarity, protocols, slot upgrades and other
stat sources before implementation. Decide which passives affect defensive
cooldowns, barriers, and secondary damage; do not accidentally multiply effects.

## XP, levels, interface, and accessibility

Remove level-up choices as well as equipment/replacement choices. Proposed XP
replacement: visible repeating automatic passive sequence. Issue 041 must decide
team versus individual XP, sequence, catch-up, capped results, and interaction
with drops/saved levels. Do not leave pending protocols as an invisible backlog.

Show the three offensive slots, selected weapon, defensive readiness/cooldown,
and brief local reward results. Coalesce bursts; provide optional nonblocking
history. No notification should steal focus or pause multiplayer.
Examples: "Team pickup: Arc Projector installed", "Rail Lance: level 3".
Use labels/shapes as well as color; preserve enemy-threat visibility under
lightning, explosions, and barriers. Maintain existing quality and effects.

Players who stay on their primary should remain effective. Switching offers
tactical depth without making fast button cycling a requirement. Verify keyboard,
mouse and controller paths; physical-device checks must not be claimed from
synthetic input.

## Existing data and rollout

Issues 010, 014, 016, 020, 023, 024, 028, and 029 intersect this work.
Preserve checkpoints, backups, named ships, settings, difficulty, participant
identity, stats/logbook attribution, and host-approved saved-loadout policy.

Old loadouts may exceed slot limits or contain retired gear, pending tray rewards,
or unspent protocols. Issue 041 approves a compatibility policy; 048 implements
and verifies it. Never silently trim earned equipment or clear storage. If a save
cannot be supported, use the existing export-before-removal/removal choice.
Version new state and network payloads; reject incompatible peers explicitly.

Implement bounded subsystems behind an inactive integration boundary until the
complete reward/input/save/network path is ready. No partial public cutover:
049 owns final activation after dependencies and required checks.

## Benefits and tradeoffs

Benefits: uninterrupted play, no loot competition, meaningful duplicates,
distinct primaries and random builds, active tactical choice, accessible defense.

Risks: unlucky permanent gear, loss of precise build crafting, forced optimal
weapon cycling, defense spam, exponential combinations, visual clutter, and
strong saved ships trivializing shared progression. A separate defensive slot
avoids sacrificing an offensive slot but raises total power and control demands.

Consider later only if playtests justify it: one pre-run preference/exclusion,
controlled replacement between runs, deterministic weapon evolutions, or four
offensive slots. These are not in the initial implementation scope.

## Work breakdown and handoff

Work one issue at a time, one task branch/PR at a time. Different agents may
handle successive issues; this plan does not authorize simultaneous branches
editing shared integration files. Start each task from current main after the
previous PR merges. No agent should implement sibling scope opportunistically.

| Local ID | Responsibility | Prerequisites |
| --- | --- | --- |
| 041 | Resolve design gates and define shared contracts | 040 planning handoff |
| 042 | Three-slot inventory and hull-specific primaries | 041 |
| 043 | Offensive missiles, lightning, bomb and mortar | 042 |
| 044 | Separate defensive item and quick-use simulation | 043 |
| 045 | Stackable passives and deterministic upgrades | 044 |
| 046 | Immediate team rewards, XP and pacing | 045 |
| 047 | Input, HUD and removal of choice screens | 046 |
| 048 | Save/loadout/backup and network compatibility | 047 |
| 049 | Final integration, balance and multiplayer validation | 048 |

Ownership boundaries: 041 owns agreed contracts; 042–045 own equipment mechanics;
046 owns grant authority and reward sequencing; 047 owns bindings/HUD;
048 owns persistence and compatibility; 049 owns activation and end-to-end proof.
All tasks use existing project tooling, inspect actual code through the knowledge
graph, and preserve namespace/load order. File suggestions in child issues are
discovery starting points, not verified current symbol locations.

## Acceptance criteria

- [x] Owner approves remaining material decisions in 041.
- [ ] All four hulls start with the correct primary and retain approved hull stats.
- [ ] Three offensive slots and one separate defensive slot work in solo/co-op.
- [ ] Missiles, lightning, bombs, mortar, repulsor and barriers behave as specified.
- [ ] Shared rewards and levels apply immediately with no choice/install modal.
- [ ] Duplicate upgrades and passive stacks follow the approved deterministic rules.
- [ ] Controls remain remappable and no stuck input/cooldown exploits remain.
- [ ] Downed/rejoining participants receive exactly one grant per eligible event.
- [ ] Checkpoints, saved ships, backups and incompatible peers follow explicit policy.
- [ ] All child checks pass; owner accepts pacing, feel, accessibility and balance.
- [ ] Representative four-player effects/performance meet recorded acceptance goals.

## Implementation and validation

### Combined implementation — 2026-11-08

The owner authorized delegated implementation of the remaining issues, using
best judgment, review, focused commits and one combined playtest handoff. This
supersedes the serial branch/PR workflow above for this batch. See the
[decision record](../decisions.md#2026-11-08--combined-progression-implementation-handoff)
and [049](049-progression-integration-validation.md) for current evidence.
Owner playtesting and real-player performance acceptance remain pending.

Planning only, 2026-11-06. Changed files: this parent spec, child tracker documents,
backlog index and project decision log. No gameplay code changed. Document checks
and GitHub links are recorded after ticket creation. No gameplay tests or balance
measurements are claimed. All implementation acceptance boxes remain unchecked.
Commit: none yet. Remaining work: 041–049 and owner playtesting.

Planning verification: git diff --check passed. All ten new documents passed
LF/final-newline/trailing-whitespace and local issue-link checks. GitHub #57–#66
were created through the authenticated GitHub CLI after the connector reported
insufficient integration permissions. Gameplay tests were not run: docs only.
Branch: codex/coop-progression-spec; all documentation remains uncommitted.

## GitHub implementation checklist

Parent: [GitHub #57](https://github.com/taggedzi/neon-nexis/issues/57).
The full original spec is included in the parent issue. The planning handoff is
merged through [PR #67](https://github.com/taggedzi/neon-nexis/pull/67);
041's current approved decisions and contracts control dependent implementation.

- [x] [041 — Approve progression rules and define integration contracts](041-progression-contracts.md) — [GitHub #58](https://github.com/taggedzi/neon-nexis/issues/58) (design reviewed; branch delivery pending)
- [ ] [042 — Implement hull primaries and three offensive weapon slots](042-hull-primaries-and-slots.md) — [GitHub #59](https://github.com/taggedzi/neon-nexis/issues/59)
- [ ] [043 — Add missiles, lightning, bombs and area-denial weapons](043-offensive-area-weapons.md) — [GitHub #60](https://github.com/taggedzi/neon-nexis/issues/60)
- [ ] [044 — Implement the separate defensive quick-use slot](044-defensive-quick-use.md) — [GitHub #61](https://github.com/taggedzi/neon-nexis/issues/61)
- [ ] [045 — Implement stackable passives and predictable equipment upgrades](045-passives-and-upgrades.md) — [GitHub #62](https://github.com/taggedzi/neon-nexis/issues/62)
- [ ] [046 — Implement immediate shared rewards, automatic levels and team pacing](046-immediate-shared-rewards.md) — [GitHub #63](https://github.com/taggedzi/neon-nexis/issues/63)
- [ ] [047 — Integrate weapon selection, defensive quick-use and nonblocking reward UI](047-progression-controls-and-hud.md) — [GitHub #64](https://github.com/taggedzi/neon-nexis/issues/64)
- [ ] [048 — Preserve saved ships and version progression state and network compatibility](048-progression-save-compatibility.md) — [GitHub #65](https://github.com/taggedzi/neon-nexis/issues/65)
- [ ] [049 — Activate and validate uninterrupted progression end to end](049-progression-integration-validation.md) — [GitHub #66](https://github.com/taggedzi/neon-nexis/issues/66)

Execute in the listed order. Each ticket contains scope, dependencies, ownership,
acceptance criteria and validation requirements. Separate agents may take turns;
no concurrent implementation or automatic assignment has been started.


