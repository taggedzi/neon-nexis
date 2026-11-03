# 030 — Add an About page

Status: Implemented — needs validation

Implemented on `codex/030-about-page`. Owner approved copy and appearance on 2026-11-02; physical
controller validation remains pending. This issue does not change gameplay.

Priority 14 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The site should explain what it is, what the player does, and how it works.
The page should be reachable from the navigation, link to the GitHub project,
show the current version, and list contributors. The location is not chosen yet.

## What exists today

The main menu has How to Play and Credits. How to Play is control and survival
copy. Credits (`index.html` screen `screen-credits`) say the game is client-side
HTML5 Canvas and Web Audio, with procedural geometry and synthesized audio.
The network line says "Offline. Local saves only. No tracking." That line is
stale. Co-op exists and is opt-in. Saves are still local. There is still no
score server.

The menu shows `BUILD` plus `N.RELEASE_VERSION`. Source sets that to
`development`. `tools/ci/package.cjs` stamps the `YYYY.MM.DD.####` version into
the staged file and writes `dist/release.json`. There is no separate About
document. The README is the public explanation of the project and calls it a
solo hobby project.

GitHub contributors are a fact from the repository history, not a list this
plan should invent.

## Determine

- Who appears in `git shortlog` or GitHub's contributor list at implementation
  time. Use that output. Do not add names from chat handles.
- Which version a source session should show (`development`) versus a published
  build (the stamped version).
- Whether "how it works" can stay at the level of the README: browser, canvas,
  local saves, optional co-op introduction. It must not become a dump of TURN
  setup or room internals. Those stay in [the co-op protocol](../coop-protocol.md).

## Decide

- Menu screen, or a separate static HTML page linked from the menu?
- Whether Credits is replaced, linked, or left as the shorter transmission.
- The contributor rule: repository history, a hand-maintained line, or "solo
  project" until a second contributor has a commit.
- Whether the stale Credits network line is corrected in this issue.

Original proposal (approved by the owner on 2026-11-02 as recorded below):

- Add an About screen next to How to Play and Credits, using the same menu
  navigation. Do not add a second site.
- About contains: one paragraph on what the game is, one on what the player
  does, one on how it runs (local art and audio, local saves, optional co-op),
  the version line already used by the menu, a link to
  `https://github.com/taggedzi/neon-nexis`, and contributors from the approved
  rule.
- Correct the Credits network line so it does not say the game is always
  offline. Point co-op detail at About's one sentence, not at server docs.
- Keep contributor text as "taggedzi" unless the history check shows someone
  else with a commit the owner wants listed. An agent commit under the owner's
  account is not a new public contributor unless the owner says so.

## Do

After the decisions:

- Add the screen and the menu button. Keyboard and controller focus follow the
  other menu screens.
- Read the version from `N.RELEASE_VERSION`. Do not hard-code a release number.
- External link uses the normal browser navigation and does not start a run.
- Update Credits only as decided.
- Check at desktop width and a narrow window: open About, read the version,
  follow the link's href, return to the menu. No gameplay change to verify
  beyond "Engage still starts a run".

## Acceptance criteria

- [x] About is reachable from the main menu and returns to the menu.
- [x] The page says what the game is, what the player does, and how it runs,
      in the approved words.
- [x] The version matches `N.RELEASE_VERSION` for that file set.
- [x] The GitHub project link is present and correct.
- [x] Contributors match the approved rule.
- [x] The Credits network line is no longer false, if that fix was included.
- [ ] Menu controls still work with keyboard and controller focus.

## Resolved questions

Owner approved main-menu access only and no additional README/license links
on 2026-11-02.

## Dependencies

The version stamp already exists from
[issue 013](013-deployment-and-changelog.md). This page does not wait for
minification or GitHub release assets. Copy about co-op must stay true if
[issue 028](028-coop-four-players.md) later changes the player cap. Use
"optional co-op" rather than a hard-coded player count, or update About in that
issue.

## Implementation and validation

Owner decision (2026-11-02): approved the main-menu About screen, keeping Credits
and correcting its network text, contributor taggedzi, existing runtime version,
and GitHub link. No pause-menu entry or additional README/license links.

Changed files: `index.html`, `js/ui.js`, `css/style.css`, and issue/index records.
About reuses existing panels and navigation. Native links participate in shared
keyboard/controller focus. No dependencies added. History check: both author
emails in `git shortlog -sne HEAD` belong to Matthew Craig (taggedzi).

Validation (agent, Windows, 2026-11-02):
- Chromium 156.0.8078.4 and Firefox 157.0: About opens, Back and Escape return
  to menu; source version equals `N.RELEASE_VERSION`; GitHub href is correct;
  keyboard focus reaches the native link; synthetic controller Back returns to
  menu. Engage still starts a run. No page errors observed.
- Synthetic controller directional focus reaches the GitHub link. Physical
  controller validation is pending.
- Desktop 1280×720 and narrow 360×740 screenshots inspected; no horizontal
  overflow, content and footer remain reachable. Captures are local ignored
  artifacts in `.playwright-mcp/about/`, not release assets.
- Source staging (`node tools/ci/package.cjs`) passed. No release was published.
- `npm run check` passed: syntax, ESLint, all unit checks, and 150 browser
  tests (7.6 minutes for the browser suite). The initial sandboxed attempt could
  not start its PHP server; the retry with local process permissions passed.
- `git diff --check` passed. Controller link focus has a visible solid outline
  in both checked browsers (including after mouse use).

Owner review (2026-11-02): approved the About screen copy and appearance
from the supplied screenshot. This does not claim physical-controller testing.

Limitations/remaining work: physical controller check and owner-managed
delivery. The owner explicitly authorized commit, push, and merge on
2026-11-02. Google Chrome was not checked
separately. No dependencies added. Implementation is ready for the authorized commit and merge.
