# 038 — Compact menu layouts and navigation

Status: Implemented — needs validation

## Approved scope and decisions — 2026-11-05

Approval source: owner approved the pause-menu recommendation, then explicitly
expanded it to all four recommendations: “Actually, I would like to have all of
them implemented.” This is one coordinated UI task.

- Main menu: prominent Continue, New Run and Co-op; compact How to Play/Settings;
  grouped player records; smaller About/Credits footer. Keep every destination,
  the logo, animated sector display and existing neon/angular presentation.
- New run: Ship and Run setup columns when space permits, stacking at narrow
  sizes. Keep consequences visible and move longer hull/saved-ship explanations
  into accessible Details controls. The earlier one-content-scroller rule is
  superseded below.
- Settings: retain Controls/Audio/Visual/Data, stationary tabs and bottom actions.
  Controls groups are Shared behavior, Keyboard & Mouse, and Controller. Shared
  movement/firing applies to both input types. Controller guide and monitor
  belong with controller settings; detailed help can expand. Preserve every
  setting and remapping behavior.
- Pause: prominent Resume; Run management and Reference columns; Settings and
  separated Save & Quit at the bottom; sector/co-op status above actions. Every
  destination remains one click away. Submenus restore their originating focus.
- Rationale: reduce tall stacks and unnecessary horizontal/nested scrolling
  without changing gameplay, effects, saves or setting semantics. Existing fonts,
  palette and angular effects take precedence over generic design-skill defaults.
- Agent implementation choice: reuse shared menu navigation for focus restoration
  and native disclosure controls. No new dependencies or build steps.

Follow-up, same day, after the owner reviewed the four layouts: scale the main
menu, new run, settings, and pause to the available screen so those screens do
not show vertical scroll bars. This supersedes the one-content-scroller rule
above for new run and settings. The bars were those menu screens and panels.
The playfield canvas size is unchanged. Logbook, inventory, and co-op still
scroll. A screen that is taller than the window, especially settings with the
controller guide open, shrinks as a whole, including its width. A normal
desktop main menu stays full size.

Same day, the owner reported vertical and horizontal bars on the death
screen. The match tally under the checkpoint buttons was first shortened to
two columns. The sideways bar came from the SIGNAL LOST title: its skew and
glitch offsets are transforms.

Later the same day, the owner asked for that tally as two separate tables,
left and right, and reported that Firefox still showed both scroll bars and
clipped the title at both ends. The solo tally is now two tables of four
rows. The death screen scales to the window, the same way the four menus do.
The title is only as wide as the words, so the skew is no longer applied to a
full-width bar. A short window scales the whole death screen down, including
when the upper stat boxes stack. Co-op matches with more than one recorded
player still use the single shared table, and that screen scales too.

Same day, the owner asked to remove the Match Tally from the main menu.
Player Stats stays in Player Records. The death screen and the co-op end
board still show that match.

Related behavior remains owned by [011](011-controller-parity.md),
[024](024-named-ship-loadouts.md) and [029](029-ship-stats-and-colors.md).
This task does not reopen their gameplay decisions.

## Acceptance criteria

- [x] All four layouts implement the approved grouping with every destination.
- [x] Main menu, new run, settings, and pause scale to the viewport. Those
      screens have no vertical scrollbar, including with help open.
- [x] Ordinary desktop and narrow/short views avoid horizontal overflow and keep
      all controls reachable, including expanded help and long saved-ship names.
- [x] Pause submenu return restores originating focus for mouse, keyboard and
      synthetic controller navigation; no gameplay inputs or remapping lost.
- [x] Rendered before/after comparison and automated checks support the change.
- [ ] Owner accepts appearance/usability; physical-controller review recorded.

## Implementation and validation

- Primary checkout clean; origin fetched; no open PRs found through GitHub search.
  Local main already current. Branch: `codex/pause-menu-cleanup` (scope expanded
  after branch creation). No commit, push, PR, merge or publication authorized.
- Baseline screenshots captured at 1280×720 with installed Playwright Chromium
  156.0.8078.4 in an isolated profile. Browser launch needs sandbox escalation;
  the owner's browser storage is not used. Captures are ignored local artifacts.
- Changed files: `index.html`, `css/style.css`, `js/ui.js`, `js/game.js`,
  `js/stats-ui.js`, `js/player-stats.js`, `tools/ci/menu-layout.spec.cjs`,
  `tools/ci/player-stats.spec.cjs`, `tools/ci/coop-smoke.spec.cjs`, this issue
  and the backlog index.
- Main-menu actions use compact groups; the animated sector panel remains present
  at narrow widths below the actions. The four screens hide overflow and scale
  their content with CSS zoom until the visual box fits the viewport. Zoom is
  remeasured after layout changes because Chrome's offset height ignores it.
- Controls is grouped by input ownership. Detailed help uses native disclosures
  and stays expanded through settings rerenders. All setting paths and bindings
  remain unchanged. Shared focus traversal now includes native summaries.
- Shared screen navigation records originating controls and restores enabled,
  visible controls on return. Capturing the activated control also covers mouse
  clicks in browsers that do not focus buttons. Resuming clears the trail so the
  next Pause starts on Resume. Inventory/reward hotkeys restore their own buttons.
- Rewards opened from Pause now closes to Pause; Rewards opened in combat still
  closes to combat. Protocol/equipment completion behavior is otherwise unchanged.
  This is an agent implementation choice needed for the approved return navigation.
- No rendering/effects, balance, save format or setting semantics changed.
- Initial syntax, lint and whitespace checks passed. Focus/return and disclosure
  checks passed in Chromium 156.0.8078.4 and Firefox 157.0, including synthetic
  controller input. Chromium passed layouts at 1280×720, 1024×600, 640×480,
  360×640 and 320×480. An initial test selector collided with newly added body
  metadata; the metadata now uses a distinct name. A Firefox in-test viewport
  resize timed out; the final tests use a fresh context per viewport.
- Full `npm run check` completed on 2026-11-05: syntax, lint, unit tests, and
  178 browser tests passed in 8.6 minutes. Playwright Chromium 156.0.8078.4
  and Firefox 157.0 both passed `tools/ci/menu-layout.spec.cjs`, including
  focus return, disclosures, long saved-ship names, and viewports 1280×720,
  1024×600, 640×480, 360×640, and 320×480. The final pause spacing CSS was
  saved at 08:52 local; the Chromium 1024×600 pause capture is 08:53 and the
  Firefox layout captures are 08:57, so those passing layout tests loaded the
  saved CSS. That full check predates the scale-to-fit follow-up. The log is
  the ignored local file `.playwright-mcp/full-check.log`.
- After the scale-to-fit change, `tools/ci/menu-layout.spec.cjs` was run again
  on 2026-11-05: 16 passed in 47.9 seconds on Playwright Chromium 156.0.8078.4
  and Firefox 157.0. Each viewport asserts no vertical scroller and no clipped
  screen, including settings with the controller guide open. Measured fits:
  main menu at 1280×720 stays unscaled; the 640×480 menu uses zoom about
  0.411; settings with controller help open at 1280×720 uses zoom about 0.273
  and remains a complete, narrower column. The rest of `npm run check` was
  not re-run after this change. `git diff --check` on the tracked edits and
  both new files reported no whitespace errors.
- Rendered review used the 1280×720 before/after captures and later fit
  captures. Main menu keeps the logo and sector display, with Continue, New
  Run, and Co-op prominent, How to Play/Settings and player records grouped,
  and About/Credits smaller. Ship setup is two columns when wide and one
  column when narrow. Settings keeps its four tabs and bottom actions visible
  with the scaled content, including with controller help open. Pause shows
  Resume, the two groups, and Settings separated from Save & Quit. A
  short-lived "SECTOR // RUN ENGAGED" toast can cover the pause footer for a
  few seconds. The same toast covered Save & Quit in the baseline capture. It
  is the existing bottom-center toast.
- Death-screen follow-up, 2026-11-05: the solo tally is two side-by-side
  tables, and the death screen scales to the viewport. `tools/ci/player-stats.spec.cjs`
  end-board plus the four death-screen sizes passed 10 tests in 17.9 seconds
  on Playwright Chromium 156.0.8078.4 and Firefox 157.0. Sizes were 1280×720,
  900×700, 1100×640, and 360×640. Each asserts two tables, no scroller, and
  the SIGNAL LOST box inside the window. A separate Firefox measure found no
  scroll overflow. At 1280×720 the screen stays full size and the title sits
  about 190px in from each edge. At 900×700 the screen uses zoom about 0.901,
  and at 1100×640 about 0.969. A 1280×720 Firefox capture shows the full title
  and the two tally tables. The existing bottom-center "SECTOR // RUN ENGAGED"
  toast can cover the last tally row for a few seconds after an immediate death.
- Main-menu Match Tally removal: returning from the death screen leaves the
  menu without that board, and Player Stats still opens. A co-op guest who
  leaves to the menu also has no menu tally, while the saved peer row remains.
  Both checks passed in Chromium 156.0.8078.4 and Firefox 157.0.
- Physical controller, separately installed Google Chrome, browser zoom UI, and
  owner appearance/usability review remain unverified. No commit, push, pull
  request, merge, or publication has been made.
