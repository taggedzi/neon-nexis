# 049 — Activate and validate uninterrupted progression end to end

Status: Done (remaining validation transferred to 050 / GitHub #75)

Current disposition follows the owner-authorized scope transfer to
[050](050-live-multiplayer-validation.md), recorded below.

## Problem or player need

Separate feature implementations need integrated proof before replacing the existing reward flow.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 048 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Integrate 042–048 against 041 contracts and activate the new progression only when all prerequisites are complete.
- Exercise all four hulls, three offensive slots and separate defense, every new weapon/passive, automatic levels, shared rewards and approved legacy transitions.
- Check solo and 2–4-player sessions including downing/revival, rejoin, packet loss/reordering, sector changes, pause/focus, resizing, menus and save/continue.
- Measure normal combat, heavy waves and extended runs with comparable workloads, entity/effect counts, frame times and memory; record browser versions, hardware/render mode, viewport, quality and duration.
- Run full npm run check and git diff --check, then obtain owner playtesting for pacing, randomness, primary-only viability, switching pressure, defenses, readability and friendly play.
- Record tuning changes separately from performance evidence. Update all child statuses and parent acceptance only with supporting evidence; do not close the epic because code alone is complete.

Discovery starting points (verify against actual code): Cross-module integration and existing test/scenario tooling; avoid new unrelated framework/tooling.

## Alternatives and tradeoffs

Automated correctness cannot establish feel, fairness or real-player performance. Retain Implemented — needs validation until required player review is complete.

## Acceptance criteria

- [x] Full registered automated suite passes on recorded environments; desired Chrome/Chromium/Firefox support is not inferred from one browser.
- [ ] Real multiplayer/WAN and physical-device checks are recorded with limitations; unavailable checks remain pending.
- [ ] Owner accepts no reward-menu waiting, all hulls' solo viability and friendly team progression without mandatory roles or rapid cycling.
- [ ] Four-player area/defense effects meet 041's performance/readability goals without lowered default quality.
- [ ] All migration/reward/controls acceptance cases have evidence; no unresolved material design decision or required validation is hidden by closing the parent.
- [x] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

### Combined implementation — 2026-11-08

Owner authorized implementing and reviewing the remaining issues with agents,
focused commits and one combined playtest handoff. The branch is
`feat/uninterrupted-progression-batch`; it includes the existing committed 044
implementation and the owner-approved loopback-port test-tool changes.

Integration and automated validation are complete as recorded below. The cutover switch is
`N.PROGRESSION_ENABLED`; it coordinates new-run construction, persistence and
peer compatibility. Older mechanics are exercised by explicitly scoped legacy
test fixtures; public launch and new progression scenarios exercise shared mode.
No release, push, merge or deployment is authorized or performed.

Stat/upgrade implementation commit: `f68c649`; integration commit: `18ae201`.

### Performance observations and visual review — 2026-11-08

Recorded observations are in
[`tools/performance/results-049.json`](../../tools/performance/results-049.json).
These measurements preceded the final dash resource-state extension; they are
development observations, not measurements of a published release.
Environment: Windows, Intel Core i7-12700KF, 34,212,798,464 bytes RAM,
Playwright Chromium 156.0.8078.4. A separate WebGL context reported NVIDIA
GeForce RTX 3070 Ti through ANGLE/D3D11; this does not prove the Canvas/compositor
rendering path. Graphics remained High with particles, shake, scanlines and
glitch enabled. No effects, population defaults or quality were reduced.

| Scripted solo workload | Viewport / duration | Observed results |
| --- | --- | --- |
| Normal | 1920×1080, DPR 1; 10 simulated seconds / 10.90 wall seconds | 4 enemies at first sample, 10 at end; update p95 0.8 ms, Canvas submission p95 1.6 ms, callback interval p95 26.7 ms |
| Required large wave | Same viewport; 10 simulated seconds / 13.40 wall seconds | 120 deliberately spawned before warmup, 118 at first sample, 109 at end; update p95 3.8 ms, submission p95 4.2 ms, callback interval p95 27.0 ms |
| Accelerated retention | Same viewport; 1,200 simulated seconds / 28.49 wall seconds; one render per simulated second | Reached sector 3 in playing mode; final 38 enemies, 93 enemy bullets, 33 pickups; sampled uncollected JS heap ranged 6.31–46.21 MB, ending 18.26 MB |

The benchmark's old stress setup had been constrained by the ordinary population
gate. Its test-only setup now explicitly creates required encounters and asserts
at least 80 survive warmup. Earlier capped samples are not presented as stress
evidence. Normal spawning and game balance are unchanged.

Four local contexts, each 1280×720/High, exercised missiles, arc, bomb, mortar,
Aegis and Repulsor for two 20-second wall-time workloads. At 20 enemies, callback
p95 was 66.8–66.9 ms and simulation advanced about 17.6 seconds. At 80 enemies,
p95 was 120.1 ms and simulation advanced about 10.3 seconds. All clients remained
in playing mode. These observations **do not establish the performance target**;
the four clients shared one machine/GPU, no paired baseline was measured, and
the existing frame-step cap slows simulation under this load. Short before/after
heap samples and the accelerated run do not establish retained-memory behavior
or continuous 20-minute rendering. No tuning change is claimed as optimization.
The first paused measurement was discarded; host-owned test invulnerability and
an advancing-simulation check prevent that invalid fixture from recurring.

Agent visual inspection of the final desktop and 640×600 captures found the
three offensive rows, separate defense/barrier status, active weapon glyph/glow
and cooldown bar visible within their panels. Procedural wireframes, world
effects and default quality remain present. A paired full-scene baseline and
owner readability/feel acceptance remain pending; screenshots are local test
artifacts, not committed assets.

### Remaining owner/environment validation

The code is delivered for one combined playtest. Owner acceptance of pacing,
randomness, primary-only viability, switching pressure, defense readability,
accessibility and friendly co-op play remains pending. Physical controllers,
real WAN/separate-machine play, Google Chrome as a separate installed browser,
continuous extended rendering and real-machine performance acceptance have not
been established. The parent must remain open; automated correctness and the
headless observations do not close these gates.

### Final integrated verification — 2026-11-08

Implementation is committed on `feat/uninterrupted-progression-batch`:
`f68c649` (045 stats/upgrades), `c68bf80` (owner-approved loopback tooling),
and `18ae201` (046–049 integration, regressions and implementation records).
The final `npm.cmd run check` exited 0: syntax, ESLint, all registered Node
checks, and **220 browser tests passed; two opt-in measurement cases skipped**.
Environment: Windows, Node v26.13.0, Playwright Chromium 156.0.8078.4 and
Firefox 157.0; two workers, zero retries. The run used
`NEON_TEST_ENABLED_PORT=44321`, `NEON_TEST_SAMPLE_PORT=44322` and
`NEON_TEST_WORKERS=2`. The skipped measurements were exercised separately in
Chromium; see 049 for observations and their limits. `git diff --check` passed.

This clean run supersedes earlier intermediate failed/hung attempts recorded
above. Test-only Firefox loopback ICE preferences make disposable local peers
independent of LAN multicast discovery; production networking is unchanged.
Physical controllers, separate-machine/WAN play, separately installed Chrome,
owner feel/balance/readability and real-player performance remain unverified.
No owner's browser storage was cleared. No push, PR, merge or deployment was
performed. See [049](049-progression-integration-validation.md) for the combined
handoff and remaining validation.

Public cutover is active and implementation/review are complete. Review corrected
roster/rejoin hull restoration, stale lifecycle resource rewinds, source-ID reuse,
legacy packet mutation, atomic checkpoint preflight/profile side effects,
authoritative guest dash, and paused Repulsor bullet suppression. Existing
procedural weapon glyphs, glow and cooldown bars remain in the HUD. Approved
numeric rules and default effects/quality were preserved.

Optional Chromium measurements passed separately: two solo/hull cases and one
four-player case. These establish that the fixtures ran, not performance
acceptance. The four-context stress observations below are slow and remain an
explicit limitation. No further implementation task or material design decision
is concealed by the pending owner/environment validation.

Suggested PR title: **Integrate uninterrupted shared progression**.
Suggested description: Activate automatic shared rewards, bounded upgrades,
remappable equipment controls and versioned save/network recovery; preserve
existing effects and record Chromium/Firefox regression and performance evidence.
Owner gameplay and real-player performance acceptance remain pending.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/66
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/65
Local source: `docs/work-to-be-done/049-progression-integration-validation.md`.
Delivered locally on `feat/uninterrupted-progression-batch` under the owner's combined-batch authorization. GitHub issue closure and PR delivery remain owner-managed; the local tracker records current validation.

### Owner-authorized GitHub delivery — 2026-11-08

The owner requested verification of whether GitHub issues #57–#66 were committed,
pushed and merged, and explicitly authorized pushing and merging the remaining
work. This supersedes the earlier delivery-authorization restriction above.
Inspection found #58–#60 already merged through PRs #68–#71, with parent planning
merged through PR #67. The remaining implementation is six local commits,
`88fb7bf` through `badbdc5`, on `feat/uninterrupted-progression-batch`; neither that
branch nor `feat/044-defensive-quick-use` existed on origin when checked.

Deliver the combined branch as one pull request because it already contains the
defensive-slot commit and all subsequent integration work. Do not merge the
older defensive branch separately. Local main matches fetched origin/main at
`21713d7`, which is an ancestor of this branch; no rebase is currently needed.
The preceding production-readiness review ran the full suite against `badbdc5`:
syntax, lint, registered Node checks and 220 browser tests passed, with two
opt-in performance cases skipped. The pre-push hook must still run normally.

Delivery does not establish the outstanding owner/device/WAN/visual/performance
criteria or resolve the separately tracked review findings. Keep 040, 047 and
049 at Implemented — needs validation. Final PR, merge and verification evidence
will be recorded in the GitHub handoff and task report.

### Owner Firefox playtest and short capture — 2026-11-09

Delivery is complete through [PR #74](https://github.com/taggedzi/neon-nexis/pull/74),
rebase-merged at `63969301063ebfe6c18d6bda0c6119bd86da0988`. The required pre-push
suite passed syntax, lint, registered Node checks and 220 browser tests, with two
opt-in performance cases skipped. CodeQL also passed. Local main was synchronized
after delivery.

The owner reported having played the game and liking the results, using Firefox
at `http://127.0.0.1:8000/`. This records general gameplay acceptance. Specific
all-hull, primary-only, physical-controller and four-player readability acceptance
still requires corresponding evidence or an explicit scope decision.

The owner supplied an interactive Firefox Profiler recording and confirmed High
quality and F11 fullscreen. Their 1920×1080 settings screenshot also shows 100%
particles, screen shake, scanlines/grain and digital glitch enabled. Reduce
Flashing and the performance readout were off during this capture. The recording
identifies Firefox 159.0 release, Windows 11 build 26300 and an Intel Core
i7-12700KF with 12 physical and 20 logical CPUs. GPU model, rendering backend,
DPR, seed and entity counts await measurement. During analysis, the local server's
`release.json` reported development build `6396930`. The profile itself does not
embed the game's commit.

Evidence file retained outside the repository is
`Firefox 2026-11-09 01.31 profile.json(1).gz`, SHA-256
`0e20c42414a68e2c174e6848a4dbbb491cf6051086c2245f9494106ef0014bc6`.
The first export omitted the private game tab. The second export includes private
window data and resource URLs, including the game main thread. Raw profiles and
browser artifacts are excluded from this documentation change.

The full capture spans 34.0636 seconds and contains 2,480 game-tab
requestAnimationFrame callback starts. Pairing that thread's interval-start and
interval-end markers yielded 2,479 complete callback durations. For callback
cadence, exclude the first and last second of the capture, then take consecutive
start differences, giving 2,334 intervals. Percentiles use sorted nearest ranks.

| Short interactive sample | Measured result |
| --- | --- |
| Callback start interval p50 / p95 / p99 | 13.3688 / 15.7074 / 17.0867 ms |
| Longest trimmed callback interval | 24.8872 ms |
| Trimmed intervals above 16.7 ms | 38 of 2,334, approximately 1.63% |
| Whole-capture callback frequency | Approximately 72.85 callbacks per second |
| Complete callback duration p50 / p95 | 12.5607 / 15.4068 ms |
| Game-process allocated-memory counter | 42.38 MiB initially, 64.87 MiB finally, 69.20 MiB peak |

The callback interval p95 is within the 16.7 ms budget for this short sample.
The approved target concerns displayed frame intervals, so presentation timing
validation remains pending. Approximately 91.4% of the trimmed main-thread stack
samples include `G.render`, identifying rendering as the dominant sampled path.
This is a sampling proportion, with idle/native samples included in the
denominator. Process allocation counters require a longer, comparable workload
and retained-memory analysis to explain growth and release behavior.

Remaining work includes a reproducible heavy wave, simultaneous four-player
effects, 20 real minutes with memory/entity observations, hardware/backend/DPR
details, presentation timing and the recorded device/WAN/visual gates. This
short capture adds real-player evidence while 049 remains Implemented — needs
validation. The next guided capture will add the performance readout and a busy
combat scene without changing combat or visual-quality settings.

### Owner busy-combat capture — 2026-11-09

The owner enabled the performance readout and supplied a crowded gameplay
screenshot followed by `Firefox 2026-11-09 01.46 profile.json.gz`. The screenshot
readout was interpreted as approximately 61 FPS and 64 hostiles before recording.
Continuous entity counts and a reproducible seed await capture. This is a manual
busy-combat observation under the previously confirmed High/fullscreen settings.

The second profile has SHA-256
`896872fb7d047e68452905c134c3e797226d56ad2be2fd933924ed6830d09394`
and spans 42.7074 seconds. Browser, OS, CPU and game-tab identity match the first
capture. The same marker pairing and nearest-rank method produced these results.

| Busy capture measurement | Measured result |
| --- | --- |
| Callback starts / complete callback durations | 2,989 / 2,988 |
| Trimmed callback intervals, first/last second excluded | 2,855 |
| Callback start interval p50 / p95 / p99 | 13.4202 / 17.0350 / 18.5145 ms |
| Longest trimmed callback interval | 27.8066 ms |
| Trimmed intervals above 16.7 ms | 191 of 2,855, approximately 6.69% |
| Complete callback duration p50 / p95 | 13.1126 / 16.9193 ms |
| Game-process allocated-memory counter | 68.36 MiB initially, 95.00 MiB finally, 95.73 MiB peak, 56.15 MiB minimum |

The callback interval p95 exceeds the 16.7 ms budget by approximately 0.335 ms.
In the first profile it was 15.7074 ms. The two scenes differ in entity/effect
workload and readout visibility, so this comparison describes observed load
behavior. It is unsuitable as evidence of a code revision's performance change.

Approximately 90.7% of trimmed main-thread stack samples contain `G.render`.
World drawing, glow and background drawing are prominent sampled paths. The
approved visual-quality constraints continue to apply to any future optimization.

The last sampled `G.update` stack occurs at approximately 33.94 seconds. During
seconds 34–41, rendering continues and callback interval p95 is 13.4086 ms. Pause
or game-over before capture is a possible explanation requiring owner confirmation.
As a sensitivity check, seconds 2–32 yield 2,071 intervals with p95 16.9995 ms,
which also exceeds the budget. That time window is provisional until the owner's
activity is confirmed.

Owner clarification, 2026-11-09: the owner died twice during the busy capture.
The recording therefore spans interrupted play. Exact death/restart times await
identification. The 17.0350 ms result describes the mixed recording, while
uninterrupted heavy-wave acceptance requires a controlled surviving scenario.

An agent implementation choice for the next guided test is a temporary,
loopback-only source server at `127.0.0.1:8001`, exposing the existing source-only
`NEON.Dev` scenario commands. The different origin separates its test storage
from the owner's staged game at port 8000. Source-only dev setup supports a fixed
seed and invulnerability, with automatic checkpoint writes suppressed. Port 8000
serves a minified development package, while port 8001 serves source files from
the same checkout. Future comparisons must record that artifact difference or
use matched source runs.

A disposable Chromium smoke check of `NEON.Dev.setup({seed:42,invulnerable:true})`
verified High defaults, paused setup, damage immunity and an unchanged stored
checkpoint. The browser version was omitted from that smoke-check output.
The guided Firefox workload and its performance capture are pending. The
temporary server is retained for the next guided steps and needs cleanup when
performance testing ends.

Allocated-memory growth requires an extended run and allocation/retention checks.
Four-player simultaneous effects, reproducible heavy-wave validation, actual
presentation timing and the 20-minute criterion remain pending. Status remains
Implemented — needs validation.

### Chromium invulnerable normal baseline — 2026-11-09

The owner switched to Chromium for the source-only invulnerable scenario at
`127.0.0.1:8001`. The supplied file is
`Trace-20261109T020739.json.gz`, SHA-256
`e8c4302e63948a7e895a0208585cb50581f75e98745557f8b783d2e6cf0e2c52`.
Its selected trace range spans 38.282749 seconds. The capture's browser process
identifies the running executable as Chromium 159.0.8153.0. The DevTools setup
screenshot shows CPU/network No throttling and screenshots/memory enabled.
Trace metadata reports host DPR approximately 1.2. An initial document paint
clip spans 1921×1080. Exact viewport and Canvas backing dimensions await capture.
The source scenario uses High defaults and seed 42, with invulnerability and
automatic checkpoint suppression verified separately.

The game's renderer process and main frame were selected from the trace's
`TracingStartedInBrowser` frame URL. Reconstructed CPU-profile samples include
`G.resumeGame` at 1.059 seconds and `G.pauseGame` at 35.593 seconds. The selected
measurement window of seconds 6–35 therefore lies within that observed gameplay
period. Embedded screenshots at seconds 3 and 6 show an advancing sector timer,
a living ship and combat. Screenshot events cover approximately the first six
seconds, while callback and presentation events span the full recording.

Presentation cadence uses consecutive distinct `AnimationFrame::Presentation`
timestamps for the game renderer. Chromium emits these with the presentation
feedback timestamp, as defined in its
[animation-frame timing monitor](https://chromium.googlesource.com/chromium/src/third_party/+/refs/heads/main/blink/renderer/core/frame/animation_frame_timing_monitor.cc).
Percentiles use sorted nearest ranks. Callback measurements use matching
`FireAnimationFrame` complete events for the game main thread.

| Active window, seconds 6–35 | Measured result |
| --- | --- |
| Presentation interval p50 / p95 / p99 | 13.334 / 13.386 / 13.408 ms |
| Longest presentation interval | 13.545 ms |
| Presentation intervals above 16.7 ms | 0 of 2,174 |
| Callback interval p50 / p95 / p99 | 13.334 / 13.455 / 13.640 ms |
| Complete callback duration p50 / p95 | 1.550 / 1.934 ms |
| JavaScript used heap | 5.49 MiB at window start, 5.17 MiB at end, 3.63–8.47 MiB range |
| Document / node / listener ranges | 1–3 / 1,286–1,301 / 98–111 |

This short normal-combat presentation sample meets the 16.7 ms p95 budget.
The JavaScript heap rises and falls within the recorded range. The extended-run
retained-memory criterion remains pending. This JavaScript heap counter and the
Firefox process-allocation counter measure different memory categories.
The browsers, artifacts, scenarios and workloads also differ between captures.
Each result is recorded under its own test conditions.

Next scenario setup reuses the existing benchmark's 120 required-encounter spawn
pattern after `NEON.Dev.setup({seed:42,invulnerable:true})`. A disposable
Playwright Chromium 156.0.8078.4 functional check created exactly 120 enemies,
kept the game paused, rejected an automatic checkpoint write and preserved its
previous stored checkpoint. This verifies the setup, with the owner's Chromium
heavy-wave performance measurement pending. Four-player and extended-run gates
also remain pending.

### Chromium 120-enemy capture — 2026-11-09

The owner confirmed the scenario command returned 120 enemies, paused, and added
a one-second `console.timeStamp` marker containing mode, sector elapsed time,
enemy count, viewport and DPR. The supplied recording is
`Trace-20261109T022318.json.gz`, SHA-256
`e31a48adb73a2810042ec40eb883bc072717f8420ee3781a120dc0d29b6250ff`.
It spans 40.118538 seconds in the same Chromium game renderer as the normal
baseline. The game begins paused with 120 enemies. Every marker from seconds
2–37 reports playing and advancing sector time. The final three markers report
paused at 36.0836 sector seconds.

Markers establish an actual CSS viewport of 1601×900 and DPR approximately 1.2.
Their product is approximately 1921×1080 pixels. The approved contract names a
1920×1080 viewport, so these results explicitly retain their observed CSS/DPR
conditions for owner review. The earlier document paint clip describes the
pixel-space bounds and cannot establish the CSS viewport on its own.

For comparison with the Chromium normal baseline, use the same active seconds
6–35. All 29 one-second markers in this window report playing, with 112–113
enemies. The first post-two-second-warmup marker reports 116 enemies, exceeding
the existing benchmark's required 80-survivor threshold. Presentation and callback
percentiles use the preceding trace-event selection and nearest-rank method.

| Heavy active window, seconds 6–35 | Measured result |
| --- | --- |
| Presentation interval p50 / p95 / p99 | 13.333 / 13.367 / 13.391 ms |
| Longest presentation interval | 13.426 ms |
| Presentation intervals above 16.7 ms | 0 of 2,174 |
| Callback interval p50 / p95 / p99 | 13.334 / 13.498 / 14.034 ms |
| Longest callback interval | 19.204 ms |
| Complete callback duration p50 / p95 | 4.369 / 5.578 ms |
| JavaScript used heap | 8.83 MiB at window start, 5.59 MiB at end, 4.85–14.72 MiB range |
| Document / node / listener ranges | 1 / 1,310–1,312 / 95–113 |

The short heavy-combat presentation p95 meets the 16.7 ms budget under these
observed conditions. Normal and heavy presentation p95 values of 13.386 and
13.367 ms both follow approximately 75 Hz presentation cadence. Callback work
increases from normal p95 1.934 ms to heavy p95 5.578 ms. This establishes spare
time in the tested workload at that cadence. The callback maximum also records
one longer execution without an above-budget presentation interval in the
selected window.

The heap samples include allocation growth followed by release. The 20-minute
retained-memory/entity criterion, four-player effects,
Firefox's controlled heavy run and recorded device/WAN gates remain pending.
Validation notes remain uncommitted on `docs/066-firefox-performance-validation`.

Host hardware query during this analysis identifies an NVIDIA GeForce RTX
3070 Ti, driver 32.0.16.1714, with a 1920×1080 display mode. The owner subsequently
supplied Chromium's Graphics Feature Status. Canvas, compositing, rasterization,
WebGL and WebGPU report hardware acceleration. OpenGL, multiple raster threads,
Skia Graphite and TreesInViz are enabled. Direct Rendering Display Compositor
reports disabled. This records the browser's feature report for the tested host.

### Extended solo recorder preparation — 2026-11-09

Agent implementation choice for the next measurement is a local-only recorder
served from the ignored `.playwright-mcp/neon-soak.js`. It is an experimental
validation aid, outside the application and tracked delivery. It starts a fresh
seed-42 invulnerable source scenario using the existing `NEON.Dev.setup` API,
with Kite, Seeker Missiles, Plasma Mortar and Aegis Projector at level 1. Existing
scenario checkpoint suppression protects stored checkpoints. High quality is
required. Circular movement and nearest-enemy aim follow the existing benchmark.
The recorder supplies weapon switching and defense activation every eight active
seconds through the input interface, and advances completed sectors normally.
These choices define an automatic solo workload and require no balance changes.

The default run counts 1,200 seconds of foreground, playing animation time.
Focus loss and paused time are excluded. It records one-second heap/entity,
mode and sector samples, plus bounded animation callback interval storage with
overall and per-active-minute summaries. Completion restores the input methods,
pauses and downloads a JSON result. Its callback intervals differ from the
presentation feedback measured in Chromium traces. The memory counter is the
browser's JavaScript heap estimate and does not identify retained objects or GPU
memory. The recorder adds approximately 1.65 MiB of fixed frame-buffer storage
for the default duration, plus the sample records. The result records overhead,
viewport, DPR, Canvas size, settings and user agent.

Focused checks ran in an isolated Playwright Chromium 156.0.8078.4 context.
`node --check .playwright-mcp/neon-soak.js` passed. A three-second run completed,
downloaded JSON, restored movement input and paused. A separate twelve-active-
second run completed in 13.680 wall seconds after a focus interruption. It
resumed after focus returned, advanced a deliberately completed sector from 1
to 2, restored all four replaced input methods and left localStorage unchanged.
No page errors occurred in the download check. These are functional checks of
the recorder. The owner's actual twenty-minute run, recurring-effect counts and
memory trends remain pending, as do multiplayer disconnect/rejoin criteria.

### Owner twenty-minute solo run — 2026-11-09

The owner supplied `neon-soak-2026-11-09T08-05-51.988Z.json`, SHA-256
`1dcc63e14ec5c336938288160655ae55a513001ddcc5159362dfddf2054f1dab`.
It records successful completion of 1,200.0006 active seconds in 1,216.2756 wall
seconds, with 89,990 callback intervals and 1,218 one-second/final state samples.
The initial 17 samples are paused. All subsequent samples report playing.
Final accumulated sector time is 1,199.9962 seconds. Sectors advance from 1 to 2
at active second 420.736, and to 3 at 840.738. The pilot remains alive and reaches
level 17. The same seed, loadout and High settings described above are recorded.

The owner confirmed that the run began windowed for a few seconds, then stayed
in F11 fullscreen for the remainder. The recorder captures dimensions only at
startup, a measurement limitation in the agent-authored helper. Its environment
therefore reports the initial 1601×813 CSS viewport, DPR approximately 1.2 and
1921×975 Canvas backing size. Fullscreen dimensions during the run are not
directly sampled. The earlier fullscreen heavy capture reports 1601×900 CSS at
the same DPR. This run retains its own actual metadata and owner testimony.

| Extended solo observation | Result |
| --- | --- |
| Callback interval p50 / p95 / p99 | 13.3 / 13.4 / 13.5 ms |
| Maximum callback interval | 26.8 ms |
| Intervals above 16.7 ms | 1 of 89,990, during the first active minute |
| Each of 20 active-minute callback p95 values | 13.4 ms |
| Playing-sample JavaScript heap range | 7.79–38.04 MiB |
| Final active-minute sampled heap minimum | 9.17 MiB |
| Final sample JavaScript heap | 25.52 MiB |
| Enemy / enemy-bullet / particle maxima | 38 / 220 / 159 |
| Effect / offensive-field / ground-item maxima | 13 / 2 / 31 |
| Mine maximum / final count | 28 / 28 |
| Reward journal maximum / final count | 256 / 256 |

One-second samples show 63 zero-to-positive offensive-field transitions and 62
returns to zero, plus 123 positive-to-zero particle transitions. Fields and
particles recur and expire across many sampled cycles. Sector boundaries reset
mines and ground items. The reward journal reaches its configured 256-event
bound and stays there. These observations establish repeated transient cleanup
and bounded journal behavior for this solo workload. The final field is active,
and the final 28 mines and 23 ground items are surviving gameplay entities.
One-second counts cannot identify individual lifetimes or prove every retained
entity is legitimate.

Used heap rises and falls throughout all three sectors. Minute minima are
7.79 MiB in minute 1, 8.84 MiB in minute 7, 9.51 MiB in minute 14 and 9.17 MiB
in minute 20. Peaks rise with allocation bursts, including 38.04 MiB in minute
16, then drop again. The recorder itself retains growing sample metadata and a
fixed 1,728,000-byte frame buffer. This is evidence against continuous unchecked
heap accumulation in the observed run. It does not isolate retained game objects
at equivalent quiet checkpoints, and no forced-GC or heap-snapshot comparison
was performed.

The real twenty-minute rendered solo workload is now recorded. Callback cadence
remains below the 16.7 ms p95 threshold throughout this workload. Presentation
feedback was measured separately in the short normal/heavy traces. Four-player
simultaneous effects, a disconnected/rejoining participant during an extended
run, equivalent quiet-checkpoint retention comparisons, controlled Firefox and
Google Chrome runs, and the outstanding owner/device/WAN gates remain pending.
The integrated issues retain Implemented — needs validation. Analysis used the
local JSON and Node calculations, with the tracked documentation passing
`git diff --check`. Application code and registered tests were unchanged.

### Owner-deferred validation — 2026-11-09

The owner explicitly deferred all remaining validation for GitHub #57, #64 and
#66 until the game is live and other players are available. Implementation is
merged in [PR #74](https://github.com/taggedzi/neon-nexis/pull/74). Completed
automated checks, owner playtesting and solo performance evidence remain recorded
in [049](049-progression-integration-validation.md).

Status is Blocked because the remaining checks depend on access to live players
and the required devices/environments. The issues stay open for later follow-up.
Outstanding acceptance boxes remain unchecked. Resume when the owner has live
players available, inventory the pending cases in 049 and the progression
contract, and record each result before completing the relevant criteria.
This deferral covers multiplayer/WAN, four-player performance/readability,
disconnect/rejoin retention, physical-device/accessibility review and any other
still-unverified gameplay/browser/retention criteria. No completion date is set.

Approval source is the owner's explicit instruction on 2026-11-09. This decision
supersedes immediate follow-up requests for the remaining validation. See the
[decision log](../decisions.md#2026-11-09---defer-remaining-progression-validation).
Validation for this documentation update is `git diff --check`. Gameplay code
is unchanged, so application tests were not rerun.

### Validation transferred to follow-up — 2026-11-09

The owner explicitly requested closing GitHub #57, #64 and #66 and creating a
separate issue for validation when the game is live and other players are
available. Implementation is merged through PR #74. The remaining scope now
belongs to [050 — Live multiplayer validation](050-live-multiplayer-validation.md)
([GitHub #75](https://github.com/taggedzi/neon-nexis/issues/75)).

This tracker is Done for its delivered implementation and evidence handoff.
Unchecked historical acceptance boxes are transferred to 050 and do not claim
passing results. The follow-up preserves multiplayer/WAN, four-player effects,
disconnect/rejoin retention, physical-device/accessibility review and the other
still-unverified gameplay/browser/retention cases. This supersedes the earlier
instruction to keep the original issues open. Completed evidence is preserved.

Documentation-only update. `git diff --check` passed. Application tests were
not rerun because application code was unchanged. Validation notes remain on
`docs/066-firefox-performance-validation` pending commit/delivery.
