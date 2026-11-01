# 028 — Raise co-op capacity to 4

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 12 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

Co-op should allow up to four players. The host chooses the count for the room.

This is the largest gameplay change on the list. The current co-op design is
two-player on purpose. Raising the cap is a protocol change, not a settings tweak.

## What exists today

[The co-op protocol](../coop-protocol.md) describes one host and one guest.
PHP stores two client ids and two connection cards. The guest creates the
WebRTC offer. There is one data channel. There is no gameplay relay.

`Coop.remotePlayers` is an array, but `js/coop.js` puts at most one mirror in
it, from `N.Net.peer`. Combat code loops that array, which is useful later, but
it does not mean a four-player match works today.

[Issue 016](016-coop-binary-payloads.md) packed the two-player fight as binary
payloads. It explicitly left four-player links, a seat id, and mesh links out
of that version. Wire `VERSION` is 1.

[Issue 014](014-coop-lobby-and-revival.md) sized the shared revive budget for
two players: 4 per player, planned maximum 8 at the current capacity. A larger
room changes that budget. The issue says a later capacity increase must not
silently change the approved revive math.

The host already owns the world. Guests own their own ship, input, and
acknowledged state.

## Determine

- Every place that assumes exactly one remote peer: PHP lobby row, signaling
  messages, `N.Net.peer`, pause, revive, grants, death, and the binary payload.
  A code search at implementation time should produce that list and keep it in
  this issue.
- Whether three guests can all connect to the host (a star) with the current
  PHP introduction, or whether the lobby has to exchange cards for every pair
  (a mesh).
- Bandwidth of one busy guest after issue 016, so three guests have a predicted
  host cost. Use a measured session, not the old JSON estimate alone.
- What the revive formula should be at a host-selected cap of 2, 3, and 4.

## Decide

- The counts the host may pick. The request says maximum 4. It does not say
  whether 1 is a co-op room.
- Star or mesh. 
- Whether a seat id bumps the wire version, and whether an older two-player
  client may join a two-seat room only.
- Revive budget at each cap.
- How a fourth player affects spawn pressure. More players should not also be
  an unreviewed difficulty cut. That interaction belongs with
  [issue 023](023-skill-levels.md) if both exist.
- What the host does when a seat leaves: close it, or allow a rejoin under the
  issue 014 rules.

Proposal, not approved:

- Host picks 2, 3, or 4 before the room opens. One player is single-player, not
  a co-op room of 1.
- Use a star: every guest connects to the host. Guests do not need a channel to
  each other. The host relays the state those guests are allowed to see.
- Add a seat id and a new wire version. A version-1 client can only join a
  two-seat room, or it is refused with the existing version-mismatch behavior.
  Do not overload version 1.
- Revive budget stays 4 per living seat, including the host, capped by the
  host's chosen size. That is a new approval. It supersedes the "maximum 8"
  note only for rooms whose chosen size is above 2, and only after the owner
  accepts it.
- Do not start this until the owner has accepted the star design. A mesh is a
  different project.

## Do

After the decisions:

- Change the lobby schema, introduction, and wire together. Update
  [the co-op protocol](../coop-protocol.md) in the same change.
- Give each remote player a seat. Keep host authority. Do not let a guest
  simulate enemies.
- Rejoin, pause, grants, and death must name a seat instead of "the guest".
- Tests: 2-player regression still passes. A 3-player and 4-player harness
  covers join, ready, pause, one revive, leave, and rejoin. State the harness
  limit if a fourth real browser was not used.
- Record a bandwidth and frame-time note for a 4-player fight. That note does
  not close [issue 001](001-performance.md).

## Acceptance criteria

- [ ] The host can set a count from the approved set, up to 4.
- [ ] That many clients can join, ready, fight, pause, and leave.
- [ ] A client on the previous wire version is accepted or refused under the
      approved rule, and does not corrupt the room.
- [ ] Revive counts follow the approved formula at each cap.
- [ ] Two-player matches still pass the existing co-op checks.
- [ ] The protocol document matches the code.
- [ ] The owner has played a 3-player or 4-player session, or the issue stays
      in needs-validation on that point.

## Open questions

- Does the host pick the count before creating the code, or may they raise it
  while waiting in the lobby?
- Are guest loadouts from [issue 024](024-named-ship-loadouts.md) in scope for
  the first four-player match? The proposal there is no.

## Dependencies

Do this after the two-player issues 014, 015, and 016 stay the baseline.
[Issue 023](023-skill-levels.md) should settle host match options first if both
are in progress, so the lobby does not grow two different settings panels.
This issue does not block pointer lock, saves, or the security alerts.

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
