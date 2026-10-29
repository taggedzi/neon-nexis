# 005 — Reduce enemy spawn frequency

Status: Planned

## Problem

Enemies spawn too frequently. The player wants a modest reduction in spawn frequency.

## Work requested

Inspect the existing spawn cadence and progression rules, then tune the interval
or spawn rate to provide more breathing room. Keep tuning values easy to locate
and explain. Treat this as a balance change separate from performance optimization.

## Associated information

Record the previous and proposed values. Compare equivalent early, middle, and
late-run periods so difficulty scaling does not silently erase the intended change.
Do not assume that reduced batch sizes or an enemy cap satisfy a request for less
frequent spawning. Check effects on progression and rewards.

## Acceptance criteria

- [ ] The intended reduction is agreed and documented with old/new tuning values.
- [ ] Measured spawn events per minute are lower in comparable run conditions.
- [ ] Early, middle, and late-run playtests confirm the intended pacing.
- [ ] Required waves, objectives, and boss encounters still trigger correctly.
- [ ] Reward and upgrade progression remain viable at the new spawn frequency.

## Open questions

How much less frequent should spawning be? Should the reduction apply throughout
the run or primarily to later waves? Do scripted encounters need exceptions?
