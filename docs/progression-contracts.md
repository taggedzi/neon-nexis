# Uninterrupted progression integration contracts

Design work for [041 / GitHub #58](work-to-be-done/041-progression-contracts.md),
under [parent 040](work-to-be-done/040-uninterrupted-coop-progression.md).
This document describes future interfaces, not implemented gameplay.
Implementation update, 2026-11-08: the combined 045–049 branch implements these
contracts; current verification and remaining player/performance gates are in
[049](work-to-be-done/049-progression-integration-validation.md). The original
design wording below is retained as the approved contract. The UI projection
interface is implemented as `ProgressionControls.view(player)`, rather than a
reward-mutating namespace, and XP source resolution requires the authority's
canonical live-world source lookup. These are agent implementation choices;
they do not change the approved gameplay rules.
Status: design complete; independent follow-up review reported no actionable
findings on 2026-11-06. Branch delivery remains pending. Owner-approved starting
rules are D1–D12 in 041; gameplay implementation and playtest acceptance remain
with the child issues. No material gameplay question is intentionally deferred.

## Authority and ownership

Technical choices in this document are agent implementation decisions dated
2026-11-06, authorized by the owner's request for integration contracts. Gameplay
choices require the approval records in 041. Contract refinements belong in 041
before consumers diverge; no implementation may silently reinterpret them.

| Owner | Boundary |
| --- | --- |
| 042 | Equipment construction, fixed slots, selection and primary firing |
| 043 | Additional offensive effects, targeting and effect lifetime |
| 044 | Defensive activation, barriers and defensive effect simulation |
| 045 | Pure stat derivation, level/stack limits and upgrade eligibility |
| 046 | Authoritative reward resolution, XP, pacing and participant outcome recovery |
| 047 | Remappable actions, nonblocking reward feedback and HUD projections |
| 048 | Strict validation, persistence, backup recovery and final wire compatibility |
| 049 | Final activation and integrated validation; no earlier public cutover |

Use bounded modules on `window.NEON`, preserving script dependencies. Reserved
public namespaces are `N.ProgressionContent`, `N.Equipment`, `N.ProgressionStats`,
`N.ProgressionRewards` and `N.ProgressionPersistence`; these do not exist yet. UI consumes projections and
requests actions. It never awards equipment, rolls rewards or rebuilds stats.

Solo owns its local authoritative state. In co-op the host owns progression,
reward randomness and committed outcomes for every member of the locked starting
roster, including absent/downed members. Guests submit intent and acknowledge
state. Guest loadout/participant snapshots must not overwrite host progression.
Transport ownership stays in `N.Net`/`N.Coop`; no backend or new transport.

For `shared_v1`, host resource state also orders HP, shield, barrier consumption,
capacity deltas and repair/buff outcomes. 044 owns defense/damage integration;
046 owns reward integration; 048 owns validated snapshots/revisions; 049 verifies
the combined path. Existing guest `participant`/`state` payloads cannot replace
these authoritative fields. Movement/aim remain on existing input paths; local
cosmetic prediction may preserve responsiveness but cannot commit damage or
progression. Do not apply the old guest hit/heal handler and the new committed
resource result for the same event. This closes the current mirror/guest race
without introducing a second resource owner or changing revival policy.

Implementation refinement, 2026-11-08: complete resource revisions also carry
`dashCharges`, `maxDashCharges`, `dashTimer`, `dashTime` and `dashDir`. A fresh
guest dash intent is validated against host charge/recharge state and life/input
sequence; it grants the existing brief invulnerability. Movement prediction stays
on the existing guest path. Rejoin preserves remaining charge/timer state and the
accepted intent-sequence watermark. This preserves existing controls under host
resource authority and changes no dash tuning.

## Catalog and identity

IDs are immutable machine keys, separate from labels, icons and display order.
Never reuse an old ID for a differently behaving weapon. The order below is the
version 1 catalog order; binary tables must be explicit, not object-key order.

| Kind | Stable IDs in order |
| --- | --- |
| Hull primaries | `pulse_repeater`, `needle_blaster`, `scatter_cannon`, `rail_lance` |
| Additional offense | `seeker_missiles`, `arc_projector`, `gravity_bomb`, `plasma_mortar` |
| Defense | `repulsor_pulse`, `aegis_projector` |
| Passives | `reinforced_hull`, `shield_capacitor`, `thruster_tuning`, `weapon_amplifier`, `cooling_system`, `reactive_plating`, `recovery_circuit` |

Hull mapping: kite → pulse_repeater; dart → needle_blaster; delta →
scatter_cannon; talon → rail_lance. Primaries have no finite ammunition.

Equipment identity is `(participantId, slotIndex)` for offense and
`(participantId, defense)` for defense. Offensive slots are always exactly
`[primary, additionalOrNull, additionalOrNull]`, with indexes 0–2. Primary is
required and matches the hull. Additional types cannot repeat. Defense is separate
and never appears in offensive cycling. Levels are integers 1–5; absent passives
mean zero stacks; present stacks are positive integers within their own cap.

`participantId` is the locked roster's original `clientId`, not seat number,
display name or life epoch. Seats and life epochs remain transport/life metadata.
Solo gets one stable participant ID for the saved run. Use a persisted run token
plus monotonic safe-integer event sequence to identify rewards across reconnects
and sector transitions. A restarted/new run gets a new token; restoring a
checkpoint restores its token and sequence together.

## Canonical state

One `player.progression` state belongs to each player/host-retained participant
record.
Do not maintain independently mutable old and new equipment arrays. Existing
render/combat adapters may derive views during integration.

```js
{
  schemaVersion: 1,
  catalogVersion: 1,
  offensive: [
    { id: 'pulse_repeater', level: 1, cooldownSeconds: 0 },
    null,
    null
  ],
  selectedOffensiveSlot: 0,
  switchDelaySeconds: 0,
  defensive: null,
  passives: {},
  level: 1,
  xp: 0,
  nextPassiveIndex: 0,
  salvage: 0,
  revision: 0,
  appliedEventSequence: 0
}
```

An installed defense has `{ id, level, cooldownSeconds }`. Barrier capacity and
remaining duration are transient combat state, not shield capacity or a passive.
Stats are derived and are never trusted from a save or guest packet. Health,
shields and buffs stay outside the equipment object but use the new-mode resource
authority defined above. Life transitions, motion, difficulty, statistics and
logbook retain their existing subsystem ownership; adapters coordinate them.

`nextPassiveIndex` indexes D5's sequence, not catalog order. It starts at zero,
advances once per earned level and is consistent with `(level - 1) % 7` in this
version. Equipment drops do not advance it. `xpNext` is derived from the approved
level curve. Saved-ship launch copies earned state into a new run identity;
checkpoint/rejoin restoration is a different operation and cannot grant levels
or refill resources merely by rebuilding state.

`level`, `xp`, equipment and selection in this object are authoritative. Existing
consumers of top-level `player.level`/`weapons` need read-only projections or
explicit adapters, not a second writable copy. `run.progression` holds
`schemaVersion`, `catalogVersion`, `runToken`, `nextEventSequence`, the locked
participant IDs, retained participant snapshots and the one pacing budget
`{ firstOrdinaryDrop, combatSeconds, teamKills }`. A run token is 32 lowercase
hex characters generated at launch. Event identity is the pair `(runToken,
sequence)`; sequence starts at 1. Neither sector nor life changes it. New wire
validation must not reuse the old grant ID's 40-character restriction for a
concatenated identity; serialize the two fields explicitly. The new token
supplements existing room `_run`/life stamps, without replacing pause epochs.

## API contracts

Names below are the agreed interface surface for child work, not executable code.
Return explicit results such as `{ ok: false, reason }`; rejected actions do not
mutate state or consume cooldowns. Times are simulation seconds, angles radians,
and positions world coordinates.

| Interface | Owner and semantics |
| --- | --- |
| `Equipment.create(hullId)` | 042: create level-one primary, two empty additional slots, empty defense, slot 0 selected, zero passives. |
| `Equipment.select(state, slotIndex)` | 042: reject empty/invalid slots; same-slot request is a no-op; a real change sets the approved switch delay without modifying individual cooldowns or existing effects. |
| `Equipment.cycle(state, direction)` | 042: direction is −1 or +1; skip empties; a sole primary remains selected without resetting delay. |
| `Equipment.tick(state, elapsedSeconds)` | 042/044: advance cooldowns and switch delay only under the agreed simulation/life timing policy. Never use wall time or display-frame counts. |
| `Equipment.tryFire(context, intent)` | 042/043: validate live player, selected slot, readiness and switch delay; snapshot damage/attribution; create one firing event and start its cooldown. |
| `Equipment.tryDefend(context, intent)` | 044: separate edge-triggered action; validate defense and cooldown; never switch offense or toggle auto-fire. |
| `ProgressionStats.derive(hullId, state)` | 045: pure calculation; returns derived stats without healing, RNG, persistence or UI. |
| `ProgressionStats.upgradeOutcome(state, category)` | 045: pure eligibility/result calculation; no mutation, healing or random selection. |
| `ProgressionRewards.collect(context, pickupId)` | 046: authority validates unconsumed pickup, snapshots eligibility, resolves all concrete participant outcomes, commits once, then publishes. |
| `ProgressionRewards.addXp(context, sourceId, amount)` | 046: deduplicate XP source; award the same base amount to every original participant, resolving automatic levels in order. |
| `ProgressionRewards.applyCommitted(state, event)` | 046: idempotent ordered application; never reroll, recalculate a fallback from later HP, or emit a second notification on replay. |
| `ProgressionRewards.snapshot(context, participantId)` | 046/048: authoritative cumulative state and event watermark, suitable for reconnect and compaction. |
| `ProgressionRewards.view(state)` | 047: read-only labels, levels, readiness and bounded recent outcomes; no simulation mutation. |
| `ProgressionPersistence.validate/read/write` | 048: validate whole envelopes before any live/storage mutation; distinguish checkpoint, named-ship launch, recovery export and backup import. |

### 044 defensive integration surface

Agent implementation choices, 2026-11-07, on issue 044: `Equipment.tryDefend`
returns the committed effect outcome and starts the separate cooldown. A host
call supplies `participantId` and `activationId`; an Aegis host call also
supplies `resourceIdentity(player)`, returning the run token and original
participant ID for every eligible recipient. The call preflights all recipient
resource identities before applying barriers and returns complete resource
revisions alongside the effect event. An empty or rejected cast never queues an
input for later. These are internal interfaces, not the 048 wire format.

`ProgressionDefense.damageTransaction(player, amount, identity)` is the host
damage boundary for a remote participant: it applies the derived damage-taken
multiplier, barrier, shield and HP in order and returns a cumulative resource
revision. It rejects guest authority. `commitResources(player, identity)`
produces a complete revision after another resource transaction; 046 must use
the same participant revision sequence for repairs and buffs. No caller may
also apply the legacy guest hit/heal packet for the same shared-mode transaction.
For shared-mode host combat, `G.progressionAuthority` supplies
`identityFor(player)` and `publishResource(event)`; absent or invalid authority
rejects the hit before mutation. The legacy participant, loadout and hit/heal
paths do not overwrite shared-mode resources. 048 must install and remove this
adapter with the run and implement its reliable delivery; it must not publish
an incomplete event or apply the old packet in addition.
048 owns strict packet validation, atomic receiver application, progression
dependency recovery and delivery/retry; 049 wires the inactive paths together.

`snapshotBarrier` and `restoreBarrier` copy and validate remaining recipient
window/lockout state. `tickWorld` advances barriers on the world clock, including
downed/offline retained records supplied by the caller, without advancing their
equipment cooldowns. 048 must retain those records and hand each participant to
the clock exactly once; it must not recreate or refresh a window on rejoin.
`snapshotVisuals`/`setGuestVisuals` expose bounded draw-only effects for 048's
hazard-sync adapter. They do not authorize a guest to simulate the effect.
Repulsor outcomes identify cleared host bullet IDs. The current legacy bullet
codec does not preserve those IDs, so 048 must add matching IDs and reconcile
late or reordered spawns/clears before activating this path; position matching
or guest-side eligibility checks are insufficient.

Increases to maximum health/shield are handled as a one-time committed capacity
delta, separately from pure derivation. Repeated derive/load/rejoin must not heal.
Downed players remain downed even when maximum health increases. Effect snapshots
retain owner participant ID, weapon ID, activation ID and damage parameters after
switching. Route damage/kill attribution through existing stats/logbook hooks;
shared progression is not permission to credit every player with every kill.

## Reliable reward delivery

Every event stores run token, sequence, source ID, category, ordered participant
IDs and each concrete outcome. Installation results include the chosen ID and
slot; upgrades include old/new level; passives include old/new stacks; XP results
include final level/XP/sequence position; fallback includes actual repair and
salvage. Randomness is resolved once by the authority in stable roster order.

Progression events include a result for every roster member, including explicit
ineligibility/no-change results, so sequence gaps are unambiguous. Resource
transactions must carry a complete cumulative authoritative resource state at
their revision, never only changed fields or repair/barrier deltas. This applies
to every ordinary resource transaction as well as recovery snapshots. Include
HP, shield, all active buff state, barrier capacity/window/lockout and related
resource timers, explicitly representing inactive/zero values. A newer revision
includes the resulting state of all earlier resource transactions for that run
and participant, including unrelated resource changes. Apply the validated state
atomically; never replay earlier healing as an increment on top of it.

Resource payloads identify the run, participant, resource revision and progression
sequence on which their capacities depend. If that progression prefix has not
been applied, recover it (or a complete paired snapshot) before applying resource
state; do not clamp newer HP/shield against stale derived capacities. Once those
dependencies are satisfied, a complete newer resource revision may supersede
missing older resource revisions. Receivers ignore older/equal resource states,
even when the associated progression event still needs processing/acknowledgement.
Accepting resource revision 12 does not advance the progression-event watermark
or suppress an unprocessed salvage/equipment outcome from event 11. Progression
events retain their own ordered delivery, deduplication and notification rules.
Earned-state and resource revisions remain separate from display/movement updates.

Atomic logical commit means: consume a source once and update all eligible
participant records in one simulation transaction before publishing. A send
failure does not undo or reroll it. Multiple collectors of one pickup share the
same source ID; only the first valid collection commits. Different pickups use
different IDs even when collected in the same simulation step.

Clients acknowledge their applied sequence. Duplicates acknowledge without
reapplying. Gaps request replay/snapshot; a later event must not skip an unseen
earlier event. Bounded transport buffers fall back to cumulative snapshots.
Authority retains cumulative state for all original participants even after
disconnect; a snapshot plus watermark replaces an unbounded permanent event log.
Compaction must not lose outcomes for offline members or permit old source IDs
to be collected again. Persist consumed-source/world state with progression.

Rejoin adopts the authoritative snapshot before gameplay resumes. Sector and
life changes do not erase earned progression. Existing life stamps still reject
stale combat actions; the progression stream is run-scoped, so an old-life grant
is recovered by current cumulative state rather than discarded. Guest snapshots
and grant acknowledgements carry revision/watermark, never authority to reduce
or replace the host's earned state.

No host migration or disk-resumable co-op session is introduced: current co-op
does not use local checkpoints. Persistence covers solo continuation and named
ships; in-session host retention covers co-op disconnect/rejoin. Host session
loss retains existing session-ending behavior.

## Persistence and compatibility

048 owns the final validators and codecs. Technical version reservations relative
to inspected main are checkpoint 2, named-ship envelope 2, backup file 5, wire 7
and lobby `loadoutRules: 2`, carrying progression schema/catalog 1. Recheck these
allocations against current main before implementing; a collision requires a
documented new allocation, never reuse of an incompatible format. Introduction
protocol 2 can remain if its schema is unchanged; the lobby and wire must still
reject incompatible progression peers explicitly before launch. Do not infer
compatibility from a matching release string or silently fall back to legacy.

Checkpoint state includes run token, participant state/revision/watermark,
source consumption, pacing counters, level/XP/sequence, selected slot, cooldowns,
switch delay, health/shield, active buff timers, barrier window/lockout and
salvage. Restore timers as remaining simulation time, with no offline recharge.
Preserve the existing checkpoint world policy; this feature does not promise
serialization of every live projectile. Rejoin snapshots include active combat
effects through the existing hazard-sync mechanism, extended by 043/044/048.

Named ships preserve hull/color, earned equipment/levels/stacks, individual
level/XP/sequence and highest sector. They launch a new run under existing
host permission, difficulty and start-sector limits. They do not carry old run
IDs, consumed sources, event sequences, active barriers/buffs or match salvage
into the next run. Launch resource/cooldown defaults follow D11; checkpoint
restore must never reuse launch initialization.

Validation checks exact supported versions, known IDs, hull-primary mapping,
exactly three offensive slots, no duplicate additional types, integer levels and
stacks within caps, selected nonempty slot, finite nonnegative timers, consistent
XP/sequence, safe event counters and roster membership. Validate an entire
envelope into temporary state before replacing live state. Reject unknown/future
versions and malformed data explicitly. Never filter unknown IDs away or invent
a replacement primary while accepting damaged new-mode state.

### Exhaustive old-content disposition

D2 applies to every old build, even an otherwise empty or level-one ship. These
are explicit incompatibilities, not conversions. Original raw data is retained
for export/removal choice. Similar names below do not establish equivalence.

| Current kind / IDs or fields | New-mode disposition |
| --- | --- |
| Weapons: `pulse`, `scatter`, `rail`, `spiral`, `seeker`, `nova`, `mortar`, `mine`, `tesla`, `beam`, `orb`, `chain`, `shard`, `gravity`, `starfall`, `shuriken` | All old weapon instances incompatible; none is renamed or converted. New catalog has distinct IDs. |
| Modules: `kinetic`, `overclock`, `vector`, `multi`, `pierce`, `ricochet`, `chainarc`, `crit`, `vitality`, `nano`, `armor`, `shieldcell`, `phase`, `servo`, `magnet`, `prospector`, `xpdecoder`, `thorns`, `explosive`, `siphon`, `temporal`, `glitchmembrane`, `cursed_berserk`, `cursed_blood`, `cursed_void`, `cursed_glitch` | All old stacks incompatible. No automatic conversions to seven new passives; curses and on-hit modifiers retire from new rewards. |
| Protocols/core: `p_dmg`, `p_rate`, `p_move`, `p_hp`, `p_shield`, `p_crit`, `p_multi`, `p_pierce`, `p_area`, `p_pickup`, `p_xp`, `p_dash`, `p_regen`, `p_armor`, `p_leech`, `p_proj`, `p_luck`, `p_thorns`, `p_duration`, `p_dodge`, `p_reload`, `p_speed_dmg` | All earned cores and unspent protocol choices incompatible; do not drop them while claiming migration. New levels use the automatic sequence. |
| Weapon tiers 1–3 and rarity labels; `weaponSlots`, `passiveSlots`, `SLOT_MILESTONES` | Old instances incompatible; new offense has three fixed slots, defense one, passives no slots and no rarity multiplier. |
| Tray `rewards.pending`, active overflow choice, `pendingLevelUps`, old ground equipment and grant reservations | Remain in original exported old checkpoint data; never silently consume or convert them. New mode has no pending choice state. |
| Consumables: `repair`, `shield`, `overclock`, `speed`, `magnet`, `data`; XP from kills and other sources | Old checkpoint instances remain incompatible with that checkpoint. New-spawn behavior and sharing are governed by 041's separate consumable/pacing decisions, not inferred from these IDs. |
| Hull and color, difficulty, settings/remaps, profile stats/logbook | Approved hull table and cosmetic colors retained. Preserve compatible non-build data; incompatibility does not authorize resetting settings, stats or the logbook. |
| Old levels/XP, highest sector and other earned ship fields | Stay in raw exported old builds; not imported independently as a hidden conversion. New-format saved ships retain their own earned state. |

At cutover, inspect both checkpoint and named-ship storage without mutating.
Present affected data and export-before-removal or explicit removal options.
Retaining/dismissing the prompt must leave data unchanged. Never overwrite an
unsupported stored checkpoint/list as a side effect of starting or auto-saving
a fresh run. Compare the raw value again before removal to avoid deleting another
tab's replacement. If export initiation or storage removal fails, report failure
and preserve whatever remains; do not claim success from an unchecked write.

Recovery export must preserve original unsupported bytes, independent of current
gameplay validators, including malformed payloads when readable. Backup import
containing incompatible builds must fail before any write and identify the
unsupported build data; do not silently import only selected portions. Existing
compatible non-build storage remains untouched on failure. Backups with no old
builds can remain eligible after validating their supported settings/profile
envelopes; old file version alone must not erase compatible content. Re-export
and unsupported-data recovery do not imply old builds become playable.

## Inactive integration boundary

Agent decision, 2026-11-06: use one internal `progressionMode` discriminator,
`legacy` or `shared_v1`, at run construction and serialization. Child 042–048
tests may construct `shared_v1` in isolated fixtures, but public new-run/default,
saved-ship launch and co-op negotiation stay on existing behavior until 049.
Do not add a public toggle, query-string unlock or partial reward-path cutover.
An explicit internal test factory is sufficient; it must not overwrite owner data.

At 049 cutover, fresh runs use `shared_v1`; old builds follow D2 recovery and do
not remain playable legacy runs. Preserved legacy code during staged development
is not a promise to maintain two released gameplay modes. A malformed or unknown
mode/version is rejected, never guessed from equipment shape.

Dependencies load content before equipment/stats, then rewards and persistence
before lifecycle consumers. Exact insertion points must be checked against
`index.html` in each child. Keep current behavior unchanged while inactive.

## Combat and timing details

Apply D4–D8 and D10–D11. The following details make those approved rules
deterministic; they are agent implementation choices unless identified as D rules.

- Offensive damage is `baseDamage * levelMultiplier * hullDamageMultiplier *
  (1 + 0.04 * amplifierStacks)`, then a permitted critical multiplier once.
  Arc applies that formula separately to its 18/12/8 bases; mortar applies it to
  damage per second and integrates elapsed simulation time. Never multiply again
  when a projectile becomes an explosion/field or when a guest renders it.
- Offensive cooldown is `baseCooldown / ((1 + 0.05 * coolingStacks) * buffRate)`;
  `buffRate` is 1.35 during overclock, otherwise 1. Level adds no rate bonus.
  Upgrades do not reset an already-running cooldown. New values affect the next
  activation. Fixed defense cooldowns and barrier capacity use only their D8 level
  rule; no damage, recharge, size or duration passive modifies defense.
- Movement is `245 * hullSpeedScale * (1 + 0.03 * thrusterStacks) * speedBuff`,
  where speedBuff is 1.42 or 1. Shield regeneration is
  `12 * (1 + 0.10 * recoveryStacks)` per second after the existing 4.2 s delay.
  Retain existing dash and hit-invulnerability semantics. New passives do not
  grant base HP regeneration, dodge, luck, multishot, lifesteal or on-hit payloads.
- Plating sets the damage-taken multiplier to `1 - 0.03 * platingStacks`.
  Retain existing positive-hit minimum and immunity checks. Accepted damage
  consumes barrier, then shield, then HP. A fully absorbed hit retains existing
  hit/regen-delay semantics; it does not become a second damage event.
- Process a simulation step in stable order: advance timers, apply selection
  intent, validate defense intent, validate offensive firing, then resolve world
  impacts and rewards in stable event order. A defense can fire during offensive
  switching delay. One press at cooldown zero activates once; an early press is
  rejected rather than queued until later. No input edge survives focus loss,
  pause, disconnect or restoration; held/toggled offense retains its existing
  session preference without manufacturing a defense edge.
- Cooldowns/switch delay advance only for live connected participants while
  gameplay advances. Pause freezes the world. Projectiles/fields keep their
  simulation lifetime after owner switch, death or disconnect. Temporary buffs,
  active barrier windows and recipient lockouts use the world clock; they expire
  even if the recipient becomes downed/offline. Rejoin cannot refresh them.

### Targeting and geometry

Ranges and cones are measured in world space, never camera pixels. "Visible"
means unobstructed world line of sight, not inside the viewport. Cone half-angle
is 45 degrees on either side of aim. Break equal-distance ties by stable target
ID. Use swept collision for fast projectiles so the approved range does not
permit wall/enemy tunneling. Preserve existing ship hitboxes and solid geometry.

- Pulse/Needle stop at first solid target/wall. Scatter emits five evenly spaced
  pellets across the approved cone. Rail counts distinct enemies, never repeats
  damage on one enemy, and stops at a wall or third enemy. Use existing
  destructible objective collision rules; primary-only play must clear sectors.
- Missiles start along aim, seek live enemies only and retain a valid acquired
  target. If it dies or line of sight/range becomes invalid, reacquire using the
  original activation aim cone from the missile's current position. Without a
  target they continue forward. They stop on collision/expiry and deal one direct
  hit, without splash. Each missile may independently select the same enemy.
- Arc selects enemies only, with line of sight for the first hit and every hop.
  A hop uses its previous target as origin. No valid target means no hit, with
  normal cooldown consumed. Primary/projectile/area attacks retain objective
  damage paths; no automatic objective target substitution is added to Arc.
- Bomb/mortar fly along fixed activation aim, unaffected by mouse distance,
  homing or owner motion. They pass through enemies and detonate at 360 units or
  first wall, on the reachable side. There is no extra direct-impact damage.
  Blast/field damage uses collision radii and line of sight from effect origin,
  including existing destructible objectives. Slows affect enemies only.
- Per enemy, slow strength is the maximum of active sources and expires when
  the strongest source ends (a weaker still-active source can then apply).
  Same-owner plasma overlap uses the greatest DPS at that target, not summed
  ticks; different owners sum contributions with separate attribution. Enemy
  entry/exit and partial final ticks must preserve damage-per-second timing.
- Repulsor requires line of sight for damage/push/clearing; push respects solid
  collision. Enemy projectiles need explicit source/clearability metadata:
  ordinary bullets are eligible, boss-origin bullets and non-bullet hazards are
  not. Do not infer eligibility from color/shape. Nonboss elites follow the
  approved nonboss rule. Repulsor cannot damage or push allies.
- Aegis targets living, connected self/allies within range and line of sight.
  A new recipient window begins at application, ends after 3 simulation seconds,
  then locks out for 2 seconds. Depletion does not restart/extend that window;
  reapplication within it can raise remaining capacity to the incoming amount.
  During lockout that recipient rejects the barrier. An activation still starts
  the caster's cooldown even if every recipient is ineligible. Dead players
  cannot receive a barrier or be revived by it. These rules bound uninterrupted
  protection to 3 seconds with at least 2 seconds between windows.

## Reward-source and pacing details

D9's budget is run-wide, not per sector, enemy, player or reward category.
Count each actual enemy death once. Accumulate active combat time only while
the game is playing with live enemies; pause/menu time does not count. Clamp
counters to the next threshold rather than stockpiling unlimited budget.

At both thresholds, the next enemy death or equipment-bearing cache/objective
source emits one ordinary equipment pickup, without a second random drop-chance
gate. Reset time/kills when it is emitted, not when collected. The first ordinary
pickup is always additional offense; later ones use D9's category weights.
Every equipment source, including wardens, anchors and corrupt caches, passes
through this budget. Do not also spawn its old weapon/mod reward. Bosses add
exactly one separately identified bonus equipment pickup using the same later
category weights, without spending/resetting the ordinary budget. A boss death
can thus produce both an earned ordinary drop and one bonus drop.

Keep existing non-equipment consumable source chances independently, with luck
fixed at its base value in the new catalog. Existing boss repair/shield drop
behavior stays; its old weapon-plus-mod cascade is replaced by the one approved
bonus event. No consumable grants a second equipment-budget reset. Kills and
other XP sources, including data shards, call shared `addXp` once per source;
remove the simultaneous local-kill XP plus guest XP award in the new path.

Collection commits progression to all locked participants, even across distance,
downing or disconnection. Choose results from each participant's current
authoritative equipment, not a guest-submitted array. Offensive modules fill
slot 1 before 2; when full upgrade the lowest-level additional weapon below 5.
Primary upgrades affect only slot 0; defensive modules affect only defense.
Passives share one type but resolve per-player caps independently.

For fallback, compute `repair = min(10, maxHp - hp)` for a living connected
recipient and `salvage = 10 - repair`. Otherwise repair is zero and salvage 10.
Use actual finite resource amounts, not rounded HUD values. Salvage is a visible
per-run counter, persisted in checkpoints/rejoin state, with no spending, XP or
combat effect. It is separate from existing lifetime statistics. Ordinary repair
and shield consumables cap at capacity without salvage; report a no-change result
at full capacity. Ordinary buffs/repair/shield have explicit ineligible outcomes
for downed/offline participants and are not banked; data XP is permanent progress.

Apply a reward and derived capacity changes once before notifying. For a downed
participant, increase maximum capacity but never HP or life state. Revival uses
existing revival policy with the new derived maximum. Record life/resource
revision with commit so a simultaneous death cannot turn a deferred heal into a
revival. XP levels resolve in order, including multiple levels from one gain;
there are no pending protocol choices or invisible manual-action queues.

## Controls, notification and attribution integration

047 reuses `N.Input` and `N.Firing`. Actions are `weaponSlot1`, `weaponSlot2`,
`weaponSlot3`, existing next/previous cycling, and `defense`. Preserve all existing
movement/aim, mouse wheel, hold/toggle, controller and remapping paths. Routine
binding defaults belong to 047 after checking collisions; do not overwrite a
user's existing mapping to make room for new actions. Device release, neutral
sticks and reconnect must be tested. A deliberate conflicting user binding may
produce simultaneous offense/defense under D8, never auto-repeat defense.

`view` provides slots, names/levels, selected slot, defense cooldown/window and
per-event local outcome labels. Use a bounded 32-entry optional local history
and coalesce burst notifications; history is not the authoritative grant ledger.
No reward notification changes mode, focus, pause, aim or fire toggle. Choice,
replacement and discard entry points must not mutate new-mode fixed equipment.
Existing pause/accessibility menus remain available independently of rewards.

Only the physical collector increments the existing item-pickup counter once;
shared recipients get progression notifications, not duplicate pickup counts.
Preserve current kill/logbook ownership and per-participant match attribution.
Damage effects carry original activation/participant identity through switch,
death and rejoin. 045/046/047 must update wrappers that currently infer events
from `collectGroundItem` or the reward tray; replay produces no new tally event.

## Contract examples and required child checks

These are expected outcomes, not executed tests or playtest results.

| Scenario | Required outcome / owner |
| --- | --- |
| Fresh solo Kite | Slot 0 `pulse_repeater` level 1 ready; slots 1–2 and defense empty; no passives, level 1 / XP 0, sequence index 0, full 100 HP / 20 shield. 042/045/046. |
| Four fresh players collect one offensive module | One event lists all four original IDs. Example authoritative rolls: missile, arc, missile, mortar. Each installs in slot 1; slot 0 stays selected. Coincident rolls are allowed. One collector tally. 046/047. |
| Full additional slots at levels 2 and 2 | Upgrade slot 1 to 3; selection and current cooldown unchanged. At levels 5 and 4, upgrade slot 2; at 5 and 5, use fallback. 045/046. |
| Fully capped reward at HP 96/100 | Commit +4 HP and +6 salvage once. Full HP gives +10 salvage. A downed/offline recipient gets +10 salvage with no life change. Retrying after later damage must not heal again. 046. |
| Uniform passive roll with unequal caps | Both players get Hull; one at 9 stacks reaches 10 and gains only +10 capacity/current HP if alive, the already-capped player gets fallback. No reroll or teammate-dependent passive choice. 045/046. |
| Automatic level crossing | Level 1 / XP 37 gains 2 XP: level 2 / XP 1, Hull stack +1, next index 1, next threshold 49. A saved ship at level 8 starts next index 0 and keeps its own XP. Drops do not advance the sequence. 045/046/048. |
| Defense while firing | Fresh defense press activates ready item once while offense may fire. Selected slot is unchanged. Holding through readiness or restoring focus does not reactivate. Four overlapping Aegis casters cannot extend a recipient window past 3 s or skip its 2 s lockout. 044/047. |
| Cooldown switching | Fire missile, switch away and back: its remaining timer is preserved and switch delay still applies. An upgrade during cooldown cannot make it immediately ready. Existing missile/field finishes with original damage/owner. 042–045. |
| Downed/disconnected original participant | Equipment, passives and XP commit to retained state. Temporary consumables do not bank. Rejoin after a sector change receives the cumulative result once without reroll or revival, before gameplay resumes. 046/048. |
| Two collectors, retry and reordered delivery | One pickup source commits once; duplicate ack/delivery is harmless. A missing sequence requests replay/snapshot rather than skipping an award. Snapshot compaction retains offline outcomes; stale guest resource/progression snapshots cannot overwrite them. 046/048. |
| Reordered repair and barrier revisions | Start at resource revision 10 with HP 60/100 and no barrier. Repair revision 11 sets HP 70; barrier revision 12 must carry HP 70 as well as its 25-point barrier and all other resource state. Deliver 12 before 11: final HP is 70 with that barrier, never 60 or 80. Repeat/replay both and compare with in-order delivery; results match. In a separate HP 96/100 variant, the fallback repairs 4 HP and awards 6 salvage; process salvage once despite ignoring the older resource state. A partial revision 12 must be rejected without advancing the accepted revision, then recovered with complete state. 044/046/048. |
| Legacy saved ship / old checkpoint | No conversion or partial launch. Retain original bytes, offer export/removal choices, preserve settings/profile. An old ship with eight weapons, old tiers/cores or unspent rewards is not trimmed to fit. 048. |
| Current-format saved ship and continuation | Launch retains earned gear/levels, starts ready/full under D11 with fresh run IDs. Continue/rejoin retains timers, selection, resources and watermarks without free healing or repeated grants. 048. |
| Malformed/future data or mixed peers | Reject before mutation/launch; show explicit incompatibility. Unsupported backup import leaves every stored key unchanged. Repeated backup round trip preserves supported state. 048. |

046 should bound ordinary replay history (initial engineering limit: 256 events)
and use a cumulative snapshot for older gaps, not discard the grant. 048 validates
packet sizes and chunking using the existing transport bounds; exceedance must
resync/reject explicitly, never silently truncate earned state. State retains at
most four participant records per run. Source deduplication uses live/consumed
world identity plus coherent checkpoint generation state, not an ever-growing
all-time pickup ID set. End-of-run cleanup releases old journals/effects/rosters.

## Validation gates for 049

Owner-approved target D12 is p95 displayed frame interval ≤16.7 ms at 1920×1080
and existing default quality on the owner's actual test machine. Record CPU,
GPU, memory, OS, browser/version, rendering mode, DPR, viewport, quality settings,
seed, duration and entity/effect counts. Do not reuse old VM descriptions as
current hardware evidence. Record separate results for current stable Firefox,
Google Chrome and Chromium when available; any unavailable target stays pending.

1. Run matched normal-play and heavy-wave scenes before/after, with repeated
   deterministic workloads and identical viewport/quality. Use the existing
   120-enemy benchmark as a reproducible heavy starting fixture, plus a four-player
   scene with simultaneous missiles, arcs, bombs, fields and Aegis/Repulsor.
   Report frame interval p50/p95/p99, simulation/render time and entity counts.
   The target applies to both normal and heavy scenes, not an averaged FPS.
2. Run 20 real minutes with rendering active, including recurring effect bursts,
   sector transitions and a disconnected/rejoining participant. Sample entities,
   event buffers and memory at least once per minute. Require bounded journals,
   released expired effects and no unexplained continuous retained-memory/entity
   growth across equivalent quiet checkpoints. Compare retained counts after
   three repeated burst-and-expiry cycles; explain any non-baseline survivors.
3. Run registered automated checks and adversarial reward/save/input cases from
   the examples above. Exercise 1–4 players, mixed hulls, different saved levels,
   downing/revival, stale/reordered/dropped packets, pause/focus, resize, menus,
   sector advance, save/continue, backup and incompatible peers. Record real WAN
   multiplayer and physical-controller checks separately from synthetic tests.
4. Obtain owner review of each hull's solo viability, primary-only play, optional
   switching, early weapon timing, permanent random builds, full/maxed rewards,
   defense accessibility and four-player threat visibility. Compare equivalent
   captures with current visual quality; text/shapes must convey readiness and
   slots without color alone. No reward/level notification may pause or steal focus.

Automated correctness, performance measurements and owner playtesting are separate
evidence classes. Numeric starting-value approval does not satisfy feel/balance.
No benchmark results, physical device tests or cross-browser support are claimed
here. Balance adjustments require owner decisions and separate evidence from
performance changes. Failing a target leaves the relevant acceptance pending;
never lower quality, remove effects or change enemy counts to call it a pass.

## Remaining gates and handoff

041's design answers are recorded and independent review is complete. Branch
delivery remains owner-managed; dependent work must wait for its merged handoff.
042–048 must consume this contract in the parent's serial order, behind the
inactive boundary. They must document new material ambiguities as explicit
blocked dependencies and return to the owner rather than guessing new gameplay.
049 alone activates the replacement after compatibility and integrated checks.
No sibling criterion is completed by these examples or approvals.
